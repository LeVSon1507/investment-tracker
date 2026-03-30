import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Currency, Language } from '../types/investment';

type SettingsState = {
  currency: Currency;
  language: Language;
  salaryDay: number;
  geminiApiKey: string;
  geminiModel: string;
  lastSalaryReminderDismissed: string | null;
  setCurrency: (currency: Currency) => void;
  setLanguage: (language: Language) => void;
  setSalaryDay: (day: number) => void;
  setGeminiApiKey: (key: string) => void;
  setGeminiModel: (model: string) => void;
  dismissSalaryReminder: (monthKey: string) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currency: 'VND',
      language: 'vi',
      salaryDay: 25,
      geminiApiKey: '',
      geminiModel: 'gemini-2.0-flash',
      lastSalaryReminderDismissed: null,

      setCurrency: (currency: Currency) => set({ currency }),
      setLanguage: (language: Language) => set({ language }),
      setSalaryDay: (salaryDay: number) => set({ salaryDay }),
      setGeminiApiKey: (geminiApiKey: string) => set({ geminiApiKey }),
      setGeminiModel: (geminiModel: string) => set({ geminiModel }),
      dismissSalaryReminder: (monthKey: string) =>
        set({ lastSalaryReminderDismissed: monthKey }),
    }),
    { name: 'investment-tracker-settings' },
  ),
);
