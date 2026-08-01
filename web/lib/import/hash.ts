// SHA-256 dedup hash — MUST be byte-identical to
// budget-pipeline/deduplicator.py :: compute_hash, or web imports would
// duplicate the user's entire CLI-imported history. See CLAUDE.md -> in-app import.
//
// Python: sha256(f"{date}|{amount:.2f}|{raw_description.strip()}|{account}")

import { createHash } from 'node:crypto'

/**
 * Format an amount to exactly 2 decimals the same way Python `f"{x:.2f}"` does.
 * Python uses round-half-to-even; JS toFixed uses round-half-up. These diverge
 * only when the value needs rounding at the 3rd decimal. Bank amounts always
 * carry <=2 decimals, so we assert that here rather than silently disagree.
 */
export function formatAmount2(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new Error(`formatAmount2: non-finite amount ${amount}`)
  }
  // Guard: the value must survive 2-decimal representation without rounding.
  if (Math.round(amount * 100) / 100 !== amount) {
    throw new Error(
      `formatAmount2: amount ${amount} has more than 2 decimal places; ` +
        `hash parity with the Python pipeline is not guaranteed`,
    )
  }
  return amount.toFixed(2)
}

export function computeHash(
  dateISO: string,
  amount: number,
  rawDescription: string,
  account: string,
): string {
  const raw = `${dateISO}|${formatAmount2(amount)}|${rawDescription.trim()}|${account}`
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}
