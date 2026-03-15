import type { Clip, TimelineTransition, Track, TransitionType } from '../store/timelineStore';

export interface ResolvedTransitionInfo {
  outgoingClip: Clip;
  incomingClip: Clip;
  outTrackId: string;
  inTrackId: string;
  progress: number;
  transitionType: TransitionType;
  duration: number;
}

function findClipById(tracks: Track[], trackId: string, clipId: string): Clip | null {
  return tracks.find((track) => track.id === trackId)?.clips.find((clip) => clip.id === clipId) ?? null;
}

function findVideoClipAtTime(tracks: Track[], time: number): Clip | null {
  for (const track of tracks) {
    if (track.type !== 'video') continue;
    for (const clip of track.clips) {
      if (time >= clip.startTime && time < clip.startTime + clip.duration) {
        return clip;
      }
    }
  }
  return null;
}

export function findTransitionAtTime(
  tracks: Track[],
  transitions: TimelineTransition[],
  time: number,
  findClipAtTime: (time: number) => Clip | null = (targetTime) => findVideoClipAtTime(tracks, targetTime),
): ResolvedTransitionInfo | null {
  for (const transition of transitions) {
    if (!Number.isFinite(transition.duration) || transition.duration <= 0) {
      continue;
    }

    const incomingClip = findClipById(tracks, transition.inTrackId, transition.inClipId);
    if (!incomingClip) continue;
    const outgoingClip = findClipById(tracks, transition.outTrackId, transition.outClipId);
    if (!outgoingClip) continue;

    const overlapStart = incomingClip.startTime - transition.duration;
    const overlapEnd = incomingClip.startTime;
    if (time < overlapStart || time >= overlapEnd) continue;

    if (time < outgoingClip.startTime || time >= outgoingClip.startTime + outgoingClip.duration) {
      continue;
    }

    const activeClip = findClipAtTime(time);
    if (activeClip && activeClip.id === incomingClip.id && outgoingClip.id === incomingClip.id) {
      continue;
    }

    return {
      outgoingClip,
      incomingClip,
      outTrackId: transition.outTrackId,
      inTrackId: transition.inTrackId,
      progress: (time - overlapStart) / transition.duration,
      transitionType: transition.type,
      duration: transition.duration,
    };
  }

  return null;
}
