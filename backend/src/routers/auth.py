"""Authentication router with login and user endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from src.database import get_db
from src.models import Operator
from src.auth.jwt import create_access_token
from src.auth.password import verify_password
from src.auth.rbac import get_current_user
from src.config import settings

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user and return JWT token. Accepts JSON body."""
    user = db.query(Operator).filter(Operator.username == credentials.username).first()

    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )

    token_data = {
        "user_id": str(user.id),
        "username": user.username,
        "role": user.role
    }
    access_token = create_access_token(token_data)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": 28800,
        "user": {
            "id": str(user.id),
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "station_id": user.station_id
        }
    }


class VerifyPasswordRequest(BaseModel):
    password: str


@router.post("/verify-sa-password")
def verify_sa_password(body: VerifyPasswordRequest):
    """Verify the System Administrator password for admin section access."""
    if body.password != settings.SA_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
        )
    return {"verified": True}


@router.get("/me")
def get_current_user_info(current_user: Operator = Depends(get_current_user)):
    """Get current authenticated user information."""
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "station_id": current_user.station_id,
        "is_active": current_user.is_active
    }
