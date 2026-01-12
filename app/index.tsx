import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect, Href } from 'expo-router';
import { useAuth } from '@/lib/providers/auth';

export default function Index() {
  const { ready, signedIn } = useAuth();

  if (!ready) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (!signedIn) {
    return <Redirect href={"/(auth)/login" as Href} />;
  }

  return <Redirect href={"/(tabs)/chat" as Href} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: '#fff',
  },
});
