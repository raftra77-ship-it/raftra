import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Eye, Check, Send, Trash, Edit3, Save } from 'lucide-react';
import { GlowButton } from '../GlowButton';

interface CreativeAsset {
  id: string;
  headline: string;
  bodyText: string;
  cta: string;
  type: string;
  status: 'pending_review' | 'approved' | 'rejected';
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'system' | 'agent';
  content: string;
  asset?: CreativeAsset;
}

interface WorkspaceCreativeProps {
  brandUrl: string;
  assets: CreativeAsset[];
  onOpenReview: (id: string) => void;
  onGenerate?: (prompt: string, referenceAd?: any, config?: any) => void;
  workspaceId?: number;
}

export const WorkspaceCreative: React.FC<WorkspaceCreativeProps> = ({
  brandUrl,
  assets,
  onOpenReview,
  onGenerate,
  workspaceId
}) => {
  const [prompt, setPrompt] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [referenceAd, setReferenceAd] = useState<CreativeAsset | null>(null);
  
  // Advanced Configurations
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash');
  const [adFormat, setAdFormat] = useState('Video');
  const [adRatio, setAdRatio] = useState('9:16');
  const [adLength, setAdLength] = useState('15s');
  
  // Toolkit State
  const [engineMode, setEngineMode] = useState('Video Ad');
  const [showConnectorsModal, setShowConnectorsModal] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // When assets list updates with new pending items from websocket, we push them into the chat!
  useEffect(() => {
    const latestPending = assets.filter(a => a.status === 'pending_review');
    if (latestPending.length > 0) {
      const newest = latestPending[0]; // Assuming newest is at the top from App.tsx
      
      // Prevent duplicate rendering in chat
      if (!chatHistory.find(msg => msg.asset?.id === newest.id)) {
        setIsGenerating(false);
        setChatHistory(prev => [
          ...prev, 
          {
            id: 'sys-' + Date.now(),
            role: 'agent',
            content: "Here is your generated ad based on your request. You can save it to the library, ask me to make changes, or delete it.",
            asset: newest
          }
        ]);
        setReferenceAd(null);
      }
    }
  }, [assets]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const userMsg: ChatMessage = {
      id: 'usr-' + Date.now(),
      role: 'user',
      content: prompt
    };

    setChatHistory(prev => [...prev, userMsg]);
    setIsGenerating(true);
    
    if (onGenerate) {
      onGenerate(prompt, referenceAd, {
        model: selectedModel,
        format: adFormat,
        ratio: adRatio,
        length: adLength,
        mode: engineMode
      });
    }
    
    setPrompt('');
  };

  const handleSaveToLibrary = async (asset: CreativeAsset) => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    try {
      const res = await fetch(`http://localhost:8005/api/workspaces/${workspaceId}/creatives/save`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          headline: asset.headline,
          body_text: asset.bodyText,
          cta: asset.cta,
          type: asset.type,
          image_url: asset.imageUrl,
          video_url: asset.videoUrl
        })
      });
      if (res.ok) {
        alert('Ad successfully saved to your Ad Library! It will appear on the right pane.');
        // Refresh handled by user or we could trigger App's refresh logic
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteLibraryAd = async (assetId: string) => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    const headers = { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };

    try {
      const res = await fetch(`http://localhost:8005/api/workspaces/${workspaceId}/creatives/${assetId}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        alert('Ad deleted from library! Please refresh to see changes.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSuggestChanges = (asset: CreativeAsset) => {
    setReferenceAd(asset);
    setPrompt(`Make changes to this ad: `);
  };

  const savedAssets = assets.filter(a => a.status === 'approved' || typeof a.id === 'number' || (!a.id.toString().startsWith('cr-') && !a.id.toString().startsWith('temp-')));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      alert(`Asset "${e.target.files[0].name}" successfully uploaded to the engine context!`);
    }
  };

  const toolkitModes = [
    { name: 'Ad Flow', desc: 'Node-based canvas', icon: '•' },
    { name: 'Avatar Video', desc: 'AI actors from scripts', icon: '•' },
    { name: 'AI Media Buyer', desc: 'Chat about performance', icon: '•' },
    { name: 'Video Ad', desc: 'Turn product into video ads', icon: '•' },
    { name: 'Image Ad', desc: 'Static ad creatives', icon: '•' },
    { name: 'HTML Interactive Ad', desc: 'Interactive web ads', icon: '•' },
    { name: 'Ad Clone', desc: 'Recreate winning ads', icon: '•' },
    { name: 'Create Avatar', desc: 'Branded AI avatar', icon: '•' },
    { name: 'Video Editor', desc: 'All-in-one editing', icon: '•' },
    { name: 'Track Competitors', desc: 'See their ads', icon: '•' },
    { name: 'Launch Ads', desc: 'Meta, TikTok, AppLovin', icon: '•' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '20px', height: '100%' }}>
      {/* LEFT TOOLKIT SIDEBAR */}
      <div style={{ width: '280px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)' }}>Engine Capabilities</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Select an AI mode</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '8px' }}>
          {toolkitModes.map((mode) => (
            <div 
              key={mode.name}
              onClick={() => setEngineMode(mode.name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: engineMode === mode.name ? 'rgba(90, 82, 255, 0.1)' : 'transparent',
                border: engineMode === mode.name ? '1px solid var(--primary)' : '1px solid transparent',
                transition: 'all 0.2s',
                marginBottom: '4px'
              }}
            >
              <div style={{ fontSize: '18px', color: engineMode === mode.name ? 'var(--primary)' : 'var(--text-secondary)' }}>{mode.icon}</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: engineMode === mode.name ? '600' : '400', color: engineMode === mode.name ? 'var(--primary)' : 'var(--text-primary)' }}>{mode.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{mode.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN CHAT & LIBRARY PANE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>
              {engineMode} <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 'normal' }}>— AI Studio</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Describe what you want to generate using the <strong>{engineMode}</strong> tool.
            </p>
          </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          
          <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Format:</label>
          <select value={adFormat} onChange={(e) => setAdFormat(e.target.value)} className="config-dropdown" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', padding: '6px', borderRadius: '6px', fontSize: '13px' }}>
            <option value="Video" style={{ color: '#000' }}>Video</option>
            <option value="Image" style={{ color: '#000' }}>Static Image</option>
          </select>
          
          <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Ratio:</label>
          <select value={adRatio} onChange={(e) => setAdRatio(e.target.value)} className="config-dropdown" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', padding: '6px', borderRadius: '6px', fontSize: '13px' }}>
            <option value="9:16" style={{ color: '#000' }}>9:16 (TikTok/Reels)</option>
            <option value="1:1" style={{ color: '#000' }}>1:1 (Square)</option>
            <option value="16:9" style={{ color: '#000' }}>16:9 (Landscape)</option>
          </select>
          
          <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Length:</label>
          <select value={adLength} onChange={(e) => setAdLength(e.target.value)} className="config-dropdown" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', padding: '6px', borderRadius: '6px', fontSize: '13px' }}>
            <option value="15s" style={{ color: '#000' }}>15s</option>
            <option value="30s" style={{ color: '#000' }}>30s</option>
            <option value="60s" style={{ color: '#000' }}>60s</option>
          </select>

          <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>AI Model:</label>
          <select 
            value={selectedModel} 
            onChange={(e) => setSelectedModel(e.target.value)}
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              color: 'var(--text-primary)', 
              padding: '6px 12px', 
              borderRadius: '6px',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="gemini-1.5-flash" style={{ color: '#000' }}>Gemini 1.5 Flash (Default)</option>
            <option value="gemini-1.5-pro" style={{ color: '#000' }}>Gemini 1.5 Pro</option>
            <option value="gpt-4o" style={{ color: '#000' }}>GPT-4o</option>
            <option value="seedance-v1" style={{ color: '#000' }}>Seedance Video Model</option>
            <option value="nano-banana-chat" style={{ color: '#000' }}>Nano Banana Engine</option>
            <option value="meta-llama/llama-3.2-3b-instruct:free" style={{ color: '#000' }}>LLaMA 3.2 (OpenRouter)</option>
          </select>
        </div>
      </div>

      <div className="workspace-grid-split" style={{ height: 'calc(100vh - 200px)' }}>
        
        {/* Left pane: Conversational Interface */}
        <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
          
          {/* Chat History Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {chatHistory.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>
                <Sparkles size={32} style={{ color: 'var(--accent)', opacity: 0.5, margin: '0 auto 16px auto' }} />
                <h3>Welcome to the Creative Studio Engine</h3>
                <p>Type a request below to generate a new ad. For example: <br/>"Create a video ad for my summer collection"</p>
              </div>
            )}
            
            {chatHistory.map((msg) => (
              <div key={msg.id} style={{
                display: 'flex', 
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: msg.role === 'user' ? 'rgba(90, 82, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  border: msg.role === 'user' ? '1px solid rgba(90, 82, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  lineHeight: '1.5'
                }}>
                  {msg.content}
                </div>
                
                {msg.asset && (
                  <div className="asset-review-card" style={{ marginTop: '12px', width: '100%', maxWidth: '85%' }}>
                    <div className="asset-preview-pane">
                      <span className="asset-badge">{msg.asset.type.toUpperCase()}</span>
                      {msg.asset.videoUrl ? (
                        <video src={msg.asset.videoUrl} autoPlay loop muted style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px' }} />
                      ) : (
                        <img src={msg.asset.imageUrl} alt="Ad Preview" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px' }} />
                      )}
                    </div>
                    <div className="asset-details-pane">
                      <h4 style={{ fontSize: '15px', marginBottom: '8px' }}>{msg.asset.headline}</h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>{msg.asset.bodyText}</p>
                      
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button 
                          onClick={() => handleSaveToLibrary(msg.asset!)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(90, 82, 255, 0.2)', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                          <Save size={14} /> Save to Library
                        </button>
                        <button 
                          onClick={() => handleSuggestChanges(msg.asset!)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                          <Edit3 size={14} /> Suggest Changes
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {isGenerating && (
              <div style={{ alignSelf: 'flex-start', padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={14} className="spin-animation" /> Agents are designing your ad...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input Area */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
            {referenceAd && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', marginBottom: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <Edit3 size={14} /> Editing Ad: {referenceAd.headline.substring(0, 30)}...
                <button type="button" onClick={() => setReferenceAd(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>✕</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileUpload} 
                accept="image/*,video/*"
              />
              <button onClick={() => fileInputRef.current?.click()} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload Asset
              </button>
              <button onClick={() => setShowConnectorsModal(true)} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                Ad Connectors (Meta/TikTok)
              </button>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(e as any); }}
                placeholder={`Type instructions for ${engineMode}...`}
                style={{ flex: 1, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none' }}
              />
              <button 
                onClick={(e) => handleSubmit(e as any)}
                disabled={isGenerating || !prompt.trim()}
                style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '0 24px', borderRadius: '8px', cursor: (isGenerating || !prompt.trim()) ? 'not-allowed' : 'pointer', opacity: (isGenerating || !prompt.trim()) ? 0.5 : 1, fontWeight: '500' }}
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Right pane: Ad Library */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '8px' }}>
          <h3 style={{ fontSize: '16px' }}>Ad Library (Saved)</h3>
          
          {savedAssets.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>
              No ads saved to the library yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {savedAssets.map((asset) => (
                <div key={asset.id} className="asset-review-card">
                  <div className="asset-preview-pane">
                    <span className="asset-badge">{asset.type.toUpperCase()}</span>
                    {asset.videoUrl ? (
                      <video src={asset.videoUrl} autoPlay loop muted style={{ width: '100%', height: 'auto', maxHeight: '180px', objectFit: 'cover', borderRadius: '4px' }} />
                    ) : (
                      <img src={asset.imageUrl} alt="Ad Preview" style={{ width: '100%', height: 'auto', maxHeight: '180px', objectFit: 'cover', borderRadius: '4px' }} />
                    )}
                  </div>
                  <div className="asset-details-pane">
                    <h4 style={{ fontSize: '15px', marginBottom: '8px' }}>{asset.headline}</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>{asset.bodyText}</p>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button className="action-button primary" onClick={() => onOpenReview(asset.id)}>
                        <Eye size={14} /> View
                      </button>
                      <button className="action-button danger" onClick={() => handleDeleteLibraryAd(asset.id)}>
                        <Trash size={14} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        </div>
      </div>

      {showConnectorsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: '12px', width: '400px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-heading)' }}>Connect Ad Accounts</h3>
              <button onClick={() => setShowConnectorsModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', background: '#1877F2', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>f</div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>Meta Ads</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Not Connected</div>
                  </div>
                </div>
                <button onClick={() => alert('Redirecting to Meta OAuth...')} style={{ padding: '6px 12px', background: 'var(--primary)', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>Connect</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', background: '#000', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>♪</div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>TikTok Ads</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Not Connected</div>
                  </div>
                </div>
                <button onClick={() => alert('Redirecting to TikTok OAuth...')} style={{ padding: '6px 12px', background: 'var(--primary)', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>Connect</button>
              </div>
            </div>
            
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '20px', textAlign: 'center' }}>
              Connecting your accounts allows the AI Media Buyer to read analytics and Launch Ads directly to your campaigns.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
