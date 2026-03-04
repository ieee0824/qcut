import { useRef, useEffect } from 'react';
import { useTimelineStore } from '../../store/timelineStore';

function Playhead() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // React ツリー外で DOM を直接更新し、再レンダーを回避
    const unsubscribe = useTimelineStore.subscribe((state) => {
      if (ref.current) {
        const left = state.currentTime * state.pixelsPerSecond;
        ref.current.style.transform = `translateX(${left}px)`;
      }
    });

    // 初期位置を設定
    const { currentTime, pixelsPerSecond } = useTimelineStore.getState();
    if (ref.current) {
      ref.current.style.transform = `translateX(${currentTime * pixelsPerSecond}px)`;
    }

    return unsubscribe;
  }, []);

  return (
    <div
      ref={ref}
      className="timeline-playhead"
      style={{ left: 0, willChange: 'transform' }}
    >
      <div className="playhead-head"></div>
      <div className="playhead-line"></div>
    </div>
  );
}

export default Playhead;
