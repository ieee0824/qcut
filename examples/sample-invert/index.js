// Sample Invert Plugin
// テスト用: 色を反転するフィルタープラグイン（設定API使用例付き）

let ctx = null;
let frameDisposable = null;

const plugin = {
  onInit(context) {
    ctx = context;
    ctx.log.info('Sample Invert プラグインを初期化しました');
  },

  onActivate() {
    ctx.log.info('Sample Invert プラグインをアクティブにしました');

    const intensity = ctx.settings.get('intensity', 1.0);
    ctx.log.info(`反転強度: ${intensity}`);

    // フレーム処理: 色反転
    frameDisposable = ctx.preview.onFrameRender((frame) => {
      const currentIntensity = ctx.settings.get('intensity', 1.0);
      const data = frame.data;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = data[i] + (255 - 2 * data[i]) * currentIntensity;         // R
        data[i + 1] = data[i + 1] + (255 - 2 * data[i + 1]) * currentIntensity; // G
        data[i + 2] = data[i + 2] + (255 - 2 * data[i + 2]) * currentIntensity; // B
      }
      return frame;
    });

    // 設定UIパネル
    ctx.ui.registerPanel({
      id: 'invert-settings',
      title: 'Invert Settings',
      location: 'sidebar',
      render(container) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'padding:8px;color:#ccc;';

        const label = document.createElement('label');
        label.textContent = '反転強度: ';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '100';
        slider.value = String(ctx.settings.get('intensity', 1.0) * 100);
        slider.addEventListener('input', () => {
          ctx.settings.set('intensity', Number(slider.value) / 100);
        });

        wrapper.appendChild(label);
        wrapper.appendChild(slider);
        container.appendChild(wrapper);
      },
    });
  },

  onDeactivate() {
    if (frameDisposable) {
      frameDisposable.dispose();
      frameDisposable = null;
    }
    ctx.log.info('Sample Invert プラグインを無効にしました');
  },
};

export default plugin;
