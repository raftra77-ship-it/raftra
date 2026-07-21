import React, { useState, useEffect } from 'react';
import { Markdown } from '../Markdown';

interface Draft {
  id: number;
  title: string;
  body: string;
  content_type: string;
  target_keyword?: string;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending_review: '#FFB020',
  approved: '#22C55E',
  rejected: '#EF4444',
  published: '#5A52FF',
};

// Self-contained content generation + human-review queue.
export const WorkspaceContent: React.FC<{ workspaceId: number | null }> = ({ workspaceId }) => {
  const [topic, setTopic] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const authHeaders = (): HeadersInit => {
    const token = localStorage.getItem('token');
    return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' };
  };

  const loadDrafts = () => {
    if (!workspaceId) return;
    fetch(`/api/workspaces/${workspaceId}/content`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d && Array.isArray(d.drafts)) setDrafts(d.drafts); })
      .catch(() => {});
  };

  useEffect(() => { loadDrafts(); /* eslint-disable-next-line */ }, [workspaceId]);

  const generate = async () => {
    if (!workspaceId || !topic.trim()) return;
    setLoading(true);
    try {
      await fetch(`/api/workspaces/${workspaceId}/content/generate`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ topic, content_type: 'blog' }),
      });
      setTopic('');
      // Poll for the new draft to arrive (generation runs in the background).
      let tries = 0;
      const poll = setInterval(() => {
        tries += 1;
        loadDrafts();
        if (tries >= 12) { clearInterval(poll); setLoading(false); }
      }, 3000);
    } catch {
      setLoading(false);
    }
  };

  const review = async (id: number, action: 'approve' | 'reject' | 'publish') => {
    if (!workspaceId) return;
    await fetch(`/api/workspaces/${workspaceId}/content/${id}/review`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ action }),
    });
    loadDrafts();
  };

  return (
    <div className="glow-card" style={{ padding: '24px', marginTop: '24px' }}>
      <h3 style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        CONTENT STUDIO — GENERATE & REVIEW
      </h3>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic or target keyword (e.g. 'mastering recursion for interviews')"
          style={{ flex: 1, padding: '12px 14px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', outline: 'none' }}
        />
        <button
          onClick={generate}
          disabled={loading || !topic.trim()}
          style={{ padding: '12px 20px', background: 'linear-gradient(135deg, var(--primary) 0%, #3B33FF 100%)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap' }}
        >
          {loading ? 'Generating…' : 'Generate Content'}
        </button>
      </div>

      {drafts.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          No content yet. Enter a topic and generate an SEO article — it will appear here for review.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {drafts.map((d) => (
          <div key={d.id} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ fontWeight: 600, color: '#fff' }}>{d.title}</div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: STATUS_COLORS[d.status] || '#aaa', textTransform: 'uppercase' }}>{d.status.replace('_', ' ')}</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {d.content_type}{d.target_keyword ? ` · target: ${d.target_keyword}` : ''}
            </div>

            {expanded === d.id && (
              <div style={{ marginTop: '12px', maxHeight: '360px', overflow: 'auto', background: 'rgba(0,0,0,0.25)', padding: '16px', borderRadius: '8px' }}>
                <Markdown text={d.body} />
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={() => setExpanded(expanded === d.id ? null : d.id)} style={btn('rgba(255,255,255,0.06)')}>
                {expanded === d.id ? 'Hide' : 'View'}
              </button>
              {d.status === 'pending_review' && (
                <>
                  <button onClick={() => review(d.id, 'approve')} style={btn('rgba(34,197,94,0.15)', '#22C55E')}>Approve</button>
                  <button onClick={() => review(d.id, 'reject')} style={btn('rgba(239,68,68,0.15)', '#EF4444')}>Reject</button>
                </>
              )}
              {d.status === 'approved' && (
                <button onClick={() => review(d.id, 'publish')} style={btn('rgba(90,82,255,0.2)', '#8B85FF')}>Publish</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function btn(bg: string, color = '#fff'): React.CSSProperties {
  return { padding: '6px 14px', background: bg, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color, fontSize: '13px', fontWeight: 500, cursor: 'pointer' };
}
