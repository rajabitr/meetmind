export type AIProvider = 'claude' | 'openai' | 'gemini';

export type STTProvider = 'whisper' | 'deepgram';

export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: number;
  language?: string;
  isQuestion: boolean;
  speaker?: string;
}

export interface Meeting {
  id: string;
  title: string;
  startTime: number;
  endTime?: number;
  segments: TranscriptSegment[];
  summary?: string;
  topic?: string;
}

export interface MeetingSummary {
  overview: string;
  keyPoints: string[];
  actionItems: string[];
  openQuestions: string[];
}

export interface AnswerSuggestion {
  id: string;
  question: string;
  answer: string;
  timestamp: number;
  dismissed: boolean;
}

export interface AppSettings {
  aiProvider: AIProvider;
  sttProvider: STTProvider;
  sourceLanguage: string;
  targetLanguage: string;
  fontSize: number;
  meetingTopic: string;
  userRole: string;
  autoAnswer: boolean;
  speakerNames: Record<string, string>;
  voiceCalibrationText: string; // sample of user's speech pattern
  filterOwnVoice: boolean;
}

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  fastModel: string;
  smartModel: string;
}
