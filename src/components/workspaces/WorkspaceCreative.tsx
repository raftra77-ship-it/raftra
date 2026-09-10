import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Sparkles, Video, 
  ShieldCheck, CheckCircle2, TrendingUp, Zap, 
  Upload, Image as ImageIcon, Wand2, RefreshCw, BarChart2, Search, 
  Play, Edit3, Send, Check, X, ArrowRight, Download, Calendar, FolderPlus, Save
} from 'lucide-react';
import { GlowButton } from '../GlowButton';
import { PreviewBadge, PreviewNote } from './PreviewMark';
import { MarketTrendsCompetitorModal } from '../MarketTrendsCompetitorModal';

// One card in the Recent Projects / Ad Library grids. `real` marks a row that came from
// this workspace's own generated assets rather than the seeded demo entries, because the two
// support different actions: a demo card can be edited and removed locally, a real one has a
// database row behind it and has to go through the review flow.
export type ProjectCard = {
  id: string;
  title: string;
  date: string;
  status: 'Approved' | 'In Review' | 'Draft';
  img: string;
  headline: string;
  bodyText: string;
  cta: string;
  hashtags: string;
  real?: boolean;
};

// The shared stock product photo that stood in for every missing image - the studio
// background, the carousel cards, the AI "render" preview and the failed-ad fallback - is
// gone. A picture of somebody else's product is not a neutral placeholder in an ad tool:
// each of those slots now shows what is actually missing, or the workspace's own assets.

export interface CreativeAsset {
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

interface WorkspaceCreativeProps {
  brandUrl?: string;
  assets?: CreativeAsset[];
  onOpenReview?: (assetId: string) => void;
  onGenerate?: (prompt: string, referenceAd?: any, config?: any) => void | Promise<any>;
  onAssetSaved?: (asset: CreativeAsset) => void;
  onAssetRemoved?: (assetId: string) => void;
  /** A creative whose stored row changed (approve / reject), so the dashboard can refresh it. */
  onAssetUpdated?: (asset: CreativeAsset) => void;
  workspaceId?: number;
  onNavigateTab?: (tab: string) => void;
  /** An asset handed over from the Media vault, used as the reference image. */
  incomingReferenceImage?: string | null;
  /** Every workspace this user can reach, so Step 1 can actually offer a choice. */
  brands?: { id: number; name: string; company_url?: string; brand_color?: string }[];
  /** Switches the whole dashboard to another workspace. */
  onSwitchWorkspace?: (id: number) => void;
}

/** What GET /api/workspaces/{id}/brand-profile returns. */
interface BrandProfileFull {
  name?: string;
  url?: string;
  brand_voice?: string | null;
  brand_color?: string | null;
  brand_guidelines_summary?: string | null;
  target_audience?: string | null;
  color_palette?: string[];
  typography?: Record<string, string>;
  guidelines?: Record<string, unknown>;
  is_onboarded?: boolean;
}

/** The guidelines blob holds strings, string[] and persona objects depending on which
 *  extractor wrote the field. Coerce whatever is there into one readable line, or null
 *  so the caller can render a "not set" state instead of an invented value. */
const asLine = (v: unknown): string | null => {
  if (typeof v === 'string') return v.trim() || null;
  if (Array.isArray(v)) {
    const parts = v
      .map(x => (typeof x === 'string' ? x
        : x && typeof x === 'object' ? String((x as any).name ?? (x as any).label ?? (x as any).title ?? '')
        : ''))
      .map(s => s.trim())
      .filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }
  if (v && typeof v === 'object') {
    const o = v as any;
    const s = String(o.name ?? o.label ?? o.title ?? '').trim();
    return s || null;
  }
  return null;
};

export const WorkspaceCreative: React.FC<WorkspaceCreativeProps> = ({
  brandUrl = '',
  assets = [],
  onOpenReview,
  onGenerate,
  onAssetSaved,
  workspaceId,
  onAssetRemoved,
  onAssetUpdated,
  onNavigateTab,
  incomingReferenceImage = null,
  brands = [],
  onSwitchWorkspace
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'create' | 'competitors' | 'projects' | 'templates' | 'ugc' | 'editor' | 'carousel' | 'video_editor' | 'ad_library'>('create');

  /* Step 1 reads the real brand rather than the hardcoded "Ambrane India / Modern Tech /
     18-35 Urban Pros" panel it used to show for every workspace. Theme, tone and audience
     come from what onboarding's crawl actually found; a field it could not determine
     renders as "Not set" with a route to the vault, never as a plausible-looking guess. */
  const [brandProfile, setBrandProfile] = useState<BrandProfileFull | null>(null);
  const [brandLoading, setBrandLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) { setBrandLoading(false); return; }
    let cancelled = false;
    setBrandLoading(true);
    const token = localStorage.getItem('token');
    fetch(`/api/workspaces/${workspaceId}/brand-profile`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d) setBrandProfile(d); })
      .catch(() => { /* the card falls back to its "not set" state */ })
      .finally(() => { if (!cancelled) setBrandLoading(false); });
    return () => { cancelled = true; };
  }, [workspaceId]);

  const g = (brandProfile?.guidelines || {}) as Record<string, unknown>;
  const brandName = brandProfile?.name || brands.find(b => b.id === workspaceId)?.name || null;
  const brandSite = (brandProfile?.url || brandUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const brandCategory = asLine(g.categories) || asLine(g.business_model);
  const brandTheme = asLine(g.personality);
  const brandTone = asLine(g.tone) || asLine(g.tone_of_voice) || asLine(brandProfile?.brand_voice);
  const brandAudience = asLine(brandProfile?.target_audience) || asLine(g.target_audiences);
  // "Connected" means onboarding actually wrote something the agents can read.
  const kbConnected = Boolean(brandProfile?.is_onboarded || brandProfile?.brand_guidelines_summary);
  
  // Market Intelligence — this workspace's competitor ad vault and search/creator radar,
  // both filled by the scheduled syncs in backend/core/intel_sync.py.
  const [showMarketIntel, setShowMarketIntel] = useState(false);

  // Hero Quick Goal Selector
  const [quickGoal, setQuickGoal] = useState<'image' | 'video' | 'carousel' | 'ai_ugc' | 'hire_ugc'>('image');

  // Canva / Figma Hybrid Studio Editor State
  const [editorCanvasElements, setEditorCanvasElements] = useState<Array<{
    id: string;
    type: 'text' | 'image' | 'badge' | 'button' | 'shape';
    content: string;
    x: number;
    y: number;
    width: number;
    height?: number;
    fontSize?: number;
    color?: string;
    bgColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    fontWeight?: number | string;
    fontFamily?: string;
    opacity?: number;
    rotation?: number;
    zIndex?: number;
    visible?: boolean;
    locked?: boolean;
  }>>([
    /* The blank document every workspace's editor opens on.
       It used to open on a finished powerbank ad - a stock product photo behind "FLAT 30%
       OFF • SPECIAL OFFER", "Unstoppable Power in Your Pocket ⚡" and "22.5W Power
       Delivery" - so every brand's first canvas was someone else's advert, complete with a
       discount they had not offered. The layers are the same; the content is now clearly
       placeholder until real copy is loaded into it (opening any generated ad in the studio
       replaces all of this). */
    {
      id: 'el_bg',
      type: 'image',
      content: '',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      zIndex: 1,
      visible: true
    },
    {
      id: 'el_badge',
      type: 'badge',
      content: 'YOUR OFFER HERE',
      x: 8,
      y: 8,
      width: 48,
      height: 9,
      color: '#00E676',
      bgColor: 'rgba(0, 230, 118, 0.18)',
      borderColor: 'rgba(0, 230, 118, 0.4)',
      borderWidth: 1,
      borderRadius: 100,
      fontSize: 11,
      fontWeight: 800,
      fontFamily: 'Inter',
      zIndex: 10,
      visible: true
    },
    {
      id: 'el_headline',
      type: 'text',
      content: 'Your headline goes here',
      x: 8,
      y: 60,
      width: 84,
      height: 15,
      color: '#ffffff',
      fontSize: 22,
      fontWeight: 800,
      fontFamily: 'Inter',
      zIndex: 12,
      visible: true
    },
    {
      id: 'el_body',
      type: 'text',
      content: 'Your supporting line goes here.',
      x: 8,
      y: 75,
      width: 84,
      height: 10,
      color: 'rgba(255, 255, 255, 0.85)',
      fontSize: 13,
      fontWeight: 400,
      fontFamily: 'Inter',
      zIndex: 12,
      visible: true
    },
    {
      id: 'el_button',
      type: 'button',
      content: 'Your CTA →',
      x: 8,
      y: 86,
      width: 45,
      height: 9,
      color: '#000000',
      bgColor: '#00E676',
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 800,
      fontFamily: 'Inter',
      zIndex: 15,
      visible: true
    }
  ]);

  const [selectedElementId, setSelectedElementId] = useState<string | null>('el_headline');
  const [editorSidebarTab, setEditorSidebarTab] = useState<'ai' | 'text' | 'elements' | 'uploads' | 'layers'>('ai');
  const [canvasAspectRatio, setCanvasAspectRatio] = useState<'1:1' | '9:16' | '4:5' | '16:9'>('1:1');
  const [editorZoom, setEditorZoom] = useState<number>(100);
  // Creative frameworks, from GET /api/creative/templates. Previously four hardcoded
  // entries carrying invented CTRs ("3.4% Avg CTR") that nothing in the schema tracks, and
  // descriptions naming another brand's products regardless of whose workspace was open.
  const [frameworks, setFrameworks] = useState<{ key: string; name: string; desc: string }[]>([]);
  const [templatesNote, setTemplatesNote] = useState<string>('');

  useEffect(() => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    fetch(`/api/creative/templates?workspace_id=${workspaceId}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return;
        setFrameworks(Array.isArray(d.frameworks) ? d.frameworks : []);
        setTemplatesNote(d.note || '');
      })
      .catch(() => {});
  }, [workspaceId]);

  const [aiPromptInstruction, setAiPromptInstruction] = useState<string>('');
  const [isProcessingStudioAi, setIsProcessingStudioAi] = useState<boolean>(false);
  // Named for this workspace once its brand profile loads, rather than opening every
  // brand's editor on "Ambrane Powerbank — 1:1 Festive Campaign".
  const [editorDocumentTitle, setEditorDocumentTitle] = useState<string>('Untitled design');

  useEffect(() => {
    // Only while it is still the untouched default, so a title the user typed is never
    // overwritten when the brand profile arrives a moment later.
    if (brandName) setEditorDocumentTitle(t => (t === 'Untitled design' ? `${brandName} — Untitled design` : t));
  }, [brandName]);

  // Canvas Interactive Mouse Drag State & Handlers
  const [isDraggingCanvasEl, setIsDraggingCanvasEl] = useState<boolean>(false);
  const [draggedElId, setDraggedElId] = useState<string | null>(null);
  const canvasChassisRef = useRef<HTMLDivElement>(null);

  const handleCanvasMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedElementId(id);
    if (id !== 'el_bg') {
      setDraggedElId(id);
      setIsDraggingCanvasEl(true);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCanvasEl || !draggedElId || !canvasChassisRef.current) return;
    const rect = canvasChassisRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;

    const pctX = Math.max(0, Math.min(85, Math.round((rawX / rect.width) * 100)));
    const pctY = Math.max(0, Math.min(85, Math.round((rawY / rect.height) * 100)));

    setEditorCanvasElements(prev => prev.map(el => el.id === draggedElId ? { ...el, x: pctX, y: pctY } : el));
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingCanvasEl(false);
    setDraggedElId(null);
  };

  /** Persists the canvas to the workspace's ad assets.
   *
   *  Both save buttons used to push into local React state only - so "Saved to Verified Ad
   *  Library & Vault 🏛️" was a claim about a row that never existed, and the design was
   *  gone on refresh. They also substituted another brand's copy when a canvas element was
   *  missing ("Unstoppable Power in Your Pocket ⚡", "#Ambrane"), which then read as this
   *  workspace's own ad. Now it writes through POST /creatives/save and reports honestly.
   */
  const persistEditorDesign = async (status: 'approved' | 'pending_review') => {
    const bgEl = editorCanvasElements.find(el => el.id === 'el_bg') || editorCanvasElements.find(el => el.type === 'image');
    const headEl = editorCanvasElements.find(el => el.id === 'el_headline') || editorCanvasElements.find(el => el.type === 'text');
    const bodyEl = editorCanvasElements.find(el => el.id === 'el_body');
    const ctaEl = editorCanvasElements.find(el => el.type === 'button');

    const headline = (headEl?.content || '').trim();
    if (!headline) {
      triggerToast('Add a headline to the canvas before saving.');
      return;
    }
    if (!workspaceId) {
      triggerToast('Open a workspace before saving.');
      return;
    }

    const label = status === 'approved' ? 'Ad Library' : 'Drafts';
    setIsSavingDesign(true);
    triggerToast('Rendering your design…');
    try {
      /* The rendered canvas IS the creative. Falling back to the raw background URL keeps a
         picture on the row when the canvas cannot be rasterised, rather than saving nothing.

         Saved at half size as JPEG, not the 4K PNG the download produces: image_url is a
         text column and a 4K PNG lands in Postgres as several megabytes of base64 on every
         click. The Download button still exports at full resolution. */
      const rendered = await renderCanvasToDataUrl(0.5, 'image/jpeg');

      const token = localStorage.getItem('token');
      const res = await fetch(`/api/workspaces/${workspaceId}/creatives/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          headline,
          body_text: (bodyEl?.content || '').trim(),
          cta: (ctaEl?.content || '').trim(),
          type: editorDocumentTitle?.trim() || 'Studio design',
          image_url: rendered || bgEl?.content || null,
          status,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || `Save failed (${res.status})`);
      }
      const saved = await res.json();
      // Hand it to the dashboard so Recent Projects, the Ad Library and the Asset Vault all
      // see the same row without a reload - this is the "sync with the rest of the
      // platform" part.
      onAssetSaved?.({
        id: String(saved.id),
        headline: saved.headline,
        bodyText: saved.body_text,
        cta: saved.cta,
        type: saved.type,
        imageUrl: saved.image_url,
        status: saved.status,
      } as CreativeAsset);
      triggerToast(`Saved to ${label}.`);
    } catch (e) {
      triggerToast(`Could not save: ${e instanceof Error ? e.message : e}`);
    } finally {
      setIsSavingDesign(false);
    }
  };

  const handleSaveAsDraft = () => persistEditorDesign('pending_review');
  const handleSaveToVault = () => persistEditorDesign('approved');

  /** Saves the Carousel tab's own cards.
   *
   *  Both save buttons in that tab called persistEditorDesign, which reads
   *  `editorCanvasElements` — the IMAGE editor's canvas. So saving from the Carousel tab
   *  silently stored the image editor's placeholder text and none of the carousel: the
   *  user's cards were never persisted anywhere. A carousel is several creatives, and
   *  AdAsset is one row per creative, so each card becomes its own row.
   */
  const persistCarousel = async (status: 'approved' | 'pending_review') => {
    if (!workspaceId) { triggerToast('Open a workspace before saving.'); return; }
    const filled = carouselCards.filter(c => (c.headline || '').trim());
    if (!filled.length) {
      triggerToast('Add a headline to at least one card before saving.');
      return;
    }

    const label = status === 'approved' ? 'Ad Library' : 'Drafts';
    setIsSavingDesign(true);
    const token = localStorage.getItem('token');
    let saved = 0;
    try {
      for (let i = 0; i < filled.length; i++) {
        const card = filled[i];
        const res = await fetch(`/api/workspaces/${workspaceId}/creatives/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            headline: card.headline.trim(),
            body_text: (card.description || '').trim(),
            cta: (card.ctaAction || '').replace('_', ' '),
            type: `Carousel Ad — card ${i + 1} of ${filled.length}`,
            image_url: card.imageUrl || null,
            status,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.detail || `Save failed on card ${i + 1} (${res.status})`);
        }
        const row = await res.json();
        onAssetSaved?.({
          id: String(row.id), headline: row.headline, bodyText: row.body_text,
          cta: row.cta, type: row.type, imageUrl: row.image_url, status: row.status,
        } as CreativeAsset);
        saved++;
      }
      triggerToast(`Saved ${saved} carousel card${saved === 1 ? '' : 's'} to ${label}.`);
    } catch (e) {
      triggerToast(`${saved} card(s) saved, then: ${e instanceof Error ? e.message : e}`);
    } finally {
      setIsSavingDesign(false);
    }
  };

  /** Saves the Video tab's storyboard.
   *
   *  Same defect as the carousel: these buttons were persisting the image editor's canvas.
   *  A storyboard has no rendered video until the reel is generated, so what is saved is the
   *  script — the scene overlays in order — which is the work the user actually did here.
   */
  const persistStoryboard = async (status: 'approved' | 'pending_review') => {
    if (!workspaceId) { triggerToast('Open a workspace before saving.'); return; }
    const written = videoScenes.filter(s => (s.overlayText || '').trim());
    if (!written.length) {
      triggerToast('Write at least one scene overlay before saving.');
      return;
    }

    const label = status === 'approved' ? 'Ad Library' : 'Drafts';
    setIsSavingDesign(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/workspaces/${workspaceId}/creatives/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          headline: written[0].overlayText.trim().slice(0, 255),
          body_text: written.map((s, i) => `${i + 1}. [${s.duration}] ${s.overlayText.trim()}`).join('\n'),
          cta: '',
          type: `Video storyboard — ${written.length} scene${written.length === 1 ? '' : 's'}`,
          // The first scene that actually has footage stands in as the thumbnail.
          image_url: videoScenes.find(s => s.videoUrl)?.videoUrl || null,
          status,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || `Save failed (${res.status})`);
      }
      const row = await res.json();
      onAssetSaved?.({
        id: String(row.id), headline: row.headline, bodyText: row.body_text,
        cta: row.cta, type: row.type, imageUrl: row.image_url, status: row.status,
      } as CreativeAsset);
      triggerToast(`Storyboard saved to ${label}.`);
    } catch (e) {
      triggerToast(`Could not save: ${e instanceof Error ? e.message : e}`);
    } finally {
      setIsSavingDesign(false);
    }
  };

  /** Draws the editor canvas and resolves a PNG data URL.
   *
   *  Extracted from the 4K export so that Save can persist the design too. Saving used to
   *  send four text fields and `el_bg`'s URL, which meant everything the user actually did
   *  in the editor - the layout, the badges, the colours, the type - was thrown away, and
   *  an untouched canvas saved a row with no image at all. Whatever the export draws is now
   *  what the Ad Library stores.
   *
   *  Resolves null rather than throwing: a cross-origin background without CORS headers
   *  taints the canvas and makes toDataURL raise, and losing the copy as well as the raster
   *  would be worse than saving the copy alone.
   */
  const renderCanvasToDataUrl = (scale = 1, mime: 'image/png' | 'image/jpeg' = 'image/png'): Promise<string | null> => new Promise(resolve => {
    try {
      const baseW = canvasAspectRatio === '1:1' ? 2160 : canvasAspectRatio === '9:16' ? 2160 : canvasAspectRatio === '4:5' ? 2160 : 3840;
      const baseH = canvasAspectRatio === '1:1' ? 2160 : canvasAspectRatio === '9:16' ? 3840 : canvasAspectRatio === '4:5' ? 2700 : 2160;
      const canvasWidth = Math.round(baseW * scale);
      const canvasHeight = Math.round(baseH * scale);

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvasWidth;
      exportCanvas.height = canvasHeight;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return resolve(null);

      ctx.fillStyle = '#06060c';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      const sortedEls = editorCanvasElements
        .filter(el => el.visible !== false)
        .slice()
        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
      const imageEls = sortedEls.filter(el => el.type === 'image' && el.content);
      let loaded = 0;

      const paintTextAndFinish = () => {
        sortedEls.forEach(el => {
          const posX = (el.x / 100) * canvasWidth;
          const posY = (el.y / 100) * canvasHeight;

          // Type metrics were tuned against the full-size canvas, so they scale with it —
          // otherwise a half-size render comes out with double-size lettering.
          const k = 3.5 * scale;

          if (el.type === 'badge' || el.type === 'button') {
            ctx.fillStyle = el.bgColor || '#00E676';
            const boxW = (el.width / 100) * canvasWidth || 450 * scale;
            const boxH = 95 * scale;
            ctx.fillRect(posX, posY, boxW, boxH);

            if (el.borderColor && el.borderWidth) {
              ctx.strokeStyle = el.borderColor;
              ctx.lineWidth = (el.borderWidth || 1) * 3 * scale;
              ctx.strokeRect(posX, posY, boxW, boxH);
            }

            ctx.fillStyle = el.color || '#000000';
            ctx.font = `bold ${(el.fontSize || 13) * k}px Inter, sans-serif`;
            ctx.fillText(el.content, posX + 30 * scale, posY + 62 * scale);
          } else if (el.type === 'text') {
            ctx.fillStyle = el.color || '#ffffff';
            ctx.font = `${el.fontWeight || 700} ${(el.fontSize || 18) * k}px ${el.fontFamily || 'Inter'}, sans-serif`;
            ctx.fillText(el.content, posX, posY + 65 * scale);
          }
        });

        try {
          resolve(mime === 'image/jpeg'
            ? exportCanvas.toDataURL('image/jpeg', 0.86)
            : exportCanvas.toDataURL('image/png'));
        } catch {
          resolve(null);   // tainted by a cross-origin image
        }
      };

      if (imageEls.length === 0) return paintTextAndFinish();

      imageEls.forEach(el => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const done = () => { loaded++; if (loaded >= imageEls.length) paintTextAndFinish(); };
        img.onload = () => {
          ctx.drawImage(img,
            (el.x / 100) * canvasWidth, (el.y / 100) * canvasHeight,
            (el.width / 100) * canvasWidth, ((el.height || 100) / 100) * canvasHeight);
          done();
        };
        img.onerror = done;
        img.src = el.content;
      });
    } catch {
      resolve(null);
    }
  });

  // Export active Canvas to 4K PNG file download
  const handleExport4KPng = async () => {
    const dataUrl = await renderCanvasToDataUrl();
    if (!dataUrl) {
      // Was "Exported 4K High-Res PNG Ad file! 🎨" on every failure path, so a failed
      // export was announced as a success and no file appeared.
      triggerToast('Could not export the canvas — a background image blocked it.');
      return;
    }
    const link = document.createElement('a');
    link.download = `Raftra_4K_Ad_${Date.now()}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('Downloaded 4K High-Res PNG Ad file to your computer! 🚀');
  };

  // Step 2 Input Method
  const [inputOption, setInputOption] = useState<'brand_kb' | 'upload_image' | 'ai_generate_image'>('brand_kb');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [productPrompt, setProductPrompt] = useState('');
  /* The reference image the backend is actually given. It has to be a URL the server can
     fetch: `uploadedImage` above is a `blob:` handle that only resolves inside this browser
     tab, so an uploaded product photo used to be shown as "uploaded" and then dropped. */
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [uploadingReference, setUploadingReference] = useState(false);

  // "Use in Creative Studio" in the Media vault lands here: the asset becomes the reference
  // image the generator is given, which is what that button always claimed to do.
  useEffect(() => {
    if (incomingReferenceImage) {
      setReferenceImageUrl(incomingReferenceImage);
      setUploadedImage(incomingReferenceImage);
    }
  }, [incomingReferenceImage]);

  // Step 3 Ad Type & Settings
  const [selectedAdType, setSelectedAdType] = useState<'Image' | 'Video' | 'Carousel'>('Image');
  const [platform, setPlatform] = useState<'Instagram' | 'Facebook' | 'Google' | 'Amazon' | 'Flipkart'>('Instagram');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '9:16' | '4:5' | '16:9'>('1:1');
  // `aiModel` and `videoVoice` lived here and were never read by anything — see the note on
  // the removed selectors in Step 3. Duration is passed to the generator.
  const [videoDuration, setVideoDuration] = useState<'15s' | '30s' | '60s'>('15s');

  // Interactive Custom Ad Editor State
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [isApplyingInstruction, setIsApplyingInstruction] = useState(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  // Disables the save buttons while a save is in flight, so a slow render cannot be
  // double-submitted into two rows.
  const [isSavingDesign, setIsSavingDesign] = useState(false);

  // Generation & Output State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationElapsed, setGenerationElapsed] = useState(0);
  // Asset ids present when Generate was pressed, so the one that arrives afterwards can be
  // recognised as this run's output.
  const generationBaseline = useRef<Set<string>>(new Set());
  // True only when Generate was pressed in this session, so the WebSocket-adoption effect
  // below can tell a fresh run from one resumed after a page refresh.
  const generationStartedHere = useRef(false);
  // Backend id of the ad currently on screen. Variations are asked for by creative id, so
  // only an ad that came from a real run can be varied.
  const [generatedCreativeId, setGeneratedCreativeId] = useState<number | null>(null);
  const [generatedAdImageFailed, setGeneratedAdImageFailed] = useState(false);
  const [generatedAd, setGeneratedAd] = useState<{
    id: string;
    headline: string;
    bodyText: string;
    cta: string;
    description: string;
    hashtags: string;
    imageUrl: string;
    /** The rendered video, when the run produced one.
     *
     *  There was no such field. A video generation returns BOTH a still and a video, and
     *  the preview stored `image_url || video_url` into `imageUrl` and drew it in an <img>
     *  — so the video was thrown away, and on the runs where only a video came back the
     *  <img> failed to load and the panel reported "The generated image could not be
     *  loaded". Either way there was no way to play a generated video ad. */
    videoUrl: string;
    type: string;
    platform: string;
    aspectRatio: string;
    cards?: { title: string; desc: string; img: string }[];
  } | null>(null);

  /* Competitor Intelligence.
     The tab was pinned to three hardcoded rivals (Boat / Noise / Realme) and showed three
     invented ads per rival carrying "4.8x ROAS", "₹14.2L Spend" and "5.2% CTR" - none of
     which is public for anyone else's ads, and none of which this schema stores. It read
     as measured competitive intelligence and was fabricated.

     The real vault is /competitor-ads: ads the Meta Ad Library actually returns, ordered
     by days_active, which is the genuine signal - the longest-running ad is the one a
     rival keeps paying for. */
  interface CompetitorAd {
    id: number;
    title: string;
    copy: string;
    snapshot_url: string;
    platforms: string[];
    offers: Record<string, unknown>;
    days_active: number | null;
    country: string | null;
    source: string | null;
  }
  interface CompetitorGroup {
    competitor: string;
    ads: CompetitorAd[];
    strategy?: { summary?: string; hooks?: string[]; ctas?: string[] } | null;
  }

  /* The creator shortlist under "Hire Human Creator".
     It was three invented people (Priya Sharma / Aarav Mehta / Neha Kapoor) with invented
     rates, follower counts, ratings and stock headshots, sitting under a "500+ verified
     creators" line and a Hire button. The marketplace those cards claimed to preview is the
     Influencer tab, which reads /influencers - so this reads the same roster. */
  interface MarketplaceCreator {
    id: number;
    name: string;
    handle?: string | null;
    platform?: string | null;
    niche?: string | null;
    base_rate?: number | null;
    fit_score?: number | null;
    status?: string | null;
  }
  const [marketCreators, setMarketCreators] = useState<MarketplaceCreator[]>([]);
  const [marketCreatorsLoading, setMarketCreatorsLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) { setMarketCreatorsLoading(false); return; }
    let cancelled = false;
    const token = localStorage.getItem('token');
    fetch(`/api/workspaces/${workspaceId}/influencers`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (!cancelled) setMarketCreators(Array.isArray(d) ? d : []); })
      .catch(() => { /* the shortlist shows its empty state */ })
      .finally(() => { if (!cancelled) setMarketCreatorsLoading(false); });
    return () => { cancelled = true; };
  }, [workspaceId]);

  /* The editor's media panel reads this workspace's own Asset Vault - the images onboarding
     harvested from the brand's website plus anything imported - instead of the four stock
     photos ("Neon Cyberpunk", "Minimal Marble") it used to offer as backdrops. This is the
     "editor should sync with the rest of the platform" part: the same rows the Assets tab
     shows, applied straight onto the canvas. */
  const [vaultImages, setVaultImages] = useState<{ url: string; name: string }[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    const token = localStorage.getItem('token');
    fetch(`/api/workspaces/${workspaceId}/assets`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled) return;
        const rows = Array.isArray(d?.assets) ? d.assets : [];
        setVaultImages(rows
          .filter((a: any) => a?.url && !String(a.format || '').match(/mp4|webm|mov/i))
          .map((a: any) => ({ url: a.url, name: a.alt_text || a.filename || 'Asset' })));
      })
      .catch(() => { /* the panel shows its empty state */ });
    return () => { cancelled = true; };
  }, [workspaceId]);

  const [adVault, setAdVault] = useState<CompetitorGroup[]>([]);
  const [adVaultLoading, setAdVaultLoading] = useState(true);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>('');

  useEffect(() => {
    if (!workspaceId) { setAdVaultLoading(false); return; }
    let cancelled = false;
    const token = localStorage.getItem('token');
    fetch(`/api/workspaces/${workspaceId}/competitor-ads`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled) return;
        const groups: CompetitorGroup[] = Array.isArray(d?.competitors) ? d.competitors
          : Array.isArray(d) ? d : [];
        setAdVault(groups);
        setSelectedCompetitor(prev => prev || groups[0]?.competitor || '');
      })
      .catch(() => { /* the tab shows its empty state */ })
      .finally(() => { if (!cancelled) setAdVaultLoading(false); });
    return () => { cancelled = true; };
  }, [workspaceId]);

  const activeCompetitorAds =
    adVault.find(g => g.competitor === selectedCompetitor)?.ads ?? [];

  /* The hooks / headlines / offers vault, derived from those same synced ads.

     Every row here used to be invented copy about a powerbank carrying an invented return
     ("4.6x ROAS", "5.2x ROAS"). Nobody publishes a rival's return on ad spend and this
     schema has no column for it, so those numbers could only ever have been made up. What
     the Ad Library does give is the ad's own words and how long the rival has kept paying
     to run them - which is the signal a strategist actually reads. */
  const vaultRows = useMemo(() => {
    const all = adVault.flatMap(g => g.ads.map(a => ({ ...a, competitor: g.competitor })));
    const byRun = [...all].sort((a, b) => (b.days_active ?? 0) - (a.days_active ?? 0));

    const runLabel = (d: number | null | undefined) =>
      d === null || d === undefined ? 'run time not reported'
        : d >= 45 ? `${d} days live · evergreen`
        : `${d} days live`;

    // The same ad runs across placements and rivals re-upload near-identical copy; showing
    // it four times would pad the vault without adding an angle.
    const dedupe = (rows: { text: string; tag: string; meta: string }[]) => {
      const seen = new Set<string>();
      return rows.filter(r => {
        const k = r.text.trim().toLowerCase();
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      }).slice(0, 8);
    };

    // A hook is the ad's opening line — the part that has to survive the scroll.
    const hooks = dedupe(byRun.map(a => ({
      text: ((a.copy || '').split(/\n|(?<=[.!?])\s/)[0] || '').trim(),
      tag: a.competitor,
      meta: runLabel(a.days_active),
    })).filter(r => r.text.length > 15));

    const headlines = dedupe(byRun.map(a => ({
      text: (a.title || '').trim(),
      tag: a.competitor,
      meta: runLabel(a.days_active),
    })).filter(r => r.text.length > 3));

    /* Offers rather than CTAs. The Ad Library returns an ad's creative, not the CTA button
       it renders, so a list of rivals' CTAs could only be fabricated. The offer terms are
       parsed out of the copy itself and are the thing a brand has to answer in market. */
    const offers = dedupe(byRun.flatMap(a => {
      const o = (a.offers || {}) as {
        code?: string; percent_off?: number | null; flat_off?: number | null; perks?: string[];
      };
      const bits: string[] = [];
      if (o.percent_off) bits.push(`${o.percent_off}% off`);
      if (o.flat_off) bits.push(`₹${o.flat_off} off`);
      if (o.code) bits.push(`code ${o.code}`);
      (o.perks || []).forEach(perk => bits.push(`free ${perk}`));
      return bits.length
        ? [{ text: bits.join('  +  '), tag: a.competitor, meta: runLabel(a.days_active) }]
        : [];
    }));

    return { hooks, headlines, offers };
  }, [adVault]);

  // Live competitor research. There is no lawful feed of a rival's commercial ads - Meta's Ad
  // Library API only returns political and social-issue ads outside the EU, and Google's
  // Transparency Center has no API - so this reads what is genuinely public: the competitor's
  // own site plus search results, extracted into positioning, offers, hooks and CTAs, with
  // the sources returned so every claim can be checked.
  const [competitorQuery, setCompetitorQuery] = useState('');
  const [competitorLoading, setCompetitorLoading] = useState(false);
  const [competitorError, setCompetitorError] = useState<string | null>(null);
  const [competitorResult, setCompetitorResult] = useState<any | null>(null);

  const researchCompetitor = async () => {
    const name = competitorQuery.trim();
    if (!name || !workspaceId || competitorLoading) return;
    setCompetitorLoading(true);
    setCompetitorError(null);
    setCompetitorResult(null);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/competitors/analyze`, {
        method: 'POST',
        headers: token
          ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
          : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitor: name }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.detail) || `Research failed (${res.status})`);
      setCompetitorResult(data);
    } catch (err: any) {
      setCompetitorError(err?.message || 'Could not reach the research service.');
    } finally {
      setCompetitorLoading(false);
    }
  };
  const [vaultSubTab, setVaultSubTab] = useState<'hooks' | 'headlines' | 'ctas'>('hooks');

  // Projects Modal State
  // Seeded demo ads. These are the empty state - what the studio shows a workspace that has
  // not generated anything yet - and are replaced by real assets as soon as any exist.
  // Was seeded with four invented ads ("Ambrane Powerbank Festive Carousel", Unsplash
  // photography, headlines and hashtags for a brand that may not be this one). They only
  // showed when a workspace had no real assets - which is exactly when a user is deciding
  // whether the product works, so the emptiest workspace got the most convincing fiction.
  // Now genuinely empty, and the locally-created drafts below still push into it.
  const [projectsList, setProjectsList] = useState<ProjectCard[]>([]);
  const [selectedProjectModal, setSelectedProjectModal] = useState<ProjectCard | null>(null);

  // This workspace's actual generated ads, shaped for the same grids. `assets` was being
  // passed in and ignored, so the Projects and Ad Library tabs showed the three seeded demo
  // ads to every workspace - including ones with dozens of real generated assets sitting in
  // the database. Real assets win when there are any; the demo set remains the empty state.
  const realProjects: ProjectCard[] = assets.map(a => ({
    id: a.id,
    title: a.headline || 'Generated ad',
    date: a.type || 'Generated',
    status: a.status === 'approved' ? 'Approved' : a.status === 'rejected' ? 'Draft' : 'In Review',
    img: a.imageUrl || '',
    headline: a.headline || '',
    bodyText: a.bodyText || '',
    cta: a.cta || '',
    hashtags: '',
    real: true,
  }));
  // Real assets first, then anything drafted in this session. No fixture fallback.
  const displayProjects: ProjectCard[] = [...realProjects, ...projectsList];

  // UGC State & Realistic Generation Flow
  const [ugcSubTab, setUgcSubTab] = useState<'ai_ugc' | 'hire_human'>('ai_ugc');
  /* The reel generator.

     It used to offer three named AI presenters ("Aarav, Tech Reviewer, Male 24") and three
     synthesised voices, run a 2.6-second scripted progress bar through "Rendering 9:16
     Lipsync & Face Expression Animation", and then display an unrelated video already in
     the workspace as the result. There is no avatar or text-to-speech provider anywhere in
     the backend, so none of that could happen - but there IS a real video pipeline
     (/api/creative/generate with type=video), and that is what this now runs. A presenter on
     camera is what the Hire Creator tab beside it is for. */
  const [ugcScript, setUgcScript] = useState('');
  const [isGeneratingUgc, setIsGeneratingUgc] = useState(false);
  const [ugcStepText, setUgcStepText] = useState('');
  const [ugcProgress, setUgcProgress] = useState(0);
  const [ugcError, setUgcError] = useState<string | null>(null);
  const [ugcLength, setUgcLength] = useState('15s');
  const [ugcPlatform, setUgcPlatform] = useState<'Instagram' | 'Facebook' | 'Google'>('Instagram');
  const ugcVideoRef = useRef<HTMLVideoElement>(null);
  const [isUgcPlaying, setIsUgcPlaying] = useState(false);
  const [ugcVideoFailed, setUgcVideoFailed] = useState(false);
  const [generatedUgcReel, setGeneratedUgcReel] = useState<{
    id: string;
    // What the pipeline actually returned for this run. `posterUrl` is the provider's own
    // still for the render, not a stock portrait of an invented presenter.
    videoUrl: string;
    posterUrl: string;
    script: string;
    platform: string;
    length: string;
    status: string;
  } | null>(null);

  /* Multi-Card Carousel Ad Builder.
     The three cards were seeded with another company's product claims ("20000mAh Powerbank
     @ ₹1,499", "4.9/5 Rating by 45,000+ Buyers") and, worse, with live
     https://ambrane.com/... destination URLs - so a carousel built here and published sent
     the brand's own ad spend to a third party's website. The cards now open as empty
     scaffolds, and their destination defaults to this workspace's own site. */
  const [carouselCards, setCarouselCards] = useState([
    { id: 'c1', title: 'Card 1: Hook Cover', headline: '', description: '', destinationUrl: '', ctaAction: 'SHOP_NOW', imageUrl: '' },
    { id: 'c2', title: 'Card 2: Feature Showcase', headline: '', description: '', destinationUrl: '', ctaAction: 'SHOP_NOW', imageUrl: '' },
    { id: 'c3', title: 'Card 3: Proof & Offer', headline: '', description: '', destinationUrl: '', ctaAction: 'GET_OFFER', imageUrl: '' }
  ]);

  useEffect(() => {
    const site = brandProfile?.url || brandUrl;
    if (!site) return;
    const withProtocol = /^https?:\/\//.test(site) ? site : `https://${site}`;
    // Only fills a card whose destination is still blank; anything typed is left alone.
    setCarouselCards(prev => prev.map(c => (c.destinationUrl ? c : { ...c, destinationUrl: withProtocol })));
  }, [brandProfile?.url, brandUrl]);
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);

  /* Video Storyboard & Timeline Editor.
     The four scenes carried finished copy for a powerbank ad ("Switch to Ambrane 22.5W
     Ultra-Fast Powerbank!", "Claim 30% Diwali Discount Today") over stock clips of a phone,
     so every brand's storyboard opened as somebody else's ad. What is genuinely reusable is
     the four-beat structure, so that is all that is seeded; the copy is the user's. */
  const [videoScenes, setVideoScenes] = useState([
    { id: 'scene_1', name: 'Scene 1: Visual Hook (0-3s)', overlayText: '', videoUrl: '', duration: '3s' },
    { id: 'scene_2', name: 'Scene 2: Problem / Pain Point (3-7s)', overlayText: '', videoUrl: '', duration: '4s' },
    { id: 'scene_3', name: 'Scene 3: Solution Showcase (7-12s)', overlayText: '', videoUrl: '', duration: '5s' },
    { id: 'scene_4', name: 'Scene 4: Call To Action (12-15s)', overlayText: '', videoUrl: '', duration: '3s' }
  ]);
  const [activeVideoSceneIndex, setActiveVideoSceneIndex] = useState(0);
  const [videoSubtitleStyle, setVideoSubtitleStyle] = useState<'viral_yellow' | 'capsule_white' | 'minimal'>('viral_yellow');
  const [videoAudioTrack, setVideoAudioTrack] = useState('Upbeat Tech Bass (128 BPM)');
  const [isPlayingVideoPreview, setIsPlayingVideoPreview] = useState(false);
  const [masterSection, setMasterSection] = useState<'create_intel' | 'editing' | 'services'>('create_intel');
  const [intelSubTab, setIntelSubTab] = useState<'create' | 'projects' | 'competitors' | 'templates'>('create');
  const [editingSubTab, setEditingSubTab] = useState<'image' | 'carousel' | 'video'>('image');

  const triggerToast = (msg: string) => {
    setCopyToast(msg);
    setTimeout(() => setCopyToast(null), 3500);
  };

  const handleOpenCanva = (designType: string) => {
    let url = 'https://www.canva.com/templates/?query=facebook-ad-banner';
    if (designType.toLowerCase().includes('carousel')) {
      url = 'https://www.canva.com/templates/?query=instagram-carousel-ad';
    } else if (designType.toLowerCase().includes('video') || designType.toLowerCase().includes('reel')) {
      url = 'https://www.canva.com/templates/?query=instagram-reel-ad';
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    triggerToast(`Opened ${designType} Canva Ad Templates! Syncing Raftra design assets... 🎨`);
  };

  const handleOpenFigma = (designType: string) => {
    let url = 'https://www.figma.com/community/file/1089201509930773665';
    if (designType.toLowerCase().includes('carousel')) {
      url = 'https://www.figma.com/community/file/1154562098438491873';
    } else if (designType.toLowerCase().includes('video') || designType.toLowerCase().includes('reel')) {
      url = 'https://www.figma.com/community/file/1187428389230198421';
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    triggerToast(`Opened ${designType} Figma Community File! Syncing Raftra design frames... ❖`);
  };

  // File Upload Handler
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Getting a picture onto a carousel card.
     ------------------------------------------------------------------
     The card editor offered one control for this: a bare "CARD IMAGE GRAPHIC URL" text box.
     Nothing in the product produces a URL to paste into it, so in practice no card ever got
     an image and every preview read "No image on this card yet" — which is most of why this
     builder felt broken. The three real sources of a picture are the workspace's own Asset
     Vault, an ad it has already generated, and the user's disk; all three are wired here. */
  const carouselFileRef = useRef<HTMLInputElement>(null);
  const [uploadingCardImage, setUploadingCardImage] = useState(false);

  const setActiveCardImage = (url: string) => {
    setCarouselCards(prev => prev.map((c, i) => (i === activeCarouselIndex ? { ...c, imageUrl: url } : c)));
  };

  const handleCarouselImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';                       // so the same file can be picked again
    if (!file) return;
    setUploadingCardImage(true);
    const token = localStorage.getItem('token');
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) throw new Error((data && data.detail) || `Upload failed (${res.status})`);
      // The stored URL, never a blob: handle — a card is published to Meta, and an object
      // URL resolves nowhere outside this tab.
      setActiveCardImage(data.url);
      triggerToast('Image added to this card.');
    } catch (err: any) {
      triggerToast(err?.message || 'Could not upload that image.');
    } finally {
      setUploadingCardImage(false);
    }
  };
  /* Upload the product photo to the server, not just into this tab.
     `URL.createObjectURL` returns a `blob:` handle that resolves nowhere outside this
     browser, so the photo was shown as "Product Image Uploaded" and then silently dropped:
     nothing was sent with the generation request. /api/media/upload is the real store, and
     the URL it returns is what the generator is handed as its reference image. */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadedImage(url);
      setReferenceImageUrl(null);
      setUploadingReference(true);

      const token = localStorage.getItem('token');
      const form = new FormData();
      form.append('file', file);
      try {
        const res = await fetch('/api/media/upload', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: form,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.url) {
          throw new Error((data && data.detail) || `Upload failed (${res.status})`);
        }
        setReferenceImageUrl(data.url);
      } catch (err: any) {
        // Say so rather than leaving a photo on screen that the generator will never see.
        triggerToast(err?.message || 'Could not upload that photo — generation will run without it.');
      } finally {
        setUploadingReference(false);
      }

      const newImgId = `el_img_${Date.now()}`;
      setEditorCanvasElements(prev => [
        ...prev,
        {
          id: newImgId,
          type: 'image',
          content: url,
          x: 20,
          y: 20,
          width: 50,
          height: 50,
          zIndex: 14,
          visible: true
        }
      ]);
      setSelectedElementId(newImgId);
      triggerToast('Uploaded photo added to Canva/Figma canvas as new media layer! 🖼️');
    }
  };

  // Generate Ad Action.
  //
  // This used to fabricate its own result: a scripted 1.8s progress bar (20% -> 50% -> 85%)
  // followed by a fixed Ambrane powerbank ad with a stock photo - identical no matter what
  // was typed - and only then did it fire the real generation, whose output was never shown.
  // The seeded demo ads still have a job (they are the empty state for the Projects and Ad
  // Library tabs), but once someone enters their own brief, what comes back has to be theirs.
  //
  // The real asset arrives asynchronously: the backend renders it, writes the row, and
  // broadcasts it over the WebSocket, which lands in `assets` via the dashboard. The effects
  // below wait for that instead of inventing a placeholder.
  const handleGenerateAd = async () => {
    if (isGenerating) return;
    if (!onGenerate) {
      setGenerationError('Generation is not connected in this view.');
      return;
    }
    generationBaseline.current = new Set(assets.map(a => a.id));
    generationStartedHere.current = true;
    setGenerationError(null);
    setGeneratedAd(null);
    setGeneratedAdImageFailed(false);
    setGenerationElapsed(0);
    setIsGenerating(true);

    const job = await Promise.resolve(onGenerate(productPrompt || 'Brand Knowledge Generation', undefined, {
      // Pass what the user actually chose. The old call sent the prompt alone, so the format,
      // platform and ratio selectors above had no effect on what the backend produced.
      format: selectedAdType,
      platform,
      ratio: aspectRatio,
      reference_image: referenceImageUrl || undefined,
      // The backend already honours this (service.plan -> spec.video.duration); the
      // selector just was not being passed, so every video rendered at the default length
      // whatever the user picked.
      length: videoDuration,
    })).catch(() => null);

    // A creative_id is the reliable way to follow the run: /api/creative/jobs reports
    // processing, completed or failed and carries the provider's own error message. Without
    // one (the older fallback route) we wait for the asset to arrive over the WebSocket
    // instead, which the effect below handles.
    if (!job || !job.creative_id || !workspaceId) return;

    // Remember it immediately, not on completion: a render takes 20-90s, and a refresh in
    // the middle used to throw the whole run away even though the backend kept going.
    rememberCreative(workspaceId, job.creative_id);
    await followCreativeJob(job.creative_id, workspaceId);
  };

  /* Surviving a refresh.
     ------------------------------------------------------------------
     `generatedAd` was local state and nothing else, so reloading the page lost the creative
     you were looking at — you had to generate again to see anything, which made the studio
     impossible to test or to come back to. The row was in the database the whole time; the
     screen just had no way to find it again.

     The id of the last creative is kept per workspace, and on mount it is fetched back from
     /api/creative/jobs. If it is still rendering, polling picks up where it left off. */
  const lastCreativeKey = (ws: number) => `raftra_last_creative_ws${ws}`;

  const rememberCreative = (ws: number, creativeId: number) => {
    try { localStorage.setItem(lastCreativeKey(ws), String(creativeId)); } catch { /* private mode */ }
  };

  const forgetCreative = (ws: number) => {
    try { localStorage.removeItem(lastCreativeKey(ws)); } catch { /* private mode */ }
  };

  /** Puts a finished job on screen. */
  const adoptCreativeJob = (d: any) => {
    setGeneratedAd({
      id: String(d.creative_id),
      headline: d.headline || '',
      bodyText: d.primary_text || '',
      cta: d.cta || '',
      description: d.optimized_prompt || '',
      hashtags: '',
      imageUrl: d.image_url || '',
      videoUrl: d.video_url || '',
      type: d.type === 'video' ? 'Video' : selectedAdType,
      platform: d.platform || platform,
      aspectRatio: d.aspect_ratio || aspectRatio,
    });
    setGeneratedCreativeId(d.creative_id);
    setGeneratedAdImageFailed(false);
    setIsGenerating(false);
  };

  /** Follows one generation to completion. Shared by a fresh Generate and by the resume
   *  effect below, so both behave identically. */
  const followCreativeJob = async (creativeId: number, ws: number) => {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const d = await fetch(`/api/creative/jobs/${creativeId}?workspace_id=${ws}`, { headers })
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null);
      if (!d || d.status === 'processing') continue;

      if (d.status === 'failed' || (!d.image_url && !d.video_url)) {
        setIsGenerating(false);
        setGenerationError(d.error || 'The image provider returned no asset for this prompt.');
        forgetCreative(ws);
        return;
      }

      adoptCreativeJob(d);
      return;
    }

    setIsGenerating(false);
    setGenerationError('Still rendering after 3 minutes — check the Creative agent in the AI Agents tab.');
  };

  useEffect(() => {
    if (!workspaceId) return;
    let stored: string | null = null;
    try { stored = localStorage.getItem(lastCreativeKey(workspaceId)); } catch { return; }
    const creativeId = Number(stored);
    if (!stored || !Number.isFinite(creativeId) || creativeId <= 0) return;

    let cancelled = false;
    const token = localStorage.getItem('token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`/api/creative/jobs/${creativeId}?workspace_id=${workspaceId}`, { headers })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled || !d) {
          // 404 means it was deleted, or belongs to another workspace — stop pointing at it.
          if (!cancelled) forgetCreative(workspaceId);
          return;
        }
        if (d.status === 'processing') {
          // The backend never stopped working; rejoin it.
          setIsGenerating(true);
          setGenerationElapsed(0);
          followCreativeJob(creativeId, workspaceId);
          return;
        }
        if (d.image_url || d.video_url) adoptCreativeJob(d);
        else forgetCreative(workspaceId);
      })
      .catch(() => { /* offline — leave the panel empty rather than showing a stale guess */ });
    return () => { cancelled = true; };
    // Deliberately only on workspace change: this restores once, and must not re-run and
    // overwrite an ad the user is editing in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  /* Adopt the first asset that was not already present when this run started.
     Only for a run started by the button in this session: the baseline is the set of assets
     that existed at that moment. A generation RESUMED after a refresh has an empty baseline,
     so without this guard every existing asset would look "new" and the panel would adopt an
     arbitrary old one instead of the creative actually being rendered. */
  useEffect(() => {
    if (!isGenerating || !generationStartedHere.current) return;
    const fresh = assets.find(a => !generationBaseline.current.has(a.id));
    if (!fresh) return;
    setGeneratedAd({
      id: fresh.id,
      headline: fresh.headline,
      bodyText: fresh.bodyText,
      cta: fresh.cta,
      description: '',
      hashtags: '',
      imageUrl: fresh.imageUrl || '',
      videoUrl: fresh.videoUrl || '',
      type: fresh.type || selectedAdType,
      platform,
      aspectRatio,
    });
    setGeneratedCreativeId(Number(fresh.id) || null);
    // Remember it here too — this path bypasses the job poller, and without it a refresh
    // would lose an ad that arrived over the WebSocket.
    if (workspaceId && Number(fresh.id)) rememberCreative(workspaceId, Number(fresh.id));
    setIsGenerating(false);
  }, [assets, isGenerating, selectedAdType, platform, aspectRatio, workspaceId]);

  // A failed run produces no asset and no message on this channel, so cap the wait rather
  // than spin forever. The pipeline reports its own errors in the AI Agents tab.
  useEffect(() => {
    if (!isGenerating) return;
    const tick = setInterval(() => setGenerationElapsed(e => e + 1), 1000);
    const giveUp = setTimeout(() => {
      setIsGenerating(false);
      setGenerationError('No ad came back within 3 minutes. Check the Creative agent in the AI Agents tab for what happened.');
    }, 180000);
    return () => { clearInterval(tick); clearTimeout(giveUp); };
  }, [isGenerating]);

  // Ask the backend for a real variation of the ad on screen.
  //
  // This replaces a handler that matched keywords in a free-text box ("discount" -> a fixed
  // "FLAT 30% OFF" headline, "dark" -> a different stock photo) and called nothing. The
  // backend has had /api/creative/{id}/variation all along: it edits the stored creative
  // spec and re-renders, so the subject stays the same while the styling changes. Its six
  // named styles are what the buttons below offer - no free-text rewriting is claimed,
  // because no endpoint does that yet.
  const VARIATION_STYLES: { kind: string; label: string }[] = [
    { kind: 'luxury', label: '✨ Luxury' },
    { kind: 'minimal', label: '◻️ Minimal' },
    { kind: 'energetic', label: '⚡ Energetic' },
    { kind: 'ugc', label: '📱 UGC / candid' },
    { kind: 'different_background', label: '🌄 Different background' },
    { kind: 'different_position', label: '↔️ Reposition subject' },
  ];

  const handleVariation = async (kind: string) => {
    if (!generatedCreativeId || !workspaceId || isApplyingInstruction) return;
    setIsApplyingInstruction(true);
    setGenerationError(null);

    const token = localStorage.getItem('token');
    const headers: HeadersInit = token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };

    try {
      const res = await fetch(`/api/creative/${generatedCreativeId}/variation`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ workspace_id: workspaceId, kind }),
      });
      const started = await res.json().catch(() => null);
      if (!res.ok || !started || !started.creative_id) {
        throw new Error((started && started.detail) || `variation returned ${res.status}`);
      }

      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const d = await fetch(`/api/creative/jobs/${started.creative_id}?workspace_id=${workspaceId}`, { headers })
          .then(r => (r.ok ? r.json() : null))
          .catch(() => null);
        if (!d || d.status === 'processing') continue;
        if (d.status === 'failed' || (!d.image_url && !d.video_url)) {
          throw new Error(d.error || 'The variation produced no asset.');
        }
        setGeneratedAd({
          id: String(d.creative_id),
          headline: d.headline || '',
          bodyText: d.primary_text || '',
          cta: d.cta || '',
          description: d.optimized_prompt || '',
          hashtags: '',
          imageUrl: d.image_url || '',
          videoUrl: d.video_url || '',
          type: d.type === 'video' ? 'Video' : selectedAdType,
          platform: d.platform || platform,
          aspectRatio: d.aspect_ratio || aspectRatio,
        });
        setGeneratedCreativeId(d.creative_id);
        triggerToast(`Rendered the ${kind.replace('_', ' ')} variation.`);
        return;
      }
      throw new Error('The variation is still rendering after 3 minutes.');
    } catch (err: any) {
      setGenerationError(`Could not build that variation: ${err?.message || 'server unreachable'}`);
    } finally {
      setIsApplyingInstruction(false);
    }
  };

  const handleApplyVaultItemToAd = (type: 'headline' | 'hook' | 'cta', text: string) => {
    if (!generatedAd) {
      setSelectedAdType('Image');
      setActiveTab('create');
      triggerToast(`Selected "${text}" for Ad Generation!`);
      return;
    }

    if (type === 'headline' || type === 'hook') {
      setGeneratedAd({ ...generatedAd, headline: text });
    } else if (type === 'cta') {
      setGeneratedAd({ ...generatedAd, cta: text });
    }
    setActiveTab('create');
    triggerToast(`Applied winning ${type} to Ad Output!`);
  };

  // Apply Competitor Pattern to Ad Studio
  /** Seeds the generator from the rival's longest-running ads.
   *
   *  The prompt was a fixed string about a "22.5W fast charge demonstration" - another
   *  brand's product, sent to the generator no matter whose workspace was open. It now
   *  summarises what this competitor is actually still paying to run. */
  const handleApplyCompetitorPattern = () => {
    const top = [...activeCompetitorAds]
      .sort((a, b) => (b.days_active || 0) - (a.days_active || 0))
      .slice(0, 3);
    if (!top.length) {
      triggerToast('No competitor ads collected yet — run the sync in Market Intelligence.');
      return;
    }
    const summary = top
      .map(a => `"${a.title}"${a.days_active ? ` (${a.days_active}d live)` : ''}`)
      .join(', ');
    setSelectedAdType('Image');
    setAspectRatio('1:1');
    setProductPrompt(
      `Build an ad in the spirit of what ${selectedCompetitor} keeps running: ${summary}. ` +
      `Match the angle, not the brand — this is for our own product.`);
    setActiveTab('create');
    triggerToast(`Applied ${selectedCompetitor}'s longest-running patterns to the prompt.`);
    handleGenerateAd();
  };

  // Apply Specific Individual Competitor Ad Pattern to Ad Studio
  /** Seeds the generator from a real competitor ad in the vault.
   *
   *  Took a fixture shape before (with a `roas` string it quoted back at the user); a real
   *  ad carries platforms, run time and its own copy, and no performance figures - those
   *  are not published for anyone else's ads. Format and ratio are inferred from the
   *  platforms it ran on rather than asserted. */
  const handleApplySingleCompetitorAdPattern = (ad: {
    title: string;
    copy?: string;
    platforms?: string[];
    days_active?: number | null;
  }) => {
    const platforms = (ad.platforms || []).map(p => String(p).toLowerCase());
    const isInstagram = platforms.some(p => p.includes('instagram'));
    const nextPlatform = isInstagram ? 'Instagram'
      : platforms.some(p => p.includes('facebook')) ? 'Facebook' : 'Instagram';

    setSelectedAdType('Image');
    setPlatform(nextPlatform as typeof platform);
    setAspectRatio(isInstagram ? '9:16' : '1:1');

    const runFor = ad.days_active ? ` — running ${ad.days_active} days` : '';
    setProductPrompt(
      `Pattern derived from ${selectedCompetitor}'s ad "${ad.title}"${runFor}.` +
      (ad.copy ? ` Their copy: ${ad.copy.slice(0, 300)}` : ''));
    setActiveTab('create');
    triggerToast(`Applied "${ad.title}" to the Ad Studio prompt.`);
    handleGenerateAd();
  };

  // AI Product Prompt Preset Click Handler
  /* A style preset writes the prompt. It used to do two other things, both wrong: it pasted
     an Unsplash stock photo into the reference-image slot and toasted "Generated 4K AI
     Product Visual Render!" - so the panel claimed a render that had not happened, and the
     real generation that followed was handed a photo of someone else's product to work
     from. The render is what Step 4's Generate button produces, through the actual
     provider. */
  const handleSelectProductPromptPreset = (promptText: string) => {
    setProductPrompt(promptText);
  };

  /* Style presets built around this workspace's own product rather than "Ambrane powerbank",
     which was baked into all four and reached the image provider verbatim for every brand. */
  const promptSubject = (brandCategory ? brandCategory.split(/[,/]/)[0].trim() : '')
    || (brandName ? `${brandName} product` : 'the product');
  const productPromptPresets = [
    { label: '🌌 Floating Metallic Neon', prompt: `Sleek ${promptSubject} floating over a dark obsidian desk lit with neon rim light` },
    { label: '🏛️ Minimalist Marble Studio', prompt: `Minimalist studio shot of ${promptSubject} resting on smooth white marble with soft daylight` },
    { label: '⚡ Cyberpunk Tech Setup', prompt: `${promptSubject} on a cyberpunk RGB desk setup, deep shadows and saturated accent light` },
    { label: '💡 Softbox Studio Lighting', prompt: `Professional product photography of ${promptSubject}, studio softbox reflection on a seamless backdrop` },
  ];

  // AI UGC Video Reel Generator Working Pipeline
  /* Runs the real video pipeline on the script.

     The three setTimeouts this replaces narrated work that was not happening ("Synthesizing
     AI Avatar Voiceover", "Rendering 9:16 Lipsync") and then handed back whichever video
     already existed in the workspace, labelled as the reel just generated. The progress
     shown below is now tied to the actual job: submitted, rendering, and whatever the
     provider returns - including its failures. */
  const handleGenerateAiUgcReel = async () => {
    if (isGeneratingUgc) return;
    const script = ugcScript.trim();
    if (!script) {
      setUgcError('Write the script first — it is what the video is generated from.');
      return;
    }
    if (!onGenerate || !workspaceId) {
      setUgcError('Generation is not connected in this view.');
      return;
    }

    setUgcError(null);
    setGeneratedUgcReel(null);
    setUgcVideoFailed(false);
    setIsUgcPlaying(false);
    setIsGeneratingUgc(true);
    setUgcProgress(10);
    setUgcStepText('Planning the reel');

    const job = await Promise.resolve(onGenerate(script, undefined, {
      format: 'Video',
      platform: ugcPlatform,
      ratio: '9:16',
      length: ugcLength,
    })).catch(() => null);

    if (!job || !job.creative_id) {
      setIsGeneratingUgc(false);
      setUgcProgress(0);
      setUgcError('The video pipeline did not accept this script. Check the Creative agent in the AI Agents tab.');
      return;
    }

    setUgcProgress(35);
    setUgcStepText('Rendering 9:16 video');

    const token = localStorage.getItem('token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 3000));
      // Creeps toward 90 while the render runs, and only reaches 100 when it really has.
      setUgcProgress(p => Math.min(90, p + 1));
      const d = await fetch(`/api/creative/jobs/${job.creative_id}?workspace_id=${workspaceId}`, { headers })
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null);
      if (!d || d.status === 'processing') continue;

      if (d.status === 'failed' || (!d.video_url && !d.image_url)) {
        setIsGeneratingUgc(false);
        setUgcProgress(0);
        setUgcError(d.error || 'The video provider returned no asset for this script.');
        return;
      }

      setUgcProgress(100);
      setIsGeneratingUgc(false);
      setGeneratedUgcReel({
        id: String(d.creative_id),
        videoUrl: d.video_url || '',
        posterUrl: d.image_url || '',
        script,
        platform: d.platform || ugcPlatform,
        length: ugcLength,
        status: d.video_url ? 'Rendered' : 'Still frame only',
      });
      triggerToast(d.video_url ? 'Reel rendered 🎬' : 'The provider returned a still frame rather than video.');
      return;
    }

    setIsGeneratingUgc(false);
    setUgcProgress(0);
    setUgcError('Still rendering after 3 minutes — check the Creative agent in the AI Agents tab.');
  };

  /* Remove an approved creative from the Ad Library.
     A real asset is a row in ad_assets, so it goes through the delete endpoint; a draft made
     in this session only exists locally and is dropped from state. Previously both paths did
     the second thing, which meant "Remove from Library" appeared to work on real assets and
     changed nothing. */
  const [removingAssetId, setRemovingAssetId] = useState<string | null>(null);

  /** Approve or reject a creative from the card you are already looking at.
   *
   *  The only route to this before was: open the project modal, press "Open in Review",
   *  which closed the modal and opened a drawer owned by the dashboard, and approve there.
   *  Two clicks, a component away, behind a button that does not say "approve" — which is
   *  why the control was impossible to find. The drawer still exists for editing copy
   *  during review; this is the direct decision. */
  const [reviewingAssetId, setReviewingAssetId] = useState<string | null>(null);

  const handleReviewCreative = async (proj: ProjectCard, action: 'approve' | 'reject') => {
    if (!workspaceId || reviewingAssetId) return;
    setReviewingAssetId(proj.id);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/creatives/${proj.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action }),
      });
      const row = await res.json().catch(() => null);
      if (!res.ok) throw new Error((row && row.detail) || `Review failed (${res.status})`);
      // Tell the dashboard so Recent Projects and the Ad Library both reflect the new state
      // without a reload — they read the same `assets` list.
      onAssetUpdated?.({
        id: String(row.id), headline: row.headline, bodyText: row.body_text,
        cta: row.cta, type: row.type, imageUrl: row.image_url, status: row.status,
      } as CreativeAsset);
      setSelectedProjectModal(null);
      triggerToast(action === 'approve'
        ? 'Approved — it is now in your Ad Library.'
        : 'Rejected.');
    } catch (e) {
      triggerToast(`Could not save that review: ${e instanceof Error ? e.message : e}`);
    } finally {
      setReviewingAssetId(null);
    }
  };

  const handleRemoveFromLibrary = async (proj: ProjectCard) => {
    if (removingAssetId) return;
    if (!proj.real) {
      setProjectsList(prev => prev.filter(p => p.id !== proj.id));
      triggerToast('Creative deleted.');
      return;
    }
    if (!workspaceId) return;
    setRemovingAssetId(proj.id);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/creatives/${proj.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error((d && d.detail) || `Delete failed (${res.status})`);
      }
      // The dashboard owns `assets`, so it has to drop the row too or the card comes back
      // on the next render.
      onAssetRemoved && onAssetRemoved(proj.id);
      triggerToast('Creative deleted.');
    } catch (err: any) {
      triggerToast(err?.message || 'Could not remove that asset.');
    } finally {
      setRemovingAssetId(null);
    }
  };

  // Approve Project in Projects Tab
  const handleApproveProject = (id: string) => {
    setProjectsList(prev => prev.map(p => p.id === id ? { ...p, status: 'Approved' } : p));
    if (selectedProjectModal && selectedProjectModal.id === id) {
      setSelectedProjectModal({ ...selectedProjectModal, status: 'Approved' });
    }
    triggerToast('Project asset approved successfully! ✔');
  };

  // Open any ad into the Canva/Figma Studio Editor with smart routing
  const handleOpenAdInStudio = (adData: any) => {
    if (!adData) return;
    const type = String(adData.type || '').toLowerCase();
    setMasterSection('editing');

    if (type.includes('carousel')) {
      setActiveTab('carousel');
      setEditingSubTab('carousel');
      triggerToast('Opened ad in Multi-Card Carousel Studio! 🎴');
      return;
    }

    if (type.includes('video') || type.includes('reel') || type.includes('ugc')) {
      setActiveTab('video_editor');
      setEditingSubTab('video');
      triggerToast('Opened ad in Video Storyboard Studio! 📹');
      return;
    }

    setActiveTab('editor');
    setEditingSubTab('image');

    setEditorCanvasElements([
      {
        id: 'el_bg',
        type: 'image',
        // Empty rather than a stock photo: the canvas then shows an empty background slot
        // instead of a product that has nothing to do with the ad being edited.
        content: adData.imageUrl || adData.img || '',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        zIndex: 1,
        visible: true
      },
      {
        id: 'el_badge',
        type: 'badge',
        content: '⚡ FLAT 30% OFF • SPECIAL OFFER',
        x: 8,
        y: 8,
        width: 48,
        height: 9,
        color: '#00E676',
        bgColor: 'rgba(0, 230, 118, 0.18)',
        borderColor: 'rgba(0, 230, 118, 0.4)',
        borderRadius: 100,
        fontSize: 11,
        fontWeight: 800,
        zIndex: 10,
        visible: true
      },
      {
        id: 'el_headline',
        type: 'text',
        content: adData.headline || adData.title || 'Unstoppable Power in Your Pocket',
        x: 8,
        y: 60,
        width: 84,
        height: 15,
        color: '#ffffff',
        fontSize: 22,
        fontWeight: 800,
        fontFamily: 'Inter',
        zIndex: 12,
        visible: true
      },
      {
        id: 'el_body',
        type: 'text',
        content: adData.bodyText || 'Engineered with smart AI heat control and 22.5W Power Delivery.',
        x: 8,
        y: 75,
        width: 84,
        height: 10,
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 13,
        fontWeight: 400,
        zIndex: 12,
        visible: true
      },
      {
        id: 'el_button',
        type: 'button',
        content: adData.cta ? `${adData.cta} →` : 'Claim Offer →',
        x: 8,
        y: 86,
        width: 45,
        height: 9,
        color: '#000000',
        bgColor: '#00E676',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 800,
        zIndex: 15,
        visible: true
      }
    ]);
    setSelectedElementId('el_headline');
    setActiveTab('editor');
    triggerToast('Loaded ad into Canva/Figma Studio Editor!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
      
      {/* 1. TOP 3 MASTER SECTIONS NAVIGATION (SPACIOUS FULL-WIDTH CARDS) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '24px' }}>
        
        {/* HEADER BAR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={20} color="#00E676" />
            </div>
            <div>
              <div style={{ fontSize: '16px', color: '#fff', fontWeight: 800, letterSpacing: '0.04em', fontFamily: 'var(--font-heading)' }}>
                AI CREATIVE STUDIO WORKSPACES
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Select a workspace module to build, edit, or analyze high-converting ad assets.
              </div>
            </div>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--success)', background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)', padding: '6px 14px', borderRadius: '100px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={15} color="var(--success)" />
            <span>Raftra Ad Intelligence Vault Sync Active</span>
          </div>
        </div>

        {/* 3 MASTER SECTIONS CARDS GRID (FULL LEFT-TO-RIGHT WIDTH) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '16px', width: '100%' }}>
          {[
            { id: 'create_intel', label: '1. Create & Intelligence 🪄', tag: 'AI GENERATOR & VAULT', desc: 'AI Generator, Saved Projects, Competitor Spy & Winning Vault', color: '#00E676', bg: 'linear-gradient(135deg, rgba(0,230,118,0.14) 0%, rgba(10,14,20,0.95) 100%)' },
            { id: 'editing', label: '2. Creative Editing 🎨', tag: 'CANVA & FIGMA WORKBENCH', desc: 'Single Graphic Studio, Multi-Card Carousel Builder & Video Storyboard', color: '#7C75FF', bg: 'linear-gradient(135deg, rgba(124,117,255,0.14) 0%, rgba(12,10,24,0.95) 100%)' },
            { id: 'services', label: '3. UGC Services 🤝', tag: 'AI REELS & MARKETPLACE', desc: 'AI UGC Avatar Reel Generator & Hire Verified Human Influencers', color: '#FFB74D', bg: 'linear-gradient(135deg, rgba(255,183,77,0.14) 0%, rgba(20,14,10,0.95) 100%)' }
          ].map(sec => {
            const isSelected = masterSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => {
                  setMasterSection(sec.id as any);
                  if (sec.id === 'create_intel') setActiveTab('create');
                  if (sec.id === 'editing') setActiveTab('editor');
                  if (sec.id === 'services') setActiveTab('ugc');
                }}
                style={{
                  background: isSelected ? sec.bg : 'rgba(255,255,255,0.02)',
                  backdropFilter: 'blur(20px)',
                  border: isSelected ? `2px solid ${sec.color}` : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '20px',
                  padding: '20px 24px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: isSelected ? `0 8px 30px ${sec.color}30` : 'none',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.06em', color: sec.color, background: `${sec.color}20`, border: `1px solid ${sec.color}40`, padding: '2px 8px', borderRadius: '4px' }}>
                    {sec.tag}
                  </span>
                  {isSelected && (
                    <span style={{ fontSize: '11px', color: sec.color, fontWeight: 700 }}>● Active</span>
                  )}
                </div>

                <div style={{ fontSize: '17px', fontWeight: 800, color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-heading)' }}>
                  {sec.label}
                </div>

                <div style={{ fontSize: '12.5px', color: isSelected ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
                  {sec.desc}
                </div>
              </button>
            );
          })}
        </div>

        {/* SUB-SECTION SPACIOUS PILL TOOL SWITCHER BAR */}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', background: 'rgba(12, 12, 20, 0.8)', backdropFilter: 'blur(16px)', padding: '10px 16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', width: '100%', boxSizing: 'border-box' }}>
          {masterSection === 'create_intel' && [
            { id: 'create', label: '🪄 AI Ad Generator' },
            { id: 'competitors', label: '⚡ Competitor Intel' },
            { id: 'templates', label: '🏆 Winning Templates' },
            { id: 'projects', label: '📁 Recent Projects' },
            { id: 'ad_library', label: '🏛️ Ad Library' }
          ].map(tool => (
            <button
              key={tool.id}
              onClick={() => setActiveTab(tool.id as any)}
              style={{
                flex: 1,
                padding: '10px 20px',
                background: activeTab === tool.id ? 'linear-gradient(180deg, rgba(0,230,118,0.25) 0%, rgba(0,200,100,0.1) 100%)' : 'rgba(255,255,255,0.03)',
                color: activeTab === tool.id ? '#00E676' : 'rgba(255,255,255,0.7)',
                border: activeTab === tool.id ? '1.5px solid #00E676' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: activeTab === tool.id ? 800 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: activeTab === tool.id ? '0 4px 16px rgba(0,230,118,0.2)' : 'none',
                transition: 'all 0.2s ease',
                textAlign: 'center'
              }}
            >
              {tool.label}
            </button>
          ))}

          {masterSection === 'editing' && [
            { id: 'editor', label: '🎨 Image Ad Studio (Canva/Figma)' },
            { id: 'carousel', label: '🎴 Multi-Card Carousel Builder' },
            { id: 'video_editor', label: '📹 Video Storyboard & Reels' }
          ].map(tool => (
            <button
              key={tool.id}
              onClick={() => setActiveTab(tool.id as any)}
              style={{
                flex: 1,
                padding: '10px 20px',
                background: activeTab === tool.id ? 'linear-gradient(180deg, rgba(124,117,255,0.25) 0%, rgba(100,90,240,0.1) 100%)' : 'rgba(255,255,255,0.03)',
                color: activeTab === tool.id ? '#7C75FF' : 'rgba(255,255,255,0.7)',
                border: activeTab === tool.id ? '1.5px solid #7C75FF' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: activeTab === tool.id ? 800 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: activeTab === tool.id ? '0 4px 16px rgba(124,117,255,0.2)' : 'none',
                transition: 'all 0.2s ease',
                textAlign: 'center'
              }}
            >
              {tool.label}
            </button>
          ))}

          {masterSection === 'services' && [
            { id: 'ugc', label: '🎥 AI UGC Reel Generator' },
            { id: 'hire_influencer', label: '👤 Hire Influencer Marketplace' }
          ].map(tool => (
            <button
              key={tool.id}
              onClick={() => {
                if (tool.id === 'hire_influencer') {
                  if (onNavigateTab) onNavigateTab('influencer');
                  else { setActiveTab('ugc'); setUgcSubTab('hire_human'); }
                } else {
                  setActiveTab(tool.id as any);
                }
              }}
              style={{
                flex: 1,
                padding: '10px 20px',
                background: activeTab === tool.id ? 'linear-gradient(180deg, rgba(255,183,77,0.25) 0%, rgba(240,160,50,0.1) 100%)' : 'rgba(255,255,255,0.03)',
                color: activeTab === tool.id ? '#FFB74D' : 'rgba(255,255,255,0.7)',
                border: activeTab === tool.id ? '1.5px solid #FFB74D' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: activeTab === tool.id ? 800 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: activeTab === tool.id ? '0 4px 16px rgba(255,183,77,0.2)' : 'none',
                transition: 'all 0.2s ease',
                textAlign: 'center'
              }}
            >
              {tool.label}
            </button>
          ))}
        </div>
      </div>

      {/* ==================== TAB 1: CREATE FLOW ==================== */}
      {activeTab === 'create' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* STEP 1: CHOOSE BRAND */}
          <div className="glow-card" style={{ padding: '24px', background: '#0c0c12', border: '1px solid var(--border)', borderRadius: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ background: '#7C75FF', color: '#fff', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold' }}>1</span>
                <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)' }}>Step 1 — Choose Brand</h3>
              </div>
              {brands.length > 1 && onSwitchWorkspace ? (
                <select
                  value={workspaceId ?? ''}
                  onChange={(e) => onSwitchWorkspace(Number(e.target.value))}
                  aria-label="Choose brand workspace"
                  style={{ fontSize: '12px', color: '#fff', background: 'rgba(124,117,255,0.12)', border: '1px solid rgba(124,117,255,0.35)', padding: '5px 12px', borderRadius: '100px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {brands.map(b => (
                    <option key={b.id} value={b.id} style={{ background: '#0c0c12' }}>{b.name}</option>
                  ))}
                </select>
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--success)', background: 'rgba(0,230,118,0.12)', padding: '4px 12px', borderRadius: '100px', fontWeight: 600 }}>
                  Automatically Selected
                </span>
              )}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ minWidth: 0 }}>
                <h4 style={{ fontSize: '20px', color: '#fff', margin: '0 0 4px 0', fontFamily: 'var(--font-heading)' }}>
                  {brandLoading ? 'Loading brand…' : (brandName || 'No brand connected')}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  {[brandSite, brandCategory].filter(Boolean).join(' • ') || 'Add your site in the Brand Knowledge vault to fill this in.'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {([
                  { label: 'THEME', value: brandTheme },
                  { label: 'TONE', value: brandTone },
                  { label: 'AUDIENCE', value: brandAudience },
                ] as { label: string; value: string | null }[]).map(chip => (
                  <div
                    key={chip.label}
                    title={chip.value || 'Not extracted yet — set it in the Brand Knowledge vault'}
                    style={{
                      background: chip.value ? 'rgba(124,117,255,0.1)' : 'rgba(255,255,255,0.03)',
                      border: chip.value ? '1px solid rgba(124,117,255,0.2)' : '1px dashed rgba(255,255,255,0.15)',
                      padding: '8px 14px', borderRadius: '10px', fontSize: '12px',
                      color: chip.value ? '#fff' : 'var(--text-muted)', maxWidth: '210px'
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>{chip.label}</span>
                    <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {brandLoading ? '…' : (chip.value || 'Not set')}
                    </strong>
                  </div>
                ))}

                <button
                  onClick={() => onNavigateTab?.('kb_brands')}
                  title={kbConnected ? 'Open the Brand Knowledge vault' : 'Set up the Brand Knowledge vault'}
                  style={{
                    textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                    background: kbConnected ? 'rgba(0,230,118,0.12)' : 'rgba(255,183,0,0.1)',
                    border: kbConnected ? '1px solid rgba(0,230,118,0.25)' : '1px solid rgba(255,183,0,0.3)',
                    padding: '8px 14px', borderRadius: '10px', fontSize: '12px',
                    color: kbConnected ? 'var(--success)' : '#FFB300'
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>KNOWLEDGE BASE</span>
                  <strong>{brandLoading ? '…' : (kbConnected ? 'Connected ✔' : 'Set up →')}</strong>
                </button>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '14px 0 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={13} color="#7C75FF" />
              {kbConnected
                ? 'Brand ki saari knowledge (Product USPs, colors, past campaigns) automatically use hogi.'
                : 'Brand knowledge abhi connect nahi hui — vault set karo taaki generation me USPs aur colors use ho sakein.'}
            </p>
          </div>

          {/* STEP 2: CHOOSE INPUT */}
          <div className="glow-card" style={{ padding: '24px', background: '#0c0c12', border: '1px solid var(--border)', borderRadius: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ background: '#7C75FF', color: '#fff', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold' }}>2</span>
              <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)' }}>Step 2 — Choose Input Method</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '16px', marginBottom: '20px' }}>
              
              <div 
                onClick={() => setInputOption('brand_kb')}
                style={{
                  background: inputOption === 'brand_kb' ? 'linear-gradient(135deg, rgba(124,117,255,0.18) 0%, rgba(90,82,255,0.06) 100%)' : 'rgba(255,255,255,0.02)',
                  border: inputOption === 'brand_kb' ? '2px solid #7C75FF' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '16px',
                  padding: '20px',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                <span style={{ background: 'rgba(0,230,118,0.2)', color: 'var(--success)', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '100px', border: '1px solid rgba(0,230,118,0.3)', position: 'absolute', top: 16, right: 16 }}>
                  ⭐ Recommended
                </span>

                <Wand2 size={24} color="#7C75FF" style={{ marginBottom: '12px' }} />
                <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 6px 0' }}>Generate using Brand Knowledge</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                  AI automatically extracts Product USPs, Brand Colors, Previous Campaigns & Knowledge Base.
                </p>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span>✓ Auto Product Specs Ingestion</span>
                  <span>✓ 100% Brand Guidelines Compliant</span>
                </div>
              </div>

              <div 
                onClick={() => setInputOption('upload_image')}
                style={{
                  background: inputOption === 'upload_image' ? 'linear-gradient(135deg, rgba(124,117,255,0.18) 0%, rgba(90,82,255,0.06) 100%)' : 'rgba(255,255,255,0.02)',
                  border: inputOption === 'upload_image' ? '2px solid #7C75FF' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '16px',
                  padding: '20px',
                  cursor: 'pointer'
                }}
              >
                <Upload size={24} color="#00E676" style={{ marginBottom: '12px' }} />
                <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 6px 0' }}>Upload Product Images</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                  Drag & Drop product shot ──► Auto BG Removal ──► Studio Shot ──► Ad Output.
                </p>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span>✓ Instant Background Cutout</span>
                  <span>✓ Professional Product Placement</span>
                </div>
              </div>

              <div 
                onClick={() => setInputOption('ai_generate_image')}
                style={{
                  background: inputOption === 'ai_generate_image' ? 'linear-gradient(135deg, rgba(124,117,255,0.18) 0%, rgba(90,82,255,0.06) 100%)' : 'rgba(255,255,255,0.02)',
                  border: inputOption === 'ai_generate_image' ? '2px solid #7C75FF' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '16px',
                  padding: '20px',
                  cursor: 'pointer'
                }}
              >
                <ImageIcon size={24} color="violet" style={{ marginBottom: '12px' }} />
                <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 6px 0' }}>Generate Product Images using AI</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                  Enter custom product text prompt ──► Generate Studio Visuals ──► Ad Output.
                </p>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span>✓ High resolution 4K Renders</span>
                  <span>✓ Custom Lighting & Moods</span>
                </div>
              </div>

            </div>

            {/* Input Details Expansion */}
            {inputOption === 'upload_image' && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '2px dashed rgba(124,117,255,0.4)', borderRadius: '14px', padding: '30px', textAlign: 'center' }}>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" style={{ display: 'none' }} />
                {uploadedImage ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                    <img src={uploadedImage} alt="Uploaded product" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '10px' }} />
                    {/* Reports the upload's real state. It previously read "Background
                        auto-removal active" the instant a file was picked - nothing removes
                        backgrounds here, and nothing had been uploaded yet either. */}
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '14px', color: '#fff', fontWeight: 600 }}>
                        {uploadingReference ? 'Uploading product photo…'
                          : referenceImageUrl ? 'Product photo uploaded'
                          : 'Photo not uploaded'}
                      </div>
                      <div style={{ fontSize: '12px', color: referenceImageUrl ? 'var(--success)' : 'var(--text-muted)' }}>
                        {uploadingReference ? 'Sending it to your workspace…'
                          : referenceImageUrl ? '✔ Will be used as the generator’s reference image'
                          : 'Generation will run from the prompt alone'}
                      </div>
                    </div>
                    <button
                      onClick={() => { setUploadedImage(null); setReferenceImageUrl(null); }}
                      style={{ background: 'none', border: 'none', color: '#ff4757', cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div onClick={() => fileInputRef.current?.click()} style={{ cursor: 'pointer' }}>
                    <Upload size={32} color="#7C75FF" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '14px', color: '#fff', fontWeight: 600 }}>Drag and drop your product photo here, or click to browse</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>PNG, JPG or WEBP up to 25MB</div>
                  </div>
                )}
              </div>
            )}

            {/* OPTION 3: PRODUCT GENERATION PROMPT & PATTERN CHIPS */}
            {inputOption === 'ai_generate_image' && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#ccc', marginBottom: '8px', fontWeight: 600 }}>Product Generation Prompt & Pattern Presets</label>
                  <input
                    type="text"
                    placeholder="e.g. Sleek metallic 20000mAh powerbank floating over neon futuristic desk..."
                    value={productPrompt}
                    onChange={e => setProductPrompt(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px 18px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '100px', color: '#fff', outline: 'none', fontSize: '14px' }}
                  />
                </div>

                {/* Pattern Chips */}
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Select Studio Pattern Preset:</span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {productPromptPresets.map((pattern, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectProductPromptPreset(pattern.prompt)}
                        style={{ background: 'rgba(124,117,255,0.12)', border: '1px solid rgba(124,117,255,0.25)', color: '#fff', padding: '6px 14px', borderRadius: '100px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        {pattern.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* The reference image the provider will actually be given, if one is set.
                    This slot used to announce a "4K AI Product Render" over a stock photo
                    that no model had produced. */}
                {referenceImageUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(0,0,0,0.4)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(0,230,118,0.3)' }}>
                    <img src={uploadedImage || referenceImageUrl} alt="Reference product" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} />
                    <div>
                      <div style={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>Reference image attached</div>
                      <div style={{ fontSize: '11px', color: 'var(--success)' }}>✔ The generator will render from this product photo</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STEP 3: CHOOSE AD TYPE & SETTINGS */}
          <div className="glow-card" style={{ padding: '24px', background: '#0c0c12', border: '1px solid var(--border)', borderRadius: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <span style={{ background: '#7C75FF', color: '#fff', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold' }}>3</span>
              <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)' }}>Step 3 — Choose Ad Type & Settings</h3>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              {(['Image', 'Video', 'Carousel'] as const).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setSelectedAdType(fmt)}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '12px',
                    background: selectedAdType === fmt 
                      ? 'linear-gradient(180deg, #222232 0%, #0d0d15 100%)' 
                      : 'rgba(255,255,255,0.03)',
                    color: selectedAdType === fmt ? '#ffffff' : 'rgba(255,255,255,0.65)',
                    border: selectedAdType === fmt 
                      ? '1px solid rgba(255, 255, 255, 0.35)' 
                      : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: selectedAdType === fmt ? '0 4px 16px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.15)' : 'none',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {fmt} Ad
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '20px', marginBottom: '24px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>PLATFORM</label>
                <select
                  value={platform}
                  onChange={e => setPlatform(e.target.value as any)}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', outline: 'none' }}
                >
                  <option value="Instagram">Instagram</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Google">Google Ads</option>
                  <option value="Amazon">Amazon</option>
                  <option value="Flipkart">Flipkart</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>ASPECT RATIO</label>
                <select
                  value={aspectRatio}
                  onChange={e => setAspectRatio(e.target.value as any)}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', outline: 'none' }}
                >
                  <option value="1:1">1:1 Square (Feed)</option>
                  <option value="9:16">9:16 Vertical (Reel / Story)</option>
                  <option value="4:5">4:5 Portrait</option>
                  <option value="16:9">16:9 Landscape</option>
                </select>
              </div>

              {/* An "AI GENERATION ENGINE" picker (Gemini 2.5 Flash / Imagen 3 Ultra /
                  Claude 3.5 Sonnet) and a "VOICEOVER" picker used to sit here. Neither was
                  ever read: the image provider is chosen server-side by
                  router_decision_engine() from what is actually configured, and there is no
                  text-to-speech provider anywhere in the backend, so no voice could be
                  produced whatever was selected. Showing the real engine beats offering a
                  choice that changes nothing. */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>GENERATION ENGINE</label>
                <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  Chosen automatically
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Best configured image model for this brief
                  </span>
                </div>
              </div>

              {selectedAdType === 'Video' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>VIDEO DURATION</label>
                  <select
                    value={videoDuration}
                    onChange={e => setVideoDuration(e.target.value as any)}
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', outline: 'none' }}
                  >
                    <option value="15s">15 Seconds (High Retention)</option>
                    <option value="30s">30 Seconds (Standard Reel)</option>
                    <option value="60s">60 Seconds (Detailed Showcase)</option>
                  </select>
                </div>
              )}

            </div>

            <GlowButton
              variant="glow"
              onClick={handleGenerateAd}
              disabled={isGenerating}
              style={{ width: '100%', padding: '16px', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
            >
              {isGenerating ? (
                <>
                  <RefreshCw size={20} className="spin-animation" />
                  Generating your {selectedAdType.toLowerCase()} ad… {generationElapsed}s
                </>
              ) : (
                <>
                  <Wand2 size={20} />
                  Generate {selectedAdType} Ad Powered by Brand Knowledge
                </>
              )}
            </GlowButton>

            {isGenerating && (
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '10px 0 0 0', lineHeight: 1.5 }}>
                Rendering on the server — this takes a while for image and video ads. The result appears here as soon as it lands.
              </p>
            )}
            {generationError && (
              <p style={{ fontSize: '12px', color: 'var(--warning)', margin: '10px 0 0 0', lineHeight: 1.5 }}>{generationError}</p>
            )}
          </div>

          {/* GENERATED AD OUTPUT & INTERACTIVE AD EDITOR */}
          {generatedAd && (
            <div className="glow-card" style={{ padding: '32px', background: 'linear-gradient(180deg, #0d0d14 0%, #060609 100%)', border: '1px solid rgba(0,230,118,0.4)', borderRadius: '24px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <CheckCircle2 size={22} color="var(--success)" />
                  <h3 style={{ fontSize: '22px', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)' }}>AI Generated Ad Output</h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={() => setIsEditingMode(!isEditingMode)}
                    style={{
                      background: isEditingMode ? 'rgba(0,230,118,0.2)' : 'rgba(255,255,255,0.06)',
                      border: isEditingMode ? '1px solid #00E676' : '1px solid rgba(255,255,255,0.15)',
                      color: isEditingMode ? '#00E676' : '#fff',
                      padding: '8px 16px',
                      borderRadius: '100px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Edit3 size={15} />
                    {isEditingMode ? 'Direct Editor Active' : 'Enable Direct Edit Mode'}
                  </button>

                  <button onClick={() => onOpenReview && onOpenReview(generatedAd.id)} style={{ background: '#7C75FF', border: 'none', color: '#fff', padding: '8px 18px', borderRadius: '100px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                    Push to Campaign Manager
                  </button>
                </div>
              </div>

              {/* ASK AI CUSTOM REFINEMENT COMMAND BAR */}
              <div style={{ background: 'linear-gradient(135deg, rgba(124,117,255,0.15) 0%, rgba(10,10,16,0.95) 100%)', border: '1px solid rgba(124,117,255,0.3)', padding: '20px', borderRadius: '18px', marginBottom: '28px' }}>
                <div style={{ fontSize: '13px', color: '#fff', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wand2 size={16} color="#7C75FF" />
                  <span>Restyle this ad</span>
                </div>

                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.55 }}>
                  Each style re-renders the same product through the stored creative spec, so the subject stays put and
                  {/* No longer session-bound: the creative id is restored on load, so
                      variations still work after a refresh. */}
                  only the look changes. {generatedCreativeId ? '' : 'Generate an ad first.'}
                </p>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {VARIATION_STYLES.map(v => (
                    <button
                      key={v.kind}
                      onClick={() => handleVariation(v.kind)}
                      disabled={isApplyingInstruction || !generatedCreativeId}
                      style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                        color: generatedCreativeId ? '#ddd' : 'var(--text-muted)', padding: '8px 14px', borderRadius: '100px',
                        fontSize: '12px', cursor: isApplyingInstruction || !generatedCreativeId ? 'not-allowed' : 'pointer',
                        opacity: isApplyingInstruction ? 0.6 : 1,
                      }}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>

                {isApplyingInstruction && (
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '12px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={14} className="spin-animation" /> Rendering the variation…
                  </p>
                )}
              </div>

              {/* Preview & Editable Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '32px' }}>
                
                <div>
                  <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', background: '#000' }}>
                    {/* If the creative URL dies, say so. Swapping in a stock product photo -
                        which is what happened here before - shows the user a picture that is
                        not the ad they just generated. */}
                    {/* A rendered video plays here, in a real <video> with native controls.
                        It used to be drawn in an <img> — which cannot play an mp4 — under a
                        decorative Play circle that was a plain <div> with no onClick. So a
                        generated video ad could never be watched, and when the run returned
                        no still the <img> failed and the panel claimed the image was
                        broken. */}
                    {generatedAd.videoUrl && !generatedAdImageFailed ? (
                      <video
                        src={generatedAd.videoUrl}
                        poster={generatedAd.imageUrl || undefined}
                        controls
                        playsInline
                        loop
                        preload="metadata"
                        onError={() => setGeneratedAdImageFailed(true)}
                        style={{ width: '100%', maxHeight: '420px', objectFit: 'cover', display: 'block', background: '#000' }}
                      />
                    ) : generatedAdImageFailed ? (
                      <div style={{ width: '100%', height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
                        <span style={{ fontSize: '12.5px', color: 'var(--warning)', lineHeight: 1.5 }}>
                          The generated {generatedAd.videoUrl ? 'video' : 'image'} could not be loaded.<br />
                          Re-run the generation, or check the Creative agent in the AI Agents tab.
                        </span>
                      </div>
                    ) : generatedAd.imageUrl ? (
                      <img src={generatedAd.imageUrl} alt="Generated Ad"
                        onError={() => setGeneratedAdImageFailed(true)}
                        style={{ width: '100%', maxHeight: '420px', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div style={{ width: '100%', height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
                        <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                          This creative has no image or video attached.
                        </span>
                      </div>
                    )}

                    {/* Only meaningful when a video ad produced no video to play. */}
                    {generatedAd.type === 'Video' && !generatedAd.videoUrl && !generatedAdImageFailed && (
                      <div title="No video was rendered for this run — the still is shown instead"
                        style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(255,174,0,0.15)', border: '1px solid rgba(255,174,0,0.4)', color: '#ffae00', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 700 }}>
                        Still only — no video rendered
                      </div>
                    )}
                    <span style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                      {generatedAd.platform} • {generatedAd.aspectRatio}
                    </span>
                  </div>

                  {generatedAd.cards && (
                    <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingTop: '12px' }}>
                      {generatedAd.cards.map((card, idx) => (
                        <div key={idx} style={{ minWidth: '120px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <img src={card.img} alt={card.title} style={{ width: '100%', height: '70px', objectFit: 'cover', borderRadius: '6px', marginBottom: '4px' }} />
                          <div style={{ fontSize: '11px', color: '#fff', fontWeight: 600 }}>{card.title}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px 18px', borderRadius: '12px', border: isEditingMode ? '1px solid #7C75FF' : '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>HEADLINE</span>
                    {isEditingMode ? (
                      <input
                        type="text"
                        value={generatedAd.headline}
                        onChange={e => setGeneratedAd({ ...generatedAd, headline: e.target.value })}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: '#fff', fontSize: '16px', fontWeight: 700, outline: 'none' }}
                      />
                    ) : (
                      <div style={{ fontSize: '16px', color: '#fff', fontWeight: 700 }}>{generatedAd.headline}</div>
                    )}
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px 18px', borderRadius: '12px', border: isEditingMode ? '1px solid #7C75FF' : '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>PRIMARY TEXT / BODY</span>
                    {isEditingMode ? (
                      <textarea
                        rows={3}
                        value={generatedAd.bodyText}
                        onChange={e => setGeneratedAd({ ...generatedAd, bodyText: e.target.value })}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: '#fff', fontSize: '14px', outline: 'none', resize: 'vertical' }}
                      />
                    ) : (
                      <div style={{ fontSize: '14px', color: '#ddd', lineHeight: 1.5 }}>{generatedAd.bodyText}</div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: '12px', border: isEditingMode ? '1px solid #7C75FF' : '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>CTA BUTTON</span>
                      {isEditingMode ? (
                        <input
                          type="text"
                          value={generatedAd.cta}
                          onChange={e => setGeneratedAd({ ...generatedAd, cta: e.target.value })}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: '#00E676', fontSize: '13px', fontWeight: 700, outline: 'none' }}
                        />
                      ) : (
                        <div style={{ fontSize: '14px', color: '#00E676', fontWeight: 700 }}>{generatedAd.cta}</div>
                      )}
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: '12px', border: isEditingMode ? '1px solid #7C75FF' : '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>HASHTAGS</span>
                      {isEditingMode ? (
                        <input
                          type="text"
                          value={generatedAd.hashtags}
                          onChange={e => setGeneratedAd({ ...generatedAd, hashtags: e.target.value })}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: '#7C75FF', fontSize: '12px', fontWeight: 600, outline: 'none' }}
                        />
                      ) : (
                        <div style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 600 }}>{generatedAd.hashtags}</div>
                      )}
                    </div>

                  </div>

                  {/* Action Bar for Opening in Canva / Figma Studio */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <button
                      onClick={() => handleOpenAdInStudio(generatedAd)}
                      className="btn-grad"
                      style={{ padding: '10px 20px', borderRadius: '100px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <Edit3 size={15} /> Open in Canva / Figma Studio Editor 🎨
                    </button>
                    <button
                      onClick={() => setIsEditingMode(!isEditingMode)}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '10px 18px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {isEditingMode ? '✓ Save Quick Edits' : '✏️ Quick Edit Fields'}
                    </button>
                  </div>

                </div>

              </div>
            </div>
          )}

        </div>
      )}

      {/* ==================== TAB 2: COMPETITOR INTELLIGENCE ⭐ ==================== */}
      {activeTab === 'competitors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(0,230,118,0.12)', borderRadius: '100px', border: '1px solid rgba(0,230,118,0.3)', marginBottom: '8px' }}>
                <ShieldCheck size={13} color="var(--success)" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)', letterSpacing: '0.04em' }}>
                  RAFTRA AD INTELLIGENCE & META AD BENCHMARKS
                </span>
              </div>
              <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', color: '#fff', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                Winning Competitor Ads & Psychological Vault
                <PreviewBadge />
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
                Analyze top scaling competitor ads, psychological hooks, and high-converting CTAs tracked across active market campaigns.
              </p>
            </div>

            <GlowButton
              variant="glow"
              onClick={() => setShowMarketIntel(true)}
              style={{ padding: '12px 22px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <TrendingUp size={15} />
              Market Intelligence
            </GlowButton>
          </div>

          {/* ---------------------------------------------------------------- live research */}
          <div className="glow-card" style={{ padding: '24px', background: '#0c0c14', border: '1px solid rgba(124,117,255,0.25)', borderRadius: '18px' }}>
            <h3 style={{ fontSize: '16px', color: '#fff', margin: '0 0 6px 0', fontFamily: 'var(--font-heading)' }}>
              Research a competitor
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.6 }}>
              Reads the brand's own site and what search returns about them, then extracts positioning, offers, hooks and
              CTAs — every source listed so you can check it. Competitors saved here are also the ones the fortnightly
              ad sync tracks; open <strong>Market Intelligence</strong> above to see their currently active Meta ads.
            </p>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Competitor name or website, e.g. boat-lifestyle.com"
                value={competitorQuery}
                onChange={e => setCompetitorQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && researchCompetitor()}
                style={{ flex: 1, minWidth: '260px', padding: '12px 18px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '100px', color: '#fff', outline: 'none', fontSize: '14px' }}
              />
              <GlowButton
                variant="glow"
                onClick={researchCompetitor}
                disabled={competitorLoading || !competitorQuery.trim()}
                style={{ padding: '12px 24px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {competitorLoading ? <RefreshCw size={15} className="spin-animation" /> : <Search size={15} />}
                {competitorLoading ? 'Reading their site…' : 'Research'}
              </GlowButton>
            </div>

            {competitorError && (
              <p style={{ fontSize: '12px', color: 'var(--warning)', margin: '12px 0 0 0', lineHeight: 1.55 }}>{competitorError}</p>
            )}

            {competitorResult && (
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '14px' }}>
                  {[
                    { label: 'POSITIONING', value: competitorResult.positioning },
                    { label: 'AUDIENCE', value: competitorResult.audience },
                    { label: 'TONE', value: competitorResult.tone },
                  ].filter(f => f.value).map(f => (
                    <div key={f.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px' }}>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '6px' }}>{f.label}</div>
                      <div style={{ fontSize: '12.5px', color: '#fff', lineHeight: 1.6 }}>{f.value}</div>
                    </div>
                  ))}
                </div>

                {[
                  { label: 'Offers found', items: competitorResult.offers, color: '#00E676' },
                  { label: 'Hooks they lead with', items: competitorResult.hooks, color: '#7C75FF' },
                  { label: 'Calls to action', items: competitorResult.ctas, color: '#FFB74D' },
                ].filter(g => Array.isArray(g.items) && g.items.length > 0).map(g => (
                  <div key={g.label}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '8px' }}>{g.label.toUpperCase()}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {g.items.map((item: string, i: number) => (
                        <span key={i} style={{ fontSize: '12px', color: '#fff', background: 'rgba(255,255,255,0.04)', border: `1px solid ${g.color}44`, borderRadius: '100px', padding: '6px 14px' }}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}

                {competitorResult.notes && (
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.65 }}>{competitorResult.notes}</p>
                )}

                {Array.isArray(competitorResult.sources) && competitorResult.sources.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '8px' }}>READ FROM</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {competitorResult.sources.map((src: any, i: number) => (
                        <a key={i} href={src.url} target="_blank" rel="noreferrer noopener"
                           style={{ fontSize: '11.5px', color: '#8B85FF', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {src.url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <PreviewNote>
            The brands, hooks and metrics below this line are an illustrative sample — they are not tracked from any ad
            library. Use the panel above for real research.
          </PreviewNote>

          {/* COMPETITOR BRAND CARDS */}
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
              Select Competitor Brand to Inspect Active Campaigns
            </div>

            {!adVaultLoading && !adVault.length && (
              <div style={{ padding: '22px', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.02)' }}>
                <p style={{ fontSize: '13.5px', color: '#fff', margin: '0 0 6px 0', fontWeight: 600 }}>
                  No competitor ads collected yet
                </p>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
                  The ad vault fills from the Meta Ad Library on the competitor sync. Add rivals
                  in Market Intelligence, or run the sync there, and their live ads appear here
                  ordered by how long each has been running.
                </p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '16px' }}>
              {adVault.map(group => {
                // Real, checkable figures only: how many ads were collected and how many
                // have been running long enough to count as evergreen. Engagement rate and
                // "Market Leader" style labels were invented - a rival's engagement is not
                // public, and nothing here measured it.
                const evergreen = group.ads.filter(a => (a.days_active || 0) >= 45).length;
                const longest = group.ads.reduce((m, a) => Math.max(m, a.days_active || 0), 0);
                const comp = {
                  id: group.competitor,
                  name: group.competitor,
                  category: group.strategy?.summary ? 'Strategy analysed' : 'Ads tracked',
                  activeAds: `${group.ads.length} ad${group.ads.length === 1 ? '' : 's'} in the vault`,
                  engagement: longest ? `Longest running: ${longest} days` : 'Run time not reported',
                  status: evergreen ? `${evergreen} evergreen` : 'No evergreen yet',
                };
                const isSelected = selectedCompetitor === comp.id;
                return (
                  <div
                    key={comp.id}
                    onClick={() => setSelectedCompetitor(comp.id)}
                    style={{
                      background: isSelected ? 'linear-gradient(135deg, rgba(124,117,255,0.18) 0%, rgba(90,82,255,0.06) 100%)' : 'rgba(255,255,255,0.02)',
                      border: isSelected ? '2px solid #7C75FF' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '16px',
                      padding: '20px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '11px', color: isSelected ? '#7C75FF' : 'var(--text-muted)', fontWeight: 700 }}>{comp.category}</span>
                      <span style={{ fontSize: '10px', background: isSelected ? 'rgba(0,230,118,0.2)' : 'rgba(255,255,255,0.06)', color: isSelected ? 'var(--success)' : 'var(--text-muted)', padding: '2px 8px', borderRadius: '100px', fontWeight: 600 }}>
                        {comp.status}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '18px', color: '#fff', margin: '0 0 6px 0', fontFamily: 'var(--font-heading)' }}>{comp.name}</h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <BarChart2 size={13} color="#7C75FF" /> {comp.activeAds}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <TrendingUp size={13} color="var(--success)" /> {comp.engagement}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Recommendation Banner & Apply Pattern Action */}
          <div className="glow-card" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(0,230,118,0.12) 0%, rgba(10,10,16,0.95) 100%)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                WINNING AD PATTERN RECOGNITION
              </div>
              {/* The strategy read the sync actually produced. This used to assert "+23%
                  CTR" and an "ESTIMATED ROAS 4.2x" for applying a pattern - both invented,
                  and neither derived from anything the vault stores. */}
              <h4 style={{ fontSize: '18px', color: '#fff', margin: '0 0 4px 0', fontFamily: 'var(--font-heading)' }}>
                {selectedCompetitor ? `What ${selectedCompetitor} keeps paying to run` : 'Longest-running rival ads'}
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, maxWidth: '640px', lineHeight: 1.5 }}>
                {adVault.find(g => g.competitor === selectedCompetitor)?.strategy?.summary
                  || (activeCompetitorAds.length
                      ? `${activeCompetitorAds.length} ads collected. The list below is ordered by how long each has been live — an ad still running after weeks is one they are choosing to keep funding.`
                      : 'Run the competitor sync in Market Intelligence to collect this rival’s live ads.')}
              </p>
            </div>

            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <GlowButton variant="glow" onClick={handleApplyCompetitorPattern} disabled={!activeCompetitorAds.length}>
                Apply Pattern to Ad Studio
              </GlowButton>
            </div>
          </div>

          {/* DEDICATED WINNING HOOKS, HEADLINES & CTA VAULT */}
          <div className="glow-card" style={{ padding: '28px', background: '#0b0b10', border: '1px solid rgba(124,117,255,0.3)', borderRadius: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#7C75FF', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '2px' }}>
                  COMPETITOR AD VAULT
                </div>
                <h3 style={{ fontSize: '20px', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)' }}>
                  Hooks, Headlines & Offers From Their Live Ads
                </h3>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { id: 'hooks', label: 'Opening Hooks' },
                  { id: 'headlines', label: 'Ad Headlines' },
                  { id: 'ctas', label: 'Offers in Market' }
                ].map(vTab => (
                  <button
                    key={vTab.id}
                    onClick={() => setVaultSubTab(vTab.id as any)}
                    style={{
                      background: vaultSubTab === vTab.id ? 'rgba(124,117,255,0.2)' : 'rgba(255,255,255,0.04)',
                      border: vaultSubTab === vTab.id ? '1px solid #7C75FF' : '1px solid rgba(255,255,255,0.1)',
                      color: vaultSubTab === vTab.id ? '#fff' : 'var(--text-secondary)',
                      padding: '8px 18px',
                      borderRadius: '100px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {vTab.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '16px' }}>
              
              {vaultSubTab === 'hooks' && vaultRows.hooks.map((item, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', borderRadius: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#7C75FF', background: 'rgba(124,117,255,0.15)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>{item.tag}</span>
                      <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 700 }}>{item.meta}</span>
                    </div>
                    <p style={{ fontSize: '14px', color: '#fff', margin: 0, fontWeight: 500, lineHeight: 1.4 }}>"{item.text}"</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                    <button
                      onClick={() => handleApplyVaultItemToAd('hook', item.text)}
                      style={{ flex: 1, background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)', color: 'var(--success)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Apply to Active Ad
                    </button>
                  </div>
                </div>
              ))}

              {vaultSubTab === 'headlines' && vaultRows.headlines.map((item, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', borderRadius: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#7C75FF', background: 'rgba(124,117,255,0.15)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>{item.tag}</span>
                      <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 700 }}>{item.meta}</span>
                    </div>
                    <p style={{ fontSize: '15px', color: '#fff', margin: 0, fontWeight: 700, lineHeight: 1.3 }}>{item.text}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                    <button
                      onClick={() => handleApplyVaultItemToAd('headline', item.text)}
                      style={{ flex: 1, background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)', color: 'var(--success)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Apply to Active Ad
                    </button>
                  </div>
                </div>
              ))}

              {vaultSubTab === 'ctas' && vaultRows.offers.map((item, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', borderRadius: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#7C75FF', background: 'rgba(124,117,255,0.15)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>{item.tag}</span>
                      <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 700 }}>{item.meta}</span>
                    </div>
                    <p style={{ fontSize: '14px', color: '#00E676', margin: 0, fontWeight: 700, lineHeight: 1.4 }}>"{item.text}"</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                    <button
                      onClick={() => handleApplyVaultItemToAd('cta', item.text)}
                      style={{ flex: 1, background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)', color: 'var(--success)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Apply to Active Ad
                    </button>
                  </div>
                </div>
              ))}

              {/* Nothing is invented to fill this, so it says what would fill it. */}
              {!vaultRows[vaultSubTab === 'ctas' ? 'offers' : vaultSubTab].length && (
                <div style={{ gridColumn: '1 / -1', padding: '28px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '14px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                    {adVaultLoading
                      ? 'Reading the ad vault…'
                      : !adVault.length
                        ? 'No competitor ads collected yet. Run the competitor sync in Market Intelligence and this vault fills from their live ads.'
                        : vaultSubTab === 'ctas'
                          ? 'None of the collected ads state a discount, code or free perk in their copy.'
                          : 'The collected ads did not carry text in this field.'}
                  </p>
                </div>
              )}

            </div>
          </div>

          {/* INDIVIDUAL TOP-PERFORMING COMPETITOR ADS GRID WITH RETURNS & ANALYSIS */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#00E676', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '2px' }}>
                  CURRENTLY RUNNING
                </div>
                <h3 style={{ fontSize: '20px', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)' }}>
                  Longest-Running Ads for {selectedCompetitor || "this rival"}
                </h3>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Click "Apply This Ad Pattern" on any ad to clone into Ad Studio
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '24px' }}>
              {activeCompetitorAds.map(ad => (
                <div key={ad.id} className="glow-card" style={{ padding: '24px', background: '#0d0d14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
                  
                  <div>
                    {/* Header Row. Platforms and run time are reported by the Ad Library;
                        the old badges here ("Scaled 75+ Days" beside a 4.8x ROAS) mixed one
                        real idea with three invented numbers. */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 600 }}>
                        {(ad.platforms || []).join(' • ') || 'Platform not reported'}
                      </span>
                      {ad.days_active !== null && ad.days_active !== undefined && (
                        <span style={{
                          fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, whiteSpace: 'nowrap',
                          color: ad.days_active >= 45 ? 'var(--success)' : 'var(--text-secondary)',
                          background: ad.days_active >= 45 ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.06)',
                          border: ad.days_active >= 45 ? '1px solid rgba(0,230,118,0.25)' : '1px solid rgba(255,255,255,0.1)',
                        }}>
                          {ad.days_active >= 45 ? `Evergreen · ${ad.days_active}d` : `Running ${ad.days_active}d`}
                        </span>
                      )}
                    </div>

                    <h4 style={{ fontSize: '17px', color: '#fff', margin: '0 0 10px 0', fontFamily: 'var(--font-heading)' }}>
                      {ad.title || 'Untitled ad'}
                    </h4>

                    {/* The ad's own copy and any offer the sync parsed out of it. Return,
                        spend and CTR are not published for anyone else's ads, so there is
                        nothing honest to put in their place. */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      {ad.copy && (
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5, maxHeight: '84px', overflow: 'hidden' }}>
                          {ad.copy}
                        </div>
                      )}
                      {!!Object.keys(ad.offers || {}).length && (
                        <div><strong style={{ color: '#ccc' }}>Offer:</strong>{' '}
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {Object.values(ad.offers).filter(Boolean).map(String).join(' · ')}
                          </span>
                        </div>
                      )}
                      {ad.snapshot_url && (
                        <a href={ad.snapshot_url} target="_blank" rel="noopener noreferrer"
                           style={{ color: '#7C75FF', fontWeight: 700, fontSize: '11.5px', textDecoration: 'none' }}>
                          View in the Meta Ad Library ↗
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Individual Apply Action Button */}
                  <GlowButton
                    variant="glow"
                    onClick={() => handleApplySingleCompetitorAdPattern(ad)}
                    style={{ width: '100%', padding: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Wand2 size={15} /> Apply This Ad Pattern to Studio
                  </GlowButton>

                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ==================== TAB: RECENT PROJECTS ==================== */}
      {activeTab === 'projects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', color: '#fff', margin: '0 0 6px 0' }}>
              Recent Projects & Generated Ads
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
              Click any project card to open the interactive editor, review copy, and approve assets.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '20px' }}>
            {displayProjects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => setSelectedProjectModal(proj)}
                  className="glow-card"
                  style={{ padding: '20px', background: '#0d0d14', border: '1px solid var(--border)', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s ease' }}
                >
                <img src={proj.img} alt={proj.title} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '10px', marginBottom: '12px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{proj.date}</span>
                  <span style={{
                    fontSize: '11px',
                    background: proj.status === 'Approved' ? 'rgba(0,230,118,0.15)' : 'rgba(124,117,255,0.15)',
                    color: proj.status === 'Approved' ? 'var(--success)' : '#7C75FF',
                    padding: '3px 10px',
                    borderRadius: '100px',
                    fontWeight: 600
                  }}>
                    {proj.status}
                  </span>
                </div>
                <h4 style={{ fontSize: '15px', color: '#fff', margin: '0 0 4px 0', fontFamily: 'var(--font-heading)' }}>{proj.title}</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>"{proj.headline}"</p>
              </div>
            ))}
          </div>

          {/* PROJECT INTERACTIVE EDIT & APPROVE MODAL */}
          {selectedProjectModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div className="glow-card" style={{ width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', background: '#0c0c14', border: '1px solid #7C75FF', borderRadius: '24px', padding: '32px', position: 'relative' }}>
                
                <button
                  onClick={() => setSelectedProjectModal(null)}
                  style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '22px', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)' }}>{selectedProjectModal.title}</h3>
                  <span style={{
                    fontSize: '11px',
                    background: selectedProjectModal.status === 'Approved' ? 'rgba(0,230,118,0.2)' : 'rgba(124,117,255,0.2)',
                    color: selectedProjectModal.status === 'Approved' ? 'var(--success)' : '#7C75FF',
                    padding: '4px 12px',
                    borderRadius: '100px',
                    fontWeight: 700
                  }}>
                    {selectedProjectModal.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '24px', marginBottom: '24px' }}>
                  <div>
                    <img src={selectedProjectModal.img} alt="Project visual" style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>HEADLINE</label>
                      <input
                        type="text"
                        value={selectedProjectModal.headline}
                        onChange={e => setSelectedProjectModal({ ...selectedProjectModal, headline: e.target.value })}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '14px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>BODY TEXT</label>
                      <textarea
                        rows={3}
                        value={selectedProjectModal.bodyText}
                        onChange={e => setSelectedProjectModal({ ...selectedProjectModal, bodyText: e.target.value })}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>CTA</label>
                        <input
                          type="text"
                          value={selectedProjectModal.cta}
                          onChange={e => setSelectedProjectModal({ ...selectedProjectModal, cta: e.target.value })}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#00E676', fontSize: '12px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>HASHTAGS</label>
                        <input
                          type="text"
                          value={selectedProjectModal.hashtags}
                          onChange={e => setSelectedProjectModal({ ...selectedProjectModal, hashtags: e.target.value })}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#7C75FF', fontSize: '11px' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* MODAL ACTION BUTTONS */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                  {/* Deletes for real. This was hidden for real assets, because dropping a
                      database row from local state would have looked like a delete while
                      changing nothing — the card returned on the next refresh. It now goes
                      through DELETE /creatives/{id}, which already existed and was only
                      being used by the Ad Library tab. */}
                  <button
                    onClick={() => {
                      const target = selectedProjectModal;
                      setSelectedProjectModal(null);
                      handleRemoveFromLibrary(target);
                    }}
                    disabled={removingAssetId === selectedProjectModal.id}
                    style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.5)', color: '#f87171', padding: '12px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: removingAssetId === selectedProjectModal.id ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}
                  >
                    <X size={14} /> {removingAssetId === selectedProjectModal.id ? 'Deleting…' : 'Delete project'}
                  </button>

                  {/* The decision, right here on the card being looked at. */}
                  {selectedProjectModal.real && selectedProjectModal.status !== 'Approved' && (
                    <button
                      onClick={() => handleReviewCreative(selectedProjectModal, 'approve')}
                      disabled={reviewingAssetId === selectedProjectModal.id}
                      title="Approve this creative into the Ad Library"
                      style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.5)', color: '#00E676', padding: '12px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: reviewingAssetId === selectedProjectModal.id ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}
                    >
                      <Check size={14} /> {reviewingAssetId === selectedProjectModal.id ? 'Saving…' : 'Approve'}
                    </button>
                  )}

                  {selectedProjectModal.real && selectedProjectModal.status !== 'Draft' && (
                    <button
                      onClick={() => handleReviewCreative(selectedProjectModal, 'reject')}
                      disabled={reviewingAssetId === selectedProjectModal.id}
                      title="Reject this creative"
                      style={{ background: 'rgba(255,183,77,0.12)', border: '1px solid rgba(255,183,77,0.45)', color: '#FFB74D', padding: '12px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: reviewingAssetId === selectedProjectModal.id ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}
                    >
                      <X size={14} /> Reject
                    </button>
                  )}

                  {/* The drawer stays for the fuller flow — it lets the copy be edited as
                      part of approving, which the two buttons above deliberately do not. */}
                  {selectedProjectModal.real && onOpenReview && (
                    <button
                      onClick={() => {
                        onOpenReview(selectedProjectModal.id);
                        setSelectedProjectModal(null);
                      }}
                      style={{ background: 'rgba(124,117,255,0.15)', border: '1px solid rgba(124,117,255,0.5)', color: '#8B85FF', padding: '12px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}
                    >
                      <Edit3 size={14} /> Edit copy & review
                    </button>
                  )}

                  {/* Open in Editor */}
                  <GlowButton
                    variant="glow"
                    onClick={() => {
                      handleOpenAdInStudio(selectedProjectModal);
                      setSelectedProjectModal(null);
                    }}
                    style={{ padding: '12px 28px', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Edit3 size={16} /> Open in Editor 🎨
                  </GlowButton>
                </div>

              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB: AD LIBRARY (SAVED APPROVED ASSETS) ==================== */}
      {activeTab === 'ad_library' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(0,230,118,0.12)', borderRadius: '100px', border: '1px solid rgba(0,230,118,0.3)', marginBottom: '6px' }}>
                <ShieldCheck size={13} color="var(--success)" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)', letterSpacing: '0.04em' }}>RAFTRA APPROVED AD LIBRARY</span>
              </div>
              <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', color: '#fff', margin: '0 0 4px 0' }}>
                Verified Brand Ad Intelligence Vault & Library
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
                Approved high-performing ad creatives, scaling campaign assets, and verified copy frameworks ready for immediate launch.
              </p>
            </div>

            <div style={{ fontSize: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '12px', color: '#fff', fontWeight: 600 }}>
              🏛️ Total Approved Assets: <span style={{ color: '#00E676', fontWeight: 800 }}>{displayProjects.filter(p => p.status === 'Approved').length}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '20px' }}>
            {displayProjects.filter(p => p.status === 'Approved').map(proj => (
              <div
                key={proj.id}
                className="glow-card"
                style={{
                  padding: '20px',
                  background: '#0c0c14',
                  border: '1px solid rgba(0,230,118,0.3)',
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
                  {proj.img ? (
                    <img src={proj.img} alt={proj.title} style={{ width: '100%', height: '160px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                      Copy-only asset — no image
                    </div>
                  )}
                  <span style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    fontSize: '10px',
                    background: 'rgba(0,230,118,0.9)',
                    color: '#000',
                    padding: '3px 10px',
                    borderRadius: '100px',
                    fontWeight: 800
                  }}>
                    🏛️ Approved Vault Ad
                  </span>
                </div>
                <h4 style={{ fontSize: '15px', color: '#fff', margin: '0 0 4px 0', fontFamily: 'var(--font-heading)' }}>{proj.title}</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>"{proj.headline}"</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{proj.date}</span>
                  {/* This only ever filtered the local draft list, so pressing it on a real
                      asset removed the card until the next render and left the row in the
                      database. Real rows now go through DELETE /creatives/{id}. */}
                  <button
                    onClick={() => handleRemoveFromLibrary(proj)}
                    disabled={removingAssetId === proj.id}
                    style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.5)', color: '#f87171', padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: removingAssetId === proj.id ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    {/* Says what it does: this deletes the creative, it does not merely
                        un-approve it out of the library listing. */}
                    <X size={11} /> {removingAssetId === proj.id ? 'Deleting…' : 'Delete creative'}
                  </button>
                </div>
              </div>
            ))}

            {!displayProjects.filter(p => p.status === 'Approved').length && (
              <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '16px' }}>
                <p style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#fff', fontWeight: 600 }}>
                  Nothing approved yet
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Generate an ad, then approve it in Recent Projects — approved creatives land
                  here ready to launch.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

          {/* TAB 4: TEMPLATES & VAULT */}
          {activeTab === 'templates' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', color: '#fff', margin: '0 0 6px 0' }}>
              High-Converting Ad Framework Templates
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
              Pre-built frameworks engineered for maximum CTR and ROAS across Meta & Google Ads.
            </p>
          </div>

          {templatesNote && (
            <div style={{
              padding: '12px 16px', borderRadius: '10px', fontSize: '13px', lineHeight: 1.55,
              background: 'rgba(255,193,7,0.07)', border: '1px solid rgba(255,193,7,0.28)',
              color: '#ffc107', marginBottom: '4px',
            }}>
              {templatesNote}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '20px' }}>
            {frameworks.map((tmpl) => (
              <div key={tmpl.key} className="glow-card" style={{ padding: '24px', background: '#0d0d14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
                <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 8px 0' }}>{tmpl.name}</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.45 }}>{tmpl.desc}</p>
                <GlowButton
                  variant="glow"
                  onClick={() => {
                    // Carries the framework into the generator instead of just switching
                    // tabs, so "Use Framework" actually does something.
                    setProductPrompt(prev => prev?.trim()
                      ? `${prev}\n\nUse the ${tmpl.name} framework.`
                      : `Write an ad using the ${tmpl.name} framework. ${tmpl.desc}`);
                    setActiveTab('create');
                  }}
                  style={{ padding: '8px 16px', fontSize: '12px' }}
                >
                  Use Framework
                </GlowButton>
              </div>
            ))}
            {frameworks.length === 0 && (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading frameworks…</div>
            )}
          </div>
        </div>
      )}
      {/* TAB 5: AI UGC REEL & SERVICES */}
      {activeTab === 'ugc' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '14px' }}>
            <button
              onClick={() => setUgcSubTab('ai_ugc')}
              style={{
                background: ugcSubTab === 'ai_ugc' ? '#7C75FF' : 'transparent',
                color: ugcSubTab === 'ai_ugc' ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '100px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              🤖 Create AI UGC Reel
            </button>
            <button
              onClick={() => {
                if (onNavigateTab) onNavigateTab('influencer');
                else setUgcSubTab('hire_human');
              }}
              style={{
                background: ugcSubTab === 'hire_human' ? '#7C75FF' : 'transparent',
                color: ugcSubTab === 'hire_human' ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '100px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              👤 Hire Verified UGC Creator (Influencer Marketplace)
            </button>
          </div>

          {/* AI UGC Creator Working Generator */}
          {ugcSubTab === 'ai_ugc' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="glow-card" style={{ padding: '28px', background: '#0c0c12', border: '1px solid var(--border)', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontSize: '20px', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  Generate a UGC-Style Reel
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                  Write the script and Raftra renders a vertical 9:16 video ad from it through the
                  creative pipeline. There is no synthetic presenter or voiceover — for a person on
                  camera, hire a creator in the tab beside this one.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>PLATFORM</label>
                    <select
                      value={ugcPlatform}
                      onChange={e => setUgcPlatform(e.target.value as typeof ugcPlatform)}
                      style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff' }}
                    >
                      <option value="Instagram">Instagram Reels</option>
                      <option value="Facebook">Facebook Reels</option>
                      <option value="Google">YouTube Shorts</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>REEL LENGTH</label>
                    {/* Both selectors are passed to the render job, unlike the avatar and
                        voice pickers they replace, which reached nothing. */}
                    <select value={ugcLength} onChange={e => setUgcLength(e.target.value)}
                      style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff' }}>
                      <option value="10s">10 seconds</option>
                      <option value="15s">15 seconds</option>
                      <option value="30s">30 seconds</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>SCRIPT / PROMPT</label>
                  <textarea
                    rows={3}
                    placeholder={brandName
                      ? `e.g. 'Three reasons ${brandName} customers keep coming back — shot as a quick vertical reel.'`
                      : "e.g. 'Three reasons customers keep coming back — shot as a quick vertical reel.'"}
                    value={ugcScript}
                    onChange={e => setUgcScript(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '14px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', color: '#fff', outline: 'none' }}
                  />
                </div>

                {ugcError && (
                  <div style={{ background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.35)', color: '#ff8b95', padding: '12px 14px', borderRadius: '10px', fontSize: '13px' }}>
                    {ugcError}
                  </div>
                )}

                <GlowButton
                  variant="glow"
                  onClick={handleGenerateAiUgcReel}
                  disabled={isGeneratingUgc}
                  style={{ padding: '14px', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                >
                  {isGeneratingUgc ? (
                    <>
                      <RefreshCw size={18} className="spin-animation" />
                      {ugcStepText} ({ugcProgress}%)
                    </>
                  ) : (
                    <>
                      <Video size={18} />
                      Generate Reel
                    </>
                  )}
                </GlowButton>
              </div>

              {/* REALISTIC GENERATED AI UGC REEL OUTPUT */}
              {generatedUgcReel && (
                <div className="glow-card" style={{ padding: '28px', background: '#0a0a10', border: '1px solid rgba(0,230,118,0.4)', borderRadius: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <CheckCircle2 size={20} color="var(--success)" />
                      <h4 style={{ fontSize: '18px', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)' }}>
                        Reel for {generatedUgcReel.platform} · {generatedUgcReel.length}
                      </h4>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      background: generatedUgcReel.videoUrl ? 'rgba(0,230,118,0.12)' : 'rgba(255,174,0,0.12)',
                      color: generatedUgcReel.videoUrl ? 'var(--success)' : 'var(--warning)',
                      padding: '4px 12px', borderRadius: '100px', fontWeight: 700
                    }}>
                      {generatedUgcReel.status}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '24px' }}>
                    {/* Playable Video Card — a real <video> so the play button actually plays.
                        Falls back to the render's own still if the provider returned no
                        video, or if the file fails to load, rather than a black rectangle. */}
                    <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', background: '#000', maxHeight: '380px' }}>
                      {generatedUgcReel.videoUrl && !ugcVideoFailed ? (
                        <video
                          ref={ugcVideoRef}
                          src={generatedUgcReel.videoUrl}
                          poster={generatedUgcReel.posterUrl}
                          controls
                          playsInline
                          loop
                          preload="metadata"
                          onPlay={() => setIsUgcPlaying(true)}
                          onPause={() => setIsUgcPlaying(false)}
                          onError={() => { setUgcVideoFailed(true); setIsUgcPlaying(false); }}
                          style={{ width: '100%', height: '100%', maxHeight: '380px', objectFit: 'cover', display: 'block' }}
                        />
                      ) : generatedUgcReel.posterUrl ? (
                        <img src={generatedUgcReel.posterUrl} alt="Rendered still from this reel" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div style={{ width: '100%', height: '380px' }} />
                      )}

                      {/* Big play affordance only while paused — it would sit on top of the
                          picture during playback otherwise. */}
                      {generatedUgcReel.videoUrl && !ugcVideoFailed && !isUgcPlaying && (
                        <div onClick={() => ugcVideoRef.current?.play()} title="Play reel"
                          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(124,117,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 0 30px rgba(124,117,255,0.6)' }}>
                          <Play size={28} color="#fff" style={{ marginLeft: '4px' }} />
                        </div>
                      )}

                      {(!generatedUgcReel.videoUrl || ugcVideoFailed) && (
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '86%', textAlign: 'center', background: 'rgba(0,0,0,0.78)', border: '1px solid rgba(255,174,0,0.35)', borderRadius: '10px', padding: '12px', fontSize: '11.5px', color: '#ffae00', lineHeight: 1.5 }}>
                          {ugcVideoFailed
                            ? 'The rendered video could not be loaded — showing its still frame.'
                            : 'The provider returned a still frame rather than video for this run.'}
                        </div>
                      )}

                      {/* Top-left, not bottom — the bottom strip belongs to the player's own
                          controls and the caption used to sit on top of them. */}
                      {!isUgcPlaying && (
                        <div style={{ position: 'absolute', top: 14, left: 14, maxWidth: 'calc(100% - 28px)', background: 'rgba(0,0,0,0.75)', padding: '7px 12px', borderRadius: '9px', fontSize: '11px', color: '#fff', pointerEvents: 'none' }}>
                          🎬 {generatedUgcReel.platform} · 9:16 · {generatedUgcReel.length}
                        </div>
                      )}
                    </div>

                    {/* Script Transcript & Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>SCRIPT THIS REEL WAS RENDERED FROM</span>
                        <p style={{ fontSize: '14px', color: '#ddd', margin: 0, lineHeight: 1.5 }}>"{generatedUgcReel.script}"</p>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <button
                          onClick={() => onOpenReview && onOpenReview(generatedUgcReel.id)}
                          style={{ background: '#7C75FF', border: 'none', color: '#fff', padding: '12px 20px', borderRadius: '100px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                          <Send size={15} /> Push to Campaign Manager
                        </button>
                        <button
                          onClick={() => { if (onNavigateTab) onNavigateTab('social'); }}
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '12px 20px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                          <Calendar size={15} /> Schedule on Social Hub
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sub-tab 2: Hire Human Creator Marketplace */}
          {ugcSubTab === 'hire_human' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="glow-card" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(124,117,255,0.15) 0%, rgba(10,10,16,0.95) 100%)', border: '1px solid rgba(124,117,255,0.3)', borderRadius: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 4px 0', fontFamily: 'var(--font-heading)' }}>
                    Raftra Influencer & Creator Marketplace
                  </h3>
                  {/* The count is the roster's real size. It used to read "500+ verified
                      Indian UGC creators" regardless of how many were actually registered. */}
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                    {marketCreatorsLoading
                      ? 'Loading the creator roster…'
                      : marketCreators.length
                        ? `${marketCreators.length} creator${marketCreators.length === 1 ? '' : 's'} registered on Raftra. Open the marketplace to see rates, past collabs and reviews, or hire directly from here.`
                        : 'No creators have registered on this marketplace yet. Once they do, they appear here and can be hired straight into this workspace.'}
                  </p>
                </div>
                <GlowButton
                  variant="glow"
                  onClick={() => onNavigateTab && onNavigateTab('influencer')}
                  style={{ padding: '12px 24px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  Open Full Influencer Marketplace <ArrowRight size={16} />
                </GlowButton>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '20px' }}>
                {marketCreators.slice(0, 6).map(creator => (
                  <div key={creator.id} className="glow-card" style={{ padding: '24px', background: '#0d0d14', border: '1px solid var(--border)', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      {/* Creators register a name and a handle, not a headshot; an initial is
                          honest where a stock portrait of an unrelated person was not. */}
                      <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid #7C75FF', background: 'rgba(124,117,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {(creator.name || '?').trim().charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h4 style={{ fontSize: '17px', color: '#fff', margin: '0 0 2px 0' }}>{creator.name}</h4>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {[creator.niche, creator.handle].filter(Boolean).join(' • ') || 'Niche not set'}
                        </div>
                        {typeof creator.fit_score === 'number' && creator.fit_score > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--success)', marginTop: '2px' }}>
                            {creator.fit_score}% brand fit
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                      <div style={{ fontSize: creator.base_rate ? '16px' : '12px', color: creator.base_rate ? '#00E676' : 'var(--text-muted)', fontWeight: 700 }}>
                        {creator.base_rate
                          ? `₹${Number(creator.base_rate).toLocaleString('en-IN')}`
                          : 'Rate on request'}
                      </div>
                      <GlowButton
                        variant="glow"
                        onClick={() => onNavigateTab && onNavigateTab('influencer')}
                        style={{ padding: '8px 16px', fontSize: '12px' }}
                      >
                        Hire Creator
                      </GlowButton>
                    </div>
                  </div>
                ))}

                {!marketCreatorsLoading && !marketCreators.length && (
                  <div style={{ gridColumn: '1 / -1', padding: '32px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '18px' }}>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                      No creators to show yet. Creators who sign up through the Raftra creator
                      portal appear here with their own rates and niches.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB: MULTI-CARD CAROUSEL BUILDER ==================== */}
      {activeTab === 'carousel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* HEADER BANNER */}
          <div style={{ background: 'linear-gradient(135deg, rgba(20, 20, 35, 0.9), rgba(10, 10, 20, 0.95))', border: '1px solid rgba(0, 230, 118, 0.3)', borderRadius: '16px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', background: 'rgba(0, 230, 118, 0.15)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.3)', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
                  🎴 META MULTI-CARD CAROUSEL BUILDER
                </span>
                <span style={{ fontSize: '11px', color: '#8e8e9e' }}>Instagram • Facebook • TikTok Carousel Ads</span>
              </div>
              <h3 style={{ fontSize: '20px', color: '#fff', margin: 0, fontWeight: 700 }}>Interactive Multi-Slide Carousel Studio</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 10px 0' }}>
                Har card slide ke liye dedicated headline, graphic, aur <b>unique destination URL link</b> setup karein.
              </p>

              {/* LEFT ACTIONS: CANVA & FIGMA BUTTONS */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => handleOpenCanva('Carousel Ad Cards')}
                  style={{ background: 'rgba(0, 196, 204, 0.15)', border: '1px solid rgba(0, 196, 204, 0.4)', color: '#00C4CC', padding: '7px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  Open in Canva 🎨
                </button>

                <button
                  onClick={() => handleOpenFigma('Carousel Ad Cards')}
                  style={{ background: 'rgba(162, 89, 255, 0.15)', border: '1px solid rgba(162, 89, 255, 0.4)', color: '#A259FF', padding: '7px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  Open in Figma ❖
                </button>
              </div>
            </div>

            {/* FAR RIGHT ACTIONS: DRAFT, AD LIBRARY, DOWNLOAD AD */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>

              {/* 1. SAVE IN DRAFT → goes to Recent Projects as Draft */}
              <button 
                onClick={() => persistCarousel('pending_review')} disabled={isSavingDesign}
                style={{ background: 'rgba(255,183,77,0.15)', border: '1px solid #FFB74D', color: '#FFB74D', padding: '9px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Save size={14} /> Save in Draft 💾
              </button>

              {/* 2. SAVE TO AD LIBRARY → goes to Ad Library as Approved */}
              <button 
                onClick={() => persistCarousel('approved')} disabled={isSavingDesign}
                style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', color: '#00E676', padding: '9px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <FolderPlus size={14} /> Save to Ad Library 🏛️
              </button>

              {/* 3. DOWNLOAD AD */}
              <button 
                onClick={() => {
                  const payload = {
                    ad_type: 'CAROUSEL',
                    cards: carouselCards.map(c => ({
                      headline: c.headline,
                      description: c.description,
                      destination_url: c.destinationUrl,
                      call_to_action: c.ctaAction,
                      image_url: c.imageUrl
                    }))
                  };
                  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'carousel_ad_bundle.json';
                  a.click();
                  URL.revokeObjectURL(url);
                  triggerToast('Downloading carousel ad asset bundle... ⬇️');
                }}
                className="btn-grad"
                style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              >
                <Download size={14} /> Download Ad ⬇️
              </button>
            </div>
          </div>

          {/* 2-COLUMN WORKBENCH */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
            
            {/* LEFT COLUMN: CAROUSEL CARDS NAV & SLIDE EDITOR */}
            <div style={{ background: '#0c0c14', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#fff', fontWeight: 700 }}>Carousel Slide Cards ({carouselCards.length})</span>
                <button
                  onClick={() => {
                    const newCard = {
                      id: `c_${Date.now()}`,
                      title: `Card ${carouselCards.length + 1}: Custom Slide`,
                      headline: '',
                      description: '',
                      // The workspace's own site, not the ambrane.com deal page every added
                      // card used to point at.
                      destinationUrl: carouselCards[0]?.destinationUrl || '',
                      ctaAction: 'SHOP_NOW',
                      imageUrl: ''
                    };
                    setCarouselCards(prev => [...prev, newCard]);
                    setActiveCarouselIndex(carouselCards.length);
                    triggerToast('Added new Carousel Slide Card! 🎴');
                  }}
                  style={{ background: 'rgba(0, 230, 118, 0.15)', border: '1px solid rgba(0, 230, 118, 0.3)', color: '#00E676', padding: '6px 12px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  + Add Slide Card
                </button>
              </div>

              {/* CARDS SLIDE TAB SELECTOR */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {carouselCards.map((card, idx) => (
                  <button
                    key={card.id}
                    onClick={() => setActiveCarouselIndex(idx)}
                    style={{
                      padding: '8px 14px',
                      background: activeCarouselIndex === idx ? 'linear-gradient(180deg, #1c1c2b 0%, #0a0a10 100%)' : 'rgba(255,255,255,0.03)',
                      color: activeCarouselIndex === idx ? '#00E676' : '#8e8e9e',
                      border: activeCarouselIndex === idx ? '1px solid rgba(0, 230, 118, 0.4)' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: activeCarouselIndex === idx ? 700 : 500,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Card {idx + 1}
                  </button>
                ))}
              </div>

              {/* ACTIVE CARD PROPERTIES FORM */}
              {(() => {
                const currentCard = carouselCards[activeCarouselIndex] || carouselCards[0];
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#12121c', padding: '18px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: '13px', color: '#00E676', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
                      Editing: {currentCard.title}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>CARD HEADLINE</label>
                      <input
                        type="text"
                        value={currentCard.headline}
                        onChange={e => {
                          const val = e.target.value;
                          setCarouselCards(prev => prev.map((c, i) => i === activeCarouselIndex ? { ...c, headline: val } : c));
                        }}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: '#0a0a10', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>CARD DESCRIPTION / SUBTEXT</label>
                      <input
                        type="text"
                        value={currentCard.description}
                        onChange={e => {
                          const val = e.target.value;
                          setCarouselCards(prev => prev.map((c, i) => i === activeCarouselIndex ? { ...c, description: val } : c));
                        }}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: '#0a0a10', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#fff', fontSize: '12.5px' }}
                      />
                    </div>

                    <div style={{ background: 'rgba(0, 230, 118, 0.05)', border: '1px solid rgba(0, 230, 118, 0.25)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ fontSize: '11px', color: '#00E676', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Zap size={13} /> CARD SPECIFIC META DESTINATION LINK (URL)
                      </div>
                      <input
                        type="text"
                        placeholder="https://your-site.com/product-page"
                        value={currentCard.destinationUrl}
                        onChange={e => {
                          const val = e.target.value;
                          setCarouselCards(prev => prev.map((c, i) => i === activeCarouselIndex ? { ...c, destinationUrl: val } : c));
                        }}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: '#0a0a10', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                      />
                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>
                        📍 Jab user Card {activeCarouselIndex + 1} par click karega, Meta is target URL par user ko landing karwayega.
                      </span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>CARD CTA ACTION BUTTON</label>
                      <select
                        value={currentCard.ctaAction}
                        onChange={e => {
                          const val = e.target.value;
                          setCarouselCards(prev => prev.map((c, i) => i === activeCarouselIndex ? { ...c, ctaAction: val } : c));
                        }}
                        style={{ width: '100%', padding: '8px 10px', background: '#0a0a10', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none' }}
                      >
                        <option value="SHOP_NOW">SHOP_NOW (Shop Now)</option>
                        <option value="LEARN_MORE">LEARN_MORE (Learn More)</option>
                        <option value="GET_OFFER">GET_OFFER (Get Offer)</option>
                        <option value="ORDER_NOW">ORDER_NOW (Order Now)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>CARD IMAGE</label>

                      {/* Upload, or pick something the workspace already has. The URL box
                          below still works for an external image, but it is no longer the
                          only way in. */}
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <input type="file" ref={carouselFileRef} onChange={handleCarouselImageUpload} accept="image/*" style={{ display: 'none' }} />
                        <button
                          onClick={() => carouselFileRef.current?.click()}
                          disabled={uploadingCardImage}
                          style={{ background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.35)', color: '#00E676', padding: '7px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: uploadingCardImage ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                        >
                          <Upload size={13} /> {uploadingCardImage ? 'Uploading…' : 'Upload image'}
                        </button>
                        {currentCard.imageUrl && (
                          <button
                            onClick={() => setActiveCardImage('')}
                            style={{ background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)', color: '#ff8b95', padding: '7px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Remove image
                          </button>
                        )}
                      </div>

                      {(vaultImages.length > 0 || assets.some(a => a.imageUrl)) && (
                        <>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                            OR PICK FROM THIS WORKSPACE
                          </span>
                          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '8px' }}>
                            {[
                              ...assets.filter(a => a.imageUrl).slice(0, 8)
                                .map(a => ({ url: a.imageUrl as string, name: a.headline || 'Generated ad' })),
                              ...vaultImages.slice(0, 12),
                            ].map((img, idx) => (
                              <button
                                key={`${img.url}-${idx}`}
                                onClick={() => setActiveCardImage(img.url)}
                                title={img.name}
                                style={{
                                  flexShrink: 0, width: '54px', height: '54px', padding: 0, borderRadius: '6px',
                                  overflow: 'hidden', cursor: 'pointer', background: '#0a0a10',
                                  border: currentCard.imageUrl === img.url ? '2px solid #00E676' : '1px solid rgba(255,255,255,0.15)',
                                }}
                              >
                                <img src={img.url} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      <input
                        type="text"
                        placeholder="…or paste an image URL"
                        value={currentCard.imageUrl}
                        onChange={e => {
                          const val = e.target.value;
                          setCarouselCards(prev => prev.map((c, i) => i === activeCarouselIndex ? { ...c, imageUrl: val } : c));
                        }}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: '#0a0a10', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* RIGHT COLUMN: LIVE INTERACTIVE CAROUSEL PREVIEW SLIDER */}
            <div style={{ background: '#06060c', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              
              <div style={{ fontSize: '12px', color: '#8e8e9e', fontWeight: 700, marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Meta Live Carousel Ad Preview (Card {activeCarouselIndex + 1} of {carouselCards.length})
              </div>

              {/* CAROUSEL AD CARD CHASSIS */}
              {(() => {
                const activeCard = carouselCards[activeCarouselIndex] || carouselCards[0];
                return (
                  <div style={{ width: '320px', background: '#0d0d15', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 16px 40px rgba(0,0,0,0.8)' }}>
                    {/* An empty card shows an empty slot, not a broken image icon. */}
                    <div style={{ width: '100%', height: '240px', position: 'relative', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {activeCard.imageUrl ? (
                        <img src={activeCard.imageUrl} alt={activeCard.headline} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No image on this card yet</span>
                      )}
                      <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700 }}>
                        {activeCarouselIndex + 1} / {carouselCards.length}
                      </div>
                    </div>

                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <h4 style={{ fontSize: '14px', color: activeCard.headline ? '#fff' : 'var(--text-muted)', margin: 0, fontWeight: 700 }}>
                        {activeCard.headline || 'Headline'}
                      </h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                        {activeCard.description || 'Card description'}
                      </p>

                      <div style={{ fontSize: '10px', color: '#00E676', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        🔗 {activeCard.destinationUrl || 'No destination URL set'}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', background: '#00E676', color: '#000', padding: '6px 14px', borderRadius: '6px', fontWeight: 800 }}>
                          {activeCard.ctaAction.replace('_', ' ')} →
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* SLIDE NAVIGATION CONTROLS */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  disabled={activeCarouselIndex === 0}
                  onClick={() => setActiveCarouselIndex(prev => Math.max(0, prev - 1))}
                  style={{ padding: '8px 16px', background: activeCarouselIndex === 0 ? 'rgba(255,255,255,0.05)' : '#12121c', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: activeCarouselIndex === 0 ? 'not-allowed' : 'pointer' }}
                >
                  ← Previous Card
                </button>
                <button
                  disabled={activeCarouselIndex === carouselCards.length - 1}
                  onClick={() => setActiveCarouselIndex(prev => Math.min(carouselCards.length - 1, prev + 1))}
                  style={{ padding: '8px 16px', background: activeCarouselIndex === carouselCards.length - 1 ? 'rgba(255,255,255,0.05)' : '#00E676', border: 'none', color: activeCarouselIndex === carouselCards.length - 1 ? '#8e8e9e' : '#000', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: activeCarouselIndex === carouselCards.length - 1 ? 'not-allowed' : 'pointer' }}
                >
                  Next Card →
                </button>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* ==================== TAB: VIDEO STORYBOARD & TIMELINE EDITOR ==================== */}
      {activeTab === 'video_editor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* HEADER BANNER */}
          <div style={{ background: 'linear-gradient(135deg, rgba(30, 20, 45, 0.9), rgba(10, 10, 20, 0.95))', border: '1px solid rgba(124, 117, 255, 0.4)', borderRadius: '16px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', background: 'rgba(124, 117, 255, 0.15)', color: '#7C75FF', border: '1px solid rgba(124, 117, 255, 0.4)', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
                  📹 VIDEO STORYBOARD & TIMELINE STUDIO
                </span>
                <span style={{ fontSize: '11px', color: '#8e8e9e' }}>Meta Reels • TikTok • YouTube Shorts</span>
              </div>
              <h3 style={{ fontSize: '20px', color: '#fff', margin: 0, fontWeight: 700 }}>Dynamic Scene Storyboard & Subtitle Studio</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 10px 0' }}>
                Hook, Problem, Solution, aur CTA scenes ko timeline format me edit karke viral ad videos banayein.
              </p>

              {/* LEFT ACTIONS: CANVA & FIGMA BUTTONS */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => handleOpenCanva('Video Reel Storyboard')}
                  style={{ background: 'rgba(0, 196, 204, 0.15)', border: '1px solid rgba(0, 196, 204, 0.4)', color: '#00C4CC', padding: '7px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  Open in Canva 🎨
                </button>

                <button
                  onClick={() => handleOpenFigma('Video Reel Storyboard')}
                  style={{ background: 'rgba(162, 89, 255, 0.15)', border: '1px solid rgba(162, 89, 255, 0.4)', color: '#A259FF', padding: '7px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  Open in Figma ❖
                </button>
              </div>
            </div>

            {/* FAR RIGHT ACTIONS: DRAFT, AD LIBRARY, DOWNLOAD AD */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>

              {/* 1. SAVE IN DRAFT → goes to Recent Projects as Draft */}
              <button 
                onClick={() => persistStoryboard('pending_review')} disabled={isSavingDesign}
                style={{ background: 'rgba(255,183,77,0.15)', border: '1px solid #FFB74D', color: '#FFB74D', padding: '9px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Save size={14} /> Save in Draft 💾
              </button>

              {/* 2. SAVE TO AD LIBRARY → goes to Ad Library as Approved */}
              <button 
                onClick={() => persistStoryboard('approved')} disabled={isSavingDesign}
                style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', color: '#00E676', padding: '9px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <FolderPlus size={14} /> Save to Ad Library 🏛️
              </button>

              {/* 3. DOWNLOAD AD */}
              <button 
                onClick={() => {
                  const payload = {
                    ad_type: 'VIDEO',
                    format: 'REEL_9_16',
                    subtitle_style: videoSubtitleStyle,
                    audio_track: videoAudioTrack,
                    scenes: videoScenes.map(s => ({
                      scene_id: s.id,
                      duration: s.duration,
                      overlay_subtitle: s.overlayText,
                      video_url: s.videoUrl
                    }))
                  };
                  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'video_storyboard_reel_bundle.json';
                  a.click();
                  URL.revokeObjectURL(url);
                  triggerToast('Downloading video reel ad asset bundle... ⬇️');
                }}
                className="btn-grad"
                style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              >
                <Download size={14} /> Download Ad ⬇️
              </button>
            </div>
          </div>

          {/* 2-COLUMN WORKBENCH */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
            
            {/* LEFT COLUMN: SCENE TIMELINE LIST & PROPERTY EDITOR */}
            <div style={{ background: '#0c0c14', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ fontSize: '13px', color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                4-Scene Storyboard Timeline
              </div>

              {/* TIMELINE SCENES SELECTOR LIST */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {videoScenes.map((scene, idx) => (
                  <div
                    key={scene.id}
                    onClick={() => setActiveVideoSceneIndex(idx)}
                    style={{
                      padding: '12px 14px',
                      background: activeVideoSceneIndex === idx ? 'linear-gradient(180deg, #1c1c2b 0%, #0a0a10 100%)' : '#12121c',
                      border: activeVideoSceneIndex === idx ? '1px solid #7C75FF' : '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '11px', background: activeVideoSceneIndex === idx ? '#7C75FF' : 'rgba(255,255,255,0.1)', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
                        {scene.duration}
                      </span>
                      <div>
                        <div style={{ fontSize: '12.5px', color: '#fff', fontWeight: 700 }}>{scene.name}</div>
                        <div style={{ fontSize: '11px', color: scene.overlayText ? 'var(--text-secondary)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                          {scene.overlayText ? `"${scene.overlayText}"` : 'No overlay text yet'}
                        </div>
                      </div>
                    </div>

                    <span style={{ fontSize: '11px', color: activeVideoSceneIndex === idx ? '#7C75FF' : '#8e8e9e', fontWeight: 600 }}>
                      {activeVideoSceneIndex === idx ? '● Editing' : 'Select'}
                    </span>
                  </div>
                ))}
              </div>

              {/* ACTIVE SCENE EDIT FORM */}
              {(() => {
                const curScene = videoScenes[activeVideoSceneIndex] || videoScenes[0];
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#12121c', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', marginTop: '8px' }}>
                    <div style={{ fontSize: '12.5px', color: '#7C75FF', fontWeight: 700 }}>
                      Editing {curScene.name} Properties
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '10.5px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>SUBTITLE OVERLAY TEXT</label>
                      <textarea
                        rows={2}
                        value={curScene.overlayText}
                        onChange={e => {
                          const val = e.target.value;
                          setVideoScenes(prev => prev.map((s, i) => i === activeVideoSceneIndex ? { ...s, overlayText: val } : s));
                        }}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px', background: '#0a0a10', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '10.5px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>SUBTITLE STYLE</label>
                        <select
                          value={videoSubtitleStyle}
                          onChange={e => setVideoSubtitleStyle(e.target.value as any)}
                          style={{ width: '100%', padding: '6px 8px', background: '#0a0a10', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#fff', fontSize: '11.5px', outline: 'none' }}
                        >
                          <option value="viral_yellow">Viral Yellow Shadow (TikTok)</option>
                          <option value="capsule_white">White Capsule Pill</option>
                          <option value="minimal">Minimalist Sans</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '10.5px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>AUDIO TRACK</label>
                        <select
                          value={videoAudioTrack}
                          onChange={e => setVideoAudioTrack(e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', background: '#0a0a10', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#fff', fontSize: '11.5px', outline: 'none' }}
                        >
                          <option value="Upbeat Tech Bass (128 BPM)">Upbeat Tech Bass (128 BPM)</option>
                          <option value="Lo-fi Chill Vibe">Lo-fi Chill Vibe</option>
                          <option value="High Energy EDM">High Energy EDM</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* RIGHT COLUMN: LIVE REEL/STORY VIDEO PLAYER PREVIEW CHASSIS */}
            <div style={{ background: '#06060c', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              
              <div style={{ fontSize: '12px', color: '#8e8e9e', fontWeight: 700, marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Reels / Story Video Player Preview (9:16)
              </div>

              {/* 9:16 SMARTPHONE CHASSIS */}
              {(() => {
                const currentScene = videoScenes[activeVideoSceneIndex] || videoScenes[0];
                return (
                  <div style={{ width: '260px', height: '440px', background: '#000', border: '2px solid rgba(255,255,255,0.2)', borderRadius: '24px', overflow: 'hidden', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.95)' }}>
                    
                    {/* A scene with no footage yet shows the empty frame rather than a
                        player pointed at nothing. */}
                    {currentScene.videoUrl ? (
                      <video
                        src={currentScene.videoUrl}
                        autoPlay
                        loop
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                          No footage on this scene yet.<br />Add a clip below, or generate a
                          reel from the AI UGC tab.
                        </span>
                      </div>
                    )}

                    {/* LIVE BURNED SUBTITLE OVERLAY */}
                    <div style={{
                      position: 'absolute',
                      bottom: '60px',
                      left: '14px',
                      right: '14px',
                      textAlign: 'center',
                      zIndex: 10
                    }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '6px 12px',
                        background: videoSubtitleStyle === 'viral_yellow' ? '#FFBD2E' : videoSubtitleStyle === 'capsule_white' ? '#ffffff' : 'rgba(0,0,0,0.85)',
                        color: videoSubtitleStyle === 'viral_yellow' || videoSubtitleStyle === 'capsule_white' ? '#000000' : '#ffffff',
                        borderRadius: videoSubtitleStyle === 'capsule_white' ? '20px' : '6px',
                        fontWeight: 900,
                        fontSize: '13px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        lineHeight: 1.35
                      }}>
                        {currentScene.overlayText || 'Your subtitle overlay'}
                      </span>
                    </div>

                    {/* SCENE WATERMARK BADGE */}
                    <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.7)', color: '#7C75FF', padding: '3px 8px', borderRadius: '12px', fontSize: '9.5px', fontWeight: 800 }}>
                      {currentScene.name.split(':')[0]} ({currentScene.duration})
                    </div>
                  </div>
                );
              })()}

              {/* TIMELINE PROGRESS INDICATOR */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '16px', width: '260px' }}>
                {videoScenes.map((s, idx) => (
                  <div
                    key={s.id}
                    onClick={() => setActiveVideoSceneIndex(idx)}
                    style={{
                      flex: 1,
                      height: '4px',
                      borderRadius: '2px',
                      background: activeVideoSceneIndex === idx ? '#7C75FF' : 'rgba(255,255,255,0.2)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  />
                ))}
              </div>

            </div>

          </div>

        </div>
      )}
      {activeTab === 'editor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* TOP TOOLBAR HEADER */}
          <div style={{
            background: '#0d0d14',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '14px',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'linear-gradient(135deg, #00E676 0%, #7C75FF 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Edit3 size={16} color="#000" />
              </div>
              <div>
                <input 
                  type="text" 
                  value={editorDocumentTitle}
                  onChange={e => setEditorDocumentTitle(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '15px', fontWeight: 700, outline: 'none' }}
                />
                <div style={{ fontSize: '11px', color: '#8e8e9e' }}>Canva / Figma Hybrid Visual Studio Workplace • Drag & Drop Enabled</div>
              </div>
            </div>

            {/* Aspect Ratio Switcher */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              {(['1:1', '9:16', '4:5', '16:9'] as const).map(ratio => (
                <button
                  key={ratio}
                  onClick={() => setCanvasAspectRatio(ratio)}
                  style={{
                    background: canvasAspectRatio === ratio ? 'linear-gradient(180deg, #1c1c2b 0%, #0a0a10 100%)' : 'transparent',
                    color: canvasAspectRatio === ratio ? '#00E676' : '#a0a0b0',
                    border: canvasAspectRatio === ratio ? '1px solid rgba(0,230,118,0.4)' : '1px solid transparent',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {ratio} {ratio === '1:1' ? 'Square' : ratio === '9:16' ? 'Reel/Story' : ratio === '4:5' ? 'Portrait' : 'Landscape'}
                </button>
              ))}
            </div>

            {/* LEFT ACTIONS: ZOOM CONTROLS, CANVA & FIGMA BUTTONS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.4)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <button onClick={() => setEditorZoom(Math.max(50, editorZoom - 15))} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>-</button>
                <span style={{ fontSize: '11.5px', color: '#fff', fontWeight: 600, minWidth: '36px', textAlign: 'center' }}>{editorZoom}%</span>
                <button onClick={() => setEditorZoom(Math.min(200, editorZoom + 15))} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>+</button>
              </div>

              <button
                onClick={() => handleOpenCanva('Single Graphic Ad')}
                style={{ background: 'rgba(0, 196, 204, 0.15)', border: '1px solid rgba(0, 196, 204, 0.4)', color: '#00C4CC', padding: '7px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                Open in Canva 🎨
              </button>

              <button
                onClick={() => handleOpenFigma('Single Graphic Ad')}
                style={{ background: 'rgba(162, 89, 255, 0.15)', border: '1px solid rgba(162, 89, 255, 0.4)', color: '#A259FF', padding: '7px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                Open in Figma ❖
              </button>
            </div>

            {/* FAR RIGHT ACTIONS: SAVE IN DRAFT, SAVE TO AD LIBRARY, DOWNLOAD AD */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
              {/* 1. SAVE IN DRAFT → goes to Recent Projects as Draft */}
              <button 
                onClick={handleSaveAsDraft} disabled={isSavingDesign}
                style={{ background: 'rgba(255,183,77,0.15)', border: '1px solid #FFB74D', color: '#FFB74D', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Save size={14} /> Save in Draft 💾
              </button>

              {/* 2. SAVE TO AD LIBRARY → goes to Ad Library as Approved */}
              <button 
                onClick={handleSaveToVault} disabled={isSavingDesign}
                style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', color: '#00E676', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <FolderPlus size={14} /> Save to Ad Library 🏛️
              </button>

              {/* 3. DOWNLOAD AD */}
              <button 
                onClick={handleExport4KPng}
                className="btn-grad"
                style={{ padding: '7px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              >
                <Download size={14} /> Download Ad ⬇️
              </button>
            </div>
          </div>

          {/* MAIN 3-COLUMN EDITOR WORKSPACE */}
          <div style={{ display: 'grid', gridTemplateColumns: '310px 1fr 310px', gap: '16px', minHeight: '680px' }}>
            
            {/* COLUMN 1: CANVA-STYLE LEFT SIDEBAR */}
            <div style={{
              background: '#0c0c14',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              {/* Canva Sidebar Navigation Tabs */}
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                {[
                  { id: 'ai', label: '🤖 AI', title: 'AI Assistant' },
                  { id: 'text', label: '🔤 Text', title: 'Typography' },
                  { id: 'elements', label: '🎨 Badges', title: 'Badges & Elements' },
                  { id: 'uploads', label: '🖼️ Media', title: 'Uploads & Stock' },
                  { id: 'layers', label: '🥞 Layers', title: 'Layers Ordering' }
                ].map(nav => (
                  <button
                    key={nav.id}
                    onClick={() => setEditorSidebarTab(nav.id as any)}
                    title={nav.title}
                    style={{
                      flex: 1,
                      padding: '7px 2px',
                      background: editorSidebarTab === nav.id ? 'linear-gradient(180deg, #1c1c2b 0%, #0a0a10 100%)' : 'transparent',
                      color: editorSidebarTab === nav.id ? '#00E676' : '#a0a0b0',
                      border: editorSidebarTab === nav.id ? '1px solid rgba(0,230,118,0.4)' : '1px solid transparent',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: editorSidebarTab === nav.id ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {nav.label}
                  </button>
                ))}
              </div>

              {/* TAB CONTENT 1: AI ASSISTANT INSTRUCTION TOOL */}
              {editorSidebarTab === 'ai' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)', padding: '10px 12px', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11.5px', color: '#00E676', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <Wand2 size={13} /> AI Natural Language Canvas Modifier
                    </div>
                    <p style={{ fontSize: '10.5px', color: '#b0b0c0', margin: 0, lineHeight: 1.4 }}>
                      Describe any modification in plain language. AI will update or add elements directly on your Figma canvas.
                    </p>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '10.5px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px', letterSpacing: '0.04em' }}>
                      AI PROMPT COMMAND
                    </label>
                    <textarea
                      rows={3}
                      value={aiPromptInstruction}
                      onChange={e => setAiPromptInstruction(e.target.value)}
                      placeholder="e.g. Add 30% OFF badge in top left, make headline gold color, and swap background to obsidian dark..."
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: '#12121c', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '11.5px', outline: 'none', resize: 'vertical' }}
                    />
                    <button
                      onClick={() => {
                        if (!aiPromptInstruction) return;
                        setIsProcessingStudioAi(true);
                        setTimeout(() => {
                          setIsProcessingStudioAi(false);
                          setEditorCanvasElements(prev => [
                            ...prev,
                            {
                              id: `el_ai_${Date.now()}`,
                              type: 'badge',
                              content: '🔥 LIMITED TIME 40% OFF',
                              x: 10,
                              y: 12,
                              width: 45,
                              height: 9,
                              color: '#FFBD2E',
                              bgColor: 'rgba(255, 189, 46, 0.18)',
                              borderColor: 'rgba(255, 189, 46, 0.4)',
                              borderWidth: 1,
                              borderRadius: 100,
                              fontSize: 11,
                              fontWeight: 800,
                              fontFamily: 'Inter',
                              zIndex: 20,
                              visible: true
                            }
                          ]);
                          setAiPromptInstruction('');
                          triggerToast('AI Canvas modification applied!');
                        }, 900);
                      }}
                      className="btn-grad"
                      style={{ width: '100%', marginTop: '8px', padding: '9px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      {isProcessingStudioAi ? <RefreshCw size={13} className="spin" /> : <Sparkles size={13} />}
                      {isProcessingStudioAi ? 'AI Processing Canvas...' : 'Apply AI Instruction to Canvas'}
                    </button>
                  </div>

                  <div>
                    <div style={{ fontSize: '10.5px', color: '#8e8e9e', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.04em' }}>QUICK AI PRESET COMMANDS</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {[
                        /* These drop text into an ad the brand will publish, so none of them
                           may invent a claim. "⚡ 30% OFF FESTIVE OFFER" and "★★★★★ 4.9/5
                           (12,400+ Reviews)" did exactly that - a discount nobody had
                           approved and a review count belonging to no one. They now insert
                           an editable placeholder, or the brand's own rating when the vault
                           actually holds one. */
                        { label: '🏷️ Add Offer Badge', action: () => {
                          setEditorCanvasElements(prev => [...prev, { id: `el_${Date.now()}`, type: 'badge', content: 'YOUR OFFER HERE', x: 10, y: 15, width: 45, height: 8, color: '#00E676', bgColor: 'rgba(0,230,118,0.2)', borderColor: 'rgba(0,230,118,0.4)', borderWidth: 1, borderRadius: 100, fontSize: 11, fontWeight: 800, fontFamily: 'Inter', zIndex: 20, visible: true }]);
                          triggerToast('Offer badge added — edit its text in the layer panel');
                        }},
                        { label: '✨ Make Headline Gold', action: () => {
                          setEditorCanvasElements(prev => prev.map(el => el.id === 'el_headline' ? { ...el, color: '#FFBD2E' } : el));
                          triggerToast('Headline font changed to Gold!');
                        }},
                        { label: '🖼️ Backdrop From Asset Vault', action: () => {
                          const first = vaultImages[0];
                          if (!first) {
                            triggerToast('Your Asset Vault is empty — import your website images in the Assets tab first.');
                            return;
                          }
                          setEditorCanvasElements(prev => prev.map(el => el.id === 'el_bg' ? { ...el, content: first.url } : el));
                          triggerToast(`Backdrop set to ${first.name}`);
                        }},
                        { label: '🏆 Add Rating Pill', action: () => {
                          // Nothing in the brand vault stores a review score, so this can
                          // only ever be a slot for the brand's own verified number.
                          setEditorCanvasElements(prev => [...prev, { id: `el_${Date.now()}`, type: 'badge', content: '★★★★★ YOUR RATING', x: 10, y: 26, width: 50, height: 7, color: '#FFBD2E', bgColor: 'rgba(0,0,0,0.7)', borderColor: 'rgba(255,189,46,0.4)', borderWidth: 1, borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: 'Inter', zIndex: 18, visible: true }]);
                          triggerToast('Rating pill added — put your own verified rating in it');
                        }}
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          onClick={preset.action}
                          style={{ background: '#12121c', border: '1px solid rgba(255,255,255,0.08)', color: '#e0e0f0', padding: '7px 10px', borderRadius: '6px', fontSize: '11px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s ease' }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB CONTENT 2: TEXT & TYPOGRAPHY PRESETS */}
              {editorSidebarTab === 'text' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '11.5px', color: '#fff', fontWeight: 700 }}>Add Typography Elements</div>
                  <button
                    onClick={() => {
                      const newId = `el_head_${Date.now()}`;
                      setEditorCanvasElements(prev => [...prev, { id: newId, type: 'text', content: 'New Bold Headline', x: 10, y: 40, width: 80, height: 12, color: '#ffffff', fontSize: 24, fontWeight: 800, fontFamily: 'Inter', zIndex: 25, visible: true }]);
                      setSelectedElementId(newId);
                    }}
                    style={{ background: '#141422', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '10px', borderRadius: '7px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}
                  >
                    + Add Large Heading
                  </button>
                  <button
                    onClick={() => {
                      const newId = `el_sub_${Date.now()}`;
                      setEditorCanvasElements(prev => [...prev, { id: newId, type: 'text', content: 'Secondary Supporting Subheading', x: 10, y: 52, width: 80, height: 10, color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: 600, fontFamily: 'Inter', zIndex: 25, visible: true }]);
                      setSelectedElementId(newId);
                    }}
                    style={{ background: '#12121c', border: '1px solid rgba(255,255,255,0.12)', color: '#ddd', padding: '9px', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
                  >
                    + Add Subheading
                  </button>
                  <button
                    onClick={() => {
                      const newId = `el_body_${Date.now()}`;
                      setEditorCanvasElements(prev => [...prev, { id: newId, type: 'text', content: 'Detailed product feature description text goes here...', x: 10, y: 64, width: 80, height: 8, color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 400, fontFamily: 'Inter', zIndex: 25, visible: true }]);
                      setSelectedElementId(newId);
                    }}
                    style={{ background: '#101018', border: '1px solid rgba(255,255,255,0.08)', color: '#bbb', padding: '8px', borderRadius: '7px', fontSize: '11.5px', fontWeight: 400, cursor: 'pointer', textAlign: 'left' }}
                  >
                    + Add Body Paragraph
                  </button>
                </div>
              )}

              {/* TAB CONTENT 3: BADGES & STICKERS */}
              {editorSidebarTab === 'elements' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '11.5px', color: '#fff', fontWeight: 700 }}>Canva Badges & Promotional Stickers</div>
                  {[
                    { label: '⚡ 50% SPECIAL DISCOUNT', bg: 'rgba(255, 71, 87, 0.2)', border: '#FF4757', color: '#FF4757' },
                    { label: '🏆 BEST SELLER #1', bg: 'rgba(255, 189, 46, 0.2)', border: '#FFBD2E', color: '#FFBD2E' },
                    { label: '🚚 FREE EXPRESS SHIPPING', bg: 'rgba(0, 230, 118, 0.2)', border: '#00E676', color: '#00E676' },
                    { label: '🛡️ 1-YEAR WARRANTY INCLUDED', bg: 'rgba(124, 117, 255, 0.2)', border: '#7C75FF', color: '#7C75FF' }
                  ].map((badge, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const newId = `el_badge_${Date.now()}`;
                        setEditorCanvasElements(prev => [...prev, { id: newId, type: 'badge', content: badge.label, x: 10, y: 20 + idx * 10, width: 50, height: 8, color: badge.color, bgColor: badge.bg, borderColor: badge.border, borderWidth: 1, borderRadius: 100, fontSize: 11, fontWeight: 800, fontFamily: 'Inter', zIndex: 30, visible: true }]);
                        setSelectedElementId(newId);
                        triggerToast(`Added ${badge.label} badge!`);
                      }}
                      style={{ background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color, padding: '8px 12px', borderRadius: '100px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}
                    >
                      + {badge.label}
                    </button>
                  ))}
                </div>
              )}

              {/* TAB CONTENT 4: MEDIA & UPLOADS */}
              {editorSidebarTab === 'uploads' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '11.5px', color: '#fff', fontWeight: 700 }}>Custom Product Shot Upload</div>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" style={{ display: 'none' }} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', color: '#00E676', padding: '10px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Upload size={14} /> Upload Photo from Computer
                  </button>

                  <div style={{ fontSize: '10.5px', color: '#8e8e9e', fontWeight: 700, marginTop: '6px' }}>
                    YOUR ASSET VAULT {vaultImages.length ? `(${vaultImages.length})` : ''}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {vaultImages.slice(0, 12).map((bg, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setEditorCanvasElements(prev => prev.map(el => el.id === 'el_bg' ? { ...el, content: bg.url } : el));
                          triggerToast(`Applied ${bg.name} as the canvas background`);
                        }}
                        title={bg.name}
                        style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', height: '60px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)' }}
                      >
                        <img src={bg.url} alt={bg.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <span style={{ position: 'absolute', bottom: 3, left: 3, right: 3, background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: '9px', fontWeight: 600, padding: '1px 3px', borderRadius: '3px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {bg.name}
                        </span>
                      </div>
                    ))}
                  </div>
                  {!vaultImages.length && (
                    <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                      Your Asset Vault is empty. Run “Import from website” in the Assets tab and
                      your own brand images appear here to drop onto the canvas.
                    </p>
                  )}
                </div>
              )}

              {/* TAB CONTENT 5: LAYERS PANEL WITH NUMBERS & MOVE UP/DOWN BUTTONS */}
              {editorSidebarTab === 'layers' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '11.5px', color: '#fff', fontWeight: 700, marginBottom: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Canvas Layer Hierarchy</span>
                    <span style={{ fontSize: '10px', color: '#00E676' }}>Z-Index Sorted</span>
                  </div>
                  {editorCanvasElements.slice().sort((a,b) => (b.zIndex || 0) - (a.zIndex || 0)).map((el) => (
                    <div
                      key={el.id}
                      onClick={() => setSelectedElementId(el.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: selectedElementId === el.id ? 'linear-gradient(180deg, #1c1c2b 0%, #0a0a10 100%)' : '#12121c',
                        border: selectedElementId === el.id ? '1px solid rgba(0,230,118,0.4)' : '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '7px',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        <span style={{ fontSize: '10px', background: '#00E676', color: '#000', padding: '2px 5px', borderRadius: '4px', fontWeight: 800 }}>
                          #{el.zIndex || 1}
                        </span>
                        <span style={{ fontSize: '9.5px', background: 'rgba(255,255,255,0.1)', color: '#00E676', padding: '2px 5px', borderRadius: '3px', fontWeight: 700, textTransform: 'uppercase' }}>
                          {el.type}
                        </span>
                        <span style={{ fontSize: '11px', color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '95px' }}>
                          {el.content}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          title="Move Layer Up"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditorCanvasElements(prev => prev.map(item => item.id === el.id ? { ...item, zIndex: (item.zIndex || 10) + 2 } : item));
                            triggerToast(`Moved ${el.type} layer up! (Z: ${(el.zIndex || 10) + 2})`);
                          }}
                          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#00E676', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                        >
                          ↑
                        </button>

                        <button
                          title="Move Layer Down"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditorCanvasElements(prev => prev.map(item => item.id === el.id ? { ...item, zIndex: Math.max(1, (item.zIndex || 10) - 2) } : item));
                            triggerToast(`Moved ${el.type} layer down! (Z: ${Math.max(1, (el.zIndex || 10) - 2)})`);
                          }}
                          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#ffbd2e', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                        >
                          ↓
                        </button>

                        <button
                          title="Delete Layer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditorCanvasElements(prev => prev.filter(item => item.id !== el.id));
                          }}
                          style={{ background: 'none', border: 'none', color: '#ff4757', cursor: 'pointer', fontSize: '11px' }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* COLUMN 2: CENTER FIGMA-STYLE INTERACTIVE CANVAS WORKBENCH WITH MOUSE DRAGGING */}
            <div style={{
              background: '#06060c',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '14px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Subtle Grid Background */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }} />

              {/* Aspect Ratio Canvas Chassis with Drag Event Listener */}
              <div
                ref={canvasChassisRef}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                style={{
                  width: canvasAspectRatio === '1:1' ? '450px' : canvasAspectRatio === '9:16' ? '330px' : canvasAspectRatio === '4:5' ? '390px' : '520px',
                  height: canvasAspectRatio === '1:1' ? '450px' : canvasAspectRatio === '9:16' ? '540px' : canvasAspectRatio === '4:5' ? '480px' : '310px',
                  transform: `scale(${editorZoom / 100})`,
                  transformOrigin: 'center center',
                  position: 'relative',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  boxShadow: '0 16px 48px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.2)',
                  transition: isDraggingCanvasEl ? 'none' : 'all 0.3s ease',
                  background: '#000',
                  userSelect: 'none',
                  cursor: isDraggingCanvasEl ? 'grabbing' : 'default'
                }}
              >
                {/* Render Canvas Elements in Z-Index Order */}
                {editorCanvasElements.slice().sort((a,b) => (a.zIndex || 0) - (b.zIndex || 0)).map((el) => {
                  const isSelected = selectedElementId === el.id;

                  if (el.type === 'image') {
                    // An image layer with no source is an empty slot, not a broken icon.
                    if (!el.content) {
                      return (
                        <div
                          key={el.id}
                          onMouseDown={(e) => handleCanvasMouseDown(e, el.id)}
                          style={{
                            position: 'absolute',
                            top: `${el.y}%`,
                            left: `${el.x}%`,
                            width: `${el.width}%`,
                            height: `${el.height || 100}%`,
                            zIndex: el.zIndex || 1,
                            cursor: 'pointer',
                            background: 'linear-gradient(160deg, #16161f 0%, #0b0b12 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: isSelected && el.id !== 'el_bg' ? '2px solid #00E676' : 'none'
                          }}
                        >
                          {el.id === 'el_bg' && (
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '0 20px', lineHeight: 1.5 }}>
                              Pick a background from Media → Your Asset Vault,<br />or upload a product shot.
                            </span>
                          )}
                        </div>
                      );
                    }
                    return (
                      <img
                        key={el.id}
                        src={el.content}
                        alt="Canvas layer"
                        onMouseDown={(e) => handleCanvasMouseDown(e, el.id)}
                        style={{
                          position: 'absolute',
                          top: `${el.y}%`,
                          left: `${el.x}%`,
                          width: `${el.width}%`,
                          height: `${el.height || 100}%`,
                          objectFit: 'cover',
                          zIndex: el.zIndex || 1,
                          cursor: el.id === 'el_bg' ? 'pointer' : isDraggingCanvasEl && draggedElId === el.id ? 'grabbing' : 'grab',
                          border: isSelected && el.id !== 'el_bg' ? '2px solid #00E676' : 'none'
                        }}
                      />
                    );
                  }

                  if (el.type === 'badge') {
                    return (
                      <div
                        key={el.id}
                        onMouseDown={(e) => handleCanvasMouseDown(e, el.id)}
                        style={{
                          position: 'absolute',
                          top: `${el.y}%`,
                          left: `${el.x}%`,
                          width: 'auto',
                          background: el.bgColor || 'rgba(0,230,118,0.2)',
                          border: `${el.borderWidth || 1}px solid ${el.borderColor || '#00E676'}`,
                          color: el.color || '#00E676',
                          borderRadius: `${el.borderRadius !== undefined ? el.borderRadius : 100}px`,
                          padding: '5px 12px',
                          fontSize: `${el.fontSize || 11}px`,
                          fontWeight: el.fontWeight || 800,
                          fontFamily: el.fontFamily || 'Inter',
                          zIndex: el.zIndex || 10,
                          cursor: isDraggingCanvasEl && draggedElId === el.id ? 'grabbing' : 'grab',
                          boxShadow: isSelected ? '0 0 14px rgba(0,230,118,0.5)' : '0 4px 10px rgba(0,0,0,0.5)',
                          outline: isSelected ? '2px solid #00E676' : 'none',
                          outlineOffset: '2px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {el.content}
                      </div>
                    );
                  }

                  if (el.type === 'button') {
                    return (
                      <button
                        key={el.id}
                        onMouseDown={(e) => handleCanvasMouseDown(e, el.id)}
                        style={{
                          position: 'absolute',
                          top: `${el.y}%`,
                          left: `${el.x}%`,
                          background: el.bgColor || '#00E676',
                          color: el.color || '#000000',
                          border: `${el.borderWidth || 0}px solid ${el.borderColor || 'transparent'}`,
                          borderRadius: `${el.borderRadius !== undefined ? el.borderRadius : 8}px`,
                          padding: '7px 16px',
                          fontSize: `${el.fontSize || 12.5}px`,
                          fontWeight: el.fontWeight || 800,
                          fontFamily: el.fontFamily || 'Inter',
                          zIndex: el.zIndex || 15,
                          cursor: isDraggingCanvasEl && draggedElId === el.id ? 'grabbing' : 'grab',
                          boxShadow: isSelected ? '0 0 16px rgba(0,230,118,0.7)' : '0 6px 16px rgba(0,0,0,0.6)',
                          outline: isSelected ? '2px solid #ffffff' : 'none',
                          outlineOffset: '2px'
                        }}
                      >
                        {el.content}
                      </button>
                    );
                  }

                  // Standard Text Element
                  return (
                    <div
                      key={el.id}
                      onMouseDown={(e) => handleCanvasMouseDown(e, el.id)}
                      style={{
                        position: 'absolute',
                        top: `${el.y}%`,
                        left: `${el.x}%`,
                        width: `${el.width}%`,
                        background: el.bgColor || 'transparent',
                        border: el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor || '#00E676'}` : 'none',
                        borderRadius: `${el.borderRadius || 0}px`,
                        color: el.color || '#ffffff',
                        fontSize: `${el.fontSize || 16}px`,
                        fontWeight: el.fontWeight || 700,
                        fontFamily: el.fontFamily || 'Inter',
                        zIndex: el.zIndex || 12,
                        cursor: isDraggingCanvasEl && draggedElId === el.id ? 'grabbing' : 'grab',
                        lineHeight: 1.3,
                        outline: isSelected ? '2px solid #00E676' : 'none',
                        outlineOffset: '3px',
                        padding: '2px 4px'
                      }}
                    >
                      {el.content}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Canvas Helper Bar */}
              <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', background: '#0d0d14', padding: '5px 14px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.12)', fontSize: '10.5px', color: '#a0a0b0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>✋ Drag elements on canvas with cursor to position</span>
                <span>•</span>
                <span>Zoom: {editorZoom}%</span>
              </div>
            </div>

            {/* COLUMN 3: EXTENDED FIGMA-STYLE RIGHT PROPERTY INSPECTOR PANEL */}
            <div style={{
              background: '#0c0c14',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              maxHeight: '680px',
              overflowY: 'auto'
            }}>
              <div style={{ fontSize: '12px', color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Figma Style Inspector</span>
                <span style={{ fontSize: '10px', color: '#00E676', background: 'rgba(0,230,118,0.12)', padding: '2px 6px', borderRadius: '4px' }}>Properties</span>
              </div>

              {selectedElementId ? (() => {
                const activeEl = editorCanvasElements.find(el => el.id === selectedElementId);
                if (!activeEl) return <div style={{ fontSize: '11px', color: '#8e8e9e' }}>Select an element on canvas to edit properties.</div>;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    
                    {/* Element Label & ID */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '6px 8px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '10px', background: 'rgba(0,230,118,0.15)', color: '#00E676', padding: '2px 6px', borderRadius: '4px', fontWeight: 800, textTransform: 'uppercase' }}>
                        {activeEl.type} Element
                      </span>
                      <span style={{ fontSize: '10px', color: '#8e8e9e', fontFamily: 'monospace' }}>{activeEl.id}</span>
                    </div>

                    {/* Content Input */}
                    <div>
                      <label style={{ display: 'block', fontSize: '10.5px', color: '#8e8e9e', fontWeight: 700, marginBottom: '3px' }}>CONTENT TEXT / URL</label>
                      <textarea
                        rows={2}
                        value={activeEl.content}
                        onChange={e => {
                          const val = e.target.value;
                          setEditorCanvasElements(prev => prev.map(el => el.id === activeEl.id ? { ...el, content: val } : el));
                        }}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', background: '#12121c', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#fff', fontSize: '11.5px', outline: 'none' }}
                      />
                    </div>

                    {/* META ADS DESTINATION LINK & CTA ACTION FIELDS (FOR BUTTON & BADGE) */}
                    {['button', 'badge'].includes(activeEl.type) && (
                      <div style={{ background: 'rgba(0, 230, 118, 0.05)', border: '1px solid rgba(0, 230, 118, 0.25)', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '10.5px', color: '#00E676', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Zap size={11} /> META ADS NATIVE PAYLOAD SYNC
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '9.5px', color: '#8e8e9e', fontWeight: 700, marginBottom: '2px' }}>META CTA ACTION TYPE</label>
                          <select
                            value={(activeEl as any).ctaAction || 'SHOP_NOW'}
                            onChange={e => {
                              const val = e.target.value;
                              setEditorCanvasElements(prev => prev.map(el => el.id === activeEl.id ? { ...el, ctaAction: val as any } : el));
                            }}
                            style={{ width: '100%', padding: '5px 6px', background: '#12121c', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '5px', color: '#fff', fontSize: '11px', outline: 'none' }}
                          >
                            <option value="SHOP_NOW">SHOP_NOW (Shop Now)</option>
                            <option value="LEARN_MORE">LEARN_MORE (Learn More)</option>
                            <option value="GET_OFFER">GET_OFFER (Get Offer / 50% Off)</option>
                            <option value="SIGN_UP">SIGN_UP (Sign Up)</option>
                            <option value="BOOK_NOW">BOOK_NOW (Book Now)</option>
                            <option value="ORDER_NOW">ORDER_NOW (Order Now)</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '9.5px', color: '#8e8e9e', fontWeight: 700, marginBottom: '2px' }}>DESTINATION LANDING URL (META LINK)</label>
                          <input
                            type="text"
                            placeholder="https://your-site.com/offer"
                            value={(activeEl as any).targetUrl || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setEditorCanvasElements(prev => prev.map(el => el.id === activeEl.id ? { ...el, targetUrl: val } : el));
                            }}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '5px 6px', background: '#12121c', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '5px', color: '#fff', fontSize: '11px' }}
                          />
                        </div>

                        <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.3 }}>
                          💡 <b>Meta Recognition:</b> Jab aap Meta Ads Manager par publish karenge, toh Meta is URL link ko native <code>destination_url</code> aur CTA Action <code>{(activeEl as any).ctaAction || 'SHOP_NOW'}</code> me automapped karega.
                        </span>
                      </div>
                    )}

                    {/* Geometry Coordinates Position X / Y Inputs */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: '#8e8e9e', fontWeight: 700, marginBottom: '2px' }}>POSITION X (%)</label>
                        <input
                          type="number"
                          value={activeEl.x}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setEditorCanvasElements(prev => prev.map(el => el.id === activeEl.id ? { ...el, x: val } : el));
                          }}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '5px 6px', background: '#12121c', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '5px', color: '#fff', fontSize: '11.5px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: '#8e8e9e', fontWeight: 700, marginBottom: '2px' }}>POSITION Y (%)</label>
                        <input
                          type="number"
                          value={activeEl.y}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setEditorCanvasElements(prev => prev.map(el => el.id === activeEl.id ? { ...el, y: val } : el));
                          }}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '5px 6px', background: '#12121c', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '5px', color: '#fff', fontSize: '11.5px' }}
                        />
                      </div>
                    </div>

                    {/* Font Family & Size (if text/badge/button) */}
                    {['text', 'badge', 'button'].includes(activeEl.type) && (
                      <>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                          <label style={{ display: 'block', fontSize: '10px', color: '#8e8e9e', fontWeight: 700, marginBottom: '3px' }}>FONT FAMILY</label>
                          <select
                            value={activeEl.fontFamily || 'Inter'}
                            onChange={e => {
                              const val = e.target.value;
                              setEditorCanvasElements(prev => prev.map(el => el.id === activeEl.id ? { ...el, fontFamily: val } : el));
                            }}
                            style={{ width: '100%', padding: '5px 8px', background: '#12121c', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '5px', color: '#fff', fontSize: '11px', outline: 'none' }}
                          >
                            <option value="Inter">Inter (Modern Clean)</option>
                            <option value="Outfit">Outfit (Geometric Bold)</option>
                            <option value="Playfair Display">Playfair Display (Luxury Serif)</option>
                            <option value="Roboto Mono">Roboto Mono (Tech / Code)</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '10px', color: '#8e8e9e', fontWeight: 700, marginBottom: '2px' }}>FONT SIZE ({activeEl.fontSize || 14}px)</label>
                          <input
                            type="range"
                            min={10}
                            max={60}
                            value={activeEl.fontSize || 14}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setEditorCanvasElements(prev => prev.map(el => el.id === activeEl.id ? { ...el, fontSize: val } : el));
                            }}
                            style={{ width: '100%' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '10px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>TEXT COLOR PRESETS</label>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {['#ffffff', '#00E676', '#FFBD2E', '#FF4757', '#7C75FF', '#000000'].map(c => (
                              <button
                                key={c}
                                onClick={() => {
                                  setEditorCanvasElements(prev => prev.map(el => el.id === activeEl.id ? { ...el, color: c } : el));
                                }}
                                style={{ width: '22px', height: '22px', borderRadius: '50%', background: c, border: activeEl.color === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* BACKGROUND FILL COLOR CONTROLS */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                      <label style={{ display: 'block', fontSize: '10px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>BACKGROUND FILL COLOR</label>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {[
                          { label: 'None', val: 'transparent' },
                          { label: 'Dark', val: '#12121c' },
                          { label: 'Black', val: '#000000' },
                          { label: 'Green', val: 'rgba(0, 230, 118, 0.25)' },
                          { label: 'Gold', val: 'rgba(255, 189, 46, 0.25)' },
                          { label: 'Red', val: 'rgba(255, 71, 87, 0.25)' },
                          { label: 'Purple', val: 'rgba(124, 117, 255, 0.25)' }
                        ].map(bg => (
                          <button
                            key={bg.val}
                            onClick={() => {
                              setEditorCanvasElements(prev => prev.map(el => el.id === activeEl.id ? { ...el, bgColor: bg.val } : el));
                            }}
                            style={{ padding: '3px 8px', background: bg.val === 'transparent' ? '#000' : bg.val, border: activeEl.bgColor === bg.val ? '2px solid #00E676' : '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '4px', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            {bg.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* BORDER COLOR & WIDTH & RADIUS CONTROLS */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                      <label style={{ display: 'block', fontSize: '10px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>BORDER COLOR & WIDTH</label>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                        {['transparent', '#00E676', '#FFBD2E', '#FF4757', '#7C75FF', '#ffffff'].map(bc => (
                          <button
                            key={bc}
                            onClick={() => {
                              setEditorCanvasElements(prev => prev.map(el => el.id === activeEl.id ? { ...el, borderColor: bc, borderWidth: el.borderWidth || 1 } : el));
                            }}
                            style={{ width: '22px', height: '22px', borderRadius: '4px', background: bc === 'transparent' ? '#000' : bc, border: activeEl.borderColor === bc ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}
                          />
                        ))}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '9.5px', color: '#8e8e9e', fontWeight: 700, marginBottom: '2px' }}>BORDER WIDTH ({activeEl.borderWidth || 0}px)</label>
                          <input
                            type="range"
                            min={0}
                            max={8}
                            value={activeEl.borderWidth || 0}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setEditorCanvasElements(prev => prev.map(el => el.id === activeEl.id ? { ...el, borderWidth: val } : el));
                            }}
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '9.5px', color: '#8e8e9e', fontWeight: 700, marginBottom: '2px' }}>CORNER RADIUS ({activeEl.borderRadius || 0}px)</label>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={activeEl.borderRadius || 0}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setEditorCanvasElements(prev => prev.map(el => el.id === activeEl.id ? { ...el, borderRadius: val } : el));
                            }}
                            style={{ width: '100%' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Z-INDEX LAYER POSITIONING */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                      <label style={{ display: 'block', fontSize: '10px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>Z-INDEX LAYER ORDERING</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <button
                          onClick={() => {
                            setEditorCanvasElements(prev => prev.map(el => el.id === activeEl.id ? { ...el, zIndex: (el.zIndex || 10) + 2 } : el));
                          }}
                          style={{ background: '#12121c', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '5px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Bring Forward ↑
                        </button>
                        <button
                          onClick={() => {
                            setEditorCanvasElements(prev => prev.map(el => el.id === activeEl.id ? { ...el, zIndex: Math.max(1, (el.zIndex || 10) - 2) } : el));
                          }}
                          style={{ background: '#12121c', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '5px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Send Backward ↓
                        </button>
                      </div>
                    </div>

                    {/* Quick Layer Controls */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <button
                        onClick={() => {
                          const newEl = { ...activeEl, id: `el_dup_${Date.now()}`, y: activeEl.y + 5, x: activeEl.x + 5 };
                          setEditorCanvasElements(prev => [...prev, newEl]);
                          setSelectedElementId(newEl.id);
                          triggerToast('Duplicated element!');
                        }}
                        style={{ background: '#12121c', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '7px', borderRadius: '5px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Duplicate Element
                      </button>

                      <button
                        onClick={() => {
                          setEditorCanvasElements(prev => prev.filter(el => el.id !== activeEl.id));
                          setSelectedElementId(null);
                          triggerToast('Deleted element!');
                        }}
                        style={{ background: 'rgba(255,71,87,0.15)', border: '1px solid rgba(255,71,87,0.3)', color: '#ff4757', padding: '7px', borderRadius: '5px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Delete Element
                      </button>
                    </div>

                  </div>
                );
              })() : (
                <div style={{ fontSize: '11px', color: '#8e8e9e', textAlign: 'center', paddingTop: '30px' }}>
                  Click any text, badge, or image on the canvas to inspect & customize properties.
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {copyToast && (
        <div style={{ position: 'fixed', bottom: '40px', right: '40px', background: '#7C75FF', color: '#fff', padding: '14px 22px', borderRadius: '12px', boxShadow: '0 8px 32px rgba(124,117,255,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, fontSize: '14px' }}>
          <CheckCircle2 size={18} /> {copyToast}
        </div>
      )}

      {showMarketIntel && (
        <MarketTrendsCompetitorModal
          isOpen={showMarketIntel}
          onClose={() => setShowMarketIntel(false)}
          workspaceId={workspaceId ?? null}
          onNavigateTab={onNavigateTab}
        />
      )}

    </div>
  );
};
