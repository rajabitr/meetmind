# MeetMind Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a React Native (Expo) mobile app that acts as a real-time AI meeting teleprompter — capturing audio, transcribing via Whisper, detecting questions, and generating smart answers.

**Architecture:** Expo app with expo-router for navigation, expo-av for microphone capture, Whisper API for STT, multi-provider AI engine (Claude/OpenAI/Gemini) for question detection and answer generation, SQLite for transcript persistence, and a teleprompter-style UI optimized for reading while looking at a camera.

**Tech Stack:** React Native, Expo SDK 52, TypeScript, expo-router, expo-av, expo-sqlite, expo-secure-store

---

### Task 1: Project Scaffolding

**Files:**
- Create: `app/` (expo-router structure)
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `app.json`

**Step 1: Initialize Expo project**

```bash
npx create-expo-app@latest meetmind --template tabs
```

**Step 2: Install core dependencies**

```bash
npx expo install expo-av expo-sqlite expo-secure-store expo-router expo-status-bar
npm install react-native-safe-area-context react-native-screens
```

**Step 3: Install AI/HTTP dependencies**

```bash
npm install axios
```

**Step 4: Clean up template boilerplate**

Remove default tab screens and placeholder content. Set up the basic folder structure:

```
app/
├── _layout.tsx          # Root layout with tab navigator
├── (tabs)/
│   ├── _layout.tsx      # Tab layout config
│   ├── index.tsx        # LiveScreen (teleprompter)
│   ├── history.tsx      # HistoryScreen
│   └── settings.tsx     # SettingsScreen
src/
├── services/
│   ├── AudioCaptureService.ts
│   ├── WhisperService.ts
│   ├── AIProviderService.ts
│   └── TranscriptStore.ts
├── components/
│   ├── TranscriptView.tsx
│   ├── AnswerCard.tsx
│   └── ControlBar.tsx
├── hooks/
│   └── useTranscription.ts
├── types/
│   └── index.ts
└── config/
    └── constants.ts
```

**Step 5: Verify project runs**

Run: `npx expo start`
Expected: App launches in simulator

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: initialize Expo project with dependencies"
git push origin main
```

---

### Task 2: Type Definitions & Constants

**Files:**
- Create: `src/types/index.ts`
- Create: `src/config/constants.ts`

**Step 1: Write type definitions**

```typescript
// src/types/index.ts

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
  summary?: MeetingSummary;
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
  fastModel: string;   // for question detection
  smartModel: string;   // for answer generation
}
```

**Step 2: Write constants**

```typescript
// src/config/constants.ts

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
  CHUNK_DURATION_MS: 4000,       // 4 seconds per chunk
  SAMPLE_RATE: 16000,
  CHANNELS: 1,
  ENCODING: 'pcm_16bit' as const,
};

export const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

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
```

**Step 3: Commit**

```bash
git add src/types/index.ts src/config/constants.ts
git commit -m "feat: add type definitions and constants"
git push origin main
```

---

### Task 3: Secure Storage & Settings

**Files:**
- Create: `src/services/SecureStorage.ts`
- Create: `src/hooks/useSettings.ts`
- Create: `app/(tabs)/settings.tsx`

**Step 1: Write SecureStorage service**

```typescript
// src/services/SecureStorage.ts
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  OPENAI_API_KEY: 'openai_api_key',
  CLAUDE_API_KEY: 'claude_api_key',
  GEMINI_API_KEY: 'gemini_api_key',
  SETTINGS: 'app_settings',
} as const;

export async function saveApiKey(provider: string, key: string): Promise<void> {
  const storeKey = `${provider}_api_key`;
  await SecureStore.setItemAsync(storeKey, key);
}

export async function getApiKey(provider: string): Promise<string | null> {
  const storeKey = `${provider}_api_key`;
  return SecureStore.getItemAsync(storeKey);
}

export async function saveSettings(settings: object): Promise<void> {
  await SecureStore.setItemAsync(KEYS.SETTINGS, JSON.stringify(settings));
}

export async function getSettings(): Promise<object | null> {
  const raw = await SecureStore.getItemAsync(KEYS.SETTINGS);
  return raw ? JSON.parse(raw) : null;
}
```

**Step 2: Write useSettings hook**

```typescript
// src/hooks/useSettings.ts
import { useState, useEffect, useCallback } from 'react';
import { AppSettings, AIProvider } from '../types';
import { saveSettings, getSettings, saveApiKey, getApiKey } from '../services/SecureStorage';

const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: 'claude',
  sourceLanguage: 'auto',
  targetLanguage: 'en',
  fontSize: 18,
  meetingTopic: '',
  userRole: '',
  autoAnswer: true,
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const saved = await getSettings();
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...saved } as AppSettings);
      setLoading(false);
    })();
  }, []);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    await saveSettings(updated);
  }, [settings]);

  return { settings, updateSettings, loading };
}
```

**Step 3: Build SettingsScreen UI**

Build `app/(tabs)/settings.tsx` with sections for:
- AI Provider picker (Claude/OpenAI/Gemini)
- API Key input fields (masked)
- Source/Target language pickers
- Font size slider
- Meeting topic and user role text inputs
- Auto-answer toggle

**Step 4: Verify settings persist across app restart**

Run app, change settings, close and reopen, verify values persist.

**Step 5: Commit**

```bash
git add src/services/SecureStorage.ts src/hooks/useSettings.ts app/\(tabs\)/settings.tsx
git commit -m "feat: add settings screen with secure storage"
git push origin main
```

---

### Task 4: Audio Capture Service

**Files:**
- Create: `src/services/AudioCaptureService.ts`

**Step 1: Write AudioCaptureService**

```typescript
// src/services/AudioCaptureService.ts
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { AUDIO_CONFIG } from '../config/constants';

export class AudioCaptureService {
  private recording: Audio.Recording | null = null;
  private isRecording = false;
  private onChunkReady: ((uri: string) => void) | null = null;
  private chunkInterval: ReturnType<typeof setInterval> | null = null;

  async requestPermission(): Promise<boolean> {
    const { granted } = await Audio.requestPermissionsAsync();
    return granted;
  }

  async startCapture(onChunk: (uri: string) => void): Promise<void> {
    this.onChunkReady = onChunk;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    this.isRecording = true;
    this.recordChunk();

    // Every CHUNK_DURATION_MS, stop current recording and start new one
    this.chunkInterval = setInterval(() => {
      if (this.isRecording) this.rotateRecording();
    }, AUDIO_CONFIG.CHUNK_DURATION_MS);
  }

  private async recordChunk(): Promise<void> {
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    this.recording = recording;
  }

  private async rotateRecording(): Promise<void> {
    if (!this.recording) return;

    const prevRecording = this.recording;
    this.recording = null;

    // Start new recording immediately (minimize gap)
    await this.recordChunk();

    // Process previous recording
    await prevRecording.stopAndUnloadAsync();
    const uri = prevRecording.getURI();
    if (uri && this.onChunkReady) {
      this.onChunkReady(uri);
    }
  }

  async stopCapture(): Promise<void> {
    this.isRecording = false;

    if (this.chunkInterval) {
      clearInterval(this.chunkInterval);
      this.chunkInterval = null;
    }

    if (this.recording) {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      if (uri && this.onChunkReady) {
        this.onChunkReady(uri);
      }
      this.recording = null;
    }
  }
}
```

**Step 2: Test microphone permission and recording in simulator**

**Step 3: Commit**

```bash
git add src/services/AudioCaptureService.ts
git commit -m "feat: add audio capture service with chunk rotation"
git push origin main
```

---

### Task 5: Whisper STT Service

**Files:**
- Create: `src/services/WhisperService.ts`

**Step 1: Write WhisperService**

```typescript
// src/services/WhisperService.ts
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
    const formData = new FormData();

    // Read audio file and append
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    if (!fileInfo.exists) throw new Error('Audio file not found');

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
      throw new Error(`Whisper API error: ${error}`);
    }

    const data = await response.json();
    return {
      text: data.text.trim(),
      language: data.language,
    };
  }
}
```

**Step 2: Test with a recorded audio chunk**

**Step 3: Commit**

```bash
git add src/services/WhisperService.ts
git commit -m "feat: add Whisper STT service"
git push origin main
```

---

### Task 6: AI Provider Service (Multi-provider)

**Files:**
- Create: `src/services/AIProviderService.ts`

**Step 1: Write AIProviderService with multi-provider support**

```typescript
// src/services/AIProviderService.ts
import { AIProvider, AIProviderConfig, TranscriptSegment } from '../types';
import { AI_MODELS } from '../config/constants';

interface AIResponse {
  content: string;
}

export class AIProviderService {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async detectQuestion(
    recentTranscript: string,
    lastSegment: string
  ): Promise<boolean> {
    const prompt = `You are analyzing a meeting transcript. Is the following statement a question directed at someone in the meeting? Answer ONLY "YES" or "NO".

Recent context:
${recentTranscript}

Last statement:
${lastSegment}`;

    const response = await this.callAI(prompt, 'fast');
    return response.content.trim().toUpperCase().includes('YES');
  }

  async generateAnswer(
    fullTranscript: string,
    question: string,
    topic: string,
    userRole: string
  ): Promise<string> {
    const prompt = `You are helping someone in a meeting. Based on the meeting transcript, generate a professional, detailed answer to the question being asked.

Meeting topic: ${topic || 'General meeting'}
Your role: ${userRole || 'Team member'}

Full transcript so far:
${fullTranscript}

Question asked: ${question}

Generate a clear, professional answer with specific details when possible. Keep it concise but thorough (2-4 sentences). Do NOT prefix with "Answer:" or similar.`;

    const response = await this.callAI(prompt, 'smart');
    return response.content;
  }

  async generateSummary(fullTranscript: string): Promise<string> {
    const prompt = `Summarize this meeting transcript. Include:

1. **Overview** - 2-3 sentence summary
2. **Key Points** - Bullet list of important items discussed
3. **Action Items** - Tasks assigned with owners if mentioned
4. **Open Questions** - Unresolved questions

Transcript:
${fullTranscript}`;

    const response = await this.callAI(prompt, 'smart');
    return response.content;
  }

  async translateText(text: string, targetLang: string): Promise<string> {
    if (targetLang === 'en') {
      const prompt = `Translate the following text to English. Return ONLY the translation, nothing else.\n\n${text}`;
      const response = await this.callAI(prompt, 'fast');
      return response.content;
    }
    return text;
  }

  private async callAI(
    prompt: string,
    tier: 'fast' | 'smart'
  ): Promise<AIResponse> {
    const model = AI_MODELS[this.config.provider][tier];

    switch (this.config.provider) {
      case 'claude':
        return this.callClaude(prompt, model);
      case 'openai':
        return this.callOpenAI(prompt, model);
      case 'gemini':
        return this.callGemini(prompt, model);
    }
  }

  private async callClaude(prompt: string, model: string): Promise<AIResponse> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    return { content: data.content[0].text };
  }

  private async callOpenAI(prompt: string, model: string): Promise<AIResponse> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 512,
      }),
    });
    const data = await res.json();
    return { content: data.choices[0].message.content };
  }

  private async callGemini(prompt: string, model: string): Promise<AIResponse> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );
    const data = await res.json();
    return { content: data.candidates[0].content.parts[0].text };
  }
}
```

**Step 2: Test each provider with a simple prompt**

**Step 3: Commit**

```bash
git add src/services/AIProviderService.ts
git commit -m "feat: add multi-provider AI service (Claude/OpenAI/Gemini)"
git push origin main
```

---

### Task 7: Transcript Store (SQLite)

**Files:**
- Create: `src/services/TranscriptStore.ts`

**Step 1: Write TranscriptStore**

```typescript
// src/services/TranscriptStore.ts
import * as SQLite from 'expo-sqlite';
import { Meeting, TranscriptSegment, MeetingSummary } from '../types';

let db: SQLite.SQLiteDatabase;

export async function initDB(): Promise<void> {
  db = await SQLite.openDatabaseAsync('meetmind.db');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      startTime INTEGER NOT NULL,
      endTime INTEGER,
      topic TEXT,
      summary TEXT
    );

    CREATE TABLE IF NOT EXISTS segments (
      id TEXT PRIMARY KEY,
      meetingId TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      language TEXT,
      isQuestion INTEGER DEFAULT 0,
      FOREIGN KEY (meetingId) REFERENCES meetings(id)
    );

    CREATE TABLE IF NOT EXISTS answers (
      id TEXT PRIMARY KEY,
      meetingId TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (meetingId) REFERENCES meetings(id)
    );
  `);
}

export async function createMeeting(meeting: Omit<Meeting, 'segments'>): Promise<void> {
  await db.runAsync(
    'INSERT INTO meetings (id, title, startTime, topic) VALUES (?, ?, ?, ?)',
    meeting.id, meeting.title, meeting.startTime, meeting.topic ?? null
  );
}

export async function addSegment(meetingId: string, segment: TranscriptSegment): Promise<void> {
  await db.runAsync(
    'INSERT INTO segments (id, meetingId, text, timestamp, language, isQuestion) VALUES (?, ?, ?, ?, ?, ?)',
    segment.id, meetingId, segment.text, segment.timestamp, segment.language ?? null, segment.isQuestion ? 1 : 0
  );
}

export async function endMeeting(meetingId: string, summary?: string): Promise<void> {
  await db.runAsync(
    'UPDATE meetings SET endTime = ?, summary = ? WHERE id = ?',
    Date.now(), summary ?? null, meetingId
  );
}

export async function getMeetings(): Promise<Meeting[]> {
  const rows = await db.getAllAsync('SELECT * FROM meetings ORDER BY startTime DESC');
  return rows as Meeting[];
}

export async function getMeetingWithSegments(meetingId: string): Promise<Meeting | null> {
  const meeting = await db.getFirstAsync('SELECT * FROM meetings WHERE id = ?', meetingId);
  if (!meeting) return null;

  const segments = await db.getAllAsync(
    'SELECT * FROM segments WHERE meetingId = ? ORDER BY timestamp ASC',
    meetingId
  );

  return { ...(meeting as Meeting), segments: segments as TranscriptSegment[] };
}

export async function getFullTranscript(meetingId: string): Promise<string> {
  const segments = await db.getAllAsync(
    'SELECT text FROM segments WHERE meetingId = ? ORDER BY timestamp ASC',
    meetingId
  );
  return (segments as { text: string }[]).map(s => s.text).join(' ');
}
```

**Step 2: Test DB operations**

**Step 3: Commit**

```bash
git add src/services/TranscriptStore.ts
git commit -m "feat: add SQLite transcript store"
git push origin main
```

---

### Task 8: Main Transcription Hook

**Files:**
- Create: `src/hooks/useTranscription.ts`

**Step 1: Write useTranscription hook**

This is the core orchestration hook that ties together:
- AudioCaptureService (mic → audio chunks)
- WhisperService (audio → text)
- AIProviderService (question detection + answer generation)
- TranscriptStore (persistence)

```typescript
// src/hooks/useTranscription.ts
import { useState, useRef, useCallback } from 'react';
import { AudioCaptureService } from '../services/AudioCaptureService';
import { WhisperService } from '../services/WhisperService';
import { AIProviderService } from '../services/AIProviderService';
import * as Store from '../services/TranscriptStore';
import { TranscriptSegment, AnswerSuggestion, AppSettings } from '../types';
import { AI_MODELS } from '../config/constants';

export function useTranscription(settings: AppSettings, apiKeys: Record<string, string>) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState<AnswerSuggestion | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [meetingId, setMeetingId] = useState<string | null>(null);

  const audioService = useRef(new AudioCaptureService());
  const whisperRef = useRef<WhisperService | null>(null);
  const aiRef = useRef<AIProviderService | null>(null);

  const startSession = useCallback(async () => {
    const openaiKey = apiKeys['openai'];
    if (!openaiKey) throw new Error('OpenAI API key required for Whisper');

    const providerKey = apiKeys[settings.aiProvider];
    if (!providerKey) throw new Error(`${settings.aiProvider} API key required`);

    whisperRef.current = new WhisperService(openaiKey);
    aiRef.current = new AIProviderService({
      provider: settings.aiProvider,
      apiKey: providerKey,
      fastModel: AI_MODELS[settings.aiProvider].fast,
      smartModel: AI_MODELS[settings.aiProvider].smart,
    });

    const id = `meeting_${Date.now()}`;
    setMeetingId(id);
    await Store.createMeeting({
      id,
      title: settings.meetingTopic || 'Meeting',
      startTime: Date.now(),
      topic: settings.meetingTopic,
    });

    const hasPermission = await audioService.current.requestPermission();
    if (!hasPermission) throw new Error('Microphone permission denied');

    setIsLive(true);

    await audioService.current.startCapture(async (uri) => {
      try {
        // 1. Transcribe
        const result = await whisperRef.current!.transcribe(
          uri,
          settings.sourceLanguage
        );

        if (!result.text || result.text.trim().length === 0) return;

        // 2. Translate if needed
        let displayText = result.text;
        if (settings.targetLanguage !== 'auto' &&
            result.language !== settings.targetLanguage) {
          displayText = await aiRef.current!.translateText(
            result.text,
            settings.targetLanguage
          );
        }

        // 3. Create segment
        const segment: TranscriptSegment = {
          id: `seg_${Date.now()}`,
          text: displayText,
          timestamp: Date.now(),
          language: result.language,
          isQuestion: false,
        };

        setSegments(prev => [...prev, segment]);
        await Store.addSegment(id, segment);

        // 4. Detect question (if auto-answer enabled)
        if (settings.autoAnswer && aiRef.current) {
          const recentText = segments.slice(-5).map(s => s.text).join(' ');
          const isQuestion = await aiRef.current.detectQuestion(
            recentText,
            displayText
          );

          if (isQuestion) {
            segment.isQuestion = true;
            const answer = await aiRef.current.generateAnswer(
              await Store.getFullTranscript(id),
              displayText,
              settings.meetingTopic,
              settings.userRole
            );

            setCurrentAnswer({
              id: `ans_${Date.now()}`,
              question: displayText,
              answer,
              timestamp: Date.now(),
              dismissed: false,
            });
          }
        }
      } catch (err) {
        console.error('Transcription error:', err);
      }
    });
  }, [settings, apiKeys]);

  const stopSession = useCallback(async () => {
    setIsLive(false);
    await audioService.current.stopCapture();

    if (meetingId && aiRef.current) {
      const transcript = await Store.getFullTranscript(meetingId);
      if (transcript.length > 50) {
        const summary = await aiRef.current.generateSummary(transcript);
        await Store.endMeeting(meetingId, summary);
      } else {
        await Store.endMeeting(meetingId);
      }
    }
  }, [meetingId]);

  const dismissAnswer = useCallback(() => {
    setCurrentAnswer(null);
  }, []);

  return {
    segments,
    currentAnswer,
    isLive,
    startSession,
    stopSession,
    dismissAnswer,
  };
}
```

**Step 2: Commit**

```bash
git add src/hooks/useTranscription.ts
git commit -m "feat: add core transcription orchestration hook"
git push origin main
```

---

### Task 9: Teleprompter UI - Components

**Files:**
- Create: `src/components/TranscriptView.tsx`
- Create: `src/components/AnswerCard.tsx`
- Create: `src/components/ControlBar.tsx`

**Step 1: Build TranscriptView**

Auto-scrolling teleprompter view. Key requirements:
- Dark background, light text, large font
- Auto-scrolls to bottom as new text arrives
- Smooth scroll animation
- Question segments highlighted differently

```typescript
// src/components/TranscriptView.tsx
// FlatList with inverted={false}, auto-scroll on content change
// Each segment: white text on dark bg
// Question segments: yellow/amber highlight
```

**Step 2: Build AnswerCard**

Highlighted card that appears when AI generates an answer:
- Bright accent border (green/blue)
- Shows the detected question (smaller, italic)
- Shows the suggested answer (larger, bold)
- Dismiss button and Save button
- Fade-in animation

```typescript
// src/components/AnswerCard.tsx
// Animated.View with fadeIn
// Question text (muted) + Answer text (prominent)
// Action buttons: [Dismiss] [Save]
```

**Step 3: Build ControlBar**

Simple control bar at bottom:
- Big Start/Stop button
- Live indicator (pulsing red dot)
- Meeting duration timer

```typescript
// src/components/ControlBar.tsx
// Start/Stop toggle button
// Live indicator with animation
// Duration counter
```

**Step 4: Commit**

```bash
git add src/components/
git commit -m "feat: add teleprompter UI components"
git push origin main
```

---

### Task 10: LiveScreen (Main Screen)

**Files:**
- Create: `app/(tabs)/index.tsx`

**Step 1: Build LiveScreen**

Compose all components into the main teleprompter screen:

```typescript
// app/(tabs)/index.tsx
// Uses useTranscription hook
// Uses useSettings hook
// Layout:
//   - StatusBar (hidden for immersive mode)
//   - TranscriptView (fills screen)
//   - AnswerCard (overlay, appears when answer ready)
//   - ControlBar (bottom, semi-transparent)
```

Key behaviors:
- Keep screen awake during session (`expo-keep-awake`)
- Dark theme always (teleprompter mode)
- AnswerCard overlays on top of transcript
- Tap transcript to toggle ControlBar visibility

**Step 2: Test full flow: start → speak → see transcript → stop**

**Step 3: Commit**

```bash
git add app/\(tabs\)/index.tsx
git commit -m "feat: add live teleprompter screen"
git push origin main
```

---

### Task 11: History Screen

**Files:**
- Create: `app/(tabs)/history.tsx`
- Create: `app/meeting/[id].tsx`

**Step 1: Build HistoryScreen**

List of past meetings with:
- Meeting title
- Date/time
- Duration
- Tap to view detail

**Step 2: Build MeetingDetail screen**

Shows:
- Full transcript (scrollable)
- AI-generated summary (if available)
- "Generate Summary" button (if no summary yet)
- Share/Export button

**Step 3: Commit**

```bash
git add app/\(tabs\)/history.tsx app/meeting/
git commit -m "feat: add meeting history and detail screens"
git push origin main
```

---

### Task 12: App Layout & Navigation

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/(tabs)/_layout.tsx`

**Step 1: Configure root layout**

Initialize SQLite database on app start. Set up dark theme.

**Step 2: Configure tab layout**

Three tabs:
- Live (mic icon) — main teleprompter
- History (clock icon) — past meetings
- Settings (gear icon) — configuration

**Step 3: Test navigation between all screens**

**Step 4: Commit**

```bash
git add app/_layout.tsx app/\(tabs\)/_layout.tsx
git commit -m "feat: configure app navigation and layout"
git push origin main
```

---

### Task 13: Polish & Edge Cases

**Files:**
- Various existing files

**Step 1: Add error handling**

- No API key set → show setup prompt
- Mic permission denied → show instruction
- Network failure → show retry option
- Empty transcription → skip silently

**Step 2: Add keep-awake during live session**

```bash
npx expo install expo-keep-awake
```

**Step 3: Add haptic feedback on answer detection**

```bash
npx expo install expo-haptics
```

**Step 4: Test full end-to-end flow**

1. Set API keys in settings
2. Start live session
3. Speak into microphone
4. Verify transcription appears
5. Ask a question → verify answer appears
6. Stop session → verify summary generated
7. Check history → verify meeting saved

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add error handling, keep-awake, and haptics"
git push origin main
```
