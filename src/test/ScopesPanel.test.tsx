import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScopesPanel } from '../components/Scopes/ScopesPanel';
import { useScopeStore } from '../store/scopeStore';

describe('ScopesPanel', () => {
  beforeEach(() => {
    useScopeStore.setState({
      enabled: false,
      activeScopes: new Set(['histogram']),
      histogramData: null,
      vectorscopeData: null,
      waveformData: null,
    });
  });

  it('should render enable checkbox', () => {
    render(<ScopesPanel />);
    expect(screen.getByText('スコープを有効にする')).toBeInTheDocument();
  });

  it('should not show scope toggles when disabled', () => {
    render(<ScopesPanel />);
    expect(screen.queryByText('ヒストグラム')).not.toBeInTheDocument();
    expect(screen.queryByText('ベクトルスコープ')).not.toBeInTheDocument();
    expect(screen.queryByText('波形モニター')).not.toBeInTheDocument();
  });

  it('should show scope toggles when enabled', () => {
    useScopeStore.setState({ enabled: true });
    render(<ScopesPanel />);
    expect(screen.getAllByText('ヒストグラム').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ベクトルスコープ').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('波形モニター').length).toBeGreaterThanOrEqual(1);
  });

  it('should toggle enabled state via checkbox', () => {
    render(<ScopesPanel />);
    const enableCheckbox = screen.getByRole('checkbox');
    fireEvent.click(enableCheckbox);
    expect(useScopeStore.getState().enabled).toBe(true);
  });

  it('should show histogram by default when enabled', () => {
    useScopeStore.setState({ enabled: true });
    render(<ScopesPanel />);
    // ヒストグラムのラベルがチェックボックス横 + セクションヘッダの2箇所
    const labels = screen.getAllByText('ヒストグラム');
    expect(labels.length).toBe(2);
  });

  it('should toggle vectorscope visibility', () => {
    useScopeStore.setState({ enabled: true });
    render(<ScopesPanel />);
    // ベクトルスコープのチェックボックスをクリック
    const checkboxes = screen.getAllByRole('checkbox');
    // checkboxes: [enable, histogram, vectorscope, waveform]
    const vectorscopeCheckbox = checkboxes[2];
    fireEvent.click(vectorscopeCheckbox);
    expect(useScopeStore.getState().activeScopes.has('vectorscope')).toBe(true);
  });

  it('should toggle waveform visibility', () => {
    useScopeStore.setState({ enabled: true });
    render(<ScopesPanel />);
    const checkboxes = screen.getAllByRole('checkbox');
    // checkboxes: [enable, histogram, vectorscope, waveform]
    const waveformCheckbox = checkboxes[3];
    fireEvent.click(waveformCheckbox);
    expect(useScopeStore.getState().activeScopes.has('waveform')).toBe(true);
  });
});
