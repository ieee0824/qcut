import type { Clip, Track } from '../../store/timelineStore';

export const CROSS_TRACK_TRANSITION_EPSILON = 0.05;

export interface CrossTrackTransitionCandidate {
  trackId: string;
  trackName: string;
  clipId: string;
  clipName: string;
  startTime: number;
  duration: number;
}

function clipEndTime(clip: Pick<Clip, 'startTime' | 'duration'>): number {
  return clip.startTime + clip.duration;
}

export function canCreateCrossTrackTransition(
  baseTrack: Pick<Track, 'id' | 'type'>,
  baseClip: Pick<Clip, 'id' | 'startTime' | 'duration'>,
  candidateTrack: Pick<Track, 'id' | 'type'>,
  candidateClip: Pick<Clip, 'id' | 'startTime' | 'duration'>,
  epsilon = CROSS_TRACK_TRANSITION_EPSILON,
): boolean {
  if (baseTrack.type !== 'video' || candidateTrack.type !== 'video') {
    return false;
  }

  if (candidateTrack.id === baseTrack.id) {
    return false;
  }

  const baseStart = baseClip.startTime;
  const candidateStart = candidateClip.startTime;
  const candidateEnd = clipEndTime(candidateClip);

  return candidateStart <= baseStart + epsilon && candidateEnd >= baseStart - epsilon;
}

export function listCrossTrackTransitionCandidates(
  tracks: Track[],
  baseTrackId: string,
  baseClipId: string,
  epsilon = CROSS_TRACK_TRANSITION_EPSILON,
): CrossTrackTransitionCandidate[] {
  const baseTrack = tracks.find((track) => track.id === baseTrackId);
  const baseClip = baseTrack?.clips.find((clip) => clip.id === baseClipId);

  if (!baseTrack || !baseClip || baseTrack.type !== 'video') {
    return [];
  }

  return tracks
    .filter((track) => track.id !== baseTrackId && track.type === 'video')
    .flatMap((track) =>
      track.clips
        .filter((clip) => canCreateCrossTrackTransition(baseTrack, baseClip, track, clip, epsilon))
        .map((clip) => ({
          trackId: track.id,
          trackName: track.name,
          clipId: clip.id,
          clipName: clip.name,
          startTime: clip.startTime,
          duration: clip.duration,
        })),
    )
    .sort((a, b) => {
      const aDistance = Math.abs((a.startTime + a.duration) - baseClip.startTime);
      const bDistance = Math.abs((b.startTime + b.duration) - baseClip.startTime);
      if (aDistance !== bDistance) {
        return aDistance - bDistance;
      }
      if (a.startTime !== b.startTime) {
        return a.startTime - b.startTime;
      }
      return a.trackName.localeCompare(b.trackName);
    });
}
