"""FastAPI application for Cable Assembly Production Tracker."""
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from src.config import settings

# Create FastAPI application
app = FastAPI(
    title="Cable Assembly Production Tracker API",
    description="EMS cable assembly production tracking with quality inspection and real-time analytics",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware configuration for frontend
origins = settings.CORS_ORIGINS.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Root endpoint
@app.get("/", tags=["root"])
def root():
    """API root endpoint with basic information."""
    return {
        "message": "Cable Assembly Production Tracker API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


# Health check endpoint
@app.get("/health", tags=["health"])
def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }


# Exception handlers for standardized error responses
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors."""
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error": "ValidationError",
            "detail": str(exc.errors()[0]["msg"]) if exc.errors() else "Validation failed",
            "code": 400,
            "timestamp": datetime.utcnow().isoformat(),
            "path": str(request.url.path)
        }
    )


@app.exception_handler(IntegrityError)
async def integrity_exception_handler(request: Request, exc: IntegrityError):
    """Handle database integrity constraint violations."""
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={
            "error": "IntegrityError",
            "detail": "Database constraint violation - duplicate or invalid data",
            "code": 409,
            "timestamp": datetime.utcnow().isoformat(),
            "path": str(request.url.path)
        }
    )


@app.exception_handler(404)
async def not_found_exception_handler(request: Request, exc):
    """Handle 404 Not Found errors."""
    detail = "Resource not found"
    if hasattr(exc, "detail"):
        detail = exc.detail
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "error": "NotFoundError",
            "detail": detail,
            "code": 404,
            "timestamp": datetime.utcnow().isoformat(),
            "path": str(request.url.path)
        }
    )


@app.exception_handler(500)
async def internal_exception_handler(request: Request, exc):
    """Handle internal server errors."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "detail": "An unexpected error occurred",
            "code": 500,
            "timestamp": datetime.utcnow().isoformat(),
            "path": str(request.url.path)
        }
    )


# Include routers
from src.routers import auth, scan, analytics, config, websocket, session, export, ai

app.include_router(auth.router)
app.include_router(scan.router)
app.include_router(analytics.router)
app.include_router(config.router)
app.include_router(websocket.router)
app.include_router(session.router)
app.include_router(export.router)
app.include_router(ai.router)


# Application startup event
@app.on_event("startup")
async def startup_event():
    """Initialize application on startup — run migrations and seed default data."""
    print("=" * 70)
    print("Cable Assembly Production Tracker API")
    print("=" * 70)
    print(f"Version: 1.0.0")
    print(f"Docs: http://localhost:8000/docs")
    print(f"CORS Origins: {settings.CORS_ORIGINS}")
    print("=" * 70)

    # Auto-run Alembic migrations
    try:
        from alembic.config import Config
        from alembic import command
        alembic_cfg = Config("alembic.ini")
        command.upgrade(alembic_cfg, "head")
        print("✓ Database migrations applied")
    except Exception as e:
        print(f"⚠️  Migration warning: {e}")

    # Auto-seed default data (admin user, stages, rework costs)
    try:
        from src.database import SessionLocal
        from src.scripts.seed_data import seed_production_stages, seed_admin_user, seed_rework_costs
        db = SessionLocal()
        try:
            seed_production_stages(db)
            seed_admin_user(db)
            seed_rework_costs(db)
            print("✓ Seed data verified")
        finally:
            db.close()
    except Exception as e:
        print(f"⚠️  Seed data warning: {e}")


# Application shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown."""
    print("Shutting down Cable Assembly Production Tracker API")
