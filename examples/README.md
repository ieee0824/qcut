# サンプルプラグイン

プラグインシステムの動作検証用サンプルプラグイン。

## 使い方

プラグインディレクトリにコピーして使用する:

```bash
# macOS
cp -r examples/sample-grayscale ~/Library/Application\ Support/moe.qcut.app/plugins/
cp -r examples/sample-invert ~/Library/Application\ Support/moe.qcut.app/plugins/
cp -r examples/sample-counter ~/Library/Application\ Support/moe.qcut.app/plugins/
```

## プラグイン一覧

| プラグイン | タイプ | カテゴリ | 説明 |
|-----------|--------|---------|------|
| sample-grayscale | typescript | effect | グレースケール変換エフェクト |
| sample-invert | typescript | filter | 色反転フィルター |
| sample-counter | typescript | tool | フレーム数カウンターパネル |
