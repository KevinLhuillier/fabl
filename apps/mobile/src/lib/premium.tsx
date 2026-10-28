/**
 * Premium subscription (RevenueCat → Google Play Billing).
 *
 * The app starts purchases, but the server decides: RevenueCat notifies the
 * `revenuecat-webhook` Edge Function, which writes `subscriptions`, and the database
 * opens premium content from it (passages/tokens policies, word limit trigger). So
 * `premium` here is read from `subscriptions`; right after a purchase or a restore the
 * app asks `sync-subscription` to update it at once instead of waiting for the webhook.
 *
 * The RevenueCat customer is the Supabase user (Purchases.logIn), so the subscription
 * follows the account, not the phone. In Expo Go, react-native-purchases runs in its
 * "preview" mode (mocked store): real purchases need a development build.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

import { useAuth } from './auth';
import { supabase, unwrap } from './supabase';

/** Words a free account can keep. Enforced by the database (check_vocabulary_limit). */
export const FREE_WORD_LIMIT = 30;
/** Chapters of a premium story a free account can read. Enforced by the passages policy. */
export const FREE_CHAPTERS = 2;
/** RevenueCat entitlement of the subscription (also REVENUECAT_ENTITLEMENT on the server). */
const ENTITLEMENT = 'premium';

const API_KEY = Platform.select({
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
});

/** The store's subscription page (subscriptions can't be cancelled from the app). */
const STORE_SUBSCRIPTIONS_URL =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions?package=com.taleway.app';

export type Subscription = {
  active: boolean;
  /** End of the paid period (grace period included); null = never expires. */
  expires_at: string | null;
  /** False once cancelled: premium until `expires_at`. */
  will_renew: boolean | null;
  billing_issue: boolean;
  product_id: string | null;
};

export type PurchaseOutcome = 'done' | 'cancelled' | 'pending';

type PremiumContextValue = {
  /** Premium according to the server: what opens the content. */
  premium: boolean;
  subscription: Subscription | null;
  /** False until the signed-in user's subscription has been read. */
  ready: boolean;
  /** The store can be used (RevenueCat key set in the build). */
  storeAvailable: boolean;
  /** Where the user manages or cancels the subscription. */
  managementUrl: string;
  /** The packages of the current offering (monthly, annual…), as set in RevenueCat. */
  loadPackages: () => Promise<PurchasesPackage[]>;
  purchase: (pkg: PurchasesPackage) => Promise<PurchaseOutcome>;
  /** Restores the store purchases of this Google account; resolves to the premium status. */
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
};

const PremiumContext = createContext<PremiumContextValue | null>(null);

const isActive = (s: Subscription | null) =>
  !!s?.active && (s.expires_at === null || new Date(s.expires_at).getTime() > Date.now());

const hasEntitlement = (info: CustomerInfo) => info.entitlements.active[ENTITLEMENT] !== undefined;

/**
 * The SDK's default handler sends everything to the console, closing the Google Play sheet
 * included (logged as an error): the app handles that one, it is only debug noise.
 */
function logStore(level: LOG_LEVEL, message: string) {
  const line = `[RevenueCat] ${message}`;
  if (level === LOG_LEVEL.ERROR && /USER_CANCELED|PurchaseCancelledError/.test(message)) {
    console.debug(line);
  } else if (level === LOG_LEVEL.ERROR) {
    console.error(line);
  } else if (level === LOG_LEVEL.WARN) {
    console.warn(line);
  } else {
    console.debug(line);
  }
}

let configured = false;
function configureStore() {
  if (configured || !API_KEY) return;
  // Before configure, which installs the default handler otherwise.
  Purchases.setLogHandler(logStore);
  Purchases.configure({ apiKey: API_KEY });
  configured = true;
}

async function fetchSubscription(): Promise<Subscription | null> {
  return unwrap(
    await supabase
      .from('subscriptions')
      .select('active, expires_at, will_renew, billing_issue, product_id')
      .maybeSingle(),
  ) as Subscription | null;
}

/** Asks the server to read the subscription from RevenueCat now. */
async function syncServer() {
  const { error } = await supabase.functions.invoke('sync-subscription', { method: 'POST' });
  if (error) console.warn('sync-subscription', error);
}

export function PremiumProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [managementUrl, setManagementUrl] = useState(STORE_SUBSCRIPTIONS_URL);
  // RevenueCat user currently logged in (logOut throws for an anonymous one).
  const storeUser = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    setSubscription(await fetchSubscription());
  }, []);

  // The store knows before the webhook: sync the server when they disagree.
  const reconcile = useCallback(async (info: CustomerInfo) => {
    if (info.managementURL) setManagementUrl(info.managementURL);
    const current = await fetchSubscription();
    if (hasEntitlement(info) !== isActive(current)) {
      await syncServer();
      setSubscription(await fetchSubscription());
    } else {
      setSubscription(current);
    }
  }, []);

  useEffect(() => {
    configureStore();
    if (!configured) return;
    const listener = (info: CustomerInfo) => {
      if (storeUser.current) reconcile(info).catch(console.warn);
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [reconcile]);

  useEffect(() => {
    if (!userId) {
      if (configured && storeUser.current) {
        storeUser.current = null;
        Purchases.logOut().catch(console.warn);
      }
      return;
    }
    let cancelled = false;
    fetchSubscription()
      .then((s) => !cancelled && setSubscription(s))
      .catch(console.warn)
      .finally(() => !cancelled && setLoadedFor(userId));
    if (configured) {
      storeUser.current = userId;
      Purchases.logIn(userId)
        .then(({ customerInfo }) => (cancelled ? undefined : reconcile(customerInfo)))
        .catch(console.warn);
    }
    return () => {
      cancelled = true;
    };
  }, [userId, reconcile]);

  // A subscription can end (or be renewed) while the app sleeps.
  useEffect(() => {
    if (!userId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh().catch(console.warn);
    });
    return () => sub.remove();
  }, [userId, refresh]);

  const loadPackages = useCallback(async () => {
    if (!configured) return [];
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  }, []);

  const purchase = useCallback(async (pkg: PurchasesPackage): Promise<PurchaseOutcome> => {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      await syncServer();
      setSubscription(await fetchSubscription());
      // Some payment methods confirm later (cash, bank transfer): the webhook will follow.
      return hasEntitlement(customerInfo) ? 'done' : 'pending';
    } catch (e) {
      const err = e as { userCancelled?: boolean | null; code?: string };
      if (err.userCancelled || err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return 'cancelled';
      }
      throw e;
    }
  }, []);

  const restore = useCallback(async () => {
    if (configured) await Purchases.restorePurchases();
    await syncServer();
    const s = await fetchSubscription();
    setSubscription(s);
    return isActive(s);
  }, []);

  return (
    <PremiumContext.Provider
      value={{
        // Until the new account's row is read, not the previous account's.
        premium: !!userId && loadedFor === userId && isActive(subscription),
        subscription: userId && loadedFor === userId ? subscription : null,
        ready: !userId || loadedFor === userId,
        storeAvailable: !!API_KEY,
        managementUrl,
        loadPackages,
        purchase,
        restore,
        refresh,
      }}>
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error('usePremium must be used inside PremiumProvider');
  return ctx;
}

/** A chapter free accounts can read: any chapter of a free story, the first ones of a premium one. */
export const isFreeChapter = (storyPremium: boolean, chapterPosition: number) =>
  !storyPremium || chapterPosition < FREE_CHAPTERS;
