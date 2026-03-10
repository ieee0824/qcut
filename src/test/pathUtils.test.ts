import { describe, it, expect } from 'vitest';
import { toRelativePath, resolveRelativePath, isAbsolutePath, getDirectoryPath } from '../utils/pathUtils';

describe('pathUtils', () => {
  describe('isAbsolutePath', () => {
    it('Unix 絶対パスを正しく判定する', () => {
      expect(isAbsolutePath('/Users/test/video.mp4')).toBe(true);
      expect(isAbsolutePath('/home/user/file.mp4')).toBe(true);
    });

    it('Windows 絶対パスを正しく判定する', () => {
      expect(isAbsolutePath('C:\\Users\\test\\video.mp4')).toBe(true);
      expect(isAbsolutePath('D:\\Videos\\file.mp4')).toBe(true);
      expect(isAbsolutePath('c:\\users\\test\\video.mp4')).toBe(true);
    });

    it('相対パスを正しく判定する', () => {
      expect(isAbsolutePath('video.mp4')).toBe(false);
      expect(isAbsolutePath('./video.mp4')).toBe(false);
      expect(isAbsolutePath('../videos/video.mp4')).toBe(false);
      expect(isAbsolutePath('assets/video.mp4')).toBe(false);
    });

    it('空文字列は相対パスとして扱う', () => {
      expect(isAbsolutePath('')).toBe(false);
    });
  });

  describe('getDirectoryPath', () => {
    it('Unix パスからディレクトリを取得する', () => {
      expect(getDirectoryPath('/Users/test/project.qcut')).toBe('/Users/test');
      expect(getDirectoryPath('/home/user/docs/file.qcut')).toBe('/home/user/docs');
    });

    it('Windows パスからディレクトリを取得する', () => {
      expect(getDirectoryPath('C:\\Users\\test\\project.qcut')).toBe('C:\\Users\\test');
      expect(getDirectoryPath('D:\\Videos\\docs\\file.qcut')).toBe('D:\\Videos\\docs');
    });

    it('ルート直下のファイル', () => {
      expect(getDirectoryPath('/file.qcut')).toBe('/');
      expect(getDirectoryPath('C:\\file.qcut')).toBe('C:\\');
    });
  });

  describe('toRelativePath', () => {
    it('同じディレクトリの素材は ./filename になる', () => {
      expect(toRelativePath('/Users/test/video.mp4', '/Users/test')).toBe('video.mp4');
    });

    it('サブディレクトリの素材', () => {
      expect(toRelativePath('/Users/test/assets/video.mp4', '/Users/test')).toBe('assets/video.mp4');
    });

    it('親ディレクトリの素材は ../ を使う', () => {
      expect(toRelativePath('/Users/test/video.mp4', '/Users/test/projects')).toBe('../video.mp4');
    });

    it('兄弟ディレクトリの素材', () => {
      expect(toRelativePath('/Users/test/videos/clip.mp4', '/Users/test/projects')).toBe('../videos/clip.mp4');
    });

    it('深い階層差がある場合', () => {
      expect(toRelativePath('/Users/test/a/b/c/video.mp4', '/Users/test/x/y')).toBe('../../a/b/c/video.mp4');
    });

    it('Windows パスも処理できる', () => {
      expect(toRelativePath('C:\\Users\\test\\video.mp4', 'C:\\Users\\test')).toBe('video.mp4');
      expect(toRelativePath('C:\\Users\\test\\assets\\video.mp4', 'C:\\Users\\test')).toBe('assets/video.mp4');
      expect(toRelativePath('C:\\Users\\test\\video.mp4', 'C:\\Users\\test\\projects')).toBe('../video.mp4');
    });

    it('異なるドライブレターの場合は絶対パスのまま返す', () => {
      expect(toRelativePath('D:\\Videos\\clip.mp4', 'C:\\Users\\test')).toBe('D:\\Videos\\clip.mp4');
    });

    it('空の filePath はそのまま返す', () => {
      expect(toRelativePath('', '/Users/test')).toBe('');
    });
  });

  describe('resolveRelativePath', () => {
    it('相対パスを絶対パスに解決する', () => {
      expect(resolveRelativePath('video.mp4', '/Users/test')).toBe('/Users/test/video.mp4');
    });

    it('サブディレクトリの相対パス', () => {
      expect(resolveRelativePath('assets/video.mp4', '/Users/test')).toBe('/Users/test/assets/video.mp4');
    });

    it('../ を含む相対パスを解決する', () => {
      expect(resolveRelativePath('../video.mp4', '/Users/test/projects')).toBe('/Users/test/video.mp4');
    });

    it('複数の ../ を解決する', () => {
      expect(resolveRelativePath('../../a/b/video.mp4', '/Users/test/x/y')).toBe('/Users/test/a/b/video.mp4');
    });

    it('絶対パスが渡された場合はそのまま返す（後方互換性）', () => {
      expect(resolveRelativePath('/Users/test/video.mp4', '/Users/other')).toBe('/Users/test/video.mp4');
      expect(resolveRelativePath('C:\\Users\\test\\video.mp4', 'C:\\Users\\other')).toBe('C:\\Users\\test\\video.mp4');
    });

    it('Windows ベースパスでの解決', () => {
      expect(resolveRelativePath('video.mp4', 'C:\\Users\\test')).toBe('C:\\Users\\test\\video.mp4');
      expect(resolveRelativePath('assets/video.mp4', 'C:\\Users\\test')).toBe('C:\\Users\\test\\assets\\video.mp4');
      expect(resolveRelativePath('../video.mp4', 'C:\\Users\\test\\projects')).toBe('C:\\Users\\test\\video.mp4');
    });

    it('空の filePath はそのまま返す', () => {
      expect(resolveRelativePath('', '/Users/test')).toBe('');
    });
  });

  describe('toRelativePath → resolveRelativePath ラウンドトリップ', () => {
    const testCases = [
      { filePath: '/Users/test/video.mp4', baseDir: '/Users/test' },
      { filePath: '/Users/test/assets/video.mp4', baseDir: '/Users/test' },
      { filePath: '/Users/test/video.mp4', baseDir: '/Users/test/projects' },
      { filePath: '/Users/test/a/b/c/video.mp4', baseDir: '/Users/test/x/y' },
      { filePath: '/home/user/Desktop/clip.mp4', baseDir: '/home/user/projects/myproject' },
    ];

    testCases.forEach(({ filePath, baseDir }) => {
      it(`${filePath} (base: ${baseDir}) のラウンドトリップ`, () => {
        const relative = toRelativePath(filePath, baseDir);
        const resolved = resolveRelativePath(relative, baseDir);
        expect(resolved).toBe(filePath);
      });
    });
  });
});
