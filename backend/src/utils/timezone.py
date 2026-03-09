"""Timezone conversion utilities for UTC ↔ IST."""
from datetime import datetime, timezone
import pytz

# Timezone objects
IST = pytz.timezone('Asia/Kolkata')  # Indian Standard Time (UTC+5:30)
UTC = pytz.UTC


def utc_now() -> datetime:
    """
    Get current UTC time.

    Returns:
        datetime: Current time in UTC timezone
    """
    return datetime.now(UTC)


def utc_to_ist(utc_time: datetime) -> datetime:
    """
    Convert UTC datetime to IST (Indian Standard Time).

    Args:
        utc_time: Datetime in UTC (with or without tzinfo)

    Returns:
        datetime: Datetime converted to IST timezone

    Example:
        >>> utc_time = datetime(2026, 2, 5, 10, 30, 0)
        >>> ist_time = utc_to_ist(utc_time)
        >>> print(ist_time)  # 2026-02-05 16:00:00+05:30
    """
    if utc_time.tzinfo is None:
        utc_time = UTC.localize(utc_time)
    return utc_time.astimezone(IST)


def ist_to_utc(ist_time: datetime) -> datetime:
    """
    Convert IST datetime to UTC.

    Args:
        ist_time: Datetime in IST (with or without tzinfo)

    Returns:
        datetime: Datetime converted to UTC timezone

    Example:
        >>> ist_time = datetime(2026, 2, 5, 16, 0, 0)
        >>> utc_time = ist_to_utc(ist_time)
        >>> print(utc_time)  # 2026-02-05 10:30:00+00:00
    """
    if ist_time.tzinfo is None:
        ist_time = IST.localize(ist_time)
    return ist_time.astimezone(UTC)


def format_12hour(dt: datetime) -> str:
    """
    Format datetime as 12-hour time with AM/PM.

    Args:
        dt: Datetime to format

    Returns:
        str: Time in 12-hour format with AM/PM

    Example:
        >>> dt = datetime(2026, 2, 5, 14, 30, 0)
        >>> format_12hour(dt)
        '02:30 PM'
    """
    return dt.strftime("%I:%M %p")


def today_ist_start() -> datetime:
    """
    Get start of today in IST (midnight) as UTC datetime.

    This is useful for filtering records by "today" in IST timezone,
    since database timestamps are stored in UTC.

    Returns:
        datetime: Midnight today in IST, converted to UTC

    Example:
        # If now is 2026-02-05 10:00 UTC (15:30 IST)
        >>> today_start = today_ist_start()
        >>> print(today_start)  # 2026-02-04 18:30:00+00:00
        # (Midnight IST on 2026-02-05 is 18:30 UTC on 2026-02-04)
    """
    now_ist = utc_now().astimezone(IST)
    today_start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    return ist_to_utc(today_start_ist)
