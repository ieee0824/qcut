import { describe, expect, it } from 'vitest';
import type { ClipTransition, Track, TimelineTransition } from '../store/timelineStore';
import {
  migrateClipTransitionsToTimeline,
  timelineTransitionsToClipTransitions,
} from '../utils/transitionMigration';

function createVideoTrack(id: string, clips: Track['clips']): Track {
  return {
    id,
    type: 'video',
    name: id,
    clips,
    volume: 1,
    mute: false,
    solo: false,
  };
}

function withLegacyTransition<T extends Track['clips'][number]>(
  clip: T,
  transition: ClipTransition,
): T & { transition: ClipTransition } {
  return { ...clip, transition };
}

describe('transitionMigration', () => {
  it('migrates same-track adjacent clip transitions into timeline transitions', () => {
    const tracks: Track[] = [
      createVideoTrack('video-1', [
        {
          id: 'clip-1',
          name: 'Clip 1',
          startTime: 0,
          duration: 5,
          filePath: 'a.mp4',
          sourceStartTime: 0,
          sourceEndTime: 5,
        },
        withLegacyTransition({
          id: 'clip-2',
          name: 'Clip 2',
          startTime: 5,
          duration: 5,
          filePath: 'b.mp4',
          sourceStartTime: 0,
          sourceEndTime: 5,
        }, { type: 'crossfade', duration: 1 }),
      ]),
    ];

    expect(migrateClipTransitionsToTimeline(tracks)).toEqual([
      {
        id: 'transition-clip-1-clip-2',
        type: 'crossfade',
        duration: 1,
        outTrackId: 'video-1',
        outClipId: 'clip-1',
        inTrackId: 'video-1',
        inClipId: 'clip-2',
      },
    ]);
  });

  it('migrates transitions across multiple tracks', () => {
    const tracks: Track[] = [
      createVideoTrack('video-1', [
        {
          id: 'clip-1',
          name: 'Clip 1',
          startTime: 0,
          duration: 5,
          filePath: 'a.mp4',
          sourceStartTime: 0,
          sourceEndTime: 5,
        },
        withLegacyTransition({
          id: 'clip-2',
          name: 'Clip 2',
          startTime: 5,
          duration: 5,
          filePath: 'b.mp4',
          sourceStartTime: 0,
          sourceEndTime: 5,
        }, { type: 'wipe-left', duration: 0.5 }),
      ]),
      createVideoTrack('video-2', [
        {
          id: 'clip-3',
          name: 'Clip 3',
          startTime: 0,
          duration: 3,
          filePath: 'c.mp4',
          sourceStartTime: 0,
          sourceEndTime: 3,
        },
        withLegacyTransition({
          id: 'clip-4',
          name: 'Clip 4',
          startTime: 3,
          duration: 4,
          filePath: 'd.mp4',
          sourceStartTime: 0,
          sourceEndTime: 4,
        }, { type: 'dissolve', duration: 0.75 }),
      ]),
    ];

    expect(migrateClipTransitionsToTimeline(tracks)).toEqual([
      {
        id: 'transition-clip-1-clip-2',
        type: 'wipe-left',
        duration: 0.5,
        outTrackId: 'video-1',
        outClipId: 'clip-1',
        inTrackId: 'video-1',
        inClipId: 'clip-2',
      },
      {
        id: 'transition-clip-3-clip-4',
        type: 'dissolve',
        duration: 0.75,
        outTrackId: 'video-2',
        outClipId: 'clip-3',
        inTrackId: 'video-2',
        inClipId: 'clip-4',
      },
    ]);
  });

  it('ignores clips without transition and first clips with transition but no previous clip', () => {
    const tracks: Track[] = [
      createVideoTrack('video-1', [
        withLegacyTransition({
          id: 'clip-1',
          name: 'Clip 1',
          startTime: 0,
          duration: 5,
          filePath: 'a.mp4',
          sourceStartTime: 0,
          sourceEndTime: 5,
        }, { type: 'crossfade', duration: 1 }),
        {
          id: 'clip-2',
          name: 'Clip 2',
          startTime: 5,
          duration: 5,
          filePath: 'b.mp4',
          sourceStartTime: 0,
          sourceEndTime: 5,
        },
      ]),
    ];

    expect(migrateClipTransitionsToTimeline(tracks)).toEqual([]);
  });

  it('returns cloned tracks with clip.transition restored for same-track transitions', () => {
    const tracks: Track[] = [
      createVideoTrack('video-1', [
        {
          id: 'clip-1',
          name: 'Clip 1',
          startTime: 0,
          duration: 5,
          filePath: 'a.mp4',
          sourceStartTime: 0,
          sourceEndTime: 5,
        },
        {
          id: 'clip-2',
          name: 'Clip 2',
          startTime: 5,
          duration: 5,
          filePath: 'b.mp4',
          sourceStartTime: 0,
          sourceEndTime: 5,
        },
      ]),
    ];
    const transitions: TimelineTransition[] = [
      {
        id: 'transition-clip-1-clip-2',
        type: 'crossfade',
        duration: 1,
        outTrackId: 'video-1',
        outClipId: 'clip-1',
        inTrackId: 'video-1',
        inClipId: 'clip-2',
      },
    ];

    const migrated = timelineTransitionsToClipTransitions(transitions, tracks);

    expect((migrated[0].clips[0] as { transition?: ClipTransition }).transition).toBeUndefined();
    expect((migrated[0].clips[1] as { transition?: ClipTransition }).transition).toEqual({ type: 'crossfade', duration: 1 });
    expect((tracks[0].clips[1] as { transition?: ClipTransition }).transition).toBeUndefined();
  });

  it('drops cross-track transitions on reverse conversion', () => {
    const tracks: Track[] = [
      createVideoTrack('video-1', [
        {
          id: 'clip-1',
          name: 'Clip 1',
          startTime: 0,
          duration: 5,
          filePath: 'a.mp4',
          sourceStartTime: 0,
          sourceEndTime: 5,
        },
      ]),
      createVideoTrack('video-2', [
        {
          id: 'clip-2',
          name: 'Clip 2',
          startTime: 0,
          duration: 5,
          filePath: 'b.mp4',
          sourceStartTime: 0,
          sourceEndTime: 5,
        },
      ]),
    ];

    const migrated = timelineTransitionsToClipTransitions([
      {
        id: 'transition-cross-track',
        type: 'crossfade',
        duration: 1,
        outTrackId: 'video-1',
        outClipId: 'clip-1',
        inTrackId: 'video-2',
        inClipId: 'clip-2',
      },
    ], tracks);

    expect((migrated[0].clips[0] as { transition?: ClipTransition }).transition).toBeUndefined();
    expect((migrated[1].clips[0] as { transition?: ClipTransition }).transition).toBeUndefined();
  });

  it('handles empty tracks and clips without error', () => {
    expect(migrateClipTransitionsToTimeline([])).toEqual([]);
    expect(timelineTransitionsToClipTransitions([], [])).toEqual([]);
  });
});
