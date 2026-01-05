import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

export interface MicrophoneStopResult {
  uri?: string | null;
  blob?: Blob | null;
}

export function useMicrophone() {
  const [isRecording, setIsRecording] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [error, setError] = useState<Error | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const isWebSupported = useMemo(() => {
    if (Platform.OS !== 'web') return true;
    return typeof navigator !== 'undefined'
      && typeof navigator.mediaDevices?.getUserMedia === 'function'
      && typeof MediaRecorder !== 'undefined';
  }, []);

  const requestPermission = useCallback(async () => {
    if (Platform.OS === 'web') {
      setPermissionStatus('granted');
      return true;
    }

    try {
      const current = await Audio.getPermissionsAsync();
      if (current.status === 'granted') {
        setPermissionStatus('granted');
        return true;
      }

      const { status } = await Audio.requestPermissionsAsync();
      setPermissionStatus(status === 'granted' ? 'granted' : 'denied');
      return status === 'granted';
    } catch (err) {
      const permissionError = err instanceof Error ? err : new Error(String(err));
      setError(permissionError);
      setPermissionStatus('denied');
      return false;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording) {
      console.warn('[useMicrophone] Recording already in progress');
      return;
    }

    const granted = await requestPermission();
    if (!granted) {
      throw new Error('Microphone permission not granted');
    }

    if (Platform.OS === 'web') {
      if (!isWebSupported) {
        throw new Error('Microphone recording is not supported in this environment');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (err) {
      const startError = err instanceof Error ? err : new Error(String(err));
      setError(startError);
      throw startError;
    }
  }, [isRecording, isWebSupported, requestPermission]);

  const stopRecording = useCallback(async (): Promise<MicrophoneStopResult | null> => {
    if (!isRecording) {
      console.warn('[useMicrophone] No active recording to stop');
      return null;
    }

    try {
      if (Platform.OS === 'web') {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          await new Promise<void>((resolve) => {
            if (mediaRecorderRef.current) {
              mediaRecorderRef.current.onstop = () => resolve();
              mediaRecorderRef.current.stop();
            }
          });

          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
          mediaRecorderRef.current = null;
          audioChunksRef.current = [];
          setIsRecording(false);
          return { blob };
        }

        setIsRecording(false);
        return null;
      }

      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        recordingRef.current = null;
        setIsRecording(false);

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
        });

        return { uri };
      }

      setIsRecording(false);
      return null;
    } catch (err) {
      const stopError = err instanceof Error ? err : new Error(String(err));
      setError(stopError);
      setIsRecording(false);
      return null;
    }
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(console.error);
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    isRecording,
    permissionStatus,
    error,
    isWebSupported,
    requestPermission,
    startRecording,
    stopRecording,
  };
}
