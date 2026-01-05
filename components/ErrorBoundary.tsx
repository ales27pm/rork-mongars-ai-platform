import React, { Component, ReactNode, ErrorInfo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { monitoringService } from '@/lib/services/MonitoringService';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, resetError: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);

    this.setState({ errorInfo });

    monitoringService.trackError(error, {
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
    });

    this.props.onError?.(error, errorInfo);

    const maxRetries = this.props.maxRetries || 3;
    if (this.state.retryCount < maxRetries) {
      console.log(`[ErrorBoundary] Auto-recovery attempt ${this.state.retryCount + 1}/${maxRetries}`);
      this.scheduleAutoRecovery();
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  scheduleAutoRecovery = () => {
    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000);
    
    this.retryTimeout = setTimeout(() => {
      console.log('[ErrorBoundary] Attempting auto-recovery...');
      this.resetError();
    }, delay);
  };

  resetError = () => {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    this.setState((prevState) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
    }));
  };

  resetCompletely = () => {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetCompletely);
      }

      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.iconContainer}>
              <AlertTriangle size={64} color="#ef4444" />
            </View>
            
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              The app encountered an unexpected error
            </Text>

            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Error Details:</Text>
              <Text style={styles.errorMessage}>{this.state.error.message}</Text>
              {this.state.error.stack && (
                <Text style={styles.errorStack} numberOfLines={10}>
                  {this.state.error.stack}
                </Text>
              )}
            </View>

            <View style={styles.retryInfo}>
              <Text style={styles.retryText}>
                Retry attempts: {this.state.retryCount} / {this.props.maxRetries || 3}
              </Text>
              {this.state.retryCount < (this.props.maxRetries || 3) && (
                <Text style={styles.autoRetryText}>
                  Auto-retry in progress...
                </Text>
              )}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={this.resetCompletely}
              >
                <RefreshCw size={20} color="#ffffff" />
                <Text style={styles.primaryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.supportText}>
              If this problem persists, please contact support
            </Text>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 32,
    textAlign: 'center',
  },
  errorBox: {
    width: '100%',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fee2e2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991b1b',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#dc2626',
    marginBottom: 12,
    fontWeight: '500',
  },
  errorStack: {
    fontSize: 12,
    color: '#7f1d1d',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) as any,
  },
  retryInfo: {
    width: '100%',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  retryText: {
    fontSize: 14,
    color: '#1e40af',
    fontWeight: '500',
  },
  autoRetryText: {
    fontSize: 12,
    color: '#3b82f6',
    marginTop: 4,
  },
  actions: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  supportText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
