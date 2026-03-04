import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  it('renders app header', () => {
    render(<App />);
    expect(screen.getByText(/qcut - Video Editor/i)).toBeInTheDocument();
  });

  it('renders preview container', () => {
    render(<App />);
    expect(screen.getByText(/プレビューエリア/i)).toBeInTheDocument();
  });

  it('renders play button', () => {
    render(<App />);
    const playButton = screen.getByRole('button', { name: /▶/i });
    expect(playButton).toBeInTheDocument();
  });
});
