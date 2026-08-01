#!/usr/bin/env python3
"""
budget.py — Personal Finance CLI Data Pipeline

Usage:
    python budget.py --all [--dry-run] [--force] [--categories-config PATH]
    python budget.py --bank BANK --account LABEL FILE [--dry-run] [--force]
    python budget.py --recategorize [--dry-run] [--categories-config PATH]
"""

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path

import yaml
from rich.console import Console
from rich.table import Table
from rich import box
from rich.text import Text
from rich.panel import Panel

# ---------------------------------------------------------------------------
# Path constants
# ---------------------------------------------------------------------------

BASE_DIR       = Path(__file__).parent
MANIFEST_PATH  = BASE_DIR / "input" / "manifest.yaml"
CONFIG_PATH    = BASE_DIR / "secrets" / "config.json"
STATE_PATH     = BASE_DIR / "secrets" / "import_state.json"
DEFAULT_CATS   = BASE_DIR / "config" / "categories.yaml"

console = Console()

# ---------------------------------------------------------------------------
# Lazy imports (avoid loading supabase etc. if not needed)
# ---------------------------------------------------------------------------

def _load_parsers():
    from parsers.chase import parse as chase_parse, parse_refunds as chase_refunds
    from parsers.amex  import parse as amex_parse,  parse_refunds as amex_refunds
    from parsers.citi  import parse as citi_parse,  parse_refunds as citi_refunds
    from parsers.bofa  import parse as bofa_parse,  parse_refunds as bofa_refunds
    return {
        "chase": (chase_parse, chase_refunds),
        "amex":  (amex_parse,  amex_refunds),
        "citi":  (citi_parse,  citi_refunds),
        "bofa":  (bofa_parse,  bofa_refunds),
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_config() -> dict:
    if not CONFIG_PATH.exists():
        console.print("[red]secrets/config.json not found. Copy the template and fill in your credentials.[/red]")
        sys.exit(1)
    return json.loads(CONFIG_PATH.read_text())


def _load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        console.print(f"[red]Manifest not found at {MANIFEST_PATH}[/red]")
        sys.exit(1)
    with open(MANIFEST_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)


def _print_last_import_summary() -> None:
    if not STATE_PATH.exists():
        return
    try:
        state = json.loads(STATE_PATH.read_text())
        panel = Panel(
            f"[bold]Last import:[/bold] {state.get('timestamp', 'unknown')}\n"
            f"Period: {state.get('period_start')} → {state.get('period_end')}\n"
            f"Transactions uploaded: {state.get('transaction_count', 0)}\n"
            f"Last txn: [cyan]{state['last_txn']['merchant']}[/cyan] "
            f"${state['last_txn']['amount']:.2f} "
            f"({state['last_txn']['account']}) on {state['last_txn']['date']}",
            title="Previous Import",
            border_style="dim",
        )
        console.print(panel)
    except Exception:
        pass


def _apply_exclude_patterns(transactions, exclude_patterns: list[str]) -> list:
    """
    Drop rows matching the account's exclude patterns.

    Exclusions exist to avoid double-counting money going out (card autopay already
    tracked from the card's own statement), so they only apply to debits. A credit is
    never a duplicate of a card charge, and matching one on payee name alone silently
    deletes income — e.g. "AMERICAN EXPRESS" excludes the Amex autopay debit, but must
    not also exclude an "American Express PAYROLL" deposit.
    """
    if not exclude_patterns:
        return transactions
    filtered = []
    for txn in transactions:
        if txn.txn_type == "income":
            filtered.append(txn)
            continue
        desc_upper = txn.description.upper()
        excluded = any(p.upper() in desc_upper for p in exclude_patterns)
        if not excluded:
            filtered.append(txn)
    return filtered


def _net_refunds(
    transactions: list,
    refunds: list,
    account: str,
) -> list:
    """
    Two-pass refund netting:
    Pass 1: match on (description.upper(), round(amount, 2))
    Pass 2: match on round(amount, 2) alone

    Matched pairs are removed from both lists.
    """
    from collections import defaultdict

    # Work with copies
    txns = list(transactions)
    rfds = list(refunds)

    # Pass 1: exact (description, amount) match
    refund_index: dict[tuple, list] = defaultdict(list)
    for r in rfds:
        key = (r.description.upper(), round(r.amount, 2))
        refund_index[key].append(r)

    remaining_txns = []
    remaining_rfds = list(rfds)

    for txn in txns:
        key = (txn.description.upper(), round(txn.amount, 2))
        if refund_index.get(key):
            matched_refund = refund_index[key].pop(0)
            remaining_rfds.remove(matched_refund)
            console.print(
                f"  [dim][NET] ${txn.amount:.2f} '{txn.merchant}' refund applied (pass 1)[/dim]"
            )
        else:
            remaining_txns.append(txn)

    # Pass 2: amount-only match on leftovers
    refund_by_amount: dict[float, list] = defaultdict(list)
    for r in remaining_rfds:
        refund_by_amount[round(r.amount, 2)].append(r)

    final_txns = []
    for txn in remaining_txns:
        amt_key = round(txn.amount, 2)
        if refund_by_amount.get(amt_key):
            matched_refund = refund_by_amount[amt_key].pop(0)
            remaining_rfds.remove(matched_refund)
            console.print(
                f"  [dim][NET] ${txn.amount:.2f} '{txn.merchant}' refund applied (pass 2, amount-only)[/dim]"
            )
        else:
            final_txns.append(txn)

    return final_txns


def _compute_hashes(transactions: list) -> list:
    from deduplicator import compute_hash
    for txn in transactions:
        txn.hash = compute_hash(
            str(txn.date),
            txn.amount,
            txn.description,
            txn.account,
        )
    return transactions


def _print_dry_run_table(transactions: list) -> None:
    table = Table(
        title="Dry Run — Transactions to Import",
        box=box.ROUNDED,
        show_lines=False,
    )
    table.add_column("Date",        style="cyan",   width=12)
    table.add_column("Merchant",    style="white",  width=28)
    table.add_column("Amount",      style="green",  width=10, justify="right")
    table.add_column("Category",    style="yellow", width=18)
    table.add_column("Type",        style="blue",   width=12)
    table.add_column("Account",     style="magenta",width=20)

    for txn in sorted(transactions, key=lambda t: (t.date, t.account)):
        amount_str = f"${txn.amount:.2f}"
        if txn.txn_type == "income":
            amount_str = f"[green]{amount_str}[/green]"
        elif txn.txn_type in ("investment", "debt"):
            amount_str = f"[blue]{amount_str}[/blue]"
        table.add_row(
            str(txn.date),
            txn.merchant[:28],
            amount_str,
            txn.category,
            txn.txn_type,
            txn.account,
        )

    console.print(table)
    console.print(f"\n[bold]Total:[/bold] {len(transactions)} transactions")


def _print_summary(results_by_account: dict, total_inserted: int, total_skipped: int, dry_run: bool) -> None:
    mode = "[yellow](DRY RUN)[/yellow]" if dry_run else ""
    table = Table(
        title=f"Import Summary {mode}",
        box=box.SIMPLE_HEAD,
    )
    table.add_column("Account",    style="cyan")
    table.add_column("Parsed",     justify="right")
    table.add_column("Uploaded",   justify="right", style="green")
    table.add_column("Skipped",    justify="right", style="dim")

    for account, counts in sorted(results_by_account.items()):
        table.add_row(
            account,
            str(counts["parsed"]),
            str(counts["uploaded"]),
            str(counts["skipped"]),
        )

    console.print(table)
    console.print(
        f"\n[bold]Total:[/bold] {total_inserted} uploaded, {total_skipped} skipped (duplicates)"
    )


def _advance_start_date(max_date: date) -> None:
    """Advance start_date in config.json to the day after max_date."""
    cfg = _load_config()
    new_start = (max_date + timedelta(days=1)).isoformat()
    cfg["start_date"] = new_start
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2))
    console.print(f"[dim]start_date advanced to {new_start}[/dim]")


# ---------------------------------------------------------------------------
# Core pipeline
# ---------------------------------------------------------------------------

def _process_file_entry(
    entry: dict,
    parsers: dict,
    cat_rules: dict,
    ach_names: list[str],
    dry_run: bool,
    force: bool,
    user_id: str,
) -> tuple[list, dict]:
    """
    Process a single manifest file entry.
    Returns (all_transactions, {account: {parsed, uploaded, skipped}}).
    """
    from categorizer import categorize
    from scrubber import scrub
    from deduplicator import filter_new

    bank       = entry.get("bank", "").lower()
    account    = entry.get("account", "")
    file_glob  = entry.get("file", "")
    exclude_patterns = entry.get("exclude_patterns", []) or []
    override_merchant = entry.get("override_merchant", None)

    if bank not in parsers:
        console.print(f"[red]Unknown bank: {bank}[/red]")
        return [], {}

    parse_fn, parse_refunds_fn = parsers[bank]
    input_dir = BASE_DIR / "input"
    matched_files = sorted(input_dir.glob(file_glob))

    if not matched_files:
        console.print(f"  [dim]No files matching '{file_glob}' for {account}[/dim]")
        return [], {}

    all_transactions = []
    results = {account: {"parsed": 0, "uploaded": 0, "skipped": 0}}

    for fpath in matched_files:
        console.print(f"  Parsing [cyan]{fpath.name}[/cyan] → [magenta]{account}[/magenta]")

        try:
            txns    = parse_fn(str(fpath), account)
            refunds = parse_refunds_fn(str(fpath), account)
        except Exception as e:
            console.print(f"  [red]Error parsing {fpath.name}: {e}[/red]")
            continue

        # Apply exclude patterns
        txns    = _apply_exclude_patterns(txns, exclude_patterns)
        refunds = _apply_exclude_patterns(refunds, exclude_patterns)

        # Refund netting
        if refunds:
            txns = _net_refunds(txns, refunds, account)

        # Override merchant if configured
        if override_merchant:
            for t in txns:
                t.merchant = override_merchant

        # Compute hashes
        txns = _compute_hashes(txns)

        # Categorize
        for t in txns:
            categorize(t, cat_rules)

        # Scrub PII
        for t in txns:
            if not override_merchant:
                t.merchant = scrub(t.merchant, t.description, ach_names)

        results[account]["parsed"] += len(txns)
        all_transactions.extend(txns)

    return all_transactions, results


def _run_all(args) -> None:
    cfg      = _load_config()
    manifest = _load_manifest()
    user_id  = cfg.get("user_id", "")
    ach_names = cfg.get("ach_names", []) or []

    cats_path = args.categories_config or str(DEFAULT_CATS)
    from categorizer import load_categories
    cat_rules = load_categories(cats_path)

    parsers = _load_parsers()

    if not args.dry_run:
        _print_last_import_summary()

    console.print(f"\n[bold]Processing manifest:[/bold] {MANIFEST_PATH}\n")

    all_transactions = []
    combined_results: dict[str, dict] = {}

    for entry in manifest.get("files", []):
        txns, results = _process_file_entry(
            entry, parsers, cat_rules, ach_names,
            dry_run=args.dry_run, force=args.force, user_id=user_id,
        )
        all_transactions.extend(txns)
        for acct, counts in results.items():
            if acct not in combined_results:
                combined_results[acct] = {"parsed": 0, "uploaded": 0, "skipped": 0}
            combined_results[acct]["parsed"] += counts["parsed"]

    if not all_transactions:
        console.print("[yellow]No transactions found.[/yellow]")
        return

    # Filter duplicates (unless --force)
    if args.force:
        new_txns = all_transactions
        skipped_count = 0
    else:
        from deduplicator import filter_new
        new_txns, skipped_count = filter_new(all_transactions)

    total_skipped = skipped_count
    total_inserted = 0

    if args.dry_run:
        _print_dry_run_table(new_txns)
        for acct in combined_results:
            combined_results[acct]["uploaded"] = combined_results[acct]["parsed"]
            combined_results[acct]["skipped"]  = 0
        total_inserted = len(new_txns)
        _print_summary(combined_results, total_inserted, total_skipped, dry_run=True)
        return

    # Sync categories to DB
    from uploader import upload, sync_categories, _client
    supabase = _client()
    try:
        sync_categories(supabase, cat_rules.get("categories", []))
    except Exception as e:
        console.print(f"[yellow]Warning: could not sync categories: {e}[/yellow]")

    # Upload
    result = upload(new_txns, user_id=user_id, dry_run=False)
    total_inserted = result["inserted"]
    total_skipped += result["skipped"]

    # Per-account counts (approximate — we attribute all uploads to their account)
    uploaded_by_account: dict[str, int] = {}
    for txn in new_txns:
        uploaded_by_account[txn.account] = uploaded_by_account.get(txn.account, 0) + 1

    for acct, counts in combined_results.items():
        counts["uploaded"] = uploaded_by_account.get(acct, 0)
        counts["skipped"]  = counts["parsed"] - counts["uploaded"]

    # Mark hashes as seen
    from deduplicator import mark_uploaded
    mark_uploaded(new_txns)

    # Advance start_date
    if new_txns:
        max_date = max(t.date for t in new_txns)
        _advance_start_date(max_date)

    _print_summary(combined_results, total_inserted, total_skipped, dry_run=False)


def _run_single_file(args) -> None:
    """Process a single file specified via --bank --account FILE."""
    cfg      = _load_config()
    user_id  = cfg.get("user_id", "")
    ach_names = cfg.get("ach_names", []) or []

    cats_path = args.categories_config or str(DEFAULT_CATS)
    from categorizer import load_categories, categorize
    from scrubber import scrub
    cat_rules = load_categories(cats_path)

    parsers = _load_parsers()
    bank    = args.bank.lower()
    account = args.account
    fpath   = args.file

    if bank not in parsers:
        console.print(f"[red]Unknown bank: {bank}. Choose from: {', '.join(parsers.keys())}[/red]")
        sys.exit(1)

    parse_fn, parse_refunds_fn = parsers[bank]

    console.print(f"Parsing [cyan]{fpath}[/cyan] as [magenta]{account}[/magenta] ({bank})\n")

    try:
        txns    = parse_fn(fpath, account)
        refunds = parse_refunds_fn(fpath, account)
    except Exception as e:
        console.print(f"[red]Error parsing file: {e}[/red]")
        sys.exit(1)

    if refunds:
        txns = _net_refunds(txns, refunds, account)

    txns = _compute_hashes(txns)

    for t in txns:
        categorize(t, cat_rules)
        t.merchant = scrub(t.merchant, t.description, ach_names)

    if args.force:
        new_txns = txns
        skipped_count = 0
    else:
        from deduplicator import filter_new
        new_txns, skipped_count = filter_new(txns)

    if args.dry_run:
        _print_dry_run_table(new_txns)
        console.print(f"\n[dim]{skipped_count} duplicates would be skipped[/dim]")
        return

    from uploader import upload, _client, sync_categories
    supabase = _client()
    try:
        sync_categories(supabase, cat_rules.get("categories", []))
    except Exception as e:
        console.print(f"[yellow]Warning: could not sync categories: {e}[/yellow]")

    result = upload(new_txns, user_id=user_id, dry_run=False)

    from deduplicator import mark_uploaded
    mark_uploaded(new_txns)

    if new_txns:
        max_date = max(t.date for t in new_txns)
        _advance_start_date(max_date)

    console.print(
        f"\n[bold green]Done.[/bold green] Uploaded: {result['inserted']}, "
        f"Skipped: {result['skipped'] + skipped_count}"
    )


def _run_recategorize(args) -> None:
    """Fetch all DB transactions and re-run categorizer, patching category/txn_type."""
    cfg     = _load_config()
    user_id = cfg.get("user_id", "")

    cats_path = args.categories_config or str(DEFAULT_CATS)
    from categorizer import load_categories, categorize
    from parsers.transaction import Transaction
    from uploader import _client
    from datetime import date as Date

    cat_rules = load_categories(cats_path)

    console.print("[bold]Fetching transactions from DB for recategorization...[/bold]")

    supabase = _client()

    # Fetch all transactions for this user in pages of 1000
    all_rows = []
    offset = 0
    PAGE = 1000
    while True:
        res = (
            supabase.table("transactions")
            .select("id, date, merchant, amount, category, txn_type, hash")
            .eq("user_id", user_id)
            .range(offset, offset + PAGE - 1)
            .execute()
        )
        batch = res.data or []
        all_rows.extend(batch)
        if len(batch) < PAGE:
            break
        offset += PAGE

    console.print(f"Fetched [cyan]{len(all_rows)}[/cyan] transactions.")

    if not all_rows:
        console.print("[yellow]No transactions found.[/yellow]")
        return

    updates = []
    previews = []
    for row in all_rows:
        # Reconstruct a minimal Transaction using merchant as the description
        # (raw description not stored in DB)
        try:
            txn_date = Date.fromisoformat(row["date"])
        except Exception:
            txn_date = date.today()

        txn = Transaction(
            date=txn_date,
            description=row["merchant"],  # best proxy we have
            merchant=row["merchant"],
            amount=float(row["amount"]),
            account="",
            bank="",
            category=row.get("category", "Misc"),
            txn_type=row.get("txn_type", "expense"),
            hash=row.get("hash", ""),
        )
        updated = categorize(txn, cat_rules)

        # The raw description is not stored, so we re-categorize from the cleaned
        # merchant — which has had state codes, digits and trailing text stripped.
        # That is lossy: "CHEVRON 1234 PHOENIX AZ" survives as "Chevro" and no
        # longer matches its own rule. Recategorizing must refine, never erase, so
        # skip anything that would drop a specific category back to the default.
        if updated.category == "Misc" and row.get("category") not in (None, "Misc"):
            continue

        if updated.category != row.get("category") or updated.txn_type != row.get("txn_type"):
            updates.append({
                "id":       row["id"],
                "category": updated.category,
                "txn_type": updated.txn_type,
            })
            previews.append((
                row["date"],
                row["merchant"],
                float(row["amount"]),
                f'{row.get("category")}/{row.get("txn_type")}',
                f"{updated.category}/{updated.txn_type}",
            ))

    console.print(f"[bold]{len(updates)}[/bold] transactions need category/type updates.")

    if not updates:
        console.print("[green]All categories are up to date.[/green]")
        return

    # Show what would change — a recategorize rewrites history, so make it visible.
    table = Table(box=box.SIMPLE, show_header=True, header_style="bold")
    table.add_column("Date")
    table.add_column("Merchant")
    table.add_column("Amount", justify="right")
    table.add_column("From")
    table.add_column("To")
    for date_str, merchant, amount, before, after in previews[:50]:
        table.add_row(
            str(date_str),
            merchant,
            f"{amount:,.2f}",
            Text(before, style="yellow"),
            Text(after, style="green"),
        )
    console.print(table)
    if len(previews) > 50:
        console.print(f"[dim]... and {len(previews) - 50} more[/dim]")

    if args.dry_run:
        console.print("[yellow]Dry run — nothing written.[/yellow]")
        return

    # Batch update in chunks
    CHUNK = 500
    patched = 0
    for i in range(0, len(updates), CHUNK):
        chunk = updates[i:i + CHUNK]
        for row in chunk:
            supabase.table("transactions").update(
                {"category": row["category"], "txn_type": row["txn_type"]}
            ).eq("id", row["id"]).execute()
            patched += 1

    console.print(f"[bold green]Recategorized {patched} transactions.[/bold green]")


# ---------------------------------------------------------------------------
# Argument parsing & entrypoint
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="budget",
        description="Personal Finance CLI — import bank CSVs into Supabase",
    )

    mode = p.add_mutually_exclusive_group()
    mode.add_argument(
        "--all",
        action="store_true",
        help="Process all files listed in input/manifest.yaml",
    )
    mode.add_argument(
        "--recategorize",
        action="store_true",
        help="Re-run categorizer on all DB transactions and patch category/txn_type",
    )

    p.add_argument("--dry-run", action="store_true", help="Preview without writing to the DB")
    p.add_argument("--force",   action="store_true", help="Bypass local seen_hashes cache")
    p.add_argument("--categories-config", metavar="PATH", help="Custom categories YAML path")

    # Single file mode
    p.add_argument("--bank",    metavar="BANK",    help="Bank name: chase|amex|citi|bofa")
    p.add_argument("--account", metavar="LABEL",   help="Account label (e.g. 'Chase Checking')")
    p.add_argument("file",      nargs="?",         help="CSV file path (single file mode)")

    return p


def main() -> None:
    parser = build_parser()
    args   = parser.parse_args()

    if args.recategorize:
        _run_recategorize(args)
        return

    if args.all:
        _run_all(args)
        return

    # Single file mode
    if args.bank and args.account and args.file:
        _run_single_file(args)
        return

    # No valid mode selected
    parser.print_help()
    sys.exit(1)


if __name__ == "__main__":
    main()
