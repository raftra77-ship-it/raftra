import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Zap,
  HelpCircle,
  ExternalLink,
  ArrowUpRight,
  Sliders,
  DollarSign,
  Users,
  Target,
  Layers,
  BarChart3,
  PieChart as PieIcon,
  Activity,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  ShoppingBag,
  Globe,
  Radio,
  X,
  Plus
} from 'lucide-react';
import { GlowButton } from '../GlowButton';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid
} from 'recharts';

export interface GrowthAnalysisSectionProps {
  onNavigateTab?: (tab: string) => void;
  onSendMessage?: (msg: string) => void;
  connectedSources?: {
    meta?: boolean;
    google?: boolean;
    ga4?: boolean;
    gsc?: boolean;
    shopify?: boolean;
  };
  /** When set, the section reads this workspace's real Meta/Google numbers from
   *  /analytics/growth instead of rendering its built-in sample series. */
  workspaceId?: number | null;
}

/** One row of the growth chart, as returned by the backend. */
interface GrowthPoint {
  date: string;
  Revenue: number;
  Spend: number;
  ROAS: number;
  Orders: number;
  CAC: number;
}

interface GrowthPayload {
  series: GrowthPoint[];
  kpis: { key: string; label: string; value: number; format: string }[];
  channels: { name: string; connected: boolean; spend: number; revenue: number; roas: number }[];
  sources: Record<string, { connected: boolean; has_data: boolean }>;
  note?: string;
}

// ── Timeframe & Metric Types ──
type Timeframe = '7D' | '30D' | '90D';
type MetricView = 'rev_spend' | 'revenue' | 'spend' | 'roas' | 'orders' | 'cac';

// ── Sparkline Mini-SVG Component ──
const MiniSparkline: React.FC<{ data: number[]; color: string; isPositive?: boolean }> = ({ data, color }) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 64;
  const height = 22;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

export const GrowthAnalysisSection: React.FC<GrowthAnalysisSectionProps> = ({
  onNavigateTab,
  onSendMessage,
  connectedSources = { meta: true, google: true, ga4: true, gsc: true, shopify: true },
  workspaceId = null
}) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('30D');
  const [metricView, setMetricView] = useState<MetricView>('rev_spend');
  const [activeKpiTooltip, setActiveKpiTooltip] = useState<string | null>(null);
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [showInsightAnalysisModal, setShowInsightAnalysisModal] = useState(false);

  // Real growth data for this workspace. Null until it loads, and null forever when no
  // workspaceId was passed - in which case the built-in sample series below still renders,
  // which is what keeps this component usable in isolation (storybook, design review).
  const [live, setLive] = useState<GrowthPayload | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    fetch(`/api/workspaces/${workspaceId}/analytics/growth?timeframe=${timeframe}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setLive(d || null))
      .catch(() => setLive(null));
  }, [workspaceId, timeframe]);

  // Demo toggle: let user test all-connected vs disconnected empty states.
  // Defaults OFF for a real workspace. Left ON when there is no workspaceId, so the
  // component still demonstrates itself outside the dashboard. Shipping it ON in the
  // product would paint every connector green regardless of what is actually linked.
  const [isDemoActive, setIsDemoActive] = useState(!workspaceId);

  // Connection state: the API's answer wins whenever we have one, because it reflects what
  // is genuinely linked for this workspace rather than the component's optimistic defaults.
  const src = live?.sources;
  const isMetaConnected = src ? !!src.meta?.connected : (isDemoActive && (connectedSources.meta ?? true));
  const isGoogleConnected = src ? !!src.google?.connected : (isDemoActive && (connectedSources.google ?? true));
  const isGa4Connected = src ? !!src.ga4?.connected : (isDemoActive && (connectedSources.ga4 ?? true));
  const isGscConnected = src ? !!src.gsc?.connected : (isDemoActive && (connectedSources.gsc ?? true));
  const isShopifyConnected = src ? !!src.shopify?.connected : (isDemoActive && (connectedSources.shopify ?? true));

  const hasAnyConnection = isMetaConnected || isGoogleConnected || isGa4Connected || isGscConnected || isShopifyConnected;

  // ── Chart Multi-Timeframe Data ──
  const chartDatasets: Record<Timeframe, Array<{
    date: string;
    Revenue: number;
    Spend: number;
    ROAS: number;
    Orders: number;
    CAC: number;
  }>> = {
    '7D': [
      { date: 'Mon', Revenue: 48000, Spend: 14200, ROAS: 3.38, Orders: 54, CAC: 263 },
      { date: 'Tue', Revenue: 52400, Spend: 15800, ROAS: 3.32, Orders: 61, CAC: 259 },
      { date: 'Wed', Revenue: 61000, Spend: 16400, ROAS: 3.72, Orders: 72, CAC: 228 },
      { date: 'Thu', Revenue: 58900, Spend: 17200, ROAS: 3.42, Orders: 68, CAC: 253 },
      { date: 'Fri', Revenue: 74200, Spend: 19500, ROAS: 3.81, Orders: 89, CAC: 219 },
      { date: 'Sat', Revenue: 89600, Spend: 22100, ROAS: 4.05, Orders: 104, CAC: 212 },
      { date: 'Sun', Revenue: 94500, Spend: 21800, ROAS: 4.33, Orders: 112, CAC: 195 },
    ],
    '30D': [
      { date: 'Week 1', Revenue: 210000, Spend: 62000, ROAS: 3.38, Orders: 245, CAC: 253 },
      { date: 'Week 2', Revenue: 265000, Spend: 71000, ROAS: 3.73, Orders: 312, CAC: 227 },
      { date: 'Week 3', Revenue: 298000, Spend: 76000, ROAS: 3.92, Orders: 358, CAC: 212 },
      { date: 'Week 4', Revenue: 345000, Spend: 84000, ROAS: 4.11, Orders: 416, CAC: 201 },
    ],
    '90D': [
      { date: 'Month 1', Revenue: 780000, Spend: 235000, ROAS: 3.32, Orders: 920, CAC: 255 },
      { date: 'Month 2', Revenue: 960000, Spend: 265000, ROAS: 3.62, Orders: 1140, CAC: 232 },
      { date: 'Month 3', Revenue: 1118000, Spend: 293000, ROAS: 3.82, Orders: 1331, CAC: 220 },
    ]
  };

  // Real numbers win. chartDatasets above is a sample set kept only for the no-workspace
  // case (design review outside the dashboard) - once the API answers for a workspace, the
  // chart shows that workspace's actual Meta/Google delivery, including an empty array when
  // nothing is connected. Rendering the sample curve for a real brand is what made this
  // screen contradict the dashboard's own $0 revenue tiles.
  const currentChartData = live ? live.series : chartDatasets[timeframe];

  // ── Budget Simulator State ──
  const [budgetMeta, setBudgetMeta] = useState(45);
  const [budgetGoogle, setBudgetGoogle] = useState(30);
  const [budgetInfluencer, setBudgetInfluencer] = useState(15);
  const [budgetOther, setBudgetOther] = useState(10);

  const simulatedRoas = useMemo(() => {
    const metaWeight = (budgetMeta / 100) * 3.78;
    const googleWeight = (budgetGoogle / 100) * 5.48;
    const infWeight = (budgetInfluencer / 100) * 4.90;
    const otherWeight = (budgetOther / 100) * 2.80;
    return (metaWeight + googleWeight + infWeight + otherWeight).toFixed(2);
  }, [budgetMeta, budgetGoogle, budgetInfluencer, budgetOther]);

  // ── Top KPI Metrics Data ──
  const kpis = [
    {
      id: 'rev',
      label: 'Revenue',
      connected: isShopifyConnected || isMetaConnected,
      value: timeframe === '7D' ? '₹4.78L' : timeframe === '30D' ? '₹11.18L' : '₹28.58L',
      change: '+18.4%',
      isPositive: true,
      sparkline: [24, 28, 26, 32, 36, 42, 48],
      sparkColor: '#00E676',
      source: isShopifyConnected ? 'Shopify & Stripe' : 'Meta Ad Attribution',
      tooltip: 'Total gross merchandise value from all online sales and campaign attribution pipelines.',
      unconnectedText: 'Connect a revenue source'
    },
    {
      id: 'spend',
      label: 'Marketing Spend',
      connected: isMetaConnected || isGoogleConnected,
      value: timeframe === '7D' ? '₹1.27L' : timeframe === '30D' ? '₹2.93L' : '₹7.93L',
      change: '+8.2%',
      isPositive: true,
      sparkline: [18, 20, 19, 22, 24, 27, 29],
      sparkColor: '#7C75FF',
      source: 'Meta Ads + Google Ads',
      tooltip: 'Blended paid advertising spend across active Meta, Google, and Influencer campaigns.',
      unconnectedText: 'Connect Meta / Google Ads'
    },
    {
      id: 'roas',
      label: 'ROAS',
      connected: (isMetaConnected || isGoogleConnected) && (isShopifyConnected || isGa4Connected),
      value: timeframe === '7D' ? '3.76x' : timeframe === '30D' ? '3.81x' : '3.60x',
      change: '+9.5%',
      isPositive: true,
      sparkline: [3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8],
      sparkColor: '#00D2FF',
      source: 'Blended Multi-Touch Attribution',
      tooltip: 'Return on Ad Spend = Total Attributed Revenue divided by Total Marketing Spend.',
      unconnectedText: 'Connect Meta / Google Ads + revenue source'
    },
    {
      id: 'cac',
      label: 'CAC',
      connected: (isMetaConnected || isGoogleConnected) && (isShopifyConnected || isGa4Connected),
      value: timeframe === '7D' ? '₹226' : timeframe === '30D' ? '₹220' : '₹235',
      change: '-12.1%',
      isPositive: true,
      sparkline: [265, 258, 250, 242, 235, 228, 220],
      sparkColor: '#00E676',
      source: 'Ad Spend / New Customers',
      tooltip: 'Blended Customer Acquisition Cost = Paid Ad Spend divided by verified First-Time Buyers.',
      unconnectedText: 'Connect Ad + Analytics platform'
    },
    {
      id: 'cvr',
      label: 'Conversion Rate',
      connected: isGa4Connected || isShopifyConnected,
      value: '3.42%',
      change: '+0.6%',
      isPositive: true,
      sparkline: [2.8, 2.9, 3.1, 3.0, 3.2, 3.3, 3.4],
      sparkColor: '#FFB300',
      source: 'GA4 Ecommerce Stream',
      tooltip: 'Percentage of total website visitor sessions that completed a checkout transaction.',
      unconnectedText: 'Connect GA4 Analytics'
    },
    {
      id: 'orders',
      label: 'Orders',
      connected: isShopifyConnected || isGa4Connected,
      value: timeframe === '7D' ? '561' : timeframe === '30D' ? '1,331' : '3,391',
      change: '+22.8%',
      isPositive: true,
      sparkline: [120, 140, 160, 190, 220, 280, 330],
      sparkColor: '#FF5296',
      source: 'Store Order Webhooks',
      tooltip: 'Count of completed customer orders processed during the selected timeframe.',
      unconnectedText: 'Connect Shopify or GA4'
    }
  ];

  // ── Channels Performance Matrix ──
  const channels = [
    {
      name: 'Meta Ads',
      connected: isMetaConnected,
      spend: '₹1.32L',
      revenue: '₹4.98L',
      roas: '3.78x',
      trend: 'up',
      trendPct: '+14%',
      badgeColor: '#1877F2',
      connectId: 'meta_ads'
    },
    {
      name: 'Google Ads',
      connected: isGoogleConnected,
      spend: '₹88K',
      revenue: '₹4.82L',
      roas: '5.48x',
      trend: 'up',
      trendPct: '+28%',
      badgeColor: '#4285F4',
      connectId: 'google_ads'
    },
    {
      name: 'Organic Search',
      connected: isGscConnected,
      spend: '₹0 (SEO)',
      revenue: '₹1.12L',
      roas: '∞ Organic',
      trend: 'up',
      trendPct: '+19%',
      badgeColor: '#00E676',
      connectId: 'gsc'
    },
    {
      name: 'Influencer / UGC',
      connected: isDemoActive,
      spend: '₹44K',
      revenue: '₹2.15L',
      roas: '4.90x',
      trend: 'up',
      trendPct: '+21%',
      badgeColor: '#FF5296',
      connectId: 'influencer'
    },
    {
      name: 'Email Marketing',
      connected: isDemoActive,
      spend: '₹12K',
      revenue: '₹86K',
      roas: '7.16x',
      trend: 'up',
      trendPct: '+8%',
      badgeColor: '#FFB300',
      connectId: 'email'
    },
    {
      name: 'Direct / Referral',
      connected: isGa4Connected,
      spend: '₹0 (Direct)',
      revenue: '₹62K',
      roas: 'Direct',
      trend: 'up',
      trendPct: '+5%',
      badgeColor: '#7C75FF',
      connectId: 'ga4'
    }
  ];

  // ── Top Influencers Data ──
  const creators = [
    {
      name: '@techguru_sam',
      handle: 'Samir Verma',
      platform: 'YouTube · Tech',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
      hasData: isDemoActive,
      cost: '₹22,000',
      revenue: '₹1,21,000',
      roas: '5.5x',
      reach: '184K',
      conversions: 78
    },
    {
      name: '@diya_styleguide',
      handle: 'Diya Kapoor',
      platform: 'Instagram · Lifestyle',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80',
      hasData: isDemoActive,
      cost: '₹14,000',
      revenue: '₹68,600',
      roas: '4.9x',
      reach: '96K',
      conversions: 44
    },
    {
      name: '@rohit_gadgetsnaps',
      handle: 'Rohit Shah',
      platform: 'YouTube Shorts · Unbox',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
      hasData: isDemoActive,
      cost: '₹8,000',
      revenue: '₹34,400',
      roas: '4.3x',
      reach: '54K',
      conversions: 26
    }
  ];

  // ── Growth Alerts Data ──
  const growthAlerts = [
    {
      id: 'a1',
      icon: '🟢',
      label: 'ROAS improved +21% across Google High-Intent Search campaigns',
      action: 'View Ad Sets',
      targetTab: 'campaign',
      type: 'success'
    },
    {
      id: 'a2',
      icon: '🟠',
      label: 'Meta Ad Set #4 CPA increased +18% over last 48h (Creative fatigue alert)',
      action: 'Refresh Creative',
      targetTab: 'studio',
      type: 'warning'
    },
    {
      id: 'a3',
      icon: '🔴',
      label: 'Creative fatigue detected on 2 top Reels ads (CTR dropped < 1.8%)',
      action: 'Generate Variants',
      targetTab: 'studio',
      type: 'danger'
    },
    {
      id: 'a4',
      icon: '🟣',
      label: isGscConnected ? 'Answer Engine Citations (GEO) increased +34% on Perplexity & ChatGPT' : 'Organic search sync pending — connect Search Console for GEO telemetry',
      action: isGscConnected ? 'View SEO Report' : 'Connect GSC',
      targetTab: isGscConnected ? 'seo' : 'integrations',
      type: 'info'
    }
  ];

  const handleAskClaudeContext = (customPrompt?: string) => {
    const prompt = customPrompt || `Analyze my ${timeframe} Growth Analysis metrics (Revenue: ${kpis[0].value}, ROAS: ${kpis[2].value}, Spend: ${kpis[1].value}). Recommend specific budget shifts between Meta Ads and Google Ads to maximize profit.`;
    if (onSendMessage) {
      onSendMessage(prompt);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* ── SECTION HEADER ────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(90, 82, 255, 0.15)', border: '1px solid rgba(90, 82, 255, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={18} color="#7C75FF" />
            </div>
            <h2 style={{ fontSize: '22px', fontFamily: 'var(--font-heading)', color: '#ffffff', margin: 0, fontWeight: 800 }}>
              Growth Analysis
            </h2>
            <span style={{ fontSize: '11px', background: 'rgba(0, 230, 118, 0.15)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.3)', padding: '2px 8px', borderRadius: '100px', fontWeight: 700 }}>
              Real-Time Intelligence
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
            Understand where your growth is coming from and where your budget is going.
          </p>
        </div>

        {/* Right Controls: Date Selector + Ask Claude Button + Demo Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Demo / Live State Quick Toggle */}
          <button
            onClick={() => setIsDemoActive(!isDemoActive)}
            title="Toggle between full connected telemetry and disconnected empty state preview"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '11.5px',
              fontWeight: 600,
              background: isDemoActive ? 'rgba(0, 230, 118, 0.08)' : 'rgba(255, 179, 0, 0.08)',
              border: isDemoActive ? '1px solid rgba(0, 230, 118, 0.25)' : '1px solid rgba(255, 179, 0, 0.25)',
              color: isDemoActive ? '#00E676' : '#FFB300',
              borderRadius: '100px',
              cursor: 'pointer'
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isDemoActive ? '#00E676' : '#FFB300' }} />
            {isDemoActive ? 'Data Sync: Connected' : 'Data Sync: Disconnected'}
          </button>

          {/* Timeframe selector: 7D / 30D / 90D */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '100px', padding: '3px' }}>
            {(['7D', '30D', '90D'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                style={{
                  background: timeframe === tf ? 'var(--accent)' : 'transparent',
                  color: timeframe === tf ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '100px',
                  padding: '5px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Ask Claude button */}
          <GlowButton
            variant="glow"
            onClick={() => handleAskClaudeContext()}
            style={{ fontSize: '12.5px', padding: '7px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Zap size={14} color="#fff" /> Ask Claude
          </GlowButton>
        </div>
      </div>

      {/* ── GLOBAL EMPTY STATE BANNER (If nothing connected) ──────── */}
      {!hasAnyConnection && (
        <div
          className="glow-card"
          style={{
            padding: '28px',
            background: 'linear-gradient(135deg, rgba(255, 179, 0, 0.05) 0%, rgba(90, 82, 255, 0.05) 100%)',
            border: '1px dashed rgba(255, 179, 0, 0.3)',
            borderRadius: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255, 179, 0, 0.12)', border: '1px solid rgba(255, 179, 0, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertCircle size={24} color="#FFB300" />
            </div>
            <div>
              <h3 style={{ fontSize: '17px', color: '#fff', margin: '0 0 4px 0', fontWeight: 700 }}>
                Connect your marketing data
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0, maxWidth: '520px' }}>
                Connect your advertising and analytics platforms to unlock real-time growth analysis, verified ROAS tracking, and Claude AI insights.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => onNavigateTab?.('integrations')}
              style={{ background: '#1877F2', color: '#fff', border: 'none', borderRadius: '100px', padding: '8px 18px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >
              Connect Meta
            </button>
            <button
              onClick={() => onNavigateTab?.('integrations')}
              style={{ background: '#4285F4', color: '#fff', border: 'none', borderRadius: '100px', padding: '8px 18px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >
              Connect Google Ads
            </button>
            <button
              onClick={() => onNavigateTab?.('integrations')}
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '100px', padding: '8px 18px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >
              Connect GA4
            </button>
          </div>
        </div>
      )}

      {/* ── 1. TOP KPI ROW (6 COMPACT METRICS) ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px' }}>
        {kpis.map((kpi) => (
          <div
            key={kpi.id}
            className="glow-card"
            style={{
              padding: '16px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.025)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              minHeight: '124px',
              transition: 'all 0.2s ease'
            }}
          >
            {/* Header: Metric label + Tooltip Trigger */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {kpi.label}
              </span>
              
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setActiveKpiTooltip(activeKpiTooltip === kpi.id ? null : kpi.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}
                  title="Click for metric formula & source details"
                >
                  <HelpCircle size={12} />
                </button>

                {/* KPI Tooltip Popover */}
                {activeKpiTooltip === kpi.id && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '18px',
                      width: '210px',
                      background: '#12121a',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      zIndex: 30,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{kpi.label} Telemetry</div>
                    <p style={{ margin: '0 0 6px 0' }}>{kpi.tooltip}</p>
                    <div style={{ fontSize: '10px', color: '#00E676', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '4px' }}>
                      Source: {kpi.source}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Value & Trend or Disconnected State */}
            {kpi.connected ? (
              <div style={{ margin: '8px 0 4px 0' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)', lineHeight: 1.2 }}>
                  {kpi.value}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', color: kpi.isPositive ? '#00E676' : '#FF5296', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    {kpi.isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {kpi.change} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>vs prev {timeframe}</span>
                  </span>
                  <MiniSparkline data={kpi.sparkline} color={kpi.sparkColor} isPositive={kpi.isPositive} />
                </div>
              </div>
            ) : (
              /* Disconnected Empty Metric (Never display fake zeros) */
              <div style={{ margin: '6px 0 2px 0' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  —
                </div>
                <span style={{ fontSize: '10.5px', color: '#FFB300', lineHeight: 1.3, display: 'block', marginTop: '4px' }}>
                  {kpi.unconnectedText}
                </span>
              </div>
            )}

            {/* Data Source Indicator Tag */}
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: kpi.connected ? '#00E676' : '#FFB300' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {kpi.connected ? kpi.source : 'Integration required'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── 2. MAIN GROWTH CHART ──────────────────────────────────── */}
      <div
        className="glow-card"
        style={{
          padding: '24px',
          borderRadius: '20px',
          background: 'linear-gradient(180deg, rgba(20, 20, 32, 0.8) 0%, rgba(10, 10, 16, 0.95) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}
      >
        {/* Chart Header & Metric Switcher Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h3 style={{ fontSize: '16px', color: '#fff', margin: '0 0 2px 0', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
              {metricView === 'rev_spend' && 'Revenue vs Marketing Spend Trajectory'}
              {metricView === 'revenue' && 'Attributed Revenue Growth'}
              {metricView === 'spend' && 'Total Paid Ad Spend Allocation'}
              {metricView === 'roas' && 'Blended ROAS Efficiency Curve'}
              {metricView === 'orders' && 'Daily Conversion & Order Volume'}
              {metricView === 'cac' && 'Blended CAC (Customer Acquisition Cost)'}
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Real-time multi-channel aggregation across {timeframe} window.
            </span>
          </div>

          {/* Metric View Tabs */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '100px', padding: '2px', overflowX: 'auto' }}>
            {[
              { id: 'rev_spend', label: 'Rev vs Spend' },
              { id: 'revenue', label: 'Revenue' },
              { id: 'spend', label: 'Spend' },
              { id: 'roas', label: 'ROAS' },
              { id: 'orders', label: 'Orders' },
              { id: 'cac', label: 'CAC' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMetricView(tab.id as MetricView)}
                style={{
                  background: metricView === tab.id ? 'rgba(90, 82, 255, 0.25)' : 'transparent',
                  color: metricView === tab.id ? '#00E676' : 'var(--text-secondary)',
                  border: metricView === tab.id ? '1px solid rgba(90, 82, 255, 0.4)' : '1px solid transparent',
                  borderRadius: '100px',
                  padding: '4px 12px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* The Recharts Container */}
        <div style={{ width: '100%', height: '240px' }}>
          <ResponsiveContainer width="100%" height="100%">
            {metricView === 'rev_spend' ? (
              <AreaChart data={currentChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E676" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00E676" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C75FF" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#7C75FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#52525b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div style={{ background: '#0e0e16', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.8)' }}>
                          <div style={{ fontWeight: 800, color: '#fff', marginBottom: '6px' }}>{label} Performance</div>
                          <div style={{ color: '#00E676', display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '2px' }}>
                            <span>Revenue:</span> <strong style={{ fontFamily: 'var(--font-mono)' }}>₹{data.Revenue.toLocaleString('en-IN')}</strong>
                          </div>
                          <div style={{ color: '#7C75FF', display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '2px' }}>
                            <span>Spend:</span> <strong style={{ fontFamily: 'var(--font-mono)' }}>₹{data.Spend.toLocaleString('en-IN')}</strong>
                          </div>
                          <div style={{ color: '#00D2FF', display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '2px' }}>
                            <span>ROAS:</span> <strong style={{ fontFamily: 'var(--font-mono)' }}>{data.ROAS}x</strong>
                          </div>
                          <div style={{ color: '#FFB300', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span>Orders:</span> <strong style={{ fontFamily: 'var(--font-mono)' }}>{data.Orders}</strong>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="Revenue" stroke="#00E676" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="Spend" stroke="#7C75FF" strokeWidth={2} fillOpacity={1} fill="url(#colorSpend)" />
              </AreaChart>
            ) : metricView === 'roas' ? (
              <LineChart data={currentChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}x`} />
                <RechartsTooltip
                  contentStyle={{ background: '#0e0e16', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  formatter={(val: any) => [`${val}x`, 'ROAS']}
                />
                <Line type="monotone" dataKey="ROAS" stroke="#00D2FF" strokeWidth={3} dot={{ r: 4, fill: '#00D2FF' }} />
              </LineChart>
            ) : metricView === 'orders' ? (
              <BarChart data={currentChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                <RechartsTooltip
                  contentStyle={{ background: '#0e0e16', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  formatter={(val: any) => [val, 'Orders Completed']}
                />
                <Bar dataKey="Orders" fill="#FF5296" radius={[6, 6, 0, 0]} />
              </BarChart>
            ) : metricView === 'cac' ? (
              <LineChart data={currentChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                <RechartsTooltip
                  contentStyle={{ background: '#0e0e16', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  formatter={(val: any) => [`₹${val}`, 'Blended CAC']}
                />
                <Line type="monotone" dataKey="CAC" stroke="#00E676" strokeWidth={2.5} dot={{ r: 4, fill: '#00E676' }} />
              </LineChart>
            ) : (
              <AreaChart data={currentChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#52525b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <RechartsTooltip
                  contentStyle={{ background: '#0e0e16', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, metricView === 'revenue' ? 'Revenue' : 'Spend']}
                />
                <Area
                  type="monotone"
                  dataKey={metricView === 'revenue' ? 'Revenue' : 'Spend'}
                  stroke={metricView === 'revenue' ? '#00E676' : '#7C75FF'}
                  fill={metricView === 'revenue' ? 'rgba(0,230,118,0.2)' : 'rgba(124,117,255,0.2)'}
                  strokeWidth={2.5}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Legend strip */}
        <div style={{ display: 'flex', gap: '20px', fontSize: '12px', justifyContent: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00E676' }} /> Revenue Stream
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7C75FF' }} /> Paid Ad Spend
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00D2FF' }} /> Blended ROAS
          </span>
        </div>
      </div>

      {/* ── 3 & 4. DUAL GRID: CHANNEL PERFORMANCE & CLAUDE GROWTH INSIGHT ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        
        {/* ── 3. CHANNEL PERFORMANCE MATRIX ─────────────────────────── */}
        <div
          className="glow-card"
          style={{
            padding: '22px',
            borderRadius: '20px',
            background: 'linear-gradient(180deg, rgba(20, 20, 32, 0.7) 0%, rgba(10, 10, 16, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} color="#7C75FF" />
                <h3 style={{ fontSize: '16px', color: '#fff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                  Channel Performance
                </h3>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Multi-Touch Attribution
              </span>
            </div>

            {/* Channels Table / Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {channels.map((ch) => (
                <div
                  key={ch.name}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: ch.badgeColor }} />
                    <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#fff' }}>{ch.name}</span>
                  </div>

                  {ch.connected ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '18px', textAlign: 'right' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Spend: {ch.spend}</div>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#fff' }}>{ch.revenue}</div>
                      </div>
                      <div style={{ minWidth: '58px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#00E676' }}>{ch.roas}</div>
                        <span style={{ fontSize: '10.5px', color: '#00E676', fontWeight: 700 }}>
                          ↑ {ch.trendPct}
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* Disconnected platform: Never display fake 0 or 0x */
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Not Connected</span>
                      <button
                        onClick={() => onNavigateTab?.('integrations')}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: '#fff',
                          padding: '3px 10px',
                          borderRadius: '100px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Connect
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '14px', fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Auto-synced via OAuth telemetry</span>
            <span style={{ color: '#00E676' }}>● High Attribution Confidence</span>
          </div>
        </div>

        {/* ── 4. CLAUDE GROWTH INSIGHT CARD ─────────────────────────── */}
        <div
          className="glow-card"
          style={{
            padding: '22px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(26, 20, 48, 0.85) 0%, rgba(14, 12, 26, 0.95) 100%)',
            border: '1.5px solid rgba(124, 117, 255, 0.3)',
            boxShadow: '0 8px 32px rgba(124, 117, 255, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            {/* Card Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(124, 117, 255, 0.2)', border: '1px solid rgba(124, 117, 255, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={15} color="#7C75FF" />
                </div>
                <h3 style={{ fontSize: '16px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                  Claude's Growth Insight
                </h3>
              </div>
              <span style={{ fontSize: '10.5px', background: 'rgba(0, 230, 118, 0.15)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.3)', padding: '2px 8px', borderRadius: '100px', fontWeight: 700 }}>
                Live Synthesis
              </span>
            </div>

            {/* Dynamic Synthesis content */}
            {hasAnyConnection ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '13.5px', color: '#fff', lineHeight: 1.5, background: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>
                    📈 Attributed revenue is up <strong>18.4%</strong> over the selected {timeframe} window.
                  </p>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
                    <strong>Google Ads</strong> is generating peak efficiency at <strong>5.48x ROAS</strong>, while <strong>Meta prospecting</strong> is consuming 45% of budget with lower comparative conversion velocity (3.78x ROAS).
                  </p>
                </div>

                {/* Recommended Action Pill */}
                <div style={{ background: 'rgba(0, 230, 118, 0.06)', border: '1px solid rgba(0, 230, 118, 0.25)', borderRadius: '12px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '11px', color: '#00E676', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px', letterSpacing: '0.04em' }}>
                    Recommended Action
                  </div>
                  <p style={{ fontSize: '12.5px', color: '#fff', margin: 0, lineHeight: 1.4 }}>
                    Consider shifting a <strong>10–15% budget portion</strong> from broad Meta prospecting toward Google high-intent search & remarketing clusters.
                  </p>
                </div>
              </div>
            ) : (
              /* Empty state if no data connected */
              <div style={{ padding: '24px 16px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px 0' }}>
                  Connect your advertising and revenue sources to let Claude identify growth opportunities.
                </p>
                <button
                  onClick={() => onNavigateTab?.('integrations')}
                  style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '100px', padding: '6px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Connect Platforms
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {hasAnyConnection && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                onClick={() => handleAskClaudeContext('Tell me more about the recommended budget shift between Meta and Google Ads.')}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #7C75FF 0%, #5A52FF 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '9px 14px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 16px rgba(124, 117, 255, 0.3)'
                }}
              >
                <Zap size={14} /> Ask Claude
              </button>
              <button
                onClick={() => setShowInsightAnalysisModal(true)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '9px 16px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                View Analysis
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 5 & 6. DUAL GRID: BUDGET EFFICIENCY & INFLUENCER PERFORMANCE ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        
        {/* ── 5. BUDGET EFFICIENCY ──────────────────────────────────── */}
        <div
          className="glow-card"
          style={{
            padding: '22px',
            borderRadius: '20px',
            background: 'linear-gradient(180deg, rgba(20, 20, 32, 0.7) 0%, rgba(10, 10, 16, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={18} color="#00E676" />
                <h3 style={{ fontSize: '16px', color: '#fff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                  Budget Efficiency
                </h3>
              </div>
              <span style={{ fontSize: '11.5px', color: '#00E676', fontWeight: 700 }}>
                {simulatedRoas}x Projected ROAS
              </span>
            </div>

            {/* Current Allocation Visual Multi-bar */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Active Capital Distribution</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>Meta ({budgetMeta}%) • Google ({budgetGoogle}%) • UGC ({budgetInfluencer}%)</span>
              </div>
              
              <div style={{ height: '10px', borderRadius: '100px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex', gap: '2px' }}>
                <div style={{ width: `${budgetMeta}%`, background: '#1877F2', borderRadius: '100px 0 0 100px' }} title={`Meta: ${budgetMeta}%`} />
                <div style={{ width: `${budgetGoogle}%`, background: '#4285F4' }} title={`Google: ${budgetGoogle}%`} />
                <div style={{ width: `${budgetInfluencer}%`, background: '#FF5296' }} title={`Influencer: ${budgetInfluencer}%`} />
                <div style={{ width: `${budgetOther}%`, background: '#7C75FF', borderRadius: '0 100px 100px 0' }} title={`Other: ${budgetOther}%`} />
              </div>
            </div>

            {/* AI Recommendation Box */}
            <div style={{ background: 'rgba(255, 255, 255, 0.025)', border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '12px', padding: '12px 14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: '#00D2FF', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>
                AI Recommendation
              </div>
              <p style={{ fontSize: '12.5px', color: '#fff', margin: 0, lineHeight: 1.4 }}>
                “Google is currently generating the highest ROAS (5.48x). Consider testing a <strong>10–15% budget shift</strong> from Meta to Google Search clusters.”
              </p>
            </div>
          </div>

          {/* Simulate Budget Button */}
          <button
            onClick={() => setShowSimulateModal(true)}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.15) 0%, rgba(0, 200, 83, 0.08) 100%)',
              border: '1px solid rgba(0, 230, 118, 0.4)',
              color: '#00E676',
              padding: '10px',
              borderRadius: '10px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <Sliders size={14} /> Simulate Budget
          </button>
        </div>

        {/* ── 6. INFLUENCER PERFORMANCE (UPGRADED TOP CREATORS) ──────── */}
        <div
          className="glow-card"
          style={{
            padding: '22px',
            borderRadius: '20px',
            background: 'linear-gradient(180deg, rgba(20, 20, 32, 0.7) 0%, rgba(10, 10, 16, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} color="#FF5296" />
                <h3 style={{ fontSize: '16px', color: '#fff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                  Influencer Performance
                </h3>
              </div>

              <button
                onClick={() => onNavigateTab?.('influencer')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#7C75FF',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0
                }}
              >
                View All →
              </button>
            </div>

            {/* Creator Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {creators.map((c) => (
                <div
                  key={c.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'rgba(255, 255, 255, 0.025)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                      src={c.avatar}
                      alt={c.name}
                      style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{c.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.platform}</div>
                    </div>
                  </div>

                  {c.hasData ? (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#00E676' }}>
                        {c.roas} ROAS
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {c.cost} Cost · {c.revenue} Rev
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Performance data unavailable
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '14px', fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Verified conversion attribution</span>
            <button
              onClick={() => onNavigateTab?.('influencer')}
              style={{ background: 'none', border: 'none', color: '#00E676', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              Open Creator CRM
            </button>
          </div>
        </div>
      </div>

      {/* ── 7. GROWTH ALERTS ROW ──────────────────────────────────── */}
      <div
        className="glow-card"
        style={{
          padding: '14px 18px',
          borderRadius: '16px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <Activity size={13} color="#00E676" /> Growth Alerts
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
          {growthAlerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => onNavigateTab?.(alert.targetTab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.025)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(90, 82, 255, 0.4)';
                e.currentTarget.style.background = 'rgba(90, 82, 255, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.025)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, paddingRight: '8px' }}>
                <span style={{ fontSize: '12px' }}>{alert.icon}</span>
                <span style={{ fontSize: '12px', color: '#fff', lineHeight: 1.35 }}>{alert.label}</span>
              </div>
              <span style={{ fontSize: '11px', color: '#7C75FF', fontWeight: 700, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '2px' }}>
                {alert.action} <ChevronRight size={12} />
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── BUDGET SIMULATOR POPUP MODAL ──────────────────────────── */}
      <AnimatePresence>
        {showSimulateModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.82)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '560px',
                background: '#0c0c14',
                border: '1px solid rgba(0, 230, 118, 0.35)',
                borderRadius: '24px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800 }}>
                    Marketing Budget Simulator
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    Reallocate capital across ad platforms to model projected ROAS & revenue changes.
                  </p>
                </div>
                <button
                  onClick={() => setShowSimulateModal(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Sliders */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                    <span style={{ color: '#fff', fontWeight: 600 }}>Meta Ads (Baseline ROAS: 3.78x)</span>
                    <strong style={{ color: '#1877F2' }}>{budgetMeta}%</strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    value={budgetMeta}
                    onChange={(e) => setBudgetMeta(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#1877F2' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                    <span style={{ color: '#fff', fontWeight: 600 }}>Google Ads (Baseline ROAS: 5.48x)</span>
                    <strong style={{ color: '#4285F4' }}>{budgetGoogle}%</strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    value={budgetGoogle}
                    onChange={(e) => setBudgetGoogle(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#4285F4' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                    <span style={{ color: '#fff', fontWeight: 600 }}>Influencer / UGC (Baseline ROAS: 4.90x)</span>
                    <strong style={{ color: '#FF5296' }}>{budgetInfluencer}%</strong>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={budgetInfluencer}
                    onChange={(e) => setBudgetInfluencer(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#FF5296' }}
                  />
                </div>
              </div>

              {/* Simulation Result Output */}
              <div style={{ background: 'rgba(0, 230, 118, 0.08)', border: '1px solid rgba(0, 230, 118, 0.3)', borderRadius: '14px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#00E676', fontWeight: 800, textTransform: 'uppercase' }}>Projected Blended ROAS</span>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#fff', marginTop: '2px' }}>
                    {simulatedRoas}x <span style={{ fontSize: '13px', color: '#00E676' }}>+{((Number(simulatedRoas) - 3.81) / 3.81 * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    alert(`Simulated budget allocation saved! Reallocating capital in Campaign Manager.`);
                    setShowSimulateModal(false);
                    onNavigateTab?.('campaign');
                  }}
                  style={{ background: 'linear-gradient(135deg, #00E676 0%, #00C853 100%)', color: '#000', border: 'none', borderRadius: '100px', padding: '9px 20px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
                >
                  Apply to Campaigns ⚡
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CLAUDE DETAILED ANALYSIS MODAL ────────────────────────── */}
      <AnimatePresence>
        {showInsightAnalysisModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.82)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '620px',
                background: '#0c0c16',
                border: '1px solid rgba(124, 117, 255, 0.35)',
                borderRadius: '24px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Zap size={20} color="#7C75FF" />
                  <h3 style={{ fontSize: '20px', color: '#fff', margin: 0, fontWeight: 800 }}>
                    Claude's Deep Growth Audit
                  </h3>
                </div>
                <button
                  onClick={() => setShowInsightAnalysisModal(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '16px' }}>
                  <h4 style={{ color: '#00E676', margin: '0 0 6px 0', fontSize: '14px' }}>1. Channel ROAS Discrepancy</h4>
                  <p style={{ margin: 0, color: '#fff' }}>
                    Google Search Brand & Non-Brand terms have achieved an exceptional <strong>5.48x ROAS</strong> with only ₹88K spend. Search intent indicates strong conversion readiness with low customer acquisition costs (₹184 CAC).
                  </p>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '16px' }}>
                  <h4 style={{ color: '#FFB300', margin: '0 0 6px 0', fontSize: '14px' }}>2. Meta Top-of-Funnel Saturation</h4>
                  <p style={{ margin: 0, color: '#fff' }}>
                    Meta spend is ₹1.32L (45% of total budget) yielding 3.78x ROAS. Ad frequency has reached 3.4 on Instagram Reels, indicating creative fatigue in cold audiences.
                  </p>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '16px' }}>
                  <h4 style={{ color: '#7C75FF', margin: '0 0 6px 0', fontSize: '14px' }}>3. Action Plan</h4>
                  <p style={{ margin: 0, color: '#fff' }}>
                    1. Reallocate 12% budget (approx ₹35,000) from Meta to Google Search.<br />
                    2. Trigger Creative Studio AI batch generator to introduce 3 fresh UGC Reels angles.<br />
                    3. Boost creator @techguru_sam’s unboxing Reel as a Whitelist Partnership ad.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  onClick={() => setShowInsightAnalysisModal(false)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '8px 18px', borderRadius: '100px', fontSize: '12.5px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Close
                </button>
                <GlowButton
                  variant="glow"
                  onClick={() => {
                    setShowInsightAnalysisModal(false);
                    handleAskClaudeContext('Apply Claude growth recommendations to active ad sets.');
                  }}
                  style={{ padding: '8px 20px', fontSize: '12.5px' }}
                >
                  Execute with Claude ⚡
                </GlowButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
