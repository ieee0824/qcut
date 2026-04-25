import { describe, expect, it } from 'vitest';
import { extractDisplayName, extractProjectName } from '../utils/projectPaths';

describe('extractDisplayName', () => {
  it('extracts filename from Unix path', () => {
    expect(extractDisplayName('/Users/test/project.qcut', 'fallback')).toBe('project.qcut');
  });

  it('extracts filename from Windows path', () => {
    expect(extractDisplayName('C:\\Users\\test\\project.qcut', 'fallback')).toBe('project.qcut');
  });

  it('extracts filename from mixed-separator path', () => {
    expect(extractDisplayName('C:/Users\\test/project.qcut', 'fallback')).toBe('project.qcut');
  });

  it('returns fallback when path is undefined', () => {
    expect(extractDisplayName(undefined, 'My Project')).toBe('My Project');
  });

  it('returns fallback when path is empty string', () => {
    expect(extractDisplayName('', 'My Project')).toBe('My Project');
  });

  it('returns fallback when path ends with separator', () => {
    expect(extractDisplayName('/Users/test/', 'fallback')).toBe('fallback');
  });

  it('returns filename for path without directory', () => {
    expect(extractDisplayName('project.qcut', 'fallback')).toBe('project.qcut');
  });
});

describe('extractProjectName', () => {
  it('extracts name and removes .qcut extension from Unix path', () => {
    expect(extractProjectName('/Users/test/myproject.qcut', 'fallback')).toBe('myproject');
  });

  it('extracts name and removes .qcut extension from Windows path', () => {
    expect(extractProjectName('C:\\Users\\test\\myproject.qcut', 'fallback')).toBe('myproject');
  });

  it('extracts name from mixed-separator path', () => {
    expect(extractProjectName('C:/Users\\test/myproject.qcut', 'fallback')).toBe('myproject');
  });

  it('returns name without extension when no .qcut suffix', () => {
    expect(extractProjectName('/Users/test/myproject', 'fallback')).toBe('myproject');
  });

  it('returns fallback when path is undefined', () => {
    expect(extractProjectName(undefined, 'Default')).toBe('Default');
  });

  it('returns fallback when path is null', () => {
    expect(extractProjectName(null, 'Default')).toBe('Default');
  });

  it('returns fallback when path is empty string', () => {
    expect(extractProjectName('', 'Default')).toBe('Default');
  });

  it('returns fallback when path ends with separator', () => {
    expect(extractProjectName('/Users/test/', 'Default')).toBe('Default');
  });

  it('returns fallback when filename is just .qcut', () => {
    expect(extractProjectName('/Users/test/.qcut', 'Default')).toBe('Default');
  });

  it('handles filename-only path', () => {
    expect(extractProjectName('video.qcut', 'fallback')).toBe('video');
  });
});
