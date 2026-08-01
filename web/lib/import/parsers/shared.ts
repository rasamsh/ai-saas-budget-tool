import type { Bank, ParsedTransaction } from '../types'
import { cleanMerchant } from '../clean-merchant'

/** Build a ParsedTransaction. Hash is filled in later, after netting. */
export function makeTxn(opts: {
  date: string
  description: string
  amount: number
  account: string
  bank: Bank
  category?: string
  txnType?: ParsedTransaction['txnType']
}): ParsedTransaction {
  return {
    date: opts.date,
    description: opts.description,
    merchant: cleanMerchant(opts.description),
    amount: opts.amount,
    account: opts.account,
    bank: opts.bank,
    category: opts.category ?? 'Misc',
    txnType: opts.txnType ?? 'expense',
    hash: '',
  }
}
