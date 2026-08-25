import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Globe,
  Palette,
  Type,
  Layers,
  Target,
  FileText,
  ShieldCheck,
  Zap,
  Tag,
  Users,
  Compass,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Plus
} from 'lucide-react';
import { GlowButton } from '../GlowButton';

export const BrandKnowledgeBase: React.FC = () => {
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [activeKnowledgeTab, setActiveKnowledgeTab] = useState<string>('overview');
  const [targetMessages, setTargetMessages] = useState<string[]>([
    'High-power 65W–100W GaN laptop power banks with multi-port fast charging.',
    'Qi2 certified magnetic wireless snap charging for iPhone and Android devices.',
    'Pocket-sized 10,000mAh NanoCharge with in-built Type-C & Lightning cables.',
    '12-Month warranty, 24x7 priority support, 4.8+ star rating across 500k+ customers.'
  ]);
  const [newMessageInput, setNewMessageInput] = useState('');
  const [showAddMessage, setShowAddMessage] = useState(false);

  const colors = [
    { name: 'Demo Orange (Primary Accent)', hex: '#FF6B00', role: 'Sale & Conversion CTAs' },
    { name: 'Tech Cyan Glow', hex: '#00D2FF', role: 'Electronics & Fast-Charging Badges' },
    { name: 'Obsidian Charcoal', hex: '#0D0D14', role: 'Technical Interface & Dark Theme' },
    { name: 'Pure White Space', hex: '#FFFFFF', role: 'Clarity & Product Showcases' }
  ];

  const handleCopy = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedColor(hex);
    setTimeout(() => setCopiedColor(null), 2000);
  };

  const handleAddMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageInput.trim()) return;
    setTargetMessages(prev => [...prev, newMessageInput.trim()]);
    setNewMessageInput('');
    setShowAddMessage(false);
  };

  const knowledgeSections = [
    {
      id: 'overview',
      title: 'Brand Overview',
      content: `Demo Brand is a modern direct-to-consumer lifestyle electronics brand founded in 2022. Its online storefront centers on making advanced, high-performance technology accessible to everyday consumers worldwide. The product range spans high-capacity power banks, ultra-compact GaN wall chargers, Qi2 magnetic wireless charging pads, smart desk accessories, audio gear, and lifestyle tech gadgets.\n\nThe storefront is commerce-led and conversion-optimized, organizing its offerings around new arrivals, curated top picks, best-selling charging accessories, customer review ratings, promotional discount bundles, and product-specific calls to action. Prices are displayed with dynamic currency detection, with promotional welcome code DEMO10 highlighted in the header.`
    },
    {
      id: 'usps',
      title: 'Unique Selling Points (USPs)',
      content: `Demo Brand's core value proposition combines accessible direct-to-consumer pricing with cutting-edge charging architecture. Its power-bank lineup emphasizes versatile capacities ranging from pocket-ready 10,000mAh daily packs to high-output 40,000mAh power stations capable of full-speed MacBook and laptop charging. Key differentiators include integrated braided cables, MagSafe-compatible magnetic snap alignment, Qi2 certification, semi-solid battery cells, universal Type-C PD 3.1, and rapid fast charging up to 100W.\n\nThe brand also provides smart GaN chargers with real-time digital power displays, multi-port dynamic load balancing, and AC socket pass-throughs. Purchase reassurance is backed by a 4.8+ customer satisfaction rating, fast worldwide fulfillment, 12-month replacement warranty, and 24x7 customer assistance.`
    },
    {
      id: 'features',
      title: 'Key Features & Benefits',
      content: `The catalogue caters to diverse mobile lifestyles and work setups. Compact products such as the NanoCharge series offer ultra-portable backup power with built-in fold-out cables for commuters and students. High-capacity power stations deliver all-day endurance for digital nomads and power users running multiple laptops and tablets simultaneously. The AeroSync magnetic wireless range eliminates cable clutter for modern smartphone users.\n\nBeyond power solutions, Demo Brand offers productivity-enhancing desk tech: multi-angle ergonomic stands, wireless precision mice with 4-way scroll wheels, and 3-in-1 wireless adapters. Transparent sale pricing alongside MSRP highlights customer savings, while verified buyer reviews and technical specification badges make comparison effortless.`
    },
    {
      id: 'slogan',
      title: 'Brand Slogan & Mission',
      content: `Mission: To empower modern digital lifestyles through accessible, high-performance technology, intuitive ergonomics, and sustainable hardware design.\n\nTagline: "Engineered for Everyday Velocity."`
    },
    {
      id: 'personality',
      title: 'Brand Personality',
      content: `Demo Brand projects a sleek, capable, approachable, and innovative character. It balances deep technical credibility—leveraging industry standards like Qi2, GaN III, USB-PD 3.1, and MagSafe—with an intuitive, human-first design philosophy. Rooted in utility and performance rather than overpriced luxury, the brand maintains an energetic, forward-looking identity.`
    },
    {
      id: 'visual',
      title: 'Visual Design & Brand Identity',
      content: `The visual design language is anchored in clean digital-retail aesthetics: deep obsidian and charcoal dark modes, crisp white product canvas areas, energetic Demo Orange accents for key interaction triggers, and vibrant Tech Cyan glows for charging and connectivity badges. Typography is led by Figtree for bold geometric display headers and Inter for ultra-legible specification charts and body copy.`
    },
    {
      id: 'competitive',
      title: 'Competitive Position',
      content: `Demo Brand competes in the global premium-value consumer tech accessories segment. It differentiates itself through unified ecosystem aesthetics, transparent technical specs, direct-to-consumer cost efficiencies, and rapid iteration on emerging charging standards (such as Qi2 and 140W GaN).`
    },
    {
      id: 'tone',
      title: 'Tone of Voice',
      content: `Direct, confident, functional, and benefit-driven. Product copy highlights measurable technical metrics—wattage, mAh capacity, thermal dissipation, and cross-device compatibility—then clearly connects them to everyday tangible benefits like zero downtime, lightweight travel, and rapid top-ups.`
    }
  ];

  const mediaAssets = [
    { title: 'Hero_Shot_Lifestyle_Render_png', type: 'Hero Image (PNG)', size: '2.4 MB', tag: 'Hero Banner' },
    { title: 'TWS_Pro_Wireless_Earbuds', type: 'Audio / Render', size: '1.8 MB', tag: 'Product Showcase' },
    { title: 'Lifestyle_Shoot_Square_01_Demo', type: 'Lifestyle Shoot (Square)', size: '3.1 MB', tag: 'Social / D2C' },
    { title: 'Artboard_Ad_Creative_MultiPort', type: 'Vector Asset / Artboard', size: '1.2 MB', tag: 'Ad Creative' },
    { title: 'Magnetic_Qi2_PowerBank_Concept', type: 'AeroSync 3D Model', size: '4.2 MB', tag: 'Product Renders' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* ── TOP HERO HEADER ───────────────────────────────────────── */}
      <div
        className="glow-card"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 107, 0, 0.12) 0%, rgba(13, 13, 20, 0.95) 100%)',
          border: '1px solid rgba(255, 107, 0, 0.35)',
          borderRadius: '24px',
          padding: '28px 32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '18px',
                background: '#000000',
                border: '2px solid #FF6B00',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(255, 107, 0, 0.35)'
              }}
            >
              <span style={{ fontSize: '32px', fontWeight: 900, color: '#FF6B00', fontFamily: 'var(--font-heading)' }}>D</span>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '28px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                  Demo Brand
                </h1>
                <span style={{ fontSize: '11px', background: 'rgba(0, 230, 118, 0.15)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.3)', padding: '3px 10px', borderRadius: '100px', fontWeight: 700 }}>
                  ✓ Ingested & Active
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <a
                  href="https://demobrand.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '13.5px', color: '#FF6B00', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600 }}
                >
                  <Globe size={14} /> https://demobrand.com/ <ExternalLink size={12} />
                </a>
                <span style={{ color: 'var(--text-muted)' }}>•</span>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Direct-to-Consumer Lifestyle Tech (Est. 2022)</span>
                <span style={{ color: 'var(--text-muted)' }}>•</span>
                <span style={{ fontSize: '13px', color: '#FFB300', fontWeight: 600 }}>⭐ 4.8+ Verified Rating</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => alert('Demo Brand Guidelines exported as JSON!')}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                borderRadius: '100px',
                padding: '9px 20px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Export Kit
            </button>
            <GlowButton variant="glow" onClick={() => alert('Brand Knowledge Graph re-indexed with latest specs!')} style={{ fontSize: '13px', padding: '9px 22px' }}>
              <Sparkles size={14} /> Sync Knowledge Graph
            </GlowButton>
          </div>
        </div>
      </div>

      {/* ── 1. LOGO, COLOR PALETTE & TYPOGRAPHY ───────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        
        {/* LOGO BOX */}
        <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <ImageIcon size={18} color="#FF6B00" />
            <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
              Brand Logos
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ background: '#000000', border: '1px solid rgba(255, 107, 0, 0.3)', borderRadius: '14px', padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#FF6B00', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                DEMO BRAND
              </div>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Primary_logo_orange</span>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>image_1745 • Vector SVG</div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '14px', padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#000000', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                DEMO BRAND
              </div>
              <span style={{ fontSize: '11px', color: '#666', fontWeight: 600 }}>Secondary Monogram</span>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>Dark Text on Light Space</div>
            </div>
          </div>
        </div>

        {/* TYPOGRAPHY BOX */}
        <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Type size={18} color="#00D2FF" />
            <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
              Typography
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '16px' }}>
              <div style={{ fontSize: '32px', fontWeight: 900, color: '#fff', marginBottom: '4px' }}>Aa</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#00D2FF' }}>Figtree</div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Primary Display & Headings</span>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '16px' }}>
              <div style={{ fontSize: '32px', fontWeight: 900, color: '#fff', marginBottom: '4px' }}>Aa</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#00E676' }}>Inter</div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Body Copy & Spec Tables</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── COLOR PALETTE ─────────────────────────────────────────── */}
      <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Palette size={18} color="#FF6B00" />
          <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
            Color Tokens
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {colors.map((c) => (
            <div
              key={c.hex}
              onClick={() => handleCopy(c.hex)}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px',
                padding: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ height: '48px', borderRadius: '10px', background: c.hex, marginBottom: '10px', border: '1px solid rgba(255,255,255,0.15)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{c.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.role}</div>
                </div>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#FF6B00', background: 'rgba(255,107,0,0.12)', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                  {copiedColor === c.hex ? '✓ Copied' : c.hex}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. BRAND KNOWLEDGE & STRATEGY TABS ────────────────────── */}
      <div
        className="glow-card"
        style={{
          background: '#0a0a12',
          borderRadius: '20px',
          padding: '28px',
          border: '1px solid rgba(124, 117, 255, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} color="#7C75FF" />
          <h3 style={{ fontSize: '19px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
            Brand Knowledge & Positioning
          </h3>
        </div>

        {/* Horizontal Navigation Pills */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
          {knowledgeSections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveKnowledgeTab(sec.id)}
              style={{
                background: activeKnowledgeTab === sec.id ? 'rgba(255, 107, 0, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                border: '1px solid',
                borderColor: activeKnowledgeTab === sec.id ? '#FF6B00' : 'rgba(255, 255, 255, 0.08)',
                color: activeKnowledgeTab === sec.id ? '#FF6B00' : 'var(--text-secondary)',
                padding: '8px 18px',
                borderRadius: '100px',
                fontSize: '12.5px',
                fontWeight: activeKnowledgeTab === sec.id ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease'
              }}
            >
              {sec.title}
            </button>
          ))}
        </div>

        {/* Tab Content Display */}
        {knowledgeSections.find(s => s.id === activeKnowledgeTab) && (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '24px',
              lineHeight: 1.7,
              fontSize: '14.5px',
              color: 'rgba(255, 255, 255, 0.9)',
              whiteSpace: 'pre-line'
            }}
          >
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>
              {knowledgeSections.find(s => s.id === activeKnowledgeTab)?.title}
            </div>
            {knowledgeSections.find(s => s.id === activeKnowledgeTab)?.content}
          </div>
        )}
      </div>

      {/* ── 3. ASSETS SHOWCASE ─────────────────────────────────────── */}
      <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="#FF5296" />
            <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
              Assets Library
            </h3>
          </div>
          <span style={{ fontSize: '12px', color: '#FF6B00', cursor: 'pointer', fontWeight: 600 }}>
            View More ↗
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {mediaAssets.map((asset) => (
            <div
              key={asset.title}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', background: 'rgba(255, 107, 0, 0.15)', color: '#FF6B00', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  {asset.tag}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{asset.size}</span>
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#fff', wordBreak: 'break-all' }}>
                {asset.title}
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{asset.type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. TARGET AUDIENCE, CATEGORIES & COUNTRIES ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        
        {/* COUNTRIES & CATEGORIES */}
        <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Compass size={18} color="#00E676" />
            <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
              Market & Categories
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                Primary Geographies & Language:
              </span>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <span style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', padding: '6px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 600 }}>
                  🌐 Global (US, India, UK)
                </span>
                <span style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', padding: '6px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 600 }}>
                  🗣️ English
                </span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                Product Categories:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {[
                  'Consumer Electronics',
                  'High-Capacity Power Banks',
                  'GaN Fast Chargers',
                  'Qi2 Wireless Charging',
                  'Lifestyle Tech Accessories'
                ].map(cat => (
                  <span
                    key={cat}
                    style={{
                      background: 'rgba(0, 230, 118, 0.1)',
                      border: '1px solid rgba(0, 230, 118, 0.25)',
                      color: '#00E676',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600
                    }}
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* TARGET AUDIENCE & KEY MESSAGES */}
        <div className="glow-card" style={{ background: '#0a0a12', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={18} color="#A855F7" />
              <h3 style={{ fontSize: '17px', color: '#fff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                Target Audience & Key Messages
              </h3>
            </div>
            
            <button
              onClick={() => setShowAddMessage(!showAddMessage)}
              style={{
                background: 'rgba(168, 85, 247, 0.15)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                color: '#A855F7',
                padding: '4px 10px',
                borderRadius: '100px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Plus size={12} /> Add Key Message
            </button>
          </div>

          {showAddMessage && (
            <form onSubmit={handleAddMessage} style={{ marginBottom: '14px', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Enter new key message hook..."
                value={newMessageInput}
                onChange={e => setNewMessageInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '12.5px',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                style={{ background: '#A855F7', color: '#fff', border: 'none', borderRadius: '8px', padding: '0 14px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
              >
                Add
              </button>
            </form>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              {
                segment: 'Laptop and MacBook users, students, and mobile professionals',
                message: 'High-power 65W–100W GaN laptop power banks with multi-port fast charging.'
              },
              {
                segment: 'Smartphone users seeking magnetic wireless charging',
                message: 'Qi2 certified magnetic wireless snap charging for iPhone and Android devices.'
              },
              {
                segment: 'Mobile users who need dependable everyday backup power',
                message: 'Pocket-sized 10,000mAh NanoCharge with in-built Type-C & Lightning cables.'
              },
              {
                segment: 'Value-conscious shoppers upgrading everyday tech accessories',
                message: '12-Month warranty, 24x7 priority support, 4.8+ star rating across 500k+ customers.'
              }
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ fontSize: '13px', color: '#fff', fontWeight: 700 }}>
                  👥 {item.segment}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  💬 <em>"{item.message}"</em>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
