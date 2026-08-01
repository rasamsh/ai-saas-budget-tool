// Faithful TS port of budget-pipeline/categorizer.py :: categorize.

import type { CategoryRules, ParsedTransaction } from './types'

/** Round to 2 decimals (bank amounts are already <=2dp, so this is exact). */
function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100
}

/** Upper-case + collapse runs of whitespace, so "M1     PAYMENTS" matches "M1 PAYMENTS". */
function normalize(description: string): string {
  return description.toUpperCase().replace(/\s+/g, ' ').trim()
}

/**
 * Whether a credit's description names an income source we recognize.
 * Not used to decide direction (the bank's sign already did) - it drives the
 * "unrecognized credit" review warning on the import preview.
 */
export function isRecognizedIncome(description: string, incomePatterns: string[]): boolean {
  const descUpper = normalize(description)
  return incomePatterns.some(ip => ip && descUpper.includes(ip.toUpperCase()))
}

/**
 * Categorize a transaction in place (mutates and returns it).
 * Order: amount rules -> pattern rules -> credit fallback -> default.
 *
 * Direction is authoritative. Parsers set `txnType = 'income'` only for rows the
 * bank itself reported as credits (money in), and no category rule may flip that:
 * the rules are written for spending, so applying one to a credit turns money in
 * into money out - a double-sized error in net cash flow. A credit that matches
 * no rule is still income, just income we don't recognize.
 */
export function categorize(txn: ParsedTransaction, rules: CategoryRules): ParsedTransaction {
  const amountRules = rules.amount_rules ?? []
  const patternRules = rules.rules ?? []

  const isCredit = txn.txnType === 'income'
  const descUpper = normalize(txn.description)

  // Step 1: Amount-based rules (exact 2dp match)
  for (const ar of amountRules) {
    const ruleAmount = Number(ar.amount)
    if (Number.isNaN(ruleAmount)) continue
    if (round2(txn.amount) === round2(ruleAmount)) {
      const type = ar.type ?? 'expense'
      if (isCredit && type !== 'income') continue // spending rule, wrong direction
      txn.category = ar.category ?? 'Misc'
      txn.txnType = type
      return txn
    }
  }

  // Step 2: Pattern rules (case-insensitive substring on raw description)
  for (const rule of patternRules) {
    const pattern = rule.pattern ?? ''
    if (!pattern) continue
    if (descUpper.includes(pattern.toUpperCase())) {
      const type = rule.type ?? 'expense'
      if (isCredit && type !== 'income') continue // spending rule, wrong direction
      txn.category = rule.category ?? 'Misc'
      txn.txnType = type
      return txn
    }
  }

  // Step 3: Unmatched credit — money in, source unrecognized.
  if (isCredit) {
    txn.category = 'Income'
    txn.txnType = 'income'
    return txn
  }

  // Step 4: Default
  txn.category = 'Misc'
  txn.txnType = 'expense'
  return txn
}
