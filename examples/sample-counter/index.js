// Sample Counter Plugin
// テスト用: タイムライン情報を表示するツールプラグイン

let ctx = null;
let timeDisposable = null;
let clipDisposable = null;
let displayEl = null;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 30); // 30fps 換算
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(f).padStart(2, '0')}`;
}

function updateDisplay() {
  if (!displayEl || !ctx) return;

  const tracks = ctx.timeline.getTracks();
  const currentTime = ctx.timeline.getCurrentTime();
  const totalClips = tracks.reduce((sum, t) => sum + (t.clips ? t.clips.length : 0), 0);

  displayEl.innerHTML = `
    <div style="padding:8px;color:#ccc;font-family:monospace;font-size:12px;">
      <div style="margin-bottom:4px;font-weight:bold;color:#fff;">Timeline Info</div>
      <div>現在時刻: ${formatTime(currentTime)}</div>
      <div>トラック数: ${tracks.length}</div>
      <div>クリップ数: ${totalClips}</div>
      <hr style="border-color:#555;margin:6px 0;" />
      ${tracks.map((t, i) => `
        <div style="margin-top:2px;">
          Track ${i + 1} (${t.type || 'unknown'}): ${t.clips ? t.clips.length : 0} clips
        </div>
      `).join('')}
    </div>
  `;
}

const plugin = {
  onInit(context) {
    ctx = context;
    ctx.log.info('Sample Counter プラグインを初期化しました');
  },

  onActivate() {
    ctx.log.info('Sample Counter プラグインをアクティブにしました');

    // タイムライン情報パネル
    ctx.ui.registerPanel({
      id: 'counter-panel',
      title: 'Counter',
      location: 'sidebar',
      render(container) {
        displayEl = document.createElement('div');
        container.appendChild(displayEl);
        updateDisplay();
      },
    });

    // 時間変更の監視
    timeDisposable = ctx.timeline.onTimeChange(() => {
      updateDisplay();
    });

    // クリップ変更の監視
    clipDisposable = ctx.timeline.onClipChange((event) => {
      ctx.log.info(`クリップ変更: ${event.type} (track: ${event.trackId}, clip: ${event.clipId})`);
      updateDisplay();
    });

    // ツールバーボタン
    ctx.ui.registerToolbarButton({
      id: 'counter-refresh',
      label: 'Refresh Counter',
      onClick() {
        updateDisplay();
        ctx.ui.showNotification('カウンター更新しました', 'info');
      },
    });
  },

  onDeactivate() {
    if (timeDisposable) {
      timeDisposable.dispose();
      timeDisposable = null;
    }
    if (clipDisposable) {
      clipDisposable.dispose();
      clipDisposable = null;
    }
    displayEl = null;
    ctx.log.info('Sample Counter プラグインを無効にしました');
  },
};

export default plugin;
