import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext.tsx';
import type { ScanRecord } from '../types/scan.ts';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface WebSocketMessage {
  event_type: string;
  payload: unknown;
  timestamp: string;
}

type SubscribeFn = (eventType: string, handler: (payload: unknown) => void) => () => void;

interface WebSocketContextValue {
  status: ConnectionStatus;
  lastScanEvent: ScanRecord | null;
  lastMessage: WebSocketMessage | null;
  subscribe: SubscribeFn;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

// Separate stable context for subscribe — never re-renders on status changes.
const SubscribeContext = createContext<SubscribeFn | null>(null);

const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_BASE_URL = import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.host}/ws`;
const MAX_RECONNECT_DELAY = 30000;

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const handlersRef = useRef<Map<string, Set<(payload: unknown) => void>>>(new Map());

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  // Use refs instead of state so incoming WS messages don't re-render the
  // entire provider tree (which was closing native <select> dropdowns).
  const lastScanEventRef = useRef<ScanRecord | null>(null);
  const lastMessageRef = useRef<WebSocketMessage | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    let disposed = false;
    let reconnectAttempts = 0;
    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
    let ws: WebSocket | null = null;

    function connect() {
      if (disposed) return;

      setStatus('connecting');
      ws = new WebSocket(`${WS_BASE_URL}?token=${token}`);

      ws.onopen = () => {
        if (disposed) { ws?.close(); return; }
        setStatus('connected');
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          lastMessageRef.current = message;

          if (message.event_type === 'scan_created' || message.event_type === 'scan_updated') {
            lastScanEventRef.current = message.payload as ScanRecord;
          }

          const eventHandlers = handlersRef.current.get(message.event_type);
          if (eventHandlers) {
            eventHandlers.forEach((handler) => handler(message.payload));
          }

          const wildcardHandlers = handlersRef.current.get('*');
          if (wildcardHandlers) {
            wildcardHandlers.forEach((handler) => handler(message));
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        ws = null;
        if (disposed) return;
        setStatus('disconnected');

        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttempts),
          MAX_RECONNECT_DELAY,
        );
        reconnectAttempts += 1;
        reconnectTimeout = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
        ws = null;
      }
    };
  }, [isAuthenticated, token]);

  const subscribe = useCallback(
    (eventType: string, handler: (payload: unknown) => void) => {
      if (!handlersRef.current.has(eventType)) {
        handlersRef.current.set(eventType, new Set());
      }
      handlersRef.current.get(eventType)!.add(handler);

      return () => {
        handlersRef.current.get(eventType)?.delete(handler);
      };
    },
    [],
  );

  // Build context value — changes only when `status` changes (connect/disconnect).
  // Only Header uses this; pages that just need `subscribe` use SubscribeContext.
  const value: WebSocketContextValue = {
    status,
    lastScanEvent: lastScanEventRef.current,
    lastMessage: lastMessageRef.current,
    subscribe,
  };

  return (
    <SubscribeContext.Provider value={subscribe}>
      <WebSocketContext.Provider value={value}>
        {children}
      </WebSocketContext.Provider>
    </SubscribeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWebSocket(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

// Use this hook when you only need `subscribe` — it does NOT re-render on
// status changes, keeping native <select> dropdowns stable.
// eslint-disable-next-line react-refresh/only-export-components
export function useWebSocketSubscribe(): SubscribeFn {
  const subscribe = useContext(SubscribeContext);
  if (!subscribe) {
    throw new Error('useWebSocketSubscribe must be used within a WebSocketProvider');
  }
  return subscribe;
}
