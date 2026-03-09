# Cable Assembly Production Tracker - Backend

FastAPI backend for Cable Assembly Production Tracker with PostgreSQL database.

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

For development:
```bash
pip install -r requirements-dev.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update values:

```bash
cp .env.example .env
```

Edit `.env`:
```
DATABASE_URL=postgresql://cats_user:cats_password@localhost:5432/cats_db
SECRET_KEY=your-secret-key-minimum-32-characters
```

### 3. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE cats_db;
CREATE USER cats_user WITH PASSWORD 'cats_password';
GRANT ALL PRIVILEGES ON DATABASE cats_db TO cats_user;
\q
```

### 4. Run Migrations

```bash
# Apply database migrations
alembic upgrade head
```

### 5. Seed Initial Data

```bash
# Create 5 stages, admin user, default costs
python -m src.scripts.seed_data
```

Default admin credentials:
- **Username**: admin
- **Password**: changeme

⚠️ **IMPORTANT**: Change password after first login!

### 6. Run Server

Development mode:
```bash
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

Production mode:
```bash
uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Database Schema

The system uses 7 core tables:

1. **operators** - User accounts (operator, quality_inspector, supervisor, admin)
2. **products** - Cable product configurations
3. **production_stages** - 5 fixed stages (Cutting → Stripping → Crimping → Testing → Final Inspection)
4. **work_orders** - Individual cables being tracked
5. **scan_records** - Scan events with quality status
6. **quality_status_log** - Audit trail for status changes
7. **rework_costs** - Cost configuration for COPQ tracking

See `kitty-specs/001-cable-assembly-production-tracker/data-model.md` for complete schema.

## Connection Pooling

Configured for 50 concurrent users:
- Base pool size: 20 connections
- Max overflow: 30 additional connections
- Total capacity: 50 concurrent connections

## Timezone Handling

- All database timestamps stored in UTC
- Converted to IST (UTC+5:30) for display and export
- Utilities in `src/utils/timezone.py`

## Testing

Run tests:
```bash
pytest
```

With coverage:
```bash
pytest --cov=src --cov-report=html
```

Test connection pool:
```python
from src.utils.database import test_connection_pool
test_connection_pool(50)  # Test 50 concurrent connections
```

## Migrations

Create new migration:
```bash
alembic revision --autogenerate -m "Description"
```

Apply migrations:
```bash
alembic upgrade head
```

Rollback migration:
```bash
alembic downgrade -1
```

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Structure

```
backend/
├── alembic/              # Database migrations
│   ├── versions/         # Migration files
│   └── env.py           # Alembic configuration
├── src/
│   ├── models/          # SQLAlchemy ORM models
│   ├── schemas/         # Pydantic validation schemas
│   ├── routers/         # FastAPI route handlers
│   ├── services/        # Business logic
│   ├── websocket/       # WebSocket management
│   ├── auth/            # Authentication & authorization
│   ├── utils/           # Utility functions
│   ├── scripts/         # Database scripts
│   ├── config.py        # Configuration settings
│   ├── database.py      # Database connection
│   └── main.py          # FastAPI application
├── tests/
│   ├── unit/            # Unit tests
│   └── integration/     # Integration tests
├── requirements.txt     # Production dependencies
├── requirements-dev.txt # Development dependencies
├── .env.example         # Environment template
└── README.md            # This file
```

## Next Steps

After completing WP01 (Database Foundation):
- WP02: Authentication & Authorization (JWT + RBAC)
- WP03: API Router Setup & Core Schemas

## Constitution Compliance

- ✅ Python 3.11+ with FastAPI
- ✅ PostgreSQL database
- ✅ Connection pooling for 50 concurrent users
- ✅ pytest for testing (80% coverage target)
- ✅ Docker-ready (Dockerfile to be added in WP16)
