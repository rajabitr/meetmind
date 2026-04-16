import { useRef, useEffect } from 'react';
import { FlatList, Text, View, StyleSheet } from 'react-native';
import { TranscriptSegment } from '../types';

interface Props {
  segments: TranscriptSegment[];
  fontSize: number;
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

  return (
    <FlatList
      ref={listRef}
      data={segments}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => (
        <View style={[
          styles.segment,
          item.isQuestion && styles.questionSegment,
        ]}>
          {item.isQuestion && (
            <Text style={styles.questionBadge}>❓ QUESTION</Text>
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
      )}
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
