"""
Bank of America CSV parser — supports credit card and checking formats.

Credit card: Posted Date, Reference Number, Payee, Address, Amount
Checking:    Date, Description, Amount, Running Bal.

BofA prepends non-CSV header lines before the data — skip lines until the
first valid CSV header row (contains a comma and matches expected columns).

- Negative amounts = charges → include, flip to positive
- Reference Number and Address columns are NEVER stored (PII).
"""

import csv
import io
from dateutil.parser import parse as parse_date

from categorizer import clean_merchant
from parsers.transaction import Transaction


_CREDIT_HEADERS = {"posted date", "reference number", "payee", "address", "amount"}
_CHECKING_HEADERS = {"date", "description", "amount", "running bal."}


def _find_data_start(file_path: str) -> tuple[str, int]:
    """
    Scan file lines until we find the CSV header row.
    Returns (format, line_number) where line_number is 0-based.
    """
    with open(file_path, encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    for i, line in enumerate(lines):
        if "," not in line:
            continue
        headers = {h.strip().strip('"').lower() for h in line.split(",")}
        if _CREDIT_HEADERS.issubset(headers):
            return "credit", i
        if _CHECKING_HEADERS.issubset(headers):
            return "checking", i

    return "checking", 0  # fallback


def _read_rows(file_path: str) -> tuple[str, list[dict]]:
    """Return (format, list of row dicts) starting from the header line."""
    fmt, start_line = _find_data_start(file_path)
    with open(file_path, encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    csv_content = "".join(lines[start_line:])
    reader = csv.DictReader(io.StringIO(csv_content))
    rows = list(reader)
    return fmt, rows


def _parse_amount(value: str) -> float:
    val = value.strip().replace(",", "").replace("$", "")
    if not val:
        return 0.0
    try:
        return float(val)
    except ValueError:
        return 0.0


def parse(file_path: str, account: str) -> list[Transaction]:
    """
    Parse a BofA CSV (auto-detects credit vs checking).
    Returns charge/debit transactions only.
    Drops Reference Number and Address columns (PII).
    """
    fmt, rows = _read_rows(file_path)
    transactions: list[Transaction] = []

    for row in rows:
        if fmt == "credit":
            raw_desc = row.get("Payee", "").strip()
            date_str = row.get("Posted Date", "").strip()
            # Drop Reference Number and Address — just don't read them
        else:
            raw_desc = row.get("Description", "").strip()
            date_str = row.get("Date", "").strip()

        if not raw_desc:
            continue

        try:
            txn_date = parse_date(date_str).date()
        except Exception:
            continue

        amount_raw = _parse_amount(row.get("Amount", ""))

        if amount_raw < 0:
            # Charge — flip to positive
            merchant = clean_merchant(raw_desc)
            txn = Transaction(
                date=txn_date,
                description=raw_desc,
                merchant=merchant,
                amount=abs(amount_raw),
                account=account,
                bank="bofa",
                category="Misc",
                txn_type="expense",
            )
            transactions.append(txn)
        elif amount_raw > 0 and fmt == "checking":
            # Checking deposit — mark as income initially
            merchant = clean_merchant(raw_desc)
            txn = Transaction(
                date=txn_date,
                description=raw_desc,
                merchant=merchant,
                amount=amount_raw,
                account=account,
                bank="bofa",
                category="Income",
                txn_type="income",
            )
            transactions.append(txn)

    return transactions


def parse_refunds(file_path: str, account: str) -> list[Transaction]:
    """
    Parse a BofA CSV and return only refunds/credits.
    For credit card: positive amounts are payments/credits.
    For checking: no separate refunds (handled in parse()).
    """
    fmt, rows = _read_rows(file_path)
    refunds: list[Transaction] = []

    if fmt != "credit":
        return refunds

    for row in rows:
        raw_desc = row.get("Payee", "").strip()
        date_str = row.get("Posted Date", "").strip()

        if not raw_desc:
            continue

        try:
            txn_date = parse_date(date_str).date()
        except Exception:
            continue

        amount_raw = _parse_amount(row.get("Amount", ""))

        if amount_raw > 0:
            # Payment or credit
            merchant = clean_merchant(raw_desc)
            txn = Transaction(
                date=txn_date,
                description=raw_desc,
                merchant=merchant,
                amount=amount_raw,
                account=account,
                bank="bofa",
                category="Misc",
                txn_type="expense",
            )
            refunds.append(txn)

    return refunds
