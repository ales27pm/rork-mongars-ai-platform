import React, { useState } from 'react';
import { View, Text, Button, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system';

export type ModelPlatform = 'android' | 'ios';

const MODEL_URLS = {
  android: 'https://your-server.com/model.gguf', // Replace with your actual URL
  ios: {
    model: 'https://your-server.com/model.mlpackage',
    tokenizer: 'https://your-server.com/tokenizer.json',
  },
};

const getModelDir = (platform: ModelPlatform) => {
  // Use cacheDirectory as a valid directory for both platforms
  return FileSystem.cacheDirectory + 'models/';
};

export const downloadAndroidModel = async () => {
  const dir = getModelDir('android');
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const modelPath = dir + 'model.gguf';
  await FileSystem.downloadAsync(MODEL_URLS.android, modelPath);
  return modelPath;
};

export const downloadIOSModel = async () => {
  const dir = getModelDir('ios');
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const modelPath = dir + 'model.mlpackage';
  const tokenizerPath = dir + 'tokenizer.json';
  await FileSystem.downloadAsync(MODEL_URLS.ios.model, modelPath);
  await FileSystem.downloadAsync(MODEL_URLS.ios.tokenizer, tokenizerPath);
  return { modelPath, tokenizerPath };
};

export default function ModelDownloader({ platform }: { platform: ModelPlatform }) {
  const [downloading, setDownloading] = useState(false);
  const [status, setStatus] = useState<string>('');

  const handleDownload = async () => {
    setDownloading(true);
    setStatus('');
    try {
      if (platform === 'android') {
        const path = await downloadAndroidModel();
        setStatus('Android model downloaded: ' + path);
      } else {
        const { modelPath, tokenizerPath } = await downloadIOSModel();
        setStatus(`iOS model downloaded: ${modelPath}\nTokenizer: ${tokenizerPath}`);
      }
    } catch (e: any) {
      setStatus('Download failed: ' + e.message);
    }
    setDownloading(false);
  };

  return (
    <View style={{ padding: 16 }}>
      <Button title={`Download ${platform} Model`} onPress={handleDownload} disabled={downloading} />
      {downloading && <ActivityIndicator style={{ marginTop: 8 }} />}
      {status ? <Text style={{ marginTop: 8 }}>{status}</Text> : null}
    </View>
  );
}
