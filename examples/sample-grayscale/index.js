// Sample Grayscale Plugin
// テスト用: フレームをグレースケールに変換するエフェクトプラグイン

let ctx = null;
let frameDisposable = null;

const plugin = {
  onInit(context) {
    ctx = context;
    ctx.log.info('Sample Grayscale プラグインを初期化しました');
  },

  onActivate() {
    ctx.log.info('Sample Grayscale プラグインをアクティブにしました');

    // フレーム処理コールバックを登録
    frameDisposable = ctx.preview.onFrameRender((frame) => {
      const data = frame.data;
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = gray;     // R
        data[i + 1] = gray; // G
        data[i + 2] = gray; // B
        // A はそのまま
      }
      return frame;
    });

    // UIパネルを登録
    ctx.ui.registerPanel({
      id: 'grayscale-panel',
      title: 'Grayscale',
      location: 'sidebar',
      render(container) {
        container.innerHTML = '<p style="padding:8px;color:#ccc;">グレースケールエフェクト有効</p>';
      },
    });
  },

  onDeactivate() {
    if (frameDisposable) {
      frameDisposable.dispose();
      frameDisposable = null;
    }
    ctx.log.info('Sample Grayscale プラグインを無効にしました');
  },
};

export default plugin;
