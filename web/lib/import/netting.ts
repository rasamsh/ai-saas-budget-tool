// Faithful TS port of budget.py :: _net_refunds (two-pass refund netting).
//
// Pass 1 matches expense/refund pairs on (description.upper(), amount@2dp).
// Pass 2 matches remaining pairs on amount alone. Each refund is consumed at
// most once — we track consumption by index (not by value) to avoid the
// over-matching a naive value-equality port would cause with duplicate refunds.

import type { ParsedTransaction } from './types'

function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100
}

export function netRefunds(
  transactions: ParsedTransaction[],
  refunds: ParsedTransaction[],
): ParsedTransaction[] {
  const consumed = new Array<boolean>(refunds.length).fill(false)

  // Pass 1: exact (description, amount) match — queues of refund indices per key
  const byKey = new Map<string, number[]>()
  refunds.forEach((r, i) => {
    const key = `${r.description.toUpperCase()}|${round2(r.amount)}`
    const q = byKey.get(key)
    if (q) q.push(i)
    else byKey.set(key, [i])
  })

  const remainingTxns: ParsedTransaction[] = []
  for (const txn of transactions) {
    const key = `${txn.description.toUpperCase()}|${round2(txn.amount)}`
    const q = byKey.get(key)
    if (q && q.length > 0) {
      consumed[q.shift()!] = true
    } else {
      remainingTxns.push(txn)
    }
  }

  // Pass 2: amount-only match on leftover refunds
  const byAmount = new Map<number, number[]>()
  refunds.forEach((r, i) => {
    if (consumed[i]) return
    const k = round2(r.amount)
    const q = byAmount.get(k)
    if (q) q.push(i)
    else byAmount.set(k, [i])
  })

  const finalTxns: ParsedTransaction[] = []
  for (const txn of remainingTxns) {
    const q = byAmount.get(round2(txn.amount))
    if (q && q.length > 0) {
      consumed[q.shift()!] = true
    } else {
      finalTxns.push(txn)
    }
  }

  return finalTxns
}
