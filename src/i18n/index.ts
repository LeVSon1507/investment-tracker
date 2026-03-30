import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import vi from './vi';
import en from './en';

const savedLanguage = (() => {
  try {
    const stored = localStorage.getItem('investment-tracker-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.language ?? 'vi';
    }
  } catch {
    // Fall through to default
  }
  return 'vi';
})();

i18n.use(initReactI18next).init({
  resources: { vi, en },
  lng: savedLanguage,
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
});

export default i18n;
