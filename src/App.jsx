import { useState } from 'react';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>qcut - Video Editor</h1>
        <p>学生向け動画編集ソフトウェア</p>
      </header>
      <main className="app-main">
        <div className="timeline-container">
          <p>タイムラインエリア</p>
        </div>
        <div className="preview-container">
          <p>プレビューエリア</p>
        </div>
      </main>
    </div>
  );
}

export default App;
