import { describe, it, expect } from 'vitest';
import { formatCurrency, formatShortCurrency } from '../supabase';

describe('Currency Formatting', () => {
  describe('formatCurrency', () => {
    it('should format zero correctly', () => {
      expect(formatCurrency(0)).toBe('0 pts');
    });

    it('should format small numbers correctly', () => {
      expect(formatCurrency(500)).toBe('500 pts');
      expect(formatCurrency(999)).toBe('999 pts');
    });

    it('should format thousands correctly', () => {
      expect(formatCurrency(1000)).toBe('1K pts');
      expect(formatCurrency(5000)).toBe('5K pts');
      expect(formatCurrency(5500)).toBe('5.50K pts'); // Formats to 2 decimals
    });

    it('should format millions correctly', () => {
      expect(formatCurrency(1000000)).toBe('1.00M pts');
      expect(formatCurrency(2500000)).toBe('2.50M pts');
    });

    it('should handle null/undefined', () => {
      expect(formatCurrency(null)).toBe('0 pts');
      expect(formatCurrency(undefined)).toBe('0 pts');
    });
  });

  describe('formatShortCurrency', () => {
    it('should format zero correctly', () => {
      expect(formatShortCurrency(0)).toBe('0 pts');
    });

    it('should format small numbers correctly', () => {
      expect(formatShortCurrency(500)).toBe('500 pts');
    });

    it('should format thousands with one decimal', () => {
      expect(formatShortCurrency(1000)).toBe('1K pts');
      expect(formatShortCurrency(5500)).toBe('5.5K pts');
    });

    it('should format millions with one decimal', () => {
      expect(formatShortCurrency(1000000)).toBe('1.0M pts');
      expect(formatShortCurrency(2500000)).toBe('2.5M pts');
    });

    it('should handle null/undefined', () => {
      expect(formatShortCurrency(null)).toBe('0 pts');
      expect(formatShortCurrency(undefined)).toBe('0 pts');
    });
  });
});
