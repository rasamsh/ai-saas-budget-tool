"""
Citi CSV parser.

Headers: Status, Date, Description, Debit, Credit, Member Name

- Debit column populated (non-empty, non-zero) = charge → include
- Credit column populated = credit → parse_refunds() only
- Member Name column is NEVER stored (PII).
"""

import csv
from dateutil.parser import parse as parse_date

from categorizer import clean_merchant
from parsers.transaction import Transaction


def _read_rows(file_path: str) -> list[dict]:
    rows = []
    with open(file_path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def _parse_amount(value: str) -> float:
    """Parse a dollar amount string, returning 0.0 if empty or invalid."""
    val = value.strip().replace(",", "").replace("$", "")
    if not val:
        return 0.0
    try:
        return float(val)
    except ValueError:
        return 0.0


def parse(file_path: str, account: str) -> list[Transaction]:
    """
    Parse Citi CSV. Returns debit (charge) transactions only.
    Drops Member Name column (PII).
    """
    rows = _read_rows(file_path)
    transactions: list[Transaction] = []

    for row in rows:
        raw_desc = row.get("Description", "").strip()
        if not raw_desc:
            continue

        try:
            txn_date = parse_date(row.get("Date", "").strip()).date()
        except Exception:
            continue

        debit_amount = _parse_amount(row.get("Debit", ""))

        if debit_amount > 0:
            merchant = clean_merchant(raw_desc)
            txn = Transaction(
                date=txn_date,
                description=raw_desc,
                merchant=merchant,
                amount=debit_amount,
                account=account,
                bank="citi",
                category="Misc",
                txn_type="expense",
            )
            transactions.append(txn)

    return transactions


def parse_refunds(file_path: str, account: str) -> list[Transaction]:
    """
    Parse Citi CSV. Returns credit transactions only.
    Drops Member Name column (PII).
    """
    rows = _read_rows(file_path)
    refunds: list[Transaction] = []

    for row in rows:
        raw_desc = row.get("Description", "").strip()
        if not raw_desc:
            continue

        try:
            txn_date = parse_date(row.get("Date", "").strip()).date()
        except Exception:
            continue

        credit_amount = _parse_amount(row.get("Credit", ""))

        if credit_amount > 0:
            merchant = clean_merchant(raw_desc)
            txn = Transaction(
                date=txn_date,
                description=raw_desc,
                merchant=merchant,
                amount=credit_amount,
                account=account,
                bank="citi",
                category="Misc",
                txn_type="expense",
            )
            refunds.append(txn)

    return refunds
