import { useState, useRef, useCallback } from 'react';
import { AudioCaptureService } from '../services/AudioCaptureService';
import { WhisperService } from '../services/WhisperService';
import { DeepgramService } from '../services/DeepgramService';
import { AIProviderService } from '../services/AIProviderService';
import * as Store from '../services/TranscriptStore';
import { TranscriptSegment, AnswerSuggestion, AppSettings } from '../types';
import { AI_MODELS, AUDIO_CONFIG } from '../config/constants';

// Simple local check: short phrases that are likely the user responding
const USER_PATTERNS = [
  /^(yes|yeah|sure|okay|ok|right|exactly|correct|absolutely|definitely)/i,
  /^(no|not really|i don't think|i disagree)/i,
  /^(can you|could you|would you|please) (repeat|say that again|clarify)/i,
  /^(sorry|pardon|excuse me|what was that)/i,
  /^(thank you|thanks|great|perfect|sounds good)/i,
  /^(i think|i believe|in my opinion|from my perspective|well)/i,
  /^(let me|so basically|to answer|my approach)/i,
];

function looksLikeUserResponse(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return USER_PATTERNS.some(p => p.test(lower));
}

export function useTranscription(settings: AppSettings, apiKeys: Record<string, string>) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [answerQueue, setAnswerQueue] = useState<AnswerSuggestion[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [meetingId, setMeetingId] = useState<string | null>(null);

  const audioService = useRef(new AudioCaptureService());
  const whisperRef = useRef<WhisperService | null>(null);
  const deepgramRef = useRef<DeepgramService | null>(null);
  const aiRef = useRef<AIProviderService | null>(null);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const meetingIdRef = useRef<string | null>(null);
  const chunkCountRef = useRef(0);
  const processingRef = useRef(false);
  const pendingUrisRef = useRef<string[]>([]);

  const resolveSpeakerName = (speaker: string): string => {
    return settings.speakerNames?.[speaker] || speaker;
  };

  const startSession = useCallback(async () => {
    setError(null);

    const useDeepgram = settings.sttProvider === 'deepgram';

    if (useDeepgram) {
      const dgKey = apiKeys['deepgram'];
      if (!dgKey) { setError('Deepgram API key is required'); return; }
      deepgramRef.current = new DeepgramService(dgKey);
    } else {
      const openaiKey = apiKeys['openai'];
      if (!openaiKey) { setError('OpenAI API key is required for Whisper'); return; }
      whisperRef.current = new WhisperService(openaiKey);
    }

    const providerKey = apiKeys[settings.aiProvider];
    if (!providerKey && settings.autoAnswer) {
      setError(`${settings.aiProvider} API key is required for AI features`);
      return;
    }

    if (providerKey) {
      aiRef.current = new AIProviderService({
        provider: settings.aiProvider,
        apiKey: providerKey,
        fastModel: AI_MODELS[settings.aiProvider].fast,
        smartModel: AI_MODELS[settings.aiProvider].smart,
      });
    }

    const id = `meeting_${Date.now()}`;
    setMeetingId(id);
    meetingIdRef.current = id;
    segmentsRef.current = [];
    chunkCountRef.current = 0;
    processingRef.current = false;
    pendingUrisRef.current = [];
    setSegments([]);
    setAnswerQueue([]);
    setIsLive(true);

    await Store.createMeeting(
      id,
      settings.meetingTopic || 'Meeting',
      Date.now(),
      settings.meetingTopic || undefined
    );

    const hasPermission = await audioService.current.requestPermission();
    if (!hasPermission) { setError('Microphone permission required'); return; }

    await audioService.current.startCapture((uri) => {
      // Queue-based: if already processing, add to pending queue
      pendingUrisRef.current.push(uri);
      if (!processingRef.current) {
        processQueue(id, useDeepgram);
      }
    });
  }, [settings, apiKeys]);

  const processQueue = async (meetingId: string, useDeepgram: boolean) => {
    processingRef.current = true;

    while (pendingUrisRef.current.length > 0) {
      const uri = pendingUrisRef.current.shift()!;
      chunkCountRef.current++;
      const n = chunkCountRef.current;

      try {
        setStatus(`Processing chunk #${n}...`);

        if (useDeepgram && deepgramRef.current) {
          await processWithDeepgram(uri, meetingId);
        } else if (whisperRef.current) {
          await processWithWhisper(uri, meetingId);
        }
      } catch (err: any) {
        setStatus(`Error #${n}: ${err?.message || err}`);
      }
    }

    processingRef.current = false;
  };

  const processWithWhisper = async (uri: string, meetingId: string) => {
    const result = await whisperRef.current!.transcribe(uri, settings.sourceLanguage);
    if (!result.text || result.text.trim().length === 0) return;

    let displayText = result.text;
    if (
      settings.targetLanguage !== 'auto' &&
      result.language &&
      result.language !== settings.targetLanguage &&
      aiRef.current
    ) {
      displayText = await aiRef.current.translateText(result.text, settings.targetLanguage);
    }

    const segment: TranscriptSegment = {
      id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: displayText,
      timestamp: Date.now(),
      language: result.language,
      isQuestion: false,
    };

    await addSegmentAndDetect(segment, meetingId, displayText);
  };

  const processWithDeepgram = async (uri: string, meetingId: string) => {
    const result = await deepgramRef.current!.transcribeWithDiarization(uri, settings.sourceLanguage);
    if (result.segments.length === 0) return;

    for (const dgSeg of result.segments) {
      let displayText = dgSeg.text;
      if (
        settings.targetLanguage !== 'auto' &&
        dgSeg.language &&
        dgSeg.language !== settings.targetLanguage &&
        aiRef.current
      ) {
        displayText = await aiRef.current.translateText(dgSeg.text, settings.targetLanguage);
      }

      const segment: TranscriptSegment = {
        id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: displayText,
        timestamp: Date.now(),
        language: dgSeg.language || result.language,
        isQuestion: false,
        speaker: resolveSpeakerName(dgSeg.speaker),
      };

      await addSegmentAndDetect(segment, meetingId, displayText);
    }
  };

  const addSegmentAndDetect = async (
    segment: TranscriptSegment,
    meetingId: string,
    displayText: string
  ) => {
    // === VOICE FILTER (local-first, then AI) ===
    if (settings.filterOwnVoice && settings.voiceCalibrationText) {
      // Step 1: Quick local pattern check (FREE, instant)
      if (looksLikeUserResponse(displayText)) {
        segment.speaker = 'You';
        segmentsRef.current = [...segmentsRef.current, segment];
        setSegments([...segmentsRef.current]);
        await Store.addSegment(meetingId, segment);
        setStatus('(Your speech — skipped)');
        return;
      }

      // Step 2: AI check only for ambiguous cases, and only every other chunk
      if (aiRef.current && chunkCountRef.current % 2 === 0) {
        try {
          const isMe = await aiRef.current.isUserSpeaking(
            displayText,
            settings.voiceCalibrationText
          );
          if (isMe) {
            segment.speaker = 'You';
            segmentsRef.current = [...segmentsRef.current, segment];
            setSegments([...segmentsRef.current]);
            await Store.addSegment(meetingId, segment);
            setStatus('(Your speech — skipped)');
            return;
          }
        } catch {}
      }
    }

    // === ADD SEGMENT ===
    segmentsRef.current = [...segmentsRef.current, segment];
    setSegments([...segmentsRef.current]);
    await Store.addSegment(meetingId, segment);

    // === QUESTION DETECTION (every Nth chunk to reduce load) ===
    if (settings.autoAnswer && aiRef.current) {
      // Only run detection every DETECTION_INTERVAL chunks
      if (chunkCountRef.current % AUDIO_CONFIG.DETECTION_INTERVAL !== 0) {
        setStatus(`Chunk #${chunkCountRef.current} — transcribed`);
        return;
      }

      const recentText = segmentsRef.current
        .slice(-5)
        .map(s => s.speaker ? `${s.speaker}: ${s.text}` : s.text)
        .join(' ');

      try {
        const isQuestion = await aiRef.current.detectQuestion(recentText, displayText);
        setStatus(isQuestion ? `Question: "${displayText.slice(0, 30)}..."` : '');

        if (isQuestion) {
          segment.isQuestion = true;

          const fullTranscript = await Store.getFullTranscript(meetingId);
          const answerId = `ans_${Date.now()}`;

          setAnswerQueue(prev => [...prev, {
            id: answerId,
            question: displayText,
            answer: '',
            timestamp: Date.now(),
            dismissed: false,
          }]);

          const finalAnswer = await aiRef.current!.generateAnswerStreaming(
            fullTranscript,
            displayText,
            settings.meetingTopic,
            settings.userRole,
            (chunk) => {
              setAnswerQueue(prev =>
                prev.map(a => a.id === answerId ? { ...a, answer: a.answer + chunk } : a)
              );
            }
          );

          setAnswerQueue(prev =>
            prev.map(a => a.id === answerId ? { ...a, answer: finalAnswer || a.answer } : a)
          );
        }
      } catch (err: any) {
        setStatus(`Detection error: ${err?.message || err}`);
      }
    }
  };

  const stopSession = useCallback(async () => {
    setIsLive(false);
    await audioService.current.stopCapture();
    pendingUrisRef.current = [];

    if (meetingIdRef.current && aiRef.current) {
      try {
        const transcript = await Store.getFullTranscript(meetingIdRef.current);
        if (transcript.length > 50) {
          const summary = await aiRef.current.generateSummary(transcript);
          await Store.endMeeting(meetingIdRef.current, summary);
        } else {
          await Store.endMeeting(meetingIdRef.current);
        }
      } catch (err) {
        await Store.endMeeting(meetingIdRef.current!);
      }
    }
  }, []);

  const dismissAnswer = useCallback((answerId?: string) => {
    if (answerId) {
      setAnswerQueue(prev => prev.filter(a => a.id !== answerId));
    } else {
      setAnswerQueue(prev => prev.slice(1));
    }
  }, []);

  const currentAnswer = answerQueue.length > 0 ? answerQueue[0] : null;

  return {
    segments,
    currentAnswer,
    answerCount: answerQueue.length,
    isLive,
    error,
    status,
    meetingId,
    startSession,
    stopSession,
    dismissAnswer,
  };
}
