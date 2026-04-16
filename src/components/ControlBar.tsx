import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';

interface Props {
  isLive: boolean;
  onStart: () => void;
  onStop: () => void;
  error?: string | null;
}

export function ControlBar({ isLive, onStart, onStop, error }: Props) {
  const [duration, setDuration] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Duration timer
  useEffect(() => {
    if (!isLive) {
      setDuration(0);
      return;
    }
    const interval = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  // Pulse animation for live indicator
  useEffect(() => {
    if (!isLive) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [isLive]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.bar}>
        {isLive && (
          <View style={styles.liveInfo}>
            <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
            <Text style={styles.liveText}>LIVE</Text>
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, isLive ? styles.stopButton : styles.startButton]}
          onPress={isLive ? onStop : onStart}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonIcon}>{isLive ? '⏹' : '▶'}</Text>
          <Text style={[styles.buttonText, isLive && styles.stopButtonText]}>
            {isLive ? 'Stop' : 'Start'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  errorBar: {
    backgroundColor: 'rgba(244, 67, 54, 0.9)',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  errorText: {
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: '#222',
    gap: 20,
  },
  liveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F44336',
  },
  liveText: {
    color: '#F44336',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  durationText: {
    color: '#888',
    fontSize: 14,
    fontFamily: 'SpaceMono',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 8,
  },
  startButton: {
    backgroundColor: '#4FC3F7',
  },
  stopButton: {
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  buttonIcon: {
    fontSize: 16,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  stopButtonText: {
    color: '#F44336',
  },
});
