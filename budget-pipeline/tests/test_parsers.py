"""
Tests for Chase, Amex, and Citi CSV parsers using in-memory temp files.
"""

import os
import sys
import pytest
from pathlib import Path

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from parsers import chase, amex, citi


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def write_csv(tmp_path: Path, filename: str, content: str) -> str:
    f = tmp_path / filename
    f.write_text(content.strip(), encoding="utf-8")
    return str(f)


# ---------------------------------------------------------------------------
# Chase credit card parser
# ---------------------------------------------------------------------------

CHASE_CREDIT_CSV = """
Transaction Date,Post Date,Description,Category,Type,Amount,Memo
06/15/2026,06/16/2026,STARBUCKS STORE 123,Food & Drink,Sale,-6.50,
06/14/2026,06/15/2026,AMAZON MKTPL*1P66J2KP3,Shopping,Sale,-49.99,
06/13/2026,06/14/2026,PAYMENT THANK YOU,Payment,Payment,200.00,
"""

class TestChaseCredit:
    def test_parses_expense_transactions(self, tmp_path):
        path = write_csv(tmp_path, "chase_credit.csv", CHASE_CREDIT_CSV)
        txns = chase.parse(path, "Chase Sapphire")
        assert len(txns) == 2

    def test_amount_is_positive(self, tmp_path):
        path = write_csv(tmp_path, "chase_credit.csv", CHASE_CREDIT_CSV)
        txns = chase.parse(path, "Chase Sapphire")
        assert all(t.amount > 0 for t in txns)

    def test_excludes_payments(self, tmp_path):
        path = write_csv(tmp_path, "chase_credit.csv", CHASE_CREDIT_CSV)
        txns = chase.parse(path, "Chase Sapphire")
        merchants = [t.merchant for t in txns]
        assert not any("Payment" in m for m in merchants)

    def test_account_name_preserved(self, tmp_path):
        path = write_csv(tmp_path, "chase_credit.csv", CHASE_CREDIT_CSV)
        txns = chase.parse(path, "Chase Sapphire")
        assert all(t.account == "Chase Sapphire" for t in txns)

    def test_bank_is_chase(self, tmp_path):
        path = write_csv(tmp_path, "chase_credit.csv", CHASE_CREDIT_CSV)
        txns = chase.parse(path, "Chase Sapphire")
        assert all(t.bank == "chase" for t in txns)

    def test_refunds_parsed_separately(self, tmp_path):
        path = write_csv(tmp_path, "chase_credit.csv", CHASE_CREDIT_CSV)
        refunds = chase.parse_refunds(path, "Chase Sapphire")
        assert len(refunds) == 1
        assert refunds[0].amount == 200.00

    def test_date_parsed_correctly(self, tmp_path):
        path = write_csv(tmp_path, "chase_credit.csv", CHASE_CREDIT_CSV)
        txns = chase.parse(path, "Chase Sapphire")
        dates = [str(t.date) for t in txns]
        assert "2026-06-15" in dates

    def test_skips_rows_with_missing_description(self, tmp_path):
        csv = "Transaction Date,Post Date,Description,Category,Type,Amount,Memo\n06/15/2026,06/16/2026,,Food & Drink,Sale,-6.50,\n"
        path = write_csv(tmp_path, "chase_empty_desc.csv", csv)
        txns = chase.parse(path, "Chase Sapphire")
        assert len(txns) == 0


# ---------------------------------------------------------------------------
# Chase checking parser
# ---------------------------------------------------------------------------

CHASE_CHECKING_CSV = """
Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,06/15/2026,GROCERY STORE,-120.00,ACH_DEBIT,1000.00,
CREDIT,06/01/2026,PAYROLL DIRECT DEPOSIT,4000.00,ACH_CREDIT,5000.00,
DEBIT,06/14/2026,STARBUCKS,-6.50,DEBIT_CARD,880.00,
"""

class TestChaseChecking:
    def test_debits_and_credits_both_returned(self, tmp_path):
        path = write_csv(tmp_path, "chase_checking.csv", CHASE_CHECKING_CSV)
        txns = chase.parse(path, "Chase Checking")
        assert len(txns) == 3

    def test_debit_txn_type_is_expense(self, tmp_path):
        path = write_csv(tmp_path, "chase_checking.csv", CHASE_CHECKING_CSV)
        txns = chase.parse(path, "Chase Checking")
        expenses = [t for t in txns if t.txn_type == "expense"]
        assert len(expenses) == 2

    def test_credit_txn_type_is_income(self, tmp_path):
        path = write_csv(tmp_path, "chase_checking.csv", CHASE_CHECKING_CSV)
        txns = chase.parse(path, "Chase Checking")
        incomes = [t for t in txns if t.txn_type == "income"]
        assert len(incomes) == 1

    def test_all_amounts_positive(self, tmp_path):
        path = write_csv(tmp_path, "chase_checking.csv", CHASE_CHECKING_CSV)
        txns = chase.parse(path, "Chase Checking")
        assert all(t.amount > 0 for t in txns)

    def test_checking_parse_refunds_returns_empty(self, tmp_path):
        path = write_csv(tmp_path, "chase_checking.csv", CHASE_CHECKING_CSV)
        refunds = chase.parse_refunds(path, "Chase Checking")
        assert refunds == []


# ---------------------------------------------------------------------------
# Chase format detection
# ---------------------------------------------------------------------------

class TestChaseFormatDetection:
    def test_detects_credit_format(self, tmp_path):
        path = write_csv(tmp_path, "credit.csv", CHASE_CREDIT_CSV)
        from parsers.chase import _detect_format
        assert _detect_format(path) == "credit"

    def test_detects_checking_format(self, tmp_path):
        path = write_csv(tmp_path, "checking.csv", CHASE_CHECKING_CSV)
        from parsers.chase import _detect_format
        assert _detect_format(path) == "checking"


# ---------------------------------------------------------------------------
# Amex parser
# ---------------------------------------------------------------------------

AMEX_SHORT_CSV = """
Date,Description,Amount
06/15/2026,STARBUCKS STORE 123,6.50
06/14/2026,WHOLE FOODS MARKET,89.20
06/13/2026,REFUND FROM AMAZON,-25.00
"""

AMEX_FULL_CSV = """
Date,Description,Card Member,Account #,Amount
06/15/2026,NETFLIX.COM,JOHN DOE,1234,15.99
06/14/2026,DELTA AIRLINES,JOHN DOE,1234,320.00
06/13/2026,CREDIT ADJUSTMENT,JOHN DOE,1234,-50.00
"""

class TestAmexShort:
    def test_parses_charges(self, tmp_path):
        path = write_csv(tmp_path, "amex_short.csv", AMEX_SHORT_CSV)
        txns = amex.parse(path, "Amex Blue")
        assert len(txns) == 2

    def test_excludes_credits(self, tmp_path):
        path = write_csv(tmp_path, "amex_short.csv", AMEX_SHORT_CSV)
        txns = amex.parse(path, "Amex Blue")
        assert all(t.amount > 0 for t in txns)

    def test_refunds_are_negative_amounts(self, tmp_path):
        path = write_csv(tmp_path, "amex_short.csv", AMEX_SHORT_CSV)
        refunds = amex.parse_refunds(path, "Amex Blue")
        assert len(refunds) == 1
        assert refunds[0].amount == 25.00  # stored as positive

    def test_bank_is_amex(self, tmp_path):
        path = write_csv(tmp_path, "amex_short.csv", AMEX_SHORT_CSV)
        txns = amex.parse(path, "Amex Blue")
        assert all(t.bank == "amex" for t in txns)


class TestAmexFull:
    def test_parses_full_format(self, tmp_path):
        path = write_csv(tmp_path, "amex_full.csv", AMEX_FULL_CSV)
        txns = amex.parse(path, "Amex Platinum")
        assert len(txns) == 2

    def test_pii_columns_not_in_merchant(self, tmp_path):
        path = write_csv(tmp_path, "amex_full.csv", AMEX_FULL_CSV)
        txns = amex.parse(path, "Amex Platinum")
        for t in txns:
            assert "JOHN DOE" not in t.merchant
            assert "1234" not in t.merchant or t.merchant == "1234"  # card # not leaked

    def test_account_name_set_correctly(self, tmp_path):
        path = write_csv(tmp_path, "amex_full.csv", AMEX_FULL_CSV)
        txns = amex.parse(path, "Amex Platinum")
        assert all(t.account == "Amex Platinum" for t in txns)


class TestAmexFormatDetection:
    def test_detects_short_format(self, tmp_path):
        path = write_csv(tmp_path, "amex_short.csv", AMEX_SHORT_CSV)
        from parsers.amex import _detect_format
        assert _detect_format(path) == "short"

    def test_detects_full_format(self, tmp_path):
        path = write_csv(tmp_path, "amex_full.csv", AMEX_FULL_CSV)
        from parsers.amex import _detect_format
        assert _detect_format(path) == "full"


# ---------------------------------------------------------------------------
# Citi parser
# ---------------------------------------------------------------------------

CITI_CSV = """
Status,Date,Description,Debit,Credit,Member Name
Cleared,06/15/2026,STARBUCKS STORE 123,6.50,,JOHN DOE
Cleared,06/14/2026,WHOLE FOODS MARKET,120.00,,JOHN DOE
Cleared,06/13/2026,CREDIT FROM MERCHANT,,50.00,JOHN DOE
Cleared,06/12/2026,INVALID ROW,,0.00,JOHN DOE
"""

class TestCitiParser:
    def test_parses_debit_transactions(self, tmp_path):
        path = write_csv(tmp_path, "citi.csv", CITI_CSV)
        txns = citi.parse(path, "Citi Custom Cash")
        assert len(txns) == 2

    def test_all_amounts_positive(self, tmp_path):
        path = write_csv(tmp_path, "citi.csv", CITI_CSV)
        txns = citi.parse(path, "Citi Custom Cash")
        assert all(t.amount > 0 for t in txns)

    def test_member_name_not_in_merchant(self, tmp_path):
        path = write_csv(tmp_path, "citi.csv", CITI_CSV)
        txns = citi.parse(path, "Citi Custom Cash")
        for t in txns:
            assert "JOHN DOE" not in t.merchant

    def test_credits_in_refunds(self, tmp_path):
        path = write_csv(tmp_path, "citi.csv", CITI_CSV)
        refunds = citi.parse_refunds(path, "Citi Custom Cash")
        assert len(refunds) == 1
        assert refunds[0].amount == 50.00

    def test_bank_is_citi(self, tmp_path):
        path = write_csv(tmp_path, "citi.csv", CITI_CSV)
        txns = citi.parse(path, "Citi Custom Cash")
        assert all(t.bank == "citi" for t in txns)

    def test_account_label_preserved(self, tmp_path):
        path = write_csv(tmp_path, "citi.csv", CITI_CSV)
        txns = citi.parse(path, "Citi Custom Cash")
        assert all(t.account == "Citi Custom Cash" for t in txns)

    def test_zero_credit_not_included_in_refunds(self, tmp_path):
        path = write_csv(tmp_path, "citi.csv", CITI_CSV)
        refunds = citi.parse_refunds(path, "Citi Custom Cash")
        # Only the 50.00 credit, not the 0.00 row
        assert len(refunds) == 1

    def test_skips_empty_description(self, tmp_path):
        csv = "Status,Date,Description,Debit,Credit,Member Name\nCleared,06/15/2026,,6.50,,JOHN DOE\n"
        path = write_csv(tmp_path, "citi_empty.csv", csv)
        txns = citi.parse(path, "Citi")
        assert len(txns) == 0
