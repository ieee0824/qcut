import { useTranslation } from 'react-i18next';
import { useShortcutStore, formatBinding } from '../../store/shortcutStore';
import './ShortcutHelp.css';

export const ShortcutHelp: React.FC = () => {
  const { t } = useTranslation();
  const { shortcuts, helpVisible, setHelpVisible, resetToDefaults } = useShortcutStore();

  if (!helpVisible) return null;

  // Filter out deleteAlt to avoid duplicate display
  const displayShortcuts = shortcuts.filter(s => s.id !== 'deleteAlt');

  return (
    <div className="shortcut-help-overlay" onClick={() => setHelpVisible(false)}>
      <div className="shortcut-help-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="shortcut-help-header">
          <h2>{t('shortcut.title')}</h2>
          <button className="shortcut-help-close" onClick={() => setHelpVisible(false)}>
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
                  <kbd>{formatBinding(shortcut.binding)}</kbd>
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
