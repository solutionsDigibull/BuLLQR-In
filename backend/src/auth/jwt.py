"""JWT token generation and validation."""
from datetime import datetime, timedelta
from jose import JWTError, jwt
from src.config import settings


def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """
    Generate JWT access token.

    Args:
        data: Token payload data (user_id, username, role)
        expires_delta: Optional custom expiration time

    Returns:
        str: Encoded JWT token

    Example:
        >>> token_data = {"user_id": "123", "username": "admin", "role": "admin"}
        >>> token = create_access_token(token_data)
    """
    to_encode = data.copy()

    # Set expiration time
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS)

    # Add expiration and issued-at timestamps
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow()
    })

    # Encode JWT with secret key
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> dict:
    """
    Verify and decode JWT token.

    Args:
        token: JWT token string

    Returns:
        dict: Token payload if valid, None if invalid

    Example:
        >>> payload = verify_token(token)
        >>> if payload:
        ...     print(f"User: {payload['username']}")
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None
