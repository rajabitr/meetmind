import * as SecureStore from 'expo-secure-store';
import { AppSettings } from '../types';

const SETTINGS_KEY = 'app_settings';

export async function saveApiKey(provider: string, key: string): Promise<void> {
  await SecureStore.setItemAsync(`${provider}_api_key`, key);
}

export async function getApiKey(provider: string): Promise<string | null> {
  return SecureStore.getItemAsync(`${provider}_api_key`);
}

export async function deleteApiKey(provider: string): Promise<void> {
  await SecureStore.deleteItemAsync(`${provider}_api_key`);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(settings));
}

export async function getSettings(): Promise<AppSettings | null> {
  const raw = await SecureStore.getItemAsync(SETTINGS_KEY);
  return raw ? JSON.parse(raw) : null;
}
