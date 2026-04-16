# MeetMind — AI Meeting Teleprompter

## Concept

A React Native (Expo) mobile app that acts as a real-time meeting teleprompter. The phone sits next to the Mac camera during Zoom/Meet calls. It captures audio via microphone, transcribes in real-time using Whisper API, and when a question is directed at the user, AI generates a smart contextual answer displayed prominently on screen — so the user can read it naturally while looking at the camera.

## Core Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | Real-time Transcription | Mic → Whisper API → text, 3-5 sec chunks |
| 2 | Teleprompter Display | Auto-scroll, large font, dark theme, highly readable |
| 3 | Question Detection | AI detects questions directed at user from context |
| 4 | Smart Answer Generation | Context-aware answers based on full transcript |
| 5 | Meeting Summary | Post-meeting: summary + key points + action items |
| 6 | Multi-AI Provider | Claude / OpenAI / Gemini — configurable in settings |
| 7 | Multi-language | Source/target language configurable |
| 8 | Transcript Export | Save as text, share, or email |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    MeetMind App                       │
│                                                       │
│  ┌─────────┐   ┌──────────┐   ┌──────────────────┐  │
│  │   Mic   │──▶│ Whisper  │──▶│ AI Engine        │  │
│  │ Capture │   │ API      │   │ (Claude/GPT/     │  │
│  │         │   │ (STT)    │   │  Gemini)         │  │
│  └─────────┘   └────┬─────┘   └────┬─────────────┘  │
│                      │              │                 │
│                      ▼              ▼                 │
│              ┌──────────────────────────┐            │
│              │   Transcript Store       │            │
│              │   (SQLite)               │            │
│              └────────────┬─────────────┘            │
│                           │                          │
│              ┌────────────▼─────────────┐            │
│              │   Teleprompter View      │            │
│              │   (auto-scroll, clean)   │            │
│              └──────────────────────────┘            │
│                                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │              Settings                         │    │
│  │  AI Provider | Language | Font | Export       │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

## Data Flow

```
Mic Audio (continuous)
    │
    ▼ (3-5 sec chunks)
Whisper API ($0.006/min)
    │
    ▼ (transcribed text)
Transcript Buffer → SQLite storage → Teleprompter display
    │
    ▼ (every new sentence)
Question Detector (Haiku/GPT-4o-mini — fast, cheap)
    │
    ├─ NO  → continue
    └─ YES → Answer Generator (Sonnet/GPT-4o/Gemini Pro)
              → Show Answer Card (highlighted)
```

## AI Prompt Strategy

### Question Detection (fast model)
```
Given this meeting transcript, is the last statement
a question directed at the user? Reply YES or NO.
```

### Answer Generation (smart model)
```
Meeting context: {full transcript}
Topic: {meeting topic from settings}
User role: {user's role from settings}
Question: {detected question}

Generate a professional, detailed answer.
```

### Meeting Summary (end of meeting)
```
Summarize this meeting:
1. Key decisions made
2. Action items with owners
3. Open questions
4. Important numbers/data mentioned
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native (Expo) |
| Language | TypeScript |
| STT | OpenAI Whisper API |
| AI | Anthropic Claude / OpenAI / Google Gemini |
| Storage | SQLite (expo-sqlite) |
| Audio | expo-av |
| Secure Storage | expo-secure-store |
| Navigation | expo-router |

## Screen Structure

```
App
├── LiveScreen (main teleprompter)
│   ├── TranscriptView (auto-scrolling text)
│   ├── AnswerCard (highlighted suggestion)
│   └── ControlBar (start/stop/status)
│
├── HistoryScreen (past meetings)
│   ├── MeetingList
│   └── MeetingDetail (transcript + summary)
│
└── SettingsScreen
    ├── AI Provider selector
    ├── API Keys (secure storage)
    ├── Source/Target Language
    ├── Font Size
    ├── Meeting Topic / User Role
    └── Auto-answer toggle
```

## Decisions Made

- **React Native (Expo)** over native Swift — cross-platform support
- **Whisper API** over on-device STT — best multi-language accuracy
- **Full Auto mode** — AI detects questions and generates answers automatically
- **Multi-AI provider** — user chooses Claude, OpenAI, or Gemini in settings
- **SQLite** for transcript storage — reliable, queryable, offline-capable
- **Teleprompter-style UI** — optimized for reading while looking at camera
