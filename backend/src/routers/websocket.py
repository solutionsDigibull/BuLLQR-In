"""WebSocket endpoints for real-time updates."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, status
from sqlalchemy.orm import Session
from src.database import get_db
from src.websocket.manager import manager
from src.auth.jwt import verify_token
from src.models import Operator, ScanRecord, WorkOrder, ProductionStage
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


async def get_current_user_ws(
    token: str = Query(..., description="JWT authentication token"),
    db: Session = Depends(get_db)
) -> Operator:
    """
    Authenticate WebSocket connection via JWT token in query params.

    Args:
        token: JWT token from query parameters
        db: Database session

    Returns:
        Operator: Authenticated user

    Raises:
        Exception: If authentication fails
    """
    # Verify token
    payload = verify_token(token)
    if not payload:
        raise Exception("Invalid authentication token")

    # Find user
    user = db.query(Operator).filter(Operator.id == payload["user_id"]).first()
    if not user:
        raise Exception("User not found")

    # Check if active
    if not user.is_active:
        raise Exception("Inactive user")

    return user


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT authentication token"),
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for real-time updates.

    Authenticates via JWT token in query parameters and maintains connection
    for broadcasting scan events, quality updates, and dashboard data.

    **Authentication**: JWT token required in query params (?token=xxx)

    **Message Types**:
    - scan: New scan event
    - quality_update: Quality status changed
    - session_update: Last 10 scans update
    - dashboard_update: Production metrics update

    **Example Connection**:
    ```javascript
    const token = "eyJhbGci...";
    const ws = new WebSocket(`ws://localhost:8000/ws?token=${token}`);
    ```

    **Message Format**:
    ```json
    {
        "event_type": "scan",
        "payload": { ... },
        "timestamp": "2025-02-05T10:30:00"
    }
    ```
    """
    connection_id = None

    try:
        # Authenticate user
        try:
            current_user = await get_current_user_ws(token, db)
            logger.info(f"WebSocket auth successful: {current_user.username}")
        except Exception as e:
            logger.error(f"WebSocket auth failed: {e}")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication failed")
            return

        # Connect to manager
        try:
            connection_id = await manager.connect(websocket)
            logger.info(f"WebSocket connected: {connection_id} (user: {current_user.username})")

            # Send welcome message
            await manager.send_personal(connection_id, {
                "event_type": "connected",
                "payload": {
                    "message": "Connected to Cable Assembly Production Tracker",
                    "user": current_user.username,
                    "connection_id": connection_id
                }
            })

            # Send initial session data (last 10 scans)
            recent_scans = get_recent_scans(db, limit=10)
            if recent_scans:
                await manager.send_personal(connection_id, {
                    "event_type": "session_update",
                    "payload": {"scans": recent_scans}
                })

            # Keep connection alive and handle incoming messages
            while True:
                # Wait for messages from client (ping/pong, etc.)
                data = await websocket.receive_text()
                logger.debug(f"Received from {connection_id}: {data}")

                # Echo back for heartbeat/ping-pong
                await websocket.send_text(data)

        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected: {connection_id}")
            if connection_id:
                manager.disconnect(connection_id)

        except Exception as e:
            logger.error(f"WebSocket error for {connection_id}: {e}")
            if connection_id:
                manager.disconnect(connection_id)
            raise

    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
        if connection_id:
            manager.disconnect(connection_id)


def get_recent_scans(db: Session, limit: int = 10) -> list:
    """
    Get recent scan records for session display.

    Args:
        db: Database session
        limit: Number of recent scans to return

    Returns:
        list: List of recent scan dictionaries
    """
    scans = db.query(ScanRecord).join(WorkOrder).join(ProductionStage).order_by(
        ScanRecord.scan_timestamp.desc()
    ).limit(limit).all()

    result = []
    for scan in scans:
        from src.models import Operator
        operator = db.query(Operator).filter(Operator.id == scan.operator_id).first()

        result.append({
            "scan_id": str(scan.id),
            "work_order_id": str(scan.work_order_id),
            "barcode": scan.work_order.work_order_code,
            "stage_name": scan.stage.stage_name,
            "stage_sequence": scan.stage.stage_sequence,
            "operator_name": operator.full_name if operator else "Unknown",
            "quality_status": scan.quality_status,
            "is_first_article": scan.is_first_article,
            "scanned_at": scan.scan_timestamp.isoformat() if scan.scan_timestamp else None
        })

    return result
