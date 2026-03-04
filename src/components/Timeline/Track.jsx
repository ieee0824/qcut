import { useTimelineStore } from '../../store/timelineStore';
import Clip from './Clip';

function Track({ track }) {
  const { pixelsPerSecond } = useTimelineStore();

  return (
    <div className="timeline-track" data-track-id={track.id}>
      <div className="timeline-track-content">
        {track.clips.map(clip => (
          <Clip key={clip.id} clip={clip} trackId={track.id} />
        ))}
      </div>
    </div>
  );
}

export default Track;
