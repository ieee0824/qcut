import { useEffect, useRef } from 'react';
import { usePluginStore } from '@/store/pluginStore';
import type { StoredPanelConfig } from '@/store/pluginStore';

interface PluginPanelItemProps {
  config: StoredPanelConfig;
}

const PluginPanelItem: React.FC<PluginPanelItemProps> = ({ config }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const result = config.render(el);
    if (typeof result === 'function') {
      cleanupRef.current = result;
    }
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      if (el) {
        el.innerHTML = '';
      }
    };
  }, [config]);

  return (
    <div style={{
      borderTop: '1px solid #3a3a3a',
      backgroundColor: '#2a2a2a',
    }}>
      <div style={{
        padding: '4px 8px',
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        backgroundColor: '#252525',
      }}>
        {config.title}
      </div>
      <div ref={containerRef} />
    </div>
  );
};

export const PluginSidebarPanels: React.FC = () => {
  const panels = usePluginStore((s) => s.panels);
  const sidebarPanels = panels.filter((p) => p.location === 'sidebar');

  if (sidebarPanels.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
    }}>
      {sidebarPanels.map((panel) => (
        <PluginPanelItem key={`${panel.pluginId}:${panel.id}`} config={panel} />
      ))}
    </div>
  );
};
