import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, TrendingUp, Zap, Sparkles, ExternalLink, ShieldCheck, Copy, Check, Flame,
  RefreshCw, AlertTriangle, Play, Clock, Tag
} from 'lucide-react';
import { GlowButton } from './GlowButton';
import {
  IntelligenceService, relativeTime, BUCKET_COLORS, BUCKET_LABELS,
  type CompetitorAdsResponse, type MarketTrendsResponse, type CompetitorGroup,
} from '../services/intelligence';

/**
 * Market Intelligence — the competitor ad vault and the market/search-trend radar for ONE
 * workspace.
 *
 * This screen used to be ~700 lines of fixture: Portronics and StuffCool ad counts, festive
 * keyword scores, three YouTube links, a blue-ocean/red-ocean analysis — all hardcoded, all
 * identical for every tenant, and none of it fetched from anywhere. It read as a working
 * product and was a mock, so the numbers on it could not be acted on.
 *
 * Everything below now comes from /api/workspaces/{id}/competitor-ads and /market-trends,
 * which are filled by the fortnightly and four-weekly syncs. When a source is not
 * configured, or a sync has never run, the panel says exactly that instead of showing a
 * plausible report.
 */

interface MarketTrendsCompetitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: number | null;
  onNavigateTab?: (tab: string) => void;
}

const CARD = {
  background: 'rgba(255, 255, 255, 0.02)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '18px',
  padding: '20px 24px',
} as const;

const LABEL = {
  fontSize: '11px', fontWeight: 800, textTransform: 'uppercase',
  letterSpacing: '0.04em',
} as const;

/** Empty / not-configured / failed states all look the same and differ only in words, so
 *  they share one component — the alternative was four near-identical blocks. */
const StateCard: React.FC<{ tone: 'info' | 'warn'; title: string; children: React.ReactNode }> = ({
  tone, title, children,
}) => (
  <div style={{
    ...CARD,
    background: tone === 'warn' ? 'rgba(255, 176, 32, 0.06)' : 'rgba(255,255,255,0.02)',
    border: `1px solid ${tone === 'warn' ? 'rgba(255, 176, 32, 0.35)' : 'rgba(255,255,255,0.08)'}`,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
      <AlertTriangle size={16} color={tone === 'warn' ? '#FFB020' : '#7C75FF'} />
      <h3 style={{ fontSize: '15px', color: '#fff', margin: 0, fontWeight: 700 }}>{title}</h3>
    </div>
    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>{children}</div>
  </div>
);

const SyncBar: React.FC<{
  label: string;
  cadenceDays: number;
  sync: { status: string; last_run_at: string | null; message: string } | undefined;
  configured: boolean;
  busy: boolean;
  onSync: () => void;
}> = ({ label, cadenceDays, sync, configured, busy, onSync }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px',
    flexWrap: 'wrap', padding: '12px 18px', background: 'rgba(0,0,0,0.35)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
      <Clock size={14} color="var(--text-secondary)" />
      <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
        {label} · refreshes every {cadenceDays === 14 ? '2 weeks' : `${cadenceDays / 7} weeks`} ·
        {' '}last run <strong style={{ color: '#fff' }}>{relativeTime(sync?.last_run_at ?? null)}</strong>
      </span>
      {sync?.status === 'failed' && (
        <span style={{
          fontSize: '11px', background: 'rgba(255,71,87,0.15)', color: '#ff4757',
          border: '1px solid rgba(255,71,87,0.35)', padding: '2px 10px', borderRadius: '100px', fontWeight: 700,
        }}>
          last run failed
        </span>
      )}
    </div>
    <GlowButton
      variant="glow"
      onClick={onSync}
      disabled={busy || !configured}
      style={{ padding: '8px 18px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '7px' }}
    >
      <RefreshCw size={13} className={busy ? 'spin-animation' : undefined} />
      {busy ? 'Syncing…' : 'Sync now'}
    </GlowButton>
  </div>
);

export const MarketTrendsCompetitorModal: React.FC<MarketTrendsCompetitorModalProps> = ({
  isOpen, onClose, workspaceId = null,
}) => {
  const [activeReportTab, setActiveReportTab] = useState<'competitor_ads' | 'keyword_trends'>('competitor_ads');
  const [copiedHook, setCopiedHook] = useState<string | null>(null);

  const [ads, setAds] = useState<CompetitorAdsResponse | null>(null);
  const [trends, setTrends] = useState<MarketTrendsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<'ads' | 'trends' | null>(null);
  const [activeCompetitor, setActiveCompetitor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const [a, t] = await Promise.all([
        IntelligenceService.competitorAds(workspaceId),
        IntelligenceService.marketTrends(workspaceId),
      ]);
      setAds(a);
      setTrends(t);
      setActiveCompetitor(prev => prev ?? (a.competitors[0]?.competitor ?? null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load market intelligence.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const runSync = async (kind: 'ads' | 'trends') => {
    if (!workspaceId) return;
    setSyncing(kind);
    setError(null);
    try {
      if (kind === 'ads') await IntelligenceService.syncCompetitorAds(workspaceId);
      else await IntelligenceService.syncMarketTrends(workspaceId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed.');
    } finally {
      setSyncing(null);
    }
  };

  const copyHook = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHook(text);
    setTimeout(() => setCopiedHook(null), 2000);
  };

  if (!isOpen) return null;

  const group: CompetitorGroup | undefined =
    ads?.competitors.find(c => c.competitor === activeCompetitor) ?? ads?.competitors[0];
  const report = trends?.latest ?? null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '24px',
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: '1080px', maxHeight: '90vh',
            background: 'linear-gradient(180deg, #10101c 0%, #08080e 100%)',
            border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '24px',
            boxShadow: '0 25px 80px rgba(0, 0, 0, 0.9)', display: 'flex',
            flexDirection: 'column', overflow: 'hidden',
          }}
        >
          {/* ── HEADER ─────────────────────────────────────────────── */}
          <div style={{
            padding: '22px 28px', borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(255,255,255,0.02)', gap: '16px', flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: 'rgba(124,117,255,0.15)', border: '1px solid rgba(124,117,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <TrendingUp size={22} color="#7C75FF" />
              </div>
              <div>
                <h2 style={{
                  fontSize: '20px', color: '#fff', margin: 0, fontWeight: 800,
                  fontFamily: 'var(--font-heading)',
                }}>
                  Market Intelligence
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  {report?.region ? `${report.region} · ` : ''}
                  Competitor ad vault refreshed fortnightly · search &amp; creator radar every 4 weeks
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={load}
                disabled={loading}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff', padding: '7px 14px', borderRadius: '100px', fontSize: '12px',
                  fontWeight: 600, cursor: loading ? 'default' : 'pointer', display: 'flex',
                  alignItems: 'center', gap: '5px',
                }}
              >
                <RefreshCw size={13} className={loading ? 'spin-animation' : undefined} /> Reload
              </button>
              <button
                onClick={onClose}
                style={{
                  width: '34px', height: '34px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ── TABS ───────────────────────────────────────────────── */}
          <div style={{
            display: 'flex', gap: '8px', padding: '14px 28px', background: 'rgba(0,0,0,0.4)',
            borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap',
          }}>
            {([
              { id: 'competitor_ads' as const, icon: ShieldCheck, color: '#7C75FF',
                label: `Competitor ad vault${ads ? ` (${ads.total_ads})` : ''}` },
              { id: 'keyword_trends' as const, icon: Flame, color: '#00E676',
                label: `Search & creator radar${report ? ` (${report.strategic_keywords.length})` : ''}` },
            ]).map(tab => {
              const on = activeReportTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveReportTab(tab.id)}
                  style={{
                    background: on ? `${tab.color}33` : 'transparent',
                    border: '1px solid', borderColor: on ? tab.color : 'transparent',
                    color: on ? '#fff' : 'var(--text-secondary)', padding: '8px 20px',
                    borderRadius: '100px', fontSize: '13px', fontWeight: on ? 700 : 500,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <Icon size={14} color={on ? tab.color : 'currentColor'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* ── BODY ───────────────────────────────────────────────── */}
          <div style={{
            padding: '24px 28px', overflowY: 'auto', display: 'flex',
            flexDirection: 'column', gap: '20px',
          }}>
            {!workspaceId && (
              <StateCard tone="warn" title="No workspace selected">
                Open a brand workspace to see its competitor ads and market trends.
              </StateCard>
            )}

            {error && (
              <StateCard tone="warn" title="Something went wrong">{error}</StateCard>
            )}

            {loading && !ads && !trends && (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <RefreshCw size={22} className="spin-animation" />
                <p style={{ marginTop: '12px', fontSize: '13px' }}>Loading this workspace's intelligence…</p>
              </div>
            )}

            {/* ══════════════ TAB 1 — COMPETITOR AD VAULT ══════════════ */}
            {activeReportTab === 'competitor_ads' && ads && (
              <>
                <SyncBar
                  label="Meta Ad Library"
                  cadenceDays={ads.cadence_days}
                  sync={ads.sync}
                  configured={ads.source_configured}
                  busy={syncing === 'ads'}
                  onSync={() => runSync('ads')}
                />

                {!ads.source_configured && (
                  <StateCard tone="warn" title="No ad source is configured yet">
                    Meta's official Ad Library API returns commercial ads only for EU/EEA
                    countries — everywhere else it is limited to political and social-issue
                    ads. Set <code>META_AD_LIBRARY_TOKEN</code> for EU competitors, and
                    <code> APIFY_TOKEN</code> for markets like India. Until one is set this
                    vault stays empty rather than showing invented ads.
                  </StateCard>
                )}

                {ads.source_configured && ads.competitors.length === 0 && (
                  <StateCard tone="info" title="No competitor ads stored yet">
                    {ads.sync.status === 'skipped'
                      ? 'Add competitors under “Research a competitor” first — the ad sync tracks the rivals you have named.'
                      : ads.sync.status === 'failed'
                        ? `The last sync failed: ${ads.sync.message}`
                        : 'Run “Sync now” to pull each competitor’s currently active ads.'}
                  </StateCard>
                )}

                {ads.competitors.length > 0 && (
                  <>
                    {/* competitor switcher */}
                    <div style={{
                      display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.04)',
                      padding: '4px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.1)',
                      flexWrap: 'wrap', alignSelf: 'flex-start',
                    }}>
                      {ads.competitors.map(c => {
                        const on = (group?.competitor ?? '') === c.competitor;
                        return (
                          <button
                            key={c.competitor}
                            onClick={() => setActiveCompetitor(c.competitor)}
                            style={{
                              background: on ? 'rgba(124,117,255,0.25)' : 'transparent',
                              border: 'none', color: on ? '#fff' : 'var(--text-secondary)',
                              padding: '7px 16px', borderRadius: '100px', fontSize: '12.5px',
                              fontWeight: on ? 700 : 500, cursor: 'pointer',
                            }}
                          >
                            {c.competitor} <span style={{ opacity: 0.6 }}>({c.ad_count})</span>
                          </button>
                        );
                      })}
                    </div>

                    {group && (
                      <>
                        {group.strategy?.summary && (
                          <div style={CARD}>
                            <span style={{ ...LABEL, color: '#7C75FF' }}>Executive summary</span>
                            <p style={{
                              fontSize: '14px', color: 'rgba(255,255,255,0.9)',
                              margin: '8px 0 0 0', lineHeight: 1.6,
                            }}>
                              {group.strategy.summary}
                            </p>
                            {group.strategy.offer_strategy && (
                              <p style={{
                                fontSize: '13px', color: 'var(--text-secondary)',
                                margin: '10px 0 0 0', lineHeight: 1.6,
                              }}>
                                <strong style={{ color: '#fff' }}>Offer strategy: </strong>
                                {group.strategy.offer_strategy}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Blue / Red ocean, only when the analysis produced them. */}
                        {(group.strategy?.blue_ocean?.title || group.strategy?.red_ocean?.title) && (
                          <div style={{
                            display: 'grid', gap: '16px',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))',
                          }}>
                            {([
                              { key: 'blue', tag: 'BLUE OCEAN', color: '#00D2FF', data: group.strategy?.blue_ocean },
                              { key: 'red', tag: 'RED OCEAN', color: '#ff4757', data: group.strategy?.red_ocean },
                            ]).filter(o => o.data?.title).map(o => (
                              <div key={o.key} className="glow-card" style={{
                                background: `${o.color}0d`, border: `1.5px solid ${o.color}4d`,
                                borderRadius: '18px', padding: '22px', display: 'flex',
                                flexDirection: 'column', gap: '12px',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{
                                    ...LABEL, background: `${o.color}33`, color: o.color,
                                    border: `1px solid ${o.color}66`, padding: '2px 10px',
                                    borderRadius: '100px',
                                  }}>{o.tag}</span>
                                  <h4 style={{ fontSize: '16px', color: '#fff', margin: 0, fontWeight: 700 }}>
                                    {o.data?.title}
                                  </h4>
                                </div>
                                {o.data?.rationale && (
                                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.5 }}>
                                    {o.data.rationale}
                                  </p>
                                )}
                                {!!o.data?.actions?.length && (
                                  <div style={{
                                    background: 'rgba(0,0,0,0.3)', border: `1px solid ${o.color}33`,
                                    borderRadius: '10px', padding: '10px 14px', fontSize: '12px',
                                  }}>
                                    <strong style={{ color: o.color }}>Action items:</strong>
                                    <div style={{ color: 'rgba(255,255,255,0.85)', marginTop: '4px', lineHeight: 1.6 }}>
                                      {o.data.actions.map((a, i) => <div key={i}>{i + 1}. {a}</div>)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* the ads themselves */}
                        <div className="glow-card" style={{
                          background: '#0a0a12', borderRadius: '20px', padding: '24px',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}>
                          <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            flexWrap: 'wrap', gap: '12px', marginBottom: '16px',
                          }}>
                            <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontWeight: 800 }}>
                              {group.competitor} — active ads
                            </h3>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {group.evergreen_count} running 45+ days · {group.ad_count} total
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {group.ads.map(ad => {
                              const evergreen = (ad.days_active ?? 0) >= 45;
                              return (
                                <div key={ad.id} style={{
                                  background: 'rgba(255,255,255,0.02)',
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  borderRadius: '14px', padding: '16px 18px',
                                }}>
                                  <div style={{
                                    display: 'flex', justifyContent: 'space-between',
                                    gap: '12px', flexWrap: 'wrap', marginBottom: '8px',
                                  }}>
                                    <strong style={{ fontSize: '14px', color: '#fff' }}>
                                      {ad.title || '(no headline)'}
                                    </strong>
                                    <span style={{
                                      ...LABEL,
                                      background: evergreen ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.06)',
                                      color: evergreen ? '#00E676' : 'var(--text-secondary)',
                                      border: `1px solid ${evergreen ? 'rgba(0,230,118,0.35)' : 'rgba(255,255,255,0.12)'}`,
                                      padding: '2px 10px', borderRadius: '100px',
                                    }}>
                                      {ad.days_active === null ? 'age unknown' : `${ad.days_active} days active`}
                                    </span>
                                  </div>

                                  {ad.copy && (
                                    <p style={{
                                      fontSize: '13px', color: 'rgba(255,255,255,0.8)',
                                      margin: '0 0 10px 0', lineHeight: 1.55, whiteSpace: 'pre-wrap',
                                    }}>
                                      {ad.copy.slice(0, 340)}{ad.copy.length > 340 ? '…' : ''}
                                    </p>
                                  )}

                                  <div style={{
                                    display: 'flex', gap: '8px', alignItems: 'center',
                                    flexWrap: 'wrap', fontSize: '11.5px', color: 'var(--text-muted)',
                                  }}>
                                    {ad.offers?.code && (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        background: 'rgba(255,176,32,0.12)', color: '#FFB020',
                                        border: '1px solid rgba(255,176,32,0.3)', padding: '2px 10px',
                                        borderRadius: '100px', fontWeight: 700,
                                      }}>
                                        <Tag size={11} /> {ad.offers.code}
                                      </span>
                                    )}
                                    {!!ad.offers?.percent_off && (
                                      <span style={{ color: '#FFB020', fontWeight: 700 }}>
                                        {ad.offers.percent_off}% off
                                      </span>
                                    )}
                                    {(ad.offers?.perks ?? []).map(p => (
                                      <span key={p} style={{ color: '#00E676' }}>free {p}</span>
                                    ))}
                                    {ad.platforms.length > 0 && <span>· {ad.platforms.join(', ')}</span>}
                                    {/* Where the row came from, always shown — the official
                                        API and a third-party collector are not the same
                                        provenance and should never look like it. */}
                                    <span>· via {ad.source}</span>
                                    {ad.snapshot_url && (
                                      <a
                                        href={ad.snapshot_url} target="_blank" rel="noopener noreferrer"
                                        style={{
                                          color: '#7C75FF', display: 'inline-flex', alignItems: 'center',
                                          gap: '4px', textDecoration: 'none', fontWeight: 600,
                                        }}
                                      >
                                        View in Ad Library <ExternalLink size={11} />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {!!group.strategy?.recommended_formats?.length && (
                          <div style={CARD}>
                            <span style={{ ...LABEL, color: '#00E676' }}>Recommended creative formats</span>
                            <div style={{
                              marginTop: '10px', display: 'flex', flexDirection: 'column',
                              gap: '6px', fontSize: '13px', color: 'rgba(255,255,255,0.85)',
                            }}>
                              {group.strategy.recommended_formats.map((f, i) => <div key={i}>• {f}</div>)}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {/* ══════════════ TAB 2 — SEARCH & CREATOR RADAR ══════════════ */}
            {activeReportTab === 'keyword_trends' && trends && (
              <>
                <SyncBar
                  label="Search trends & creator refs"
                  cadenceDays={trends.cadence_days}
                  sync={trends.sync}
                  configured={trends.source_configured}
                  busy={syncing === 'trends'}
                  onSync={() => runSync('trends')}
                />

                {!trends.source_configured && (
                  <StateCard tone="warn" title="No trend source is configured yet">
                    Set <code>SERPAPI_KEY</code> (or install <code>pytrends</code>) for search
                    interest, and <code>YOUTUBE_API_KEY</code> for creator video references.
                    Without one of these the radar has nothing real to measure, so it stays
                    empty.
                  </StateCard>
                )}

                {trends.source_configured && !report && (
                  <StateCard tone="info" title="No trend report yet">
                    {trends.sync.status === 'failed'
                      ? `The last sync failed: ${trends.sync.message}`
                      : 'Run “Sync now” to build this workspace’s first market radar. Keywords are derived from the product categories found during brand onboarding.'}
                  </StateCard>
                )}

                {report && (
                  <>
                    <div style={CARD}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <Sparkles size={16} color="#00E676" />
                        <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 800 }}>
                          {report.report_title}
                        </h3>
                        <span style={{
                          ...LABEL, background: 'rgba(0,230,118,0.15)', color: '#00E676',
                          border: '1px solid rgba(0,230,118,0.3)', padding: '2px 10px', borderRadius: '100px',
                        }}>
                          {report.region}
                        </span>
                      </div>
                      {report.summary && (
                        <p style={{
                          fontSize: '13.5px', color: 'rgba(255,255,255,0.85)',
                          margin: '10px 0 0 0', lineHeight: 1.6,
                        }}>
                          {report.summary}
                        </p>
                      )}
                      <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '12px 0 0 0' }}>
                        {report.period_start?.slice(0, 10)} → {report.period_end?.slice(0, 10)} ·
                        {' '}sources: {report.sources.length ? report.sources.join(', ') : 'none recorded'}
                      </p>
                    </div>

                    {report.strategic_keywords.length > 0 && (
                      <div className="glow-card" style={{
                        background: '#0a0a12', borderRadius: '20px', padding: '24px',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}>
                        <h3 style={{ fontSize: '17px', color: '#fff', margin: '0 0 14px 0', fontWeight: 800 }}>
                          Strategic keywords &amp; copy hooks
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {report.strategic_keywords.map(k => {
                            const color = BUCKET_COLORS[k.bucket] ?? '#7C75FF';
                            return (
                              <div key={k.keyword} style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '14px', padding: '14px 18px',
                              }}>
                                <div style={{
                                  display: 'flex', alignItems: 'center', gap: '10px',
                                  flexWrap: 'wrap', marginBottom: k.hook ? '8px' : 0,
                                }}>
                                  <strong style={{ fontSize: '14px', color: '#fff' }}>{k.keyword}</strong>
                                  <span style={{
                                    ...LABEL, background: `${color}26`, color,
                                    border: `1px solid ${color}59`, padding: '2px 10px', borderRadius: '100px',
                                  }}>
                                    {BUCKET_LABELS[k.bucket] ?? k.bucket}
                                  </span>
                                  {/* The interest index is a measured value, so it gets a
                                      bar rather than a bare number — a 84 next to a 12 is
                                      only meaningful when you can see the difference. */}
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                                    <span style={{
                                      width: '90px', height: '6px', borderRadius: '100px',
                                      background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
                                    }}>
                                      <span style={{
                                        display: 'block', height: '100%', background: color,
                                        width: `${Math.max(0, Math.min(100, k.score))}%`,
                                      }} />
                                    </span>
                                    <span style={{ fontSize: '12px', color: '#fff', fontWeight: 700, minWidth: '26px' }}>
                                      {k.score}
                                    </span>
                                  </span>
                                </div>
                                {k.hook && (
                                  <div style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    justifyContent: 'space-between', flexWrap: 'wrap',
                                  }}>
                                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.82)', lineHeight: 1.5 }}>
                                      “{k.hook}”
                                    </span>
                                    <button
                                      onClick={() => copyHook(k.hook)}
                                      style={{
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(255,255,255,0.12)', color: '#fff',
                                        padding: '5px 12px', borderRadius: '100px', fontSize: '11.5px',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                                      }}
                                    >
                                      {copiedHook === k.hook ? <Check size={12} color="#00E676" /> : <Copy size={12} />}
                                      {copiedHook === k.hook ? 'Copied' : 'Copy hook'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(report.winning_patterns.length > 0 || report.creative_formats.length > 0) && (
                      <div style={{
                        display: 'grid', gap: '16px',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
                      }}>
                        {report.winning_patterns.length > 0 && (
                          <div style={CARD}>
                            <span style={{ ...LABEL, color: '#00D2FF' }}>Winning patterns</span>
                            <div style={{
                              marginTop: '10px', display: 'flex', flexDirection: 'column',
                              gap: '6px', fontSize: '13px', color: 'rgba(255,255,255,0.85)',
                            }}>
                              {report.winning_patterns.map((p, i) => <div key={i}>• {p}</div>)}
                            </div>
                          </div>
                        )}
                        {report.creative_formats.length > 0 && (
                          <div style={CARD}>
                            <span style={{ ...LABEL, color: '#FFB020' }}>Creative formats to produce</span>
                            <div style={{
                              marginTop: '10px', display: 'flex', flexDirection: 'column',
                              gap: '6px', fontSize: '13px', color: 'rgba(255,255,255,0.85)',
                            }}>
                              {report.creative_formats.map((f, i) => <div key={i}>• {f}</div>)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {report.creator_video_refs.length > 0 && (
                      <div className="glow-card" style={{
                        background: '#0a0a12', borderRadius: '20px', padding: '24px',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}>
                        <h3 style={{ fontSize: '17px', color: '#fff', margin: '0 0 14px 0', fontWeight: 800 }}>
                          Creator video references
                        </h3>
                        <div style={{
                          display: 'grid', gap: '14px',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
                        }}>
                          {report.creator_video_refs.map(v => (
                            <a
                              key={v.url} href={v.url} target="_blank" rel="noopener noreferrer"
                              style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px',
                                overflow: 'hidden', textDecoration: 'none', display: 'flex',
                                flexDirection: 'column',
                              }}
                            >
                              {v.thumbnail && (
                                <img
                                  src={v.thumbnail} alt=""
                                  style={{ width: '100%', height: '130px', objectFit: 'cover' }}
                                />
                              )}
                              <div style={{ padding: '12px 14px' }}>
                                <div style={{
                                  fontSize: '13px', color: '#fff', fontWeight: 600,
                                  lineHeight: 1.4, marginBottom: '6px',
                                }}>
                                  {v.title}
                                </div>
                                <div style={{
                                  fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex',
                                  alignItems: 'center', gap: '5px',
                                }}>
                                  <Play size={11} /> {v.channel} · {v.published_at}
                                </div>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {trends.history.length > 0 && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        <Zap size={12} style={{ verticalAlign: 'middle' }} /> Earlier reports:{' '}
                        {trends.history.map(h => `${h.report_title} (${h.period_end?.slice(0, 10)})`).join(' · ')}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
