// Sample Permission Error Plugin
// テスト用: export:write 権限なしで ctx.export.registerFormat() を呼び、
// PluginPermissionError が発生することを確認するためのプラグイン
//
// このプラグインは plugin.json に export:write 権限が含まれていない。
// onActivate() で registerFormat() を呼ぶと PluginPermissionError がスローされ、
// PluginManager の safeCall によって捕捉され、プラグインは "error" 状態になる。

let ctx = null;

const plugin = {
  onInit(context) {
    ctx = context;
    ctx.log.info('Permission Error テストプラグインを初期化しました');
  },

  onActivate() {
    ctx.log.info('export:write 権限なしで registerFormat() を呼び出します...');

    // export:write が permissions にないため PluginPermissionError がスローされる
    ctx.export.registerFormat({
      key: 'test-no-permission',
      label: 'Test (No Permission)',
      ext: 'mp4',
      filterName: 'MP4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
      audioBitrate: '128k',
    });

    // ここには到達しない
    ctx.log.info('この行は実行されません');
  },

  onDeactivate() {
    ctx.log.info('Permission Error テストプラグインを無効にしました');
  },
};

export default plugin;
