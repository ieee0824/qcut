import { useMemo } from 'react';
import { Track as TrackType, useTimelineStore } from '../../store/timelineStore';
import Clip from './Clip';
import TransitionIndicator from './TransitionIndicator';

interface OverlapRegion {
  start: number;
  end: number;
}

function computeOverlaps(clips: { startTime: number; duration: number }[]): OverlapRegion[] {
  const regions: OverlapRegion[] = [];
  for (let i = 0; i < clips.length; i++) {
    for (let j = i + 1; j < clips.length; j++) {
      const aStart = clips[i].startTime;
      const aEnd = aStart + clips[i].duration;
      const bStart = clips[j].startTime;
      const bEnd = bStart + clips[j].duration;
      const overlapStart = Math.max(aStart, bStart);
      const overlapEnd = Math.min(aEnd, bEnd);
      if (overlapStart < overlapEnd) {
        regions.push({ start: overlapStart, end: overlapEnd });
      }
    }
  }
  return regions;
}

interface TrackProps {
  track: TrackType;
}

function Track({ track }: TrackProps) {
  const pixelsPerSecond = useTimelineStore((s) => s.pixelsPerSecond);
  const allTransitions = useTimelineStore((s) => s.transitions);
  const transitions = useMemo(
    () => allTransitions.filter((transition) => transition.inTrackId === track.id),
    [allTransitions, track.id],
  );
  const overlaps = useMemo(() => computeOverlaps(track.clips), [track.clips]);

  return (
    <div className="timeline-track" data-track-id={track.id} data-track-type={track.type}>
      <div className="timeline-track-content">
        {track.clips.map(clip => (
          <Clip key={clip.id} clip={clip} trackId={track.id} trackType={track.type} />
        ))}
        {overlaps.map((region, i) => (
          <div
            key={`overlap-${i}`}
            className="timeline-overlap"
            style={{
              left: `${region.start * pixelsPerSecond}px`,
              width: `${(region.end - region.start) * pixelsPerSecond}px`,
            }}
          />
        ))}
        {transitions
          .map((transition) => {
            const incomingClip = track.clips.find((clip) => clip.id === transition.inClipId);
            if (!incomingClip) return null;
            return (
            <TransitionIndicator
              key={`transition-${transition.id}`}
              transition={transition}
              incomingClip={incomingClip}
            />
            );
          })}
      </div>
    </div>
  );
}

export default Track;
