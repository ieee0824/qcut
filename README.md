# qcut - Video Editor

[![CI](https://github.com/ieee0824/qcut/actions/workflows/ci.yml/badge.svg)](https://github.com/ieee0824/qcut/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/ieee0824/qcut/graph/badge.svg)](https://codecov.io/gh/ieee0824/qcut)

学生が気軽に使える動画編集ソフトウェア

## 技術スタック

- **フロントエンド**: React 19 + TypeScript + Vite 7
- **状態管理**: Zustand
- **バックエンド**: Rust + Tauri 2
- **動画処理**: FFmpeg
- **i18n**: react-i18next

## 機能

### 実装済み
- マルチトラックタイムライン（ビデオ・オーディオ・テキストトラック）
- リアルタイムビデオプレビュー（クリップ切り替え時のプリロード対応）
- 動画ファイルの読み込み（複数ファイル対応）
- クリップのカット・移動・リサイズ
- エフェクト（明るさ・コントラスト・彩度）
- トランスフォーム（回転・スケール・位置調整）
- テキストオーバーレイ（フォント設定・位置・アニメーション）
- 字幕インポート/エクスポート（SRT・ASS形式）
- 動画エクスポート（MP4/MOV/AVI/WebM、進捗表示・残り時間推定・キャンセル対応）
- 多言語対応（日本語・英語）
- プラグインシステム（TypeScript・WASM）

### 開発予定
- トランジション機能
- カラーグレーディング
- 音声編集
- フィルター（ブラー、シャープ、モノクロ）
- キーボードショートカット
- エフェクトプリセット
- キーフレームアニメーション

## 開発環境セットアップ

### 必要なツール

- Node.js (v20.19+) / npm
- Rust (最新安定版)
- Tauri CLI
- FFmpeg（動画エクスポートに必要）

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

## プラグインシステム

qcut はプラグインシステムを備えており、TypeScript プラグインと WASM プラグインの両方をサポートしています。

### アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│  qcut App                                               │
│                                                         │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │ App.tsx  │──▶│PluginManager │──▶│  pluginStore    │  │
│  └──────────┘   │ (lifecycle)  │   │  (Zustand)     │  │
│                 └──────┬───────┘   └────────────────┘  │
│                        │                                │
│            ┌───────────┼───────────┐                    │
│            ▼           ▼           ▼                    │
│     ┌────────────┐ ┌────────┐ ┌──────────────┐         │
│     │PluginLoader│ │Context │ │WasmWrapper   │         │
│     │ discover() │ │ (API)  │ │processFrame()│         │
│     │ load()     │ │        │ │              │         │
│     └─────┬──────┘ └───┬────┘ └──────┬───────┘         │
│           │            │             │                  │
│     ┌─────▼──────┐  ┌──▼───────────┐│                  │
│     │Tauri Commands│ │Zustand Stores││                  │
│     │list_plugin_ │ │timelineStore ││                  │
│     │  dirs       │ │videoPreview  ││                  │
│     │read_plugin_ │ │  Store       ││                  │
│     │  manifest   │ └──────────────┘│                  │
│     │read_plugin_ │                 │                  │
│     │  file       │                 │                  │
│     └─────┬───────┘                 │                  │
│           │                         │                  │
└───────────┼─────────────────────────┼──────────────────┘
            ▼                         ▼
┌───────────────────┐  ┌──────────────────────────┐
│ {app_data_dir}/   │  │  WASM Linear Memory      │
│  plugins/         │  │  ┌─────────┐ ┌─────────┐ │
│   my-plugin/      │  │  │ input   │ │ output  │ │
│    plugin.json    │  │  │ (RGBA)  │ │ (RGBA)  │ │
│    index.js       │  │  └─────────┘ └─────────┘ │
│    index.wasm     │  └──────────────────────────┘
│  plugin-settings  │
│    .json          │
└───────────────────┘
```

### プラグインの種類

| 種類 | 用途 | エントリ |
|------|------|----------|
| `typescript` | UI拡張、設定パネル、カスタムツール | `index.js` (ESM) |
| `wasm` | フレーム処理、フィルタ、エフェクト | `index.wasm` |
| `hybrid` | TS で UI + WASM で計算 | 両方 |

### プラグインの作り方

#### 1. ディレクトリを作成

```
{app_data_dir}/plugins/my-plugin/
├── plugin.json
├── index.js       # TypeScript プラグイン
└── index.wasm     # WASM プラグイン（オプション）
```

#### 2. マニフェスト（plugin.json）を書く

```json
{
  "id": "com.example.my-effect",
  "name": "My Effect",
  "version": "1.0.0",
  "description": "サンプルエフェクトプラグイン",
  "author": "Your Name",
  "type": "typescript",
  "entry": {
    "js": "index.js"
  },
  "permissions": [
    "timeline:read",
    "preview:read",
    "ui:panel"
  ],
  "minAppVersion": "0.1.0",
  "category": "effect"
}
```

#### 3. プラグイン本体を実装

**TypeScript プラグイン（index.js）:**

```javascript
export default {
  async onInit(context) {
    context.log.info('プラグイン初期化');

    // タイムラインの変更を監視
    context.timeline.onTimeChange((time) => {
      context.log.info(`現在時刻: ${time}`);
    });

    // UIパネルを登録
    context.ui.registerPanel({
      id: 'my-panel',
      title: 'My Effect',
      location: 'sidebar',
      render: (container) => {
        container.innerHTML = '<p>Hello from plugin!</p>';
      },
    });
  },

  async onActivate() {
    // プラグイン有効化時の処理
  },

  async onDeactivate() {
    // プラグイン無効化時の処理
  },
};
```

**WASM プラグイン（Rust で実装 → .wasm にコンパイル）:**

```rust
#[no_mangle]
pub extern "C" fn alloc(size: usize) -> *mut u8 {
    let mut buf = Vec::with_capacity(size);
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

#[no_mangle]
pub extern "C" fn dealloc(ptr: *mut u8, size: usize) {
    unsafe { Vec::from_raw_parts(ptr, 0, size); }
}

/// RGBA フレームデータを処理（例: グレースケール変換）
#[no_mangle]
pub extern "C" fn process_frame(
    input: *const u8, width: u32, height: u32, output: *mut u8
) {
    let len = (width * height * 4) as usize;
    let input = unsafe { std::slice::from_raw_parts(input, len) };
    let output = unsafe { std::slice::from_raw_parts_mut(output, len) };

    for i in (0..len).step_by(4) {
        let gray = (input[i] as u16 + input[i+1] as u16 + input[i+2] as u16) / 3;
        output[i]     = gray as u8;  // R
        output[i + 1] = gray as u8;  // G
        output[i + 2] = gray as u8;  // B
        output[i + 3] = input[i + 3]; // A
    }
}
```

### PluginContext API

プラグインには `PluginContext` を通じて以下の API が提供されます。各 API はマニフェストの `permissions` で要求した権限に応じてアクセスが制御されます。

| API | 必要な権限 | 説明 |
|-----|-----------|------|
| `context.timeline.getTracks()` | `timeline:read` | トラック一覧を取得 |
| `context.timeline.getCurrentTime()` | `timeline:read` | 現在の再生位置を取得 |
| `context.timeline.onTimeChange(cb)` | `timeline:read` | 再生位置の変更を監視 |
| `context.timeline.addClip(...)` | `timeline:write` | クリップを追加 |
| `context.timeline.updateClip(...)` | `timeline:write` | クリップを更新 |
| `context.timeline.removeClip(...)` | `timeline:write` | クリップを削除 |
| `context.preview.onFrameRender(cb)` | `frame:process` | フレーム描画時にフィルタを適用 |
| `context.ui.registerPanel(config)` | `ui:panel` | UIパネルを追加 |
| `context.ui.registerToolbarButton(config)` | `ui:toolbar` | ツールバーにボタンを追加 |
| `context.settings.get(key, default)` | `settings:read` | プラグイン設定を読み取り |
| `context.settings.set(key, value)` | `settings:write` | プラグイン設定を書き込み |
| `context.log.info/warn/error(msg)` | なし | ログ出力 |

### ライフサイクル

```
installed → loaded → initialized → active ⇄ inactive
                                      ↓
                                    error（自動隔離）
```

1. **installed**: プラグインディレクトリ検出、マニフェスト解析済み
2. **loaded**: JS/WASM モジュールをメモリに読み込み済み
3. **initialized**: `onInit()` 呼び出し完了
4. **active**: `onActivate()` 呼び出し完了、フック登録済み
5. **inactive**: `onDeactivate()` 呼び出し完了、フック解除済み
6. **error**: エラー発生時に自動遷移。アプリ本体には影響しない

### 利用可能な権限一覧

| 権限 | 説明 |
|------|------|
| `timeline:read` | トラック・クリップデータの読み取り |
| `timeline:write` | トラック・クリップの追加・変更・削除 |
| `preview:read` | 現在のフレームデータの取得 |
| `preview:write` | プレビューへのオーバーレイ描画 |
| `file:read` | ファイルメタデータの読み取り |
| `file:write` | ファイルの書き込み・エクスポート |
| `settings:read` | アプリ設定の読み取り |
| `settings:write` | アプリ設定の変更 |
| `ui:panel` | UIパネルの登録 |
| `ui:toolbar` | ツールバーボタンの登録 |
| `frame:process` | WASM フレーム処理パイプライン |

## ライセンス

MIT
