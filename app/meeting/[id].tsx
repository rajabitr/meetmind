import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Meeting } from '../../src/types';
import * as Store from '../../src/services/TranscriptStore';
import { useSettings } from '../../src/hooks/useSettings';
import { AIProviderService } from '../../src/services/AIProviderService';
import { AI_MODELS } from '../../src/config/constants';

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { settings, apiKeys } = useSettings();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  useEffect(() => {
    loadMeeting();
  }, [id]);

  const loadMeeting = async () => {
    if (!id) return;
    const data = await Store.getMeetingWithSegments(id);
    setMeeting(data);
    setLoading(false);
  };

  const handleGenerateSummary = async () => {
    if (!id || !meeting) return;

    const providerKey = apiKeys[settings.aiProvider];
    if (!providerKey) return;

    setGeneratingSummary(true);
    try {
      const ai = new AIProviderService({
        provider: settings.aiProvider,
        apiKey: providerKey,
        fastModel: AI_MODELS[settings.aiProvider].fast,
        smartModel: AI_MODELS[settings.aiProvider].smart,
      });

      const transcript = meeting.segments.map(s => s.text).join(' ');
      const summary = await ai.generateSummary(transcript);
      await Store.endMeeting(id, summary);
      setMeeting(prev => prev ? { ...prev, summary } : null);
    } catch (err) {
      console.error('Summary error:', err);
    }
    setGeneratingSummary(false);
  };

  const handleShare = async () => {
    if (!meeting) return;
    const transcript = meeting.segments.map(s => s.text).join('\n\n');
    const text = [
      `📋 ${meeting.title}`,
      `📅 ${new Date(meeting.startTime).toLocaleString()}`,
      '',
      meeting.summary ? `## Summary\n${meeting.summary}\n` : '',
      '## Transcript',
      transcript,
    ].filter(Boolean).join('\n');

    await Share.share({ message: text });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4FC3F7" size="large" />
      </View>
    );
  }

  if (!meeting) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Meeting not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{meeting.title}</Text>
      <Text style={styles.date}>
        {new Date(meeting.startTime).toLocaleString()}
      </Text>

      {/* Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Summary</Text>
        {meeting.summary ? (
          <Text style={styles.summaryText}>{meeting.summary}</Text>
        ) : (
          <TouchableOpacity
            style={styles.generateBtn}
            onPress={handleGenerateSummary}
            disabled={generatingSummary}
          >
            {generatingSummary ? (
              <ActivityIndicator color="#4FC3F7" size="small" />
            ) : (
              <Text style={styles.generateBtnText}>Generate Summary</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Transcript */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Transcript ({meeting.segments.length} segments)
        </Text>
        {meeting.segments.map((seg) => (
          <View
            key={seg.id}
            style={[
              styles.segment,
              seg.isQuestion && styles.questionSegment,
            ]}
          >
            {seg.isQuestion && (
              <Text style={styles.questionBadge}>❓ QUESTION</Text>
            )}
            <Text style={styles.segmentText}>{seg.text}</Text>
          </View>
        ))}
      </View>

      {/* Share */}
      <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
        <Text style={styles.shareBtnText}>Share Transcript</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16 },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#F44336', fontSize: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  date: { color: '#666', fontSize: 14, marginTop: 4 },
  section: { marginTop: 24 },
  sectionTitle: {
    color: '#4FC3F7',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  summaryText: {
    color: '#ccc',
    fontSize: 15,
    lineHeight: 24,
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
  },
  generateBtn: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  generateBtnText: { color: '#4FC3F7', fontSize: 15, fontWeight: '500' },
  segment: {
    marginBottom: 8,
    paddingVertical: 4,
  },
  questionSegment: {
    backgroundColor: 'rgba(255, 193, 7, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#FFC107',
    paddingLeft: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  questionBadge: {
    color: '#FFC107',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  segmentText: {
    color: '#ccc',
    fontSize: 15,
    lineHeight: 22,
  },
  shareBtn: {
    backgroundColor: '#1a3a4a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  shareBtnText: { color: '#4FC3F7', fontSize: 16, fontWeight: '600' },
});
