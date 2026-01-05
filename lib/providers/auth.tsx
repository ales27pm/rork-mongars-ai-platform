import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { AppleAuthService } from '@/lib/services/AppleAuthService';
import type { LocalProfile } from '@/types/auth';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAuthState = useCallback(async () => {
    try {
      console.log('[AuthProvider] Checking auth state...');
      setIsLoading(true);
      setError(null);

      const storedProfile = await AppleAuthService.loadLocalProfile();
      
      if (!storedProfile) {
        console.log('[AuthProvider] No stored profile, user not signed in');
        setSignedIn(false);
        setProfile(null);
        setReady(true);
        return;
      }

      const isAuthorized = await AppleAuthService.isStoredUserStillAuthorized();
      
      if (isAuthorized) {
        console.log('[AuthProvider] User is authorized');
        setProfile(storedProfile);
        setSignedIn(true);
      } else {
        console.log('[AuthProvider] User no longer authorized');
        setProfile(null);
        setSignedIn(false);
      }

      setReady(true);
    } catch (err) {
      console.error('[AuthProvider] Error checking auth state:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSignedIn(false);
      setProfile(null);
      setReady(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signIn = useCallback(async () => {
    try {
      console.log('[AuthProvider] Starting sign in...');
      setIsLoading(true);
      setError(null);

      const newProfile = await AppleAuthService.signInWithApple();
      
      setProfile(newProfile);
      setSignedIn(true);
      console.log('[AuthProvider] Sign in successful');
    } catch (err) {
      console.error('[AuthProvider] Sign in error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Sign in failed';
      
      if (errorMessage === 'User canceled sign in') {
        console.log('[AuthProvider] User canceled, not setting error');
        setError(null);
      } else {
        setError(errorMessage);
      }
      
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      console.log('[AuthProvider] Starting sign out...');
      setIsLoading(true);
      setError(null);

      await AppleAuthService.signOutLocal();
      
      setProfile(null);
      setSignedIn(false);
      console.log('[AuthProvider] Sign out successful');
    } catch (err) {
      console.error('[AuthProvider] Sign out error:', err);
      setError(err instanceof Error ? err.message : 'Sign out failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthState();
  }, [checkAuthState]);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      console.log('[AuthProvider] Revoke listener only works on iOS');
      return;
    }

    const listener = AppleAuthService.installAppleRevokeListener(() => {
      console.log('[AuthProvider] Apple credentials revoked, signing out...');
      setProfile(null);
      setSignedIn(false);
      checkAuthState();
    });

    return () => {
      if (listener) {
        console.log('[AuthProvider] Removing revoke listener');
        listener.remove();
      }
    };
  }, [checkAuthState]);

  return {
    ready,
    signedIn,
    profile,
    isLoading,
    error,
    signIn,
    signOut,
    refreshAuth: checkAuthState,
  };
});
