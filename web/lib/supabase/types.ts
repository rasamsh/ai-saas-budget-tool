export type TxnType = 'expense' | 'income' | 'investment' | 'debt'
export type TransactionFlag = 'reimbursable' | 'one_time' | 'excluded'

export interface Account {
  id: string
  name: string
  bank: string
  user_id: string
  created_at: string
}

export interface Category {
  name: string
  txn_type: TxnType
  color: string
}

export interface ImportBatch {
  id: string
  imported_at: string
  period_start: string
  period_end: string
  file_count: number
  transaction_count: number
  user_id: string
}

export interface Transaction {
  id: string
  date: string
  merchant: string
  amount: number
  category: string
  txn_type: TxnType
  account_id: string
  import_batch_id: string | null
  hash: string
  user_id: string
  created_at: string
  flag?: TransactionFlag | null
  notes?: string | null
  accounts?: Account
  categories?: Category
}

export interface MonthlySummary {
  user_id: string
  year: number
  month: number
  income: number
  expenses: number
  invested: number
  debt_payments: number
  savings_rate_pct: number | null
}

export interface MonthlyCategoryTotal {
  user_id: string
  year: number
  month: number
  category: string
  txn_type: string
  transaction_count: number
  total_amount: number
}
