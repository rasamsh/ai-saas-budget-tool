// Review signals produced from a processed batch, shown on the import preview.

import type { CategoryRules, ParsedTransaction } from './types'
import { isRecognizedIncome } from './categorizer'
import { CATEGORY_RULES } from './rules'

const NAME_LIMIT = 5

/**
 * Credits are always recorded as income - the bank's sign decides, and a category
 * rule may never flip it. But a credit whose description matches no known income
 * source is worth a look: an internal transfer between your own accounts lands here
 * and would overstate income if left alone.
 */
export function unrecognizedIncomeWarnings(
  transactions: ParsedTransaction[],
  rules: CategoryRules = CATEGORY_RULES,
): string[] {
  const unrecognized = transactions.filter(
    t => t.txnType === 'income' && !isRecognizedIncome(t.description, rules.income_patterns ?? []),
  )
  if (!unrecognized.length) return []

  const names = [...new Set(unrecognized.map(t => t.merchant))]
  const shown = names.slice(0, NAME_LIMIT)
  const more = names.length > shown.length ? `, +${names.length - shown.length} more` : ''
  const plural = unrecognized.length === 1 ? '' : 's'

  return [
    `${unrecognized.length} credit${plural} recorded as Income from a source we don't ` +
      `recognize: ${shown.join(', ')}${more}. Worth a check - a transfer between your own ` +
      `accounts counts as income here.`,
  ]
}
