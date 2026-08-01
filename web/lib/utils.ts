import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

export function formatCurrencyExact(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function formatSavingsRate(rate: number | null): string {
  if (rate === null) return '—'
  return `${rate.toFixed(1)}%`
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? ''
}

export function shortMonthName(month: number): string {
  return monthName(month).slice(0, 3)
}

export const TXN_TYPE_COLORS: Record<string, string> = {
  expense:    'text-red-500',
  income:     'text-green-500',
  investment: 'text-blue-500',
  debt:       'text-amber-500',
}

export interface Trend {
  pct: number
  direction: 'up' | 'down' | 'flat'
  isPositive: boolean  // true = up is good (income, savings rate); false = up is bad (expenses, debt)
  label: string        // e.g. "vs 2025" or "vs Jun '25"
}

export function calcTrend(
  current: number,
  prior: number | null | undefined,
  isPositive: boolean,
  label: string,
): Trend | null {
  if (prior === null || prior === undefined || prior === 0) return null
  const raw = ((current - prior) / Math.abs(prior)) * 100
  const flat = Math.abs(raw) < 0.5
  return {
    pct: Math.min(Math.abs(raw), 999),
    direction: flat ? 'flat' : raw > 0 ? 'up' : 'down',
    isPositive,
    label,
  }
}

export const TXN_TYPE_LABELS: Record<string, string> = {
  expense:    'Expense',
  income:     'Income',
  investment: 'Invested',
  debt:       'Debt',
}
