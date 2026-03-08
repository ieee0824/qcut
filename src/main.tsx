import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n'; // i18n を初期化

// WebViewデフォルトのコンテキストメニューを無効化し、アプリ側のカスタムメニューを使用する
document.addEventListener('contextmenu', (e) => e.preventDefault(), true);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
