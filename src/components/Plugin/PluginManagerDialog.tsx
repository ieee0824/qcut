import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { ask } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';
import { usePluginStore } from '../../store/pluginStore';
import type { PluginManager } from '../../plugin-system/manager';

interface PluginManagerDialogProps {
  manager: PluginManager;
  onClose: () => void;
}

export function PluginManagerDialog({ manager, onClose }: PluginManagerDialogProps) {
  const { t } = useTranslation();
  const plugins = usePluginStore((s) => s.plugins);
  const [importing, setImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleImport = async () => {
    const selected = await open({ directory: true, multiple: false, title: t('plugin.selectDirectory') });
    if (!selected || Array.isArray(selected)) return;

    setImporting(true);
    setErrorMessage(null);
    try {
      let result = await manager.importPlugin(selected, false);
      if (result.conflict) {
        const confirmed = await ask(
          t('plugin.overwriteConfirm', { id: result.pluginId }),
          { title: 'qcut', kind: 'warning' },
        );
        if (!confirmed) {
          setImporting(false);
          return;
        }
        result = await manager.importPlugin(selected, true);
      }
      if (!result.conflict) {
        setErrorMessage(null);
      }
    } catch (e) {
      setErrorMessage(String(e));
    } finally {
      setImporting(false);
    }
  };

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    try {
      await manager.togglePlugin(id, !currentEnabled);
    } catch (e) {
      setErrorMessage(String(e));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await ask(
      t('plugin.deleteConfirm', { name }),
      { title: 'qcut', kind: 'warning' },
    );
    if (!confirmed) return;
    try {
      await manager.deletePlugin(id);
    } catch (e) {
      setErrorMessage(String(e));
    }
  };

  const stateLabel = (state: string) => {
    switch (state) {
      case 'active': return t('plugin.stateActive');
      case 'inactive': return t('plugin.stateInactive');
      case 'error': return t('plugin.stateError');
      default: return state;
    }
  };

  const stateColor = (state: string) => {
    switch (state) {
      case 'active': return '#4caf50';
      case 'error': return '#f44336';
      default: return '#888';
    }
  };

  const pluginEntries = Object.values(plugins);

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: '#1e1e1e',
          border: '1px solid #444',
          borderRadius: '8px',
          width: '600px',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          color: '#e0e0e0',
        }}
      >
        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #333' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{t('plugin.managerTitle')}</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleImport}
              disabled={importing}
              style={{
                padding: '6px 14px',
                backgroundColor: '#4a9eff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: importing ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                opacity: importing ? 0.6 : 1,
              }}
            >
              {importing ? t('plugin.importing') : t('plugin.addPlugin')}
            </button>
            <button
              onClick={onClose}
              style={{ padding: '6px 12px', backgroundColor: '#333', color: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
            >
              {t('plugin.close')}
            </button>
          </div>
        </div>

        {/* エラー表示 */}
        {errorMessage && (
          <div style={{ padding: '10px 20px', backgroundColor: '#3a1a1a', color: '#f44336', fontSize: '13px', borderBottom: '1px solid #333' }}>
            {errorMessage}
          </div>
        )}

        {/* プラグイン一覧 */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {pluginEntries.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
              {t('plugin.noPlugins')}
            </div>
          ) : (
            pluginEntries.map((entry) => (
              <div
                key={entry.manifest.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 20px',
                  borderBottom: '1px solid #2a2a2a',
                  gap: '12px',
                }}
              >
                {/* 有効/無効トグル */}
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={entry.enabled}
                    onChange={() => handleToggle(entry.manifest.id, entry.enabled)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </label>

                {/* プラグイン情報 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{entry.manifest.name}</span>
                    <span style={{ fontSize: '11px', color: '#888' }}>v{entry.manifest.version}</span>
                    <span style={{ fontSize: '11px', color: stateColor(entry.state), backgroundColor: '#2a2a2a', padding: '1px 6px', borderRadius: '3px' }}>
                      {stateLabel(entry.state)}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.manifest.description}
                  </div>
                  {entry.error && (
                    <div style={{ fontSize: '11px', color: '#f44336', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.error}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                    {entry.manifest.author} · {entry.manifest.id}
                  </div>
                </div>

                {/* 削除ボタン */}
                <button
                  onClick={() => handleDelete(entry.manifest.id, entry.manifest.name)}
                  style={{
                    padding: '4px 10px',
                    backgroundColor: '#3a1a1a',
                    color: '#f44336',
                    border: '1px solid #5a2a2a',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    flexShrink: 0,
                  }}
                >
                  {t('plugin.delete')}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
