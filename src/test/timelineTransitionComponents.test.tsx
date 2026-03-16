import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve(undefined)),
}));

import Track from '@/components/Timeline/Track';
import { ClipContextMenu } from '@/components/Timeline/ClipContextMenu';
import { computeIndicatorLayout } from '@/components/Timeline/transitionLayout';
import { useTimelineStore } from '@/store/timelineStore';
import { useTransitionPresetStore } from '@/store/transitionPresetStore';

describe('TimelineTransition UI components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTimelineStore.setState({
      tracks: [],
      transitions: [],
      selectedClipId: null,
      selectedTrackId: null,
      currentTime: 0,
      isPlaying: false,
      pixelsPerSecond: 50,
    });
    useTransitionPresetStore.setState({
      customPresets: [],
      loaded: true,
    });

    const { addTrack, addClip } = useTimelineStore.getState();
    addTrack({ id: 'video-1', type: 'video', name: 'Video 1', clips: [] });
    addClip('video-1', {
      id: 'clip-1',
      name: 'Clip 1',
      startTime: 0,
      duration: 5,
      filePath: 'a.mp4',
      sourceStartTime: 0,
      sourceEndTime: 5,
    });
    addClip('video-1', {
      id: 'clip-2',
      name: 'Clip 2',
      startTime: 5,
      duration: 5,
      filePath: 'b.mp4',
      sourceStartTime: 0,
      sourceEndTime: 5,
    });
  });

  it('computeIndicatorLayout は TimelineTransition とクリップ情報から位置を計算する', () => {
    const { width, left } = computeIndicatorLayout(
      {
        id: 'transition-clip-1-clip-2',
        type: 'crossfade',
        duration: 1,
        outTrackId: 'video-1',
        outClipId: 'clip-1',
        inTrackId: 'video-1',
        inClipId: 'clip-2',
      },
      50,
      { startTime: 5 },
    );

    expect(width).toBe(50);
    expect(left).toBe(225);
  });

  it('Track は TimelineTransition からインジケーターを表示し、クリックでポップオーバーを開く', () => {
    useTimelineStore.getState().addTransition({
      id: 'transition-clip-1-clip-2',
      type: 'crossfade',
      duration: 1,
      outTrackId: 'video-1',
      outClipId: 'clip-1',
      inTrackId: 'video-1',
      inClipId: 'clip-2',
    });

    const track = useTimelineStore.getState().tracks.find((candidate) => candidate.id === 'video-1');
    render(<Track track={track!} />);

    const indicator = document.querySelector('.transition-indicator') as HTMLElement;
    expect(indicator).not.toBeNull();
    expect(indicator.style.left).toBe('225px');
    expect(indicator.style.width).toBe('50px');

    fireEvent.click(indicator);

    expect(screen.getByText('時間')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
  });

  it('TransitionPopover でタイプ変更すると updateTransition が反映される', () => {
    useTimelineStore.getState().addTransition({
      id: 'transition-clip-1-clip-2',
      type: 'crossfade',
      duration: 1,
      outTrackId: 'video-1',
      outClipId: 'clip-1',
      inTrackId: 'video-1',
      inClipId: 'clip-2',
    });

    const track = useTimelineStore.getState().tracks.find((candidate) => candidate.id === 'video-1');
    render(<Track track={track!} />);

    fireEvent.click(document.querySelector('.transition-indicator') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'ディゾルブ' }));

    expect(useTimelineStore.getState().transitions[0].type).toBe('dissolve');
  });

  it('TransitionMenu から削除すると removeTransitionById が反映される', () => {
    useTimelineStore.getState().addTransition({
      id: 'transition-clip-1-clip-2',
      type: 'crossfade',
      duration: 1,
      outTrackId: 'video-1',
      outClipId: 'clip-1',
      inTrackId: 'video-1',
      inClipId: 'clip-2',
    });

    const track = useTimelineStore.getState().tracks.find((candidate) => candidate.id === 'video-1');
    render(<Track track={track!} />);

    fireEvent.contextMenu(document.querySelector('.transition-indicator') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: /トランジション削除/ }));

    expect(useTimelineStore.getState().transitions).toEqual([]);
  });

  it('ClipContextMenu から追加すると addTransition が反映される', () => {
    const clip = useTimelineStore.getState().tracks[0].clips.find((candidate) => candidate.id === 'clip-2');
    render(
      <ClipContextMenu
        clip={clip!}
        trackId="video-1"
        trackType="video"
        position={{ x: 100, y: 100 }}
        onClose={() => {}}
      />,
    );

    fireEvent.mouseEnter(screen.getByText(/トランジション追加/));
    fireEvent.click(screen.getByRole('button', { name: '標準クロスフェード (1.0s)' }));

    expect(useTimelineStore.getState().transitions[0]).toMatchObject({
      type: 'crossfade',
      outClipId: 'clip-1',
      inClipId: 'clip-2',
    });
  });

  it('ClipContextMenu から削除すると removeTransitionById が反映される', () => {
    useTimelineStore.getState().addTransition({
      id: 'transition-clip-1-clip-2',
      type: 'crossfade',
      duration: 1,
      outTrackId: 'video-1',
      outClipId: 'clip-1',
      inTrackId: 'video-1',
      inClipId: 'clip-2',
    });

    const clip = useTimelineStore.getState().tracks[0].clips.find((candidate) => candidate.id === 'clip-2');
    render(
      <ClipContextMenu
        clip={clip!}
        trackId="video-1"
        trackType="video"
        position={{ x: 100, y: 100 }}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /トランジション削除/ }));

    expect(useTimelineStore.getState().transitions).toEqual([]);
  });
});
