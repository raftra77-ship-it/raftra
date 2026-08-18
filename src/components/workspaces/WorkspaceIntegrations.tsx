import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Search,
  Sparkles,
  Zap,
  Check,
  X,
  Layers,
  BarChart3,
  MessageSquare,
  HardDrive,
  Users2,
  ShieldCheck,
  Sliders,
  Share2
} from 'lucide-react';
import { GlowButton } from '../GlowButton';

interface IntegrationItem {
  id: string;
  name: string;
  category: 'ad_accounts' | 'analytics' | 'productivity_crm';
  description: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  isComingSoon?: boolean;
  isLocked?: boolean;
  status: 'connected' | 'disconnected' | 'coming_soon';
  accountName?: string;
  lastSynced?: string;
}

export const WorkspaceIntegrations: React.FC = () => {
  const [filterCategory, setFilterCategory] = useState<'all' | 'ad_accounts' | 'analytics' | 'productivity_crm'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModalItem, setActiveModalItem] = useState<IntegrationItem | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Integrations state
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([
    // Ad Accounts
    {
      id: 'meta_ads',
      name: 'Meta Ads',
      category: 'ad_accounts',
      description: 'Run and optimize ads across Facebook, Instagram, Threads, and more.',
      iconBg: 'rgba(24, 119, 242, 0.15)',
      iconColor: '#1877F2',
      icon: <span style={{ fontWeight: 900, fontSize: '18px', color: '#1877F2' }}>∞</span>,
      status: 'disconnected'
    },
    {
      id: 'google_ads',
      name: 'Google Ads',
      category: 'ad_accounts',
      description: 'Run and optimize ads across Search, YouTube, Maps, Gmail, and more.',
      iconBg: 'rgba(66, 133, 244, 0.15)',
      iconColor: '#4285F4',
      icon: <span style={{ fontWeight: 900, fontSize: '16px', color: '#4285F4' }}>G</span>,
      status: 'disconnected'
    },
    {
      id: 'chatgpt_ads',
      name: 'ChatGPT Ads',
      category: 'ad_accounts',
      description: 'Run and optimize ads in ChatGPT conversations.',
      iconBg: 'rgba(16, 163, 127, 0.15)',
      iconColor: '#10A37F',
      icon: <Sparkles size={20} color="#10A37F" />,
      isComingSoon: true,
      isLocked: true,
      status: 'coming_soon'
    },
    {
      id: 'amazon_ads',
      name: 'Amazon Ads',
      category: 'ad_accounts',
      description: 'Run and optimize product ads on Amazon.',
      iconBg: 'rgba(255, 153, 0, 0.15)',
      iconColor: '#FF9900',
      icon: <span style={{ fontWeight: 900, fontSize: '17px', color: '#FF9900' }}>a</span>,
      isComingSoon: true,
      isLocked: true,
      status: 'coming_soon'
    },

    // Analytics
    {
      id: 'ga4',
      name: 'Google Analytics 4',
      category: 'analytics',
      description: 'Pull traffic, event, and conversion data across your site and campaigns.',
      iconBg: 'rgba(249, 171, 0, 0.15)',
      iconColor: '#F9AB00',
      icon: <BarChart3 size={20} color="#F9AB00" />,
      status: 'disconnected'
    },
    {
      id: 'google_search_console',
      name: 'Google Search Console',
      category: 'analytics',
      description: 'Monitor organic search rankings, keyword impressions, CTR, and indexing health directly in Raftra.',
      iconBg: 'rgba(66, 133, 244, 0.15)',
      iconColor: '#4285F4',
      icon: <Search size={20} color="#4285F4" />,
      status: 'disconnected'
    },

    // Productivity, Storage & CRM
    {
      id: 'google_drive',
      name: 'Google Drive',
      category: 'productivity_crm',
      description: 'Sync brand assets, video footage, product catalogs, and creative guidelines directly from Google Drive.',
      iconBg: 'rgba(52, 168, 83, 0.15)',
      iconColor: '#34A853',
      icon: <HardDrive size={20} color="#34A853" />,
      status: 'disconnected'
    },
    {
      id: 'slack',
      name: 'Slack',
      category: 'productivity_crm',
      description: 'Receive real-time campaign alerts, creative approval requests, and performance updates in your Slack channels.',
      iconBg: 'rgba(224, 30, 90, 0.15)',
      iconColor: '#E01E5A',
      icon: <MessageSquare size={20} color="#E01E5A" />,
      status: 'disconnected'
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      category: 'productivity_crm',
      description: 'Sync leads, CRM contacts, deals, and attribution pipelines directly with marketing automations.',
      iconBg: 'rgba(255, 122, 89, 0.15)',
      iconColor: '#FF7A59',
      icon: <Share2 size={20} color="#FF7A59" />,
      status: 'disconnected'
    }
  ]);

  const handleConnectToggle = (item: IntegrationItem) => {
    if (item.isComingSoon || item.isLocked) return;

    if (item.status === 'connected') {
      // Disconnect
      setIntegrations(prev => prev.map(i => i.id === item.id ? { ...i, status: 'disconnected', accountName: undefined, lastSynced: undefined } : i));
      setActiveModalItem(null);
    } else {
      // Open connect modal
      setActiveModalItem(item);
    }
  };

  const handleExecuteConnect = () => {
    if (!activeModalItem) return;
    setIsConnecting(true);
    setTimeout(() => {
      setIntegrations(prev => prev.map(i => i.id === activeModalItem.id ? {
        ...i,
        status: 'connected',
        accountName: `${activeModalItem.name} Official (${activeModalItem.name.toLowerCase().replace(/\s+/g, '_')}_prod)`,
        lastSynced: 'Just now'
      } : i));
      setIsConnecting(false);
      setActiveModalItem(null);
    }, 800);
  };

  const filteredIntegrations = integrations.filter(item => {
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = [
    { id: 'all', label: 'All Integrations' },
    { id: 'ad_accounts', label: 'Ad Accounts' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'productivity_crm', label: 'Productivity & CRM' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(124, 117, 255, 0.12)', borderRadius: '100px', border: '1px solid rgba(124, 117, 255, 0.3)', marginBottom: '10px' }}>
            <Zap size={14} color="#7C75FF" />
            <span style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              INTEGRATION HUB
            </span>
          </div>
          <h2 style={{ fontSize: '28px', color: '#fff', margin: '0 0 6px 0', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
            Connect your accounts
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0, maxWidth: '750px', lineHeight: 1.5 }}>
            Connect your accounts so the agent has what it needs to work.
          </p>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '260px' }}>
          <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '100px',
              color: '#fff',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* ── CATEGORY FILTER TABS ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilterCategory(cat.id as any)}
            style={{
              background: filterCategory === cat.id ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              border: '1px solid',
              borderColor: filterCategory === cat.id ? '#00E676' : 'rgba(255, 255, 255, 0.1)',
              color: filterCategory === cat.id ? '#00E676' : 'var(--text-secondary)',
              padding: '8px 18px',
              borderRadius: '100px',
              fontSize: '13px',
              fontWeight: filterCategory === cat.id ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── INTEGRATIONS GRID SECTION ──────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>

        {/* 1. Ad Accounts */}
        {(filterCategory === 'all' || filterCategory === 'ad_accounts') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} color="#7C75FF" />
              <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                Ad Accounts
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
              {filteredIntegrations.filter(i => i.category === 'ad_accounts').map(item => renderIntegrationCard(item))}
            </div>
          </div>
        )}

        {/* 2. Analytics */}
        {(filterCategory === 'all' || filterCategory === 'analytics') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={16} color="#F9AB00" />
              <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                Analytics
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
              {filteredIntegrations.filter(i => i.category === 'analytics').map(item => renderIntegrationCard(item))}
            </div>
          </div>
        )}

        {/* 3. Productivity & CRM */}
        {(filterCategory === 'all' || filterCategory === 'productivity_crm') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Share2 size={16} color="#00D2FF" />
              <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                Productivity, Storage & CRM
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
              {filteredIntegrations.filter(i => i.category === 'productivity_crm').map(item => renderIntegrationCard(item))}
            </div>
          </div>
        )}

      </div>

      {/* ── CONNECT / PERMISSIONS MODAL ────────────────────────────── */}
      <AnimatePresence>
        {activeModalItem && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.85)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '520px',
                background: '#0a0a12',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '24px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: activeModalItem.iconBg, border: `1px solid ${activeModalItem.iconColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {activeModalItem.icon}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '19px', color: '#fff', margin: '0 0 2px 0', fontWeight: 800 }}>
                      Connect {activeModalItem.name}
                    </h3>
                    <span style={{ fontSize: '11.5px', color: '#00E676', fontWeight: 600 }}>OAuth 2.0 Secure Sync</span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModalItem(null)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                {activeModalItem.description}
              </p>

              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Permissions Granted:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#fff' }}>
                  <Check size={14} color="#00E676" /> Read campaign & ad set telemetry
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#fff' }}>
                  <Check size={14} color="#00E676" /> Push AI-generated creatives & copy variants
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#fff' }}>
                  <Check size={14} color="#00E676" /> Real-time bid & ROAS telemetry sync
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                <button
                  onClick={() => setActiveModalItem(null)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteConnect}
                  disabled={isConnecting}
                  style={{
                    background: 'linear-gradient(135deg, #00E676 0%, #00C853 100%)',
                    color: '#000000',
                    border: 'none',
                    borderRadius: '100px',
                    padding: '9px 24px',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,230,118,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isConnecting ? 'Authenticating...' : `Authorize & Connect ${activeModalItem.name}`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );

  function renderIntegrationCard(item: IntegrationItem) {
    const isLocked = Boolean(item.isLocked || item.isComingSoon);
    const isConnected = item.status === 'connected';

    return (
      <div
        key={item.id}
        className="glow-card"
        style={{
          background: isLocked
            ? 'linear-gradient(180deg, rgba(16, 16, 24, 0.4) 0%, rgba(8, 8, 12, 0.6) 100%)'
            : 'linear-gradient(180deg, rgba(20, 20, 32, 0.75) 0%, rgba(10, 10, 16, 0.95) 100%)',
          border: isConnected
            ? '1.5px solid rgba(0, 230, 118, 0.4)'
            : isLocked
              ? '1px dashed rgba(255, 255, 255, 0.12)'
              : '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '18px',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          opacity: isLocked ? 0.78 : 1,
          boxShadow: isConnected ? '0 4px 20px rgba(0, 230, 118, 0.12)' : 'none',
          transition: 'all 0.2s ease'
        }}
      >
        {/* Top details */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: item.iconBg, border: `1px solid ${item.iconColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {item.icon}
            </div>

            {/* Lock / Coming Soon badge vs Connect / Connected button */}
            {isLocked ? (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: 'rgba(255, 179, 0, 0.12)',
                  border: '1px solid rgba(255, 179, 0, 0.3)',
                  color: '#FFB300',
                  padding: '4px 10px',
                  borderRadius: '100px',
                  fontSize: '11.5px',
                  fontWeight: 700
                }}
              >
                <Lock size={12} color="#FFB300" />
                <span>Coming Soon</span>
              </div>
            ) : (
              <button
                onClick={() => handleConnectToggle(item)}
                style={{
                  background: isConnected
                    ? 'rgba(0, 230, 118, 0.15)'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)',
                  border: isConnected
                    ? '1px solid rgba(0, 230, 118, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.15)',
                  color: isConnected ? '#00E676' : '#ffffff',
                  padding: '6px 16px',
                  borderRadius: '100px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                {isConnected ? (
                  <>
                    <CheckCircle2 size={13} color="#00E676" />
                    <span>Connected</span>
                  </>
                ) : (
                  <span>Connect</span>
                )}
              </button>
            )}
          </div>

          <h4 style={{ fontSize: '17px', color: '#fff', margin: '0 0 6px 0', fontWeight: 800 }}>
            {item.name}
          </h4>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px 0', lineHeight: 1.45 }}>
            {item.description}
          </p>
        </div>

        {/* Footer info (connected account details or coming soon note) */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
          {isLocked ? (
            <span style={{ color: '#FFB300', display: 'flex', alignItems: 'center', gap: '4px' }}>
              🔒 Under Development • Q3 Release
            </span>
          ) : isConnected ? (
            <>
              <span style={{ color: '#00E676' }}>● Active Synced</span>
              <span>{item.lastSynced}</span>
            </>
          ) : (
            <>
              <span>Status: Disconnected</span>
              <span style={{ color: '#7C75FF', cursor: 'pointer' }} onClick={() => handleConnectToggle(item)}>Setup ↗</span>
            </>
          )}
        </div>
      </div>
    );
  }
};
