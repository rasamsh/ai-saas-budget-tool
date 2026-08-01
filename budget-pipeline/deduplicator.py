import hashlib
import json
import os
from pathlib import Path

from parsers.transaction import Transaction

SEEN_HASHES_FILE = Path(__file__).parent / "secrets" / "seen_hashes.json"


def compute_hash(date: str, amount: float, raw_description: str, account: str) -> str:
    raw = f"{date}|{amount:.2f}|{raw_description.strip()}|{account}"
    return hashlib.sha256(raw.encode()).hexdigest()


def load_seen_hashes() -> set[str]:
    if SEEN_HASHES_FILE.exists():
        return set(json.loads(SEEN_HASHES_FILE.read_text()))
    return set()


def save_seen_hashes(hashes: set[str]) -> None:
    SEEN_HASHES_FILE.write_text(json.dumps(sorted(hashes), indent=2))


def filter_new(transactions: list[Transaction]) -> tuple[list[Transaction], int]:
    seen = load_seen_hashes()
    new_txns = [t for t in transactions if t.hash not in seen]
    skipped = len(transactions) - len(new_txns)
    return new_txns, skipped


def mark_uploaded(transactions: list[Transaction]) -> None:
    seen = load_seen_hashes()
    seen.update(t.hash for t in transactions)
    save_seen_hashes(seen)
