import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslation from './locales/ja.json';
import enTranslation from './locales/en.json';

// 言語リソースの定義
const resources = {
  ja: {
    translation: jaTranslation,
  },
  en: {
    translation: enTranslation,
  },
};

// ブラウザの言語設定を取得（デフォルトは日本語）
const detectLanguage = (): string => {
  const saved = typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
    ? localStorage.getItem('i18n-language')
    : null;
  if (saved) return saved;

  const browserLang = navigator.language.startsWith('ja') ? 'ja' : 'en';
  return browserLang;
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: detectLanguage(),
    fallbackLng: 'ja',
    interpolation: {
      escapeValue: false, // React は自動的に XSS 保護を行う
    },
    react: {
      useSuspense: false, // Suspense を使わない（オプション）
    },
  });

export default i18n;
