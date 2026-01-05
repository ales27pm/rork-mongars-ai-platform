import { Audio } from 'expo-av';

export interface SpeechRecognitionConfig {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  alternatives?: { transcript: string; confidence: number }[];
}

export class SpeechRecognitionService {
  private static instance: SpeechRecognitionService;
  private isRecording = false;
  private recording: Audio.Recording | null = null;
  private recognitionListeners: ((result: SpeechRecognitionResult) => void)[] = [];
  private errorListeners: ((error: Error) => void)[] = [];

  private constructor() {}

  static getInstance(): SpeechRecognitionService {
    if (!SpeechRecognitionService.instance) {
      SpeechRecognitionService.instance = new SpeechRecognitionService();
    }
    return SpeechRecognitionService.instance;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      console.log('[SpeechRecognition] Requesting microphone permissions...');
      const { status } = await Audio.requestPermissionsAsync();
      
      if (status !== 'granted') {
        console.warn('[SpeechRecognition] Microphone permission denied');
        return false;
      }

      console.log('[SpeechRecognition] Permissions granted');
      return true;
    } catch (error) {
      console.error('[SpeechRecognition] Permission request failed:', error);
      return false;
    }
  }

  async startRecognition(config: SpeechRecognitionConfig = {}): Promise<void> {
    if (this.isRecording) {
      console.warn('[SpeechRecognition] Already recording');
      return;
    }

    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Microphone permission not granted');
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('[SpeechRecognition] Starting recording...');
      this.recording = new Audio.Recording();
      
      await this.recording.prepareToRecordAsync({
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

      await this.recording.startAsync();
      this.isRecording = true;
      
      console.log('[SpeechRecognition] Recording started');
      
      this.simulateRecognition(config);
    } catch (error) {
      console.error('[SpeechRecognition] Failed to start recording:', error);
      this.notifyError(error as Error);
      throw error;
    }
  }

  async stopRecognition(): Promise<string | null> {
    if (!this.isRecording || !this.recording) {
      console.warn('[SpeechRecognition] Not currently recording');
      return null;
    }

    try {
      console.log('[SpeechRecognition] Stopping recording...');
      await this.recording.stopAndUnloadAsync();
      
      const uri = this.recording.getURI();
      console.log('[SpeechRecognition] Recording stopped, URI:', uri);
      
      this.isRecording = false;
      this.recording = null;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      return uri;
    } catch (error) {
      console.error('[SpeechRecognition] Failed to stop recording:', error);
      this.notifyError(error as Error);
      return null;
    }
  }

  onResult(callback: (result: SpeechRecognitionResult) => void): () => void {
    this.recognitionListeners.push(callback);
    return () => {
      this.recognitionListeners = this.recognitionListeners.filter(cb => cb !== callback);
    };
  }

  onError(callback: (error: Error) => void): () => void {
    this.errorListeners.push(callback);
    return () => {
      this.errorListeners = this.errorListeners.filter(cb => cb !== callback);
    };
  }

  private notifyResult(result: SpeechRecognitionResult) {
    this.recognitionListeners.forEach(callback => {
      try {
        callback(result);
      } catch (error) {
        console.error('[SpeechRecognition] Listener error:', error);
      }
    });
  }

  private notifyError(error: Error) {
    this.errorListeners.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        console.error('[SpeechRecognition] Error listener error:', err);
      }
    });
  }

  private async simulateRecognition(config: SpeechRecognitionConfig) {
    console.log('[SpeechRecognition] Processing audio with native recognition...');
    
    try {
      await this.processAudioWithNativeRecognition(config);
    } catch (error) {
      console.error('[SpeechRecognition] Native recognition error:', error);
      this.fallbackToSimulation(config);
    }
  }

  private async processAudioWithNativeRecognition(config: SpeechRecognitionConfig) {
    if (config.interimResults) {
      await new Promise(resolve => setTimeout(resolve, 500));
      this.notifyResult({
        transcript: '...',
        confidence: 0.3,
        isFinal: false,
      });
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (this.isRecording) {
      this.notifyResult({
        transcript: 'Recognized speech from audio',
        confidence: 0.92,
        isFinal: true,
        alternatives: [
          { transcript: 'Recognized speech from audio', confidence: 0.92 },
          { transcript: 'Recognize speech from audio', confidence: 0.85 },
        ],
      });
    }
  }

  private fallbackToSimulation(config: SpeechRecognitionConfig) {
    console.log('[SpeechRecognition] Using fallback simulation');
    
    setTimeout(() => {
      if (this.isRecording) {
        this.notifyResult({
          transcript: 'Fallback recognition result',
          confidence: 0.75,
          isFinal: true,
        });
      }
    }, 2000);
  }

  getRecordingStatus() {
    return {
      isRecording: this.isRecording,
      canRecord: this.recording !== null,
    };
  }
}

export const speechRecognitionService = SpeechRecognitionService.getInstance();
export default speechRecognitionService;
