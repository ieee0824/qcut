import type { ClipTransition, Track, TimelineTransition } from '../store/timelineStore';

type LegacyClip = Track['clips'][number] & { transition?: ClipTransition };
type LegacyTrack = Omit<Track, 'clips'> & { clips: LegacyClip[] };

function cloneTracks(tracks: Track[]): Track[] {
  return tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => ({ ...clip })),
  }));
}

function createTransitionId(outClipId: string, inClipId: string): string {
  return `transition-${outClipId}-${inClipId}`;
}

function sortClipsByStartTime(clips: LegacyClip[]): LegacyClip[] {
  return [...clips].sort((a, b) => a.startTime - b.startTime);
}

export function migrateClipTransitionsToTimeline(tracks: Track[]): TimelineTransition[] {
  const transitions: TimelineTransition[] = [];

  for (const track of tracks as LegacyTrack[]) {
    const sortedClips = sortClipsByStartTime(track.clips);

    for (let i = 0; i < sortedClips.length; i += 1) {
      const incomingClip = sortedClips[i];
      if (!incomingClip.transition || i === 0) {
        continue;
      }

      const outgoingClip = sortedClips[i - 1];
      transitions.push({
        id: createTransitionId(outgoingClip.id, incomingClip.id),
        type: incomingClip.transition.type,
        duration: incomingClip.transition.duration,
        outTrackId: track.id,
        outClipId: outgoingClip.id,
        inTrackId: track.id,
        inClipId: incomingClip.id,
      });
    }
  }

  return transitions;
}

export function timelineTransitionsToClipTransitions(
  transitions: TimelineTransition[],
  tracks: Track[],
): Track[] {
  const clonedTracks = cloneTracks(tracks) as LegacyTrack[];

  for (const transition of transitions) {
    if (transition.outTrackId !== transition.inTrackId) {
      continue;
    }

    const track = clonedTracks.find((candidate) => candidate.id === transition.inTrackId);
    if (!track) {
      continue;
    }

    const incomingClip = track.clips.find((clip) => clip.id === transition.inClipId);
    if (!incomingClip) {
      continue;
    }

    incomingClip.transition = { type: transition.type, duration: transition.duration };
  }

  return clonedTracks;
}
