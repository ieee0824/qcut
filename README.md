# qcut - Video Editor

[![CI](https://github.com/ieee0824/qcut/actions/workflows/ci.yml/badge.svg)](https://github.com/ieee0824/qcut/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/ieee0824/qcut/graph/badge.svg)](https://codecov.io/gh/ieee0824/qcut)


## 技術スタック

- **フロントエンド**: React 19 + TypeScript + Vite 7
- **状態管理**: Zustand
- **バックエンド**: Rust + Tauri 2
- **動画処理**: FFmpeg
- **i18n**: react-i18next

## 機能

### 実装済み

**タイムライン**
- マルチトラックタイムライン（ビデオ・オーディオ・テキストトラック）
- クリップのカット・移動・リサイズ
- クリップの重なり表示（オーバーラップ領域のハイライト）
- トラック間のドラッグ＆ドロップ移動
- 右クリックコンテキストメニュー（分割・トランジション追加/削除・音声分離・削除）
- クリップのコピー/ペースト
- Undo/Redo（最大50履歴）

**ビデオプレビュー**
- リアルタイムビデオプレビュー（クリップ切り替え時のプリロード対応）
- ウィンドウリサイズへの自動追従

**映像エフェクト**
- エフェクト（明るさ・コントラスト・彩度・色温度・色相）
- HSL色域別彩度調整（赤・黄・緑・シアン・青・マゼンタ、Canvas WebGLリアルタイムプレビュー）
- カラーホイール 3-way色補正（リフト/ガンマ/ゲイン、Canvas UI、WebGLプレビュー、FFmpegエクスポート対応）
- トランスフォーム（回転・スケール・位置調整）
- トランジション（クロスフェード・ディゾルブ・ワイプ4方向、プリセット管理、リアルタイムプレビュー、FFmpegエクスポート対応）
- エフェクトパネルの折りたたみ式セクション（開閉状態の永続化）

**音声**
- 音声トラック対応（MP3/WAV/AAC/OGG/M4A/FLAC/WMA）
- 波形表示（FFmpeg デコード + キャッシュ）
- 動画クリップからの音声分離（自動ミュート付き）
- 音量調整・フェードイン/フェードアウト
- 3バンドイコライザー（Low 100Hz / Mid 1kHz / High 10kHz、±12dB）
- EQプリセット（Flat・Bass Boost・Vocal・Treble Cut）
- マルチトラック音声ミキシング（トラック音量・ミュート・ソロ、エクスポート時 amix 合成）
- ノイズリダクション（anlmdn ノイズ除去・ハイパスフィルター、エクスポート時適用）
- エコー・リバーブ（aecho フィルター、リバーブプリセット：小部屋・ホール・教会）
- プレビュー再生時のエフェクト反映（Web Audio API によるリアルタイム処理）

**テキスト・字幕**
- テキストオーバーレイ（フォント設定・位置・アニメーション）
- 字幕インポート/エクスポート（SRT・ASS形式）
- タイムコードオーバーレイ（複数カメラ同期用、4フォーマット対応、ドラッグ位置調整、ファイル作成日時自動設定）

**エクスポート**
- 動画エクスポート（MP4/MOV/AVI/WebM）
- 解像度・ビットレートプリセット
- 進捗表示・残り時間推定・キャンセル対応
- トランジションの FFmpeg xfade フィルター適用

**プロジェクト管理**
- プロジェクトファイル（.qcut 形式）の保存・読み込み
- 自動保存・クラッシュ復旧
- 最近開いたプロジェクト一覧

**その他**
- 動画ファイルの読み込み（複数ファイル対応、最近使ったファイル履歴）
- 多言語対応（日本語・英語）
- プラグインシステム（TypeScript・WASM）
- キーボードショートカット（カスタマイズ可能、ショートカット一覧表示）
- SQLite デバッグログ（7日間自動保持）

### キーボードショートカット

| キー | 操作 |
|------|------|
| Space | 再生 / 一時停止 |
| Ctrl+S (Cmd+S) | プロジェクトを保存 |
| Ctrl+Shift+S (Cmd+Shift+S) | 名前を付けて保存 |
| Ctrl+O (Cmd+O) | プロジェクトを開く |
| Ctrl+K (Cmd+K) | クリップを分割 |
| Ctrl+Z (Cmd+Z) | 元に戻す |
| Ctrl+Shift+Z (Cmd+Shift+Z) | やり直し |
| Ctrl+C (Cmd+C) | コピー |
| Ctrl+V (Cmd+V) | 貼り付け |
| Delete / Backspace | 削除 |
| Esc | 選択解除 |
| ← / → | フレーム移動 |
| + / - | タイムライン拡大/縮小 |
| ? | ショートカット一覧表示 |

キーバインドはカスタマイズ可能で、設定は localStorage に自動保存されます。

### 開発予定
- 異なるトラック間のトランジション ([#51](https://github.com/ieee0824/qcut/issues/51))
- クリップのスナップ機能 ([#52](https://github.com/ieee0824/qcut/issues/52))
- カラーグレーディング ([#9](https://github.com/ieee0824/qcut/issues/9))
- フィルター（ブラー、シャープ、モノクロ） ([#25](https://github.com/ieee0824/qcut/issues/25))
- エフェクトプリセット ([#27](https://github.com/ieee0824/qcut/issues/27))
- キーフレームアニメーション ([#28](https://github.com/ieee0824/qcut/issues/28))
- プレビュー用プリレンダリング ([#59](https://github.com/ieee0824/qcut/issues/59))
- LLMによる自然言語での動画編集操作 ([#82](https://github.com/ieee0824/qcut/issues/82))

## 開発環境セットアップ

### 必要なツール

- Node.js (v20.19+) / npm
- Rust (最新安定版)
- Tauri CLI
- FFmpeg（動画エクスポートに必要、下記のビルドオプション参照）

### FFmpeg のセットアップ

テキストオーバーレイ機能を使用するには、`drawtext` フィルター（freetype / fontconfig）が有効な FFmpeg が必要です。

**macOS (Homebrew):**

標準の `brew install ffmpeg` では drawtext フィルターが含まれません。`homebrew-ffmpeg` tap を使用してください。

```bash
# 標準版がインストール済みの場合は先にアンインストール
brew uninstall ffmpeg

# homebrew-ffmpeg tap を追加してインストール（freetype がデフォルトで有効）
brew tap homebrew-ffmpeg/ffmpeg
brew install homebrew-ffmpeg/ffmpeg/ffmpeg
```

**Ubuntu / Debian:**

```bash
sudo apt install ffmpeg libfreetype6-dev libfontconfig1-dev
```

**Windows:**

[gyan.dev](https://www.gyan.dev/ffmpeg/builds/) から full build をダウンロードし、PATH に追加してください。full build には drawtext フィルターが含まれています。

**確認方法:**

```bash
ffmpeg -filters 2>/dev/null | grep drawtext
```

`drawtext` が表示されれば OK です。

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
