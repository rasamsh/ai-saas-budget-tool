import { describe, it, expect } from 'vitest'
import { parseDateISO } from '@/lib/import/date'

describe('parseDateISO', () => {
  describe('ISO YYYY-MM-DD', () => {
    it('parses a plain ISO date', () => {
      expect(parseDateISO('2026-07-22')).toBe('2026-07-22')
    })

    it('keeps only the date part when a time follows', () => {
      expect(parseDateISO('2026-07-22T10:30:00')).toBe('2026-07-22')
      expect(parseDateISO('2026-07-22 10:30:00')).toBe('2026-07-22')
    })

    it('rejects an out-of-range month or day', () => {
      expect(parseDateISO('2026-13-01')).toBeNull()
      expect(parseDateISO('2026-00-10')).toBeNull()
      expect(parseDateISO('2026-07-32')).toBeNull()
      expect(parseDateISO('2026-07-00')).toBeNull()
    })

    it('does not match a single-digit ISO month/day form', () => {
      // Bank exports never use this; it falls through to null rather than guessing.
      expect(parseDateISO('2026-7-2')).toBeNull()
    })
  })

  describe('US M/D/Y', () => {
    it('parses MM/DD/YYYY', () => {
      expect(parseDateISO('07/22/2026')).toBe('2026-07-22')
    })

    it('zero-pads single-digit month and day', () => {
      expect(parseDateISO('7/2/2026')).toBe('2026-07-02')
      expect(parseDateISO('1/5/2026')).toBe('2026-01-05')
    })

    it('expands a 2-digit year into the 2000s', () => {
      expect(parseDateISO('07/22/26')).toBe('2026-07-22')
      expect(parseDateISO('12/31/99')).toBe('2099-12-31')
    })

    it('rejects an out-of-range month or day', () => {
      expect(parseDateISO('13/01/2026')).toBeNull()
      expect(parseDateISO('00/10/2026')).toBeNull()
      expect(parseDateISO('07/32/2026')).toBeNull()
      expect(parseDateISO('07/00/2026')).toBeNull()
    })

    it('rejects a 3-digit or otherwise malformed year', () => {
      expect(parseDateISO('07/22/206')).toBeNull()
      expect(parseDateISO('07-22-2026')).toBeNull()
    })
  })

  describe('empty / unparseable', () => {
    it('returns null for undefined, empty, or whitespace', () => {
      expect(parseDateISO(undefined)).toBeNull()
      expect(parseDateISO('')).toBeNull()
      expect(parseDateISO('   ')).toBeNull()
    })

    it('trims surrounding whitespace before parsing', () => {
      expect(parseDateISO('  07/22/2026  ')).toBe('2026-07-22')
      expect(parseDateISO('  2026-07-22  ')).toBe('2026-07-22')
    })

    it('returns null for free text', () => {
      expect(parseDateISO('not a date')).toBeNull()
      expect(parseDateISO('July 22, 2026')).toBeNull()
    })
  })
})
