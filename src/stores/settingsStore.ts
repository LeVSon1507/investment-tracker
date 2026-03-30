import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Currency, Language } from '../types/investment';

const ENV_GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY as string | undefined;
const ENV_FALLBACK_PASSWORD = (import.meta.env.VITE_FALLBACK_PASSWORD as string) || 'admin123';

type SettingsState = {
  currency: Currency;
  language: Language;
  salaryDay: number;
  geminiApiKey: string;
  geminiModel: string;
  isFallbackUnlocked: boolean;
  lastSalaryReminderDismissed: string | null;
  setCurrency: (currency: Currency) => void;
  setLanguage: (language: Language) => void;
  setSalaryDay: (day: number) => void;
  setGeminiApiKey: (key: string) => void;
  setGeminiModel: (model: string) => void;
  setFallbackUnlocked: (isUnlocked: boolean) => void;
  dismissSalaryReminder: (monthKey: string) => void;
  getEffectiveApiKey: () => string;
};

export function verifyFallbackPassword(password: string): boolean {
  return password === ENV_FALLBACK_PASSWORD;
}

export function hasEnvFallbackKey(): boolean {
  return Boolean(ENV_GEMINI_KEY && ENV_GEMINI_KEY.length > 0);
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      currency: 'VND',
      language: 'vi',
      salaryDay: 25,
      geminiApiKey: '',
      geminiModel: 'gemini-2.0-flash',
      isFallbackUnlocked: false,
      lastSalaryReminderDismissed: null,

      setCurrency: (currency: Currency) => set({ currency }),
      setLanguage: (language: Language) => set({ language }),
      setSalaryDay: (salaryDay: number) => set({ salaryDay }),
      setGeminiApiKey: (geminiApiKey: string) => set({ geminiApiKey }),
      setGeminiModel: (geminiModel: string) => set({ geminiModel }),
      setFallbackUnlocked: (isFallbackUnlocked: boolean) => set({ isFallbackUnlocked }),
      dismissSalaryReminder: (monthKey: string) =>
        set({ lastSalaryReminderDismissed: monthKey }),

      getEffectiveApiKey: (): string => {
        const state = get();
        if (state.geminiApiKey.length > 0) {
          return state.geminiApiKey;
        }
        if (state.isFallbackUnlocked && ENV_GEMINI_KEY) {
          return ENV_GEMINI_KEY;
        }
        return '';
      },
    }),
    { name: 'investment-tracker-settings' },
  ),
);
