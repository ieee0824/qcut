import { describe, expect, it } from 'vitest';
import type { Track } from '@/store/timelineStore';
import {
  canCreateCrossTrackTransition,
  listCrossTrackTransitionCandidates,
} from '@/components/Timeline/crossTrackTransitionUtils';

function makeTrack(overrides: Partial<Track>): Track {
  return {
    id: 'track',
    type: 'video',
    name: 'Track',
    clips: [],
    volume: 1,
    mute: false,
    solo: false,
    ...overrides,
  };
}

describe('crossTrackTransitionUtils', () => {
  it('他トラックの重なり/隣接クリップ候補を列挙する', () => {
    const tracks: Track[] = [
      makeTrack({
        id: 'video-1',
        name: 'Video 1',
        clips: [
          { id: 'clip-1', name: 'Clip 1', startTime: 0, duration: 5, filePath: 'a.mp4', sourceStartTime: 0, sourceEndTime: 5 },
          { id: 'clip-2', name: 'Clip 2', startTime: 5, duration: 5, filePath: 'b.mp4', sourceStartTime: 0, sourceEndTime: 5 },
        ],
      }),
      makeTrack({
        id: 'video-2',
        name: 'Video 2',
        clips: [
          { id: 'clip-a', name: 'Clip A', startTime: 2, duration: 3, filePath: 'c.mp4', sourceStartTime: 0, sourceEndTime: 3 },
          { id: 'clip-b', name: 'Clip B', startTime: 4, duration: 1, filePath: 'd.mp4', sourceStartTime: 0, sourceEndTime: 1 },
        ],
      }),
    ];

    const candidates = listCrossTrackTransitionCandidates(tracks, 'video-1', 'clip-2');

    expect(candidates.map((candidate) => candidate.clipId)).toEqual(['clip-a', 'clip-b']);
  });

  it('時間的に重なりも隣接もないクリップは候補に含めない', () => {
    const tracks: Track[] = [
      makeTrack({
        id: 'video-1',
        name: 'Video 1',
        clips: [
          { id: 'clip-2', name: 'Clip 2', startTime: 5, duration: 5, filePath: 'b.mp4', sourceStartTime: 0, sourceEndTime: 5 },
        ],
      }),
      makeTrack({
        id: 'video-2',
        name: 'Video 2',
        clips: [
          { id: 'clip-c', name: 'Clip C', startTime: 6, duration: 2, filePath: 'e.mp4', sourceStartTime: 0, sourceEndTime: 2 },
        ],
      }),
    ];

    expect(listCrossTrackTransitionCandidates(tracks, 'video-1', 'clip-2')).toEqual([]);
  });

  it('audio トラックへの適用を禁止する', () => {
    const allowed = canCreateCrossTrackTransition(
      makeTrack({ id: 'video-1', type: 'video' }),
      { id: 'clip-2', startTime: 5, duration: 5 },
      makeTrack({ id: 'audio-1', type: 'audio' }),
      { id: 'clip-a', startTime: 0, duration: 5 },
    );

    expect(allowed).toBe(false);
  });
});
