import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
  ask: vi.fn(),
  message: vi.fn(),
}));

import { useFileOperationsStore } from '../store/fileOperationsStore';
import { useProjectStore } from '../store/projectStore';
import { FileOperations } from '../components/FileOperations/FileOperations';

describe('FileOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFileOperationsStore.setState({
      currentFile: null,
      isLoading: false,
      recentFiles: [],
    });
    useProjectStore.setState({
      recentProjects: [],
      isDirty: false,
      saveStatus: 'idle',
      loadStatus: 'idle',
    });
  });

  it('ファイルメニューボタンが表示される', () => {
    render(<FileOperations />);
    expect(screen.getByText(/ファイル/)).toBeInTheDocument();
  });

  it('メニューボタンクリックでドロップダウンが表示される', () => {
    render(<FileOperations />);
    fireEvent.click(screen.getByText(/ファイル/));
    expect(screen.getByText(/💾\s*保存/)).toBeInTheDocument();
    expect(screen.getByText(/📄\s*名前を付けて保存/)).toBeInTheDocument();
    expect(screen.getByText(/📁\s*プロジェクトを開く/)).toBeInTheDocument();
    expect(screen.getByText(/📂\s*開く/)).toBeInTheDocument();
  });

  it('メニューボタン再クリックでドロップダウンが閉じる', () => {
    render(<FileOperations />);
    const button = screen.getByText(/ファイル/);
    fireEvent.click(button);
    expect(screen.getByText(/📂\s*開く/)).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByText(/📂\s*開く/)).not.toBeInTheDocument();
  });

  it('isLoading=true の場合メニューボタンが無効になる', () => {
    useFileOperationsStore.setState({ isLoading: true });
    render(<FileOperations />);
    expect(screen.getByText(/ファイル/).closest('button')).toBeDisabled();
  });

  it('最近のプロジェクトがある場合にリストが表示される', () => {
    useProjectStore.setState({
      recentProjects: [
        { name: 'TestProject', path: '/tmp/test.qcut', lastOpened: 1000, exists: true },
      ],
    });
    render(<FileOperations />);
    fireEvent.click(screen.getByText(/ファイル/));
    expect(screen.getByText('TestProject')).toBeInTheDocument();
  });

  it('最近のプロジェクトが存在しないファイルの場合は無効表示になる', () => {
    useProjectStore.setState({
      recentProjects: [
        { name: 'Missing', path: '/tmp/missing.qcut', lastOpened: 1000, exists: false },
      ],
    });
    render(<FileOperations />);
    fireEvent.click(screen.getByText(/ファイル/));
    const item = screen.getByText('Missing');
    expect(item.closest('button')).toBeDisabled();
  });

  it('最近のファイルがある場合にリストが表示される', () => {
    useFileOperationsStore.setState({
      recentFiles: [
        { name: 'video.mp4', path: '/tmp/video.mp4', size: 1000, lastModified: 1000 },
      ],
    });
    render(<FileOperations />);
    fireEvent.click(screen.getByText(/ファイル/));
    expect(screen.getByText('video.mp4')).toBeInTheDocument();
  });
});
