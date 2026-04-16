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

    // Use FormData approach (compatible with Expo Go)
    const formData = new FormData();
    formData.append('file', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'audio.m4a',
    } as any);

    const response = await fetch(`${DEEPGRAM_API_URL}?${params}`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${this.apiKey}`,
      },
      body: formData,
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

    const detectedLang = channel?.detected_language;

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
        segments.push({
          text: currentWords.join(' '),
          speaker: `Speaker ${currentSpeaker + 1}`,
        });
        currentSpeaker = word.speaker;
        currentWords = [];
      }
      currentWords.push(word.word);
    }

    if (currentWords.length > 0) {
      segments.push({
        text: currentWords.join(' '),
        speaker: `Speaker ${currentSpeaker + 1}`,
      });
    }

    return segments;
  }
}
