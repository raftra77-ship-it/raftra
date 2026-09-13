import { useEffect, useRef } from 'react';

export interface LiveEvent {
  type: string;
  [key: string]: any;
}

// Same address rule as the dashboard's agent feed (BrandDashboard.tsx): Vercel does not proxy
// WebSocket upgrades, so production needs VITE_WS_URL pointing at the backend host.
const liveUrl = () =>
  import.meta.env.VITE_WS_URL ||
  (import.meta.env.DEV
    ? 'ws://localhost:8005/ws'
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`);

/**
 * Subscribe to the authenticated /ws socket: chat messages, deal updates and payout updates
 * addressed to the signed-in user. The server closes the socket unless the first frame carries
 * a valid token, and only ever sends a user their own events.
 *
 * Reconnects with backoff. Screens using this should still poll occasionally - a socket can
 * be down (sleeping host, network change) and the database is the source of truth.
 */
export function useLiveEvents(onEvent: (event: LiveEvent) => void, enabled = true) {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    let socket: WebSocket | null = null;
    let stopped = false;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const token = localStorage.getItem('token');
      if (!token || stopped) return;
      socket = new WebSocket(liveUrl());
      socket.onopen = () => {
        attempt = 0;
        socket?.send(JSON.stringify({ type: 'auth', token }));
      };
      socket.onmessage = event => {
        try { handler.current(JSON.parse(event.data)); } catch { /* not ours */ }
      };
      socket.onclose = () => {
        if (stopped) return;
        attempt += 1;
        retry = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(attempt, 5)));
      };
      socket.onerror = () => { try { socket?.close(); } catch { /* already closed */ } };
    };

    connect();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      try { socket?.close(); } catch { /* already closed */ }
    };
  }, [enabled]);
}
