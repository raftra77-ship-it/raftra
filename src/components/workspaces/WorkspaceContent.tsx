import React, { useState, useEffect } from 'react';
import { Markdown } from '../Markdown';
import { GitHubPanel } from './GitHubPanel';
import { ShopifyPanel } from './ShopifyPanel';
import { WordPressPanel } from './WordPressPanel';

interface Draft {
  id: number;
  title: string;
  body: string;
  content_type: string;
  target_keyword?: string;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending_review: 'Needs review',
  approved: 'Approved — ready to send',
  rejected: 'Rejected',
  published: 'Sent to site',
};
const STATUS_COLORS: Record<string, string> = {
  pending_review: '#FFB020',
  approved: '#22C55E',
  rejected: '#EF4444',
  published: '#5A52FF',
};

// Reject obvious junk (e.g. "fgg") client-side so the user gets instant feedback.
const looksLikeRealTopic = (t: string) => {
  const s = t.trim();
  if (s.length < 4) return false;
  const words = s.match(/[A-Za-z][A-Za-z'-]*/g) || [];
  return words.some(w => w.length >= 3 && /[aeiou]/i.test(w));
};

export const WorkspaceContent: React.FC<{ workspaceId: number | null }> = ({ workspaceId }) => {
  const [topic, setTopic] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [topicError, setTopicError] = useState<string | null>(null);
  // Inline editing of a draft.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  // Which publish destinations are actually connected.
  const [targets, setTargets] = useState<{ github: boolean; shopify: boolean; wordpress: boolean }>(
    { github: false, shopify: false, wordpress: false }
  );
  const [choice, setChoice] = useState<Record<number, string>>({});

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

  const loadTargets = () => {
    if (!workspaceId) return;
    const get = (name: string) =>
      fetch(`/api/connectors/${name}/${workspaceId}/status`, { headers: authHeaders() })
        .then(r => (r.ok ? r.json() : null)).then(s => !!(s && s.connected)).catch(() => false);
    Promise.all([get('github'), get('shopify'), get('wordpress')])
      .then(([github, shopify, wordpress]) => setTargets({ github, shopify, wordpress }));
  };

  useEffect(() => { loadDrafts(); loadTargets(); /* eslint-disable-next-line */ }, [workspaceId]);

  const generate = async () => {
    if (!workspaceId) return;
    if (!looksLikeRealTopic(topic)) {
      setTopicError("That doesn't look like a real topic. Enter a few words describing what to write about — e.g. \"best data structures for coding interviews\".");
      return;
    }
    setTopicError(null);
    setLoading(true);
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/content/generate`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ topic, content_type: 'blog' }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setTopicError(e.detail || 'Could not start generation.');
        setLoading(false);
        return;
      }
      setTopic('');
      // Generation runs in the background — poll for the new draft.
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

  const review = async (id: number, action: 'approve' | 'reject') => {
    if (!workspaceId) return;
    await fetch(`/api/workspaces/${workspaceId}/content/${id}/review`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ action }),
    });
    loadDrafts();
  };

  const startEdit = (d: Draft) => {
    setEditingId(d.id); setEditTitle(d.title); setEditBody(d.body); setExpanded(d.id);
  };

  const saveEdit = async (id: number) => {
    if (!workspaceId) return;
    await fetch(`/api/workspaces/${workspaceId}/content/${id}/edit`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ title: editTitle, body: editBody }),
    });
    setEditingId(null);
    setNotice('Saved your edits. The draft is back in "Needs review" so you can approve the new version.');
    loadDrafts();
  };

  // Send the approved draft to the chosen CONNECTED site. Each destination creates
  // something a human still confirms (a PR / an unpublished article / a draft). If the
  // send fails we say so and leave the draft unchanged — never mark it published falsely.
  const publish = async (id: number, target: string) => {
    if (!workspaceId || !target) return;
    setNotice(null);
    const r = await fetch(`/api/connectors/${target}/${workspaceId}/publish-draft`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ draft_id: id }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setNotice(`Could not send to ${target}: ${d.detail || 'unknown error'}. The draft was left unchanged.`);
      return;
    }
    const link = d.pr_url || d.admin_url || d.edit_url;
    setNotice(`${d.message || 'Sent successfully.'}${link ? ` → ${link}` : ''}`);
    loadDrafts();
  };

  return (
    <>
      <div className="glow-card" style={{ padding: '24px', marginTop: '24px' }}>
        <h3 style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '6px' }}>
          CONTENT STUDIO — GENERATE & REVIEW
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>
          Enter a topic → AI writes a draft → you review, edit if needed, and approve → send it to your site.
          <strong style={{ color: '#fff' }}> Nothing publishes automatically</strong> — it arrives as a pull
          request (GitHub) or an unpublished draft (Shopify / WordPress), so you press the final publish yourself.
        </p>

        {notice && (
          <div style={{ fontSize: '12px', color: '#8B85FF', background: 'rgba(90,82,255,0.1)', border: '1px solid rgba(90,82,255,0.25)', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', wordBreak: 'break-word' }}>
            {notice}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginBottom: topicError ? '8px' : '20px' }}>
          <input
            value={topic}
            onChange={(e) => { setTopic(e.target.value); if (topicError) setTopicError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') generate(); }}
            placeholder="Topic or target keyword (e.g. 'mastering recursion for interviews')"
            style={{ flex: 1, padding: '12px 14px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${topicError ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '10px', color: '#fff', outline: 'none' }}
          />
          <button
            onClick={generate}
            disabled={loading || !topic.trim()}
            style={{ padding: '12px 20px', background: 'linear-gradient(135deg, var(--primary) 0%, #3B33FF 100%)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap' }}
          >
            {loading ? 'Generating…' : 'Generate Content'}
          </button>
        </div>
        {topicError && (
          <div style={{ fontSize: '12px', color: '#EF4444', marginBottom: '20px' }}>{topicError}</div>
        )}

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
                <span style={{ fontSize: '11px', fontWeight: 700, color: STATUS_COLORS[d.status] || '#aaa', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  {STATUS_LABEL[d.status] || d.status.replace('_', ' ')}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {d.content_type}{d.target_keyword ? ` · target: ${d.target_keyword}` : ''}
              </div>

              {editingId === d.id ? (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                    style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
                  <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={14}
                    style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '13px', fontFamily: 'var(--font-mono)', lineHeight: 1.6, resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => saveEdit(d.id)} style={btn('rgba(34,197,94,0.15)', '#22C55E')}>Save changes</button>
                    <button onClick={() => setEditingId(null)} style={btn('rgba(255,255,255,0.06)')}>Cancel</button>
                  </div>
                </div>
              ) : (
                expanded === d.id && (
                  <div style={{ marginTop: '12px', maxHeight: '360px', overflow: 'auto', background: 'rgba(0,0,0,0.25)', padding: '16px', borderRadius: '8px' }}>
                    <Markdown text={d.body} />
                  </div>
                )
              )}

              {editingId !== d.id && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                  <button onClick={() => setExpanded(expanded === d.id ? null : d.id)} style={btn('rgba(255,255,255,0.06)')}>
                    {expanded === d.id ? 'Hide' : 'View'}
                  </button>
                  {d.status !== 'published' && (
                    <button onClick={() => startEdit(d)} style={btn('rgba(255,255,255,0.06)')}>Edit</button>
                  )}
                  {d.status === 'pending_review' && (
                    <>
                      <button onClick={() => review(d.id, 'approve')} style={btn('rgba(34,197,94,0.15)', '#22C55E')}>Approve</button>
                      <button onClick={() => review(d.id, 'reject')} style={btn('rgba(239,68,68,0.15)', '#EF4444')}>Reject</button>
                    </>
                  )}
                  {d.status === 'approved' && (() => {
                    const available = ([
                      ['github', 'GitHub (opens a pull request)'],
                      ['shopify', 'Shopify (unpublished article)'],
                      ['wordpress', 'WordPress (draft post)'],
                    ] as const).filter(([k]) => targets[k as keyof typeof targets]);
                    if (available.length === 0) {
                      return (
                        <span style={{ fontSize: '12px', color: '#FFB020', alignSelf: 'center' }}>
                          Connect GitHub, Shopify or WordPress below to send this to your site.
                        </span>
                      );
                    }
                    const selected = choice[d.id] || available[0][0];
                    return (
                      <>
                        <select value={selected} onChange={(e) => setChoice(c => ({ ...c, [d.id]: e.target.value }))}
                          style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}>
                          {available.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                        </select>
                        <button onClick={() => publish(d.id, selected)} style={btn('rgba(90,82,255,0.2)', '#8B85FF')}>Send to site</button>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <GitHubPanel workspaceId={workspaceId} />
      <ShopifyPanel workspaceId={workspaceId} />
      <WordPressPanel workspaceId={workspaceId} />
    </>
  );
};

function btn(bg: string, color = '#fff'): React.CSSProperties {
  return { padding: '6px 14px', background: bg, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color, fontSize: '13px', fontWeight: 500, cursor: 'pointer' };
}
