import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileOperationsStore, FileInfo } from '@/store/fileOperationsStore';

const mockFile: FileInfo = {
  name: 'sample.mp4',
  path: '/videos/sample.mp4',
  size: 1024 * 1024 * 100, // 100MB
  lastModified: Date.now(),
};

const mockFile2: FileInfo = {
  name: 'another.mp4',
  path: '/videos/another.mp4',
  size: 1024 * 1024 * 200, // 200MB
  lastModified: Date.now(),
};

describe('fileOperationsStore', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useFileOperationsStore());
    act(() => {
      result.current.clearRecentFiles();
    });
  });

  it('初期状態を確認', () => {
    const { result } = renderHook(() => useFileOperationsStore());

    expect(result.current.currentFile).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.recentFiles).toHaveLength(0);
  });

  it('現在のファイルを設定', () => {
    const { result } = renderHook(() => useFileOperationsStore());

    act(() => {
      result.current.setCurrentFile(mockFile);
    });

    expect(result.current.currentFile).toEqual(mockFile);
  });

  it('読み込み状態を設定', () => {
    const { result } = renderHook(() => useFileOperationsStore());

    act(() => {
      result.current.setIsLoading(true);
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('最近のファイルを追加', () => {
    const { result } = renderHook(() => useFileOperationsStore());

    act(() => {
      result.current.addRecentFile(mockFile);
    });

    expect(result.current.recentFiles).toHaveLength(1);
    expect(result.current.recentFiles[0]).toEqual(mockFile);
  });

  it('複数のファイルを追加し、新しいファイルが先頭になる', () => {
    const { result } = renderHook(() => useFileOperationsStore());

    act(() => {
      result.current.addRecentFile(mockFile);
      result.current.addRecentFile(mockFile2);
    });

    expect(result.current.recentFiles).toHaveLength(2);
    expect(result.current.recentFiles[0]).toEqual(mockFile2); // 新しいファイルが先頭
    expect(result.current.recentFiles[1]).toEqual(mockFile);
  });

  it('同じファイルを追加した場合、重複を削除して先頭に移動', () => {
    const { result } = renderHook(() => useFileOperationsStore());

    act(() => {
      result.current.addRecentFile(mockFile);
      result.current.addRecentFile(mockFile2);
      result.current.addRecentFile(mockFile); // mockFile を再度追加
    });

    expect(result.current.recentFiles).toHaveLength(2);
    expect(result.current.recentFiles[0]).toEqual(mockFile); // mockFile が先頭に
    expect(result.current.recentFiles[1]).toEqual(mockFile2);
  });

  it('最近のファイルは最大 10 件まで保持', () => {
    const { result } = renderHook(() => useFileOperationsStore());

    act(() => {
      for (let i = 0; i < 15; i++) {
        const file: FileInfo = {
          name: `file${i}.mp4`,
          path: `/videos/file${i}.mp4`,
          size: 1024,
          lastModified: Date.now() + i,
        };
        result.current.addRecentFile(file);
      }
    });

    expect(result.current.recentFiles).toHaveLength(10);
  });

  it('特定のファイルを削除', () => {
    const { result } = renderHook(() => useFileOperationsStore());

    act(() => {
      result.current.addRecentFile(mockFile);
      result.current.addRecentFile(mockFile2);
    });

    expect(result.current.recentFiles).toHaveLength(2);

    act(() => {
      result.current.removeRecentFile(mockFile.path);
    });

    expect(result.current.recentFiles).toHaveLength(1);
    expect(result.current.recentFiles[0]).toEqual(mockFile2);
  });

  it('すべての最近のファイルをクリア', () => {
    const { result } = renderHook(() => useFileOperationsStore());

    act(() => {
      result.current.addRecentFile(mockFile);
      result.current.addRecentFile(mockFile2);
    });

    expect(result.current.recentFiles).toHaveLength(2);

    act(() => {
      result.current.clearRecentFiles();
    });

    expect(result.current.recentFiles).toHaveLength(0);
  });
});
