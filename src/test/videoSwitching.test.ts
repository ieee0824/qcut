import { describe, expect, it, vi, afterEach } from 'vitest';
import { waitForFirstRenderableFrame } from '../components/VideoPreview/useVideoSwitching';

type TestVideoFrameRequestCallback = (now: number, metadata: object) => void;
type TestFrameRequestCallback = (time: number) => void;

describe('waitForFirstRenderableFrame', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('waits for requestVideoFrameCallback when available', () => {
    const video = document.createElement('video') as HTMLVideoElement & {
      requestVideoFrameCallback: (cb: TestVideoFrameRequestCallback) => number;
      cancelVideoFrameCallback: (id: number) => void;
    };
    Object.defineProperty(video, 'paused', { configurable: true, value: false });
    Object.defineProperty(video, 'readyState', { configurable: true, value: 3 });

    let frameCallback: TestVideoFrameRequestCallback | null = null;
    video.requestVideoFrameCallback = vi.fn((cb) => {
      frameCallback = cb;
      return 7;
    });
    video.cancelVideoFrameCallback = vi.fn();

    const onReady = vi.fn();
    waitForFirstRenderableFrame(video, onReady);

    expect(onReady).not.toHaveBeenCalled();
    expect(video.requestVideoFrameCallback).toHaveBeenCalledTimes(1);

    frameCallback?.(0, {});

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(7);
  });

  it('falls back to requestAnimationFrame when requestVideoFrameCallback is unavailable', () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'paused', { configurable: true, value: false });
    Object.defineProperty(video, 'readyState', { configurable: true, value: 3 });

    let rafCallback: TestFrameRequestCallback | null = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: TestFrameRequestCallback) => {
      rafCallback = cb;
      return 11;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    const onReady = vi.fn();
    waitForFirstRenderableFrame(video, onReady);

    expect(onReady).not.toHaveBeenCalled();
    rafCallback?.(16);

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(11);
  });
});
