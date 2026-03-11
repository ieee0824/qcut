// Sample HEVC Export Format Plugin
// テスト用: H.265/HEVC エクスポートフォーマットを登録するプラグイン

let ctx = null;
let formatDisposable = null;

const HEVC_PROFILE = {
  key: 'hevc',
  label: 'MP4 (H.265/HEVC)',
  ext: 'mp4',
  filterName: 'MP4',
  videoCodec: 'libx265',
  audioCodec: 'aac',
  audioBitrate: '128k',
  videoPreset: 'medium',
};

const plugin = {
  onInit(context) {
    ctx = context;
    ctx.log.info('Sample HEVC プラグインを初期化しました');
  },

  onActivate() {
    ctx.log.info('Sample HEVC プラグインをアクティブにしました');

    formatDisposable = ctx.export.registerFormat(HEVC_PROFILE);
    ctx.log.info(`エクスポートフォーマット "${HEVC_PROFILE.label}" を登録しました`);

    ctx.ui.showNotification(
      `エクスポートフォーマット "${HEVC_PROFILE.label}" が追加されました`,
      'info',
    );
  },

  onDeactivate() {
    if (formatDisposable) {
      formatDisposable.dispose();
      formatDisposable = null;
      ctx.log.info(`エクスポートフォーマット "${HEVC_PROFILE.label}" を解除しました`);
    }
    ctx.log.info('Sample HEVC プラグインを無効にしました');
  },
};

export default plugin;
