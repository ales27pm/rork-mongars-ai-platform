import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import type { PersonalityProfile } from '@/types';

const STORAGE_KEY = 'mongars_personality';

const defaultProfile: PersonalityProfile = {
  userId: 'default',
  style: 'technical',
  verbosity: 'normal',
  learningRate: 0.1,
  adaptationHistory: [],
};

export const [PersonalityProvider, usePersonality] = createContextHook(() => {
  const [profile, setProfile] = useState<PersonalityProfile>(defaultProfile);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setProfile(JSON.parse(stored));
      }
    } catch (error) {
      console.error('[Personality] Load error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveProfile = useCallback(async (newProfile: PersonalityProfile) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
      setProfile(newProfile);
      console.log('[Personality] Profile saved');
    } catch (error) {
      console.error('[Personality] Save error:', error);
    }
  }, []);

  const adapt = useCallback((adjustment: string) => {
    setProfile(prev => {
      const updated = {
        ...prev,
        adaptationHistory: [
          ...prev.adaptationHistory,
          { timestamp: Date.now(), adjustment },
        ].slice(-20),
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const setStyle = useCallback((style: PersonalityProfile['style']) => {
    setProfile(prev => {
      const updated = { ...prev, style };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const setVerbosity = useCallback((verbosity: PersonalityProfile['verbosity']) => {
    setProfile(prev => {
      const updated = { ...prev, verbosity };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return {
    profile,
    isLoading,
    adapt,
    setStyle,
    setVerbosity,
    saveProfile,
  };
});
