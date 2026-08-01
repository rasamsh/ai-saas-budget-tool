"""
Chase CSV parser — supports both Chase credit card and Chase checking formats.

Credit card headers:
    Transaction Date, Post Date, Description, Category, Type, Amount, Memo

Checking headers:
    Details, Posting Date, Description, Amount, Type, Balance, Check or Slip #
"""

import csv
from datetime import date as Date
from dateutil.parser import parse as parse_date

from categorizer import clean_merchant
from parsers.transaction import Transaction


def _detect_format(file_path: str) -> str:
    """Return 'credit' or 'checking' based on header row."""
    with open(file_path, encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        for row in reader:
            if not row:
                continue
            headers = [h.strip().lower() for h in row]
            if "transaction date" in headers:
                return "credit"
            if "details" in headers and "posting date" in headers:
                return "checking"
            # If we hit a row with content but no match, stop
            break
    return "credit"  # default fallback


def _parse_credit(file_path: str, account: str) -> tuple[list[Transaction], list[Transaction]]:
    """
    Parse Chase credit card CSV.
    Returns (expenses, refunds).
    Negative Amount = charge (expense), Positive Amount = payment/credit (refund).
    """
    expenses: list[Transaction] = []
    refunds: list[Transaction] = []

    with open(file_path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            raw_desc = row.get("Description", "").strip()
            if not raw_desc:
                continue

            try:
                amount_raw = float(row.get("Amount", "0").strip().replace(",", ""))
            except ValueError:
                continue

            try:
                txn_date = parse_date(row.get("Transaction Date", "").strip()).date()
            except Exception:
                continue

            merchant = clean_merchant(raw_desc)

            if amount_raw < 0:
                # Charge — flip to positive
                txn = Transaction(
                    date=txn_date,
                    description=raw_desc,
                    merchant=merchant,
                    amount=abs(amount_raw),
                    account=account,
                    bank="chase",
                    category="Misc",
                    txn_type="expense",
                )
                expenses.append(txn)
            elif amount_raw > 0:
                # Payment or credit — goes to refunds
                txn = Transaction(
                    date=txn_date,
                    description=raw_desc,
                    merchant=merchant,
                    amount=amount_raw,
                    account=account,
                    bank="chase",
                    category="Misc",
                    txn_type="expense",
                )
                refunds.append(txn)

    return expenses, refunds


def _parse_checking(file_path: str, account: str) -> tuple[list[Transaction], list[Transaction]]:
    """
    Parse Chase checking CSV.
    Returns (debits, credits).
    Negative Amount = debit (expense), Positive Amount = credit (income initially).
    """
    expenses: list[Transaction] = []
    refunds: list[Transaction] = []

    with open(file_path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            raw_desc = row.get("Description", "").strip()
            if not raw_desc:
                continue

            try:
                amount_raw = float(row.get("Amount", "0").strip().replace(",", ""))
            except ValueError:
                continue

            try:
                txn_date = parse_date(row.get("Posting Date", "").strip()).date()
            except Exception:
                continue

            merchant = clean_merchant(raw_desc)

            if amount_raw < 0:
                # Debit
                txn = Transaction(
                    date=txn_date,
                    description=raw_desc,
                    merchant=merchant,
                    amount=abs(amount_raw),
                    account=account,
                    bank="chase",
                    category="Misc",
                    txn_type="expense",
                )
                expenses.append(txn)
            elif amount_raw > 0:
                # Credit — mark as income initially; categorizer may override
                txn = Transaction(
                    date=txn_date,
                    description=raw_desc,
                    merchant=merchant,
                    amount=amount_raw,
                    account=account,
                    bank="chase",
                    category="Income",
                    txn_type="income",
                )
                refunds.append(txn)

    return expenses, refunds


def parse(file_path: str, account: str) -> list[Transaction]:
    """
    Parse a Chase CSV (auto-detects credit vs checking).
    Returns expense/debit transactions only.
    """
    fmt = _detect_format(file_path)
    if fmt == "credit":
        expenses, _ = _parse_credit(file_path, account)
        return expenses
    else:
        expenses, credits = _parse_checking(file_path, account)
        # For checking, credits (income) are also returned as part of main parse
        return expenses + credits


def parse_refunds(file_path: str, account: str) -> list[Transaction]:
    """
    Parse a Chase CSV and return only refunds/credits.
    For credit cards: positive amounts (payments/credits).
    For checking: this returns an empty list since credits are handled in parse().
    """
    fmt = _detect_format(file_path)
    if fmt == "credit":
        _, refunds = _parse_credit(file_path, account)
        return refunds
    else:
        # Checking credits are already returned by parse(); no separate refunds
        return []
