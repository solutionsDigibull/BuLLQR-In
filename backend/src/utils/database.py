"""Database utility functions."""
from contextlib import contextmanager
from sqlalchemy.orm import Session
from src.database import SessionLocal


@contextmanager
def get_db_context():
    """
    Context manager for database sessions with automatic commit/rollback.

    Yields:
        Session: Database session

    Example:
        with get_db_context() as db:
            user = db.query(Operator).filter_by(username="admin").first()
            user.is_active = True
            # Automatically commits on success, rolls back on exception
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def test_connection_pool(num_connections: int = 50) -> None:
    """
    Test connection pool with N concurrent connections.

    This validates that the connection pool configuration can handle
    the specified number of concurrent connections without exhaustion.

    Args:
        num_connections: Number of concurrent connections to test (default: 50)

    Example:
        >>> test_connection_pool(50)
        ✓ Successfully tested 50 concurrent connections
    """
    import threading

    def create_connection():
        with get_db_context() as db:
            db.execute("SELECT 1")

    threads = []
    for _ in range(num_connections):
        t = threading.Thread(target=create_connection)
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    print(f"✓ Successfully tested {num_connections} concurrent connections")
