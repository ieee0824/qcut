# qcut - Video Editor

学生が気軽に使える動画編集ソフトウェア

## 技術スタック

- **フロントエンド**: React + Vite
- **バックエンド**: Rust + Tauri
- **動画処理**: FFmpeg (将来的にGStreamerも検討)

## 機能

- マルチトラックタイムライン
- リアルタイムプレビュー
- エフェクト・トランジション
- テキスト・字幕
- カラーグレーディング
- 音声編集

## 開発環境セットアップ

### 必要なツール

- Node.js (v20.19+) / npm
- Rust (最新安定版)
- Tauri CLI

### 開発手順

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run tauri:dev
```

### ビルド

```bash
npm run tauri:build
```

## ライセンス

MIT
