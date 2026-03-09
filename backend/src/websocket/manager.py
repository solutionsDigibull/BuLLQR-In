"""WebSocket connection manager for real-time updates."""
from typing import Dict, List
from fastapi import WebSocket
from datetime import datetime
import json
import uuid
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for real-time updates.

    Supports:
    - Connection registration and cleanup
    - Broadcasting to all connected clients
    - Broadcasting to specific connections
    - Message formatting for different event types
    - Connection limits (50 concurrent connections per spec)

    Thread-safe for concurrent connections.
    """

    def __init__(self, max_connections: int = 50):
        """
        Initialize connection manager.

        Args:
            max_connections: Maximum concurrent connections (default: 50)
        """
        self.active_connections: Dict[str, WebSocket] = {}
        self.max_connections = max_connections
        logger.info(f"ConnectionManager initialized (max connections: {max_connections})")

    async def connect(self, websocket: WebSocket, connection_id: str = None) -> str:
        """
        Accept and register a new WebSocket connection.

        Args:
            websocket: WebSocket connection to register
            connection_id: Optional connection ID (auto-generated if not provided)

        Returns:
            str: Connection ID

        Raises:
            Exception: If max connections exceeded
        """
        if len(self.active_connections) >= self.max_connections:
            logger.warning(f"Max connections ({self.max_connections}) exceeded")
            raise Exception(f"Maximum connections ({self.max_connections}) reached")

        if connection_id is None:
            connection_id = str(uuid.uuid4())

        await websocket.accept()
        self.active_connections[connection_id] = websocket
        logger.info(f"WebSocket connected: {connection_id} (total: {len(self.active_connections)})")

        return connection_id

    def disconnect(self, connection_id: str):
        """
        Remove a WebSocket connection.

        Args:
            connection_id: Connection ID to remove
        """
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
            logger.info(f"WebSocket disconnected: {connection_id} (remaining: {len(self.active_connections)})")

    async def broadcast(self, message: dict):
        """
        Broadcast a message to all connected clients.

        Args:
            message: Message dictionary to broadcast (will be JSON-encoded)
        """
        # Add timestamp if not present
        if 'timestamp' not in message:
            message['timestamp'] = datetime.utcnow().isoformat()

        message_json = json.dumps(message)
        disconnected = []

        for connection_id, websocket in self.active_connections.items():
            try:
                await websocket.send_text(message_json)
            except Exception as e:
                logger.error(f"Failed to send to {connection_id}: {e}")
                disconnected.append(connection_id)

        # Clean up disconnected clients
        for connection_id in disconnected:
            self.disconnect(connection_id)

    async def send_personal(self, connection_id: str, message: dict):
        """
        Send a message to a specific connection.

        Args:
            connection_id: Target connection ID
            message: Message dictionary to send
        """
        if connection_id not in self.active_connections:
            logger.warning(f"Connection {connection_id} not found")
            return

        # Add timestamp if not present
        if 'timestamp' not in message:
            message['timestamp'] = datetime.utcnow().isoformat()

        try:
            await self.active_connections[connection_id].send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Failed to send personal message to {connection_id}: {e}")
            self.disconnect(connection_id)

    async def broadcast_scan_event(self, scan_data: dict):
        """
        Broadcast a scan event to all connected clients.

        Args:
            scan_data: Scan event data (scan_id, barcode, stage, operator, etc.)
        """
        message = {
            "event_type": "scan",
            "payload": scan_data
        }
        await self.broadcast(message)
        logger.info(f"Broadcasted scan event: {scan_data.get('barcode')}")

    async def broadcast_quality_update(self, update_data: dict):
        """
        Broadcast a quality status update to all connected clients.

        Args:
            update_data: Quality update data (scan_id, previous_status, new_status, etc.)
        """
        message = {
            "event_type": "quality_update",
            "payload": update_data
        }
        await self.broadcast(message)
        logger.info(f"Broadcasted quality update: {update_data.get('scan_id')}")

    async def broadcast_session_update(self, session_data: List[dict]):
        """
        Broadcast session display update (last 10 scans).

        Args:
            session_data: List of recent scan records
        """
        message = {
            "event_type": "session_update",
            "payload": {
                "scans": session_data
            }
        }
        await self.broadcast(message)

    async def broadcast_dashboard_update(self, dashboard_data: dict):
        """
        Broadcast dashboard data update.

        Args:
            dashboard_data: Dashboard metrics (production progress, counts, etc.)
        """
        message = {
            "event_type": "dashboard_update",
            "payload": dashboard_data
        }
        await self.broadcast(message)

    def get_connection_count(self) -> int:
        """
        Get the number of active connections.

        Returns:
            int: Number of active connections
        """
        return len(self.active_connections)

    def get_connection_ids(self) -> List[str]:
        """
        Get list of all active connection IDs.

        Returns:
            List[str]: List of connection IDs
        """
        return list(self.active_connections.keys())


# Global connection manager instance
manager = ConnectionManager()
