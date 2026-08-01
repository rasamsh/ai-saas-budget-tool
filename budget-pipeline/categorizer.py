"""
Merchant cleaning, category loading, and transaction categorization.
"""

import re
import yaml
from parsers.transaction import Transaction


# ---------------------------------------------------------------------------
# clean_merchant
# ---------------------------------------------------------------------------

def clean_merchant(description: str) -> str:
    """
    Clean a raw bank description into a human-readable merchant name.

    Rules applied in order:
    1. Strip trailing state/country code (2–3 uppercase letters preceded by spaces)
    2. If "*" in name → take everything AFTER the last "*"
    3. Split on "/" → take the part before the "/"
    4. Strip "AplPay " prefix (Apple Pay transactions)
    5. Strip website TLDs: .COM .NET .ORG .AI .IO .CO (case-insensitive, word boundary)
    6. Strip long digit strings including preceding single letter: r'[A-Z]?\\s*\\d{7,}'
    7. Collapse whitespace → title-case → truncate to 28 characters
    """
    # Normalize multiple spaces first so later rules work on clean input
    s = re.sub(r'\s+', ' ', description).strip()

    # Rule 1: Strip trailing 2–3 uppercase letter state/country code
    s = re.sub(r'\s+[A-Z]{2,3}$', '', s).strip()

    # Rule 2: If "*" present, prefer the post-asterisk segment — UNLESS it looks like
    # a reference code (mixed letters+digits, no spaces, 6+ chars), in which case the
    # pre-asterisk segment is the actual merchant name.
    # "PAYPAL *HOSTINGER"       → post="HOSTINGER" (pure alpha)  → use post ✓
    # "AMAZON MKTPL*1P66J2KP3" → post has digits+letters        → use pre ✓
    if "*" in s:
        pre, post = s.rsplit("*", 1)
        post = post.strip()
        is_ref_code = (
            bool(re.search(r'\d', post))
            and bool(re.search(r'[A-Za-z]', post))
            and ' ' not in post
            and len(post) >= 6
        )
        s = pre.strip() if is_ref_code else post

    # Rule 3: Split on "/" → take part before "/"
    if "/" in s:
        s = s.split("/", 1)[0].strip()

    # Rule 4: Strip "AplPay " prefix (Apple Pay)
    s = re.sub(r'^AplPay\s+', '', s, flags=re.IGNORECASE).strip()

    # Rule 5: Strip website TLDs at word boundary
    s = re.sub(r'\.(com|net|org|ai|io|co)\b', '', s, flags=re.IGNORECASE).strip()

    # Rule 6: Strip long digit strings including preceding single letter
    s = re.sub(r'[A-Z]?\s*\d{7,}', '', s).strip()

    # Rule 7: Collapse whitespace, title-case, truncate to 28 chars
    s = re.sub(r'\s+', ' ', s).strip()
    s = s.title()
    s = s[:28]

    return s


# ---------------------------------------------------------------------------
# load_categories
# ---------------------------------------------------------------------------

def load_categories(config_path: str) -> dict:
    """
    Load categories YAML file.
    Returns dict with keys: rules, amount_rules, income_patterns, categories.
    """
    with open(config_path, encoding="utf-8") as f:
        data = yaml.safe_load(f)

    return {
        "categories":      data.get("categories", []),
        "rules":           data.get("rules", []),
        "amount_rules":    data.get("amount_rules", []),
        "income_patterns": data.get("income_patterns", []),
    }


# ---------------------------------------------------------------------------
# categorize
# ---------------------------------------------------------------------------

def is_recognized_income(description: str, income_patterns: list) -> bool:
    """
    Whether a credit's description names an income source we recognize.

    Not used to decide direction (the bank's sign already did) — it drives the
    "unrecognized credit" review warning shown at import time.
    """
    desc_upper = re.sub(r'\s+', ' ', description.upper()).strip()
    return any(ip and ip.upper() in desc_upper for ip in (income_patterns or []))


def categorize(txn: Transaction, rules: dict) -> Transaction:
    """
    Categorize a transaction in place.

    Order of operations:
    1. Check amount_rules (exact float match on txn.amount)
    2. Check rules (case-insensitive substring match on txn.description)
    3. Unmatched credit → Income / income
    4. Default: category="Misc", txn_type="expense"

    Direction is authoritative. Parsers set txn_type = "income" only for rows the
    bank itself reported as credits (money in), and no category rule may flip that:
    the rules are written for spending, so applying one to a credit turns money in
    into money out — a double-sized error in net cash flow. A credit that matches
    no rule is still income, just income we don't recognize.
    """
    amount_rules    = rules.get("amount_rules", []) or []
    pattern_rules   = rules.get("rules", []) or []

    is_credit = txn.txn_type == "income"

    # Normalize whitespace so "M1               PAYMENTS" matches "M1 PAYMENTS"
    desc_upper = re.sub(r'\s+', ' ', txn.description.upper()).strip()

    # Step 1: Amount-based rules (exact float match)
    for ar in amount_rules:
        try:
            rule_amount = float(ar["amount"])
        except (KeyError, ValueError, TypeError):
            continue
        if round(txn.amount, 2) == round(rule_amount, 2):
            txn_type = ar.get("type", "expense")
            if is_credit and txn_type != "income":
                continue  # spending rule, wrong direction
            txn.category = ar.get("category", "Misc")
            txn.txn_type = txn_type
            return txn

    # Step 2: Pattern rules (case-insensitive substring match on raw description)
    for rule in pattern_rules:
        pattern = rule.get("pattern", "")
        if not pattern:
            continue
        if pattern.upper() in desc_upper:
            txn_type = rule.get("type", "expense")
            if is_credit and txn_type != "income":
                continue  # spending rule, wrong direction
            txn.category = rule.get("category", "Misc")
            txn.txn_type = txn_type
            return txn

    # Step 3: Unmatched credit — money in, source unrecognized
    if is_credit:
        txn.category = "Income"
        txn.txn_type = "income"
        return txn

    # Step 4: Default
    txn.category = "Misc"
    txn.txn_type = "expense"
    return txn
