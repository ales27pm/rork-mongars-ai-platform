import { useState, useCallback, useEffect } from 'react';
import {
  textToSpeechService,
  TTSConfig,
  TTSVoice,
} from '@/lib/services/TextToSpeechService';

export interface UseTextToSpeechOptions {
  config?: TTSConfig;
  onStart?: () => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export function useTextToSpeech(options: UseTextToSpeechOptions = {}) {
  const { config = {}, onStart, onComplete, onError } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<TTSVoice[]>([]);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const checkAvailability = useCallback(async () => {
    try {
      const available = await textToSpeechService.isSpeechAvailable();
      setIsAvailable(available);
      return available;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      return false;
    }
  }, [onError]);

  const loadVoices = useCallback(async () => {
    try {
      const voices = textToSpeechService.getAvailableVoices();
      setAvailableVoices(voices);
      return voices;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      return [];
    }
  }, [onError]);

  const speak = useCallback(
    async (text: string, customConfig?: TTSConfig) => {
      if (isSpeaking) {
        console.warn('[useTextToSpeech] Already speaking, stopping current speech');
        await textToSpeechService.stop();
      }

      try {
        setError(null);
        setCurrentText(text);
        setIsSpeaking(true);
        onStart?.();

        await textToSpeechService.speak(text, { ...config, ...customConfig });

        setIsSpeaking(false);
        setCurrentText(null);
        onComplete?.();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        setIsSpeaking(false);
        setCurrentText(null);
      }
    },
    [isSpeaking, config, onStart, onComplete, onError]
  );

  const stop = useCallback(async () => {
    try {
      await textToSpeechService.stop();
      setIsSpeaking(false);
      setCurrentText(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    }
  }, [onError]);

  const pause = useCallback(async () => {
    try {
      await textToSpeechService.pause();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    }
  }, [onError]);

  const resume = useCallback(async () => {
    try {
      await textToSpeechService.resume();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    }
  }, [onError]);

  const getVoicesByLanguage = useCallback((languageCode: string) => {
    return textToSpeechService.getVoicesByLanguage(languageCode);
  }, []);

  const speakQueue = useCallback(
    async (texts: string[], customConfig?: TTSConfig) => {
      try {
        setError(null);
        onStart?.();

        await textToSpeechService.speakWithQueue(texts, {
          ...config,
          ...customConfig,
        });

        onComplete?.();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      }
    },
    [config, onStart, onComplete, onError]
  );

  useEffect(() => {
    checkAvailability();
    loadVoices();
  }, [checkAvailability, loadVoices]);

  useEffect(() => {
    return () => {
      if (isSpeaking) {
        textToSpeechService.stop().catch(console.error);
      }
    };
  }, [isSpeaking]);

  return {
    isSpeaking,
    currentText,
    availableVoices,
    isAvailable,
    error,
    speak,
    stop,
    pause,
    resume,
    getVoicesByLanguage,
    speakQueue,
    checkAvailability,
    loadVoices,
  };
}
