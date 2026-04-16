import * as FileSystem from 'expo-file-system';
import { DEEPGRAM_API_URL } from '../config/constants';

interface DiarizedWord {
  word: string;
  speaker: number;
  start: number;
  end: number;
}

interface DeepgramSegment {
  text: string;
  speaker: string;
  language?: string;
}

interface DeepgramResponse {
  segments: DeepgramSegment[];
  fullText: string;
  language?: string;
}

export class DeepgramService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribeWithDiarization(
    audioUri: string,
    language?: string
  ): Promise<DeepgramResponse> {
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    if (!fileInfo.exists) throw new Error('Audio file not found');

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Build query params
    const params = new URLSearchParams({
      model: 'nova-3',
      diarize: 'true',
      punctuate: 'true',
      smart_format: 'true',
    });

    if (language && language !== 'auto') {
      params.set('language', language);
    } else {
      params.set('detect_language', 'true');
    }

    const response = await fetch(`${DEEPGRAM_API_URL}?${params}`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${this.apiKey}`,
        'Content-Type': 'audio/m4a',
      },
      body: bytes.buffer,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Deepgram API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    const channel = data.results?.channels?.[0];
    const alternative = channel?.alternatives?.[0];

    if (!alternative) {
      return { segments: [], fullText: '', language: undefined };
    }

    const detectedLang = channel?.detected_language || data.results?.channels?.[0]?.detected_language;

    // Group words by speaker
    const words: DiarizedWord[] = (alternative.words || []).map((w: any) => ({
      word: w.punctuated_word || w.word,
      speaker: w.speaker ?? 0,
      start: w.start,
      end: w.end,
    }));

    const segments = this.groupBySpeaker(words);

    return {
      segments: segments.map(seg => ({
        ...seg,
        language: detectedLang,
      })),
      fullText: alternative.transcript || '',
      language: detectedLang,
    };
  }

  private groupBySpeaker(words: DiarizedWord[]): DeepgramSegment[] {
    if (words.length === 0) return [];

    const segments: DeepgramSegment[] = [];
    let currentSpeaker = words[0].speaker;
    let currentWords: string[] = [];

    for (const word of words) {
      if (word.speaker !== currentSpeaker) {
        // Speaker changed — flush current segment
        segments.push({
          text: currentWords.join(' '),
          speaker: `Speaker ${currentSpeaker + 1}`,
        });
        currentSpeaker = word.speaker;
        currentWords = [];
      }
      currentWords.push(word.word);
    }

    // Flush last segment
    if (currentWords.length > 0) {
      segments.push({
        text: currentWords.join(' '),
        speaker: `Speaker ${currentSpeaker + 1}`,
      });
    }

    return segments;
  }
}
