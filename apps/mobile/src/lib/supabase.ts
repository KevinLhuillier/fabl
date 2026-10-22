import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy apps/mobile/.env.example to apps/mobile/.env and restart Expo.',
  );
}

// supabase-js default key, made explicit so `storedSession` can read it back.
const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;

export const supabase = createClient(url, key, {
  auth: {
    // Session lives in AsyncStorage (SecureStore is limited to 2 KB per value).
    storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
    storageKey,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Session saved on the device, even when its access token has expired. */
export async function storedSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/** Client whose session stays in memory, apart from the app's (see `resetPassword`). */
export const createEphemeralClient = () =>
  createClient(url, key, {
    auth: {
      storageKey: 'fabl-ephemeral',
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

// Only refresh the token while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/** Throws on Supabase errors so callers can use plain try/catch. */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** Id of the signed-in user (screens using it are behind the auth guard). */
export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Not signed in');
  return id;
}
