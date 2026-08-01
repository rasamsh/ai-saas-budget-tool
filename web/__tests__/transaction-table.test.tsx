import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TransactionTable } from '@/components/transaction-table'
import type { Transaction, Category } from '@/lib/supabase/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({ update: () => ({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
  }),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    date: '2026-06-15',
    description: 'STARBUCKS STORE 123',
    merchant: 'Starbucks',
    amount: 6.50,
    account: 'amex-blue',
    bank: 'amex',
    category: 'Dining',
    txn_type: 'expense',
    hash: '',
    user_id: 'user-1',
    accounts: { id: 'acc-1', name: 'Amex Blue', bank: 'amex', user_id: 'user-1', created_at: '' },
    categories: { name: 'Dining', txn_type: 'expense', color: '#f97316' },
    ...overrides,
  } as Transaction
}

const DINING: Category    = { name: 'Dining',    txn_type: 'expense', color: '#f97316' }
const GROCERIES: Category = { name: 'Groceries', txn_type: 'expense', color: '#22c55e' }
const INCOME_CAT: Category = { name: 'Income',   txn_type: 'income',  color: '#16a34a' }

const categories: Category[] = [DINING, GROCERIES, INCOME_CAT]

const txnDining = makeTransaction({ merchant: 'Starbucks', category: 'Dining', amount: 6.5,  date: '2026-06-15', txn_type: 'expense' })
const txnGroceries = makeTransaction({ merchant: 'Whole Foods', category: 'Groceries', amount: 120.0, date: '2026-06-10', txn_type: 'expense' })
const txnIncome = makeTransaction({ merchant: 'Employer', category: 'Income', amount: 5000, date: '2026-06-01', txn_type: 'income' })

const defaultTransactions = [txnDining, txnGroceries, txnIncome]

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
describe('TransactionTable — rendering', () => {
  it('renders all transaction merchants', () => {
    render(<TransactionTable transactions={defaultTransactions} categories={categories} />)
    expect(screen.getByText('Starbucks')).toBeInTheDocument()
    expect(screen.getByText('Whole Foods')).toBeInTheDocument()
    expect(screen.getByText('Employer')).toBeInTheDocument()
  })

  it('shows empty state when no transactions', () => {
    render(<TransactionTable transactions={[]} categories={[]} />)
    expect(screen.getByText(/no transactions match/i)).toBeInTheDocument()
  })

  it('renders the search input', () => {
    render(<TransactionTable transactions={defaultTransactions} categories={categories} />)
    expect(screen.getByPlaceholderText(/search merchants/i)).toBeInTheDocument()
  })

  it('shows the transaction count in the footer', () => {
    render(<TransactionTable transactions={defaultTransactions} categories={categories} />)
    expect(screen.getByText(/3 transactions/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Search filtering
// ---------------------------------------------------------------------------
describe('TransactionTable — search filter', () => {
  it('filters by merchant name (case-insensitive)', async () => {
    const user = userEvent.setup()
    render(<TransactionTable transactions={defaultTransactions} categories={categories} />)
    await user.type(screen.getByPlaceholderText(/search merchants/i), 'starbucks')
    expect(screen.getByText('Starbucks')).toBeInTheDocument()
    expect(screen.queryByText('Whole Foods')).not.toBeInTheDocument()
  })

  it('shows empty state when search matches nothing', async () => {
    const user = userEvent.setup()
    render(<TransactionTable transactions={defaultTransactions} categories={categories} />)
    await user.type(screen.getByPlaceholderText(/search merchants/i), 'zzznomatch')
    expect(screen.getByText(/no transactions match/i)).toBeInTheDocument()
  })

  it('restores all rows when search is cleared', async () => {
    const user = userEvent.setup()
    render(<TransactionTable transactions={defaultTransactions} categories={categories} />)
    const input = screen.getByPlaceholderText(/search merchants/i)
    await user.type(input, 'starbucks')
    await user.clear(input)
    expect(screen.getByText('Whole Foods')).toBeInTheDocument()
    expect(screen.getByText('Employer')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Type filtering
// ---------------------------------------------------------------------------
describe('TransactionTable — type filter', () => {
  it('filters to expense only when Expense pill is clicked', async () => {
    const user = userEvent.setup()
    render(<TransactionTable transactions={defaultTransactions} categories={categories} />)
    await user.click(screen.getByRole('button', { name: 'Filter by type: Expense' }))
    expect(screen.getByText('Starbucks')).toBeInTheDocument()
    expect(screen.getByText('Whole Foods')).toBeInTheDocument()
    expect(screen.queryByText('Employer')).not.toBeInTheDocument()
  })

  it('filters to income only when Income pill is clicked', async () => {
    const user = userEvent.setup()
    render(<TransactionTable transactions={defaultTransactions} categories={categories} />)
    // aria-label disambiguates the type pill from the category chip with the same text
    await user.click(screen.getByRole('button', { name: 'Filter by type: Income' }))
    expect(screen.getByText('Employer')).toBeInTheDocument()
    expect(screen.queryByText('Starbucks')).not.toBeInTheDocument()
  })

  it('deselects type filter on second click', async () => {
    const user = userEvent.setup()
    render(<TransactionTable transactions={defaultTransactions} categories={categories} />)
    await user.click(screen.getByRole('button', { name: 'Filter by type: Expense' }))
    await user.click(screen.getByRole('button', { name: 'Filter by type: Expense' }))
    expect(screen.getByText('Employer')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
describe('TransactionTable — pagination', () => {
  function make26Transactions(): Transaction[] {
    return Array.from({ length: 26 }, (_, i) =>
      makeTransaction({
        id: `txn-${i}`,
        merchant: `Merchant ${String(i + 1).padStart(2, '0')}`,
        date: `2026-06-${String((i % 28) + 1).padStart(2, '0')}`,
        amount: 10 + i,
      })
    )
  }

  it('shows only 25 rows on page 1 when there are 26 transactions', () => {
    // Default sort is date DESC: Merchant 26 (Jun 26) → Merchant 02 (Jun 02) on page 1;
    // Merchant 01 (Jun 01) is pushed to page 2.
    render(<TransactionTable transactions={make26Transactions()} categories={categories} />)
    expect(screen.getByText('Merchant 26')).toBeInTheDocument()
    expect(screen.queryByText('Merchant 01')).not.toBeInTheDocument()
  })

  it('shows pagination arrows when items exceed page size', () => {
    render(<TransactionTable transactions={make26Transactions()} categories={categories} />)
    expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument()
  })

  it('does not show pagination arrows for 25 or fewer transactions', () => {
    render(<TransactionTable transactions={defaultTransactions} categories={categories} />)
    expect(screen.queryByRole('button', { name: /previous page/i })).not.toBeInTheDocument()
  })

  it('prev arrow is disabled on page 1', () => {
    render(<TransactionTable transactions={make26Transactions()} categories={categories} />)
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled()
  })

  it('advances to page 2 on next click and shows Merchant 01', async () => {
    // Page 2 contains only the oldest transaction (Jun 01 = Merchant 01) in DESC sort.
    const user = userEvent.setup()
    render(<TransactionTable transactions={make26Transactions()} categories={categories} />)
    await user.click(screen.getByRole('button', { name: /next page/i }))
    expect(screen.getByText('Merchant 01')).toBeInTheDocument()
    expect(screen.queryByText('Merchant 26')).not.toBeInTheDocument()
  })

  it('shows Showing X–Y of Z footer on multi-page', () => {
    render(<TransactionTable transactions={make26Transactions()} categories={categories} />)
    expect(screen.getByText(/Showing 1–25 of 26/)).toBeInTheDocument()
  })

  it('resets to page 1 when search filter changes', async () => {
    const user = userEvent.setup()
    const txns = make26Transactions()
    render(<TransactionTable transactions={txns} categories={categories} />)
    // Navigate to page 2 (Merchant 01 visible in DESC sort)
    await user.click(screen.getByRole('button', { name: /next page/i }))
    expect(screen.getByText('Merchant 01')).toBeInTheDocument()
    // Typing resets to page 1
    await user.type(screen.getByPlaceholderText(/search merchants/i), 'Merchant')
    expect(screen.getByText(/Showing 1–25 of 26/)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Flags & notes
// ---------------------------------------------------------------------------
describe('TransactionTable — flags & notes', () => {
  it('renders an edit trigger for each visible transaction', () => {
    render(<TransactionTable transactions={defaultTransactions} categories={categories} />)
    expect(screen.getByRole('button', { name: /flag or add notes for starbucks/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /flag or add notes for whole foods/i })).toBeInTheDocument()
  })

  it('shows a flag pill when a transaction has a flag set', () => {
    const flagged = makeTransaction({ merchant: 'Costco', category: 'Shopping', flag: 'reimbursable' })
    render(<TransactionTable transactions={[flagged]} categories={categories} />)
    expect(screen.getByText('Reimbursable')).toBeInTheDocument()
  })

  it('does not show a flag pill when no flag is set', () => {
    render(<TransactionTable transactions={[txnDining]} categories={categories} />)
    expect(screen.queryByText('Reimbursable')).not.toBeInTheDocument()
    expect(screen.queryByText('One-time')).not.toBeInTheDocument()
    expect(screen.queryByText('Excluded')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------
describe('TransactionTable — sorting', () => {
  it('sorts by date descending by default (most recent first)', () => {
    render(<TransactionTable transactions={defaultTransactions} categories={categories} />)
    const rows = screen.getAllByRole('row')
    // Header is rows[0]; first data row should be the most recent date
    expect(within(rows[1]).getByText('Starbucks')).toBeInTheDocument() // 2026-06-15
  })

  it('toggles date sort direction on second click', async () => {
    const user = userEvent.setup()
    render(<TransactionTable transactions={defaultTransactions} categories={categories} />)
    const dateHeader = screen.getByRole('columnheader', { name: /date/i })
    await user.click(dateHeader) // asc
    await user.click(dateHeader) // desc again
    const rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByText('Starbucks')).toBeInTheDocument()
  })
})
