import { useTimelineStore } from '../../store/timelineStore';

function Playhead() {
  const { currentTime, pixelsPerSecond } = useTimelineStore();
  const left = currentTime * pixelsPerSecond;

  return (
    <>
      <div 
        className="timeline-playhead" 
        style={{ left: `${left}px` }}
      >
        <div className="playhead-head"></div>
        <div className="playhead-line"></div>
      </div>
    </>
  );
}

export default Playhead;
