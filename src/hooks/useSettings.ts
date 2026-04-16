import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import React from 'react';
import { AppSettings } from '../types';
import { saveSettings, getSettings, saveApiKey, getApiKey } from '../services/SecureStorage';
import { DEFAULT_SETTINGS } from '../config/constants';

interface SettingsContextType {
  settings: AppSettings;
  apiKeys: Record<string, string>;
  loading: boolean;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  updateApiKey: (provider: string, key: string) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const saved = await getSettings();
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...saved });

      const keys: Record<string, string> = {};
      for (const provider of ['openai', 'claude', 'gemini', 'deepgram']) {
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

  return React.createElement(
    SettingsContext.Provider,
    { value: { settings, apiKeys, loading, updateSettings, updateApiKey } },
    children
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return ctx;
}
