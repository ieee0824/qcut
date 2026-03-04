import '@testing-library/jest-dom';import i18n from '../i18n';

// テスト時に i18n を初期化（日本語に固定）
beforeAll(() => {
  i18n.changeLanguage('ja');
});