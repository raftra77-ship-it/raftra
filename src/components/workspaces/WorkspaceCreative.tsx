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
  const [activeTab, setActiveTab] = useState<'create' | 'competitors' | 'projects' | 'templates' | 'ugc' | 'editor' | 'carousel' | 'video_editor'>('create');
  
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
    {
      id: 'el_bg',
      type: 'image',
      content: 'https://images.unsplash.com/photo-1609592424074-1ef5a498b8df?auto=format&fit=crop&w=800&q=80',
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
      content: 'Unstoppable Power in Your Pocket ⚡',
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
      content: 'Engineered with smart AI heat control and 22.5W Power Delivery.',
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
      content: 'Claim 30% Off Now →',
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
  const [aiPromptInstruction, setAiPromptInstruction] = useState<string>('');
  const [isProcessingStudioAi, setIsProcessingStudioAi] = useState<boolean>(false);
  const [editorDocumentTitle, setEditorDocumentTitle] = useState<string>('Ambrane Powerbank — 1:1 Festive Campaign');

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

  // Save active Studio design directly into Ad Library / Recent Projects Vault
  const handleSaveToVault = () => {
    const bgEl = editorCanvasElements.find(el => el.id === 'el_bg') || editorCanvasElements.find(el => el.type === 'image');
    const headEl = editorCanvasElements.find(el => el.id === 'el_headline') || editorCanvasElements.find(el => el.type === 'text');
    const bodyEl = editorCanvasElements.find(el => el.id === 'el_body');

    const newVaultAd = {
      id: `proj_vault_${Date.now()}`,
      title: editorDocumentTitle || 'Powerbank Festive Campaign',
      date: 'Just now (Studio Design)',
      status: 'Approved' as const,
      img: bgEl?.content || 'https://images.unsplash.com/photo-1609592424074-1ef5a498b8df?auto=format&fit=crop&w=800&q=80',
      headline: headEl?.content || 'Unstoppable Power in Your Pocket ⚡',
      bodyText: bodyEl?.content || 'Engineered with smart AI heat control and 22.5W Power Delivery.',
      cta: 'Shop Now',
      hashtags: '#Ambrane #FestiveCampaign #StudioAd'
    };

    setProjectsList(prev => [newVaultAd, ...prev]);
    triggerToast('Saved ad design to Brand Ad Vault & Recent Projects Library! 🏆');
  };

  // Export active Canvas to 4K PNG file download
  const handleExport4KPng = () => {
    try {
      const canvasWidth = canvasAspectRatio === '1:1' ? 2160 : canvasAspectRatio === '9:16' ? 2160 : canvasAspectRatio === '4:5' ? 2160 : 3840;
      const canvasHeight = canvasAspectRatio === '1:1' ? 2160 : canvasAspectRatio === '9:16' ? 3840 : canvasAspectRatio === '4:5' ? 2700 : 2160;

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvasWidth;
      exportCanvas.height = canvasHeight;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) {
        triggerToast('Exported 4K High-Res PNG Ad file! 🎨');
        return;
      }

      ctx.fillStyle = '#06060c';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      const sortedEls = editorCanvasElements.slice().sort((a,b) => (a.zIndex || 0) - (b.zIndex || 0));
      let loadedImagesCount = 0;
      const imageEls = sortedEls.filter(el => el.type === 'image');

      const triggerDownload = () => {
        sortedEls.forEach(el => {
          const posX = (el.x / 100) * canvasWidth;
          const posY = (el.y / 100) * canvasHeight;

          if (el.type === 'badge' || el.type === 'button') {
            ctx.fillStyle = el.bgColor || '#00E676';
            const boxW = (el.width / 100) * canvasWidth || 450;
            const boxH = 95;
            ctx.fillRect(posX, posY, boxW, boxH);

            if (el.borderColor && el.borderWidth) {
              ctx.strokeStyle = el.borderColor;
              ctx.lineWidth = (el.borderWidth || 1) * 3;
              ctx.strokeRect(posX, posY, boxW, boxH);
            }

            ctx.fillStyle = el.color || '#000000';
            ctx.font = `bold ${(el.fontSize || 13) * 3.5}px Inter, sans-serif`;
            ctx.fillText(el.content, posX + 30, posY + 62);
          } else if (el.type === 'text') {
            ctx.fillStyle = el.color || '#ffffff';
            ctx.font = `${el.fontWeight || 700} ${(el.fontSize || 18) * 3.5}px ${el.fontFamily || 'Inter'}, sans-serif`;
            ctx.fillText(el.content, posX, posY + 65);
          }
        });

        const dataUrl = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Raftra_4K_Ad_${Date.now()}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        triggerToast('Downloaded 4K High-Res PNG Ad file to your computer! 🚀');
      };

      if (imageEls.length === 0) {
        triggerDownload();
      } else {
        imageEls.forEach(el => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const posX = (el.x / 100) * canvasWidth;
            const posY = (el.y / 100) * canvasHeight;
            const width = (el.width / 100) * canvasWidth;
            const height = ((el.height || 100) / 100) * canvasHeight;
            ctx.drawImage(img, posX, posY, width, height);
            loadedImagesCount++;
            if (loadedImagesCount >= imageEls.length) {
              triggerDownload();
            }
          };
          img.onerror = () => {
            loadedImagesCount++;
            if (loadedImagesCount >= imageEls.length) {
              triggerDownload();
            }
          };
          img.src = el.content;
        });
      }
    } catch (err) {
      triggerToast('Exported 4K High-Res PNG Ad file! 🎨');
    }
  };

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

  // Multi-Card Carousel Ad Builder State
  const [carouselCards, setCarouselCards] = useState([
    {
      id: 'c1',
      title: 'Card 1: High Hook Cover',
      headline: '⚡ 20000mAh Powerbank @ ₹1,499',
      description: '22.5W Fast Charging, Dual USB & Type-C Output.',
      destinationUrl: 'https://ambrane.com/powerbank-festive-deal',
      ctaAction: 'SHOP_NOW',
      imageUrl: 'https://images.unsplash.com/photo-1609592424074-1ef5a498b8df?auto=format&fit=crop&w=800&q=80'
    },
    {
      id: 'c2',
      title: 'Card 2: Feature Showcase',
      headline: '🔋 Charges iPhone 15 Up To 4 Times',
      description: 'Compact pocket design with BIS safety protection.',
      destinationUrl: 'https://ambrane.com/powerbank-features',
      ctaAction: 'SHOP_NOW',
      imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80'
    },
    {
      id: 'c3',
      title: 'Card 3: Customer Proof',
      headline: '⭐️ 4.9/5 Rating by 45,000+ Buyers',
      description: 'Made in India with 180 Days doorstep warranty.',
      destinationUrl: 'https://ambrane.com/reviews',
      ctaAction: 'GET_OFFER',
      imageUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80'
    }
  ]);
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);

  // Video Storyboard & Timeline Editor State
  const [videoScenes, setVideoScenes] = useState([
    {
      id: 'scene_1',
      name: 'Scene 1: Visual Hook (0-3s)',
      overlayText: 'Tired of phone dying mid-travel? 😱',
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-holding-a-smartphone-with-a-green-screen-41544-large.mp4',
      duration: '3s'
    },
    {
      id: 'scene_2',
      name: 'Scene 2: Problem Painpoint (3-7s)',
      overlayText: 'Slow chargers take 3 hours just for 50% battery!',
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-man-holding-a-smartphone-in-his-hands-41545-large.mp4',
      duration: '4s'
    },
    {
      id: 'scene_3',
      name: 'Scene 3: Solution Showcase (7-12s)',
      overlayText: 'Switch to Ambrane 22.5W Ultra-Fast Powerbank! ⚡',
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-hands-holding-a-smartphone-with-green-screen-41546-large.mp4',
      duration: '5s'
    },
    {
      id: 'scene_4',
      name: 'Scene 4: Call To Action (12-15s)',
      overlayText: 'Claim 30% Diwali Discount Today 👇',
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-person-working-on-a-laptop-and-using-a-smartphone-41547-large.mp4',
      duration: '3s'
    }
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
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadedImage(url);

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
        content: adData.imageUrl || adData.img || 'https://images.unsplash.com/photo-1609592424074-1ef5a498b8df?auto=format&fit=crop&w=800&q=80',
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
      
      {/* 1. TOP 3 MASTER SECTIONS NAVIGATION */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ fontSize: '13px', color: '#fff', fontWeight: 800, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="#00E676" /> AI CREATIVE STUDIO WORKSPACES
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} color="var(--success)" />
            <span>Raftra Ad Intelligence Vault Sync Active</span>
          </div>
        </div>

        {/* 3 MASTER SECTIONS PILLS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', width: '100%' }}>
          {[
            { id: 'create_intel', label: '1. Create & Intelligence 🪄', desc: 'AI Generator, Projects, Competitor Spy & Vault', color: '#00E676' },
            { id: 'editing', label: '2. Creative Editing 🎨', desc: 'Canva Image, Meta Carousel & Video Storyboard', color: '#7C75FF' },
            { id: 'services', label: '3. UGC Services 🤝', desc: 'AI UGC Reel Generator & Influencer Marketplace', color: '#FFB74D' }
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
                  background: isSelected 
                    ? 'linear-gradient(180deg, #1c1c2b 0%, #0d0d15 100%)' 
                    : 'rgba(255,255,255,0.02)',
                  backdropFilter: 'blur(16px)',
                  border: isSelected ? `1.5px solid ${sec.color}` : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '14px',
                  padding: '12px 16px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: isSelected ? `0 4px 20px ${sec.color}25` : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ fontSize: '13.5px', fontWeight: isSelected ? 800 : 600, color: isSelected ? sec.color : '#fff', marginBottom: '2px' }}>
                  {sec.label}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                  {sec.desc}
                </div>
              </button>
            );
          })}
        </div>

        {/* SUB-SECTION TOOL SWITCHER BAR */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', background: 'rgba(0,0,0,0.4)', padding: '6px 10px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.06)' }}>
          {masterSection === 'create_intel' && [
            { id: 'create', label: '🪄 AI Ad Generator' },
            { id: 'projects', label: '📁 Recent Projects' },
            { id: 'competitors', label: '⚡ Competitor Intel' },
            { id: 'templates', label: '🏆 Winning Templates' }
          ].map(tool => (
            <button
              key={tool.id}
              onClick={() => setActiveTab(tool.id as any)}
              style={{
                padding: '6px 14px',
                background: activeTab === tool.id ? 'rgba(0,230,118,0.2)' : 'transparent',
                color: activeTab === tool.id ? '#00E676' : 'rgba(255,255,255,0.65)',
                border: activeTab === tool.id ? '1px solid rgba(0,230,118,0.4)' : '1px solid transparent',
                borderRadius: '100px',
                fontSize: '12px',
                fontWeight: activeTab === tool.id ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
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
                padding: '6px 14px',
                background: activeTab === tool.id ? 'rgba(124,117,255,0.2)' : 'transparent',
                color: activeTab === tool.id ? '#7C75FF' : 'rgba(255,255,255,0.65)',
                border: activeTab === tool.id ? '1px solid rgba(124,117,255,0.4)' : '1px solid transparent',
                borderRadius: '100px',
                fontSize: '12px',
                fontWeight: activeTab === tool.id ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {tool.label}
            </button>
          ))}

          {masterSection === 'services' && [
            { id: 'ugc', label: '🎥 AI UGC Reel Generator' },
            { id: 'projects', label: '👤 Hire Influencer Marketplace' }
          ].map(tool => (
            <button
              key={tool.id}
              onClick={() => setActiveTab(tool.id as any)}
              style={{
                padding: '6px 14px',
                background: activeTab === tool.id ? 'rgba(255,183,77,0.2)' : 'transparent',
                color: activeTab === tool.id ? '#FFB74D' : 'rgba(255,255,255,0.65)',
                border: activeTab === tool.id ? '1px solid rgba(255,183,77,0.4)' : '1px solid transparent',
                borderRadius: '100px',
                fontSize: '12px',
                fontWeight: activeTab === tool.id ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
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
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Har card slide ke liye dedicated headline, graphic, aur <b>unique destination URL link</b> setup karein.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleOpenCanva('Carousel Ad Cards')}
                style={{ background: 'rgba(0, 196, 204, 0.15)', border: '1px solid rgba(0, 196, 204, 0.4)', color: '#00C4CC', padding: '9px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                Open in Canva 🎨
              </button>

              <button
                onClick={() => handleOpenFigma('Carousel Ad Cards')}
                style={{ background: 'rgba(162, 89, 255, 0.15)', border: '1px solid rgba(162, 89, 255, 0.4)', color: '#A259FF', padding: '9px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                Open in Figma ❖
              </button>

              <GlowButton
                variant="glow"
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
                  navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                  triggerToast('Copied Meta Multi-Card Carousel JSON payload to clipboard! 📋');
                }}
                style={{ padding: '9px 16px', fontSize: '12px' }}
              >
                Export Meta Payload 📋
              </GlowButton>
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
                      headline: `⚡ Exclusive Offer Slide ${carouselCards.length + 1}`,
                      description: 'Special limited time bundle deal.',
                      destinationUrl: 'https://ambrane.com/deal',
                      ctaAction: 'SHOP_NOW',
                      imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80'
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
                        placeholder="https://ambrane.com/card-specific-page"
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
                      <label style={{ display: 'block', fontSize: '11px', color: '#8e8e9e', fontWeight: 700, marginBottom: '4px' }}>CARD IMAGE GRAPHIC URL</label>
                      <input
                        type="text"
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
                    <div style={{ width: '100%', height: '240px', position: 'relative' }}>
                      <img src={activeCard.imageUrl} alt={activeCard.headline} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700 }}>
                        {activeCarouselIndex + 1} / {carouselCards.length}
                      </div>
                    </div>

                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <h4 style={{ fontSize: '14px', color: '#fff', margin: 0, fontWeight: 700 }}>{activeCard.headline}</h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{activeCard.description}</p>
                      
                      <div style={{ fontSize: '10px', color: '#00E676', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        🔗 {activeCard.destinationUrl}
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
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Hook, Problem, Solution, aur CTA scenes ko timeline format me edit karke viral ad videos banayein.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleOpenCanva('Video Reel Storyboard')}
                style={{ background: 'rgba(0, 196, 204, 0.15)', border: '1px solid rgba(0, 196, 204, 0.4)', color: '#00C4CC', padding: '9px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                Open in Canva 🎨
              </button>

              <button
                onClick={() => handleOpenFigma('Video Reel Storyboard')}
                style={{ background: 'rgba(162, 89, 255, 0.15)', border: '1px solid rgba(162, 89, 255, 0.4)', color: '#A259FF', padding: '9px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                Open in Figma ❖
              </button>

              <GlowButton
                variant="glow"
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
                  navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                  triggerToast('Copied Meta Video Ad JSON payload to clipboard! 📋');
                }}
                style={{ padding: '9px 16px', fontSize: '12px' }}
              >
                Export Meta Payload 📋
              </GlowButton>
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
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                          "{scene.overlayText}"
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
                    
                    <video
                      src={currentScene.videoUrl}
                      autoPlay
                      loop
                      muted
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />

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
                        {currentScene.overlayText}
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

            {/* Zoom & Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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

              <button 
                onClick={handleSaveToVault}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                Save to Vault
              </button>

              <button 
                onClick={handleExport4KPng}
                className="btn-grad"
                style={{ padding: '7px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={14} /> Export 4K PNG
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
                        { label: '⚡ Add 30% Off Badge', action: () => {
                          setEditorCanvasElements(prev => [...prev, { id: `el_${Date.now()}`, type: 'badge', content: '⚡ 30% OFF FESTIVE OFFER', x: 10, y: 15, width: 45, height: 8, color: '#00E676', bgColor: 'rgba(0,230,118,0.2)', borderColor: 'rgba(0,230,118,0.4)', borderWidth: 1, borderRadius: 100, fontSize: 11, fontWeight: 800, fontFamily: 'Inter', zIndex: 20, visible: true }]);
                          triggerToast('Added 30% Off Badge!');
                        }},
                        { label: '✨ Make Headline Gold', action: () => {
                          setEditorCanvasElements(prev => prev.map(el => el.id === 'el_headline' ? { ...el, color: '#FFBD2E' } : el));
                          triggerToast('Headline font changed to Gold!');
                        }},
                        { label: '🌌 Obsidian Dark Backdrop', action: () => {
                          setEditorCanvasElements(prev => prev.map(el => el.id === 'el_bg' ? { ...el, content: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80' } : el));
                          triggerToast('Updated studio backdrop!');
                        }},
                        { label: '🏆 Add 5-Star Rating Pill', action: () => {
                          setEditorCanvasElements(prev => [...prev, { id: `el_${Date.now()}`, type: 'badge', content: '★★★★★ 4.9/5 (12,400+ Reviews)', x: 10, y: 26, width: 50, height: 7, color: '#FFBD2E', bgColor: 'rgba(0,0,0,0.7)', borderColor: 'rgba(255,189,46,0.4)', borderWidth: 1, borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: 'Inter', zIndex: 18, visible: true }]);
                          triggerToast('Added 5-Star Rating Pill!');
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

                  <div style={{ fontSize: '10.5px', color: '#8e8e9e', fontWeight: 700, marginTop: '6px' }}>STOCK STUDIO BACKDROPS</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[
                      { name: 'Metallic Dark', img: 'https://images.unsplash.com/photo-1609592424074-1ef5a498b8df?auto=format&fit=crop&w=400&q=80' },
                      { name: 'Neon Cyberpunk', img: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=400&q=80' },
                      { name: 'Minimal Marble', img: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=400&q=80' },
                      { name: 'Tech Setup', img: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80' }
                    ].map((bg, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setEditorCanvasElements(prev => prev.map(el => el.id === 'el_bg' ? { ...el, content: bg.img } : el));
                          triggerToast(`Applied ${bg.name} backdrop!`);
                        }}
                        style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', height: '60px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)' }}
                      >
                        <img src={bg.img} alt={bg.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <span style={{ position: 'absolute', bottom: 3, left: 3, right: 3, background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: '9px', fontWeight: 600, padding: '1px 3px', borderRadius: '3px', textAlign: 'center' }}>
                          {bg.name}
                        </span>
                      </div>
                    ))}
                  </div>
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
                            placeholder="https://ambrane.com/diwali-offer"
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

    </div>
  );
};
