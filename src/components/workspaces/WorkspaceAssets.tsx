import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  HardDrive,
  RefreshCw,
  Search,
  Grid,
  List,
  Download,
  Copy,
  Check,
  Eye,
  Trash2,
  ExternalLink,
  Plus,
  X,
  CheckCircle2,
  SlidersHorizontal,
  Image as ImageIcon,
  Sparkles,
  Layers,
  FolderOpen
} from 'lucide-react';
import { GlowButton } from '../GlowButton';
import {
  isDriveConfigured,
  hasValidToken,
  getAccessToken,
  disconnectDrive,
  listFolders,
  listImageFiles,
  fetchFileObjectUrl,
  formatBytes,
  mimeToFormat,
  DriveError,
  type DriveFolder,
  type DriveFile
} from '../../lib/googleDrive';

interface AssetItem {
  id: string;
  title: string;
  category: 'product' | 'lifestyle' | 'banner' | 'logo';
  url: string;
  dimensions: string;
  format: 'PNG' | 'JPG' | 'WEBP' | 'SVG';
  size: string;
  source: 'generated' | 'scraped' | 'gdrive' | 'device';
  sourceUrl?: string;
  tag: string;
}

interface WorkspaceAssetsProps {
  /** Real generated creatives for this workspace, from GET /workspaces/{id}/creatives. */
  creatives?: { id: string; headline: string; type: string; imageUrl?: string }[];
  /** Opens Creative Studio with this asset as the reference image. */
  onUseAsset?: (url: string, title: string) => void;
  /** Required to read or write the persisted vault. */
  workspaceId?: number | null;
}

export const WorkspaceAssets: React.FC<WorkspaceAssetsProps> = ({ creatives = [], onUseAsset, workspaceId = null }) => {
  const [uploadNote, setUploadNote] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(false);
  const [showDriveModal, setShowDriveModal] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Real Google Drive state ──────────────────────────────────────────────
  const [driveStatus, setDriveStatus] = useState<'idle' | 'connecting' | 'loading' | 'ready' | 'error'>('idle');
  const [driveError, setDriveError] = useState<string>('');
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | undefined>(undefined);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  // A token survives a reload, so restore the real connection state.
  useEffect(() => {
    if (!isDriveConfigured() || !hasValidToken()) return;
    setIsDriveConnected(true);
    setDriveStatus('loading');
    (async () => {
      try {
        const token = await getAccessToken();
        const [folders, files] = await Promise.all([listFolders(token), listImageFiles(token)]);
        setDriveFolders(folders);
        setDriveFiles(files);
        setDriveStatus('ready');
      } catch {
        // Token was revoked server-side — fall back to disconnected.
        setIsDriveConnected(false);
        setDriveStatus('idle');
      }
    })();
  }, []);

  // Scraped brand images and cloud assets
  // Starts empty and is filled from the creatives prop below. It was seeded with twelve
  // Unsplash stock photos carrying invented filenames and file sizes, presented as this
  // brand's own scraped product shots - so the vault looked full even for a workspace that
  // had generated nothing.
  const [assets, setAssets] = useState<AssetItem[]>([]);

  // Dimensions and byte size are not stored for generated creatives, so they read "-"
  // rather than inventing plausible-looking numbers. Drive and device imports keep theirs.
  useEffect(() => {
    const mapped: AssetItem[] = (creatives || [])
      .filter((cr) => !!cr.imageUrl)
      .map((cr) => ({
        id: `creative-${cr.id}`,
        title: cr.headline || `Creative ${cr.id}`,
        category: 'product' as const,
        url: cr.imageUrl as string,
        dimensions: '\u2014',
        format: 'JPG' as const,
        size: '\u2014',
        source: 'generated' as const,
        tag: cr.type || 'Generated creative',
      }));
    setAssets((prev) => [...mapped, ...prev.filter((a) => a.source !== 'generated')]);
  }, [creatives]);

  const handleCopyLink = (asset: AssetItem) => {
    navigator.clipboard.writeText(asset.url);
    setCopiedId(asset.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // The vault's persisted assets: everything scraped from the brand's own site, plus
  // anything imported from Drive or uploaded. Previously nothing populated `source:
  // 'scraped'` at all, so a brand's own product photography never appeared here.
  const [harvesting, setHarvesting] = useState(false);
  const [vaultNote, setVaultNote] = useState<string>('');

  const authHeaders = (): Record<string, string> => {
    const t = localStorage.getItem('token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  /** Maps a stored MediaAsset onto the shape this component renders. */
  const toAssetItem = (a: any): AssetItem => ({
    id: `vault-${a.id}`,
    title: (a.alt_text || a.filename || 'Asset').replace(/\.[^/.]+$/, ''),
    category: a.category === 'product_shots' ? 'product'
      : a.category === 'banners' ? 'banner'
      : a.category === 'logos' ? 'logo' : 'lifestyle',
    url: a.url,
    dimensions: a.dimensions || '—',
    format: (a.format === 'JPEG' ? 'JPG' : (a.format || 'PNG')) as AssetItem['format'],
    size: a.size_kb ? `${(a.size_kb / 1024).toFixed(2)} MB` : '—',
    source: a.source === 'scraped' ? 'scraped' : a.source === 'gdrive' ? 'gdrive' : 'device',
    sourceUrl: a.source_url || undefined,
    tag: a.source === 'scraped' ? 'From your website' : 'Imported',
  });

  const loadVault = React.useCallback(() => {
    if (!workspaceId) return;
    fetch(`/api/workspaces/${workspaceId}/assets`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const rows: AssetItem[] = Array.isArray(d?.assets) ? d.assets.map(toAssetItem) : [];
        // Generated creatives come from the `creatives` prop, so only the persisted rows
        // are replaced here - otherwise the two sources would keep clearing each other.
        setAssets(prev => [...prev.filter(a => a.source === 'generated'), ...rows]);
      })
      .catch(() => {})
  }, [workspaceId]);

  useEffect(() => { loadVault(); }, [loadVault]);

  /** Pulls every usable image off the brand's own website into the vault.
   *  This button used to sleep 1.5s and claim "12 new high-res brand media items ingested
   *  from demobrand.com" - a count and a domain both invented, with nothing added. It now
   *  calls the harvest endpoint and reports what was actually stored. */
  const handleScrapeSite = async () => {
    if (!workspaceId) return;
    setHarvesting(true);
    setVaultNote('');
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/assets/harvest?max_images=24`, {
        method: 'POST', headers: authHeaders(),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || `Harvest failed (${r.status})`);
      setVaultNote(d.note || `Imported ${d.imported} asset${d.imported === 1 ? '' : 's'} from your website${d.replaced ? ` (replaced ${d.replaced} previously scraped)` : ''}.`);
      loadVault();
    } catch (e) {
      setVaultNote(e instanceof Error ? e.message : 'Could not read your website.');
    } finally {
      setHarvesting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newUploaded: AssetItem[] = Array.from(files).map((file, i) => ({
      id: `device-${Date.now()}-${i}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      category: 'product',
      url: URL.createObjectURL(file),
      dimensions: 'Original Upload',
      format: (file.name.split('.').pop()?.toUpperCase() as any) || 'PNG',
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      source: 'device',
      tag: 'Device Upload'
    }));

    setAssets(prev => [...newUploaded, ...prev]);
    setShowUploadModal(false);
    // These are object URLs held in this tab, not uploads: nothing is sent anywhere, and
    // they are gone on refresh. Saying "Successfully imported" implied a library that
    // persisted them. Server-side storage needs SUPABASE_URL / SUPABASE_KEY set and
    // media_routes mounted - neither is true yet.
    setUploadNote(`${files.length} file${files.length > 1 ? 's' : ''} added for this session. They are not uploaded, so they will be gone if you refresh.`);
  };

  /** Real OAuth + Drive listing. Opens Google's consent screen. */
  const handleAuthorizeDrive = async () => {
    setDriveError('');
    setDriveStatus('connecting');
    try {
      const token = await getAccessToken();
      setDriveStatus('loading');
      const [folders, files] = await Promise.all([listFolders(token), listImageFiles(token)]);
      setDriveFolders(folders);
      setDriveFiles(files);
      setIsDriveConnected(true);
      setDriveStatus('ready');
    } catch (err) {
      setDriveError(err instanceof DriveError ? err.message : 'Could not connect to Google Drive.');
      setDriveStatus('error');
      setIsDriveConnected(false);
    }
  };

  /** Re-lists files when a real folder is chosen. */
  const handleSelectFolder = async (folderId?: string) => {
    setActiveFolderId(folderId);
    setDriveError('');
    setDriveStatus('loading');
    try {
      const token = await getAccessToken();
      setDriveFiles(await listImageFiles(token, folderId));
      setDriveStatus('ready');
    } catch (err) {
      setDriveError(err instanceof DriveError ? err.message : 'Could not list files.');
      setDriveStatus('error');
    }
  };

  const toggleFileSelection = (id: string) => {
    setSelectedFileIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  /** Downloads the chosen Drive files and adds them as real assets. */
  const handleImportSelected = async () => {
    if (selectedFileIds.length === 0) return;
    setIsImporting(true);
    setDriveError('');
    try {
      const token = await getAccessToken();
      const chosen = driveFiles.filter(f => selectedFileIds.includes(f.id));

      const imported: AssetItem[] = await Promise.all(
        chosen.map(async file => ({
          id: `gdrive-${file.id}`,
          title: file.name.replace(/\.[^.]+$/, ''),
          category: 'product' as const,
          url: await fetchFileObjectUrl(file.id, token),
          dimensions: file.width && file.height ? `${file.width} × ${file.height}` : 'Unknown',
          format: mimeToFormat(file.mimeType),
          size: formatBytes(file.sizeBytes),
          source: 'gdrive' as const,
          sourceUrl: file.webViewLink,
          tag: 'Google Drive Sync'
        }))
      );

      // Persist them. Drive imports previously only ever reached React state, so they were
      // gone on refresh - which is why imported assets "did not appear correctly" in the
      // vault. The webViewLink is stored rather than the blob: URL, because an object URL
      // is meaningless outside the tab that created it.
      if (workspaceId) {
        try {
          await fetch(`/api/workspaces/${workspaceId}/assets/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(chosen.map(f => ({
              filename: f.name,
              url: f.webViewLink,
              category: 'lifestyle',
              source: 'gdrive',
              mime_type: f.mimeType,
              file_format: mimeToFormat(f.mimeType),
              size_kb: f.sizeBytes ? Math.round(f.sizeBytes / 1024) : null,
            }))),
          });
          loadVault();
        } catch { /* the session copy below still shows them */ }
      }

      // Replace any re-imported file rather than duplicating it.
      setAssets(prev => [...imported, ...prev.filter(a => !imported.some(i => i.id === a.id))]);
      setSelectedFileIds([]);
      setShowDriveModal(false);
    } catch (err) {
      setDriveError(err instanceof DriveError ? err.message : 'Import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDisconnectDrive = () => {
    disconnectDrive();
    setIsDriveConnected(false);
    setDriveStatus('idle');
    setDriveFolders([]);
    setDriveFiles([]);
    setSelectedFileIds([]);
    setActiveFolderId(undefined);
    setAssets(prev => prev.filter(a => a.source !== 'gdrive'));
  };

  const categories = [
    // Filtered by source rather than by product/lifestyle/banner/logo: that categorisation
    // is not stored for any asset, so three of those four buckets always read (0).
    { id: 'all', label: `All Assets (${assets.length})` },
    { id: 'generated', label: `Generated (${assets.filter(a => a.source === 'generated').length})` },
    { id: 'gdrive', label: `Google Drive (${assets.filter(a => a.source === 'gdrive').length})` },
    { id: 'device', label: `Uploaded (${assets.filter(a => a.source === 'device').length})` }
  ];

  const filteredAssets = assets.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.source === activeCategory;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.tag.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {vaultNote && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '12px 16px',
          borderRadius: '10px', fontSize: '13px', lineHeight: 1.55,
          background: 'rgba(90,82,255,0.08)', border: '1px solid rgba(90,82,255,0.32)', color: '#b7b2ff',
        }}>
          <span style={{ flex: 1 }}>{vaultNote}</span>
          <button
            onClick={() => setVaultNote('')}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {uploadNote && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '12px 16px',
          borderRadius: '10px', fontSize: '13px', lineHeight: 1.55,
          background: 'rgba(255,193,7,0.07)', border: '1px solid rgba(255,193,7,0.28)', color: '#ffc107',
        }}>
          <span style={{ flex: 1 }}>{uploadNote}</span>
          <button onClick={() => setUploadNote('')}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
            ✕
          </button>
        </div>
      )}

      {/* ── TOP HEADER & ACTIONS ───────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(0, 230, 118, 0.12)', borderRadius: '100px', border: '1px solid rgba(0, 230, 118, 0.3)', marginBottom: '10px' }}>
            <ImageIcon size={14} color="#00E676" />
            <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              CREATIVE LIBRARY
            </span>
          </div>
          <h2 style={{ fontSize: '28px', color: '#fff', margin: '0 0 6px 0', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
            Brand Assets & Media Library
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0, maxWidth: '750px', lineHeight: 1.5 }}>
            Every creative generated for this workspace, plus anything you import from Drive or your device.
          </p>
        </div>

        {/* TOP RIGHT ACTION BUTTONS */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* Import from the brand's own website. Restored now that a real harvest endpoint
              exists - it reports the count the server actually stored. */}
          <button
            onClick={handleScrapeSite}
            disabled={harvesting || !workspaceId}
            title={workspaceId ? 'Read every usable image off your website into the vault'
                               : 'Open a workspace first'}
            style={{
              background: 'rgba(90, 82, 255, 0.14)',
              border: '1px solid rgba(90, 82, 255, 0.42)',
              color: '#fff', padding: '9px 18px', borderRadius: '100px',
              fontSize: '13px', fontWeight: 700,
              cursor: harvesting || !workspaceId ? 'default' : 'pointer',
              opacity: harvesting || !workspaceId ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <RefreshCw size={14} className={harvesting ? 'spin-animation' : undefined} />
            {harvesting ? 'Reading your site…' : 'Import from Website'}
          </button>

          {/* Connect / Connected Google Drive */}
          <button
            onClick={() => { setDriveError(''); setShowDriveModal(true); }}
            style={{
              background: isDriveConnected ? 'rgba(52, 168, 83, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              border: isDriveConnected ? '1px solid rgba(52, 168, 83, 0.4)' : '1px solid rgba(255, 255, 255, 0.15)',
              color: isDriveConnected ? '#34A853' : '#fff',
              padding: '9px 18px',
              borderRadius: '100px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <HardDrive size={15} color={isDriveConnected ? '#34A853' : '#fff'} />
            <span>{isDriveConnected ? '✓ Google Drive Connected' : 'Connect Google Drive'}</span>
          </button>

          {/* Import from Device */}
          <GlowButton
            variant="glow"
            onClick={() => setShowUploadModal(true)}
            style={{
              fontSize: '13px',
              padding: '9px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Upload size={15} />
            <span>Import from Device</span>
          </GlowButton>
        </div>
      </div>

      {/* ── FILTER TABS & SEARCH BAR ───────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Category tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                background: activeCategory === cat.id ? 'rgba(255, 107, 0, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                border: '1px solid',
                borderColor: activeCategory === cat.id ? '#FF6B00' : 'rgba(255, 255, 255, 0.08)',
                color: activeCategory === cat.id ? '#FF6B00' : 'var(--text-secondary)',
                padding: '8px 18px',
                borderRadius: '100px',
                fontSize: '13px',
                fontWeight: activeCategory === cat.id ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search & Layout toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '100px',
                color: '#fff',
                fontSize: '12.5px',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '2px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? 'rgba(255,255,255,0.12)' : 'transparent',
                border: 'none',
                color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)',
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Grid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                background: viewMode === 'list' ? 'rgba(255,255,255,0.12)' : 'transparent',
                border: 'none',
                color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <List size={14} />
            </button>
          </div>
        </div>

      </div>

      {/* ── ASSETS GALLERY ─────────────────────────────────────────── */}
      {filteredAssets.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '20px' }}>
          <ImageIcon size={32} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
          <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 6px 0' }}>No assets found</h4>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Try clearing your search or import new media from your device.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {filteredAssets.map((asset) => (
            <div
              key={asset.id}
              className="glow-card"
              style={{
                background: 'linear-gradient(180deg, rgba(20, 20, 30, 0.8) 0%, rgba(10, 10, 16, 0.95) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '18px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              {/* Image Preview Container */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '190px',
                  background: '#050508',
                  overflow: 'hidden',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedAsset(asset)}
              >
                <img
                  src={asset.url}
                  alt={asset.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform 0.3s ease'
                  }}
                />

                {/* Source Badge */}
                <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '6px' }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '100px',
                    background: asset.source === 'gdrive' ? 'rgba(52,168,83,0.85)' : asset.source === 'device' ? 'rgba(124,117,255,0.85)' : 'rgba(90,82,255,0.85)',
                    color: '#fff',
                    backdropFilter: 'blur(4px)'
                  }}>
                    {asset.source === 'gdrive' ? 'Google Drive' : asset.source === 'device' ? 'Device' : 'Generated'}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '100px',
                    background: 'rgba(0,0,0,0.7)',
                    color: '#fff',
                    backdropFilter: 'blur(4px)'
                  }}>
                    {asset.format}
                  </span>
                </div>

                {/* Hover overlay preview button */}
                <div
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.65)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff'
                  }}
                >
                  <Eye size={14} />
                </div>
              </div>

              {/* Card Body */}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '14px', color: '#fff', margin: '0 0 4px 0', fontWeight: 700, wordBreak: 'break-all' }}>
                    {asset.title}
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    <span>{asset.dimensions}</span>
                    <span>{asset.size}</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#FF6B00', fontWeight: 600 }}>{asset.tag}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleCopyLink(asset)}
                      title="Copy URL"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: 'none',
                        color: copiedId === asset.id ? '#00E676' : '#fff',
                        padding: '6px',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      {copiedId === asset.id ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open full size"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        color: '#fff',
                        padding: '6px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        textDecoration: 'none'
                      }}
                    >
                      <Download size={13} />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIST VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredAssets.map((asset) => (
            <div
              key={asset.id}
              className="glow-card"
              style={{
                padding: '12px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#0a0a12',
                borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <img src={asset.url} alt={asset.title} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px' }} />
                <div>
                  <h4 style={{ fontSize: '14px', color: '#fff', margin: '0 0 2px 0', fontWeight: 700 }}>{asset.title}</h4>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    <span>{asset.dimensions}</span>
                    <span>•</span>
                    <span>{asset.format}</span>
                    <span>•</span>
                    <span>{asset.size}</span>
                    <span>•</span>
                    <span style={{ color: '#FF6B00' }}>{asset.tag}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setSelectedAsset(asset)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '100px', fontSize: '12px', cursor: 'pointer' }}
                >
                  Preview
                </button>
                <button
                  onClick={() => handleCopyLink(asset)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: copiedId === asset.id ? '#00E676' : '#fff', padding: '6px 14px', borderRadius: '100px', fontSize: '12px', cursor: 'pointer' }}
                >
                  {copiedId === asset.id ? 'Copied ✓' : 'Copy Link'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ASSET INSPECT MODAL ────────────────────────────────────── */}
      <AnimatePresence>
        {selectedAsset && (
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
              backdropFilter: 'blur(10px)',
              padding: '20px'
            }}
            onClick={() => setSelectedAsset(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '680px',
                background: '#0a0a12',
                border: '1px solid rgba(255, 107, 0, 0.35)',
                borderRadius: '24px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
              }}
            >
              <div style={{ position: 'relative', width: '100%', maxHeight: '420px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={selectedAsset.url} alt={selectedAsset.title} style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }} />
                <button
                  onClick={() => setSelectedAsset(null)}
                  style={{ position: 'absolute', top: '14px', right: '14px', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800 }}>
                    {selectedAsset.title}
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Source: {selectedAsset.sourceUrl || selectedAsset.source}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Dimensions</span>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>{selectedAsset.dimensions}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Format</span>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#FF6B00', marginTop: '2px' }}>{selectedAsset.format}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>File Size</span>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#00E676', marginTop: '2px' }}>{selectedAsset.size}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                  <button
                    onClick={() => handleCopyLink(selectedAsset)}
                    style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Copy Link
                  </button>
                  {/* Hands the asset to Creative Studio as a reference image, which its
                      generate endpoint already accepts. It used to alert "attached to
                      Creative Studio generator!" and attach nothing. */}
                  <GlowButton
                    variant="glow"
                    onClick={() => { onUseAsset?.(selectedAsset.url, selectedAsset.title); setSelectedAsset(null); }}
                    disabled={!onUseAsset}
                    style={{ padding: '9px 24px', fontSize: '13px' }}
                  >
                    Use in Creative Studio
                  </GlowButton>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── GOOGLE DRIVE CONNECT MODAL ─────────────────────────────── */}
      <AnimatePresence>
        {showDriveModal && (
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
                maxWidth: '520px',
                background: '#0a0a12',
                border: '1px solid rgba(52, 168, 83, 0.4)',
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
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(52, 168, 83, 0.15)', border: '1px solid rgba(52, 168, 83, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <HardDrive size={24} color="#34A853" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '19px', color: '#fff', margin: '0 0 2px 0', fontWeight: 800 }}>
                      Google Drive Cloud Sync
                    </h3>
                    <span style={{ fontSize: '11.5px', color: '#34A853', fontWeight: 600 }}>Real-time Asset Folder Sync</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowDriveModal(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              {!isDriveConfigured() ? (
                <div style={{ background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.35)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#FFC107' }}>Setup required</span>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Add a Google OAuth client ID to your <code style={{ color: '#fff' }}>.env</code> file as{' '}
                    <code style={{ color: '#fff' }}>VITE_GOOGLE_CLIENT_ID</code>, then restart the dev server.
                    Create one in the Google Cloud Console under APIs &amp; Services → Credentials, enable the
                    Drive API, and add this app's origin to the authorized JavaScript origins.
                  </span>
                </div>
              ) : (
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Connect your brand's Google Drive to import real product photos, packaging vectors and
                  designer assets straight from your folders.
                </p>
              )}

              {driveError && (
                <div style={{ background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.4)', borderRadius: '12px', padding: '12px 14px', fontSize: '12.5px', color: '#ff8a80' }}>
                  {driveError}
                </div>
              )}

              {isDriveConnected && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Your Drive Folders
                  </span>
                  <button
                    onClick={() => handleSelectFolder(undefined)}
                    style={{ background: activeFolderId === undefined ? 'rgba(52,168,83,0.15)' : 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#fff', padding: '6px 8px', borderRadius: '8px' }}
                  >
                    <FolderOpen size={14} color="#34A853" /> All images
                  </button>
                  {driveFolders.map(folder => (
                    <button
                      key={folder.id}
                      onClick={() => handleSelectFolder(folder.id)}
                      style={{ background: activeFolderId === folder.id ? 'rgba(52,168,83,0.15)' : 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#fff', padding: '6px 8px', borderRadius: '8px' }}
                    >
                      <FolderOpen size={14} color="#34A853" /> {folder.path}
                    </button>
                  ))}
                  {driveFolders.length === 0 && driveStatus === 'ready' && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No folders found.</span>
                  )}
                </div>
              )}

              {isDriveConnected && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {driveStatus === 'loading' ? 'Loading files…' : `Select files to import (${selectedFileIds.length} chosen)`}
                  </span>
                  <div style={{ maxHeight: '190px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {driveFiles.map(file => {
                      const checked = selectedFileIds.includes(file.id);
                      return (
                        <button
                          key={file.id}
                          onClick={() => toggleFileSelection(file.id)}
                          style={{ background: checked ? 'rgba(52,168,83,0.15)' : 'rgba(255,255,255,0.03)', border: checked ? '1px solid rgba(52,168,83,0.5)' : '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '9px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}
                        >
                          {checked ? <Check size={14} color="#34A853" /> : <ImageIcon size={14} color="var(--text-muted)" />}
                          <span style={{ flex: 1, fontSize: '12.5px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {file.name}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatBytes(file.sizeBytes)}</span>
                        </button>
                      );
                    })}
                    {driveFiles.length === 0 && driveStatus === 'ready' && (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No images in this folder.</span>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => setShowDriveModal(false)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                {isDriveConnected && (
                  <button
                    onClick={handleDisconnectDrive}
                    style={{ background: 'transparent', border: '1px solid rgba(244,67,54,0.4)', color: '#ff8a80', padding: '9px 18px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Disconnect
                  </button>
                )}
                <button
                  onClick={isDriveConnected ? handleImportSelected : handleAuthorizeDrive}
                  disabled={
                    !isDriveConfigured() ||
                    driveStatus === 'connecting' ||
                    isImporting ||
                    (isDriveConnected && selectedFileIds.length === 0)
                  }
                  style={{
                    background:
                      !isDriveConfigured() || (isDriveConnected && selectedFileIds.length === 0) || isImporting
                        ? 'rgba(255,255,255,0.12)'
                        : 'linear-gradient(135deg, #34A853 0%, #2E7D32 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '100px',
                    padding: '9px 24px',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor:
                      !isDriveConfigured() || (isDriveConnected && selectedFileIds.length === 0) || isImporting
                        ? 'not-allowed'
                        : 'pointer',
                    boxShadow: '0 4px 14px rgba(52,168,83,0.35)'
                  }}
                >
                  {driveStatus === 'connecting'
                    ? 'Waiting for Google…'
                    : isImporting
                      ? 'Importing…'
                      : isDriveConnected
                        ? `Import ${selectedFileIds.length || ''} file${selectedFileIds.length === 1 ? '' : 's'}`.replace('  ', ' ')
                        : 'Authorize & Connect Google Drive'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── IMPORT FROM DEVICE MODAL ───────────────────────────────── */}
      <AnimatePresence>
        {showUploadModal && (
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
                maxWidth: '520px',
                background: '#0a0a12',
                border: '1px solid rgba(255, 107, 0, 0.35)',
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
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255, 107, 0, 0.15)', border: '1px solid rgba(255, 107, 0, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Upload size={24} color="#FF6B00" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '19px', color: '#fff', margin: '0 0 2px 0', fontWeight: 800 }}>
                      Import Images from Device
                    </h3>
                    <span style={{ fontSize: '11.5px', color: '#FF6B00', fontWeight: 600 }}>Supports PNG, JPG, WEBP, SVG</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowUploadModal(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />

              {/* Dropzone container */}
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '40px 20px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '2px dashed rgba(255, 107, 0, 0.4)',
                  borderRadius: '16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255, 107, 0, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Upload size={26} color="#FF6B00" />
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                    Click to browse or drag & drop files
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    High-res product photos, lifestyle shoots, or brand banners (Max 25MB each)
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => setShowUploadModal(false)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <GlowButton variant="glow" onClick={() => fileInputRef.current?.click()} style={{ fontSize: '13px', padding: '9px 24px' }}>
                  Select Files from Computer
                </GlowButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
