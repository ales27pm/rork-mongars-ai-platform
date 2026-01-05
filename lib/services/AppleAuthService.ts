import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { LocalProfile } from '@/types/auth';

const SECURE_STORE_KEYS = {
  USER_ID: 'apple_auth_user_id',
  PROFILE: 'apple_auth_profile',
} as const;

export class AppleAuthService {
  static async isAppleSignInAvailable(): Promise<boolean> {
    try {
      if (Platform.OS !== 'ios') {
        console.log('[AppleAuth] Apple Sign-In only available on iOS');
        return false;
      }
      const available = await AppleAuthentication.isAvailableAsync();
      console.log('[AppleAuth] Apple Sign-In available:', available);
      return available;
    } catch (error) {
      console.error('[AppleAuth] Error checking availability:', error);
      return false;
    }
  }

  static async signInWithApple(): Promise<LocalProfile> {
    try {
      console.log('[AppleAuth] Starting sign in flow...');
      
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('[AppleAuth] Sign in successful, user:', credential.user);

      const profile: LocalProfile = {
        userId: credential.user,
        email: credential.email ?? undefined,
        fullName: credential.fullName
          ? {
              givenName: credential.fullName.givenName ?? null,
              familyName: credential.fullName.familyName ?? null,
            }
          : undefined,
        identityToken: credential.identityToken ?? undefined,
        authorizationCode: credential.authorizationCode ?? undefined,
        authenticatedAt: Date.now(),
      };

      await this.storeProfile(profile);
      console.log('[AppleAuth] Profile stored successfully');

      return profile;
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        console.log('[AppleAuth] User canceled sign in');
        throw new Error('User canceled sign in');
      }
      console.error('[AppleAuth] Sign in error:', error);
      throw new Error(`Apple Sign-In failed: ${error.message || 'Unknown error'}`);
    }
  }

  static async getStoredAppleUser(): Promise<string | null> {
    try {
      const userId = await SecureStore.getItemAsync(SECURE_STORE_KEYS.USER_ID);
      console.log('[AppleAuth] Stored user ID:', userId ? 'exists' : 'none');
      return userId;
    } catch (error) {
      console.error('[AppleAuth] Error getting stored user:', error);
      return null;
    }
  }

  static async loadLocalProfile(): Promise<LocalProfile | null> {
    try {
      const profileJson = await SecureStore.getItemAsync(SECURE_STORE_KEYS.PROFILE);
      if (!profileJson) {
        console.log('[AppleAuth] No stored profile found');
        return null;
      }

      const profile = JSON.parse(profileJson) as LocalProfile;
      console.log('[AppleAuth] Loaded profile for user:', profile.userId);
      return profile;
    } catch (error) {
      console.error('[AppleAuth] Error loading profile:', error);
      return null;
    }
  }

  static async isStoredUserStillAuthorized(): Promise<boolean> {
    try {
      const userId = await this.getStoredAppleUser();
      if (!userId) {
        console.log('[AppleAuth] No stored user to check');
        return false;
      }

      if (Platform.OS !== 'ios') {
        console.log('[AppleAuth] Cannot check credential state on non-iOS platform, assuming authorized');
        return true;
      }

      if (!await this.isAppleSignInAvailable()) {
        console.log('[AppleAuth] Apple Sign-In not available, cannot verify credential state');
        return false;
      }

      console.log('[AppleAuth] Checking credential state for user:', userId);
      
      const credentialState = await AppleAuthentication.getCredentialStateAsync(userId);
      console.log('[AppleAuth] Credential state:', credentialState);

      const isAuthorized = credentialState === AppleAuthentication.AppleAuthenticationCredentialState.AUTHORIZED;
      
      if (!isAuthorized) {
        console.log('[AppleAuth] User no longer authorized, clearing local data');
        await this.signOutLocal();
      }

      return isAuthorized;
    } catch (error) {
      console.error('[AppleAuth] Error checking credential state:', error);
      
      if (error instanceof Error && error.message.includes('not supported on the simulator')) {
        console.log('[AppleAuth] Simulator detected - cannot verify credential state, treating as unauthorized for safety');
        return false;
      }
      
      return false;
    }
  }

  static async signOutLocal(): Promise<void> {
    try {
      console.log('[AppleAuth] Signing out locally...');
      await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.USER_ID);
      await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.PROFILE);
      console.log('[AppleAuth] Local sign out complete');
    } catch (error) {
      console.error('[AppleAuth] Error signing out:', error);
      throw error;
    }
  }

  static installAppleRevokeListener(onRevoke: () => void): { remove: () => void } | null {
    if (Platform.OS !== 'ios') {
      console.log('[AppleAuth] Revoke listener only available on iOS');
      return null;
    }

    console.log('[AppleAuth] Installing revoke listener');
    
    const listener = AppleAuthentication.addRevokeListener(() => {
      console.log('[AppleAuth] Apple credentials revoked!');
      this.signOutLocal().then(() => {
        onRevoke();
      }).catch(error => {
        console.error('[AppleAuth] Error handling revoke:', error);
        onRevoke();
      });
    });

    return listener;
  }

  private static async storeProfile(profile: LocalProfile): Promise<void> {
    try {
      await SecureStore.setItemAsync(SECURE_STORE_KEYS.USER_ID, profile.userId);
      await SecureStore.setItemAsync(SECURE_STORE_KEYS.PROFILE, JSON.stringify(profile));
      console.log('[AppleAuth] Profile stored in secure storage');
    } catch (error) {
      console.error('[AppleAuth] Error storing profile:', error);
      throw error;
    }
  }
}
