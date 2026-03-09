import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Vectorscope } from '../components/Scopes/Vectorscope';
import type { VectorscopeData } from '../utils/scopeAnalysis';

describe('Vectorscope component', () => {
  it('should render canvas element', () => {
    const { container } = render(<Vectorscope data={null} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });

  it('should render with default size', () => {
    const { container } = render(<Vectorscope data={null} />);
    const canvas = container.querySelector('canvas');
    expect(canvas?.getAttribute('width')).toBe('196');
    expect(canvas?.getAttribute('height')).toBe('196');
  });

  it('should render with custom size', () => {
    const { container } = render(<Vectorscope data={null} size={256} />);
    const canvas = container.querySelector('canvas');
    expect(canvas?.getAttribute('width')).toBe('256');
    expect(canvas?.getAttribute('height')).toBe('256');
  });

  it('should render without error when data is provided', () => {
    const data: VectorscopeData = {
      density: new Uint32Array(256 * 256),
      peak: 0,
    };
    const { container } = render(<Vectorscope data={data} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });

  it('should render without error when data has non-zero peak', () => {
    const data: VectorscopeData = {
      density: new Uint32Array(256 * 256),
      peak: 10,
    };
    data.density[128 * 256 + 128] = 10;
    const { container } = render(<Vectorscope data={data} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });
});
