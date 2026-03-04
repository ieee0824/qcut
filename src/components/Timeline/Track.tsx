import { Track as TrackType } from '../../store/timelineStore';
import Clip from './Clip';

interface TrackProps {
  track: TrackType;
}

function Track({ track }: TrackProps) {
  return (
    <div className="timeline-track" data-track-id={track.id} data-track-type={track.type}>
      <div className="timeline-track-content">
        {track.clips.map(clip => (
          <Clip key={clip.id} clip={clip} trackId={track.id} />
        ))}
      </div>
    </div>
  );
}

export default Track;
