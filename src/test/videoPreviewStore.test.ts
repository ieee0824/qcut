import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVideoPreviewStore } from '@/store/videoPreviewStore';

describe('videoPreviewStore', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useVideoPreviewStore());
    act(() => {
      result.current.resetPreview();
    });
  });

  it('初期状態を確認', () => {
    const { result } = renderHook(() => useVideoPreviewStore());

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentTime).toBe(0);
    expect(result.current.duration).toBe(0);
    expect(result.current.volume).toBe(100);
    expect(result.current.videoFile).toBeNull();
    expect(result.current.videoUrl).toBeNull();
  });

  it('再生状態を変更', () => {
    const { result } = renderHook(() => useVideoPreviewStore());

    act(() => {
      result.current.setIsPlaying(true);
    });

    expect(result.current.isPlaying).toBe(true);
  });

  it('再生時間を設定', () => {
    const { result } = renderHook(() => useVideoPreviewStore());

    act(() => {
      result.current.setCurrentTime(5.5);
    });

    expect(result.current.currentTime).toBe(5.5);
  });

  it('動画の長さを設定', () => {
    const { result } = renderHook(() => useVideoPreviewStore());

    act(() => {
      result.current.setDuration(120);
    });

    expect(result.current.duration).toBe(120);
  });

  it('音量を設定（範囲チェック）', () => {
    const { result } = renderHook(() => useVideoPreviewStore());

    // 正常な値
    act(() => {
      result.current.setVolume(50);
    });
    expect(result.current.volume).toBe(50);

    // 最大値を超える場合は 100 に制限
    act(() => {
      result.current.setVolume(150);
    });
    expect(result.current.volume).toBe(100);

    // 最小値より小さい場合は 0 に制限
    act(() => {
      result.current.setVolume(-10);
    });
    expect(result.current.volume).toBe(0);
  });

  it('プレビューをリセット', () => {
    const { result } = renderHook(() => useVideoPreviewStore());

    act(() => {
      result.current.setIsPlaying(true);
      result.current.setCurrentTime(50);
      result.current.setDuration(100);
      result.current.resetPreview();
    });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentTime).toBe(0);
    expect(result.current.duration).toBe(0);
    expect(result.current.videoFile).toBeNull();
    expect(result.current.videoUrl).toBeNull();
  });
});
