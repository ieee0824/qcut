import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useShortcutStore, formatBinding, type ShortcutBinding } from '../../store/shortcutStore';

import './ShortcutHelp.css';

export const ShortcutHelp: React.FC = () => {
  const { t } = useTranslation();
  const { shortcuts, helpVisible, setHelpVisible, resetToDefaults, updateBinding } = useShortcutStore();
  const [recordingId, setRecordingId] = useState<string | null>(null);

  // Filter out deleteAlt to avoid duplicate display
  const displayShortcuts = shortcuts.filter(s => s.id !== 'deleteAlt');

  const startRecording = useCallback((id: string) => {
    setRecordingId(id);
  }, []);

  const stopRecording = useCallback(() => {
    setRecordingId(null);
  }, []);

  useEffect(() => {
    if (!recordingId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();

      if (e.key === 'Escape') {
        stopRecording();
        return;
      }

      // Ignore lone modifier keys
      if (['Control', 'Meta', 'Shift', 'Alt'].includes(e.key)) return;

      const binding: ShortcutBinding = {
        key: e.key,
        ctrlOrMeta: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
        alt: e.altKey,
      };

      updateBinding(recordingId, binding);
      stopRecording();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [recordingId, updateBinding, stopRecording]);

  if (!helpVisible) return null;

  return (
    <div className="shortcut-help-overlay" onClick={() => { stopRecording(); setHelpVisible(false); }}>
      <div className="shortcut-help-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="shortcut-help-header">
          <h2>{t('shortcut.title')}</h2>
          <button className="shortcut-help-close" onClick={() => { stopRecording(); setHelpVisible(false); }}>
            &times;
          </button>
        </div>
        <table className="shortcut-help-table">
          <thead>
            <tr>
              <th>{t('shortcut.action')}</th>
              <th>{t('shortcut.key')}</th>
            </tr>
          </thead>
          <tbody>
            {displayShortcuts.map((shortcut) => (
              <tr key={shortcut.id}>
                <td>{t(shortcut.label)}</td>
                <td>
                  {recordingId === shortcut.id ? (
                    <kbd
                      className="shortcut-recording"
                      onClick={() => stopRecording()}
                    >
                      {t('shortcut.pressKey')}
                    </kbd>
                  ) : (
                    <kbd
                      className="shortcut-editable"
                      title={t('shortcut.clickToEdit')}
                      onClick={() => startRecording(shortcut.id)}
                    >
                      {formatBinding(shortcut.binding)}
                    </kbd>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="shortcut-help-footer">
          <button onClick={resetToDefaults} className="shortcut-help-reset">
            {t('shortcut.reset')}
          </button>
        </div>
      </div>
    </div>
  );
};
