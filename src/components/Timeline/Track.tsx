import { Track as TrackType } from '../../store/timelineStore';
import Clip from './Clip';
import TransitionIndicator from './TransitionIndicator';

interface TrackProps {
  track: TrackType;
}

function Track({ track }: TrackProps) {
  return (
    <div className="timeline-track" data-track-id={track.id} data-track-type={track.type}>
      <div className="timeline-track-content">
        {track.clips.map(clip => (
          <Clip key={clip.id} clip={clip} trackId={track.id} trackType={track.type} />
        ))}
        {track.clips
          .filter(clip => clip.transition)
          .map(clip => (
            <TransitionIndicator
              key={`transition-${clip.id}`}
              transition={clip.transition!}
              clipId={clip.id}
              trackId={track.id}
              clipStartTime={clip.startTime}
            />
          ))}
      </div>
    </div>
  );
}

export default Track;
