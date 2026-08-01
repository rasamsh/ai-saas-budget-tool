// Mock data for local development — mirrors the real Supabase schema.
// Summaries and category totals are computed dynamically from TRANSACTIONS.

export const MOCK_USER = {
  id: 'mock-user-00000000-0000-0000-0000-000000000001',
  email: 'demo@example.com',
  user_metadata: {},
  app_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
}

const UID = MOCK_USER.id

// ─── Accounts ────────────────────────────────────────────────────────────────

export const MOCK_ACCOUNTS = [
  { id: 'acc-amex-blue',      name: 'Amex Blue',       bank: 'amex',  user_id: UID, created_at: '2026-01-01T00:00:00Z' },
  { id: 'acc-amex-plat',      name: 'Amex Platinum',   bank: 'amex',  user_id: UID, created_at: '2026-01-01T00:00:00Z' },
  { id: 'acc-chase-checking', name: 'Chase Checking',  bank: 'chase', user_id: UID, created_at: '2026-01-01T00:00:00Z' },
  { id: 'acc-chase-prime',    name: 'Chase Prime',     bank: 'chase', user_id: UID, created_at: '2026-01-01T00:00:00Z' },
  { id: 'acc-citi',           name: 'Citi',            bank: 'citi',  user_id: UID, created_at: '2026-01-01T00:00:00Z' },
]

const A = {
  BLUE:  MOCK_ACCOUNTS[0],
  PLAT:  MOCK_ACCOUNTS[1],
  CHK:   MOCK_ACCOUNTS[2],
  PRIME: MOCK_ACCOUNTS[3],
  CITI:  MOCK_ACCOUNTS[4],
}

// ─── Categories ───────────────────────────────────────────────────────────────

export const MOCK_CATEGORIES = [
  { name: 'Groceries',         txn_type: 'expense',    color: '#22c55e' },
  { name: 'Dining',            txn_type: 'expense',    color: '#f97316' },
  { name: 'Shopping',          txn_type: 'expense',    color: '#8b5cf6' },
  { name: 'Subscriptions',     txn_type: 'expense',    color: '#3b82f6' },
  { name: 'Transportation',    txn_type: 'expense',    color: '#6366f1' },
  { name: 'Utilities',         txn_type: 'expense',    color: '#0ea5e9' },
  { name: 'Healthcare',        txn_type: 'expense',    color: '#ec4899' },
  { name: 'Travel',            txn_type: 'expense',    color: '#14b8a6' },
  { name: 'Car Insurance',     txn_type: 'expense',    color: '#64748b' },
  { name: 'Misc',              txn_type: 'expense',    color: '#6b7280' },
  { name: 'Car Loan',          txn_type: 'debt',       color: '#f59e0b' },
  { name: 'Taxable Brokerage', txn_type: 'investment', color: '#2563eb' },
  { name: '529 Plan',          txn_type: 'investment', color: '#7c3aed' },
  { name: 'Income',            txn_type: 'income',     color: '#16a34a' },
]

const CAT = Object.fromEntries(MOCK_CATEGORIES.map(c => [c.name, c]))

// ─── Import Batches ───────────────────────────────────────────────────────────

export const MOCK_IMPORT_BATCHES = [
  { id: 'batch-06', imported_at: '2026-06-27T12:11:00Z', period_start: '2026-06-01', period_end: '2026-06-26', file_count: 5, transaction_count: 54, user_id: UID },
  { id: 'batch-05', imported_at: '2026-05-29T09:42:00Z', period_start: '2026-05-01', period_end: '2026-05-28', file_count: 5, transaction_count: 41, user_id: UID },
  { id: 'batch-04', imported_at: '2026-04-30T14:05:00Z', period_start: '2026-04-01', period_end: '2026-04-29', file_count: 5, transaction_count: 38, user_id: UID },
  { id: 'batch-03', imported_at: '2026-03-31T08:22:00Z', period_start: '2026-03-01', period_end: '2026-03-30', file_count: 5, transaction_count: 36, user_id: UID },
  { id: 'batch-02', imported_at: '2026-02-28T17:30:00Z', period_start: '2026-02-01', period_end: '2026-02-27', file_count: 5, transaction_count: 29, user_id: UID },
  { id: 'batch-01', imported_at: '2026-01-31T11:15:00Z', period_start: '2026-01-01', period_end: '2026-01-30', file_count: 5, transaction_count: 31, user_id: UID },
]

// ─── Transactions ─────────────────────────────────────────────────────────────

let _id = 0
function txn(
  date: string,
  merchant: string,
  amount: number,
  category: string,
  txn_type: string,
  acct: typeof MOCK_ACCOUNTS[0],
  batchId = 'batch-06',
) {
  _id++
  return {
    id:              `txn-${String(_id).padStart(4, '0')}`,
    date,
    merchant,
    amount,
    category,
    txn_type,
    account_id:      acct.id,
    import_batch_id: batchId,
    hash:            `sha256-hash-${_id}`,
    user_id:         UID,
    created_at:      `${date}T12:00:00Z`,
    // Joined relations (mirrors what Supabase returns with select('*, accounts(*), categories(*)'))
    accounts:        { id: acct.id, name: acct.name, bank: acct.bank, user_id: UID, created_at: acct.created_at },
    categories:      CAT[category] ?? CAT['Misc'],
  }
}

export const MOCK_TRANSACTIONS = [

  // ── June 2026 ─────────────────────────────────────────────────────────────
  // Income
  txn('2026-06-15', 'Payroll',            4358.00, 'Income',             'income',     A.CHK),
  txn('2026-06-01', 'Payroll',            4358.00, 'Income',             'income',     A.CHK),
  // Investments
  txn('2026-06-25', 'M1 Payments',         500.00, 'Taxable Brokerage',  'investment', A.CHK),
  txn('2026-06-23', 'M1 Payments',        1000.00, 'Taxable Brokerage',  'investment', A.CHK),
  txn('2026-06-11', 'M1 Payments',         500.00, 'Taxable Brokerage',  'investment', A.CHK),
  txn('2026-06-15', 'My529',               100.00, '529 Plan',           'investment', A.CHK),
  // Debt
  txn('2026-06-05', 'Car Loan Payment',    689.00, 'Car Loan',           'debt',       A.CHK),
  // Travel
  txn('2026-06-05', 'American Airlines',   498.00, 'Travel',             'expense',    A.PLAT),
  txn('2026-06-05', 'American Airlines',   498.00, 'Travel',             'expense',    A.PLAT),
  txn('2026-06-03', 'Marriott Nashville',  379.00, 'Travel',             'expense',    A.PLAT),
  txn('2026-06-04', 'Marriott Nashville',  379.00, 'Travel',             'expense',    A.PLAT),
  // Shopping
  txn('2026-06-25', 'Amazon',               84.99, 'Shopping',           'expense',    A.PRIME),
  txn('2026-06-23', 'Amazon',               46.50, 'Shopping',           'expense',    A.PRIME),
  txn('2026-06-21', 'Amazon',               70.00, 'Shopping',           'expense',    A.PRIME),
  txn('2026-06-19', 'Amazon',               32.49, 'Shopping',           'expense',    A.PRIME),
  txn('2026-06-17', 'Amazon',               28.50, 'Shopping',           'expense',    A.PRIME),
  txn('2026-06-15', 'Amazon',               21.99, 'Shopping',           'expense',    A.PRIME),
  txn('2026-06-13', 'Amazon',               17.99, 'Shopping',           'expense',    A.PRIME),
  txn('2026-06-09', 'Amazon',               42.00, 'Shopping',           'expense',    A.PRIME),
  txn('2026-06-07', 'Amazon',               40.25, 'Shopping',           'expense',    A.PRIME),
  txn('2026-06-03', 'Amazon',                7.49, 'Shopping',           'expense',    A.PRIME),
  // Dining
  txn('2026-06-26', 'Uber Eats',            38.50, 'Dining',             'expense',    A.PLAT),
  txn('2026-06-24', 'Starbucks',            11.40, 'Dining',             'expense',    A.BLUE),
  txn('2026-06-22', 'Uber Eats',            22.30, 'Dining',             'expense',    A.PLAT),
  txn('2026-06-21', 'Tandoori Pizza',       32.15, 'Dining',             'expense',    A.BLUE),
  txn('2026-06-18', 'Uber Eats',            14.20, 'Dining',             'expense',    A.PLAT),
  txn('2026-06-16', 'Starbucks',             5.75, 'Dining',             'expense',    A.BLUE),
  txn('2026-06-14', 'Uber Eats',            23.40, 'Dining',             'expense',    A.PLAT),
  txn('2026-06-12', 'Uber Eats',            20.15, 'Dining',             'expense',    A.PLAT),
  txn('2026-06-10', 'Starbucks',             6.25, 'Dining',             'expense',    A.BLUE),
  txn('2026-06-08', 'Raising Canes',        11.50, 'Dining',             'expense',    A.BLUE),
  txn('2026-06-06', 'Chipotle',             12.80, 'Dining',             'expense',    A.BLUE),
  txn('2026-06-04', 'Curry Leaf Indian',    26.00, 'Dining',             'expense',    A.BLUE),
  txn('2026-06-02', 'Cava',                 12.45, 'Dining',             'expense',    A.BLUE),
  // Groceries
  txn('2026-06-22', 'Costco',              349.00, 'Groceries',          'expense',    A.CITI),
  txn('2026-06-14', 'Patel Brothers',       47.50, 'Groceries',          'expense',    A.BLUE),
  txn('2026-06-07', "Fry's Market",         33.00, 'Groceries',          'expense',    A.BLUE),
  // Utilities
  txn('2026-06-20', 'Southwest Gas',        50.00, 'Utilities',          'expense',    A.CHK),
  txn('2026-06-20', 'Srp Electric',        220.00, 'Utilities',          'expense',    A.CHK),
  txn('2026-06-15', 'Gilbert Water',       160.00, 'Utilities',          'expense',    A.CHK),
  // Healthcare
  txn('2026-06-22', 'Walgreens',             7.50, 'Healthcare',         'expense',    A.BLUE),
  txn('2026-06-18', 'Walgreens',            18.99, 'Healthcare',         'expense',    A.BLUE),
  // Car Insurance
  txn('2026-06-10', 'Geico',               142.00, 'Car Insurance',      'expense',    A.CHK),
  // Subscriptions
  txn('2026-06-15', 'Google One',           21.99, 'Subscriptions',      'expense',    A.BLUE),
  txn('2026-06-10', 'Openai',               8.00, 'Subscriptions',       'expense',    A.BLUE),
  txn('2026-06-08', 'Ring',                10.00, 'Subscriptions',       'expense',    A.BLUE),
  txn('2026-06-01', 'Youtube Premium',      29.99, 'Subscriptions',      'expense',    A.PLAT),
  // Misc
  txn('2026-06-20', 'Fedex',               10.50, 'Misc',               'expense',    A.PLAT),
  txn('2026-06-18', 'Fedex',               48.00, 'Misc',               'expense',    A.PLAT),
  txn('2026-06-17', 'Matboard And More',   38.50, 'Misc',               'expense',    A.PLAT),
  txn('2026-06-15', 'The Ups Store',       20.00, 'Misc',               'expense',    A.BLUE),
  txn('2026-06-12', 'Autozone',            16.99, 'Misc',               'expense',    A.BLUE),
  txn('2026-06-09', 'Pmc Parking',          8.00, 'Misc',               'expense',    A.BLUE),

  // ── May 2026 ──────────────────────────────────────────────────────────────
  txn('2026-05-15', 'Payroll',            4358.00, 'Income',             'income',     A.CHK, 'batch-05'),
  txn('2026-05-01', 'Payroll',            4358.00, 'Income',             'income',     A.CHK, 'batch-05'),
  txn('2026-05-25', 'M1 Payments',         500.00, 'Taxable Brokerage',  'investment', A.CHK, 'batch-05'),
  txn('2026-05-15', 'M1 Payments',         500.00, 'Taxable Brokerage',  'investment', A.CHK, 'batch-05'),
  txn('2026-05-15', 'My529',               100.00, '529 Plan',           'investment', A.CHK, 'batch-05'),
  txn('2026-05-05', 'Car Loan Payment',    689.00, 'Car Loan',           'debt',       A.CHK, 'batch-05'),
  txn('2026-05-20', 'Southwest Airlines',  389.00, 'Travel',             'expense',    A.PLAT, 'batch-05'),
  txn('2026-05-18', 'Costco',             285.00, 'Groceries',           'expense',    A.CITI, 'batch-05'),
  txn('2026-05-15', 'Whole Foods',         122.50, 'Groceries',          'expense',    A.BLUE, 'batch-05'),
  txn('2026-05-10', 'Amazon',             150.00, 'Shopping',            'expense',    A.PRIME, 'batch-05'),
  txn('2026-05-08', 'Amazon',              89.99, 'Shopping',            'expense',    A.PRIME, 'batch-05'),
  txn('2026-05-22', 'Uber Eats',           45.20, 'Dining',              'expense',    A.PLAT, 'batch-05'),
  txn('2026-05-18', 'Starbucks',           12.50, 'Dining',              'expense',    A.BLUE, 'batch-05'),
  txn('2026-05-12', 'Chipotle',            18.50, 'Dining',              'expense',    A.BLUE, 'batch-05'),
  txn('2026-05-14', 'Raising Canes',       11.50, 'Dining',              'expense',    A.BLUE, 'batch-05'),
  txn('2026-05-20', 'Srp Electric',       195.00, 'Utilities',           'expense',    A.CHK, 'batch-05'),
  txn('2026-05-15', 'Southwest Gas',       48.00, 'Utilities',           'expense',    A.CHK, 'batch-05'),
  txn('2026-05-10', 'Geico',              142.00, 'Car Insurance',       'expense',    A.CHK, 'batch-05'),
  txn('2026-05-05', 'Netflix',             15.49, 'Subscriptions',       'expense',    A.BLUE, 'batch-05'),
  txn('2026-05-01', 'Spotify',             10.99, 'Subscriptions',       'expense',    A.BLUE, 'batch-05'),
  txn('2026-05-15', 'Walgreens',           24.99, 'Healthcare',          'expense',    A.BLUE, 'batch-05'),

  // ── April 2026 ────────────────────────────────────────────────────────────
  txn('2026-04-15', 'Payroll',            4358.00, 'Income',             'income',     A.CHK, 'batch-04'),
  txn('2026-04-01', 'Payroll',            4358.00, 'Income',             'income',     A.CHK, 'batch-04'),
  txn('2026-04-25', 'M1 Payments',         500.00, 'Taxable Brokerage',  'investment', A.CHK, 'batch-04'),
  txn('2026-04-15', 'M1 Payments',         500.00, 'Taxable Brokerage',  'investment', A.CHK, 'batch-04'),
  txn('2026-04-15', 'My529',               100.00, '529 Plan',           'investment', A.CHK, 'batch-04'),
  txn('2026-04-05', 'Car Loan Payment',    689.00, 'Car Loan',           'debt',       A.CHK, 'batch-04'),
  txn('2026-04-18', 'Costco',             295.00, 'Groceries',           'expense',    A.CITI, 'batch-04'),
  txn('2026-04-14', 'Whole Foods',         132.50, 'Groceries',          'expense',    A.BLUE, 'batch-04'),
  txn('2026-04-10', 'Amazon',             210.00, 'Shopping',            'expense',    A.PRIME, 'batch-04'),
  txn('2026-04-08', 'Amazon',              65.00, 'Shopping',            'expense',    A.PRIME, 'batch-04'),
  txn('2026-04-22', 'Uber Eats',           38.40, 'Dining',              'expense',    A.PLAT, 'batch-04'),
  txn('2026-04-16', 'Chipotle',            15.50, 'Dining',              'expense',    A.BLUE, 'batch-04'),
  txn('2026-04-20', 'Srp Electric',       180.00, 'Utilities',           'expense',    A.CHK, 'batch-04'),
  txn('2026-04-15', 'Southwest Gas',       45.00, 'Utilities',           'expense',    A.CHK, 'batch-04'),
  txn('2026-04-10', 'Geico',              142.00, 'Car Insurance',       'expense',    A.CHK, 'batch-04'),
  txn('2026-04-05', 'Netflix',             15.49, 'Subscriptions',       'expense',    A.BLUE, 'batch-04'),
  txn('2026-04-01', 'Spotify',             10.99, 'Subscriptions',       'expense',    A.BLUE, 'batch-04'),
  txn('2026-04-15', 'Walgreens',           32.00, 'Healthcare',          'expense',    A.BLUE, 'batch-04'),

  // ── March 2026 ────────────────────────────────────────────────────────────
  txn('2026-03-15', 'Payroll',            4358.00, 'Income',             'income',     A.CHK, 'batch-03'),
  txn('2026-03-01', 'Payroll',            4358.00, 'Income',             'income',     A.CHK, 'batch-03'),
  txn('2026-03-25', 'M1 Payments',        1000.00, 'Taxable Brokerage',  'investment', A.CHK, 'batch-03'),
  txn('2026-03-15', 'My529',               100.00, '529 Plan',           'investment', A.CHK, 'batch-03'),
  txn('2026-03-05', 'Car Loan Payment',    689.00, 'Car Loan',           'debt',       A.CHK, 'batch-03'),
  txn('2026-03-18', 'Costco',             310.00, 'Groceries',           'expense',    A.CITI, 'batch-03'),
  txn('2026-03-14', 'Whole Foods',         145.00, 'Groceries',          'expense',    A.BLUE, 'batch-03'),
  txn('2026-03-10', 'Amazon',             175.00, 'Shopping',            'expense',    A.PRIME, 'batch-03'),
  txn('2026-03-08', 'Best Buy',           320.00, 'Shopping',            'expense',    A.BLUE, 'batch-03'),
  txn('2026-03-22', 'Uber Eats',           28.50, 'Dining',              'expense',    A.PLAT, 'batch-03'),
  txn('2026-03-16', 'Starbucks',            8.75, 'Dining',              'expense',    A.BLUE, 'batch-03'),
  txn('2026-03-20', 'Srp Electric',       165.00, 'Utilities',           'expense',    A.CHK, 'batch-03'),
  txn('2026-03-10', 'Geico',              142.00, 'Car Insurance',       'expense',    A.CHK, 'batch-03'),
  txn('2026-03-05', 'Netflix',             15.49, 'Subscriptions',       'expense',    A.BLUE, 'batch-03'),
  txn('2026-03-01', 'Spotify',             10.99, 'Subscriptions',       'expense',    A.BLUE, 'batch-03'),

  // ── February 2026 ─────────────────────────────────────────────────────────
  txn('2026-02-15', 'Payroll',            4358.00, 'Income',             'income',     A.CHK, 'batch-02'),
  txn('2026-02-01', 'Payroll',            4358.00, 'Income',             'income',     A.CHK, 'batch-02'),
  txn('2026-02-25', 'M1 Payments',         500.00, 'Taxable Brokerage',  'investment', A.CHK, 'batch-02'),
  txn('2026-02-15', 'M1 Payments',         500.00, 'Taxable Brokerage',  'investment', A.CHK, 'batch-02'),
  txn('2026-02-15', 'My529',               100.00, '529 Plan',           'investment', A.CHK, 'batch-02'),
  txn('2026-02-05', 'Car Loan Payment',    689.00, 'Car Loan',           'debt',       A.CHK, 'batch-02'),
  txn('2026-02-14', 'Marriott',           450.00, 'Travel',              'expense',    A.PLAT, 'batch-02'),
  txn('2026-02-18', 'Costco',             280.00, 'Groceries',           'expense',    A.CITI, 'batch-02'),
  txn('2026-02-10', 'Amazon',             130.00, 'Shopping',            'expense',    A.PRIME, 'batch-02'),
  txn('2026-02-22', 'Uber Eats',           32.50, 'Dining',              'expense',    A.PLAT, 'batch-02'),
  txn('2026-02-16', 'Starbucks',            7.50, 'Dining',              'expense',    A.BLUE, 'batch-02'),
  txn('2026-02-20', 'Srp Electric',       155.00, 'Utilities',           'expense',    A.CHK, 'batch-02'),
  txn('2026-02-10', 'Geico',              142.00, 'Car Insurance',       'expense',    A.CHK, 'batch-02'),
  txn('2026-02-05', 'Netflix',             15.49, 'Subscriptions',       'expense',    A.BLUE, 'batch-02'),

  // ── January 2026 ──────────────────────────────────────────────────────────
  txn('2026-01-15', 'Payroll',            4358.00, 'Income',             'income',     A.CHK, 'batch-01'),
  txn('2026-01-01', 'Payroll',            4358.00, 'Income',             'income',     A.CHK, 'batch-01'),
  txn('2026-01-25', 'M1 Payments',         500.00, 'Taxable Brokerage',  'investment', A.CHK, 'batch-01'),
  txn('2026-01-15', 'M1 Payments',         500.00, 'Taxable Brokerage',  'investment', A.CHK, 'batch-01'),
  txn('2026-01-15', 'My529',               100.00, '529 Plan',           'investment', A.CHK, 'batch-01'),
  txn('2026-01-05', 'Car Loan Payment',    689.00, 'Car Loan',           'debt',       A.CHK, 'batch-01'),
  txn('2026-01-18', 'Costco',             320.00, 'Groceries',           'expense',    A.CITI, 'batch-01'),
  txn('2026-01-14', 'Whole Foods',         155.00, 'Groceries',          'expense',    A.BLUE, 'batch-01'),
  txn('2026-01-10', 'Amazon',             210.00, 'Shopping',            'expense',    A.PRIME, 'batch-01'),
  txn('2026-01-22', 'Uber Eats',           29.50, 'Dining',              'expense',    A.PLAT, 'batch-01'),
  txn('2026-01-16', 'Starbucks',            9.50, 'Dining',              'expense',    A.BLUE, 'batch-01'),
  txn('2026-01-20', 'Srp Electric',       172.00, 'Utilities',           'expense',    A.CHK, 'batch-01'),
  txn('2026-01-10', 'Geico',              142.00, 'Car Insurance',       'expense',    A.CHK, 'batch-01'),
  txn('2026-01-05', 'Netflix',             15.49, 'Subscriptions',       'expense',    A.BLUE, 'batch-01'),
  txn('2026-01-01', 'Spotify',             10.99, 'Subscriptions',       'expense',    A.BLUE, 'batch-01'),
]

// ─── Computed views (mirrors SQL aggregations) ─────────────────────────────

function round2(n: number) { return Math.round(n * 100) / 100 }

export function computeMonthlySummaries(userId: string) {
  type Bucket = { income: number; expenses: number; invested: number; debt_payments: number }
  const map = new Map<string, Bucket>()

  for (const t of MOCK_TRANSACTIONS) {
    if (t.user_id !== userId) continue
    const y = parseInt(t.date.slice(0, 4))
    const m = parseInt(t.date.slice(5, 7))
    const key = `${y}-${m}`
    if (!map.has(key)) map.set(key, { income: 0, expenses: 0, invested: 0, debt_payments: 0 })
    const b = map.get(key)!
    if      (t.txn_type === 'income')     b.income     += t.amount
    else if (t.txn_type === 'expense')    b.expenses   += t.amount
    else if (t.txn_type === 'investment') b.invested   += t.amount
    else if (t.txn_type === 'debt')       b.debt_payments += t.amount
  }

  return Array.from(map.entries())
    .map(([key, b]) => {
      const [y, mo] = key.split('-').map(Number)
      const rate = b.income > 0
        ? Math.round(10 * (b.income - b.expenses - b.debt_payments) / b.income * 100) / 10
        : null
      return {
        user_id:          userId,
        year:             y,
        month:            mo,
        income:           round2(b.income),
        expenses:         round2(b.expenses),
        invested:         round2(b.invested),
        debt_payments:    round2(b.debt_payments),
        savings_rate_pct: rate,
      }
    })
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
}

export function computeMonthlyCategoryTotals(userId: string) {
  type Key = string
  const map = new Map<Key, { user_id: string; year: number; month: number; category: string; txn_type: string; transaction_count: number; total_amount: number }>()

  for (const t of MOCK_TRANSACTIONS) {
    if (t.user_id !== userId) continue
    const y = parseInt(t.date.slice(0, 4))
    const m = parseInt(t.date.slice(5, 7))
    const key = `${y}-${m}-${t.category}-${t.txn_type}`
    if (!map.has(key)) {
      map.set(key, { user_id: userId, year: y, month: m, category: t.category, txn_type: t.txn_type, transaction_count: 0, total_amount: 0 })
    }
    const g = map.get(key)!
    g.transaction_count++
    g.total_amount = round2(g.total_amount + t.amount)
  }

  return Array.from(map.values())
}

// ─── Unified mock DB accessor ─────────────────────────────────────────────────

export function getMockTable(tableName: string, userId: string): any[] {
  switch (tableName) {
    case 'accounts':                return MOCK_ACCOUNTS
    case 'categories':              return MOCK_CATEGORIES
    case 'import_batches':          return MOCK_IMPORT_BATCHES
    case 'transactions':            return MOCK_TRANSACTIONS
    case 'monthly_summaries':       return computeMonthlySummaries(userId)
    case 'monthly_category_totals': return computeMonthlyCategoryTotals(userId)
    default:                        return []
  }
}
