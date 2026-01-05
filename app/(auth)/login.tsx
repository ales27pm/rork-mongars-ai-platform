import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '@/lib/providers/auth';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AppleAuthService } from '@/lib/services/AppleAuthService';

export default function LoginScreen() {
  const { signIn, isLoading } = useAuth();
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    const available = await AppleAuthService.isAppleSignInAvailable();
    setIsAvailable(available);
    
    if (!available) {
      console.log('[LoginScreen] Apple Sign-In not available on this device');
    }
  };

  const handleSignIn = async () => {
    try {
      await signIn();
    } catch (error) {
      if (error instanceof Error && error.message === 'User canceled sign in') {
        return;
      }
      
      Alert.alert(
        'Sign In Failed',
        error instanceof Error ? error.message : 'An unknown error occurred',
        [{ text: 'OK' }]
      );
    }
  };

  if (isAvailable === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (!isAvailable) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.content}>
          <Text style={styles.title}>Sign In Required</Text>
          <Text style={styles.subtitle}>
            {Platform.OS === 'ios'
              ? 'Apple Sign-In is not available on this device or simulator.'
              : 'Apple Sign-In is only available on iOS devices.'}
          </Text>
          <Text style={styles.hint}>
            Please run this app on a physical iOS device to sign in.
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#000000', '#1a1a1a', '#2d2d2d']}
      style={styles.container}
    >
      <SafeAreaView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to monGARS</Text>
          <Text style={styles.subtitle}>
            A personal AI companion that learns and evolves with you
          </Text>
        </View>

        <View style={styles.features}>
          <FeatureItem 
            icon="🧠" 
            title="Adaptive Memory" 
            description="Remembers conversations and learns from interactions"
          />
          <FeatureItem 
            icon="🌱" 
            title="Continuous Evolution" 
            description="Self-improves through on-device machine learning"
          />
          <FeatureItem 
            icon="🔒" 
            title="Private & Secure" 
            description="All data stays on your device, completely private"
          />
        </View>

        <View style={styles.buttonContainer}>
          {isLoading ? (
            <View style={styles.loadingButton}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          ) : (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={12}
              style={styles.appleButton}
              onPress={handleSignIn}
            />
          )}
        </View>

        <Text style={styles.privacy}>
          Your Apple ID is used only for authentication.{'\n'}
          No data is shared with third parties.
        </Text>
      </SafeAreaView>
    </LinearGradient>
  );
}

function FeatureItem({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    marginTop: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    color: '#999',
    lineHeight: 26,
  },
  features: {
    gap: 24,
  },
  featureItem: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 16,
  },
  featureIcon: {
    fontSize: 32,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 15,
    color: '#999',
    lineHeight: 22,
  },
  buttonContainer: {
    marginTop: 32,
    marginBottom: 16,
  },
  appleButton: {
    width: '100%',
    height: 56,
  },
  loadingButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  privacy: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  hint: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center' as const,
    marginTop: 16,
    lineHeight: 22,
  },
});
