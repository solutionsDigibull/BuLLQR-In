"""Barcode normalization shared by every code path that reads or writes
``work_orders.work_order_code``.

Mirrors the rules in ``frontend/src/components/scan/BarcodeInput.tsx`` and adds
the GS1 group separator (\\u001D) which scanners frequently emit between
fields.
"""
import re

_WHITESPACE = re.compile(r"\s+")
_GS1_SEPARATOR = ""


def normalize_barcode(value: str) -> str:
    """Return a canonical form of ``value`` suitable for equality lookups.

    - replaces CR / LF / TAB / GS1 separator with a single space
    - collapses runs of whitespace
    - trims and uppercases
    - replaces ``;`` with ``:``
    """
    if value is None:
        return value
    v = (
        value
        .replace("\r", " ")
        .replace("\n", " ")
        .replace("\t", " ")
        .replace(_GS1_SEPARATOR, " ")
    )
    v = _WHITESPACE.sub(" ", v).strip().upper()
    return v.replace(";", ":")
