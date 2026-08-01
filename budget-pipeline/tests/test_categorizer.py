"""
Tests for categorizer.clean_merchant() and categorizer.categorize().
"""

import os
import sys
import pytest
from datetime import date

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from categorizer import clean_merchant, categorize, load_categories
from parsers.transaction import Transaction


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def txn(description: str, amount: float = 10.0, txn_type: str = "expense") -> Transaction:
    return Transaction(
        date=date(2026, 6, 15),
        description=description,
        merchant=clean_merchant(description),
        amount=amount,
        account="Chase Checking",
        bank="chase",
        txn_type=txn_type,
    )


CATEGORIES_PATH = os.path.join(_ROOT, "config", "categories.yaml")
RULES = load_categories(CATEGORIES_PATH)


# ---------------------------------------------------------------------------
# clean_merchant — Rule 1: strip trailing state/country code
# ---------------------------------------------------------------------------

class TestCleanMerchantRule1:
    def test_strips_two_letter_state(self):
        result = clean_merchant("STARBUCKS SEATTLE WA")
        assert "WA" not in result

    def test_strips_three_letter_code(self):
        result = clean_merchant("SOME MERCHANT USA")
        assert "USA" not in result

    def test_preserves_merchant_when_no_state(self):
        result = clean_merchant("STARBUCKS")
        assert result == "Starbucks"


# ---------------------------------------------------------------------------
# clean_merchant — Rule 2: asterisk → take after last *
# ---------------------------------------------------------------------------

class TestCleanMerchantRule2:
    def test_paypal_asterisk_real_merchant_kept(self):
        # "HOSTINGER" is pure alpha — real merchant name → use post-asterisk
        result = clean_merchant("PAYPAL *HOSTINGER")
        assert result == "Hostinger"

    def test_amazon_reference_code_uses_pre_asterisk(self):
        # "1P66J2KP3" has mixed letters+digits, no spaces → reference code → use pre-asterisk
        result = clean_merchant("AMAZON MKTPL*1P66J2KP3")
        assert result == "Amazon Mktpl"
        assert "1P66" not in result

    def test_amzn_variant_reference_code(self):
        result = clean_merchant("AMZN MKTP US*AB12CD34E")
        # Post="AB12CD34E" is mixed alphanumeric → use pre. Rule 1 strips "US" first.
        assert "Ab12" not in result
        assert "Amzn" in result

    def test_multiple_asterisks_takes_last(self):
        # "FINAL PART" has a space → not a reference code → use post-asterisk
        result = clean_merchant("A *B *FINAL PART")
        assert result == "Final Part"

    def test_short_code_under_6_chars_treated_as_name(self):
        # Post="XYZ" is only 3 chars → does not meet the 6-char threshold → use post
        result = clean_merchant("SOME STORE *XYZ")
        assert result == "Xyz"


# ---------------------------------------------------------------------------
# clean_merchant — Rule 3: slash → take before /
# ---------------------------------------------------------------------------

class TestCleanMerchantRule3:
    def test_slash_splits_correctly(self):
        result = clean_merchant("MERCHANT NAME/EXTRA INFO")
        assert result == "Merchant Name"


# ---------------------------------------------------------------------------
# clean_merchant — Rule 4: AplPay prefix stripped
# ---------------------------------------------------------------------------

class TestCleanMerchantRule4:
    def test_aplpay_prefix_stripped(self):
        result = clean_merchant("AplPay STARBUCKS")
        assert "Aplpay" not in result
        assert "Starbucks" in result

    def test_aplpay_case_insensitive(self):
        result = clean_merchant("APLPAY NETFLIX")
        assert "Aplpay" not in result


# ---------------------------------------------------------------------------
# clean_merchant — Rule 5: website TLDs stripped
# ---------------------------------------------------------------------------

class TestCleanMerchantRule5:
    @pytest.mark.parametrize("tld", [".COM", ".NET", ".ORG", ".AI", ".IO", ".CO"])
    def test_tld_stripped(self, tld):
        result = clean_merchant(f"NETFLIX{tld}")
        assert tld.lower() not in result.lower()

    def test_amazon_dot_com_stripped(self):
        result = clean_merchant("AMAZON.COM MKTPL")
        assert ".com" not in result.lower()


# ---------------------------------------------------------------------------
# clean_merchant — Rule 6: long digit strings stripped
# ---------------------------------------------------------------------------

class TestCleanMerchantRule6:
    def test_7_digit_string_stripped(self):
        result = clean_merchant("STARBUCKS 1234567")
        assert "1234567" not in result

    def test_short_digits_preserved(self):
        # Under 7 digits should NOT be stripped by rule 6
        result = clean_merchant("STORE 123")
        # Rule 6 only strips 7+, so "123" stays — but rule 1 may have removed trailing
        assert "Store" in result

    def test_preceding_single_letter_stripped_with_digits(self):
        result = clean_merchant("STARBUCKS STORE S1234567")
        assert "S1234567" not in result


# ---------------------------------------------------------------------------
# clean_merchant — Rule 7: title-case and truncation
# ---------------------------------------------------------------------------

class TestCleanMerchantRule7:
    def test_output_is_title_cased(self):
        result = clean_merchant("whole foods market")
        assert result == result.title()

    def test_truncated_to_28_chars(self):
        result = clean_merchant("A" * 50)
        assert len(result) <= 28

    def test_whitespace_collapsed(self):
        result = clean_merchant("WHOLE   FOODS   MARKET")
        assert "  " not in result


# ---------------------------------------------------------------------------
# clean_merchant — common real-world patterns
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("description,expected_prefix", [
    ("WHOLE FOODS #123 MOUNTAIN VIEW CA", "Whole Foods"),
    ("STARBUCKS STORE 123456789 SEATTLE WA", "Starbucks Store"),
    ("NETFLIX.COM WEB ID: 1234567890", "Netflix"),
    ("AMAZON MKTPL*1P66J2KP3", "Amazon Mktpl"),   # fixed: uses pre-asterisk, not reference code
    ("PAYPAL *HOSTINGER", "Hostinger"),
])
def test_clean_merchant_real_world(description, expected_prefix):
    result = clean_merchant(description)
    assert result.startswith(expected_prefix[:10])
    assert len(result) <= 28


# ---------------------------------------------------------------------------
# categorize — pattern rules
# ---------------------------------------------------------------------------

class TestCategorizePatternRules:
    def test_whole_foods_is_groceries(self):
        t = txn("WHOLE FOODS MARKET 123")
        result = categorize(t, RULES)
        assert result.category == "Groceries"
        assert result.txn_type == "expense"

    def test_starbucks_is_dining(self):
        t = txn("STARBUCKS STORE 123456789")
        result = categorize(t, RULES)
        assert result.category == "Dining"

    def test_amazon_is_shopping(self):
        t = txn("AMAZON MKTPL 1234567890")
        result = categorize(t, RULES)
        assert result.category == "Shopping"

    def test_netflix_is_subscriptions(self):
        t = txn("NETFLIX.COM WEB ID: 1234567890")
        result = categorize(t, RULES)
        assert result.category == "Subscriptions"

    def test_m1_payments_is_investment(self):
        t = txn("M1 PAYMENTS PPD ID: 8327952000")
        result = categorize(t, RULES)
        assert result.category == "Taxable Brokerage"
        assert result.txn_type == "investment"

    def test_doordash_is_dining(self):
        t = txn("DOORDASH BURGERKING")
        result = categorize(t, RULES)
        assert result.category == "Dining"

    def test_uber_is_transportation(self):
        t = txn("UBER TRIP HELP.UBER.COM")
        result = categorize(t, RULES)
        assert result.category == "Transportation"

    def test_geico_is_car_insurance(self):
        t = txn("GEICO *AUTO INSURANCE")
        result = categorize(t, RULES)
        assert result.category == "Car Insurance"

    def test_southwest_gas_is_utilities(self):
        t = txn("SOUTHWEST GAS BILLPAY WEB ID: 123")
        result = categorize(t, RULES)
        assert result.category == "Utilities"

    def test_pattern_match_is_case_insensitive(self):
        t = txn("netflix.com")
        result = categorize(t, RULES)
        assert result.category == "Subscriptions"


# ---------------------------------------------------------------------------
# categorize — amount rules
# ---------------------------------------------------------------------------

class TestCategorizeAmountRules:
    def test_amount_rule_takes_priority_over_pattern(self):
        custom_rules = {
            "rules": [{"pattern": "NETFLIX", "category": "Subscriptions", "type": "expense"}],
            "amount_rules": [{"amount": 15.99, "category": "Car Loan", "type": "debt"}],
            "income_patterns": [],
        }
        # NETFLIX description but amount matches car loan rule
        t = txn("NETFLIX", amount=15.99)
        result = categorize(t, custom_rules)
        assert result.category == "Car Loan"
        assert result.txn_type == "debt"

    def test_amount_rule_does_not_fire_on_wrong_amount(self):
        custom_rules = {
            "rules": [],
            "amount_rules": [{"amount": 688.76, "category": "Car Loan", "type": "debt"}],
            "income_patterns": [],
        }
        t = txn("SOME PAYMENT", amount=500.00)
        result = categorize(t, custom_rules)
        assert result.category == "Misc"  # falls through to default

    def test_empty_amount_rules_skipped_gracefully(self):
        rules = {**RULES, "amount_rules": []}
        t = txn("STARBUCKS")
        result = categorize(t, rules)
        assert result.category == "Dining"


# ---------------------------------------------------------------------------
# categorize — credits keep their direction
# ---------------------------------------------------------------------------

class TestCategorizeIncome:
    def test_payroll_credit_stays_income(self):
        t = txn("DIRECT DEPOSIT PAYROLL", txn_type="income")
        result = categorize(t, RULES)
        assert result.category == "Income"
        assert result.txn_type == "income"

    def test_unrecognized_credit_stays_income(self):
        t = txn("RANDOM CREDIT FROM UNKNOWN", txn_type="income")
        result = categorize(t, RULES)
        assert result.txn_type == "income"
        assert result.category == "Income"

    def test_zelle_from_is_income(self):
        t = txn("ZELLE FROM JOHN DOE", txn_type="income")
        result = categorize(t, RULES)
        assert result.txn_type == "income"

    def test_gusto_payroll_is_income(self):
        t = txn("GUSTO PAYROLL 123456", txn_type="income")
        result = categorize(t, RULES)
        assert result.txn_type == "income"

    def test_incoming_transfer_is_income_not_misc_expense(self):
        # The reported bug: an incoming ACH on Chase checking was stored as a
        # -$3,900 Misc expense — a $7,800 swing in net cash flow.
        t = txn(
            "Online Transfer From Chk ...5546 transaction#: 29871676506 07/22",
            amount=3900.00,
            txn_type="income",
        )
        result = categorize(t, RULES)
        assert result.txn_type == "income"
        assert result.category == "Income"

    def test_spending_pattern_rule_cannot_claim_a_credit(self):
        t = txn("AMAZON.COM REFUND 12345", txn_type="income")
        result = categorize(t, RULES)
        assert result.txn_type == "income"
        assert result.category == "Income"
        # ...while the same payee on a debit is still Shopping.
        assert categorize(txn("AMAZON.COM PURCHASE 12345"), RULES).category == "Shopping"

    def test_amount_rule_cannot_claim_a_credit(self):
        # 688.76 is the car-loan payment amount; a credit that size is not a payment.
        assert categorize(txn("SOME CREDIT", amount=688.76, txn_type="income"), RULES).txn_type == "income"
        assert categorize(txn("SOME PAYMENT", amount=688.76), RULES).txn_type == "debt"


# ---------------------------------------------------------------------------
# categorize — incoming wording is recognized without a sign
# ---------------------------------------------------------------------------

class TestCategorizeIncomingWording:
    """
    --recategorize only has the cleaned merchant text to work from (the raw
    description is not stored), so direction-bearing wording must be enough to
    repair a credit that was saved with the wrong sign.
    """

    @pytest.mark.parametrize("description", [
        "Online Transfer From Chk ...",
        "Zelle Payment From Jane Doe",
        "Remote Online Deposit",
        "American Express Payroll",
    ])
    def test_repairs_a_credit_stored_as_an_expense(self, description):
        result = categorize(txn(description, txn_type="expense"), RULES)
        assert result.category == "Income"
        assert result.txn_type == "income"

    def test_outgoing_transfer_is_left_alone(self):
        result = categorize(txn("Online Transfer To Chk ...5546"), RULES)
        assert result.txn_type == "expense"
        assert result.category == "Misc"


# ---------------------------------------------------------------------------
# categorize — default fallback
# ---------------------------------------------------------------------------

class TestCategorizeDefaults:
    def test_unknown_description_defaults_to_misc_expense(self):
        t = txn("ZZZUNKNOWNMERCHANT999")
        result = categorize(t, RULES)
        assert result.category == "Misc"
        assert result.txn_type == "expense"

    def test_empty_rules_defaults_to_misc(self):
        empty_rules = {"rules": [], "amount_rules": [], "income_patterns": []}
        t = txn("STARBUCKS STORE 123")
        result = categorize(t, empty_rules)
        assert result.category == "Misc"

    def test_first_matching_rule_wins(self):
        # DOORDASH appears before UBER in rules; a "DOORDASH UBER" txn should be Dining
        t = txn("DOORDASH UBER ORDER")
        result = categorize(t, RULES)
        assert result.category == "Dining"
