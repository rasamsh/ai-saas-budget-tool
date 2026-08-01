// Import rules ported from budget-pipeline/input/manifest.yaml.
//
// These carry CORRECTNESS semantics, not just convenience:
//  - excludePatterns on Chase Checking suppress credit-card autopay lines that
//    would otherwise double-count spending already tracked via each card's CSV.
//  - overrideMerchant forces every row from a card to a single merchant.
//
// Options are keyed by ACCOUNT LABEL (see resolveRule): whenever a file is
// assigned to an account whose label matches a rule, that rule's options apply,
// regardless of the (often bank-generated) filename. filePattern only helps
// prefill the account when a manually-renamed file happens to match.
// A per-user editable version is a documented follow-up (see ROADMAP.md -> Data import).

import type { Bank } from './types'

export interface ImportRule {
  filePattern: RegExp
  bank: Bank
  account: string
  excludePatterns?: string[]
  overrideMerchant?: string
}

export const IMPORT_RULES: ImportRule[] = [
  { filePattern: /^amex_blue_.*\.csv$/i, bank: 'amex', account: 'Amex Blue' },
  { filePattern: /^amex_plat_.*\.csv$/i, bank: 'amex', account: 'Amex Platinum' },
  {
    filePattern: /^chase_checking_.*\.csv$/i,
    bank: 'chase',
    account: 'Chase Checking',
    excludePatterns: [
      'CHECK ',
      'APPLECARD GSBANK',
      'AMERICAN EXPRESS',
      'PAYMENT TO CHASE',
      'CITI AUTOPAY',
      'DISCOVER E-PAYMENT',
      'WELLS FARGO CARD',
      'CHASE CREDIT CRD',
    ],
  },
  {
    filePattern: /^chase_prime_.*\.csv$/i,
    bank: 'chase',
    account: 'Chase Prime',
    overrideMerchant: 'Amazon',
  },
  { filePattern: /^citi_.*\.csv$/i, bank: 'citi', account: 'Citi' },
]

/** Find a rule by filename (best-effort prefill of account/bank). */
export function ruleForFilename(filename: string): ImportRule | undefined {
  return IMPORT_RULES.find(r => r.filePattern.test(filename))
}

/**
 * Resolve the exclude/override options that apply to a file, keyed by the
 * account label it is being imported under. This is what guarantees a renamed
 * Chase-checking download still gets its autopay exclusions.
 */
export function ruleForAccount(account: string): ImportRule | undefined {
  return IMPORT_RULES.find(r => r.account.toLowerCase() === account.trim().toLowerCase())
}
