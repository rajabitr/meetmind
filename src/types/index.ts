export type AIProvider = 'claude' | 'openai' | 'gemini';

export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: number;
  language?: string;
  isQuestion: boolean;
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
  sourceLanguage: string;
  targetLanguage: string;
  fontSize: number;
  meetingTopic: string;
  userRole: string;
  autoAnswer: boolean;
}

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  fastModel: string;
  smartModel: string;
}
