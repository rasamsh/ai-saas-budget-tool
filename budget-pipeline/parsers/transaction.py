from dataclasses import dataclass, field
from datetime import date as Date


@dataclass
class Transaction:
    date: Date
    description: str      # raw bank description (pre-scrub)
    merchant: str         # cleaned merchant name (post clean_merchant())
    amount: float         # always positive; sign conveyed by txn_type
    account: str          # human label: "Chase Checking", "Amex Blue"
    bank: str             # "chase" | "amex" | "citi" | "bofa"
    category: str = "Misc"
    txn_type: str = "expense"   # "expense" | "income" | "investment" | "debt"
    hash: str = ""              # SHA-256 of raw data for dedup
