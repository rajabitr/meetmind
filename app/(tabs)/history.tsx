import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Meeting } from '../../src/types';
import * as Store from '../../src/services/TranscriptStore';

export default function HistoryScreen() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      loadMeetings();
    }, [])
  );

  const loadMeetings = async () => {
    const data = await Store.getMeetings();
    setMeetings(data);
  };

  const handleDelete = (id: string, title: string) => {
    Alert.alert(
      'Delete Meeting',
      `Delete "${title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await Store.deleteMeeting(id);
            loadMeetings();
          },
        },
      ]
    );
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const formatDuration = (start: number, end?: number) => {
    if (!end) return 'In progress';
    const mins = Math.round((end - start) / 60000);
    if (mins < 1) return '<1 min';
    return `${mins} min`;
  };

  if (meetings.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyText}>No meetings yet</Text>
        <Text style={styles.emptyHint}>
          Start a live session to record your first meeting
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={meetings}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push(`/meeting/${item.id}`)}
          onLongPress={() => handleDelete(item.id, item.title)}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.duration}>
              {formatDuration(item.startTime, item.endTime)}
            </Text>
          </View>
          <Text style={styles.date}>{formatDate(item.startTime)}</Text>
          {item.summary && (
            <Text style={styles.summaryPreview} numberOfLines={2}>
              {item.summary}
            </Text>
          )}
          {item.topic && (
            <View style={styles.topicChip}>
              <Text style={styles.topicText}>{item.topic}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  empty: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: '#666', fontSize: 20, fontWeight: '500' },
  emptyHint: { color: '#444', fontSize: 14, marginTop: 8, textAlign: 'center' },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '600', flex: 1 },
  duration: { color: '#4FC3F7', fontSize: 13, marginLeft: 12 },
  date: { color: '#666', fontSize: 13, marginTop: 4 },
  summaryPreview: { color: '#888', fontSize: 13, marginTop: 8, lineHeight: 18 },
  topicChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#252525',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  topicText: { color: '#4FC3F7', fontSize: 11 },
});
