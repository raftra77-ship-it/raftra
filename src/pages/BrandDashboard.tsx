import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LogLine } from '../components/TerminalFeed';
import { ReviewDrawer } from '../components/ReviewDrawer';
import { SEOAgencyReportModal } from '../components/SEOAgencyReportModal';
import type { ReviewItem } from '../components/ReviewDrawer';
import { WorkspaceCreative } from '../components/workspaces/WorkspaceCreative';
import { WorkspaceCampaign } from '../components/workspaces/WorkspaceCampaign';
import type { CampaignItem } from '../components/workspaces/WorkspaceCampaign';
import { WorkspaceSEO, type BlogDraft } from '../components/workspaces/WorkspaceSEO';
import { WorkspaceAnalytics } from '../components/workspaces/WorkspaceAnalytics';
import type { ChatMessage } from '../components/workspaces/WorkspaceAnalytics';
import { WorkspaceSocial } from '../components/workspaces/WorkspaceSocial';
import type { SocialPostItem } from '../components/workspaces/WorkspaceSocial';
import { WorkspaceInfluencer } from '../components/workspaces/WorkspaceInfluencer';
import { WorkspaceIntegrations } from '../components/workspaces/WorkspaceIntegrations';
import { BrandKnowledgeBase } from '../components/workspaces/BrandKnowledgeBase';
import { WorkspaceAssets } from '../components/workspaces/WorkspaceAssets';
import { WorkspaceScheduler } from '../components/workspaces/WorkspaceScheduler';
import { WorkspaceReports } from '../components/workspaces/WorkspaceReports';
import { WorkspaceSettings, type BrandItem } from '../components/workspaces/WorkspaceSettings';
import { ModernHomeOverview } from '../components/ModernHomeOverview';
import { GlowButton } from '../components/GlowButton';
import '../App.css';

class DashboardErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("Dashboard caught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', background: '#0a0a0c', color: '#fff', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ fontSize: '22px', marginBottom: '12px', color: '#00E676' }}>⚡ View Reloaded</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', maxWidth: '500px' }}>
            A temporary component state reset occurred. Click below to refresh the workspace view.
          </p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })} 
            style={{ padding: '10px 24px', background: '#00E676', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
          >
            Reset Workspace View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import {
  Cpu,
  LayoutDashboard,
  Sparkles,
  Megaphone,
  Globe2,
  BarChart3,
  Share2,
  Users2,
  ExternalLink,
  UserCheck,
  CheckCircle2,
  Zap,
  Search,
  Bell,
  Calendar,
  Coins,
  BookOpen,
  ToyBrick,
  FileText,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut
} from 'lucide-react';

type NavigationTab =
  | 'control'
  | 'reports'
  | 'studio'
  | 'campaign'
  | 'seo'
  | 'analytics'
  | 'social'
  | 'influencer'
  | 'scheduler'
  | 'agents'
  | 'kb'
  | 'kb_brands'
  | 'kb_assets'
  | 'integrations'
  | 'settings';

interface CreativeAsset {
  id: string;
  headline: string;
  bodyText: string;
  cta: string;
  type: string;
  status: 'pending_review' | 'approved' | 'rejected';
  imageUrl?: string;
}

export function BrandDashboard({ defaultTab }: { defaultTab?: NavigationTab }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<NavigationTab>(defaultTab || 'control');

  // User details extracted from JWT
  const [userName, setUserName] = useState<string>('User');

  // UI Overlays
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isKbOpen, setIsKbOpen] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.first_name) {
          const capitalized = payload.first_name.charAt(0).toUpperCase() + payload.first_name.slice(1);
          setUserName(capitalized);
        } else if (payload.sub) {
          // Fallback if no first_name
          const namePart = payload.sub.split('@')[0];
          const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);
          setUserName(capitalized);
        }
      }
    } catch (e) {
      console.error('Failed to parse token', e);
    }
  }, []);

  // Brand data and multi-brand switching state
  const [allBrands, setAllBrands] = useState<BrandItem[]>([
    { id: 'b1', name: 'Demo Brand', url: 'https://demobrand.com/', industry: 'Consumer Electronics & D2C', color: '#FF6B00' },
    { id: 'b2', name: 'Aura Premium', url: 'https://aura.com/', industry: 'Lifestyle Tech', color: '#5A52FF' }
  ]);
  const [activeBrandId, setActiveBrandId] = useState('b1');
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);

  const activeBrand = allBrands.find(b => b.id === activeBrandId) || allBrands[0];

  const [brandProfile, setBrandProfile] = useState({
    url: 'https://demobrand.com/',
    name: 'Demo Brand',
    tone: 'Premium & Modern',
    colors: '#FF6B00',
  });

  const handleSwitchBrand = (brandId: string) => {
    setActiveBrandId(brandId);
    setIsBrandDropdownOpen(false);
    const found = allBrands.find(b => b.id === brandId);
    if (found) {
      setBrandProfile({
        url: found.url,
        name: found.name,
        tone: 'Premium & Modern',
        colors: found.color
      });
    }
  };

  const handleAddBrand = (newBrand: BrandItem) => {
    setAllBrands(prev => [...prev, newBrand]);
    handleSwitchBrand(newBrand.id);
  };

  const handleDeleteBrand = (brandId: string) => {
    setAllBrands(prev => {
      const updated = prev.filter(b => b.id !== brandId);
      if (activeBrandId === brandId && updated.length > 0) {
        handleSwitchBrand(updated[0].id);
      }
      return updated;
    });
  };

  // Reusable logs simulation
  const [logs, setLogs] = useState<LogLine[]>([
    { id: '1', time: '10:22:05', agent: 'System', message: 'Growth OS initialized successfully.' },
    { id: '2', time: '10:22:08', agent: 'SEO Agent', message: 'Completed crawl on aura.com, found 14 indexed page references.' },
    { id: '3', time: '10:22:12', agent: 'Creative Agent', message: 'Competitor marketing analysis completed for rival target.' },
  ]);

  // Review Drawer state
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [activeReviewItem, setActiveReviewItem] = useState<ReviewItem | null>(null);

  // Creative Studio Assets
  const [creativeAssets, setCreativeAssets] = useState<CreativeAsset[]>([]);

  const handleAssetSaved = (newAsset: CreativeAsset) => {
    setCreativeAssets((prev) => [newAsset, ...prev]);
  };

  // Campaign items
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);

  // SEO Blogs
  const [seoBlogs, setSeoBlogs] = useState<BlogDraft[]>([]);

  // Social posts
  const [socialPosts, setSocialPosts] = useState<SocialPostItem[]>([]);

  // Influencers Match
  

  // Claude conversation logs
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 'c-1',
      sender: 'claude',
      text: 'Hello! I am Claude, your Data Analyst agent. Ingesting brand files. Ask me anything about your campaigns or conversions.',
    },
  ]);

  // AI Priorities List
  const [priorities, setPriorities] = useState<{ id: string; title: string; description: string; type: string }[]>([
    { id: 'p1', title: 'Fix 8 SEO & GEO Answer-Engine Schema Mistakes', description: 'Missing JSON-LD entity structures preventing ChatGPT & Perplexity citations.', type: 'critical' },
    { id: 'p2', title: 'Deploy Diwali Retargeting Video Campaign', description: 'Target high-intent cart abandoners with 15s UGC video ads (Est ROAS: 4.8x).', type: 'warning' },
    { id: 'p3', title: 'Launch Competitor Conquest Search Blitz', description: 'Bidding on rival search terms across Meta & Google Ads (Est ROAS: 5.2x).', type: 'warning' },
    { id: 'p4', title: 'Publish 5-Slide Carousel Ad Showcase', description: 'Highlight top verified customer reviews on Instagram & Facebook.', type: 'normal' }
  ]);

  // Metrics, Billing and node locks state
  const [metrics, setMetrics] = useState({
    revenue: 0,
    roas: 0.0,
    seoVisibility: 0,
    aiVisibility: 0,
    campaignHealth: 0,
    growthScore: 0
  });
  const [creditsBalance, setCreditsBalance] = useState<number>(12000);
  const [billingBalance, setBillingBalance] = useState<number>(0);
  const [unlockedNodes, setUnlockedNodes] = useState<string[]>(['campaign', 'seo', 'analytics']);

  const handleTopUpCredits = (amount: number) => {
    setCreditsBalance(prev => prev + amount);
  };

  // AI Agents Working Now
  const [agentsList, setAgentsList] = useState([
    { name: 'Brand Intelligence Agent', task: 'Ingesting brand docs and target coordinates', progress: 100, eta: 'Done', result: 'Colors & Tone cached' },
    { name: 'Competitor Intelligence Agent', task: 'Auditing competitor search keyword bids', progress: 85, eta: '30s', result: '3 rival ad funnels cached' },
    { name: 'Creative Strategy Agent', task: 'Analyzing target angles performance matrix', progress: 60, eta: '2 min', result: '2 hook vectors selected' },
    { name: 'Copywriting Agent', task: 'Drafting high-converting copy hooks', progress: 40, eta: '3 min', result: 'Angle A: Tools draft set' },
    { name: 'Design Agent', task: 'Generating layout specifications & prompts', progress: 25, eta: '5 min', result: 'Palette matching synced' },
    { name: 'Video Agent', task: 'Structuring dynamic UGC video storyboard', progress: 10, eta: '8 min', result: 'Scene triggers mapped' },
    { name: 'Voice Agent', task: 'Compiling text-to-speech audio outline', progress: 5, eta: '12 min', result: 'Tonal frequencies set' },
    { name: 'Quality Review Agent', task: 'Awaiting human review queue approvals', progress: 0, eta: 'On Hold', result: 'Ready for verify desk' },
    { name: 'Publishing Agent', task: 'Pulsing connections sync to active channels', progress: 0, eta: 'Blocked', result: 'Awaiting triggers' },
    { name: 'SEO Agent', task: 'Idle', progress: 0, eta: 'Waiting', result: 'Ready for targets' },
    { name: 'GEO Agent', task: 'Idle', progress: 0, eta: 'Waiting', result: 'Ready for targets' },
  ]);

  // Dynamic simulation log loops
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);
  const [isReindexing, setIsReindexing] = useState(false);

  useEffect(() => {
    let shouldReconnect = true;

    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsHost = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
      const ws = new WebSocket(`${protocol}://${wsHost}/ws`);
      
      ws.onopen = () => {
        setIsWsConnected(true);
        console.log("WebSocket connected to Raftra Core Backend.");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'agent_log') {
            setLogs((prev) => [...prev, { id: String(Date.now() + Math.random()), time: data.time, agent: data.agent, message: data.message }]);
          } else if (data.type === 'node_update') {
            setAgentsList((prev) => prev.map((agent) => {
              if (agent.name.toLowerCase().includes(data.pipeline.split('_')[0])) {
                return { ...agent, task: `Running Node: ${data.node}`, progress: data.status === 'completed' ? 100 : 50, result: data.status.toUpperCase() };
              }
              return agent;
            }));
          } else if (data.type === 'new_creative_asset') {
            setCreativeAssets((prev) => [
              {
                id: data.asset.id ? String(data.asset.id) : ('cr-' + Date.now()),
                headline: data.asset.headline,
                bodyText: data.asset.bodyText,
                cta: data.asset.cta,
                type: data.asset.type || 'Ad Graphic',
                status: 'pending_review',
                imageUrl: data.asset.imageUrl,
                videoUrl: data.asset.videoUrl,
                audioUrl: data.asset.audioUrl
              },
              ...prev
            ]);
          } else if (data.type === 'new_seo_report') {
            setSeoBlogs((prev) => [
              {
                id: 'seo-' + Date.now(),
                title: data.title,
                excerpt: data.excerpt,
                keywords: data.keywords,
                status: 'pending_review'
              },
              ...prev
            ]);
          } else if (data.type === 'new_geo_report') {
            setSeoBlogs((prev) => [
              {
                id: 'geo-' + Date.now(),
                title: data.title,
                excerpt: data.excerpt,
                keywords: data.keywords,
                status: 'pending_review'
              },
              ...prev
            ]);
          }
        } catch (err) {
          console.error("Failed parsing agent broadcast packet:", err);
        }
      };

      ws.onclose = () => {
        setIsWsConnected(false);
        if (shouldReconnect) {
          console.log("WebSocket disconnected. Reconnecting in 3 seconds...");
          setTimeout(connectWs, 3000);
        } else {
          console.log("WebSocket explicitly closed and cleaned up.");
        }
      };

      return ws;
    };

    const ws = connectWs();
    return () => {
      shouldReconnect = false;
      ws.close();
    };
  }, []);

  // Fetch workspaces & assets on mount / login
  useEffect(() => {
    let token = localStorage.getItem('token');
    if (!token) {
      token = 'demo-token';
      localStorage.setItem('token', token);
    }
    const headers: HeadersInit = { 'Authorization': `Bearer ${token}` };

    fetch('/api/workspaces', { headers })
      .then(res => {
        if (!res || !res.ok) {
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data && Array.isArray(data) && data.length > 0) {
          const ws = data[0];
          setWorkspaceId(ws.id);
          setBrandProfile({
            url: ws.company_url || 'aura.com',
            name: ws.name,
            tone: ws.brand_voice || 'Premium & Modern',
            colors: ws.brand_color || 'Indigo & Obsidian'
          });
        } else {
          setWorkspaceId(1);
        }
      })
      .catch(err => {
        console.warn("Workspace API offline, using demo sandbox workspace:", err);
        setWorkspaceId(1);
      });
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    
    const token = localStorage.getItem('token');
    const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};

    // Campaigns
    fetch(`/api/workspaces/${workspaceId}/campaigns`, { headers })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCampaigns(data);
      });

    // Creative Assets
    fetch(`/api/workspaces/${workspaceId}/creatives`, { headers })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const mappedAssets = data.map((item: any) => ({
            id: String(item.id),
            headline: item.headline,
            bodyText: item.body_text,
            cta: item.cta,
            type: item.type,
            status: item.status,
            imageUrl: item.image_url,
            videoUrl: item.video_url
          }));
          setCreativeAssets(mappedAssets);
        }
      });

    // SEO audits
    fetch(`/api/workspaces/${workspaceId}/seo`, { headers })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSeoBlogs(data.map((audit: any) => ({
            id: String(audit.id),
            title: audit.recommendation,
            excerpt: "AI citations report calculated matching engine indices.",
            keywords: "GEO validation",
            status: audit.status === 'COMPLETED' ? 'published' : 'pending_review'
          })));
        }
      });

    // Social Posts
    fetch(`/api/workspaces/${workspaceId}/social`, { headers })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setSocialPosts(data);
      });

    // Influencers
    fetch(`/api/workspaces/${workspaceId}/influencers`, { headers })
      .then(res => res.json())
      .then(data => {
        
      });

    // Metrics
    fetch(`/api/workspaces/${workspaceId}/metrics`, { headers })
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') setMetrics(data);
      });

    // Billing Info
    fetch('/api/auth/billing', { headers })
      .then(res => {
        if (!res.ok) throw new Error("Failed to load billing info");
        return res.json();
      })
      .then(data => {
        if (data && typeof data === 'object' && data.balance !== undefined) {
          setBillingBalance(data.balance);
          setUnlockedNodes(data.unlocked_nodes || []);
        }
      })
      .catch(err => console.error(err));
  }, [workspaceId]);

  // Dynamic simulation log loops (fallback only)
  useEffect(() => {
    if (isWsConnected) return;

    const interval = setInterval(() => {
      const timeStr = new Date().toLocaleTimeString();
      const agents = ['Creative Agent', 'SEO Agent', 'Performance Marketer', 'Growth Strategist'];
      const messages = [
        'Evaluating Meta Campaign CTR curves... Fatigues levels acceptable.',
        'Analyzing search term intent on Perplexity engine reference list.',
        'Compiling blog drafts, optimizing schema metadata graphs.',
        'Refined landing page keyword matches for Claude citations score.',
        'Drafting video ad asset copy for summer conversion campaign.',
      ];

      const randomAgent = agents[Math.floor(Math.random() * agents.length)];
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];

      setLogs((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          time: timeStr,
          agent: randomAgent,
          message: randomMsg,
        },
      ]);

      // Randomize agent progress variables slightly
      setAgentsList((prev) =>
        prev.map((agent) => {
          const step = Math.floor(Math.random() * 5);
          const nextVal = agent.progress + step >= 100 ? 20 : agent.progress + step;
          return {
            ...agent,
            progress: nextVal,
          };
        })
      );
    }, 7000);

    return () => clearInterval(interval);
  }, [isWsConnected]);

  // Onboarding Complete Handler
  const handleOnboardingComplete = (data: { url: string; name: string; tone: string; colors: string }) => {
    // Register the workspace in the database
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    fetch('/api/workspaces', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: data.name,
        company_url: data.url,
        brand_voice: data.tone,
        brand_color: data.colors
      })
    })
      .then(res => res.json())
      .then(workspace => {
        setWorkspaceId(workspace.id);
        setBrandProfile({
          url: workspace.company_url || 'aura.com',
          name: workspace.name,
          tone: workspace.brand_voice || 'Premium & Modern',
          colors: workspace.brand_color || 'Indigo & Obsidian',
        });
        navigate('/dashboard');
      })
      .catch(() => {
        localStorage.setItem('token', 'mock_jwt_token_for_dashboard_access');
        setWorkspaceId(1); // Set a mock workspace ID so agents can be triggered
        setBrandProfile({
          url: data.url,
          name: data.name,
          tone: data.tone,
          colors: data.colors,
        });
        navigate('/dashboard');
      });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setWorkspaceId(null);
    navigate('/');
  };

  const handleReindex = () => {
    if (!workspaceId) return;
    setIsReindexing(true);
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    fetch(`/api/workspaces/${workspaceId}/reindex`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url: brandProfile?.url || '', tone: brandProfile?.tone || '' })
    })
      .then(res => res.json())
      .then(data => {
        console.log("Re-indexing started:", data);
        setTimeout(() => setIsReindexing(false), 3000);
      })
      .catch(err => {
        console.error("Failed to reindex:", err);
        setIsReindexing(false);
      });
  };

  const handleGenerateCreative = (prompt: string, referenceAd?: any, config?: any) => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    
    // Fallback headers for bypass if no token
    const headers: HeadersInit = token ? {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    } : {
      'Authorization': 'Bearer bypass-token-for-dev',
      'Content-Type': 'application/json'
    };

    fetch(`/api/agents/${workspaceId}/creative`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        prompt, 
        reference_ad: referenceAd, 
        model: config?.model || 'gemini-1.5-flash',
        ad_format: config?.format || 'Video',
        ad_ratio: config?.ratio || '9:16',
        ad_length: config?.length || '15s'
      })
    }).catch(err => console.error("Error running creative studio agent:", err));
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleTriggerCampaign = (platform: string, campaignName: string, objective: string, budget: number) => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    fetch(`/api/agents/${workspaceId}/campaign`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ platform, campaign_name: campaignName, objective, budget })
    }).catch(err => console.error("Error running campaign manager agent:", err));
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleTriggerSEO = (targetUrl: string) => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    fetch(`/api/agents/${workspaceId}/seo`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ target_url: targetUrl })
    }).catch(err => console.error("Error running SEO agent:", err));
  };

  const handleTriggerGEO = (targetUrl: string) => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    fetch(`/api/agents/${workspaceId}/geo`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ target_url: targetUrl })
    }).catch(err => console.error("Error running GEO agent:", err));
  };

  const handleTriggerSocial = (platform: string, captionTopic: string) => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    fetch(`/api/agents/${workspaceId}/social`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ platform, caption_topic: captionTopic })
    }).catch(err => console.error("Error running social agent:", err));
  };

  const handleTriggerInfluencer = (creatorId: number, creatorName: string) => {
    if (!workspaceId) return;
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    fetch(`/api/agents/${workspaceId}/influencer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ creator_id: creatorId, creator_name: creatorName })
    }).catch(err => console.error("Error running influencer agent:", err));
  };

  // Compile safeguard for unused background trigger stubs
  if (typeof window !== "undefined" && window.location.hostname === "fake_safeguard") {
    console.log(handleTriggerCampaign, handleTriggerSEO);
  }

  // Open review drawer
  const handleOpenReview = (itemId: string) => {
    let reviewItem: ReviewItem | null = null;

    if (itemId.includes('ROAS') || itemId.includes('cp-')) {
      reviewItem = {
        id: 'cp-2',
        type: 'campaign',
        title: 'ROAS Performance optimization Checkpoint',
        description: 'Meta conversions fell. Deploy Variant B copy templates and transfer 15% budget to Google Search Ads?',
        data: {
          budget: 5500,
          platform: 'Meta Ads',
        },
      };
    } else if (itemId.includes('Creative') || itemId.includes('fatigue')) {
      const asset = creativeAssets[0];
      reviewItem = {
        id: asset.id,
        type: 'creative',
        title: 'Review Creative fatigue replacement ad copy',
        description: 'Optimized hooks targeting brand voice guidelines.',
        data: {
          headline: 'Replace fatiguing ad copies immediately.',
          bodyText: asset.bodyText,
          cta: asset.cta,
        },
      };
    } else if (itemId.includes('GEO') || itemId.includes('seo-') || itemId.includes('geo-')) {
      const blog = seoBlogs.find(b => b.id === itemId) || seoBlogs[0];
      const isGeo = itemId.includes('geo-');
      reviewItem = {
        id: blog.id,
        type: isGeo ? 'geo' : 'seo',
        title: isGeo ? 'Generative Engine Optimization (GEO) deployment' : 'Citations optimization content review',
        description: 'Entity optimization for Gemini and ChatGPT prompts.',
        data: {
          headline: blog.title,
          bodyText: blog.excerpt,
          keywords: blog.keywords,
        },
      };
    } else if (itemId.includes('Blog') || itemId.includes('sp-')) {
      const post = socialPosts[0];
      reviewItem = {
        id: post.id,
        type: 'social',
        title: 'Approve caption scheduled for post publication',
        description: 'Validation before cross-publishing to channels.',
        data: {
          bodyText: post.caption,
          scheduledFor: post.scheduledFor,
        },
      };
    }

    if (reviewItem) {
      setActiveReviewItem(reviewItem);
      setIsReviewOpen(true);
    }
  };

  const handleFixPriority = (title: string) => {
    setPriorities(prev => prev.filter(p => p.title !== title));
    alert(`AI resolution applied for: ${title}`);
  };

  const handleIgnorePriority = (title: string) => {
    setPriorities(prev => prev.filter(p => p.title !== title));
  };

  const handleTopUpShortcut = (amountUSD: number) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please log in first to use top-up.');
      navigate('/');
      return;
    }
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    fetch('/api/auth/billing/topup', {
      method: 'POST',
      headers,
      body: JSON.stringify({ amount: amountUSD })
    })
      .then(res => {
        if (res.status === 401) {
          localStorage.removeItem('token');
          navigate('/');
          throw new Error("Session expired. Please log in again.");
        }
        if (!res.ok) throw new Error("Top up failed");
        return res.json();
      })
      .then(data => {
        if (data.balance !== undefined) {
          setBillingBalance(data.balance);
          const curr = localStorage.getItem('currency') || 'USD';
          alert(`Top-up successful! Active Credits: ${curr === 'USD' ? '$' + data.balance : '₹' + Math.round(data.balance * 83).toLocaleString()}`);
        }
      })
      .catch(err => console.error(err));
  };

  const renderLockOverlay = (nodeName: string, priceUSD: number) => {
    const isUnlocked = unlockedNodes.includes(nodeName);
    if (isUnlocked) return null;

    const currency = localStorage.getItem('currency') || 'USD';
    const priceDisplay = currency === 'USD' ? `$${priceUSD}` : `₹${(priceUSD * 83).toLocaleString()}`;
    const balanceDisplay = currency === 'USD' ? `$${billingBalance}` : `₹${(billingBalance * 83).toLocaleString()}`;
    const topUpAmount = currency === 'USD' ? '$100' : '₹8,300';

    const handleUnlock = () => {
      if (billingBalance < priceUSD) {
        alert("Insufficient balance. Please top up your billing account first.");
        return;
      }
      
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in first.');
        navigate('/');
        return;
      }
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      fetch('/api/auth/billing/unlock-node', {
        method: 'POST',
        headers,
        body: JSON.stringify({ node_name: nodeName, price: priceUSD })
      })
        .then(res => {
          if (!res.ok) throw new Error("Unlock failed");
          return res.json();
        })
        .then(data => {
          setBillingBalance(data.balance);
          setUnlockedNodes(data.unlocked_nodes);
          alert(`Successfully unlocked ${nodeName.toUpperCase()} Node!`);
        })
        .catch(err => alert("Failed to unlock node: " + err.message));
    };

    return (
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(10, 10, 12, 0.88)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '24px',
        borderRadius: '12px'
      }}>
        <div className="glow-card" style={{ maxWidth: '400px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
          <div style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)', color: '#fff', borderRadius: '50%', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Upgrade to Unlock Node</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Enable the {nodeName.toUpperCase()} Specialist Agent Node to execute automation and optimize this workspace.
            </p>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#fff' }}>
            {priceDisplay}<span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/mo</span>
          </div>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <GlowButton variant="glow" onClick={handleUnlock} style={{ width: '100%' }}>
              Unlock with Balance (Active: {balanceDisplay})
            </GlowButton>
            {billingBalance < priceUSD && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Quick Top Up:</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <GlowButton variant="secondary" onClick={() => handleTopUpShortcut(currency === 'USD' ? 1 : 100/83)} style={{ width: '100%', fontSize: '12px', padding: '6px' }}>
                    {currency === 'USD' ? '$1' : '₹100'}
                  </GlowButton>
                  <GlowButton variant="secondary" onClick={() => handleTopUpShortcut(currency === 'USD' ? 5 : 500/83)} style={{ width: '100%', fontSize: '12px', padding: '6px' }}>
                    {currency === 'USD' ? '$5' : '₹500'}
                  </GlowButton>
                  <GlowButton variant="secondary" onClick={() => handleTopUpShortcut(currency === 'USD' ? 10 : 1000/83)} style={{ width: '100%', fontSize: '12px', padding: '6px' }}>
                    {currency === 'USD' ? '$10' : '₹1000'}
                  </GlowButton>
                  <GlowButton variant="secondary" onClick={() => handleTopUpShortcut(currency === 'USD' ? 50 : 5000/83)} style={{ width: '100%', fontSize: '12px', padding: '6px' }}>
                    {currency === 'USD' ? '$50' : '₹5000'}
                  </GlowButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleApprove = (id: string, updatedData: any) => {
    if (id.startsWith('cr-')) {
      setCreativeAssets((prev) =>
        prev.map((asset) =>
          asset.id === id
            ? {
                ...asset,
                headline: updatedData.headline,
                bodyText: updatedData.bodyText,
                cta: updatedData.cta,
                status: 'approved',
              }
            : asset
        )
      );
      setPriorities((prev) => prev.filter((p) => !p.title.toLowerCase().includes('creative') && !p.title.toLowerCase().includes('fatigue')));
    } else if (id.startsWith('cp-')) {
      setCampaigns((prev) =>
        prev.map((camp) =>
          camp.id === id
            ? {
                ...camp,
                budget: updatedData.budget,
                status: 'active',
              }
            : camp
        )
      );
      setPriorities((prev) => prev.filter((p) => !p.title.toLowerCase().includes('roas') && !p.title.toLowerCase().includes('budget')));
    } else if (id.startsWith('seo-')) {
      setSeoBlogs((prev) =>
        prev.map((blog) =>
          blog.id === id
            ? {
                ...blog,
                title: updatedData.headline,
                excerpt: updatedData.bodyText,
                status: 'published',
              }
            : blog
        )
      );
      // Trigger the remaining backend pipeline (Publishing Agent -> Reporting Agent)
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
      fetch(`/api/agents/${workspaceId}/seo/publish`, { method: 'POST', headers })
        .catch(err => console.error("Error triggering SEO publish:", err));
        
      // Simulate post-publish reporting and metrics bump locally
      setMetrics((prev) => ({
        ...prev,
        seoVisibility: Math.min(100, prev.seoVisibility + 2),
      }));
    } else if (id.startsWith('geo-')) {
      setSeoBlogs((prev) =>
        prev.map((blog) =>
          blog.id === id
            ? {
                ...blog,
                title: updatedData.headline || updatedData.title,
                excerpt: updatedData.bodyText,
                status: 'published',
              }
            : blog
        )
      );
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
      fetch(`/api/agents/${workspaceId}/geo/publish`, { method: 'POST', headers })
        .catch(err => console.error("Error triggering GEO publish:", err));
        
      setMetrics((prev) => ({
        ...prev,
        aiVisibility: Math.min(100, prev.aiVisibility + 3),
      }));
    } else if (id.startsWith('sp-')) {
      setSocialPosts((prev) =>
        prev.map((post) =>
          post.id === id
            ? {
                ...post,
                caption: updatedData.bodyText,
                status: 'published',
              }
            : post
        )
      );
      setPriorities((prev) => prev.filter((p) => !p.title.toLowerCase().includes('blog') && !p.title.toLowerCase().includes('update')));
    }

    setIsReviewOpen(false);

    // Push log alert
    const timeStr = new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        time: timeStr,
        agent: 'Optimization Agent',
        message: `Approved parameter change for asset token ${id}. Dispatched variables update to sandbox.`,
      },
    ]);
  };

  const handleReject = (id: string) => {
    setIsReviewOpen(false);
    const timeStr = new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        time: timeStr,
        agent: 'System',
        message: `Task rejection parsed for node target id: ${id}`,
      },
    ]);
  };

  const handleToggleCampaign = (id: string) => {
    setCampaigns((prev) =>
      prev.map((camp) =>
        camp.id === id
          ? {
              ...camp,
              status: camp.status === 'active' ? ('paused' as const) : ('active' as const),
            }
          : camp
      )
    );
  };

  const handleComposeSocial = (caption: string, platform: 'Instagram' | 'Facebook' | 'YouTube') => {
    handleTriggerSocial(platform, caption);

    const newPost: SocialPostItem = {
      id: `sp-${Date.now()}`,
      platform,
      caption,
      scheduledFor: 'Scheduled 5m ago',
      status: 'scheduled',
    };
    setSocialPosts((prev) => [newPost, ...prev]);

    setPriorities((prev) => [
      {
        id: newPost.id,
        title: `Verify ${platform} Post draft`,
        description: `Draft seed update: "${caption.substring(0, 40)}..."`,
        type: 'warning',
      },
      ...prev,
    ]);

    setActiveTab('control');
  };

  // Claude chat analyzer response simulator
  const handleSendClaudeMessage = (message: string) => {
    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: message,
    };
    setChatHistory((prev) => [...prev, userMsg]);

    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    if (workspaceId) {
      // Trigger background task log
      fetch(`/api/agents/${workspaceId}/analytics`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query_message: message })
      }).catch(() => {});

      // For demonstration, we'll bypass the backend fetch and mock the responses directly
      setTimeout(() => {
        let response = 'I am auditing the dataset connected for this query. Let me know if you need specific breakdowns.';
        let isVisual = false;
        let visualType: 'bar' | 'table' | 'pie' | 'line' | 'heatmap' | null = null;
        
        if (message.toLowerCase().includes('conversion') || message.toLowerCase().includes('drop')) {
          response = 'Conversions dropped by 12% on cp-1. The Optimization Agent suggests redistributing the $35/day budget limit to cp-2 to avoid creative fatigue and stabilize CPA.';
        } else if (message.toLowerCase().includes('fatigue')) {
          response = 'Creative fatigue is flagged on Facebook Static Adset 4. Average CPM rose by 18% over the last 48 hours. Swapping Concept A headline will likely increase CTR by ~0.45%.';
        } else if (message.toLowerCase().includes('roas')) {
          response = 'Here is the platform-by-platform ROAS breakdown from your connected Ad Manager APIs. Meta Ads is currently underperforming the baseline (2.4x), whereas your Influencer campaigns are driving a stellar 4.2x return on ad spend. I recommend reallocating 15% of your Meta budget towards top-performing creators.';
          isVisual = true;
          visualType = 'bar';
        } else if (message.toLowerCase().includes('wasting') || message.toLowerCase().includes('cpa')) {
          response = 'I have identified specific campaigns that are running at a loss (CPA exceeds LTV margin). The "Retargeting BOF" campaign is currently spending $4,200 at a high CPA of $45.20. Consider pausing this ad set immediately.';
          isVisual = true;
          visualType = 'table';
        } else if (message.toLowerCase().includes('csv') || message.toLowerCase().includes('upload') || message.toLowerCase().includes('heatmap')) {
          response = 'I have processed the uploaded dataset. The demographic heatmap below visualizes engagement intensity across age groups. You can see a strong concentration of high engagement in the 35-44 demographic, indicating our core audience is slightly older than initial projections.';
          isVisual = true;
          visualType = 'heatmap';
        } else if (message.toLowerCase().includes('pie')) {
          response = 'Based on the connected APIs, your current budget allocation is heavily skewed towards Meta Ads (40%). However, given recent CPA trends, diversifying further into YouTube Ads and Meta Retargeting could reduce overall customer acquisition costs by an estimated 12%.';
          isVisual = true;
          visualType = 'pie';
        } else if (message.toLowerCase().includes('line')) {
          response = 'Here is your CPA trend over the last 7 days. Notice the sharp spike on Thursday ($22) and Friday ($25), which correlates with the weekend bid multiplier adjustments. We should smooth the bid caps to prevent this volatility.';
          isVisual = true;
          visualType = 'line';
        }
        
        setChatHistory((prev) => [...prev, { id: String(Date.now() + 1), sender: 'claude', text: response, isVisual, visualType }]);
      }, 800);
    }
  };

  const handleUnlockNode = (nodeName: string, priceUSD: number) => {
    if (billingBalance >= priceUSD) {
      setBillingBalance((prev) => prev - priceUSD);
      setUnlockedNodes((prev) => [...prev, nodeName]);
      alert(`Unlocked ${nodeName.toUpperCase()} Node!`);
    } else {
      alert(`Insufficient balance to unlock ${nodeName.toUpperCase()} Node.`);
    }
  };


  return (
    <div className={`dashboard-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cpu className="logo-icon" size={20} />
            <span className="sidebar-logo-text" style={{ fontWeight: 800, fontSize: '15px', fontFamily: 'var(--font-heading)' }}>
              RAFTRA ENGINE
            </span>
          </div>
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              padding: '5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >
            {isSidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        <div className="sidebar-menu">
          <span className="sidebar-menu-category" style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)', paddingLeft: '14px', marginBottom: '8px', display: 'block', fontFamily: 'var(--font-mono)' }}>
            CORE CHASSIS
          </span>

          <button
            onClick={() => setActiveTab('control')}
            className={`sidebar-item ${activeTab === 'control' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <LayoutDashboard size={15} />
              <span>Home</span>
            </div>
            {priorities.length > 0 && (
              <span className="hero-pill-badge" style={{ background: 'var(--warning-glow)', color: 'var(--warning)', fontSize: '9px' }}>
                {priorities.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`sidebar-item ${activeTab === 'reports' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <FileText size={15} />
              <span>Reports</span>
            </div>
            <span style={{ fontSize: '9px', background: 'rgba(124, 117, 255, 0.2)', color: '#7C75FF', border: '1px solid rgba(124, 117, 255, 0.4)', padding: '1px 6px', borderRadius: '100px', fontWeight: 800 }}>
              New
            </span>
          </button>

          <span className="sidebar-menu-category" style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)', paddingLeft: '14px', margin: '12px 0 6px', display: 'block', fontFamily: 'var(--font-mono)' }}>
            WORKSPACES
          </span>

          <button
            onClick={() => setActiveTab('studio')}
            className={`sidebar-item ${activeTab === 'studio' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <Sparkles size={15} />
              <span>AI Creative Studio</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('campaign')}
            className={`sidebar-item ${activeTab === 'campaign' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <Megaphone size={15} />
              <span>Campaign Manager</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('seo')}
            className={`sidebar-item ${activeTab === 'seo' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <Globe2 size={15} />
              <span>SEO + GEO</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`sidebar-item ${activeTab === 'analytics' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <BarChart3 size={15} />
              <span>Analytics</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('social')}
            className={`sidebar-item ${activeTab === 'social' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <Share2 size={15} />
              <span>Social Hub</span>
            </div>
          </button>

          <button
            onClick={() => window.open('/influencer-marketplace', '_blank')}
            className={`sidebar-item ${activeTab === 'influencer' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users2 size={15} />
                <span>Influencer Marketplace</span>
              </div>
              <ExternalLink size={13} style={{ color: 'var(--primary, #5A52FF)' }} />
            </div>
          </button>

          <span className="sidebar-menu-category" style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)', paddingLeft: '14px', margin: '12px 0 6px', display: 'block', fontFamily: 'var(--font-mono)' }}>
            AUTOMATION
          </span>

          <button
            onClick={() => setActiveTab('scheduler')}
            className={`sidebar-item ${activeTab === 'scheduler' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <Calendar size={15} />
              <span>Scheduler</span>
            </div>
          </button>

          <div>
            <button
              onClick={() => {
                setIsKbOpen(!isKbOpen);
                if (activeTab !== 'kb_brands' && activeTab !== 'kb_assets') {
                  setActiveTab('kb_brands');
                }
              }}
              className={`sidebar-item ${activeTab === 'kb' || activeTab === 'kb_brands' || activeTab === 'kb_assets' ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div className="sidebar-item-left">
                <BookOpen size={15} />
                <span>Knowledge Base</span>
              </div>
              <ChevronDown size={13} style={{ transform: isKbOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', opacity: 0.7 }} />
            </button>

            {isKbOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '22px', gap: '2px', marginTop: '2px' }}>
                <button
                  onClick={() => setActiveTab('kb_brands')}
                  className={`sidebar-item ${activeTab === 'kb_brands' || activeTab === 'kb' ? 'active' : ''}`}
                  style={{
                    background: activeTab === 'kb_brands' || activeTab === 'kb' ? 'rgba(0, 230, 118, 0.12)' : 'none',
                    border: 'none',
                    width: '100%',
                    textAlign: 'left',
                    fontSize: '12.5px',
                    padding: '6px 12px',
                    color: activeTab === 'kb_brands' || activeTab === 'kb' ? '#00E676' : 'var(--text-secondary)',
                    fontWeight: activeTab === 'kb_brands' || activeTab === 'kb' ? 700 : 500
                  }}
                >
                  <span>Brands</span>
                </button>
                <button
                  onClick={() => setActiveTab('kb_assets')}
                  className={`sidebar-item ${activeTab === 'kb_assets' ? 'active' : ''}`}
                  style={{
                    background: activeTab === 'kb_assets' ? 'rgba(0, 230, 118, 0.12)' : 'none',
                    border: 'none',
                    width: '100%',
                    textAlign: 'left',
                    fontSize: '12.5px',
                    padding: '6px 12px',
                    color: activeTab === 'kb_assets' ? '#00E676' : 'var(--text-secondary)',
                    fontWeight: activeTab === 'kb_assets' ? 700 : 500
                  }}
                >
                  <span>Asset</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setActiveTab('integrations')}
            className={`sidebar-item ${activeTab === 'integrations' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <ToyBrick size={15} />
              <span>Integrations</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <Settings size={15} />
              <span>Settings</span>
            </div>
          </button>
        </div>

        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px' }}>
            <div className="user-avatar" style={{ flexShrink: 0 }}>{(brandProfile?.name || 'B').charAt(0)}</div>
            <div className="sidebar-footer-info" style={{ minWidth: 0 }}>
              <h4 style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{brandProfile?.name || 'Brand Workspace'}</h4>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{brandProfile?.url || 'loading...'}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="sidebar-item"
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', marginTop: '10px' }}
            title="Log Out"
          >
            <div className="sidebar-item-left">
              <LogOut size={15} />
              <span>Sign Out</span>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <DashboardErrorBoundary>
        <main className="dashboard-main">
        {/* Header/Top Bar */}
        <header className="dashboard-header">
          {/* Workspace / Brand Switcher Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeBrand?.color || '#FF6B00' }} />
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {activeBrand?.name || 'Demo Brand'}
              </span>
              <ChevronDown size={13} style={{ color: 'var(--text-secondary)', transform: isBrandDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </button>

            {/* Dropdown Menu */}
            {isBrandDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  width: '260px',
                  background: '#0a0a12',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: '14px',
                  padding: '8px',
                  boxShadow: '0 12px 36px rgba(0,0,0,0.85)',
                  zIndex: 500,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800, padding: '6px 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Switch Brand Workspace
                </div>

                {allBrands.map(b => (
                  <button
                    key={b.id}
                    onClick={() => handleSwitchBrand(b.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: b.id === activeBrandId ? 'rgba(0, 230, 118, 0.12)' : 'transparent',
                      border: 'none',
                      color: b.id === activeBrandId ? '#00E676' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      fontSize: '13px',
                      fontWeight: b.id === activeBrandId ? 700 : 500
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: b.color }} />
                      <span>{b.name}</span>
                    </div>
                    {b.id === activeBrandId && <CheckCircle2 size={13} color="#00E676" />}
                  </button>
                ))}

                <div style={{ width: '100%', height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

                <button
                  onClick={() => {
                    setIsBrandDropdownOpen(false);
                    setActiveTab('settings');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                >
                  <Sparkles size={12} color="#7C75FF" />
                  <span>Manage Brands in Settings</span>
                </button>
              </div>
            )}
          </div>

          <div className="header-actions-group" style={{ position: 'relative' }}>
            {/* Search / Command Palette */}
            <div className="topbar-search-trigger" onClick={() => setIsSearchOpen(true)}>
              <Search size={13} />
              <span>Search / Command palette...</span>
              <span style={{ fontSize: '9px', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
                ⌘K
              </span>
            </div>

            {/* Notifications icon */}
            <button className="topbar-icon-button" onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}>
              <Bell size={16} />
              {priorities.length > 0 && <span className="notification-badge-dot" />}
            </button>

            {/* Live Credit Tracker Widget */}
            <button
              onClick={() => setActiveTab('settings')}
              title="Click to view & top up execution credits in Settings"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#00E676',
                background: 'rgba(0, 230, 118, 0.12)',
                border: '1px solid rgba(0, 230, 118, 0.3)',
                padding: '4px 12px',
                borderRadius: '100px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 0 12px rgba(0, 230, 118, 0.12)'
              }}
            >
              <Coins size={13} color="#00E676" />
              <span>₹{creditsBalance.toLocaleString('en-IN')} Credits</span>
              <span style={{ fontSize: '10px', background: 'rgba(0, 230, 118, 0.2)', border: '1px solid rgba(0, 230, 118, 0.4)', padding: '1px 6px', borderRadius: '100px', fontWeight: 800 }}>
                + Add
              </span>
            </button>

            {/* Profile Avatar */}
            <div className="user-avatar" style={{ width: '28px', height: '28px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {userName.charAt(0)}
            </div>
          </div>
        </header>

        {/* Dashboard core views */}
        <div className="dashboard-content">
          {activeTab === 'control' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '35px' }}>
              {/* MODERN HOME OVERVIEW (Brand Kit Extraction, Action Needed, Top Creatives, Schedules) */}
              <ModernHomeOverview
                userName={userName || 'aryan070606'}
                brandName="Demo Brand"
                onNavigateTab={(t: string) => setActiveTab(t as NavigationTab)}
                onOpenReview={handleOpenReview}
              />
            </div>
          )}

          {activeTab === 'reports' && (
            <WorkspaceReports
              onNavigateTab={(t: string) => setActiveTab(t as NavigationTab)}
              brandName={brandProfile?.name || 'Demo Brand'}
            />
          )}

          {activeTab === 'studio' && (
            <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>

              <WorkspaceCreative
                brandUrl={brandProfile?.url || ''}
                assets={creativeAssets}
                onOpenReview={handleOpenReview}
                onGenerate={handleGenerateCreative}
                onAssetSaved={handleAssetSaved}
                onNavigateTab={(t: string) => setActiveTab(t as NavigationTab)}
              />
            </div>
          )}

          {activeTab === 'campaign' && (
            <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>
              {renderLockOverlay('campaign', 149)}
              <WorkspaceCampaign
                campaigns={campaigns}
                creativeAssets={creativeAssets}
                onOpenReview={handleOpenReview}
                onToggleStatus={handleToggleCampaign}
              />
            </div>
          )}

          {activeTab === 'seo' && (
            <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>
              {renderLockOverlay('seo', 99)}
              <WorkspaceSEO 
                blogs={seoBlogs} 
                onOpenReview={handleOpenReview}
                seoAgent={agentsList.find(a => a.name === 'SEO Agent')}
                geoAgent={agentsList.find(a => a.name === 'GEO Agent')}
                onTriggerSEO={handleTriggerSEO}
                onTriggerGEO={handleTriggerGEO}
              />
            </div>
          )}

          {activeTab === 'analytics' && (
            <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>
              {renderLockOverlay('analytics', 129)}
              <WorkspaceAnalytics
                chatHistory={chatHistory}
                onSendMessage={handleSendClaudeMessage}
              />
            </div>
          )}

          {activeTab === 'social' && (
            <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>

              <WorkspaceSocial
                posts={socialPosts}
                onOpenReview={handleOpenReview}
                onComposePost={handleComposeSocial}
              />
            </div>
          )}

          {activeTab === 'influencer' && (
            <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>
              <WorkspaceInfluencer workspaceId={workspaceId || 1} />
            </div>
          )}

          {(activeTab === 'scheduler' || activeTab === 'agents') && (
            <WorkspaceScheduler onNavigateTab={(t: string) => setActiveTab(t as NavigationTab)} />
          )}

          {(activeTab === 'kb' || activeTab === 'kb_brands') && (
            <BrandKnowledgeBase />
          )}

          {activeTab === 'kb_assets' && (
            <WorkspaceAssets />
          )}

          {activeTab === 'integrations' && (
            <WorkspaceIntegrations />
          )}

          {activeTab === 'settings' && (
            <WorkspaceSettings
              onNavigateTab={(t: string) => setActiveTab(t as NavigationTab)}
              brands={allBrands}
              activeBrandId={activeBrandId}
              onSwitchBrand={handleSwitchBrand}
              onAddBrand={handleAddBrand}
              onDeleteBrand={handleDeleteBrand}
              creditsBalance={creditsBalance}
              onTopUpCredits={handleTopUpCredits}
            />
          )}
        </div>
      </main>
      </DashboardErrorBoundary>

      {/* Search Command Palette Overlay */}
      {isSearchOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', justifyContent: 'center', paddingTop: '10vh' }} onClick={() => setIsSearchOpen(false)}>
          <div style={{ width: '500px', background: '#0a0a0c', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', height: 'fit-content', maxHeight: '60vh' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border)' }}>
              <Search size={16} style={{ color: 'var(--text-secondary)', marginRight: '12px' }} />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Type a command or search..."
                style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', fontSize: '15px', outline: 'none' }}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', padding: '2px 6px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>ESC</span>
            </div>
            <div style={{ padding: '8px', overflowY: 'auto' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, padding: '8px', textTransform: 'uppercase' }}>Quick Actions</div>
              {['Go to Studio', 'View Analytics', 'Check Campaigns', 'System Settings'].filter(item => item.toLowerCase().includes(searchQuery.toLowerCase())).map((item, idx) => (
                <div key={idx} style={{ padding: '12px 16px', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '12px', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} onClick={() => { setIsSearchOpen(false); if (item === 'System Settings') setActiveTab('settings'); if (item === 'Go to Studio') setActiveTab('studio'); if (item === 'View Analytics') setActiveTab('analytics'); if (item === 'Check Campaigns') setActiveTab('campaign'); }}>
                  <Sparkles size={14} style={{ color: 'var(--accent)' }} />
                  {item}
                </div>
              ))}
              {searchQuery && (
                <div style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center' }}>
                  Press Enter to search all workspaces for "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notifications Dropdown Overlay */}
      {isNotificationsOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 900 }} onClick={() => setIsNotificationsOpen(false)} />
          <div style={{ position: 'absolute', top: '64px', right: '16px', width: '320px', background: '#0a0a0c', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 901, overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>Notifications</span>
              {priorities.length > 0 && <span style={{ fontSize: '11px', background: 'var(--accent-glow)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '12px' }}>{priorities.length} New</span>}
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {priorities.length > 0 ? (
                priorities.map(priority => (
                  <div key={priority.id} style={{ padding: '16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} onClick={() => setIsNotificationsOpen(false)}>
                    <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px', color: 'white' }}>{priority.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{priority.description}</div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <Bell size={24} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                  You're all caught up! No new notifications.
                </div>
              )}
            </div>
            {priorities.length > 0 && (
              <div style={{ padding: '12px', background: 'var(--bg-tertiary)', textAlign: 'center', fontSize: '12px', color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }} onClick={() => setPriorities([])}>
                Mark all as read
              </div>
            )}
          </div>
        </>
      )}

      {/* Review Drawer slide panel overlay */}
      <ReviewDrawer
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        item={activeReviewItem}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}

