import React, { useState, useRef } from 'react';
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

interface AssetItem {
  id: string;
  title: string;
  category: 'product' | 'lifestyle' | 'banner' | 'logo';
  url: string;
  dimensions: string;
  format: 'PNG' | 'JPG' | 'WEBP' | 'SVG';
  size: string;
  source: 'scraped' | 'gdrive' | 'device';
  sourceUrl?: string;
  tag: string;
}

export const WorkspaceAssets: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(false);
  const [showDriveModal, setShowDriveModal] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scraped brand images and cloud assets
  const [assets, setAssets] = useState<AssetItem[]>([
    {
      id: 'asset-1',
      title: 'NanoCharge_10000mAh_MatteBlack',
      category: 'product',
      url: 'https://images.unsplash.com/photo-1609592424368-e69d7249b2ad?auto=format&fit=crop&w=800&q=80',
      dimensions: '2048 × 2048',
      format: 'PNG',
      size: '2.4 MB',
      source: 'scraped',
      sourceUrl: 'https://demobrand.com/products/nanocharge-10k',
      tag: 'Product Hero'
    },
    {
      id: 'asset-2',
      title: 'AeroSync_MagSafe_Wireless_Snap',
      category: 'lifestyle',
      url: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=800&q=80',
      dimensions: '1920 × 1080',
      format: 'WEBP',
      size: '1.9 MB',
      source: 'scraped',
      sourceUrl: 'https://demobrand.com/collections/wireless',
      tag: 'Lifestyle Model'
    },
    {
      id: 'asset-3',
      title: 'GaN_100W_MultiPort_FastCharger',
      category: 'product',
      url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80',
      dimensions: '2400 × 2400',
      format: 'PNG',
      size: '3.1 MB',
      source: 'scraped',
      sourceUrl: 'https://demobrand.com/products/gan-100w-pro',
      tag: 'Catalog Shot'
    },
    {
      id: 'asset-4',
      title: 'Primary_Logo_Orange_Transparent',
      category: 'logo',
      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
      dimensions: 'Vector Scalable',
      format: 'SVG',
      size: '420 KB',
      source: 'scraped',
      sourceUrl: 'https://demobrand.com/assets/logo.svg',
      tag: 'Brand Identity'
    },
    {
      id: 'asset-5',
      title: 'PowerStation_40k_MacBook_Charging',
      category: 'lifestyle',
      url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80',
      dimensions: '3840 × 2160',
      format: 'JPG',
      size: '4.8 MB',
      source: 'scraped',
      sourceUrl: 'https://demobrand.com/products/powerstation-40k',
      tag: 'Desk Setup'
    },
    {
      id: 'asset-6',
      title: 'Diwali_Flash_Sale_Banner_Creative',
      category: 'banner',
      url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
      dimensions: '1200 × 628',
      format: 'PNG',
      size: '2.1 MB',
      source: 'scraped',
      sourceUrl: 'https://demobrand.com/promotions',
      tag: 'Ad Banner'
    },
    {
      id: 'asset-7',
      title: 'TWS_Pro_Earbuds_Titanium_Grey',
      category: 'product',
      url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80',
      dimensions: '2048 × 2048',
      format: 'PNG',
      size: '2.6 MB',
      source: 'scraped',
      sourceUrl: 'https://demobrand.com/products/tws-pro-audio',
      tag: 'Product Cutout'
    },
    {
      id: 'asset-8',
      title: 'AeroSync_3in1_Charging_Station',
      category: 'product',
      url: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80',
      dimensions: '2000 × 2000',
      format: 'WEBP',
      size: '1.7 MB',
      source: 'scraped',
      sourceUrl: 'https://demobrand.com/products/aerosync-3in1',
      tag: 'Product Studio'
    },
    {
      id: 'asset-9',
      title: 'Commuter_Pocket_NanoCharge_InHand',
      category: 'lifestyle',
      url: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=800&q=80',
      dimensions: '1080 × 1350',
      format: 'JPG',
      size: '2.2 MB',
      source: 'scraped',
      sourceUrl: 'https://demobrand.com/lifestyle',
      tag: 'Social UGC'
    },
    {
      id: 'asset-10',
      title: 'Secondary_Monogram_Dark_Mode',
      category: 'logo',
      url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80',
      dimensions: 'Vector Scalable',
      format: 'SVG',
      size: '310 KB',
      source: 'scraped',
      sourceUrl: 'https://demobrand.com/assets/monogram.svg',
      tag: 'Brand Icon'
    },
    {
      id: 'asset-11',
      title: 'Summer_Travel_Tech_Collection_Hero',
      category: 'banner',
      url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80',
      dimensions: '1920 × 800',
      format: 'WEBP',
      size: '3.4 MB',
      source: 'scraped',
      sourceUrl: 'https://demobrand.com/hero-banners',
      tag: 'Header Hero'
    },
    {
      id: 'asset-12',
      title: 'Braided_TypeC_100W_Cable_Closeup',
      category: 'product',
      url: 'https://images.unsplash.com/photo-1541689592655-f5f52825a3b8?auto=format&fit=crop&w=800&q=80',
      dimensions: '2048 × 2048',
      format: 'PNG',
      size: '2.8 MB',
      source: 'scraped',
      sourceUrl: 'https://demobrand.com/products/cables',
      tag: 'Macro Detail'
    }
  ]);

  const handleCopyLink = (asset: AssetItem) => {
    navigator.clipboard.writeText(asset.url);
    setCopiedId(asset.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReScrape = () => {
    setIsScraping(true);
    setTimeout(() => {
      setIsScraping(false);
      alert('Website assets scraped successfully! 12 new high-res brand media items ingested from demobrand.com.');
    }, 1500);
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
    alert(`Successfully imported ${files.length} image(s) from your device!`);
  };

  const handleConnectDrive = () => {
    setIsDriveConnected(true);
    setShowDriveModal(false);

    // Add mock Google Drive assets
    const gDriveAssets: AssetItem[] = [
      {
        id: `gdrive-1`,
        title: 'GDrive_Studio_Shoot_Raw_Master',
        category: 'lifestyle',
        url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
        dimensions: '4096 × 4096',
        format: 'PNG',
        size: '14.2 MB',
        source: 'gdrive',
        tag: 'Google Drive Sync'
      },
      {
        id: `gdrive-2`,
        title: 'GDrive_Brand_Packaging_Dielines',
        category: 'product',
        url: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=800&q=80',
        dimensions: 'Vector PDF / SVG',
        format: 'SVG',
        size: '8.4 MB',
        source: 'gdrive',
        tag: 'Packaging Master'
      }
    ];

    setAssets(prev => [...gDriveAssets, ...prev]);
    alert('Google Drive connected! Synced 2 master asset folders from "Brand Guidelines 2026".');
  };

  const categories = [
    { id: 'all', label: `All Assets (${assets.length})` },
    { id: 'product', label: `Product Shots (${assets.filter(a => a.category === 'product').length})` },
    { id: 'lifestyle', label: `Lifestyle & Shoots (${assets.filter(a => a.category === 'lifestyle').length})` },
    { id: 'banner', label: `Banners & Ads (${assets.filter(a => a.category === 'banner').length})` },
    { id: 'logo', label: `Logos & Badges (${assets.filter(a => a.category === 'logo').length})` }
  ];

  const filteredAssets = assets.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.tag.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* ── TOP HEADER & ACTIONS ───────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(0, 230, 118, 0.12)', borderRadius: '100px', border: '1px solid rgba(0, 230, 118, 0.3)', marginBottom: '10px' }}>
            <ImageIcon size={14} color="#00E676" />
            <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              SCRAPED ASSET VAULT
            </span>
          </div>
          <h2 style={{ fontSize: '28px', color: '#fff', margin: '0 0 6px 0', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
            Brand Assets & Media Library
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0, maxWidth: '750px', lineHeight: 1.5 }}>
            Scraped media assets from <strong style={{ color: '#FF6B00' }}>demobrand.com</strong>, product renders, lifestyle photography, and cloud libraries.
          </p>
        </div>

        {/* TOP RIGHT ACTION BUTTONS */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* Re-Scrape Site button */}
          <button
            onClick={handleReScrape}
            disabled={isScraping}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              padding: '9px 16px',
              borderRadius: '100px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isScraping ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} className={isScraping ? 'spin-icon' : ''} />
            <span>{isScraping ? 'Scraping Site...' : 'Re-scrape Site'}</span>
          </button>

          {/* Connect / Connected Google Drive */}
          <button
            onClick={() => setShowDriveModal(true)}
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
                    background: asset.source === 'gdrive' ? 'rgba(52,168,83,0.85)' : asset.source === 'device' ? 'rgba(124,117,255,0.85)' : 'rgba(255,107,0,0.85)',
                    color: '#fff',
                    backdropFilter: 'blur(4px)'
                  }}>
                    {asset.source === 'gdrive' ? 'Google Drive' : asset.source === 'device' ? 'Device' : 'Scraped'}
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
                  <GlowButton variant="glow" onClick={() => { setSelectedAsset(null); alert(`Asset "${selectedAsset.title}" attached to Creative Studio generator!`); }} style={{ padding: '9px 24px', fontSize: '13px' }}>
                    Use in Creative Studio 🚀
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

              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Connect your brand's Google Drive to automatically import RAW product photos, packaging vectors, video reels, and designer assets.
              </p>

              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Folders Available to Sync:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#fff' }}>
                  <FolderOpen size={14} color="#34A853" /> 📁 /Brand Guidelines 2026/Master_Renders
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#fff' }}>
                  <FolderOpen size={14} color="#34A853" /> 📁 /Product Packaging Dielines/Vectors
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#fff' }}>
                  <FolderOpen size={14} color="#34A853" /> 📁 /Influencer UGC Raw Video Footage
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => setShowDriveModal(false)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConnectDrive}
                  style={{
                    background: 'linear-gradient(135deg, #34A853 0%, #2E7D32 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '100px',
                    padding: '9px 24px',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(52,168,83,0.35)'
                  }}
                >
                  {isDriveConnected ? 'Sync Latest Files' : 'Authorize & Connect Google Drive'}
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
