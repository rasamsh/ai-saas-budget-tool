"""
Comprehensive tests for scrubber.scrub().

Run with:
    pytest tests/test_scrubber.py -v
    # or
    python -m pytest tests/test_scrubber.py -v
"""

import sys
import os
import unittest

# Ensure the budget-pipeline root is on sys.path so scrubber can be imported
# regardless of where pytest is invoked from.
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from scrubber import scrub


# ---------------------------------------------------------------------------
# Test cases as specified in the requirements
# ---------------------------------------------------------------------------

TEST_CASES = [
    # (input_merchant, input_description, ach_names, expected_output)
    (
        "Zelle Payment To John Smith",
        "ZELLE PAYMENT TO JOHN SMITH",
        [],
        "Zelle Payment",
    ),
    (
        "Zelle Payment From Jane Doe",
        "ZELLE FROM JANE DOE",
        [],
        "Zelle Payment",
    ),
    (
        "Sai Rasamalla Ach Orig",
        "SAI RASAMALLA ACH ORIG ID: 1234",
        ["SAI RASAMALLA"],
        "ACH Transfer",
    ),
    (
        "M1 Payments Ppd Id: 8327952000",
        "M1 PAYMENTS PPD ID: 8327952000",
        [],
        "M1 Payments",
    ),
    (
        "Netflix Web Id: 1234567890",
        "NETFLIX.COM WEB ID: 1234567890",
        [],
        "Netflix",
    ),
    (
        "Personal Check",
        "CHECK 109",
        [],
        "Personal Check",
    ),
    (
        "Amazon",
        "AMAZON MKTPL*1P66J2KP3",
        [],
        "Amazon",
    ),
    (
        "Hostinger",
        "PAYPAL *HOSTINGER",
        [],
        "Hostinger",
    ),
    (
        "Whole Foods",
        "WHOLE FOODS #123 MOUNTAIN VIEW CA",
        [],
        "Whole Foods",
    ),
    (
        "Starbucks",
        "STARBUCKS STORE 123456789 SEATTLE WA",
        [],
        "Starbucks",
    ),
]


class TestScrubber(unittest.TestCase):

    def _run_case(self, merchant, description, ach_names, expected):
        result = scrub(merchant, description, ach_names)
        self.assertEqual(
            result,
            expected,
            msg=(
                f"\nInput merchant:    {merchant!r}"
                f"\nInput description: {description!r}"
                f"\nACH names:         {ach_names}"
                f"\nExpected:          {expected!r}"
                f"\nGot:               {result!r}"
            ),
        )

    def test_zelle_payment_to(self):
        """Zelle 'to' pattern: strip personal name → 'Zelle Payment'."""
        merchant, description, ach_names, expected = TEST_CASES[0]
        self._run_case(merchant, description, ach_names, expected)

    def test_zelle_payment_from(self):
        """Zelle 'from' pattern: strip personal name → 'Zelle Payment'."""
        merchant, description, ach_names, expected = TEST_CASES[1]
        self._run_case(merchant, description, ach_names, expected)

    def test_ach_known_name(self):
        """Known ACH name in ach_names list → 'ACH Transfer'."""
        merchant, description, ach_names, expected = TEST_CASES[2]
        self._run_case(merchant, description, ach_names, expected)

    def test_ppd_id_stripped(self):
        """PPD ID suffix is stripped from merchant name."""
        merchant, description, ach_names, expected = TEST_CASES[3]
        self._run_case(merchant, description, ach_names, expected)

    def test_web_id_stripped(self):
        """WEB ID suffix is stripped from merchant name."""
        merchant, description, ach_names, expected = TEST_CASES[4]
        self._run_case(merchant, description, ach_names, expected)

    def test_check_number(self):
        """Check number in merchant → 'Personal Check'."""
        merchant, description, ach_names, expected = TEST_CASES[5]
        self._run_case(merchant, description, ach_names, expected)

    def test_amazon_short_reference(self):
        """Short reference codes (< 8 chars) are NOT stripped by rule 5."""
        merchant, description, ach_names, expected = TEST_CASES[6]
        self._run_case(merchant, description, ach_names, expected)

    def test_hostinger_via_paypal(self):
        """Merchant already cleaned (post-asterisk extraction) passes through unchanged."""
        merchant, description, ach_names, expected = TEST_CASES[7]
        self._run_case(merchant, description, ach_names, expected)

    def test_whole_foods(self):
        """Store number and city/state noise stripped, merchant preserved."""
        merchant, description, ach_names, expected = TEST_CASES[8]
        self._run_case(merchant, description, ach_names, expected)

    def test_starbucks_long_digit(self):
        """Long digit string (7+ digits) in merchant is stripped."""
        merchant, description, ach_names, expected = TEST_CASES[9]
        self._run_case(merchant, description, ach_names, expected)

    # ---------------------------------------------------------------------------
    # Additional edge-case tests
    # ---------------------------------------------------------------------------

    def test_ach_name_case_insensitive(self):
        """ACH name match is case-insensitive."""
        result = scrub("John Doe Payments", "JOHN DOE ACH", ["john doe"])
        self.assertEqual(result, "ACH Transfer")

    def test_partial_account_number_stripped(self):
        """Hyphen + digits (partial account number) are stripped."""
        result = scrub("Chase-71005", "CHASE DEBIT -71005", [])
        self.assertNotIn("-71005", result)

    def test_trailing_reference_code_stripped(self):
        """Trailing 8+ alphanumeric reference codes are stripped."""
        result = scrub("Some Merchant ABCD1234", "SOME MERCHANT ABCD1234EF", [])
        self.assertNotIn("ABCD1234", result)

    def test_output_title_case(self):
        """Output is always title-cased."""
        result = scrub("some merchant", "SOME MERCHANT", [])
        self.assertEqual(result, result.title())

    def test_output_max_28_chars(self):
        """Output is truncated to 28 characters."""
        long_merchant = "A" * 50
        result = scrub(long_merchant, long_merchant, [])
        self.assertLessEqual(len(result), 28)

    def test_empty_merchant(self):
        """Empty merchant returns empty string (no crash)."""
        result = scrub("", "", [])
        self.assertEqual(result, "")

    def test_multiple_ach_names(self):
        """Multiple names in ach_names — matches the correct one."""
        result = scrub("Jane Smith Transfer", "JANE SMITH ACH", ["John Doe", "Jane Smith"])
        self.assertEqual(result, "ACH Transfer")

    def test_no_match_passes_through(self):
        """Merchants with no special patterns pass through (cleaned but not masked)."""
        result = scrub("Whole Foods", "WHOLE FOODS MARKET", [])
        self.assertEqual(result, "Whole Foods")

    def test_web_id_numeric_only_stripped(self):
        """WEB ID with numeric-only suffix is stripped correctly."""
        result = scrub("Hulu Web Id: 9876543210", "HULU WEB ID: 9876543210", [])
        self.assertEqual(result, "Hulu")

    def test_ppd_id_no_space_stripped(self):
        """PPD ID suffix with various spacing is stripped."""
        result = scrub("Payroll Ppd Id: 0000012345", "PAYROLL PPD ID: 0000012345", [])
        self.assertNotIn("Ppd", result)
        self.assertNotIn("0000012345", result)

    def test_zelle_from_description_fallback(self):
        """Zelle match on description when merchant doesn't obviously have 'from/to'."""
        # Merchant has been pre-cleaned so it may not have "From Jane" in it
        result = scrub("Zelle", "ZELLE FROM SOMEONE SPECIAL", [])
        # Should still detect zelle pattern
        self.assertIn("Zelle", result)

    def test_all_test_cases_parametrized(self):
        """Run the full TEST_CASES list from the spec."""
        for merchant, description, ach_names, expected in TEST_CASES:
            with self.subTest(merchant=merchant):
                self._run_case(merchant, description, ach_names, expected)

    def test_ppd_id_digits_already_stripped(self):
        """PPD ID still stripped when clean_merchant already removed the digits."""
        result = scrub("M1 Payments Ppd Id:", "M1 PAYMENTS PPD ID: 8327952000", [])
        self.assertEqual(result, "M1 Payments")

    def test_web_id_digits_already_stripped(self):
        """WEB ID still stripped when clean_merchant already removed the digits."""
        result = scrub("Southwest Gas Billpay Web Id:", "SOUTHWEST GAS BILLPAY WEB ID: 1234567890", [])
        self.assertNotIn("Web Id", result)
        self.assertNotIn(":", result)

    def test_tel_id_stripped(self):
        """TEL ID suffix is stripped."""
        result = scrub("Gilbert Az Utilitie Tel Id:", "GILBERT AZ UTILITIES TEL ID: 1234567", [])
        self.assertNotIn("Tel Id", result)
        self.assertNotIn(":", result)


if __name__ == "__main__":
    unittest.main(verbosity=2)
