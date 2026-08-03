import type { AuthTokens, TokenStore } from "@kaya/core";
import * as SecureStore from "expo-secure-store";

// Ported verbatim from legacy/flutter/kaya_core/lib/src/services/secure_token_storage.dart.
const ACCESS_KEY = "kaya.access_token";
const REFRESH_KEY = "kaya.refresh_token";

// iOS: allow the keychain entry to be read once the device has been unlocked
// at least once since boot, and to stay readable while the device is locked
// again afterwards. This is the equivalent of the Flutter implementation's
// `KeychainAccessibility.first_unlock`, and it matters here for the same
// reason it did there: a token refresh fired by the HTTP interceptor while
// the app is backgrounded must still be able to read the refresh token.
const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

/**
 * Platform-backed TokenStore, keyed into the iOS Keychain / Android Keystore
 * via expo-secure-store. This is the concrete half of the TokenStore
 * interface @kaya/core declares — see packages/kaya-core/src/storage/tokenStore.ts.
 *
 * expo-secure-store rejects rather than resolving to null on some devices
 * when the keychain is unavailable (for example, right after install before
 * the device has been unlocked once). A throw from a read would propagate
 * straight into the @kaya/core HTTP interceptor and turn a recoverable "no
 * token yet" into a hard failure on screen, so every read here degrades to
 * null. Writes are the opposite: a failed write must throw, because a user
 * who appears signed in but whose token silently failed to save is worse off
 * than one who sees a failed sign-in.
 */
export class SecureTokenStore implements TokenStore {
  async readAccess(): Promise<string | null> {
    return readOrNull(ACCESS_KEY);
  }

  async readRefresh(): Promise<string | null> {
    return readOrNull(REFRESH_KEY);
  }

  async save(tokens: AuthTokens): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken, KEYCHAIN_OPTIONS);
    await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken, KEYCHAIN_OPTIONS);
  }

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_KEY, KEYCHAIN_OPTIONS);
    await SecureStore.deleteItemAsync(REFRESH_KEY, KEYCHAIN_OPTIONS);
  }
}

async function readOrNull(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key, KEYCHAIN_OPTIONS);
  } catch {
    return null;
  }
}
