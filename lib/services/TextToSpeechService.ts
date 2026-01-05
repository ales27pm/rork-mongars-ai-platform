import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

export interface TTSConfig {
  language?: string;
  pitch?: number;
  rate?: number;
  voice?: string;
  volume?: number;
}

export interface TTSVoice {
  identifier: string;
  name: string;
  quality: string;
  language: string;
}

export class TextToSpeechService {
  private static instance: TextToSpeechService;
  private isSpeaking = false;
  private currentUtterance: string | null = null;
  private availableVoices: TTSVoice[] = [];

  private constructor() {
    this.initializeVoices();
  }

  static getInstance(): TextToSpeechService {
    if (!TextToSpeechService.instance) {
      TextToSpeechService.instance = new TextToSpeechService();
    }
    return TextToSpeechService.instance;
  }

  private async initializeVoices() {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      this.availableVoices = voices.map(voice => ({
        identifier: voice.identifier,
        name: voice.name,
        quality: voice.quality,
        language: voice.language,
      }));
      console.log(`[TTS] Loaded ${this.availableVoices.length} voices`);
    } catch (error) {
      console.error('[TTS] Failed to load voices:', error);
    }
  }

  async speak(text: string, config: TTSConfig = {}): Promise<void> {
    if (this.isSpeaking) {
      console.warn('[TTS] Already speaking, stopping current speech');
      await this.stop();
    }

    const options: Speech.SpeechOptions = {
      language: config.language || 'en-US',
      pitch: config.pitch ?? 1.0,
      rate: config.rate ?? 1.0,
      voice: config.voice,
      volume: config.volume ?? 1.0,
      onStart: () => {
        this.isSpeaking = true;
        this.currentUtterance = text;
        console.log('[TTS] Started speaking:', text.substring(0, 50));
      },
      onDone: () => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        console.log('[TTS] Finished speaking');
      },
      onStopped: () => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        console.log('[TTS] Speech stopped');
      },
      onError: (error) => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        console.error('[TTS] Speech error:', error);
      },
    };

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      await Speech.speak(text, options);
    } catch (error) {
      console.error('[TTS] Failed to speak:', error);
      this.isSpeaking = false;
      this.currentUtterance = null;
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await Speech.stop();
      this.isSpeaking = false;
      this.currentUtterance = null;
      console.log('[TTS] Speech stopped');
    } catch (error) {
      console.error('[TTS] Failed to stop speech:', error);
      throw error;
    }
  }

  async pause(): Promise<void> {
    try {
      await Speech.pause();
      console.log('[TTS] Speech paused');
    } catch (error) {
      console.error('[TTS] Failed to pause speech:', error);
      throw error;
    }
  }

  async resume(): Promise<void> {
    try {
      await Speech.resume();
      console.log('[TTS] Speech resumed');
    } catch (error) {
      console.error('[TTS] Failed to resume speech:', error);
      throw error;
    }
  }

  getAvailableVoices(): TTSVoice[] {
    return [...this.availableVoices];
  }

  getVoicesByLanguage(languageCode: string): TTSVoice[] {
    return this.availableVoices.filter(voice =>
      voice.language.startsWith(languageCode)
    );
  }

  async isSpeechAvailable(): Promise<boolean> {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      return voices.length > 0;
    } catch (error) {
      console.error('[TTS] Failed to check speech availability:', error);
      return false;
    }
  }

  getSpeakingStatus() {
    return {
      isSpeaking: this.isSpeaking,
      currentUtterance: this.currentUtterance,
      voiceCount: this.availableVoices.length,
    };
  }

  async speakWithQueue(texts: string[], config: TTSConfig = {}): Promise<void> {
    for (const text of texts) {
      await this.speak(text, config);
      
      while (this.isSpeaking) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

export const textToSpeechService = TextToSpeechService.getInstance();
export default textToSpeechService;
