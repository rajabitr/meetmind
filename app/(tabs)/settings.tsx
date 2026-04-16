import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSettings } from '../../src/hooks/useSettings';
import { AIProvider } from '../../src/types';
import { LANGUAGES } from '../../src/config/constants';

const AI_PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: 'claude', label: 'Claude (Anthropic)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini (Google)' },
];

export default function SettingsScreen() {
  const { settings, apiKeys, updateSettings, updateApiKey, loading } = useSettings();
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4FC3F7" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* AI Provider */}
      <Text style={styles.sectionTitle}>AI Provider</Text>
      <View style={styles.card}>
        {AI_PROVIDERS.map(p => (
          <TouchableOpacity
            key={p.value}
            style={[
              styles.providerOption,
              settings.aiProvider === p.value && styles.providerSelected,
            ]}
            onPress={() => updateSettings({ aiProvider: p.value })}
          >
            <Text style={[
              styles.providerText,
              settings.aiProvider === p.value && styles.providerTextSelected,
            ]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* API Keys */}
      <Text style={styles.sectionTitle}>API Keys</Text>
      <View style={styles.card}>
        <Text style={styles.hint}>OpenAI key is always required for Whisper STT</Text>
        {AI_PROVIDERS.map(p => (
          <View key={p.value} style={styles.keyRow}>
            <Text style={styles.label}>{p.label}</Text>
            <View style={styles.keyInputRow}>
              <TextInput
                style={styles.input}
                value={apiKeys[p.value] || ''}
                onChangeText={(val) => updateApiKey(p.value, val)}
                placeholder={`Enter ${p.label} API key`}
                placeholderTextColor="#555"
                secureTextEntry={!showKey[p.value]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowKey(prev => ({ ...prev, [p.value]: !prev[p.value] }))}
                style={styles.eyeBtn}
              >
                <Text style={styles.eyeText}>{showKey[p.value] ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* Language */}
      <Text style={styles.sectionTitle}>Language</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Source Language</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langScroll}>
          {LANGUAGES.map(lang => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.langChip,
                settings.sourceLanguage === lang.code && styles.langChipSelected,
              ]}
              onPress={() => updateSettings({ sourceLanguage: lang.code })}
            >
              <Text style={[
                styles.langChipText,
                settings.sourceLanguage === lang.code && styles.langChipTextSelected,
              ]}>
                {lang.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.label, { marginTop: 16 }]}>Target Language</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langScroll}>
          {LANGUAGES.filter(l => l.code !== 'auto').map(lang => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.langChip,
                settings.targetLanguage === lang.code && styles.langChipSelected,
              ]}
              onPress={() => updateSettings({ targetLanguage: lang.code })}
            >
              <Text style={[
                styles.langChipText,
                settings.targetLanguage === lang.code && styles.langChipTextSelected,
              ]}>
                {lang.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Meeting Context */}
      <Text style={styles.sectionTitle}>Meeting Context</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Meeting Topic</Text>
        <TextInput
          style={styles.input}
          value={settings.meetingTopic}
          onChangeText={(val) => updateSettings({ meetingTopic: val })}
          placeholder="e.g. Q3 Planning, Sprint Review..."
          placeholderTextColor="#555"
        />

        <Text style={[styles.label, { marginTop: 12 }]}>Your Role</Text>
        <TextInput
          style={styles.input}
          value={settings.userRole}
          onChangeText={(val) => updateSettings({ userRole: val })}
          placeholder="e.g. Engineering Lead, PM..."
          placeholderTextColor="#555"
        />
      </View>

      {/* Display */}
      <Text style={styles.sectionTitle}>Display</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Font Size: {settings.fontSize}px</Text>
        <View style={styles.fontSizeRow}>
          {[14, 16, 18, 20, 24, 28].map(size => (
            <TouchableOpacity
              key={size}
              style={[
                styles.fontSizeBtn,
                settings.fontSize === size && styles.fontSizeBtnSelected,
              ]}
              onPress={() => updateSettings({ fontSize: size })}
            >
              <Text style={[
                styles.fontSizeBtnText,
                settings.fontSize === size && styles.fontSizeBtnTextSelected,
              ]}>
                {size}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Auto Answer */}
      <Text style={styles.sectionTitle}>AI Assistance</Text>
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Auto Answer</Text>
            <Text style={styles.hint}>
              Automatically detect questions and generate suggested answers
            </Text>
          </View>
          <Switch
            value={settings.autoAnswer}
            onValueChange={(val) => updateSettings({ autoAnswer: val })}
            trackColor={{ false: '#333', true: '#4FC3F7' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16 },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { color: '#4FC3F7', fontSize: 13, fontWeight: '600', marginTop: 20, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 4 },
  label: { color: '#ccc', fontSize: 14, marginBottom: 6 },
  hint: { color: '#666', fontSize: 12, marginBottom: 8 },
  input: { backgroundColor: '#252525', color: '#fff', borderRadius: 8, padding: 12, fontSize: 14, borderWidth: 1, borderColor: '#333' },
  providerOption: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 4 },
  providerSelected: { backgroundColor: '#1a3a4a' },
  providerText: { color: '#888', fontSize: 16 },
  providerTextSelected: { color: '#4FC3F7', fontWeight: '600' },
  keyRow: { marginBottom: 12 },
  keyInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: { paddingVertical: 12, paddingHorizontal: 8 },
  eyeText: { color: '#4FC3F7', fontSize: 12 },
  langScroll: { marginTop: 4 },
  langChip: { backgroundColor: '#252525', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#333' },
  langChipSelected: { backgroundColor: '#1a3a4a', borderColor: '#4FC3F7' },
  langChipText: { color: '#888', fontSize: 13 },
  langChipTextSelected: { color: '#4FC3F7' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fontSizeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  fontSizeBtn: { backgroundColor: '#252525', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  fontSizeBtnSelected: { backgroundColor: '#1a3a4a', borderColor: '#4FC3F7' },
  fontSizeBtnText: { color: '#888', fontSize: 14 },
  fontSizeBtnTextSelected: { color: '#4FC3F7', fontWeight: '600' },
});
