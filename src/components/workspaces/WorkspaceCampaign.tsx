import React, { useState, useRef } from 'react';
import { Copy, CheckCircle, Database, UploadCloud, Check, Download, FileUp, Image as ImageIcon, Zap, AlertTriangle, ShieldCheck, RefreshCw, XCircle, DollarSign, BarChart3, Clock } from 'lucide-react';
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
  creativeAssets?: any[];
  onOpenReview: (itemId: string) => void;
  onToggleStatus: (id: string) => void;
}

export const WorkspaceCampaign: React.FC<WorkspaceCampaignProps> = ({
  campaigns,
  creativeAssets = [],
  onOpenReview,
  onToggleStatus,
}) => {
  const [integrations] = useState([
    { platform: 'Meta Ads', connected: true, accountName: 'Meta Sandbox (Act_208392)' },
    { platform: 'Google Ads', connected: true, accountName: 'Google Sandbox (902-8392)' },
    { platform: 'TikTok Ads', connected: false, accountName: 'Disconnected' },
  ]);

  // Left Side State
  const [strategyParams, setStrategyParams] = useState({
    objective: 'Conversions',
    campaignFocus: 'Diwali Festive Sale',
    budget: 500,
    audience: 'Gen-Z Tech Enthusiasts',
    funnel: 'Bottom of Funnel',
    geoTargetingLevel: 'State-Level',
    placement: 'Maharashtra, Delhi, Karnataka',
    schedule: '14 Days',
    tracking: 'utm_source=ai_agent'
  });
  
  const [generatedStrategy, setGeneratedStrategy] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Right Side State
  const [selectedAds, setSelectedAds] = useState<string[]>([]);
  const [uploadedCreatives, setUploadedCreatives] = useState<{ id: string; name: string; type: string }[]>([]);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [smartSettings, setSmartSettings] = useState({
    killAds: true,
    autoRotate: true,
    skipRateThreshold: 70,
    frequencyCap: 3.5,
    cpaThreshold: 45,
    refreshIntervalDays: 4,
  });

  // Import campaign ref
  const importFileRef = useRef<HTMLInputElement>(null);
  // Upload creative ref
  const creativeFileRef = useRef<HTMLInputElement>(null);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setGeneratedStrategy(`### AI Campaign Strategy Generated\n\n**Campaign Focus**: ${strategyParams.campaignFocus}\n**Objective**: ${strategyParams.objective}\n**Total Budget**: $${strategyParams.budget}\n**Target CPA**: $14.50\n\n**Audience Blueprint**:\n${strategyParams.audience} targeting high intent markers across ${strategyParams.placement} (Granularity: ${strategyParams.geoTargetingLevel}) at the ${strategyParams.funnel}.\n\n**Creative Rotation Logic**:\n- 3x Video Assets (15s Hooks)\n- 2x Static Retargeting Banners\n- **Suggestion**: Rotate creatives every ${smartSettings.refreshIntervalDays} days based on ${strategyParams.campaignFocus} momentum to combat ad blindness.\n- **Auto-Kill**: Ads exceeding CPA of $${smartSettings.cpaThreshold} or frequency > ${smartSettings.frequencyCap}\n- **Skip Rate Threshold**: ${smartSettings.skipRateThreshold}%\n\n**Tracking Confirmed**:\n${strategyParams.tracking}`);
      setIsGenerating(false);
    }, 1500);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedStrategy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handlePublish = () => {
    alert("Campaign JSON Payload generated and sent to simulated multi-platform webhook!");
  };

  // ─── Export Campaign as JSON ───
  const handleExportCampaign = () => {
    const campaignData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      strategyParams,
      generatedStrategy,
      smartSettings,
      selectedAds,
      uploadedCreatives,
    };
    const blob = new Blob([JSON.stringify(campaignData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign-${strategyParams.campaignFocus.replace(/\s+/g, '_').toLowerCase()}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Import Campaign from JSON ───
  const handleImportCampaign = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.strategyParams) setStrategyParams(data.strategyParams);
        if (data.generatedStrategy) setGeneratedStrategy(data.generatedStrategy);
        if (data.smartSettings) setSmartSettings(prev => ({ ...prev, ...data.smartSettings }));
        if (data.selectedAds) setSelectedAds(data.selectedAds);
        if (data.uploadedCreatives) setUploadedCreatives(data.uploadedCreatives);
      } catch {
        alert('Invalid campaign JSON file. Please upload a valid exported campaign.');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  // ─── Upload Creative from Device ───
  const handleCreativeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const id = `upload-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let type = 'image';
      if (['mp4', 'mov', 'webm', 'avi'].includes(ext)) type = 'video';
      else if (['gif'].includes(ext)) type = 'gif';
      setUploadedCreatives(prev => [...prev, { id, name: file.name, type }]);
      setSelectedAds(prev => [...prev, id]);
    });
    e.target.value = '';
  };

  // Shared input style
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      {/* Header with Import / Export actions */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px', color: '#fff' }}>Campaign Manager</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Ideate seasonal campaigns with AI, configure geo-targets, and deploy with auto-fatigue tracking.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          {/* Hidden file inputs */}
          <input type="file" ref={importFileRef} accept=".json" style={{ display: 'none' }} onChange={handleImportCampaign} />
          
          <button
            onClick={() => importFileRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s ease' }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(90,82,255,0.2)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <FileUp size={15} /> Import Campaign
          </button>
          <button
            onClick={handleExportCampaign}
            disabled={!generatedStrategy && !strategyParams.campaignFocus}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: generatedStrategy ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${generatedStrategy ? 'rgba(0,230,118,0.4)' : 'var(--border)'}`, borderRadius: '8px', color: generatedStrategy ? '#00e676' : 'var(--text-muted)', fontSize: '13px', cursor: generatedStrategy ? 'pointer' : 'not-allowed', transition: 'all 0.2s ease' }}
          >
            <Download size={15} /> Export Campaign
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT PANE: Campaign Strategist */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflowY: 'auto' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'rgba(90, 82, 255, 0.03)' }}>
            <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
              <Zap size={18} color="var(--primary)" /> AI Ideation & Strategist
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Describe your campaign brief — the AI will generate a full strategy, audience blueprint, and creative rotation plan.</p>
          </div>
          
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div className="form-group">
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Campaign Idea / Theme (Season or Product)</label>
              <input 
                type="text" 
                value={strategyParams.campaignFocus} 
                onChange={(e) => setStrategyParams(p => ({ ...p, campaignFocus: e.target.value }))} 
                placeholder="e.g. Summer Collection, Black Friday"
                style={inputStyle} 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Objective</label>
                <select 
                  value={strategyParams.objective} 
                  onChange={(e) => setStrategyParams(p => ({ ...p, objective: e.target.value }))} 
                  style={inputStyle}
                >
                  <option value="Conversions" style={{ color: '#000' }}>Conversions</option>
                  <option value="Lead Generation" style={{ color: '#000' }}>Lead Generation</option>
                  <option value="Brand Awareness" style={{ color: '#000' }}>Brand Awareness</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Budget ($)</label>
                <input 
                  type="number" 
                  value={strategyParams.budget} 
                  onChange={(e) => setStrategyParams(p => ({ ...p, budget: Number(e.target.value) }))} 
                  style={inputStyle} 
                />
              </div>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Audience Targeting Base</label>
              <textarea 
                value={strategyParams.audience} 
                onChange={(e) => setStrategyParams(p => ({ ...p, audience: e.target.value }))} 
                rows={2} 
                style={{ ...inputStyle, resize: 'vertical' }} 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
              <div className="form-group">
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Geo Granularity</label>
                <select 
                  value={strategyParams.geoTargetingLevel} 
                  onChange={(e) => setStrategyParams(p => ({ ...p, geoTargetingLevel: e.target.value }))} 
                  style={inputStyle}
                >
                  <option value="Pincode-Level" style={{ color: '#000' }}>Pincode-Level</option>
                  <option value="City-Level" style={{ color: '#000' }}>City-Level</option>
                  <option value="State-Level" style={{ color: '#000' }}>State-Level</option>
                  <option value="Country-Level" style={{ color: '#000' }}>Country-Level</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Placements / Geo Focus</label>
                <input 
                  type="text" 
                  value={strategyParams.placement} 
                  onChange={(e) => setStrategyParams(p => ({ ...p, placement: e.target.value }))} 
                  style={inputStyle} 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Funnel Stage</label>
                <select 
                  value={strategyParams.funnel} 
                  onChange={(e) => setStrategyParams(p => ({ ...p, funnel: e.target.value }))} 
                  style={inputStyle}
                >
                  <option value="Top of Funnel" style={{ color: '#000' }}>TOF</option>
                  <option value="Middle of Funnel" style={{ color: '#000' }}>MOF</option>
                  <option value="Bottom of Funnel" style={{ color: '#000' }}>BOF</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Schedule</label>
                <input 
                  type="text" 
                  value={strategyParams.schedule} 
                  onChange={(e) => setStrategyParams(p => ({ ...p, schedule: e.target.value }))} 
                  style={inputStyle} 
                />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Tracking (UTM)</label>
                <input 
                  type="text" 
                  value={strategyParams.tracking} 
                  onChange={(e) => setStrategyParams(p => ({ ...p, tracking: e.target.value }))} 
                  style={inputStyle} 
                />
              </div>
            </div>

            <GlowButton 
              variant="glow" 
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{ marginTop: '8px', padding: '12px', width: '100%', fontWeight: 'bold' }}
            >
              {isGenerating ? 'Generating Strategy...' : 'Generate Campaign Strategy'}
            </GlowButton>

            {generatedStrategy && (
              <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px' }}>
                  <button 
                    onClick={handleCopy}
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                  >
                    {isCopied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />} 
                    {isCopied ? 'Copied!' : 'Copy'}
                  </button>
                  <button 
                    onClick={handleExportCampaign}
                    style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)', color: '#00e676', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                  >
                    <Download size={14} /> Export
                  </button>
                </div>
                <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', fontFamily: 'var(--font-mono)' }}>OUTPUT STRATEGY</h4>
                <div style={{ fontSize: '13px', color: '#fff', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                  {generatedStrategy}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: Publisher Gateway */}
        <div style={{ flex: 1, background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'rgba(0, 230, 118, 0.03)' }}>
            <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
              <ShieldCheck size={18} color="var(--success)" /> Publisher Gateway
            </h3>
          </div>
          
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* OAuth Statuses */}
            <div>
              <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', fontFamily: 'var(--font-mono)' }}>OAUTH CONNECTED PLATFORMS</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {integrations.map((integration, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className={integration.connected ? "badge-pulse success" : ""} style={{ width: '8px', height: '8px', backgroundColor: integration.connected ? 'var(--success)' : 'var(--text-muted)' }} />
                      <span style={{ fontSize: '14px', fontWeight: 500, color: '#fff' }}>{integration.platform}</span>
                    </div>
                    <span style={{ fontSize: '12px', color: integration.connected ? 'var(--text-secondary)' : 'var(--warning)' }}>
                      {integration.accountName}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Creative Publisher Section */}
            <div>
              <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', fontFamily: 'var(--font-mono)' }}>CREATIVE ASSETS</h4>
              <div style={{ padding: '16px', background: 'rgba(90,82,255,0.05)', border: '1px dashed var(--primary)', borderRadius: '8px' }}>
                {/* Hidden file input for creative uploads */}
                <input 
                  type="file" 
                  ref={creativeFileRef} 
                  accept="image/*,video/*,.gif" 
                  multiple 
                  style={{ display: 'none' }} 
                  onChange={handleCreativeUpload} 
                />
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <button onClick={() => setIsLibraryOpen(true)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', background: 'rgba(90,82,255,0.2)', border: '1px solid var(--primary)', color: '#fff', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>
                    <Database size={16} /> Ad Library
                  </button>
                  <button onClick={() => creativeFileRef.current?.click()} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border)', color: '#fff', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>
                    <UploadCloud size={16} /> Upload Creative
                  </button>
                </div>
                
                {selectedAds.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', padding: '10px 0' }}>
                    <ImageIcon size={24} style={{ opacity: 0.2, margin: '0 auto 8px' }} />
                    No creatives attached for publishing.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedAds.map((ad, i) => {
                      const uploaded = uploadedCreatives.find(c => c.id === ad);
                      return (
                        <div key={i} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                          {uploaded ? (
                            <><span style={{ fontSize: '14px' }}>{uploaded.type === 'video' ? '🎬' : '📸'}</span> {uploaded.name}</>
                          ) : (
                            <>📸 Asset #{ad}</>
                          )}
                          <span onClick={() => { setSelectedAds(prev => prev.filter(x => x !== ad)); setUploadedCreatives(prev => prev.filter(c => c.id !== ad)); }} style={{ cursor: 'pointer', color: 'var(--warning)' }}>✕</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Human Review Gate */}
            <div>
              <div style={{ padding: '20px', background: 'rgba(255, 174, 0, 0.05)', border: '1px solid rgba(255, 174, 0, 0.2)', borderRadius: '8px', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                  <AlertTriangle size={16} color="var(--warning)" /> Human Review Required
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Please confirm the objective ({strategyParams.objective}), total budget (${strategyParams.budget}), and attached creatives before executing the deployment.
                </p>
                <button 
                  onClick={handlePublish} 
                  disabled={selectedAds.length === 0}
                  style={{ 
                    background: selectedAds.length > 0 ? 'var(--success)' : 'rgba(255,255,255,0.1)', 
                    color: selectedAds.length > 0 ? '#fff' : 'var(--text-muted)', 
                    border: 'none', 
                    padding: '14px', 
                    borderRadius: '8px', 
                    fontSize: '15px', 
                    fontWeight: 'bold', 
                    cursor: selectedAds.length > 0 ? 'pointer' : 'not-allowed', 
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <CheckCircle size={18} /> One-Click Publish 
                </button>
              </div>
            </div>

            {/* Smart Ad Management Logic — Enhanced */}
            <div>
              <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', fontFamily: 'var(--font-mono)' }}>SMART AUTO-ROTATION & AD MANAGEMENT</h4>
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Toggle: Auto-Kill Bad Ads */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <XCircle size={16} color="var(--warning)" />
                    <span style={{ fontSize: '13px', color: '#fff' }}>Auto-Kill Bad Ads</span>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={smartSettings.killAds} onChange={(e) => setSmartSettings(s => ({...s, killAds: e.target.checked}))} />
                    <span className="slider"></span>
                  </label>
                </div>

                {/* Kill Ads Params - shown when killAds is ON */}
                {smartSettings.killAds && (
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', padding: '12px', background: 'rgba(255,174,0,0.05)', borderRadius: '6px', border: '1px solid rgba(255,174,0,0.15)' }}>
                    {/* CPA Threshold */}
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <DollarSign size={13} color="var(--warning)" />
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Kill if CPA exceeds</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                        <span style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.1)', fontSize: '12px', color: 'var(--text-secondary)' }}>$</span>
                        <input 
                          type="number" 
                          value={smartSettings.cpaThreshold} 
                          onChange={(e) => setSmartSettings(s => ({...s, cpaThreshold: Number(e.target.value)}))}
                          style={{ width: '60px', padding: '4px 8px', background: 'transparent', border: 'none', color: '#fff', outline: 'none', textAlign: 'center' }} 
                        />
                      </div>
                    </div>
                    {/* Frequency Cap */}
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <BarChart3 size={13} color="var(--warning)" />
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Kill if Frequency exceeds</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                        <input 
                          type="number" 
                          step="0.1"
                          value={smartSettings.frequencyCap} 
                          onChange={(e) => setSmartSettings(s => ({...s, frequencyCap: Number(e.target.value)}))}
                          style={{ width: '60px', padding: '4px 8px', background: 'transparent', border: 'none', color: '#fff', outline: 'none', textAlign: 'center' }} 
                        />
                        <span style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.1)', fontSize: '12px', color: 'var(--text-secondary)' }}>×</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Toggle: Smart Rotate */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={16} color="var(--primary)" />
                    <span style={{ fontSize: '13px', color: '#fff' }}>Smart Auto-Rotate Creatives</span>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={smartSettings.autoRotate} onChange={(e) => setSmartSettings(s => ({...s, autoRotate: e.target.checked}))} />
                    <span className="slider"></span>
                  </label>
                </div>

                {/* Rotate Params - shown when autoRotate is ON */}
                {smartSettings.autoRotate && (
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', padding: '12px', background: 'rgba(90,82,255,0.05)', borderRadius: '6px', border: '1px solid rgba(90,82,255,0.15)' }}>
                    {/* Skip Rate */}
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <BarChart3 size={13} color="var(--primary)" />
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Rotate if Skip Rate over</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                        <input 
                          type="number" 
                          value={smartSettings.skipRateThreshold} 
                          onChange={(e) => setSmartSettings(s => ({...s, skipRateThreshold: Number(e.target.value)}))}
                          style={{ width: '50px', padding: '4px 8px', background: 'transparent', border: 'none', color: '#fff', outline: 'none', textAlign: 'center' }} 
                        />
                        <span style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.1)', fontSize: '12px', color: 'var(--text-secondary)' }}>%</span>
                      </div>
                    </div>
                    {/* Refresh Interval */}
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <Clock size={13} color="var(--primary)" />
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Refresh every</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                        <input 
                          type="number" 
                          value={smartSettings.refreshIntervalDays} 
                          onChange={(e) => setSmartSettings(s => ({...s, refreshIntervalDays: Number(e.target.value)}))}
                          style={{ width: '50px', padding: '4px 8px', background: 'transparent', border: 'none', color: '#fff', outline: 'none', textAlign: 'center' }} 
                        />
                        <span style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.1)', fontSize: '12px', color: 'var(--text-secondary)' }}>days</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Ad Library Modal */}
      {isLibraryOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: '12px', width: '500px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', color: '#fff' }}>
              Select Ad from Library
              <button onClick={() => setIsLibraryOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
              {creativeAssets.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', gridColumn: '1 / -1', textAlign: 'center', padding: '20px' }}>No ads found in your library. Save some from the Creative Studio first!</div>
              ) : (
                creativeAssets.map(asset => (
                  <div key={asset.id} onClick={() => { setSelectedAds(prev => [...new Set([...prev, String(asset.id)])]); setIsLibraryOpen(false); }} style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border)', textAlign: 'center', transition: 'all 0.2s ease' }} onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'} onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🖼️</div>
                    <div style={{ fontSize: '13px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset.headline || `Ad #${asset.id}`}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{asset.type}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toggle CSS injected directly for simplicity */}
      <style dangerouslySetInnerHTML={{__html: `
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 36px;
          height: 20px;
        }
        .toggle-switch input { 
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--border);
          transition: .2s;
          border-radius: 34px;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .2s;
          border-radius: 50%;
        }
        input:checked + .slider {
          background-color: var(--primary);
        }
        input:checked + .slider:before {
          transform: translateX(16px);
        }
      `}} />
    </div>
  );
};
