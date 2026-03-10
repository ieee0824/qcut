import { usePluginStore } from '@/store/pluginStore';

export const PluginNotifications: React.FC = () => {
  const notifications = usePluginStore((s) => s.notifications);

  if (notifications.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '16px',
      right: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: 9999,
      pointerEvents: 'none',
    }}>
      {notifications.map((n) => {
        const bgColor = n.type === 'error' ? '#d32f2f' : n.type === 'warning' ? '#f57c00' : '#388e3c';
        return (
          <div key={n.id} style={{
            padding: '8px 16px',
            backgroundColor: bgColor,
            color: '#fff',
            borderRadius: '4px',
            fontSize: '13px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            pointerEvents: 'auto',
            maxWidth: '360px',
            wordBreak: 'break-word',
          }}>
            {n.message}
          </div>
        );
      })}
    </div>
  );
};
