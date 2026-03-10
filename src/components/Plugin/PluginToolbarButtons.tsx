import { usePluginStore } from '@/store/pluginStore';

export const PluginToolbarButtons: React.FC = () => {
  const buttons = usePluginStore((s) => s.toolbarButtons);

  if (buttons.length === 0) return null;

  return (
    <>
      {buttons.map((btn) => (
        <button
          key={`${btn.pluginId}:${btn.id}`}
          onClick={btn.onClick}
          className="play-btn"
          title={btn.label}
        >
          {btn.icon ?? btn.label}
        </button>
      ))}
    </>
  );
};
