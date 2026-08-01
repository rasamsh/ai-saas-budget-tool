import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TransactionFlagDialog } from '@/components/transaction-flag-dialog'
import type { Transaction } from '@/lib/supabase/types'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

const eq = vi.fn().mockResolvedValue({ data: null, error: null })
const update = vi.fn(() => ({ eq }))
const from = vi.fn(() => ({ update }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from }),
}))

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    date: '2026-06-15',
    merchant: 'Starbucks',
    amount: 6.5,
    category: 'Dining',
    txn_type: 'expense',
    account_id: 'acc-1',
    import_batch_id: null,
    hash: '',
    user_id: 'user-1',
    created_at: '',
    flag: null,
    notes: null,
    ...overrides,
  }
}

beforeEach(() => {
  refresh.mockClear()
  eq.mockClear()
  update.mockClear()
  from.mockClear()
})

describe('TransactionFlagDialog — trigger', () => {
  it('renders a trigger button scoped to the transaction merchant', () => {
    render(<TransactionFlagDialog transaction={makeTransaction()} />)
    expect(screen.getByRole('button', { name: /flag or add notes for starbucks/i })).toBeInTheDocument()
  })

  it('does not render the dialog until the trigger is clicked', () => {
    render(<TransactionFlagDialog transaction={makeTransaction()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('TransactionFlagDialog — opening and pre-fill', () => {
  it('opens the dialog on trigger click', async () => {
    const user = userEvent.setup()
    render(<TransactionFlagDialog transaction={makeTransaction()} />)
    await user.click(screen.getByRole('button', { name: /flag or add notes for starbucks/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('pre-fills the notes textarea with the existing value', async () => {
    const user = userEvent.setup()
    render(<TransactionFlagDialog transaction={makeTransaction({ notes: 'Business lunch' })} />)
    await user.click(screen.getByRole('button', { name: /flag or add notes for starbucks/i }))
    expect(screen.getByLabelText('Notes')).toHaveValue('Business lunch')
  })

  it('pre-selects the existing flag', async () => {
    const user = userEvent.setup()
    render(<TransactionFlagDialog transaction={makeTransaction({ flag: 'reimbursable' })} />)
    await user.click(screen.getByRole('button', { name: /flag or add notes for starbucks/i }))
    expect(screen.getByLabelText('Flag')).toHaveValue('reimbursable')
  })

  it('defaults flag to none when unset', async () => {
    const user = userEvent.setup()
    render(<TransactionFlagDialog transaction={makeTransaction()} />)
    await user.click(screen.getByRole('button', { name: /flag or add notes for starbucks/i }))
    expect(screen.getByLabelText('Flag')).toHaveValue('')
  })
})

describe('TransactionFlagDialog — saving', () => {
  it('calls update with the new flag and notes, scoped to the transaction id', async () => {
    const user = userEvent.setup()
    render(<TransactionFlagDialog transaction={makeTransaction({ id: 'txn-42' })} />)
    await user.click(screen.getByRole('button', { name: /flag or add notes for starbucks/i }))
    await user.selectOptions(screen.getByLabelText('Flag'), 'reimbursable')
    await user.type(screen.getByLabelText('Notes'), 'Work expense')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(from).toHaveBeenCalledWith('transactions')
    expect(update).toHaveBeenCalledWith({ flag: 'reimbursable', notes: 'Work expense' })
    expect(eq).toHaveBeenCalledWith('id', 'txn-42')
  })

  it('sends null flag when reset to none', async () => {
    const user = userEvent.setup()
    render(<TransactionFlagDialog transaction={makeTransaction({ flag: 'reimbursable' })} />)
    await user.click(screen.getByRole('button', { name: /flag or add notes for starbucks/i }))
    await user.selectOptions(screen.getByLabelText('Flag'), '')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(update).toHaveBeenCalledWith({ flag: null, notes: null })
  })

  it('closes the dialog and refreshes the router after a successful save', async () => {
    const user = userEvent.setup()
    render(<TransactionFlagDialog transaction={makeTransaction()} />)
    await user.click(screen.getByRole('button', { name: /flag or add notes for starbucks/i }))
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
  })

  it('does not call update when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<TransactionFlagDialog transaction={makeTransaction()} />)
    await user.click(screen.getByRole('button', { name: /flag or add notes for starbucks/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(update).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
