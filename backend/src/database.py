"""Database configuration and session management."""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from src.config import settings

# Connection pooling configuration for 50 concurrent users
# pool_size=20: Base connection pool
# max_overflow=30: Additional connections when needed (total: 50)
# pool_pre_ping=True: Verify connections before use (handle stale connections)
# pool_recycle=3600: Recycle connections every hour (prevent timeout issues)
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=20,
    max_overflow=30,
    pool_pre_ping=True,
    pool_recycle=3600
)

# Session factory for database operations
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for SQLAlchemy ORM models
Base = declarative_base()


def get_db():
    """
    Dependency injection for database sessions.

    Yields:
        Session: Database session

    Example:
        @app.get("/items")
        def read_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
