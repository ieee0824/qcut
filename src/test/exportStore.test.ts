import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExportStore } from '@/store/exportStore';

describe('exportStore', () => {
  beforeEach(() => {
    act(() => {
      useExportStore.getState().reset();
      useExportStore.setState({
        isDialogOpen: false,
        settings: { format: 'mp4', width: 1920, height: 1080, bitrate: '8M', fps: 30 },
        outputPath: null,
      });
    });
  });

  it('初期状態を確認', () => {
    const { result } = renderHook(() => useExportStore());

    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBe(0);
    expect(result.current.currentTime).toBe(0);
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.outputPath).toBeNull();
    expect(result.current.exportStartedAt).toBeNull();
  });

  it('ステータスを更新', () => {
    const { result } = renderHook(() => useExportStore());

    act(() => {
      result.current.setStatus('exporting');
    });

    expect(result.current.status).toBe('exporting');
    expect(result.current.exportStartedAt).toBeTypeOf('number');
  });

  it('設定を部分更新', () => {
    const { result } = renderHook(() => useExportStore());

    act(() => {
      result.current.setSettings({ width: 1280, height: 720 });
    });

    expect(result.current.settings.width).toBe(1280);
    expect(result.current.settings.height).toBe(720);
    expect(result.current.settings.bitrate).toBe('8M');
    expect(result.current.settings.fps).toBe(30);
  });

  it('進捗を更新', () => {
    const { result } = renderHook(() => useExportStore());

    act(() => {
      result.current.setProgress(0.5, 30.0);
    });

    expect(result.current.progress).toBe(0.5);
    expect(result.current.currentTime).toBe(30.0);
  });

  it('エラーを設定', () => {
    const { result } = renderHook(() => useExportStore());

    act(() => {
      result.current.setError('テストエラー');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe('テストエラー');
  });

  it('ダイアログの開閉', () => {
    const { result } = renderHook(() => useExportStore());

    act(() => {
      result.current.setDialogOpen(true);
    });
    expect(result.current.isDialogOpen).toBe(true);

    act(() => {
      result.current.setDialogOpen(false);
    });
    expect(result.current.isDialogOpen).toBe(false);
  });

  it('出力パスを設定', () => {
    const { result } = renderHook(() => useExportStore());

    act(() => {
      result.current.setOutputPath('/tmp/output.mp4');
    });

    expect(result.current.outputPath).toBe('/tmp/output.mp4');
  });

  it('setStatus に固定タイムスタンプを渡すと決定的に exportStartedAt が設定される', () => {
    const { result } = renderHook(() => useExportStore());

    act(() => {
      result.current.setStatus('exporting', 1700000000000);
    });

    expect(result.current.exportStartedAt).toBe(1700000000000);
  });

  it('setStatus で既に exportStartedAt がある場合は上書きしない', () => {
    const { result } = renderHook(() => useExportStore());

    act(() => {
      result.current.setStatus('exporting', 1000);
    });
    act(() => {
      result.current.setStatus('exporting', 2000);
    });

    expect(result.current.exportStartedAt).toBe(1000);
  });

  it('リセットで初期状態に戻る', () => {
    const { result } = renderHook(() => useExportStore());

    act(() => {
      result.current.setStatus('exporting');
      result.current.setProgress(0.75, 45.0);
      result.current.setOutputPath('/tmp/output.mp4');
      result.current.setError('エラー');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBe(0);
    expect(result.current.currentTime).toBe(0);
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.outputPath).toBeNull();
    expect(result.current.exportStartedAt).toBeNull();
  });
});
