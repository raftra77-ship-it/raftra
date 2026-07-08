import React, { useState, useEffect, useRef } from 'react';
import { ToggleLeft, ToggleRight, Send, CheckCircle, Database } from 'lucide-react';
import { GlowButton } from '../GlowButton';

export interface CampaignItem {
  id: string;
  platform: string;
  name: string;
  objective: string;
  budget: number;
  roas: number;
  status: 'active' | 'paused' | 'pending_review';
}

interface WorkspaceCampaignProps {
  campaigns: CampaignItem[];
  onOpenReview: (itemId: string) => void;
  onToggleStatus: (id: string) => void;
}

export const WorkspaceCampaign: React.FC<WorkspaceCampaignProps> = ({
  campaigns,
  onOpenReview,
  onToggleStatus,
}) => {
  const [integrations, setIntegrations] = useState([
    { platform: 'Meta Ads', connected: true, accountName: 'Meta Sandbox (Act_208392)' },
    { platform: 'Google Ads', connected: true, accountName: 'Google Sandbox (902-8392)' },
    { platform: 'TikTok Ads', connected: false, accountName: 'Disconnected' },
  ]);

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [campaignLogs, setCampaignLogs] = useState<{ node: string; message: string; status: string }[]>([]);
  
  // Human Review Gate State
  const [reviewSpec, setReviewSpec] = useState<any>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [selectedAds, setSelectedAds] = useState<string[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const workspaceId = 5; // Hardcoded for demo

  // Connect WebSocket to listen for campaign_spec_generated
  useEffect(() => {
    let ws: WebSocket;
    const connect = () => {
      ws = new WebSocket(`ws://localhost:8005/ws?user_id=user_${workspaceId}&workspace_id=${workspaceId}`);
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'agent_log') {
          setCampaignLogs(prev => [...prev, { node: data.agent, message: data.message, status: data.status }]);
        } else if (data.type === 'campaign_spec_generated') {
          setReviewSpec(JSON.parse(data.spec));
          setIsGenerating(false);
        }
      };
      ws.onclose = () => setTimeout(connect, 3000);
    };
    connect();
    return () => ws.close();
  }, [workspaceId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [campaignLogs]);

  const handleSend = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setCampaignLogs([]);
    setReviewSpec(null);
    
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      await fetch(`http://localhost:8005/api/agents/${workspaceId}/campaign`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt, model: 'gemini-1.5-flash' })
      });
    } catch (e) {
      console.error(e);
      setIsGenerating(false);
    }
  };

  const handleSpecChange = (key: string, value: string) => {
    setReviewSpec((prev: any) => ({ ...prev, [key]: value }));
  };

  const handlePublish = () => {
    alert("Campaign Multi-platform JSON Payload generated and sent to simulated n8n webhook! Tracking IDs have been saved to Supabase.");
    setReviewSpec(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', height: '100%' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>AI Campaign Manager & Review Gate</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Prompt the LangGraph Supervisor to build a campaign, then review the JSON spec and attach creatives before publishing.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '20px', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT PANE: Chat & Logs */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)' }}>Campaign Strategist Agent</h3>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {campaignLogs.map((log, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: log.status === 'error' ? '#FF4444' : log.status === 'completed' ? '#00E676' : '#5A52FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>
                  {log.node[0]}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: log.status === 'error' ? '#FF4444' : log.status === 'completed' ? '#00E676' : 'var(--primary)', marginBottom: '4px' }}>{log.node}</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{log.message}</div>
                </div>
              </div>
            ))}
            {isGenerating && (
              <div style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="badge-pulse success" style={{ width: '8px', height: '8px', borderRadius: '50%' }}></div>
                LangGraph Supervisor is orchestrating campaign skills...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
              placeholder="e.g., Run a $50/day conversion campaign for GenZ..."
              style={{ flex: 1, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none' }}
            />
            <button 
              onClick={handleSend}
              disabled={isGenerating || !prompt.trim()}
              style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '0 24px', borderRadius: '8px', cursor: (isGenerating || !prompt.trim()) ? 'not-allowed' : 'pointer', opacity: (isGenerating || !prompt.trim()) ? 0.5 : 1, fontWeight: '500' }}
            >
              Strategize
            </button>
          </div>
        </div>

        {/* RIGHT PANE: Human Review Gate */}
        <div style={{ flex: 1, background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
            <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} color="var(--success)" /> Human Review Gate
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Review the LLM spec before multi-platform publish.</p>
          </div>
          
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
            {!reviewSpec ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '100px' }}>
                <Database size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                <p>No campaign spec generated yet.</p>
                <p style={{ fontSize: '12px', marginTop: '8px' }}>Run the strategist agent to build a campaign JSON.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Campaign Name (Agent Set)</label>
                  <input type="text" value={reviewSpec.campaign_name} onChange={(e) => handleSpecChange('campaign_name', e.target.value)} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }} />
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Objective</label>
                    <select value={reviewSpec.objective} onChange={(e) => handleSpecChange('objective', e.target.value)} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }}>
                      <option value="Conversions" style={{ color: '#000' }}>Conversions</option>
                      <option value="Traffic" style={{ color: '#000' }}>Traffic</option>
                      <option value="Awareness" style={{ color: '#000' }}>Awareness</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Daily Budget ($)</label>
                    <input type="number" value={reviewSpec.daily_budget} onChange={(e) => handleSpecChange('daily_budget', e.target.value)} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }} />
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Audience Targeting (RAG Fetched)</label>
                  <textarea value={reviewSpec.audience} onChange={(e) => handleSpecChange('audience', e.target.value)} rows={3} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', resize: 'vertical' }} />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Placements</label>
                  <input type="text" value={reviewSpec.placements} onChange={(e) => handleSpecChange('placements', e.target.value)} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }} />
                </div>

                {/* Creative Attachment Section */}
                <div style={{ marginTop: '10px', padding: '16px', background: 'rgba(90,82,255,0.05)', border: '1px dashed var(--primary)', borderRadius: '8px' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    Campaign Creatives
                    <button onClick={() => setIsLibraryOpen(true)} style={{ fontSize: '12px', background: 'var(--primary)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}>+ Attach from Library</button>
                  </h4>
                  {selectedAds.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No creatives attached. The rotation agent needs at least 2 creatives to prevent ad fatigue.</div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {selectedAds.map((ad, i) => (
                        <div key={i} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          📸 Creative #{ad} 
                          <span onClick={() => setSelectedAds(prev => prev.filter(x => x !== ad))} style={{ cursor: 'pointer', color: 'var(--warning)' }}>✕</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button onClick={handlePublish} style={{ marginTop: '20px', background: 'var(--success)', color: '#fff', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>
                  Approve & Publish to n8n (Multi-Platform)
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Ad Library Modal */}
      {isLibraryOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: '12px', width: '500px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
              Select Ad from Library
              <button onClick={() => setIsLibraryOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[101, 102, 103, 104].map(id => (
                <div key={id} onClick={() => { setSelectedAds(prev => [...new Set([...prev, id.toString()])]); setIsLibraryOpen(false); }} style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>🖼️</div>
                  <div style={{ fontSize: '13px' }}>AI Creative #{id}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
