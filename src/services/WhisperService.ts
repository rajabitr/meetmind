import { WHISPER_API_URL } from '../config/constants';

interface WhisperResponse {
  text: string;
  language?: string;
}

// Known Whisper hallucinations when audio is silent
const HALLUCINATION_PATTERNS = [
  'thanks for watching',
  'thank you for watching',
  'subscribe',
  'like and subscribe',
  'see you next time',
  'bye bye',
  'thank you for listening',
  'please subscribe',
  'see you in the next',
  'take care',
  'goodbye',
  'the end',
  'thanks for listening',
  'subtitles by',
  'amara.org',
  'transcribed by',
  'copyright',
  '♪',
  '🎵',
  'music',
  'applause',
  'laughter',
];

function isHallucination(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (lower.length < 3) return true;

  for (const pattern of HALLUCINATION_PATTERNS) {
    if (lower.includes(pattern)) return true;
  }

  // Repeated phrases (e.g. "Thank you. Thank you. Thank you.")
  const words = lower.split(/\s+/);
  if (words.length > 2) {
    const unique = new Set(words);
    if (unique.size <= 2) return true;
  }

  return false;
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
    const text = (data.text || '').trim();

    // Filter hallucinations from silent audio
    if (isHallucination(text)) {
      return { text: '', language: data.language };
    }

    // Check avg_logprob — low confidence means likely hallucination
    const segments = data.segments || [];
    if (segments.length > 0) {
      const avgLogProb = segments.reduce(
        (sum: number, s: any) => sum + (s.avg_logprob || 0), 0
      ) / segments.length;

      // Very low confidence = likely noise/silence
      if (avgLogProb < -1.0) {
        return { text: '', language: data.language };
      }

      // High no_speech_prob = silence
      const avgNoSpeech = segments.reduce(
        (sum: number, s: any) => sum + (s.no_speech_prob || 0), 0
      ) / segments.length;

      if (avgNoSpeech > 0.5) {
        return { text: '', language: data.language };
      }
    }

    return { text, language: data.language };
  }
}
