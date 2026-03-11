import type { ExportFormat } from '../../store/exportStore';
import {
  useExportDialog,
  RESOLUTION_OPTIONS,
  FPS_OPTIONS,
  BITRATE_OPTIONS,
} from '../../hooks/useExportDialog';
import './ExportDialog.css';

export const ExportDialog: React.FC = () => {
  const {
    t,
    status,
    progress,
    errorMessage,
    isDialogOpen,
    settings,
    outputPath,
    setSettings,
    resolutionIndex,
    estimatedRemaining,
    formatOptions,
    handleSelectOutput,
    handleStartExport,
    handleCancel,
    handleClose,
    handleResolutionChange,
  } = useExportDialog();

  if (!isDialogOpen) return null;

  return (
    <div className="export-overlay" onClick={handleClose}>
      <div className="export-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="export-dialog-title">{t('export.title')}</h2>

        {/* 設定フォーム */}
        {(status === 'configuring' || status === 'idle') && (
          <div className="export-form">
            <div className="export-field">
              <label>{t('export.format')}</label>
              <select
                value={settings.format}
                onChange={(e) => setSettings({ format: e.target.value as ExportFormat })}
              >
                {formatOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="export-field">
              <label>{t('export.resolution')}</label>
              <select value={resolutionIndex} onChange={handleResolutionChange}>
                {RESOLUTION_OPTIONS.map((opt, i) => (
                  <option key={i} value={i}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="export-field">
              <label>{t('export.bitrate')}</label>
              <select
                value={settings.bitrate}
                onChange={(e) => setSettings({ bitrate: e.target.value })}
              >
                {BITRATE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="export-field">
              <label>{t('export.fps')}</label>
              <select
                value={settings.fps}
                onChange={(e) => setSettings({ fps: Number(e.target.value) })}
              >
                {FPS_OPTIONS.map((fps) => (
                  <option key={fps} value={fps}>
                    {fps} fps
                  </option>
                ))}
              </select>
            </div>

            <div className="export-field">
              <label>{t('export.outputPath')}</label>
              <div className="export-path-row">
                <span className="export-path-display">{outputPath || t('export.noOutputPath')}</span>
                <button className="export-btn-secondary" onClick={handleSelectOutput}>
                  {t('export.selectOutput')}
                </button>
              </div>
            </div>

            <div className="export-actions">
              <button className="export-btn-secondary" onClick={handleClose}>
                {t('export.cancel')}
              </button>
              <button
                className="export-btn-primary"
                onClick={handleStartExport}
                disabled={!outputPath}
              >
                {t('export.start')}
              </button>
            </div>
          </div>
        )}

        {/* プログレス表示 */}
        {status === 'exporting' && (
          <div className="export-progress-section">
            <p className="export-progress-label">{t('export.encoding')}</p>
            <div className="export-progress-bar">
              <div
                className="export-progress-fill"
                style={{ width: `${(progress * 100).toFixed(1)}%` }}
              />
            </div>
            <p className="export-progress-percent">{(progress * 100).toFixed(1)}%</p>
            {estimatedRemaining && (
              <p className="export-progress-remaining">{estimatedRemaining}</p>
            )}
            <div className="export-actions">
              <button className="export-btn-secondary" onClick={handleCancel}>
                {t('export.cancel')}
              </button>
            </div>
          </div>
        )}

        {/* 完了 */}
        {status === 'complete' && (
          <div className="export-result">
            <p className="export-result-success">{t('export.complete')}</p>
            <div className="export-actions">
              <button className="export-btn-primary" onClick={handleClose}>
                {t('export.close')}
              </button>
            </div>
          </div>
        )}

        {/* エラー */}
        {status === 'error' && (
          <div className="export-result">
            <p className="export-result-error">{t('export.error')}</p>
            {errorMessage && <p className="export-error-detail">{errorMessage}</p>}
            <div className="export-actions">
              <button className="export-btn-primary" onClick={handleClose}>
                {t('export.close')}
              </button>
            </div>
          </div>
        )}

        {/* キャンセル済み */}
        {status === 'cancelled' && (
          <div className="export-result">
            <p className="export-result-cancelled">{t('export.cancelled')}</p>
            <div className="export-actions">
              <button className="export-btn-primary" onClick={handleClose}>
                {t('export.close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
