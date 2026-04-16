import { useRef, useEffect } from 'react';
import { FlatList, Text, View, StyleSheet } from 'react-native';
import { TranscriptSegment } from '../types';
import { SPEAKER_COLORS } from '../config/constants';

interface Props {
  segments: TranscriptSegment[];
  fontSize: number;
}

function getSpeakerColor(speaker?: string): string {
  if (!speaker) return '#E0E0E0';
  // Extract number from "Speaker 1", "Speaker 2", etc. or use hash
  const match = speaker.match(/(\d+)/);
  if (match) {
    const idx = (parseInt(match[1], 10) - 1) % SPEAKER_COLORS.length;
    return SPEAKER_COLORS[idx];
  }
  // Hash-based fallback for custom names
  let hash = 0;
  for (let i = 0; i < speaker.length; i++) {
    hash = speaker.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SPEAKER_COLORS[Math.abs(hash) % SPEAKER_COLORS.length];
}

export function TranscriptView({ segments, fontSize }: Props) {
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (segments.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [segments.length]);

  if (segments.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🎙️</Text>
        <Text style={styles.emptyText}>Waiting for audio...</Text>
        <Text style={styles.emptyHint}>
          Tap Start to begin transcribing
        </Text>
      </View>
    );
  }

  // Check if previous segment has same speaker (to avoid repeating label)
  const shouldShowSpeaker = (index: number): boolean => {
    const item = segments[index];
    if (!item.speaker) return false;
    if (index === 0) return true;
    return segments[index - 1].speaker !== item.speaker;
  };

  return (
    <FlatList
      ref={listRef}
      data={segments}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      renderItem={({ item, index }) => {
        const speakerColor = getSpeakerColor(item.speaker);
        const showSpeaker = shouldShowSpeaker(index);

        return (
          <View style={[
            styles.segment,
            item.isQuestion && styles.questionSegment,
            item.speaker && styles.speakerSegment,
            item.speaker && { borderLeftColor: speakerColor },
          ]}>
            {item.isQuestion && (
              <Text style={styles.questionBadge}>❓ QUESTION</Text>
            )}
            {showSpeaker && item.speaker && (
              <Text style={[styles.speakerLabel, { color: speakerColor }]}>
                {item.speaker}
              </Text>
            )}
            <Text style={[
              styles.segmentText,
              { fontSize },
              item.isQuestion && styles.questionText,
            ]}>
              {item.text}
            </Text>
            {item.language && (
              <Text style={styles.langTag}>{item.language.toUpperCase()}</Text>
            )}
          </View>
        );
      }}
      onContentSizeChange={() => {
        listRef.current?.scrollToEnd({ animated: true });
      }}
    />
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: '#666', fontSize: 20, fontWeight: '500' },
  emptyHint: { color: '#444', fontSize: 14, marginTop: 8, textAlign: 'center' },
  listContent: { padding: 16, paddingBottom: 120 },
  segment: {
    marginBottom: 12,
    paddingVertical: 4,
  },
  speakerSegment: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    borderRadius: 4,
  },
  speakerLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  questionSegment: {
    backgroundColor: 'rgba(255, 193, 7, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#FFC107',
    paddingLeft: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  segmentText: {
    color: '#E0E0E0',
    lineHeight: 28,
  },
  questionText: {
    color: '#FFF',
  },
  questionBadge: {
    color: '#FFC107',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 1,
  },
  langTag: {
    color: '#555',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
});
