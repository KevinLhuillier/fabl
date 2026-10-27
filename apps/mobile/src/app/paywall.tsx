import { router } from 'expo-router';
import { BookOpen, Check, Crown, Infinity as InfinityIcon, Sparkles, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { PurchasesPackage } from 'react-native-purchases';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandGradient } from '@/components/BrandGradient';
import { useI18n, type Messages } from '@/i18n';
import { usePremium } from '@/lib/premium';
import {
  Badge,
  Button,
  Card,
  Icon,
  IconBubble,
  Loader,
  Text,
  colors,
  enter,
  haptics,
  palette,
  radii,
  spacing,
  type LucideIcon,
} from '@/theme';

const SITE = 'https://fabl-site.vercel.app';

type Period = keyof Messages['premium']['periods'];
const PERIOD_ORDER: Period[] = [
  'ANNUAL',
  'SIX_MONTH',
  'THREE_MONTH',
  'MONTHLY',
  'WEEKLY',
  'LIFETIME',
];
const periodOf = (pkg: PurchasesPackage): Period | null =>
  (PERIOD_ORDER as string[]).includes(pkg.packageType) ? (pkg.packageType as Period) : null;

/** Days of the free trial of a Google Play subscription, if it has one. */
function trialDays(pkg: PurchasesPackage): number | null {
  const period = pkg.product.defaultOption?.freePhase?.billingPeriod;
  if (!period) return null;
  const days = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365, UNKNOWN: 0 }[period.unit] * period.value;
  return days || null;
}

/** Saving of the annual plan over twelve months of the monthly one, in %. */
function annualSaving(packages: PurchasesPackage[]): number | null {
  const monthly = packages.find((p) => p.packageType === 'MONTHLY');
  const annual = packages.find((p) => p.packageType === 'ANNUAL');
  if (!monthly || !annual || monthly.product.price <= 0) return null;
  const saving = Math.round((1 - annual.product.price / (monthly.product.price * 12)) * 100);
  return saving > 0 ? saving : null;
}

/** The premium offer: what it gives, the plans of the current RevenueCat offering, restore. */
export default function Paywall() {
  const { t } = useI18n();
  const p = t.premium;
  const { premium, subscription, storeAvailable, managementUrl, loadPackages, purchase, restore } =
    usePremium();
  // Without RevenueCat key (store unavailable) there is nothing to load.
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(storeAvailable ? null : []);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<'purchase' | 'restore' | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    if (!storeAvailable) return;
    loadPackages()
      .then((list) => {
        const sorted = [...list].sort(
          (a, b) =>
            PERIOD_ORDER.indexOf(periodOf(a) ?? 'LIFETIME') -
            PERIOD_ORDER.indexOf(periodOf(b) ?? 'LIFETIME'),
        );
        setPackages(sorted);
        setSelected(sorted[0]?.identifier ?? null);
      })
      .catch((e: unknown) => {
        console.warn('offerings', e);
        setPackages([]);
        setMessage({ text: p.loadError, error: true });
      });
  }, [storeAvailable, loadPackages, p.loadError]);

  const chosen = packages?.find((pkg) => pkg.identifier === selected) ?? null;
  const saving = packages ? annualSaving(packages) : null;
  const chosenTrial = chosen ? trialDays(chosen) : null;

  async function buy() {
    if (!chosen) return;
    setBusy('purchase');
    setMessage(null);
    try {
      const outcome = await purchase(chosen);
      if (outcome === 'done') {
        haptics.success();
        setWelcome(true);
      } else if (outcome === 'pending') {
        setMessage({ text: p.pending, error: false });
      }
    } catch (e) {
      console.warn('purchase', e);
      setMessage({ text: p.purchaseError, error: true });
    } finally {
      setBusy(null);
    }
  }

  async function restorePurchases() {
    setBusy('restore');
    setMessage(null);
    try {
      if (await restore()) {
        haptics.success();
        setWelcome(true);
      } else {
        setMessage({ text: p.nothingToRestore, error: false });
      }
    } catch (e) {
      console.warn('restore', e);
      setMessage({ text: p.loadError, error: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t.common.close}>
          <Icon icon={X} size={28} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={enter.up()} style={styles.hero}>
          <BrandGradient />
          <IconBubble
            icon={welcome ? Check : Crown}
            diameter={72}
            color={palette.white}
            background="rgba(255,255,255,0.18)"
          />
          <Text variant="title" align="center" color={palette.white}>
            {welcome ? p.welcome : premium ? p.activeTitle : p.title}
          </Text>
          {welcome || premium ? null : (
            <Text align="center" color="rgba(255,255,255,0.88)">
              {p.subtitle}
            </Text>
          )}
        </Animated.View>

        <View style={styles.benefits}>
          <Benefit icon={BookOpen} label={p.benefits.stories} delay={60} />
          <Benefit icon={InfinityIcon} label={p.benefits.words} delay={120} />
          <Benefit icon={Sparkles} label={p.benefits.newStories} delay={180} />
        </View>

        {welcome ? (
          <Button label={t.common.continue} onPress={() => router.back()} />
        ) : premium ? (
          <View style={styles.stack}>
            {subscription?.expires_at ? (
              <Text align="center" color={colors.textSecondary}>
                {(subscription.will_renew === false ? p.endsOn : p.renewsOn)(
                  p.date(new Date(subscription.expires_at)),
                )}
              </Text>
            ) : null}
            <Button
              label={p.manage}
              variant="secondary"
              onPress={() => Linking.openURL(managementUrl)}
            />
          </View>
        ) : packages === null ? (
          <Loader />
        ) : (
          <View style={styles.stack}>
            {!storeAvailable ? (
              <Text align="center" color={colors.textSecondary}>
                {p.unavailable}
              </Text>
            ) : null}
            {packages.map((pkg, i) => (
              <Animated.View key={pkg.identifier} entering={enter.up(220 + i * 60)}>
                <PlanCard
                  pkg={pkg}
                  selected={pkg.identifier === selected}
                  saving={pkg.packageType === 'ANNUAL' ? saving : null}
                  onPress={() => {
                    haptics.tap();
                    setSelected(pkg.identifier);
                  }}
                />
              </Animated.View>
            ))}
            {chosen ? (
              <Button
                label={chosenTrial ? p.startTrial : p.subscribe}
                variant="success"
                loading={busy === 'purchase'}
                disabled={!!busy}
                onPress={buy}
              />
            ) : null}
            {message ? (
              <Text
                align="center"
                variant="bodyBold"
                color={message.error ? colors.danger : colors.textSecondary}>
                {message.text}
              </Text>
            ) : null}
            <Button
              label={p.restore}
              variant="ghost"
              haptic="tap"
              loading={busy === 'restore'}
              disabled={!!busy}
              onPress={restorePurchases}
            />
            <Text variant="caption" align="center" color={colors.textMuted}>
              {p.legal}
            </Text>
            <View style={styles.links}>
              <Text
                variant="caption"
                color={colors.textSecondary}
                style={styles.link}
                onPress={() => Linking.openURL(`${SITE}/confidentialite`)}>
                {p.privacy}
              </Text>
              <Text variant="caption" color={colors.textMuted}>
                ·
              </Text>
              <Text
                variant="caption"
                color={colors.textSecondary}
                style={styles.link}
                onPress={() => Linking.openURL(`${SITE}/mentions-legales`)}>
                {p.legalNotice}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Benefit({ icon, label, delay }: { icon: LucideIcon; label: string; delay: number }) {
  return (
    <Animated.View entering={enter.up(delay)} style={styles.benefit}>
      <View style={styles.benefitIcon}>
        <Icon icon={icon} size={20} color={colors.primary} />
      </View>
      <Text variant="bodyBold" style={styles.flex}>
        {label}
      </Text>
    </Animated.View>
  );
}

function PlanCard({
  pkg,
  selected,
  saving,
  onPress,
}: {
  pkg: PurchasesPackage;
  selected: boolean;
  saving: number | null;
  onPress: () => void;
}) {
  const { t } = useI18n();
  const p = t.premium;
  const period = periodOf(pkg);
  const trial = trialDays(pkg);
  const perMonth =
    period && period !== 'MONTHLY' && period !== 'WEEKLY' && period !== 'LIFETIME'
      ? pkg.product.pricePerMonthString
      : null;

  return (
    <Card
      onPress={onPress}
      tint={
        selected
          ? { face: colors.primarySoft, edge: colors.primary }
          : { face: colors.surface, edge: colors.border }
      }>
      <View
        style={styles.plan}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}>
        <View style={[styles.radio, selected && styles.radioOn]}>
          {selected ? <Icon icon={Check} size={14} color={colors.textOnColor} /> : null}
        </View>
        <View style={styles.flex}>
          <View style={styles.planTitle}>
            <Text variant="heading">{period ? p.periods[period] : pkg.product.title}</Text>
            {saving ? <Badge label={p.save(saving)} tone="success" /> : null}
          </View>
          {pkg.packageType === 'ANNUAL' ? (
            <Text variant="caption" color={colors.primary}>
              {p.bestValue}
            </Text>
          ) : null}
          {trial ? (
            <Text variant="caption" color={colors.successShade}>
              {p.freeTrial(trial)}
            </Text>
          ) : null}
        </View>
        <View style={styles.price}>
          <Text variant="heading">{pkg.product.priceString}</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {period ? p.per[period] : ''}
          </Text>
          {perMonth ? (
            <Text variant="caption" color={colors.textMuted}>
              {p.perMonth(perMonth)}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  content: { padding: spacing.xl, paddingTop: 0, gap: spacing.xl, paddingBottom: spacing.xxxl },
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  benefits: { gap: spacing.md },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  stack: { gap: spacing.md },
  plan: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  planTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderShade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  price: { alignItems: 'flex-end' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  link: { textDecorationLine: 'underline' },
});
