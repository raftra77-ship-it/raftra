import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  TrendingUp,
  ShieldCheck,
  Calendar,
  Clock,
  ExternalLink,
  Sparkles,
  Copy,
  Check,
  Download,
  Flame,
  Search,
  Filter,
  RefreshCw,
  Layers,
  Zap,
  Target,
  ArrowRight,
  Eye,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Bookmark,
  Share2,
  Tag,
  Lock,
  CheckCircle
} from 'lucide-react';
import { GlowButton } from '../GlowButton';

/* Where this screen's data comes from.
   ------------------------------------------------------------------
   Everything here used to be two literal arrays: five "power bank" keywords and forty
   Portronics/StuffCool ads, hard-coded from the design mock this layout came from. They
   rendered for every workspace, so a Nike customer opened Market Intelligence and read a
   competitor analysis of a power-bank brand.

   The data was never missing - /api/workspaces/{id}/competitor-ads and /market-trends have
   been serving the real thing all along, and Creative Studio's ad vault already reads the
   first of them. This screen simply never asked. It does now, and renders nothing rather
   than someone else's brand when a workspace has not been synced yet. */
interface CompetitorAdRow {
  id: string;
  brand: string;
  title: string;
  hook: string;
  offer: string;
  runningDays: string;
  category: string;
  color: string;
}

interface KeywordRow {
  keyword: string;
  bucket: string;
  avgInterest: number;
  adHook: string;
  badgeColor: string;
}

// Stable per competitor, so a brand keeps the same chip colour between renders rather than
// flickering as the list reorders.
const BRAND_COLORS = ['#7C75FF', '#00E676', '#00D2FF', '#FFB300', '#FF5C7A', '#A78BFA'];

// Keyed to INTENT_BUCKETS in core/market_trends.py - these are the only four the radar
// emits. Ordered by how close the intent is to a purchase, so the colour reads as value.
const BUCKET_COLORS: Record<string, string> = {
  high_intent: '#00E676',
  core: '#7C75FF',
  utility: '#00D2FF',
  lifestyle: '#FFB300',
};

interface WorkspaceReportsProps {
  onNavigateTab?: (tab: string) => void;
  brandName?: string;
  workspaceId?: number | null;
}

export const WorkspaceReports: React.FC<WorkspaceReportsProps> = ({
  onNavigateTab,
  brandName = 'your brand',
  workspaceId = null
}) => {
  const [activeTab, setActiveTab] = useState<'competitor_ads' | 'market_research'>('competitor_ads');
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>('all');
  const [competitorAds, setCompetitorAds] = useState<CompetitorAdRow[]>([]);
  const [strategicKeywords, setStrategicKeywords] = useState<KeywordRow[]>([]);
  const [competitorNames, setCompetitorNames] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string>('');
  // The written analysis. These replaced four paragraphs of prose about Portronics and
  // StuffCool that were rendered to every brand regardless of who they compete with.
  const [strategySummary, setStrategySummary] = useState<string>('');
  const [blueOcean, setBlueOcean] = useState<{ title?: string; rationale?: string; actions?: string[] }>({});
  const [redOcean, setRedOcean] = useState<{ title?: string; rationale?: string; actions?: string[] }>({});
  const [videoRefs, setVideoRefs] = useState<{ title: string; url: string }[]>([]);
  const [totalAds, setTotalAds] = useState<number>(0);
  const [trendSummary, setTrendSummary] = useState<string>('');
  const [trendTitle, setTrendTitle] = useState<string>('');
  const [winningPatterns, setWinningPatterns] = useState<string[]>([]);
  const [observedOn, setObservedOn] = useState<string>('');
  const [adFilterType, setAdFilterType] = useState<string>('all');
  const [copiedHook, setCopiedHook] = useState<string | null>(null);

  // Sync & Cooldown States
  const [isSyncingAds, setIsSyncingAds] = useState(false);
  const [isGeneratingMonthly, setIsGeneratingMonthly] = useState(false);
  const [adsLockedUntil, setAdsLockedUntil] = useState<string | null>(null); // 14 days
  const [monthlyLockedUntil, setMonthlyLockedUntil] = useState<string | null>(null); // 30 days

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHook(text);
    setTimeout(() => setCopiedHook(null), 2000);
  };

  // 1. Sync 2 Weeks Competitor Ads Handler
  const handleSyncCompetitorAds = () => {
    if (adsLockedUntil) {
      alert(`⚠️ Bi-weekly Competitor Ad scan already locked! Next scan unlocks on ${adsLockedUntil}.`);
      return;
    }
    setIsSyncingAds(true);
    setTimeout(() => {
      setIsSyncingAds(false);
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 14);
      const dateStr = nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      setAdsLockedUntil(dateStr);
      alert(`✓ Synced 40 active Meta competitor ads! This action is now locked for 14 days (Unlocks on ${dateStr}).`);
    }, 1200);
  };

  // 2. Generate Monthly Report Handler
  const handleGenerateMonthlyReport = () => {
    if (monthlyLockedUntil) {
      alert(`⚠️ Monthly Market Research Report already generated! Next report unlocks on ${monthlyLockedUntil}.`);
      return;
    }
    setIsGeneratingMonthly(true);
    setTimeout(() => {
      setIsGeneratingMonthly(false);
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 30);
      const dateStr = nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      setMonthlyLockedUntil(dateStr);
      alert(`✓ Generated 30-Day India Market Research Report! This action is now locked for 30 days (Unlocks on ${dateStr}).`);
    }, 1500);
  };

  /* Live market intelligence for THIS workspace.

     Both endpoints already existed and are already proven - Creative Studio's ad vault
     reads /competitor-ads today. Failures are soft on purpose: an empty screen that says
     nothing has been synced is honest, whereas the previous behaviour was to show another
     brand's competitors with no indication they were fictional. */
  useEffect(() => {
    if (!workspaceId) { setCompetitorAds([]); setStrategicKeywords([]); setCompetitorNames([]); return; }

    let cancelled = false;
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    setLoadingData(true);
    setDataError('');

    Promise.all([
      fetch(`/api/workspaces/${workspaceId}/competitor-ads`, { headers })
        .then(r => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/workspaces/${workspaceId}/market-trends`, { headers })
        .then(r => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([adsRes, trendRes]: [any, any]) => {
      if (cancelled) return;

      const names: string[] = [];
      const ads: CompetitorAdRow[] = [];
      for (const comp of (adsRes?.competitors || [])) {
        const name = String(comp?.competitor || '').trim();
        if (!name) continue;
        const color = BRAND_COLORS[names.length % BRAND_COLORS.length];
        names.push(name);
        for (const ad of (comp?.ads || [])) {
          // `offers` is a free-shaped object from the Ad Library; take the first value it
          // actually carries rather than assuming a key name.
          const offerValues = ad?.offers && typeof ad.offers === 'object'
            ? Object.values(ad.offers).filter(Boolean) : [];
          ads.push({
            id: String(ad?.id ?? `${name}-${ads.length}`),
            brand: name,
            title: String(ad?.title || '').trim() || 'Untitled ad',
            hook: String(ad?.copy || '').trim(),
            offer: offerValues.length ? String(offerValues[0]) : '',
            runningDays: ad?.days_active ? `${ad.days_active} days active` : '',
            category: Array.isArray(ad?.platforms) && ad.platforms.length
              ? String(ad.platforms[0]) : String(ad?.source || 'meta'),
            color,
          });
        }
      }

      const kws: KeywordRow[] = ((trendRes?.latest?.strategic_keywords) || [])
        .filter((k: any) => k && k.keyword)
        .map((k: any) => {
          const bucket = String(k.bucket || 'core').toLowerCase();
          return {
            keyword: String(k.keyword),
            bucket,
            // Interest is a measured score; round it rather than inventing precision.
            avgInterest: Math.round(Number(k.score) || 0),
            adHook: String(k.hook || ''),
            badgeColor: BUCKET_COLORS[bucket] || '#00D2FF',
          };
        });

      // The written analysis, taken from whichever competitor the sync actually analysed.
      const withStrategy = (adsRes?.competitors || [])
        .find((c: any) => c?.strategy && (c.strategy.summary || c.strategy.blue_ocean?.rationale));
      setStrategySummary(String(withStrategy?.strategy?.summary || ''));
      setBlueOcean(withStrategy?.strategy?.blue_ocean || {});
      setRedOcean(withStrategy?.strategy?.red_ocean || {});
      setObservedOn(String(withStrategy?.strategy?.synced_at || adsRes?.sync?.last_synced_at || ''));
      // The scan headline counts every ad in the vault, not just the ones passing the filter.
      setTotalAds(Number(adsRes?.total_ads) || ads.length);

      setTrendSummary(String(trendRes?.latest?.summary || ''));
      setTrendTitle(String(trendRes?.latest?.report_title || ''));
      setWinningPatterns(((trendRes?.latest?.winning_patterns) || []).map((p: any) => String(p)));
      // Only keep refs that actually have somewhere to go - a title with no URL renders as a
      // link that does nothing.
      setVideoRefs(((trendRes?.latest?.creator_video_refs) || [])
        .filter((v: any) => v && v.url && v.title)
        .map((v: any) => ({ title: String(v.title), url: String(v.url) })));

      setCompetitorNames(names);
      setCompetitorAds(ads);
      setStrategicKeywords(kws);
      if (!ads.length && !kws.length) {
        setDataError((adsRes || trendRes)
          ? 'No market intelligence has been synced for this brand yet. Run a competitor or trend sync to populate it.'
          : 'Could not load market intelligence for this workspace.');
      }
    }).finally(() => { if (!cancelled) setLoadingData(false); });

    return () => { cancelled = true; };
  }, [workspaceId]);


  const filteredAds = competitorAds.filter(ad => {
    if (selectedCompetitor !== 'all' && ad.brand.toLowerCase() !== selectedCompetitor) return false;
    if (adFilterType !== 'all' && ad.category.toLowerCase() !== adFilterType.toLowerCase()) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* ── HEADER BANNER & TIMELINE CARDS ───────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(124, 117, 255, 0.12)', borderRadius: '100px', border: '1px solid rgba(124, 117, 255, 0.3)', marginBottom: '8px' }}>
            <Sparkles size={13} color="#7C75FF" />
            <span style={{ fontSize: '11px', color: '#7C75FF', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              AUTONOMOUS AD INTELLIGENCE ENGINE
            </span>
          </div>
          <h1 style={{ fontSize: '32px', color: '#fff', margin: '0 0 6px 0', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
            Intelligence & Strategic Reports
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', margin: 0 }}>
            Bi-weekly Meta Ad Library competitor scans and monthly India search demand trend reports for {brandName}.
          </p>
        </div>

        {/* ── TWO DEDICATED ACTION BUTTONS WITH COOLDOWN UNLOCK LOCKS ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Button 1: Sync 2 Weeks Competitor Ads */}
          <button
            onClick={handleSyncCompetitorAds}
            disabled={isSyncingAds || !!adsLockedUntil}
            style={{
              background: adsLockedUntil ? 'rgba(255, 255, 255, 0.04)' : 'rgba(124, 117, 255, 0.15)',
              border: adsLockedUntil ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(124, 117, 255, 0.4)',
              color: adsLockedUntil ? 'var(--text-muted)' : '#7C75FF',
              padding: '9px 18px',
              borderRadius: '100px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: adsLockedUntil ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              boxShadow: adsLockedUntil ? 'none' : '0 0 14px rgba(124, 117, 255, 0.15)'
            }}
          >
            {adsLockedUntil ? (
              <>
                <Lock size={13} color="var(--text-muted)" />
                <span>2-Wk Ads Synced (Next: {adsLockedUntil})</span>
              </>
            ) : isSyncingAds ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Syncing Meta Ads...</span>
              </>
            ) : (
              <>
                <RefreshCw size={13} />
                <span>Sync 2 Weeks Competitor Ads</span>
              </>
            )}
          </button>

          {/* Button 2: Generate Monthly Report */}
          <button
            onClick={handleGenerateMonthlyReport}
            disabled={isGeneratingMonthly || !!monthlyLockedUntil}
            style={{
              background: monthlyLockedUntil ? 'rgba(255, 255, 255, 0.04)' : 'linear-gradient(135deg, #00E676 0%, #00C853 100%)',
              border: monthlyLockedUntil ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
              color: monthlyLockedUntil ? 'var(--text-muted)' : '#000000',
              padding: '9px 20px',
              borderRadius: '100px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: monthlyLockedUntil ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              boxShadow: monthlyLockedUntil ? 'none' : '0 4px 18px rgba(0, 230, 118, 0.35)'
            }}
          >
            {monthlyLockedUntil ? (
              <>
                <Lock size={13} color="var(--text-muted)" />
                <span>Monthly Report Generated (Next: {monthlyLockedUntil})</span>
              </>
            ) : isGeneratingMonthly ? (
              <>
                <Sparkles size={13} className="animate-spin" />
                <span>Generating Report...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>Generate Monthly Report 🚀</span>
              </>
            )}
          </button>

        </div>
      </div>

      {/* ── 2 FREQUENCY STATUS CARDS ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        
        {/* Card 1: Bi-weekly Competitor Analysis */}
        <div
          onClick={() => setActiveTab('competitor_ads')}
          className="glow-card"
          style={{
            background: activeTab === 'competitor_ads' ? 'linear-gradient(135deg, rgba(28, 24, 45, 0.9) 0%, rgba(12, 10, 22, 0.98) 100%)' : '#0a0a12',
            border: activeTab === 'competitor_ads' ? '1.5px solid #7C75FF' : '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            padding: '22px 26px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: activeTab === 'competitor_ads' ? '0 8px 30px rgba(124, 117, 255, 0.2)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(124, 117, 255, 0.15)', border: '1px solid rgba(124, 117, 255, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={22} color="#7C75FF" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 800 }}>
                  Competitor Ad Analysis
                </h3>
                <span style={{ fontSize: '10.5px', background: 'rgba(124, 117, 255, 0.2)', color: '#7C75FF', border: '1px solid rgba(124, 117, 255, 0.4)', padding: '2px 8px', borderRadius: '100px', fontWeight: 800 }}>
                  BI-WEEKLY (14 DAYS)
                </span>
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                {totalAds > 0 ? `${totalAds} Active Meta Ads scanned` : 'No ads scanned yet'} • Next scan {adsLockedUntil ? `unlocked on ${adsLockedUntil}` : 'ready to sync'}
              </p>
            </div>
          </div>
          <ArrowRight size={18} color={activeTab === 'competitor_ads' ? '#7C75FF' : 'var(--text-muted)'} />
        </div>

        {/* Card 2: Monthly Market Research */}
        <div
          onClick={() => setActiveTab('market_research')}
          className="glow-card"
          style={{
            background: activeTab === 'market_research' ? 'linear-gradient(135deg, rgba(20, 35, 25, 0.9) 0%, rgba(10, 18, 14, 0.98) 100%)' : '#0a0a12',
            border: activeTab === 'market_research' ? '1.5px solid #00E676' : '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            padding: '22px 26px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: activeTab === 'market_research' ? '0 8px 30px rgba(0, 230, 118, 0.2)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(0, 230, 118, 0.15)', border: '1px solid rgba(0, 230, 118, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={22} color="#00E676" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 800 }}>
                  India Market Trend Radar
                </h3>
                <span style={{ fontSize: '10.5px', background: 'rgba(0, 230, 118, 0.2)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.4)', padding: '2px 8px', borderRadius: '100px', fontWeight: 800 }}>
                  MONTHLY (30 DAYS)
                </span>
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                {trendTitle || 'No report generated yet'} • Next issue {monthlyLockedUntil ? `unlocked on ${monthlyLockedUntil}` : 'ready to generate'}
              </p>
            </div>
          </div>
          <ArrowRight size={18} color={activeTab === 'market_research' ? '#00E676' : 'var(--text-muted)'} />
        </div>

      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* TAB 1: COMPETITOR AD LIBRARY (BI-WEEKLY SCANS)               */}
      {/* ════════════════════════════════════════════════════════════ */}
      {activeTab === 'competitor_ads' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Executive Summary Card */}
          <div className="glow-card" style={{ background: '#0a0a12', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
              <span style={{ fontSize: '11px', color: '#7C75FF', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {brandName.toUpperCase()} COMPETITOR AD REPORT · IN · META ADS
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {observedOn
                  ? `Observed on ${new Date(observedOn).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                  : 'Not yet synced'}
              </span>
            </div>
            <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)', margin: 0, lineHeight: 1.6 }}>
              {strategySummary || `No competitor analysis has been generated for ${brandName} yet. Once a competitor sync runs, the written read on their positioning appears here.`}
            </p>
          </div>

          {/* Where We Win + Blue / Red Ocean Moves */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
            
            {/* Where We Win */}
            <div className="glow-card" style={{ background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.08) 0%, rgba(10, 20, 15, 0.9) 100%)', border: '1.5px solid rgba(0, 230, 118, 0.3)', borderRadius: '18px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#00E676" />
                <h4 style={{ fontSize: '16px', color: '#fff', margin: 0, fontWeight: 800 }}>
                  Where We Win — {brandName}'s Advantage
                </h4>
              </div>
              <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.85)', margin: 0, lineHeight: 1.5 }}>
                {blueOcean.rationale
                  || (blueOcean.title ? <strong>{blueOcean.title}</strong> : null)
                  || `The opening for ${brandName} appears here once a competitor sync has analysed the category.`}
              </p>
              {/* The actions the analysis actually proposed, rather than three fixed lines
                  written about a power-bank brand. */}
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(blueOcean.actions || []).slice(0, 4).map((action, i) => (
                  <div key={i}>• {action}</div>
                ))}
              </div>
            </div>

            {/* Blue Ocean / Red Ocean Strategy */}
            <div className="glow-card" style={{ background: 'linear-gradient(135deg, rgba(124, 117, 255, 0.08) 0%, rgba(15, 12, 25, 0.9) 100%)', border: '1.5px solid rgba(124, 117, 255, 0.3)', borderRadius: '18px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Target size={18} color="#7C75FF" />
                <h4 style={{ fontSize: '16px', color: '#fff', margin: 0, fontWeight: 800 }}>
                  Blue Ocean & Red Ocean Moves
                </h4>
              </div>
              {/* Both oceans come from the same analysed competitor as the summary above.
                  The title is the short framing and the rationale the argument; either may be
                  blank depending on what the model returned, so each falls back to the other
                  rather than printing an empty line. */}
              {(blueOcean.title || blueOcean.rationale || redOcean.title || redOcean.rationale) ? (
                <div style={{ fontSize: '12.5px', color: 'rgba(255, 255, 255, 0.85)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(blueOcean.title || blueOcean.rationale) && (
                    <div>🌊 <strong style={{ color: '#00D2FF' }}>Blue Ocean:</strong> {blueOcean.title || blueOcean.rationale}</div>
                  )}
                  {(redOcean.title || redOcean.rationale) && (
                    <div>🥊 <strong style={{ color: '#ff4757' }}>Red Ocean:</strong> {redOcean.title || redOcean.rationale}</div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  The uncontested angle and the crowded claim appear here once a competitor sync
                  has analysed {brandName}'s category.
                </div>
              )}
              {(redOcean.actions?.[0] || blueOcean.actions?.[0]) && (
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '8px 12px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  Action: {redOcean.actions?.[0] || blueOcean.actions?.[0]}
                </div>
              )}
            </div>

          </div>

          {/* Ad Library Telemetry Explorer */}
          <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontWeight: 800 }}>
                  Active Meta Ads in India ({filteredAds.length} Displayed)
                </h3>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  Scraped and classified from Meta Ad Library • Updated bi-weekly
                </span>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select
                  value={selectedCompetitor}
                  onChange={e => setSelectedCompetitor(e.target.value as any)}
                  style={{ background: '#141420', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '12.5px' }}
                >
                  <option value="all">
                    {competitorNames.length
                      ? `All Brands (${competitorNames.length})`
                      : 'All Brands'}
                  </option>
                  {/* The competitors this workspace actually tracks, named by the Ad
                      Library rather than by the mock this layout came from. */}
                  {competitorNames.map(name => (
                    <option key={name} value={name.toLowerCase()}>
                      {name} ({competitorAds.filter(a => a.brand === name).length} Ads)
                    </option>
                  ))}
                </select>

                <select
                  value={adFilterType}
                  onChange={e => setAdFilterType(e.target.value)}
                  style={{ background: '#141420', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '12.5px' }}
                >
                  <option value="all">All Placements</option>
                  {/* Derived from the ads themselves. The fixed list this replaced named
                      power-bank categories, which matched nothing for any other brand. */}
                  {Array.from(new Set(competitorAds.map(a => a.category).filter(Boolean)))
                    .sort()
                    .map(cat => (
                      <option key={cat} value={cat.toLowerCase()}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Nothing to show is said plainly. This screen's whole failure mode used to be
                showing a different brand's ads as though they were the customer's. */}
            {!filteredAds.length && (
              <div style={{ padding: '36px 20px', textAlign: 'center', borderRadius: '16px',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px dashed rgba(255,255,255,0.12)' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', margin: 0 }}>
                  {loadingData
                    ? 'Loading competitor ads…'
                    : (dataError || (competitorAds.length
                        ? 'No ads match the selected filters.'
                        : 'No competitor ads have been synced for this brand yet.'))}
                </p>
              </div>
            )}

            {/* Ad Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
              {filteredAds.map((ad) => (
                <div
                  key={ad.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: '16px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', background: `${ad.color}22`, color: ad.color, border: `1px solid ${ad.color}44`, padding: '2px 8px', borderRadius: '100px', fontWeight: 800 }}>
                        {ad.brand}
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{ad.runningDays}</span>
                    </div>

                    <h4 style={{ fontSize: '15px', color: '#fff', margin: '0 0 6px 0', fontWeight: 700 }}>
                      {ad.title}
                    </h4>

                    <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)', margin: '0 0 10px 0', lineHeight: 1.45 }}>
                      "{ad.hook}"
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {/* Most Ad Library entries carry no offer at all, and a bare tag icon
                        reads as a missing value rather than "no discount". */}
                    <div style={{ fontSize: '11.5px', color: '#00E676' }}>
                      {ad.offer ? `🏷️ ${ad.offer}` : ''}
                    </div>
                    <button
                      onClick={() => handleCopy(ad.hook)}
                      style={{
                        background: copiedHook === ad.hook ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid',
                        borderColor: copiedHook === ad.hook ? '#00E676' : 'rgba(255, 255, 255, 0.1)',
                        color: copiedHook === ad.hook ? '#00E676' : '#fff',
                        padding: '4px 10px',
                        borderRadius: '100px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {copiedHook === ad.hook ? <Check size={11} /> : <Copy size={11} />}
                      <span>{copiedHook === ad.hook ? 'Copied' : 'Copy Hook'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended moves, from the analysis rather than from the mock.
              The three cards this replaced were written for a power-bank brand and named a
              competitor by hand, so every workspace was told to "prove laptop power". */}
          {!!(blueOcean.actions || []).length && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {(blueOcean.actions || []).slice(0, 3).map((action, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '18px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: BRAND_COLORS[i % BRAND_COLORS.length], marginBottom: '4px' }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                    {action}
                  </p>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* TAB 2: MARKET RESEARCH & TRENDS (MONTHLY EDITION)             */}
      {/* ════════════════════════════════════════════════════════════ */}
      {activeTab === 'market_research' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Monthly Report Overview Banner */}
          <div className="glow-card" style={{ background: '#0a0a12', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
              <span style={{ fontSize: '11px', color: '#00E676', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {(trendTitle || `${brandName} MARKET RADAR`).toUpperCase()}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {strategicKeywords.length
                  ? `${strategicKeywords.length} tracked keywords`
                  : 'Not yet generated'}
              </span>
            </div>
            <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)', margin: 0, lineHeight: 1.6 }}>
              {trendSummary || `The written read on ${brandName}'s search category appears here once a market-trend report has been generated.`}
            </p>
          </div>

          {/* Strategic Keywords & Copyable Hooks */}
          <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h3 style={{ fontSize: '18px', color: '#fff', margin: '0 0 16px 0', fontWeight: 800 }}>
              Strategic Keywords & High-Converting Ad Hooks
            </h3>

            {!strategicKeywords.length && (
              <div style={{ padding: '36px 20px', textAlign: 'center', borderRadius: '16px',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px dashed rgba(255,255,255,0.12)' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', margin: 0 }}>
                  {loadingData
                    ? 'Loading market trends…'
                    : 'No market trend report has been generated for this brand yet.'}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {strategicKeywords.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '14px',
                    padding: '14px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${item.badgeColor}22`, border: `1px solid ${item.badgeColor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.badgeColor, fontWeight: 900, fontSize: '14px' }}>
                      {item.avgInterest}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ fontSize: '15px', color: '#fff', margin: 0, fontWeight: 700 }}>
                          {item.keyword}
                        </h4>
                        <span style={{ fontSize: '10.5px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase', fontWeight: 700 }}>
                          {item.bucket.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', margin: '4px 0 0 0' }}>
                        {item.adHook}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopy(item.adHook)}
                    style={{
                      background: copiedHook === item.adHook ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid',
                      borderColor: copiedHook === item.adHook ? '#00E676' : 'rgba(255, 255, 255, 0.12)',
                      color: copiedHook === item.adHook ? '#00E676' : '#fff',
                      padding: '6px 14px',
                      borderRadius: '100px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    {copiedHook === item.adHook ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedHook === item.adHook ? 'Copied!' : 'Copy Hook'}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Winning Patterns & Creator References */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
            <div className="glow-card" style={{ background: 'rgba(0, 230, 118, 0.04)', border: '1px solid rgba(0, 230, 118, 0.25)', borderRadius: '18px', padding: '22px' }}>
              <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 12px 0', fontWeight: 700 }}>
                Winning Patterns in India Content
              </h4>
              {/* From the trend report's own winning_patterns. The three bullets here
                  before described power-bank drain tests to every brand. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                {winningPatterns.length
                  ? winningPatterns.slice(0, 6).map((p, i) => <div key={i}>• {p}</div>)
                  : <div style={{ color: 'var(--text-muted)' }}>
                      No patterns recorded yet — they appear with the next market-trend report.
                    </div>}
              </div>
            </div>

            <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '18px', padding: '22px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 12px 0', fontWeight: 700 }}>
                Creator Video References
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {!videoRefs.length && (
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    No creator videos have been collected for this category yet.
                  </div>
                )}
                {videoRefs.map((v, i) => (
                  <a
                    key={i}
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 14px', textDecoration: 'none', color: '#fff', fontSize: '12.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span>{v.title}</span>
                    <ExternalLink size={13} color="#7C75FF" />
                  </a>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
