import { View, Text, StyleSheet } from 'react-native';

export default function LiveScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>MeetMind Live</Text>
      <Text style={styles.sub}>Teleprompter coming soon...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  text: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  sub: { color: '#666', fontSize: 16, marginTop: 8 },
});
