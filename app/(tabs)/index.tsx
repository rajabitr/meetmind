import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { useTranscription } from '../../src/hooks/useTranscription';
import { useSettings } from '../../src/hooks/useSettings';
import { TranscriptView } from '../../src/components/TranscriptView';
import { AnswerCard } from '../../src/components/AnswerCard';
import { ControlBar } from '../../src/components/ControlBar';

export default function LiveScreen() {
  const { settings, apiKeys, loading } = useSettings();
  const {
    segments,
    currentAnswer,
    isLive,
    error,
    status,
    startSession,
    stopSession,
    dismissAnswer,
  } = useTranscription(settings, apiKeys);

  // Keep screen awake during live session
  useKeepAwake();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" hidden={isLive} />

      {/* Debug status bar */}
      {isLive && status ? (
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      ) : null}

      <TranscriptView
        segments={segments}
        fontSize={settings.fontSize}
      />

      {currentAnswer && (
        <AnswerCard
          answer={currentAnswer}
          fontSize={settings.fontSize}
          onDismiss={dismissAnswer}
        />
      )}

      <ControlBar
        isLive={isLive}
        onStart={startSession}
        onStop={stopSession}
        error={error}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  statusBar: {
    backgroundColor: '#1a2a1a',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  statusText: {
    color: '#4FC3F7',
    fontSize: 11,
    textAlign: 'center',
  },
});
