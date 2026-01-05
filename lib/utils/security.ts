import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface EncryptionConfig {
  algorithm: 'AES-GCM' | 'AES-CBC';
  keySize: 128 | 192 | 256;
  iterations: number;
}

export class SecurityManager {
  private static instance: SecurityManager;
  private readonly KEY_STORAGE_PREFIX = 'secure_key_';
  
  private constructor() {}
  
  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  async generateKey(identifier: string): Promise<string> {
    try {
      const key = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${identifier}_${Date.now()}_${Math.random()}`
      );

      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await SecureStore.setItemAsync(
          `${this.KEY_STORAGE_PREFIX}${identifier}`,
          key,
          {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          }
        );
      }

      console.log(`[Security] Generated and stored key for: ${identifier}`);
      return key;
    } catch (error) {
      console.error('[Security] Failed to generate key:', error);
      throw new Error('Key generation failed');
    }
  }

  async getKey(identifier: string): Promise<string | null> {
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        const key = await SecureStore.getItemAsync(
          `${this.KEY_STORAGE_PREFIX}${identifier}`
        );
        return key;
      }
      return null;
    } catch (error) {
      console.error('[Security] Failed to retrieve key:', error);
      return null;
    }
  }

  async deleteKey(identifier: string): Promise<void> {
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await SecureStore.deleteItemAsync(
          `${this.KEY_STORAGE_PREFIX}${identifier}`
        );
      }
      console.log(`[Security] Deleted key: ${identifier}`);
    } catch (error) {
      console.error('[Security] Failed to delete key:', error);
    }
  }

  async hashData(data: string): Promise<string> {
    try {
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        data
      );
    } catch (error) {
      console.error('[Security] Failed to hash data:', error);
      throw new Error('Hashing failed');
    }
  }

  async verifyHash(data: string, expectedHash: string): Promise<boolean> {
    try {
      const actualHash = await this.hashData(data);
      return actualHash === expectedHash;
    } catch (error) {
      console.error('[Security] Failed to verify hash:', error);
      return false;
    }
  }

  generateRandomBytes(length: number): Uint8Array {
    return Crypto.getRandomBytes(length);
  }

  async secureCompare(a: string, b: string): Promise<boolean> {
    if (a.length !== b.length) return false;
    
    const hashA = await this.hashData(a);
    const hashB = await this.hashData(b);
    
    return hashA === hashB;
  }

  sanitizeInput(input: string): string {
    return input
      .replace(/[<>"']/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim();
  }

  async validateModelIntegrity(modelData: any, expectedHash: string): Promise<boolean> {
    try {
      const dataString = JSON.stringify(modelData);
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        dataString
      );
      return hash === expectedHash;
    } catch (error) {
      console.error('[Security] Model integrity check failed:', error);
      return false;
    }
  }
}

export const securityManager = SecurityManager.getInstance();
export default securityManager;
