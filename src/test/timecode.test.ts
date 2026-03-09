import { describe, it, expect } from 'vitest';
import { formatTimecode } from '../utils/timecode';

describe('formatTimecode', () => {
  // ローカルタイムゾーンで 2024-01-15 10:00:00 を基準にする
  const baseTime = new Date(2024, 0, 15, 10, 0, 0).getTime();

  describe('hm format', () => {
    it('should show HH:MM at start', () => {
      expect(formatTimecode(baseTime, 0, 'hm')).toBe('10:00');
    });

    it('should advance minutes', () => {
      expect(formatTimecode(baseTime, 300, 'hm')).toBe('10:05');
    });

    it('should advance hours', () => {
      expect(formatTimecode(baseTime, 3600, 'hm')).toBe('11:00');
    });
  });

  describe('hms format', () => {
    it('should show HH:MM:SS at start', () => {
      expect(formatTimecode(baseTime, 0, 'hms')).toBe('10:00:00');
    });

    it('should advance seconds', () => {
      expect(formatTimecode(baseTime, 30, 'hms')).toBe('10:00:30');
    });

    it('should advance minutes and seconds', () => {
      expect(formatTimecode(baseTime, 90, 'hms')).toBe('10:01:30');
    });
  });

  describe('md-hm format', () => {
    it('should show month/day and time', () => {
      const result = formatTimecode(baseTime, 0, 'md-hm');
      expect(result).toBe('1月15日 10:00');
    });

    it('should cross midnight', () => {
      const result = formatTimecode(baseTime, 14 * 3600, 'md-hm');
      expect(result).toBe('1月16日 00:00');
    });
  });

  describe('ymd-hm format', () => {
    it('should show year/month/day and time', () => {
      const result = formatTimecode(baseTime, 0, 'ymd-hm');
      expect(result).toBe('2024年1月15日 10:00');
    });
  });

  describe('edge cases', () => {
    it('should handle fractional seconds', () => {
      expect(formatTimecode(baseTime, 0.5, 'hms')).toBe('10:00:00');
    });

    it('should handle large elapsed time (24h wrap)', () => {
      expect(formatTimecode(baseTime, 86400, 'hm')).toBe('10:00');
    });

    it('should default to hm for unknown format', () => {
      expect(formatTimecode(baseTime, 0, 'unknown' as never)).toBe('10:00');
    });
  });
});
