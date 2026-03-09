"""Serial number generation service."""
from sqlalchemy.orm import Session
from sqlalchemy import func, select, text
from src.models import WorkOrder


def generate_serial_number(db: Session) -> str:
    """
    Generate next serial number in sequence.

    Serial numbers are formatted as #XXXXX (5 digits, zero-padded).
    Example: #00001, #00002, ..., #99999

    Uses a PostgreSQL advisory lock to prevent race conditions where
    concurrent transactions read the same MAX and generate duplicate serials.
    The lock is held until the transaction commits or rolls back.
    """
    # Acquire transaction-level advisory lock to serialize serial number generation.
    # Only one transaction at a time can hold this lock, preventing concurrent
    # reads of the same MAX value. Released automatically on commit/rollback.
    db.execute(text("SELECT pg_advisory_xact_lock(42)"))

    # Get the highest serial number
    result = db.execute(
        select(func.max(WorkOrder.serial_number))
    ).scalar()

    if result is None:
        next_number = 1
    else:
        current_number = int(result.replace('#', ''))
        next_number = current_number + 1

    return f"#{next_number:05d}"
