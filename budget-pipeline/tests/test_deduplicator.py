"""
Tests for deduplicator: compute_hash, filter_new, mark_uploaded.
"""

import os
import sys
import json
import pytest
from datetime import date
from unittest.mock import patch

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from deduplicator import compute_hash, filter_new, mark_uploaded
from parsers.transaction import Transaction


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_txn(
    date_str: str = "2026-06-15",
    amount: float = 10.0,
    description: str = "STARBUCKS",
    account: str = "Chase Checking",
    hash_val: str = "",
) -> Transaction:
    t = Transaction(
        date=date.fromisoformat(date_str),
        description=description,
        merchant="Starbucks",
        amount=amount,
        account=account,
        bank="chase",
    )
    t.hash = hash_val or compute_hash(date_str, amount, description, account)
    return t


# ---------------------------------------------------------------------------
# compute_hash
# ---------------------------------------------------------------------------

class TestComputeHash:
    def test_is_deterministic(self):
        h1 = compute_hash("2026-06-15", 10.0, "STARBUCKS", "Chase Checking")
        h2 = compute_hash("2026-06-15", 10.0, "STARBUCKS", "Chase Checking")
        assert h1 == h2

    def test_different_date_gives_different_hash(self):
        h1 = compute_hash("2026-06-15", 10.0, "STARBUCKS", "Chase Checking")
        h2 = compute_hash("2026-06-16", 10.0, "STARBUCKS", "Chase Checking")
        assert h1 != h2

    def test_different_amount_gives_different_hash(self):
        h1 = compute_hash("2026-06-15", 10.00, "STARBUCKS", "Chase Checking")
        h2 = compute_hash("2026-06-15", 10.01, "STARBUCKS", "Chase Checking")
        assert h1 != h2

    def test_different_description_gives_different_hash(self):
        h1 = compute_hash("2026-06-15", 10.0, "STARBUCKS", "Chase Checking")
        h2 = compute_hash("2026-06-15", 10.0, "WHOLE FOODS", "Chase Checking")
        assert h1 != h2

    def test_different_account_gives_different_hash(self):
        h1 = compute_hash("2026-06-15", 10.0, "STARBUCKS", "Chase Checking")
        h2 = compute_hash("2026-06-15", 10.0, "STARBUCKS", "Amex Blue")
        assert h1 != h2

    def test_returns_sha256_hex_string(self):
        h = compute_hash("2026-06-15", 10.0, "STARBUCKS", "Chase Checking")
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)

    def test_whitespace_stripped_from_description(self):
        h1 = compute_hash("2026-06-15", 10.0, "STARBUCKS", "Chase Checking")
        h2 = compute_hash("2026-06-15", 10.0, "  STARBUCKS  ", "Chase Checking")
        assert h1 == h2

    def test_amount_precision_two_decimals(self):
        # 10.0 and 10.00 should be the same; 10.001 rounds to 10.00
        h1 = compute_hash("2026-06-15", 10.0, "STARBUCKS", "Chase")
        h2 = compute_hash("2026-06-15", 10.001, "STARBUCKS", "Chase")
        assert h1 == h2


# ---------------------------------------------------------------------------
# filter_new
# ---------------------------------------------------------------------------

class TestFilterNew:
    def test_all_new_when_no_seen_hashes(self, tmp_path):
        txns = [make_txn(), make_txn(description="WHOLE FOODS", amount=50.0)]
        seen_file = tmp_path / "seen_hashes.json"
        with patch("deduplicator.SEEN_HASHES_FILE", seen_file):
            new_txns, skipped = filter_new(txns)
        assert len(new_txns) == 2
        assert skipped == 0

    def test_known_hash_skipped(self, tmp_path):
        txn1 = make_txn()
        txn2 = make_txn(description="WHOLE FOODS", amount=50.0)
        seen_file = tmp_path / "seen_hashes.json"
        seen_file.write_text(json.dumps([txn1.hash]))
        with patch("deduplicator.SEEN_HASHES_FILE", seen_file):
            new_txns, skipped = filter_new([txn1, txn2])
        assert len(new_txns) == 1
        assert skipped == 1
        assert new_txns[0].hash == txn2.hash

    def test_all_known_returns_empty(self, tmp_path):
        txn1 = make_txn()
        seen_file = tmp_path / "seen_hashes.json"
        seen_file.write_text(json.dumps([txn1.hash]))
        with patch("deduplicator.SEEN_HASHES_FILE", seen_file):
            new_txns, skipped = filter_new([txn1])
        assert new_txns == []
        assert skipped == 1

    def test_empty_input_returns_empty(self, tmp_path):
        seen_file = tmp_path / "seen_hashes.json"
        with patch("deduplicator.SEEN_HASHES_FILE", seen_file):
            new_txns, skipped = filter_new([])
        assert new_txns == []
        assert skipped == 0


# ---------------------------------------------------------------------------
# mark_uploaded
# ---------------------------------------------------------------------------

class TestMarkUploaded:
    def test_hashes_written_to_file(self, tmp_path):
        txn1 = make_txn()
        seen_file = tmp_path / "seen_hashes.json"
        with patch("deduplicator.SEEN_HASHES_FILE", seen_file):
            mark_uploaded([txn1])
        saved = json.loads(seen_file.read_text())
        assert txn1.hash in saved

    def test_existing_hashes_preserved(self, tmp_path):
        txn1 = make_txn()
        txn2 = make_txn(description="WHOLE FOODS", amount=50.0)
        seen_file = tmp_path / "seen_hashes.json"
        seen_file.write_text(json.dumps([txn1.hash]))
        with patch("deduplicator.SEEN_HASHES_FILE", seen_file):
            mark_uploaded([txn2])
        saved = json.loads(seen_file.read_text())
        assert txn1.hash in saved
        assert txn2.hash in saved

    def test_mark_then_filter_removes_duplicates(self, tmp_path):
        txn1 = make_txn()
        seen_file = tmp_path / "seen_hashes.json"
        with patch("deduplicator.SEEN_HASHES_FILE", seen_file):
            mark_uploaded([txn1])
            new_txns, skipped = filter_new([txn1])
        assert new_txns == []
        assert skipped == 1

    def test_duplicate_hashes_not_written_twice(self, tmp_path):
        txn1 = make_txn()
        seen_file = tmp_path / "seen_hashes.json"
        with patch("deduplicator.SEEN_HASHES_FILE", seen_file):
            mark_uploaded([txn1, txn1])  # same txn twice
        saved = json.loads(seen_file.read_text())
        assert saved.count(txn1.hash) == 1
