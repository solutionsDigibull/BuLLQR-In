"""Role-Based Access Control (RBAC) for FastAPI routes."""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from src.database import get_db
from src.models import Operator
from src.auth.jwt import verify_token

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Operator:
    """
    Get current authenticated user from JWT token.

    Args:
        token: JWT token from Authorization header
        db: Database session

    Returns:
        Operator: Current authenticated user

    Raises:
        HTTPException: 401 if token invalid or user not found, 400 if user inactive

    Example:
        @router.get("/protected")
        def protected_route(current_user: Operator = Depends(get_current_user)):
            return {"user": current_user.username}
    """
    # Verify token
    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Find user
    user = db.query(Operator).filter(Operator.id == payload["user_id"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )

    return user


def require_role(*allowed_roles: str):
    """
    Dependency factory to require specific role(s) for endpoint access.

    Args:
        *allowed_roles: One or more role names that are allowed

    Returns:
        Callable: Dependency function that checks user role

    Raises:
        HTTPException: 403 if user role not in allowed_roles

    Example:
        @router.get("/admin-only")
        def admin_endpoint(current_user: Operator = Depends(require_role("admin"))):
            return {"message": "Admin access granted"}

        @router.get("/supervisor-or-admin")
        def supervisor_endpoint(current_user: Operator = Depends(require_role("supervisor", "admin"))):
            return {"message": "Supervisor access granted"}
    """
    def role_checker(current_user: Operator = Depends(get_current_user)) -> Operator:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker


# Convenience dependencies for common role combinations
# All authenticated users (any role)
require_authenticated = get_current_user

# Operators and above (operator, quality_inspector, supervisor, admin)
require_operator = require_role("operator", "quality_inspector", "supervisor", "admin")

# Quality Inspectors and above (quality_inspector, supervisor, admin)
require_qi = require_role("quality_inspector", "supervisor", "admin")

# Supervisors and above (supervisor, admin)
require_supervisor = require_role("supervisor", "admin")

# Admins only
require_admin = require_role("admin")
