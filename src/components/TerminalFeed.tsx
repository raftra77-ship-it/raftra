import React, { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

export interface LogLine {
  id: string;
  time: string;
  agent: string;
  message: string;
}

interface TerminalFeedProps {
  logs: LogLine[];
  height?: string;
  title?: string;
}

export const TerminalFeed: React.FC<TerminalFeedProps> = ({ logs, height = '320px', title = 'RAFTRA CORE AGENT TERMINAL' }) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  return (
    <div className="live-terminal-panel" style={{ height }}>
      <div className="terminal-header">
        <div className="terminal-dots">
          <div className="terminal-dot red" />
          <div className="terminal-dot yellow" />
          <div className="terminal-dot green" />
        </div>
        <div className="terminal-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Terminal size={12} className="logo-icon" />
          <span>{title}</span>
        </div>
        <div style={{ width: '40px' }} /> {/* Spacer */}
      </div>
      <div className="live-terminal-logs">
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px' }}>
            System online. Waiting for agent events...
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="terminal-log-line">
              <span className="terminal-time">[{log.time}]</span>
              <span className="terminal-prefix" style={{ color: log.agent === 'SEO Agent' ? '#00ff9d' : log.agent === 'Creative Agent' ? '#a8a4ff' : '#ffa502' }}>
                {log.agent}:
              </span>
              <span className="terminal-message">{log.message}</span>
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
