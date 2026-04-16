import { useState, useRef, useCallback } from 'react';
import { AudioCaptureService } from '../services/AudioCaptureService';
import { WhisperService } from '../services/WhisperService';
import { DeepgramService } from '../services/DeepgramService';
import { AIProviderService } from '../services/AIProviderService';
import * as Store from '../services/TranscriptStore';
import { TranscriptSegment, AnswerSuggestion, AppSettings } from '../types';
import { AI_MODELS } from '../config/constants';

export function useTranscription(settings: AppSettings, apiKeys: Record<string, string>) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState<AnswerSuggestion | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meetingId, setMeetingId] = useState<string | null>(null);

  const audioService = useRef(new AudioCaptureService());
  const whisperRef = useRef<WhisperService | null>(null);
  const deepgramRef = useRef<DeepgramService | null>(null);
  const aiRef = useRef<AIProviderService | null>(null);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const meetingIdRef = useRef<string | null>(null);

  const resolveSpeakerName = (speaker: string): string => {
    return settings.speakerNames?.[speaker] || speaker;
  };

  const startSession = useCallback(async () => {
    setError(null);

    const useDeepgram = settings.sttProvider === 'deepgram';

    // Validate API keys
    if (useDeepgram) {
      const dgKey = apiKeys['deepgram'];
      if (!dgKey) {
        setError('Deepgram API key is required for speaker diarization');
        return;
      }
      deepgramRef.current = new DeepgramService(dgKey);
    } else {
      const openaiKey = apiKeys['openai'];
      if (!openaiKey) {
        setError('OpenAI API key is required for Whisper transcription');
        return;
      }
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
    setSegments([]);

    await Store.createMeeting(
      id,
      settings.meetingTopic || 'Meeting',
      Date.now(),
      settings.meetingTopic || undefined
    );

    const hasPermission = await audioService.current.requestPermission();
    if (!hasPermission) {
      setError('Microphone permission is required');
      return;
    }

    setIsLive(true);

    await audioService.current.startCapture(async (uri) => {
      try {
        if (useDeepgram && deepgramRef.current) {
          await processWithDeepgram(uri, id);
        } else if (whisperRef.current) {
          await processWithWhisper(uri, id);
        }
      } catch (err) {
        console.error('Transcription pipeline error:', err);
      }
    });
  }, [settings, apiKeys]);

  const processWithWhisper = async (uri: string, meetingId: string) => {
    const result = await whisperRef.current!.transcribe(
      uri,
      settings.sourceLanguage
    );

    if (!result.text || result.text.trim().length === 0) return;

    let displayText = result.text;
    if (
      settings.targetLanguage !== 'auto' &&
      result.language &&
      result.language !== settings.targetLanguage &&
      aiRef.current
    ) {
      displayText = await aiRef.current.translateText(
        result.text,
        settings.targetLanguage
      );
    }

    const segment: TranscriptSegment = {
      id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: displayText,
      timestamp: Date.now(),
      language: result.language,
      isQuestion: false,
    };

    addSegmentAndDetect(segment, meetingId, displayText);
  };

  const processWithDeepgram = async (uri: string, meetingId: string) => {
    const result = await deepgramRef.current!.transcribeWithDiarization(
      uri,
      settings.sourceLanguage
    );

    if (result.segments.length === 0) return;

    for (const dgSeg of result.segments) {
      let displayText = dgSeg.text;

      // Translate if needed
      if (
        settings.targetLanguage !== 'auto' &&
        dgSeg.language &&
        dgSeg.language !== settings.targetLanguage &&
        aiRef.current
      ) {
        displayText = await aiRef.current.translateText(
          dgSeg.text,
          settings.targetLanguage
        );
      }

      const segment: TranscriptSegment = {
        id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: displayText,
        timestamp: Date.now(),
        language: dgSeg.language || result.language,
        isQuestion: false,
        speaker: resolveSpeakerName(dgSeg.speaker),
      };

      addSegmentAndDetect(segment, meetingId, displayText);
    }
  };

  const addSegmentAndDetect = async (
    segment: TranscriptSegment,
    meetingId: string,
    displayText: string
  ) => {
    segmentsRef.current = [...segmentsRef.current, segment];
    setSegments([...segmentsRef.current]);
    await Store.addSegment(meetingId, segment);

    // Detect question and stream answer
    if (settings.autoAnswer && aiRef.current) {
      const recentText = segmentsRef.current
        .slice(-5)
        .map(s => s.speaker ? `${s.speaker}: ${s.text}` : s.text)
        .join(' ');

      const isQuestion = await aiRef.current.detectQuestion(
        recentText,
        displayText
      );

      if (isQuestion) {
        segment.isQuestion = true;

        const fullTranscript = await Store.getFullTranscript(meetingId);
        const answerId = `ans_${Date.now()}`;

        setCurrentAnswer({
          id: answerId,
          question: displayText,
          answer: '',
          timestamp: Date.now(),
          dismissed: false,
        });

        await aiRef.current.generateAnswerStreaming(
          fullTranscript,
          displayText,
          settings.meetingTopic,
          settings.userRole,
          (chunk) => {
            setCurrentAnswer(prev =>
              prev && prev.id === answerId
                ? { ...prev, answer: prev.answer + chunk }
                : prev
            );
          }
        );
      }
    }
  };

  const stopSession = useCallback(async () => {
    setIsLive(false);
    await audioService.current.stopCapture();

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
        console.error('Summary generation error:', err);
        await Store.endMeeting(meetingIdRef.current!);
      }
    }
  }, []);

  const dismissAnswer = useCallback(() => {
    setCurrentAnswer(null);
  }, []);

  return {
    segments,
    currentAnswer,
    isLive,
    error,
    meetingId,
    startSession,
    stopSession,
    dismissAnswer,
  };
}
