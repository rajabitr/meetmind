import { useState, useEffect, useCallback } from 'react';
import { AppSettings } from '../types';
import { saveSettings, getSettings, saveApiKey, getApiKey } from '../services/SecureStorage';
import { DEFAULT_SETTINGS } from '../config/constants';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const saved = await getSettings();
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...saved });

      const keys: Record<string, string> = {};
      for (const provider of ['openai', 'claude', 'gemini']) {
        const key = await getApiKey(provider);
        if (key) keys[provider] = key;
      }
      setApiKeys(keys);
      setLoading(false);
    })();
  }, []);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...partial };
      saveSettings(updated);
      return updated;
    });
  }, []);

  const updateApiKey = useCallback(async (provider: string, key: string) => {
    await saveApiKey(provider, key);
    setApiKeys(prev => ({ ...prev, [provider]: key }));
  }, []);

  return { settings, apiKeys, updateSettings, updateApiKey, loading };
}
