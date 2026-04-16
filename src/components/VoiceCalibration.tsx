import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { WhisperService } from '../services/WhisperService';

interface Props {
  currentText: string;
  openaiKey: string;
  onCalibrated: (text: string) => void;
}

export function VoiceCalibration({ currentText, openaiKey, onCalibrated }: Props) {
  const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [countdown, setCountdown] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startCalibration = async () => {
    if (!openaiKey) return;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    recordingRef.current = recording;
    setState('recording');
    setCountdown(5);

    // Countdown
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          stopCalibration();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopCalibration = async () => {
    if (!recordingRef.current) return;

    setState('processing');

    await recordingRef.current.stopAndUnloadAsync();
    const uri = recordingRef.current.getURI();
    recordingRef.current = null;

    if (!uri) {
      setState('idle');
      return;
    }

    try {
      const whisper = new WhisperService(openaiKey);
      const result = await whisper.transcribe(uri);
      if (result.text && result.text.trim().length > 0) {
        onCalibrated(result.text.trim());
      }
    } catch (err) {
      console.error('Calibration error:', err);
    }

    setState('idle');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Voice Calibration</Text>
      <Text style={styles.hint}>
        Record a 5-second sample of your voice. The system will learn to
        filter out your speech and only respond to others.
      </Text>

      {currentText ? (
        <View style={styles.sampleBox}>
          <Text style={styles.sampleLabel}>Your voice sample:</Text>
          <Text style={styles.sampleText}>"{currentText}"</Text>
        </View>
      ) : null}

      {state === 'idle' && (
        <TouchableOpacity style={styles.recordBtn} onPress={startCalibration}>
          <Text style={styles.recordBtnText}>
            {currentText ? 'Re-record Sample' : 'Record Voice Sample'}
          </Text>
        </TouchableOpacity>
      )}

      {state === 'recording' && (
        <View style={styles.recordingBox}>
          <Text style={styles.recordingDot}>🔴</Text>
          <Text style={styles.recordingText}>
            Speak naturally for {countdown}s...
          </Text>
          <Text style={styles.recordingHint}>
            Say something like: "Hi, my name is [name], I'm a [role] and I'm
            here to discuss [topic]"
          </Text>
        </View>
      )}

      {state === 'processing' && (
        <View style={styles.processingBox}>
          <ActivityIndicator color="#4FC3F7" size="small" />
          <Text style={styles.processingText}>Analyzing your voice...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 4 },
  label: { color: '#ccc', fontSize: 14, marginBottom: 6 },
  hint: { color: '#666', fontSize: 12, marginBottom: 12, lineHeight: 18 },
  sampleBox: {
    backgroundColor: '#252525',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  sampleLabel: { color: '#4FC3F7', fontSize: 11, marginBottom: 4 },
  sampleText: { color: '#aaa', fontSize: 13, fontStyle: 'italic' },
  recordBtn: {
    backgroundColor: '#1a3a4a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  recordBtnText: { color: '#4FC3F7', fontSize: 14, fontWeight: '600' },
  recordingBox: { alignItems: 'center', paddingVertical: 16 },
  recordingDot: { fontSize: 24, marginBottom: 8 },
  recordingText: { color: '#F44336', fontSize: 16, fontWeight: '600' },
  recordingHint: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  processingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  processingText: { color: '#4FC3F7', fontSize: 14 },
});
