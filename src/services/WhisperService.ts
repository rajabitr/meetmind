import * as FileSystem from 'expo-file-system';
import { WHISPER_API_URL } from '../config/constants';

interface WhisperResponse {
  text: string;
  language?: string;
}

export class WhisperService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribe(
    audioUri: string,
    language?: string
  ): Promise<WhisperResponse> {
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    if (!fileInfo.exists) throw new Error('Audio file not found');

    const formData = new FormData();

    formData.append('file', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'audio.m4a',
    } as any);

    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');

    if (language && language !== 'auto') {
      formData.append('language', language);
    }

    const response = await fetch(WHISPER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Whisper API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    return {
      text: (data.text || '').trim(),
      language: data.language,
    };
  }
}
