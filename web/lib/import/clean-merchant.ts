// Faithful TS port of budget-pipeline/categorizer.py :: clean_merchant.
// The regex order and behavior must match the Python version exactly, since
// merchant strings feed the UI (hashing uses the RAW description, not this).

/**
 * Replicate Python's str.title() for ASCII: every maximal run of letters is
 * capitalized (first upper, rest lower); any non-letter (space, digit, hyphen,
 * apostrophe) is a word boundary. e.g. "chick-fil-a" -> "Chick-Fil-A",
 * "m1 payments" -> "M1 Payments".
 */
export function pythonTitle(s: string): string {
  return s.replace(/[A-Za-z]+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase())
}

/**
 * Clean a raw bank description into a human-readable merchant name.
 * Mirrors the 7 rules in categorizer.clean_merchant.
 */
export function cleanMerchant(description: string): string {
  // Normalize multiple spaces first so later rules work on clean input
  let s = description.replace(/\s+/g, ' ').trim()

  // Rule 1: Strip trailing 2-3 uppercase letter state/country code
  s = s.replace(/\s+[A-Z]{2,3}$/, '').trim()

  // Rule 2: If "*" present, prefer the post-asterisk segment — UNLESS it looks
  // like a reference code (mixed letters+digits, no spaces, 6+ chars).
  if (s.includes('*')) {
    const idx = s.lastIndexOf('*')
    const pre = s.slice(0, idx)
    const post = s.slice(idx + 1).trim()
    const isRefCode =
      /\d/.test(post) && /[A-Za-z]/.test(post) && !post.includes(' ') && post.length >= 6
    s = isRefCode ? pre.trim() : post
  }

  // Rule 3: Split on "/" -> take part before "/"
  if (s.includes('/')) {
    s = s.split('/')[0].trim()
  }

  // Rule 4: Strip "AplPay " prefix (Apple Pay)
  s = s.replace(/^AplPay\s+/i, '').trim()

  // Rule 5: Strip website TLDs at word boundary
  s = s.replace(/\.(com|net|org|ai|io|co)\b/gi, '').trim()

  // Rule 6: Strip long digit strings including a preceding single letter
  s = s.replace(/[A-Z]?\s*\d{7,}/g, '').trim()

  // Rule 7: Collapse whitespace, title-case, truncate to 28 chars
  s = s.replace(/\s+/g, ' ').trim()
  s = pythonTitle(s)
  s = s.slice(0, 28)

  return s
}
