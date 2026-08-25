import { describe, it, expect } from 'vitest';
import { formatYearLabel, makeLinksClickable, calculateYearFromProgress } from './utils.js';

describe('GeoTrends - Utilities Unit Tests', () => {
    describe('formatYearLabel()', () => {
        it('should format negative years as BC', () => {
            expect(formatYearLabel(-1200)).toBe('1200 BC');
            expect(formatYearLabel(-50)).toBe('50 BC');
        });

        it('should format positive years as standard string numbers', () => {
            expect(formatYearLabel(500)).toBe('500');
            expect(formatYearLabel(2026)).toBe('2026');
        });

        it('should format 0 as "0"', () => {
            expect(formatYearLabel(0)).toBe('0');
        });
    });

    describe('makeLinksClickable()', () => {
        it('should convert standard http/https URLs into secure anchor tags', () => {
            const raw = 'Visit https://exploreisrael.online/en for more details.';
            const result = makeLinksClickable(raw);
            expect(result).toContain('<a href="https://exploreisrael.online/en" target="_blank"');
            expect(result).toContain('style="color: #2563eb; text-decoration: underline; font-weight: 600;"');
        });

        it('should prepend http to www. prefixes automatically', () => {
            const raw = 'Check out www.facebook.com/itzik.stauber';
            const result = makeLinksClickable(raw);
            expect(result).toContain('href="http://www.facebook.com/itzik.stauber"');
        });

        it('should return empty string for empty inputs', () => {
            expect(makeLinksClickable('')).toBe('');
            expect(makeLinksClickable(null)).toBe('');
        });
    });

    describe('calculateYearFromProgress()', () => {
        it('should compute the correct year at 0, 0.5, and 1.0 progress', () => {
            expect(calculateYearFromProgress(0, -1000, 2000)).toBe(-1000);
            expect(calculateYearFromProgress(0.5, -1000, 2000)).toBe(500);
            expect(calculateYearFromProgress(1.0, -1000, 2000)).toBe(2000);
        });

        it('should clamp progress below 0 and above 1', () => {
            expect(calculateYearFromProgress(-0.2, -1500, 500)).toBe(-1500);
            expect(calculateYearFromProgress(1.5, -1500, 500)).toBe(500);
        });

        it('should handle fractional percentages and round to nearest integer', () => {
            expect(calculateYearFromProgress(0.333, 0, 100)).toBe(33);
        });
    });
});
