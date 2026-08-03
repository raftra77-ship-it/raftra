import React, { useState, useRef } from 'react';
import { 
  Sparkles, Users, Video, 
  ShieldCheck, CheckCircle2, TrendingUp, Layers, Zap, 
  Upload, Image as ImageIcon, Wand2, Film, RefreshCw, BarChart2, 
  Play, Copy, Edit3, Send, Check, X, ArrowRight, Download, Calendar
} from 'lucide-react';
import { GlowButton } from '../GlowButton';

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
  onGenerate?: (prompt: string, referenceAd?: any, config?: any) => void;
  onAssetSaved?: (asset: CreativeAsset) => void;
  workspaceId?: number;
  onNavigateTab?: (tab: string) => void;
}

export const WorkspaceCreative: React.FC<WorkspaceCreativeProps> = ({
  brandUrl = 'ambrane.com',
  assets = [],
  onOpenReview,
  onGenerate,
  onAssetSaved,
  workspaceId,
  onNavigateTab
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'create' | 'competitors' | 'projects' | 'templates' | 'ugc'>('create');
  
  // Hero Quick Goal Selector
  const [quickGoal, setQuickGoal] = useState<'image' | 'video' | 'carousel' | 'ai_ugc' | 'hire_ugc'>('image');

  // Step 2 Input Method
  const [inputOption, setInputOption] = useState<'brand_kb' | 'upload_image' | 'ai_generate_image'>('brand_kb');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [productPrompt, setProductPrompt] = useState('');
  const [aiProductVisualRender, setAiProductVisualRender] = useState<string | null>(null);

  // Step 3 Ad Type & Settings
  const [selectedAdType, setSelectedAdType] = useState<'Image' | 'Video' | 'Carousel'>('Image');
  const [platform, setPlatform] = useState<'Instagram' | 'Facebook' | 'Google' | 'Amazon' | 'Flipkart'>('Instagram');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '9:16' | '4:5' | '16:9'>('1:1');
  const [aiModel, setAiModel] = useState('Gemini 2.5 Flash');
  const [videoDuration, setVideoDuration] = useState<'15s' | '30s' | '60s'>('15s');
  const [videoVoice, setVideoVoice] = useState('Hindi Warm Male');

  // Interactive Custom Ad Editor State
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [customAiInstruction, setCustomAiInstruction] = useState('');
  const [isApplyingInstruction, setIsApplyingInstruction] = useState(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Generation & Output State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatedAd, setGeneratedAd] = useState<{
    id: string;
    headline: string;
    bodyText: string;
    cta: string;
    description: string;
    hashtags: string;
    imageUrl: string;
    type: string;
    platform: string;
    aspectRatio: string;
    cards?: { title: string; desc: string; img: string }[];
  } | null>(null);

  // Competitor Intelligence State
  const [selectedCompetitor, setSelectedCompetitor] = useState<'Boat' | 'Noise' | 'Realme'>('Boat');
  const [vaultSubTab, setVaultSubTab] = useState<'hooks' | 'headlines' | 'ctas'>('hooks');

  // Projects Modal State
  const [projectsList, setProjectsList] = useState<Array<{
    id: string;
    title: string;
    date: string;
    status: 'Approved' | 'In Review' | 'Draft';
    img: string;
    headline: string;
    bodyText: string;
    cta: string;
    hashtags: string;
  }>>([
    {
      id: 'proj_1',
      title: 'Ambrane Powerbank Festive Carousel',
      date: "Today's Ad",
      status: 'Approved',
      img: 'https://images.unsplash.com/photo-1609592424074-1ef5a498b8df?auto=format&fit=crop&w=800&q=80',
      headline: 'Festive Flash Sale — 20,000mAh Powerbank',
      bodyText: 'Never run out of power during celebrations. Ultra fast 22.5W charging.',
      cta: 'Shop Now',
      hashtags: '#Ambrane #FestiveOffer #PowerBank'
    },
    {
      id: 'proj_2',
      title: 'Ultra Fast Charger Video Reel 15s',
      date: 'Yesterday',
      status: 'In Review',
      img: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80',
      headline: 'Charge 50% in Just 20 Minutes ⚡',
      bodyText: 'Engineered with smart temperature management and aircraft aluminum body.',
      cta: 'Claim 30% Off',
      hashtags: '#FastCharging #MakeInIndia #TechReels'
    },
    {
      id: 'proj_3',
      title: 'Noise Cancelling Earbuds Minimal Ad',
      date: 'Last Week',
      status: 'Draft',
      img: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80',
      headline: 'Pure Acoustic Silence — Ambrane ANC',
      bodyText: 'Block out traffic & airplane noise with 35dB Active Noise Cancellation.',
      cta: 'Order Today',
      hashtags: '#AudioTech #NoiseCancelling #Ambrane'
    }
  ]);
  const [selectedProjectModal, setSelectedProjectModal] = useState<typeof projectsList[0] | null>(null);

  // UGC State & Realistic Generation Flow
  const [ugcSubTab, setUgcSubTab] = useState<'ai_ugc' | 'hire_human'>('ai_ugc');
  const [selectedAvatar, setSelectedAvatar] = useState('Aarav - Tech Reviewer');
  const [ugcScript, setUgcScript] = useState('');
  const [isGeneratingUgc, setIsGeneratingUgc] = useState(false);
  const [ugcStepText, setUgcStepText] = useState('');
  const [ugcProgress, setUgcProgress] = useState(0);
  const [generatedUgcReel, setGeneratedUgcReel] = useState<{
    id: string;
    avatar: string;
    videoUrl: string;
    script: string;
    voice: string;
    status: string;
  } | null>(null);

  const triggerToast = (msg: string) => {
    setCopyToast(msg);
    setTimeout(() => setCopyToast(null), 3500);
  };

  // File Upload Handler
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadedImage(url);
    }
  };

  // Generate Ad Action
  const handleGenerateAd = () => {
    setIsGenerating(true);
    setGenerationProgress(20);

    const timer1 = setTimeout(() => setGenerationProgress(50), 600);
    const timer2 = setTimeout(() => setGenerationProgress(85), 1200);
    const timer3 = setTimeout(() => {
      setGenerationProgress(100);
      setIsGenerating(false);

      if (selectedAdType === 'Carousel') {
        setGeneratedAd({
          id: `ad_${Date.now()}`,
          headline: 'Experience Power & Elegance with Ambrane',
          bodyText: 'Never run out of charge. Ultra-fast charging built for high-performance lifestyles.',
          cta: 'Shop Now',
          description: 'Flat 40% Off + Free Shipping on Ambrane Powerbanks',
          hashtags: '#Ambrane #FastCharging #MadeInIndia #TechLifestyle',
          imageUrl: aiProductVisualRender || 'https://images.unsplash.com/photo-1609592424074-1ef5a498b8df?auto=format&fit=crop&w=800&q=80',
          type: 'Carousel',
          platform,
          aspectRatio,
          cards: [
            { title: 'Slide 1: Powerhouse Capacity', desc: '20,000mAh Lithium Polymer Battery', img: 'https://images.unsplash.com/photo-1609592424074-1ef5a498b8df?auto=format&fit=crop&w=600&q=80' },
            { title: 'Slide 2: 22.5W Fast Charge', desc: 'Charge 50% in just 30 minutes', img: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80' },
            { title: 'Slide 3: Ultra Metallic Finish', desc: 'Aircraft grade aluminum shell', img: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80' },
            { title: 'Slide 4: Multi-Layer Protection', desc: 'BIS certified short-circuit safe', img: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80' },
            { title: 'Slide 5: Special Offer', desc: 'Get ₹500 instant discount today', img: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80' }
          ]
        });
      } else {
        setGeneratedAd({
          id: `ad_${Date.now()}`,
          headline: selectedAdType === 'Video' ? 'Charge 10x Faster On The Go ⚡' : 'Unstoppable Power in Your Pocket ⚡',
          bodyText: 'Engineered with smart AI heat control and 22.5W Power Delivery. Built for creators and professionals.',
          cta: 'Claim Offer',
          description: 'Special Launch Discount — Free Express Shipping',
          hashtags: '#Ambrane #PowerBank #FastCharging #TechGadgets',
          imageUrl: aiProductVisualRender || (selectedAdType === 'Video' 
            ? 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80'
            : 'https://images.unsplash.com/photo-1609592424074-1ef5a498b8df?auto=format&fit=crop&w=800&q=80'),
          type: selectedAdType,
          platform,
          aspectRatio
        });
      }

      if (onGenerate) {
        onGenerate(productPrompt || 'Brand Knowledge Generation');
      }
    }, 1800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  };

  // Custom User AI Refinement Command Handler
  const handleApplyCustomInstruction = (presetText?: string) => {
    const text = presetText || customAiInstruction;
    if (!text || !generatedAd) return;

    setIsApplyingInstruction(true);

    setTimeout(() => {
      setIsApplyingInstruction(false);
      setCustomAiInstruction('');

      let updatedHeadline = generatedAd.headline;
      let updatedBody = generatedAd.bodyText;
      let updatedCta = generatedAd.cta;
      let updatedImg = generatedAd.imageUrl;
      let updatedHashtags = generatedAd.hashtags;

      const lower = text.toLowerCase();
      if (lower.includes('punch') || lower.includes('headline') || lower.includes('discount') || lower.includes('off') || lower.includes('sale')) {
        updatedHeadline = '⚡ FLAT 30% OFF — Powerful 22.5W Ambrane Fast Charge';
      }
      if (lower.includes('cta') || lower.includes('urgency') || lower.includes('buy') || lower.includes('claim')) {
        updatedCta = 'Claim 30% Off Now';
      }
      if (lower.includes('dark') || lower.includes('obsidian') || lower.includes('theme') || lower.includes('neon') || lower.includes('bg')) {
        updatedImg = 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80';
      }
      if (lower.includes('insta') || lower.includes('short') || lower.includes('story') || lower.includes('simple')) {
        updatedBody = 'Compact 20,000mAh battery that fits right in your palm. BIS certified multi-protection.';
      }

      setGeneratedAd({
        ...generatedAd,
        headline: updatedHeadline,
        bodyText: updatedBody,
        cta: updatedCta,
        imageUrl: updatedImg,
        hashtags: updatedHashtags
      });
      triggerToast('AI Refinement applied to ad preview!');
    }, 900);
  };

  // Apply winning vault item to active ad
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
  const handleApplyCompetitorPattern = () => {
    setSelectedAdType('Video');
    setAspectRatio('9:16');
    setVideoDuration('15s');
    setProductPrompt(`${selectedCompetitor} 15s Reel Pattern: High retention 22.5W fast charge demonstration`);
    setActiveTab('create');
    triggerToast(`Applied ${selectedCompetitor} 15s Reel pattern! Ready to generate.`);
    handleGenerateAd();
  };

  // Apply Specific Individual Competitor Ad Pattern to Ad Studio
  const handleApplySingleCompetitorAdPattern = (ad: {
    title: string;
    type: 'Image' | 'Video' | 'Carousel';
    platform: 'Instagram' | 'Facebook' | 'Google' | 'Amazon' | 'Flipkart';
    aspectRatio: '1:1' | '9:16' | '4:5' | '16:9';
    headline: string;
    bodyText: string;
    cta: string;
    roas: string;
  }) => {
    setSelectedAdType(ad.type);
    setPlatform(ad.platform);
    setAspectRatio(ad.aspectRatio);
    if (ad.type === 'Video') setVideoDuration('15s');
    setProductPrompt(`Pattern derived from ${selectedCompetitor} winner "${ad.title}" (${ad.roas})`);
    setActiveTab('create');
    triggerToast(`Applied "${ad.title}" pattern (${ad.roas}) to Ad Studio! Generating ad...`);
    handleGenerateAd();
  };

  // AI Product Prompt Preset Click Handler
  const handleSelectProductPromptPreset = (promptText: string, imgUrl: string) => {
    setProductPrompt(promptText);
    setAiProductVisualRender(imgUrl);
    triggerToast('Generated 4K AI Product Visual Render!');
  };

  // AI UGC Video Reel Generator Working Pipeline
  const handleGenerateAiUgcReel = () => {
    setIsGeneratingUgc(true);
    setUgcProgress(20);
    setUgcStepText('Synthesizing AI Avatar Voiceover (Hinglish Accent)...');

    setTimeout(() => {
      setUgcProgress(60);
      setUgcStepText('Rendering 9:16 Lipsync & Face Expression Animation...');
    }, 900);

    setTimeout(() => {
      setUgcProgress(90);
      setUgcStepText('Compiling Dynamic Subtitles & Background Beats...');
    }, 1800);

    setTimeout(() => {
      setUgcProgress(100);
      setIsGeneratingUgc(false);
      setGeneratedUgcReel({
        id: `ugc_${Date.now()}`,
        avatar: selectedAvatar,
        videoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
        script: ugcScript || "Hey guys! If you travel or commute daily, this Ambrane 20,000mAh powerbank is a total game changer. Charges my phone 4 times full without heating up!",
        voice: 'Hinglish Energetic Natural',
        status: 'Ready for Campaign'
      });
      triggerToast('AI UGC Reel Video Generated Successfully! 🎬');
    }, 2600);
  };

  // Approve Project in Projects Tab
  const handleApproveProject = (id: string) => {
    setProjectsList(prev => prev.map(p => p.id === id ? { ...p, status: 'Approved' } : p));
    if (selectedProjectModal && selectedProjectModal.id === id) {
      setSelectedProjectModal({ ...selectedProjectModal, status: 'Approved' });
    }
    triggerToast('Project asset approved successfully! ✔');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
      
      {/* 1. TOP NAVIGATION TABS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { id: 'create', label: 'Create', icon: Wand2 },
            { id: 'competitors', label: 'Competitor Intelligence ⭐', icon: BarChart2, badge: 'Ad Vault' },
            { id: 'projects', label: 'Projects', icon: Layers },
            { id: 'templates', label: 'Templates', icon: Copy },
            { id: 'ugc', label: 'UGC', icon: Video }
          ].map(tab => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  background: isSelected ? 'linear-gradient(135deg, rgba(124,117,255,0.2) 0%, rgba(90,82,255,0.08) 100%)' : 'rgba(255,255,255,0.03)',
                  border: isSelected ? '1px solid #7C75FF' : '1px solid var(--border)',
                  borderRadius: '100px',
                  padding: '10px 20px',
                  color: isSelected ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: isSelected ? 600 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={15} color={isSelected ? '#7C75FF' : 'var(--text-muted)'} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span style={{ fontSize: '10px', background: 'rgba(0,230,118,0.2)', color: 'var(--success)', border: '1px solid rgba(0,230,118,0.3)', padding: '2px 8px', borderRadius: '100px', fontWeight: 700 }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={14} color="var(--success)" />
          <span>Raftra Ad Intelligence Vault Sync Active</span>
        </div>
      </div>

      {/* ==================== TAB 1: CREATE FLOW ==================== */}
      {activeTab === 'create' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* HERO SECTION (ONLY ON CREATE TAB) */}
          <div className="glow-card" style={{ padding: '32px', background: 'linear-gradient(135deg, rgba(124,117,255,0.12) 0%, rgba(10,10,16,0.95) 100%)', border: '1px solid rgba(124,117,255,0.3)', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '240px', height: '240px', background: 'radial-gradient(circle, rgba(124,117,255,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(255,255,255,0.06)', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.1)', alignSelf: 'flex-start' }}>
                <Sparkles size={14} color="#7C75FF" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff', letterSpacing: '0.04em' }}>Raftra Creative Studio • AI Ad Intelligence</span>
              </div>

              <div>
                <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-heading)', color: '#ffffff', margin: '0 0 10px 0', lineHeight: 1.3, fontWeight: 700 }}>
                  Create high-converting ads powered by your brand knowledge, competitor intelligence, and AI.
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0, maxWidth: '850px', lineHeight: 1.5 }}>
                  What would you like to create today? Select your campaign format below to initiate the AI generation pipeline.
                </p>
              </div>

              {/* Quick Goal Selector */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', paddingTop: '8px' }}>
                {[
                  { id: 'image', label: 'Image Ad', icon: ImageIcon },
                  { id: 'video', label: 'Video Ad', icon: Film },
                  { id: 'carousel', label: 'Carousel Ad', icon: Layers },
                  { id: 'ai_ugc', label: 'AI UGC Ad', icon: Wand2 },
                  { id: 'hire_ugc', label: 'Hire UGC Creator', icon: Users }
                ].map(goal => {
                  const Icon = goal.icon;
                  const isSelected = quickGoal === goal.id;
                  return (
                    <button
                      key={goal.id}
                      onClick={() => {
                        setQuickGoal(goal.id as any);
                        if (goal.id === 'image') { setSelectedAdType('Image'); setActiveTab('create'); }
                        else if (goal.id === 'video') { setSelectedAdType('Video'); setActiveTab('create'); }
                        else if (goal.id === 'carousel') { setSelectedAdType('Carousel'); setActiveTab('create'); }
                        else if (goal.id === 'ai_ugc') { setActiveTab('ugc'); setUgcSubTab('ai_ugc'); }
                        else if (goal.id === 'hire_ugc') {
                          if (onNavigateTab) onNavigateTab('influencer');
                          else { setActiveTab('ugc'); setUgcSubTab('hire_human'); }
                        }
                      }}
                      style={{
                        background: isSelected ? '#7C75FF' : 'rgba(255,255,255,0.05)',
                        color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                        border: isSelected ? '1px solid #7C75FF' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '100px',
                        padding: '10px 18px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Icon size={15} />
                      <span>{goal.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* STEP 1: CHOOSE BRAND */}
          <div className="glow-card" style={{ padding: '24px', background: '#0c0c12', border: '1px solid var(--border)', borderRadius: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ background: '#7C75FF', color: '#fff', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold' }}>1</span>
                <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)' }}>Step 1 — Choose Brand</h3>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--success)', background: 'rgba(0,230,118,0.12)', padding: '4px 12px', borderRadius: '100px', fontWeight: 600 }}>
                Automatically Selected
              </span>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h4 style={{ fontSize: '20px', color: '#fff', margin: '0 0 4px 0', fontFamily: 'var(--font-heading)' }}>Ambrane India</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>ambrane.com • Consumer Electronics & Mobile Power</p>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ background: 'rgba(124,117,255,0.1)', border: '1px solid rgba(124,117,255,0.2)', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', color: '#fff' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>THEME</span>
                  <strong>Modern Tech</strong>
                </div>
                <div style={{ background: 'rgba(124,117,255,0.1)', border: '1px solid rgba(124,117,255,0.2)', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', color: '#fff' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>TONE</span>
                  <strong>Professional & High Energy</strong>
                </div>
                <div style={{ background: 'rgba(124,117,255,0.1)', border: '1px solid rgba(124,117,255,0.2)', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', color: '#fff' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>AUDIENCE</span>
                  <strong>18 – 35 Urban Pros</strong>
                </div>
                <div style={{ background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.25)', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', color: 'var(--success)' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>KNOWLEDGE BASE</span>
                  <strong>Connected ✔</strong>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '14px 0 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={13} color="#7C75FF" /> Brand ki saari knowledge (Product USPs, colors, past campaigns) automatically use hogi.
            </p>
          </div>

          {/* STEP 2: CHOOSE INPUT */}
          <div className="glow-card" style={{ padding: '24px', background: '#0c0c12', border: '1px solid var(--border)', borderRadius: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ background: '#7C75FF', color: '#fff', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold' }}>2</span>
              <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)' }}>Step 2 — Choose Input Method</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              
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
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '14px', color: '#fff', fontWeight: 600 }}>Product Image Uploaded</div>
                      <div style={{ fontSize: '12px', color: 'var(--success)' }}>✔ Background auto-removal active</div>
                    </div>
                    <button onClick={() => setUploadedImage(null)} style={{ background: 'none', border: 'none', color: '#ff4757', cursor: 'pointer' }}>Remove</button>
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
                    {[
                      { label: '🌌 Floating Metallic Neon', prompt: 'Sleek metallic 20000mAh Ambrane powerbank floating over dark obsidian neon desk', img: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80' },
                      { label: '🏛️ Minimalist Marble Studio', prompt: 'Minimalist studio shot of Ambrane powerbank resting on smooth white marble desk with soft sunlight', img: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80' },
                      { label: '⚡ Cyberpunk Tech Setup', prompt: 'High performance Ambrane powerbank surrounded by RGB gaming tech setup', img: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80' },
                      { label: '💡 Softbox Studio Lighting', prompt: 'Professional 4K product photography of Ambrane powerbank with studio softbox reflection', img: 'https://images.unsplash.com/photo-1609592424074-1ef5a498b8df?auto=format&fit=crop&w=600&q=80' }
                    ].map((pattern, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectProductPromptPreset(pattern.prompt, pattern.img)}
                        style={{ background: 'rgba(124,117,255,0.12)', border: '1px solid rgba(124,117,255,0.25)', color: '#fff', padding: '6px 14px', borderRadius: '100px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        {pattern.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI Visual Render Preview */}
                {aiProductVisualRender && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(0,0,0,0.4)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(0,230,118,0.3)' }}>
                    <img src={aiProductVisualRender} alt="Product visual render" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} />
                    <div>
                      <div style={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>4K AI Product Render Generated</div>
                      <div style={{ fontSize: '11px', color: 'var(--success)' }}>✔ Ready for ad template compilation</div>
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
                    background: selectedAdType === fmt ? '#7C75FF' : 'rgba(255,255,255,0.03)',
                    color: selectedAdType === fmt ? '#fff' : 'var(--text-secondary)',
                    border: selectedAdType === fmt ? '1px solid #7C75FF' : '1px solid rgba(255,255,255,0.1)',
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
              
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

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>AI GENERATION ENGINE</label>
                <select
                  value={aiModel}
                  onChange={e => setAiModel(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', outline: 'none' }}
                >
                  <option value="Gemini 2.5 Flash">Gemini 2.5 Flash (Ultra Fast)</option>
                  <option value="Imagen 3 Ultra">Imagen 3 Ultra (4K Studio Visuals)</option>
                  <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet (High CTR Copy)</option>
                </select>
              </div>

              {selectedAdType === 'Video' && (
                <>
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
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>VOICEOVER</label>
                    <select
                      value={videoVoice}
                      onChange={e => setVideoVoice(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', outline: 'none' }}
                    >
                      <option value="Hindi Warm Male">Hindi Warm Male Voice</option>
                      <option value="Indian English Female">Indian English Female Voice</option>
                      <option value="Energetic Youth">Energetic Youth Accent</option>
                    </select>
                  </div>
                </>
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
                  Generating High-Converting Ad ({generationProgress}%)...
                </>
              ) : (
                <>
                  <Wand2 size={20} />
                  Generate {selectedAdType} Ad Powered by Brand Knowledge
                </>
              )}
            </GlowButton>
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
                  <span>Ask AI to modify or customize this ad (Custom User Instruction)</span>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <input
                    type="text"
                    placeholder="e.g. 'Make headline punchier with a 25% discount offer'..."
                    value={customAiInstruction}
                    onChange={e => setCustomAiInstruction(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleApplyCustomInstruction()}
                    style={{ flex: 1, minWidth: '260px', padding: '12px 18px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '100px', color: '#fff', outline: 'none', fontSize: '14px' }}
                  />
                  <GlowButton
                    variant="glow"
                    onClick={() => handleApplyCustomInstruction()}
                    disabled={isApplyingInstruction || !customAiInstruction}
                    style={{ padding: '12px 24px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {isApplyingInstruction ? <RefreshCw size={15} className="spin-animation" /> : <Send size={15} />}
                    {isApplyingInstruction ? 'Applying Changes...' : 'Apply Instruction'}
                  </GlowButton>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Quick Presets:</span>
                  {[
                    { label: '⚡ Punchier Headline', prompt: 'Make headline punchier with 25% Off discount' },
                    { label: '💰 Add 25% Off Offer', prompt: 'Add 25% off offer and urgency CTA' },
                    { label: '🎨 Dark Obsidian Theme', prompt: 'Change background to dark obsidian neon theme' },
                    { label: '📱 Shorten for Insta Reel', prompt: 'Shorten body text for Insta Reel' }
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleApplyCustomInstruction(chip.prompt)}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#ddd', padding: '4px 12px', borderRadius: '100px', fontSize: '11px', cursor: 'pointer' }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview & Editable Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
                
                <div>
                  <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', background: '#000' }}>
                    <img src={generatedAd.imageUrl} alt="Generated Ad" style={{ width: '100%', maxHeight: '420px', objectFit: 'cover', display: 'block' }} />
                    {generatedAd.type === 'Video' && (
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(124,117,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Play size={24} color="#fff" style={{ marginLeft: '4px' }} />
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
              <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', color: '#fff', margin: '0 0 6px 0' }}>
                Winning Competitor Ads & Psychological Vault
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
                Analyze top scaling competitor ads, psychological hooks, and high-converting CTAs tracked across active market campaigns.
              </p>
            </div>
          </div>

          {/* COMPETITOR BRAND CARDS */}
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
              Select Competitor Brand to Inspect Active Campaigns
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              {[
                { id: 'Boat', name: 'Boat Electronics', category: 'Audio & Wearables', activeAds: '14 Active Ads Tracked', engagement: '4.8% Avg Engagement', status: 'Market Leader' },
                { id: 'Noise', name: 'Noise Audio & Smartwatches', category: 'Fitness & Smart Tech', activeAds: '18 Active Ads Tracked', engagement: '5.2% Avg Engagement', status: 'Scaling Fast' },
                { id: 'Realme', name: 'Realme Tech & Power Accessories', category: 'Electronics & Power', activeAds: '11 Active Ads Tracked', engagement: '4.4% Avg Engagement', status: 'Consistent CTR' }
              ].map(comp => {
                const isSelected = selectedCompetitor === comp.id;
                return (
                  <div
                    key={comp.id}
                    onClick={() => setSelectedCompetitor(comp.id as any)}
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
              <h4 style={{ fontSize: '18px', color: '#fff', margin: '0 0 4px 0', fontFamily: 'var(--font-heading)' }}>
                Switch to 15s Video Ads for higher retention & +23% CTR
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                {selectedCompetitor}'s top 3 scaled ads are 15s Vertical Video Reels. Applying this pattern to Ambrane increases predicted ROAS to 4.2x.
              </p>
            </div>

            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>ESTIMATED ROAS</span>
                <strong style={{ fontSize: '24px', color: 'var(--success)' }}>4.2x</strong>
              </div>
              <GlowButton variant="glow" onClick={handleApplyCompetitorPattern}>
                Apply Pattern to Ad Studio
              </GlowButton>
            </div>
          </div>

          {/* DEDICATED WINNING HOOKS, HEADLINES & CTA VAULT */}
          <div className="glow-card" style={{ padding: '28px', background: '#0b0b10', border: '1px solid rgba(124,117,255,0.3)', borderRadius: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#7C75FF', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '2px' }}>
                  HIGH-CONVERTING AD VAULT
                </div>
                <h3 style={{ fontSize: '20px', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)' }}>
                  Winning Hooks, Headlines & CTA Vault
                </h3>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { id: 'hooks', label: 'Winning Hooks' },
                  { id: 'headlines', label: 'High-CTR Headlines' },
                  { id: 'ctas', label: 'Conversion CTAs' }
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              
              {vaultSubTab === 'hooks' && [
                { text: 'Stop scrolling if your powerbank dies right when you need it most.', roas: '4.6x ROAS', tag: 'Visual Shock' },
                { text: 'Why 90% of portable chargers ruin your phone battery health long-term.', roas: '4.2x ROAS', tag: 'Negative Curiosity' },
                { text: 'I tested 5 powerbanks under ₹2,000 — here is the only one that survived 7 days of travel.', roas: '4.9x ROAS', tag: 'Social Proof' },
                { text: 'If you travel or commute daily, this 22.5W metallic charger is a cheat code.', roas: '3.9x ROAS', tag: 'Aspiration' }
              ].map((item, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', borderRadius: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#7C75FF', background: 'rgba(124,117,255,0.15)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>{item.tag}</span>
                      <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 700 }}>{item.roas}</span>
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

              {vaultSubTab === 'headlines' && [
                { text: 'Unstoppable Power in Your Pocket ⚡', roas: '4.8x ROAS', tag: 'High Impact' },
                { text: 'Charge 50% in 30 Mins — Built for High Performers', roas: '4.5x ROAS', tag: 'Benefit Driven' },
                { text: 'FLAT 30% OFF — Aircraft Aluminum Powerbank', roas: '5.1x ROAS', tag: 'Urgency Offer' },
                { text: 'Never Carry a Dead Phone Again (BIS Certified)', roas: '4.1x ROAS', tag: 'Trust & Safety' }
              ].map((item, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', borderRadius: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#7C75FF', background: 'rgba(124,117,255,0.15)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>{item.tag}</span>
                      <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 700 }}>{item.roas}</span>
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

              {vaultSubTab === 'ctas' && [
                { text: 'Claim 30% Discount Today', roas: '5.2x ROAS', tag: 'Direct Offer' },
                { text: 'Shop Ambrane Powerbanks', roas: '4.3x ROAS', tag: 'Standard E-com' },
                { text: 'Get Free Express Delivery', roas: '4.7x ROAS', tag: 'Perk Trigger' },
                { text: 'Order Now & Save ₹500', roas: '4.9x ROAS', tag: 'Instant Savings' }
              ].map((item, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', borderRadius: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#7C75FF', background: 'rgba(124,117,255,0.15)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>{item.tag}</span>
                      <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 700 }}>{item.roas}</span>
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

            </div>
          </div>

          {/* INDIVIDUAL TOP-PERFORMING COMPETITOR ADS GRID WITH RETURNS & ANALYSIS */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#00E676', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '2px' }}>
                  ACTIVE SCALING AD LIBRARY
                </div>
                <h3 style={{ fontSize: '20px', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)' }}>
                  Top Scaling Ads for {selectedCompetitor} (Individual Returns & Analysis)
                </h3>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Click "Apply This Ad Pattern" on any ad to clone into Ad Studio
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
              {[
                {
                  id: 'comp_ad_1',
                  title: `${selectedCompetitor} 15s Fast Charge Reel`,
                  type: 'Video' as const,
                  platform: 'Instagram' as const,
                  aspectRatio: '9:16' as const,
                  duration: '15s',
                  statusBadge: 'Scaled 75+ Days',
                  roas: '4.8x ROAS',
                  spend: '₹14.2L Spend',
                  impressions: '3.4M Impr.',
                  ctr: '5.2% CTR',
                  headline: 'Charge 50% in 20 Mins ⚡',
                  bodyText: 'Never carry a dead phone again during travel or work.',
                  cta: 'Buy Now - 50% Off',
                  hook: '0-2s visual water splash & battery pulse animation drop',
                  psychology: 'Fear of dead phone + Instant charging visual proof',
                  targetAudience: '18-28 College, Travel & Tech Enthusiasts',
                  img: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80'
                },
                {
                  id: 'comp_ad_2',
                  title: `${selectedCompetitor} Metallic Power Carousel`,
                  type: 'Carousel' as const,
                  platform: 'Facebook' as const,
                  aspectRatio: '1:1' as const,
                  duration: '5 Slides',
                  statusBadge: 'Scaled 45+ Days',
                  roas: '4.5x ROAS',
                  spend: '₹9.8L Spend',
                  impressions: '2.1M Impr.',
                  ctr: '4.7% CTR',
                  headline: 'Aircraft Aluminum Metallic Finish',
                  bodyText: '20,000mAh Lithium Polymer battery with 9 layers of protection.',
                  cta: 'Shop Now',
                  hook: 'Slide 1 high contrast metallic texture cutout with glowing specs',
                  psychology: 'Premium aesthetics + BIS safety certification trust',
                  targetAudience: '22-35 Working Professionals & Engineers',
                  img: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80'
                },
                {
                  id: 'comp_ad_3',
                  title: `${selectedCompetitor} Flash Sale & 30% Off Offer`,
                  type: 'Image' as const,
                  platform: 'Instagram' as const,
                  aspectRatio: '4:5' as const,
                  duration: 'Static Shot',
                  statusBadge: 'Scaled 60+ Days',
                  roas: '5.1x ROAS',
                  spend: '₹18.4L Spend',
                  impressions: '4.8M Impr.',
                  ctr: '6.2% CTR',
                  headline: 'FLAT 30% OFF — Limited Launch Stock',
                  bodyText: 'Compact 22.5W Power Delivery charger with free express shipping.',
                  cta: 'Claim Discount Today',
                  hook: 'High contrast red discount badge with glowing price strike-through',
                  psychology: 'Direct offer incentive + Impulse purchase urgency',
                  targetAudience: '18-35 Price Sensitive E-commerce Buyers',
                  img: 'https://images.unsplash.com/photo-1609592424074-1ef5a498b8df?auto=format&fit=crop&w=600&q=80'
                }
              ].map(ad => (
                <div key={ad.id} className="glow-card" style={{ padding: '24px', background: '#0d0d14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
                  
                  <div>
                    {/* Header Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '12px', color: '#7C75FF', fontWeight: 600 }}>{ad.platform} • {ad.type} ({ad.duration})</span>
                      <span style={{ fontSize: '11px', color: 'var(--success)', background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.25)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                        {ad.statusBadge}
                      </span>
                    </div>

                    {/* Image & Key Return Metrics Overlay */}
                    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                      <img src={ad.img} alt={ad.title} style={{ width: '100%', height: '170px', objectFit: 'cover', display: 'block' }} />
                      
                      {/* Metric Badges */}
                      <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', padding: '8px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '9px' }}>RETURN</span>
                          <strong style={{ color: 'var(--success)', fontSize: '14px' }}>{ad.roas}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '9px' }}>ACTIVE SPEND</span>
                          <strong style={{ color: '#fff' }}>{ad.spend}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '9px' }}>CTR</span>
                          <strong style={{ color: '#7C75FF' }}>{ad.ctr}</strong>
                        </div>
                      </div>
                    </div>

                    <h4 style={{ fontSize: '17px', color: '#fff', margin: '0 0 10px 0', fontFamily: 'var(--font-heading)' }}>{ad.title}</h4>

                    {/* Deep Analysis Breakdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div><strong style={{ color: '#ccc' }}>Visual Hook:</strong> <span style={{ color: 'var(--text-secondary)' }}>{ad.hook}</span></div>
                      <div><strong style={{ color: '#ccc' }}>Psychology:</strong> <span style={{ color: 'var(--text-secondary)' }}>{ad.psychology}</span></div>
                      <div><strong style={{ color: '#ccc' }}>Audience:</strong> <span style={{ color: 'var(--text-secondary)' }}>{ad.targetAudience}</span></div>
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

      {/* ==================== TAB 3: PROJECTS (INTERACTIVE EDIT & APPROVE MODAL) ==================== */}
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {projectsList.map((proj) => (
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
                <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 6px 0', fontFamily: 'var(--font-heading)' }}>{proj.title}</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, truncate: 'ellipsis' }}>"{proj.headline}"</p>
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', marginBottom: '24px' }}>
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

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                  <button
                    onClick={() => handleApproveProject(selectedProjectModal.id)}
                    style={{ background: 'rgba(0,230,118,0.2)', border: '1px solid #00E676', color: '#00E676', padding: '10px 20px', borderRadius: '100px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Check size={16} /> Approve Asset
                  </button>
                  <GlowButton
                    variant="glow"
                    onClick={() => {
                      if (onOpenReview) onOpenReview(selectedProjectModal.id);
                      setSelectedProjectModal(null);
                    }}
                    style={{ padding: '10px 20px', fontSize: '13px' }}
                  >
                    Push to Campaign Manager
                  </GlowButton>
                </div>

              </div>
            </div>
          )}

        </div>
      )}

      {/* ==================== TAB 4: TEMPLATES ==================== */}
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {[
              { name: 'Problem-Agitate-Solution (PAS)', desc: 'Highlight customer pain point and introduce Ambrane product as the ultimate fix.', ctr: '3.4% Avg CTR' },
              { name: 'Before vs After Showcase', desc: 'Direct visual comparison showing slow charging vs 22.5W Power Delivery.', ctr: '4.1% Avg CTR' },
              { name: 'Unboxing & First Reaction', desc: 'UGC-style authentic unboxing experience with energetic voiceover.', ctr: '4.8% Avg CTR' },
              { name: 'Flash Sale & Urgency Trigger', desc: 'Countdown timer + discount code overlay for impulse purchase conversion.', ctr: '5.2% Avg CTR' }
            ].map((tmpl, idx) => (
              <div key={idx} className="glow-card" style={{ padding: '24px', background: '#0d0d14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 700, marginBottom: '8px' }}>{tmpl.ctr}</div>
                <h4 style={{ fontSize: '16px', color: '#fff', margin: '0 0 8px 0' }}>{tmpl.name}</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.4 }}>{tmpl.desc}</p>
                <GlowButton variant="glow" onClick={() => setActiveTab('create')} style={{ padding: '8px 16px', fontSize: '12px' }}>
                  Use Framework
                </GlowButton>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== TAB 5: UGC (AI UGC REEL WORKING GENERATOR) ==================== */}
      {activeTab === 'ugc' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
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
              onClick={() => setUgcSubTab('hire_human')}
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
                <h3 style={{ fontSize: '20px', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)' }}>Create AI UGC Video Reel</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>Select an AI human avatar, voice model, and script topic to generate an authentic UGC Reel.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>CHOOSE AI AVATAR</label>
                    <select
                      value={selectedAvatar}
                      onChange={e => setSelectedAvatar(e.target.value)}
                      style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff' }}
                    >
                      <option value="Aarav - Tech Reviewer">Aarav (Tech Reviewer - Male 24)</option>
                      <option value="Ananya - Lifestyle Creator">Ananya (Lifestyle Creator - Female 22)</option>
                      <option value="Rohan - Fitness Enthusiast">Rohan (Fitness Expert - Male 27)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>VOICE & LANGUAGE</label>
                    <select style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff' }}>
                      <option>Hinglish Energetic Natural Voice</option>
                      <option>Hindi Authentic Conversational</option>
                      <option>Indian English Professional Accent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>SCRIPT TOPIC / PROMPT</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. 'Hey guys, I've been using this Ambrane powerbank for 2 weeks during travel and it charged my phone 4 times full!'"
                    value={ugcScript}
                    onChange={e => setUgcScript(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '14px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', color: '#fff', outline: 'none' }}
                  />
                </div>

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
                      Generate AI UGC Reel Video
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
                        AI UGC Reel Ready ({generatedUgcReel.avatar})
                      </h4>
                    </div>
                    <span style={{ fontSize: '11px', background: 'rgba(0,230,118,0.15)', color: 'var(--success)', padding: '4px 12px', borderRadius: '100px', fontWeight: 700 }}>
                      9:16 Vertical Reel • 1080p
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
                    {/* Playable Video Card */}
                    <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', background: '#000', maxHeight: '380px' }}>
                      <img src={generatedUgcReel.videoUrl} alt="AI Avatar Reel" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(124,117,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 0 30px rgba(124,117,255,0.6)' }}>
                        <Play size={28} color="#fff" style={{ marginLeft: '4px' }} />
                      </div>
                      <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, background: 'rgba(0,0,0,0.75)', padding: '10px 14px', borderRadius: '10px', fontSize: '11px', color: '#fff' }}>
                        🗣️ Voice: {generatedUgcReel.voice}
                      </div>
                    </div>

                    {/* Script Transcript & Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>GENERATED UGC TRANSCRIPT</span>
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
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                    Browse 500+ verified Indian UGC creators, check past performance metrics, and hire creators directly for your brand workspace.
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                {[
                  { name: 'Priya Sharma', niche: 'Tech & Gadgets', rate: '₹3,500/video', followers: '45k', rating: '4.9 ★', img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80' },
                  { name: 'Aarav Mehta', niche: 'Lifestyle & D2C', rate: '₹4,000/video', followers: '62k', rating: '4.8 ★', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80' },
                  { name: 'Neha Kapoor', niche: 'Unboxing & Reviews', rate: '₹3,000/video', followers: '28k', rating: '5.0 ★', img: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80' }
                ].map((creator, idx) => (
                  <div key={idx} className="glow-card" style={{ padding: '24px', background: '#0d0d14', border: '1px solid var(--border)', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <img src={creator.img} alt={creator.name} style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #7C75FF' }} />
                      <div>
                        <h4 style={{ fontSize: '17px', color: '#fff', margin: '0 0 2px 0' }}>{creator.name}</h4>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{creator.niche} • {creator.followers} Followers</div>
                        <div style={{ fontSize: '11px', color: 'var(--success)', marginTop: '2px' }}>{creator.rating} Verified Creator</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                      <div style={{ fontSize: '16px', color: '#00E676', fontWeight: 700 }}>{creator.rate}</div>
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
              </div>
            </div>
          )}

        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {copyToast && (
        <div style={{ position: 'fixed', bottom: '40px', right: '40px', background: '#7C75FF', color: '#fff', padding: '14px 22px', borderRadius: '12px', boxShadow: '0 8px 32px rgba(124,117,255,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, fontSize: '14px' }}>
          <CheckCircle2 size={18} /> {copyToast}
        </div>
      )}

    </div>
  );
};
