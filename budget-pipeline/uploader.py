import json
from pathlib import Path
from datetime import date, datetime
from supabase import create_client, Client
from parsers.transaction import Transaction

CONFIG_FILE = Path(__file__).parent / "secrets" / "config.json"
STATE_FILE  = Path(__file__).parent / "secrets" / "import_state.json"


def _client() -> Client:
    cfg = json.loads(CONFIG_FILE.read_text())
    return create_client(cfg["supabase_url"], cfg["service_role_key"])


def upsert_account(supabase: Client, name: str, bank: str, user_id: str) -> str:
    """Upsert account by name, return its UUID."""
    res = supabase.table("accounts").upsert(
        {"name": name, "bank": bank, "user_id": user_id},
        on_conflict="user_id,name"
    ).execute()
    return res.data[0]["id"]


def sync_categories(supabase: Client, categories: list[dict]) -> None:
    """Upsert categories from YAML into the DB."""
    for cat in categories:
        supabase.table("categories").upsert(
            {"name": cat["name"], "txn_type": cat["txn_type"], "color": cat.get("color", "#6b7280")},
            on_conflict="name"
        ).execute()


def upload(transactions: list[Transaction], user_id: str, dry_run: bool = False) -> dict:
    """
    Upload transactions to Supabase.
    Returns dict with keys: inserted, skipped, batch_id, period_start, period_end
    """
    if not transactions:
        return {"inserted": 0, "skipped": 0, "batch_id": None, "period_start": None, "period_end": None}

    cfg = json.loads(CONFIG_FILE.read_text())
    supabase = _client()

    # Upsert all accounts referenced
    account_ids: dict[str, str] = {}
    for txn in transactions:
        if txn.account not in account_ids:
            account_ids[txn.account] = upsert_account(supabase, txn.account, txn.bank, user_id)

    # Create import batch record
    dates = [t.date for t in transactions]
    period_start = str(min(dates))
    period_end   = str(max(dates))

    if dry_run:
        return {"inserted": len(transactions), "skipped": 0, "batch_id": None,
                "period_start": period_start, "period_end": period_end}

    batch_res = supabase.table("import_batches").insert({
        "period_start": period_start,
        "period_end": period_end,
        "file_count": len(set(t.account for t in transactions)),
        "transaction_count": len(transactions),
        "user_id": user_id,
    }).execute()
    batch_id = batch_res.data[0]["id"]

    # Build rows for bulk insert
    rows = [
        {
            "date":            str(t.date),
            "merchant":        t.merchant,
            "amount":          round(t.amount, 2),
            "category":        t.category,
            "txn_type":        t.txn_type,
            "account_id":      account_ids[t.account],
            "import_batch_id": batch_id,
            "hash":            t.hash,
            "user_id":         user_id,
        }
        for t in transactions
    ]

    # Chunked insert with ON CONFLICT DO NOTHING via upsert
    CHUNK = 500
    inserted = 0
    for i in range(0, len(rows), CHUNK):
        chunk = rows[i:i + CHUNK]
        res = supabase.table("transactions").upsert(
            chunk, on_conflict="user_id,hash", ignore_duplicates=True
        ).execute()
        inserted += len(res.data)

    # Save import state
    last = sorted(transactions, key=lambda t: (t.date, t.amount))[-1]
    state = {
        "timestamp":    datetime.now().isoformat(),
        "batch_id":     batch_id,
        "period_start": period_start,
        "period_end":   period_end,
        "transaction_count": inserted,
        "last_txn": {
            "date":    str(last.date),
            "amount":  last.amount,
            "merchant": last.merchant,
            "account": last.account,
        }
    }
    STATE_FILE.write_text(json.dumps(state, indent=2))

    return {"inserted": inserted, "skipped": len(transactions) - inserted,
            "batch_id": batch_id, "period_start": period_start, "period_end": period_end}
