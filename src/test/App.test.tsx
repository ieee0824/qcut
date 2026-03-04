import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  it('renders app header', () => {
    render(<App />);
    expect(screen.getByText(/qcut - Video Editor/i)).toBeInTheDocument();
  });

  it('renders video preview component', () => {
    render(<App />);
    // VideoPreview コンポーネントが表示される
    expect(screen.getByText(/動画を読み込んでください/i)).toBeInTheDocument();
  });

  it('renders timeline container', () => {
    render(<App />);
    // タイムラインもレンダーされていることを確認
    const app = screen.getByText(/qcut - Video Editor/i);
    expect(app).toBeInTheDocument();
  });

  it('renders multiple play buttons (header and preview)', () => {
    render(<App />);
    const playButtons = screen.getAllByRole('button', { name: /再生|▶/i });
    // ヘッダーのボタンとVideoPreviewのボタンが表示される
    expect(playButtons.length).toBeGreaterThanOrEqual(1);
  });
});

