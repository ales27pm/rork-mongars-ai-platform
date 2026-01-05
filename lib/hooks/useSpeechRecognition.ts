import { useState, useCallback, useEffect, useRef } from 'react';
import {
  speechRecognitionService,
  SpeechRecognitionConfig,
  SpeechRecognitionResult,
} from '@/lib/services/SpeechRecognitionService';

export interface UseSpeechRecognitionOptions {
  config?: SpeechRecognitionConfig;
  onResult?: (result: SpeechRecognitionResult) => void;
  onError?: (error: Error) => void;
  autoStart?: boolean;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const { config = {}, onResult, onError, autoStart = false } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const unsubscribeResultRef = useRef<(() => void) | null>(null);
  const unsubscribeErrorRef = useRef<(() => void) | null>(null);

  const requestPermission = useCallback(async () => {
    try {
      const granted = await speechRecognitionService.requestPermissions();
      setHasPermission(granted);
      return granted;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      return false;
    }
  }, [onError]);

  const start = useCallback(async () => {
    if (isRecording) {
      console.warn('[useSpeechRecognition] Already recording');
      return;
    }

    try {
      setError(null);
      setTranscript('');
      setInterimTranscript('');

      const granted = hasPermission ?? (await requestPermission());
      if (!granted) {
        throw new Error('Microphone permission not granted');
      }

      await speechRecognitionService.startRecognition(config);
      setIsRecording(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      setIsRecording(false);
    }
  }, [isRecording, hasPermission, requestPermission, config, onError]);

  const stop = useCallback(async () => {
    if (!isRecording) {
      console.warn('[useSpeechRecognition] Not currently recording');
      return null;
    }

    try {
      const uri = await speechRecognitionService.stopRecognition();
      setIsRecording(false);
      return uri;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      setIsRecording(false);
      return null;
    }
  }, [isRecording, onError]);

  const reset = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  useEffect(() => {
    unsubscribeResultRef.current = speechRecognitionService.onResult((result) => {
      if (result.isFinal) {
        setTranscript(result.transcript);
        setInterimTranscript('');
      } else {
        setInterimTranscript(result.transcript);
      }
      onResult?.(result);
    });

    unsubscribeErrorRef.current = speechRecognitionService.onError((err) => {
      setError(err);
      onError?.(err);
      setIsRecording(false);
    });

    return () => {
      unsubscribeResultRef.current?.();
      unsubscribeErrorRef.current?.();
    };
  }, [onResult, onError]);

  useEffect(() => {
    if (autoStart) {
      start();
    }

    return () => {
      if (isRecording) {
        speechRecognitionService.stopRecognition().catch(console.error);
      }
    };
  }, [autoStart, start, isRecording]);

  return {
    isRecording,
    transcript,
    interimTranscript,
    error,
    hasPermission,
    start,
    stop,
    reset,
    requestPermission,
  };
}
