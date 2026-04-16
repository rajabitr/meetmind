export const AI_MODELS = {
  claude: {
    fast: 'claude-haiku-4-5-20251001',
    smart: 'claude-sonnet-4-6',
  },
  openai: {
    fast: 'gpt-4o-mini',
    smart: 'gpt-4o',
  },
  gemini: {
    fast: 'gemini-2.0-flash',
    smart: 'gemini-2.5-pro',
  },
} as const;

export const AUDIO_CONFIG = {
  CHUNK_DURATION_MS: 2500,
  SAMPLE_RATE: 16000,
  CHANNELS: 1,
} as const;

export const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

export const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen';

export const SPEAKER_COLORS = [
  '#4FC3F7', // blue
  '#81C784', // green
  '#FFB74D', // orange
  '#BA68C8', // purple
  '#F06292', // pink
  '#4DD0E1', // cyan
  '#AED581', // lime
  '#FFD54F', // amber
] as const;

export const LANGUAGES = [
  { code: 'auto', label: 'Auto Detect' },
  { code: 'en', label: 'English' },
  { code: 'fa', label: 'Persian (Farsi)' },
  { code: 'ar', label: 'Arabic' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'tr', label: 'Turkish' },
] as const;

export const DEFAULT_SETTINGS = {
  aiProvider: 'claude' as const,
  sttProvider: 'whisper' as const,
  sourceLanguage: 'auto',
  targetLanguage: 'en',
  fontSize: 18,
  meetingTopic: '',
  userRole: '',
  autoAnswer: true,
  speakerNames: {} as Record<string, string>,
};
