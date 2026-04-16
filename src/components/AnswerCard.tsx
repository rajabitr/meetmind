import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { AnswerSuggestion } from '../types';

interface Props {
  answer: AnswerSuggestion;
  fontSize: number;
  onDismiss: () => void;
}

export function AnswerCard({ answer, fontSize, onDismiss }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.badge}>💡 SUGGESTED ANSWER</Text>
        <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.question}>"{answer.question}"</Text>

      <View style={styles.divider} />

      <Text style={[styles.answerText, { fontSize: fontSize + 2 }]}>
        {answer.answer}
      </Text>

      <TouchableOpacity onPress={onDismiss} style={styles.gotItBtn}>
        <Text style={styles.gotItText}>Got it</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 12,
    right: 12,
    backgroundColor: '#0D2818',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1B5E20',
    shadowColor: '#00E676',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    color: '#69F0AE',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  dismissBtn: {
    padding: 4,
  },
  dismissText: {
    color: '#666',
    fontSize: 18,
  },
  question: {
    color: '#81C784',
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#1B5E20',
    marginBottom: 12,
  },
  answerText: {
    color: '#E8F5E9',
    lineHeight: 30,
    fontWeight: '500',
  },
  gotItBtn: {
    alignSelf: 'flex-end',
    marginTop: 12,
    backgroundColor: '#1B5E20',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  gotItText: {
    color: '#69F0AE',
    fontWeight: '600',
    fontSize: 14,
  },
});
