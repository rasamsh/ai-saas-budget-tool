"""
Tests for the per-file processing helpers in budget.py.
"""

import os
import sys
from datetime import date

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from budget import _apply_exclude_patterns
from parsers.transaction import Transaction


# Chase Checking's manifest exclusions: card autopay already tracked from the
# card's own statement.
EXCLUDES = ["AMERICAN EXPRESS", "CHASE CREDIT CRD", "CHECK "]


def txn(description: str, txn_type: str = "expense") -> Transaction:
    return Transaction(
        date=date(2026, 7, 22),
        description=description,
        merchant=description,
        amount=100.00,
        account="Chase Checking",
        bank="chase",
        txn_type=txn_type,
    )


class TestApplyExcludePatterns:
    def test_excludes_matching_debit(self):
        txns = [txn("AMERICAN EXPRESS TRANSFER WEB ID: 124303243")]
        assert _apply_exclude_patterns(txns, EXCLUDES) == []

    def test_keeps_credit_sharing_a_payee_name(self):
        # Exclusions guard against double-counting money OUT. An Amex payroll
        # deposit is money in and must survive the "AMERICAN EXPRESS" pattern.
        payroll = txn("American Express PAYROLL PPD ID: 1133133497", txn_type="income")
        assert _apply_exclude_patterns([payroll], EXCLUDES) == [payroll]

    def test_keeps_unmatched_debit(self):
        groceries = txn("WHOLE FOODS MARKET 123")
        assert _apply_exclude_patterns([groceries], EXCLUDES) == [groceries]

    def test_no_patterns_is_a_passthrough(self):
        txns = [txn("AMERICAN EXPRESS TRANSFER")]
        assert _apply_exclude_patterns(txns, []) == txns
