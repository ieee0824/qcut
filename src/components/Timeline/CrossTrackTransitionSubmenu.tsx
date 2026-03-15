import { useEffect, useRef, useState } from 'react';
import type { CrossTrackTransitionCandidate } from './crossTrackTransitionUtils';

interface CrossTrackTransitionSubmenuProps {
  candidates: CrossTrackTransitionCandidate[];
  onSelectCandidate: (candidate: CrossTrackTransitionCandidate) => void;
}

export function CrossTrackTransitionSubmenu({
  candidates,
  onSelectCandidate,
}: CrossTrackTransitionSubmenuProps) {
  const submenuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  useEffect(() => {
    if (!submenuRef.current) return;
    const rect = submenuRef.current.getBoundingClientRect();
    const newStyle: React.CSSProperties = { visibility: 'visible' };

    if (rect.bottom > window.innerHeight) {
      const overflow = rect.bottom - window.innerHeight;
      newStyle.top = `${-overflow}px`;
    } else {
      newStyle.top = '0';
    }

    if (rect.right > window.innerWidth) {
      newStyle.left = 'auto';
      newStyle.right = '100%';
    } else {
      newStyle.left = '100%';
      newStyle.right = 'auto';
    }

    setStyle(newStyle);
  }, []);

  return (
    <div ref={submenuRef} className="context-submenu" style={style}>
      {candidates.length > 0 ? candidates.map((candidate) => (
        <button
          key={`${candidate.trackId}-${candidate.clipId}`}
          className="context-menu-item"
          onClick={(e) => {
            e.stopPropagation();
            onSelectCandidate(candidate);
          }}
        >
          {candidate.trackName} / {candidate.clipName}
        </button>
      )) : (
        <button className="context-menu-item" disabled>
          候補なし
        </button>
      )}
    </div>
  );
}
