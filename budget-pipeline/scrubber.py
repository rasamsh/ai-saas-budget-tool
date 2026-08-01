"""
PII scrubber for merchant names.
Removes personal names, account numbers, reference codes, and other
identifiable information from merchant strings before storage.
"""

import re


def scrub(merchant: str, description: str, ach_names: list[str]) -> str:
    """
    Scrub PII and noise from a merchant name.

    Rules applied in order:
    1. Zelle payments: strip names → "Zelle Payment"
    2. ACH known names: replace whole merchant → "ACH Transfer"
    3. PPD ID / WEB ID / ACH ID suffixes: strip them
    4. Check numbers: → "Personal Check"
    5. Trailing reference codes (8+ alphanumeric): strip them
    6. Strip partial account numbers like -71005
    7. Collapse whitespace, title-case, truncate to 28 chars
    """
    s = merchant.strip()

    # Rule 1: Zelle payments — strip personal names
    # Match "Zelle Payment To John Smith" or "Zelle From Jane Doe" etc.
    if re.search(r'(?i)zelle', s):
        if re.search(r'(?i)zelle\s+(payment\s+)?(to|from)\s+[A-Za-z][A-Za-z\s]+$', s):
            return "Zelle Payment"
        # Also check description for zelle from/to patterns
        if re.search(r'(?i)zelle\s+(payment\s+)?(to|from)\s+[A-Za-z][A-Za-z\s]+$', description):
            return "Zelle Payment"
        # Zelle present but no name pattern — still clean to "Zelle Payment"
        # only if it's clearly a payment
        if re.search(r'(?i)zelle\s+(payment|transfer)', s):
            return "Zelle Payment"

    # Rule 2: ACH known names — replace whole merchant with "ACH Transfer"
    s_upper = s.upper()
    for name in ach_names:
        if name.strip().upper() in s_upper:
            return "ACH Transfer"

    # Rule 3: Strip PPD ID / WEB ID / ACH ID / TEL ID suffixes.
    # Digits may already be stripped by clean_merchant, so make the digit group optional.
    s = re.sub(r'\s+PPD\s+ID[:\s]*\d*', '', s, flags=re.IGNORECASE).strip()
    s = re.sub(r'\s+WEB\s+ID[:\s]*\d*', '', s, flags=re.IGNORECASE).strip()
    s = re.sub(r'\s+ACH\s+ID[:\s]*\d*', '', s, flags=re.IGNORECASE).strip()
    s = re.sub(r'\s+TEL\s+ID[:\s]*\d*', '', s, flags=re.IGNORECASE).strip()
    # Strip any trailing isolated colon left after digit removal
    s = re.sub(r'[\s:]+$', '', s).strip()

    # Rule 4: Check numbers → "Personal Check"
    if re.search(r'(?i)\bcheck\s+\d+', s):
        return "Personal Check"

    # Rule 5: Trailing reference codes (8+ alphanumeric chars)
    s = re.sub(r'\s+[A-Z0-9]{8,}$', '', s).strip()

    # Rule 6: Strip partial account numbers (hyphen + digits)
    s = re.sub(r'-\d+', '', s).strip()

    # Rule 7: Collapse whitespace, title-case, truncate to 28 chars
    s = re.sub(r'\s+', ' ', s).strip()
    s = s.title()
    s = s[:28]

    return s
