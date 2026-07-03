import React from 'react';

export type AgentState = 'working' | 'waiting' | 'idle';

interface AgentStatusBadgeProps {
  state: AgentState;
  agentName: string;
}

export const AgentStatusBadge: React.FC<AgentStatusBadgeProps> = ({ state, agentName }) => {
  const getPulseClass = () => {
    switch (state) {
      case 'working':
        return 'badge-pulse success';
      case 'waiting':
        return 'badge-pulse warning';
      case 'idle':
      default:
        return '';
    }
  };

  const getStatusLabel = () => {
    switch (state) {
      case 'working':
        return 'Running';
      case 'waiting':
        return 'Needs Approval';
      case 'idle':
      default:
        return 'Idle';
    }
  };

  return (
    <div
      className="glass"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 10px',
        borderRadius: 'var(--radius-full)',
        fontSize: '11px',
        fontWeight: 500,
        border: '1px solid var(--border-color)',
        color: state === 'idle' ? 'var(--text-secondary)' : 'var(--text-primary)',
      }}
    >
      {state !== 'idle' && <span className={getPulseClass()} />}
      <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.6 }}>{agentName}:</span>
      <span>{getStatusLabel()}</span>
    </div>
  );
};
