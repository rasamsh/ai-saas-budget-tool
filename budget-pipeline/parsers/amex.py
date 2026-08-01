"""
Amex CSV parser — supports two export formats.

Short format (3 columns):
    Date, Description, Amount

Full format (5 columns):
    Date, Description, Card Member, Account #, Amount

Amex exports charges as POSITIVE numbers. Credits/refunds are NEGATIVE.
Card Member and Account # are dropped (PII).
"""

import csv
from dateutil.parser import parse as parse_date

from categorizer import clean_merchant
from parsers.transaction import Transaction


def _detect_format(file_path: str) -> str:
    """Return 'short' or 'full' based on column count."""
    with open(file_path, encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        for row in reader:
            if not row:
                continue
            cols = [c.strip() for c in row if c.strip()]
            if len(cols) >= 5:
                return "full"
            return "short"
    return "short"


def _get_amount_col(fmt: str) -> str:
    """Return the header name for the amount column."""
    # Both formats use "Amount" as the last meaningful column
    return "Amount"


def _read_rows(file_path: str) -> tuple[str, list[dict]]:
    """Read all rows from the CSV, returning (format, rows)."""
    fmt = _detect_format(file_path)
    rows = []
    with open(file_path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return fmt, rows


def parse(file_path: str, account: str) -> list[Transaction]:
    """
    Parse Amex CSV. Returns charge transactions only (positive amounts).
    Drops Card Member and Account # columns (PII).
    """
    fmt, rows = _read_rows(file_path)
    transactions: list[Transaction] = []

    for row in rows:
        raw_desc = row.get("Description", "").strip()
        if not raw_desc:
            continue

        try:
            amount_raw = float(row.get("Amount", "0").strip().replace(",", ""))
        except ValueError:
            continue

        try:
            txn_date = parse_date(row.get("Date", "").strip()).date()
        except Exception:
            continue

        # Amex exports charges as POSITIVE; credits/refunds are NEGATIVE
        if amount_raw > 0:
            merchant = clean_merchant(raw_desc)
            txn = Transaction(
                date=txn_date,
                description=raw_desc,
                merchant=merchant,
                amount=amount_raw,
                account=account,
                bank="amex",
                category="Misc",
                txn_type="expense",
            )
            transactions.append(txn)

    return transactions


def parse_refunds(file_path: str, account: str) -> list[Transaction]:
    """
    Parse Amex CSV. Returns credit/refund transactions only (negative amounts).
    Drops Card Member and Account # columns (PII).
    """
    fmt, rows = _read_rows(file_path)
    refunds: list[Transaction] = []

    for row in rows:
        raw_desc = row.get("Description", "").strip()
        if not raw_desc:
            continue

        try:
            amount_raw = float(row.get("Amount", "0").strip().replace(",", ""))
        except ValueError:
            continue

        try:
            txn_date = parse_date(row.get("Date", "").strip()).date()
        except Exception:
            continue

        # Credits/refunds have NEGATIVE amounts in Amex exports
        if amount_raw < 0:
            merchant = clean_merchant(raw_desc)
            txn = Transaction(
                date=txn_date,
                description=raw_desc,
                merchant=merchant,
                amount=abs(amount_raw),
                account=account,
                bank="amex",
                category="Misc",
                txn_type="expense",
            )
            refunds.append(txn)

    return refunds
