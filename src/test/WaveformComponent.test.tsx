import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { WaveformMonitor } from '../components/Scopes/WaveformMonitor';
import type { WaveformData } from '../utils/scopeAnalysis';

describe('WaveformMonitor component', () => {
  it('should render canvas element', () => {
    const { container } = render(<WaveformMonitor data={null} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });

  it('should render with default dimensions', () => {
    const { container } = render(<WaveformMonitor data={null} />);
    const canvas = container.querySelector('canvas');
    expect(canvas?.getAttribute('width')).toBe('196');
    expect(canvas?.getAttribute('height')).toBe('128');
  });

  it('should render with custom dimensions', () => {
    const { container } = render(<WaveformMonitor data={null} width={256} height={200} />);
    const canvas = container.querySelector('canvas');
    expect(canvas?.getAttribute('width')).toBe('256');
    expect(canvas?.getAttribute('height')).toBe('200');
  });

  it('should render without error when data is provided', () => {
    const data: WaveformData = {
      density: new Uint32Array(160 * 256),
      peak: 0,
      columns: 160,
    };
    const { container } = render(<WaveformMonitor data={data} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });

  it('should render without error when data has non-zero peak', () => {
    const data: WaveformData = {
      density: new Uint32Array(160 * 256),
      peak: 5,
      columns: 160,
    };
    data.density[0 * 256 + 128] = 5;
    const { container } = render(<WaveformMonitor data={data} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });
});
