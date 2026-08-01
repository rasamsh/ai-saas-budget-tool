// Faithful TS port of budget-pipeline/scrubber.py :: scrub.
// Removes PII/noise from merchant names before storage. Rule order matters.

import { pythonTitle } from './clean-merchant'

const ZELLE_NAME_RE = /zelle\s+(payment\s+)?(to|from)\s+[A-Za-z][A-Za-z\s]+$/i

/**
 * Scrub PII and noise from a merchant name.
 * @param merchant   cleaned or raw merchant string
 * @param description raw bank description (used as a fallback signal for Zelle)
 * @param achNames    personal names to mask as "ACH Transfer"
 */
export function scrub(merchant: string, description: string, achNames: string[]): string {
  let s = merchant.trim()

  // Rule 1: Zelle payments — strip personal names
  if (/zelle/i.test(s)) {
    if (ZELLE_NAME_RE.test(s)) return 'Zelle Payment'
    if (ZELLE_NAME_RE.test(description)) return 'Zelle Payment'
    if (/zelle\s+(payment|transfer)/i.test(s)) return 'Zelle Payment'
  }

  // Rule 2: ACH known names — replace whole merchant
  const sUpper = s.toUpperCase()
  for (const name of achNames) {
    if (name.trim() && sUpper.includes(name.trim().toUpperCase())) {
      return 'ACH Transfer'
    }
  }

  // Rule 3: Strip PPD / WEB / ACH / TEL ID suffixes (digits may already be gone)
  s = s.replace(/\s+PPD\s+ID[:\s]*\d*/gi, '').trim()
  s = s.replace(/\s+WEB\s+ID[:\s]*\d*/gi, '').trim()
  s = s.replace(/\s+ACH\s+ID[:\s]*\d*/gi, '').trim()
  s = s.replace(/\s+TEL\s+ID[:\s]*\d*/gi, '').trim()
  // Strip any trailing isolated colon/space left after digit removal
  s = s.replace(/[\s:]+$/, '').trim()

  // Rule 4: Check numbers -> "Personal Check"
  if (/\bcheck\s+\d+/i.test(s)) return 'Personal Check'

  // Rule 5: Trailing reference codes (8+ uppercase alphanumerics)
  s = s.replace(/\s+[A-Z0-9]{8,}$/, '').trim()

  // Rule 6: Strip partial account numbers (hyphen + digits)
  s = s.replace(/-\d+/g, '').trim()

  // Rule 7: Collapse whitespace, title-case, truncate to 28 chars
  s = s.replace(/\s+/g, ' ').trim()
  s = pythonTitle(s)
  s = s.slice(0, 28)

  return s
}
