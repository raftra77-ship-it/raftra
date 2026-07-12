import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LogLine } from '../components/TerminalFeed';
import { ReviewDrawer } from '../components/ReviewDrawer';
import { SEOAgencyReportModal } from '../components/SEOAgencyReportModal';
import type { ReviewItem } from '../components/ReviewDrawer';
import { WorkspaceCreative } from '../components/workspaces/WorkspaceCreative';
import { WorkspaceCampaign } from '../components/workspaces/WorkspaceCampaign';
import type { CampaignItem } from '../components/workspaces/WorkspaceCampaign';
import { WorkspaceSEO } from '../components/workspaces/WorkspaceSEO';
import { WorkspaceAnalytics } from '../components/workspaces/WorkspaceAnalytics';
import type { ChatMessage } from '../components/workspaces/WorkspaceAnalytics';
import { WorkspaceSocial } from '../components/workspaces/WorkspaceSocial';
import type { SocialPostItem } from '../components/workspaces/WorkspaceSocial';
import { WorkspaceInfluencer } from '../components/workspaces/WorkspaceInfluencer';
import { GlowButton } from '../components/GlowButton';
import '../App.css';

import {
  Cpu,
  LayoutDashboard,
  Sparkles,
  Megaphone,
  Globe2,
  BarChart3,
  Share2,
  Users2,
  CheckCircle,
  Zap,
  Search,
  Bell,
  BookOpen,
  ToyBrick,
  Settings,
  ChevronDown,
  Sparkle,
  FileText,
  LogOut
} from 'lucide-react';

type NavigationTab =
  | 'control'
  | 'studio'
  | 'campaign'
  | 'seo'
  | 'analytics'
  | 'social'
  | 'influencer'
  | 'agents'
  | 'kb'
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

export function BrandDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<NavigationTab>('control');

  // User details extracted from JWT
  const [userName, setUserName] = useState<string>('User');

  // UI Overlays
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

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

  // Brand data submitted from onboarding
  const [brandProfile, setBrandProfile] = useState({
    url: 'aura.com',
    name: 'Aura Premium',
    tone: 'Premium & Modern',
    colors: 'Indigo & Obsidian',
  });

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
  const [priorities, setPriorities] = useState<{ id: string; title: string; description: string; type: string }[]>([]);

  // Metrics, Billing and node locks state
  const [metrics, setMetrics] = useState({
    revenue: 0,
    roas: 0.0,
    seoVisibility: 0,
    aiVisibility: 0,
    campaignHealth: 0,
    growthScore: 0
  });
  const [billingBalance, setBillingBalance] = useState<number>(0);
  const [unlockedNodes, setUnlockedNodes] = useState<string[]>([]);

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
      const ws = new WebSocket('ws://localhost:8005/ws');
      
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
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }
    const headers: HeadersInit = { 'Authorization': `Bearer ${token}` };

    fetch('/api/workspaces', { headers })
      .then(res => {
        if (res.status === 401) {
          // Token expired or invalid — clear and redirect to login
          localStorage.removeItem('token');
          navigate('/');
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data && data.length > 0) {
          const ws = data[0];
          setWorkspaceId(ws.id);
          setBrandProfile({
            url: ws.company_url || 'aura.com',
            name: ws.name,
            tone: ws.brand_voice || 'Premium & Modern',
            colors: ws.brand_color || 'Indigo & Obsidian'
          });
        }
      })
      .catch(err => console.error("Failed to fetch workspaces:", err));
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
            <Sparkle size={24} />
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

  const handleComposeSocial = (caption: string, platform: 'Twitter' | 'LinkedIn' | 'Instagram') => {
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
          response = 'Based on the connected APIs, your current budget allocation is heavily skewed towards Meta Ads (40%). However, given recent CPA trends, diversifying further into TikTok and LinkedIn could reduce overall customer acquisition costs by an estimated 12%.';
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

  const handleFixPriority = (title: string) => {
    setPriorities((prev) => prev.filter((p) => p.title !== title));
    const timeStr = new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        time: timeStr,
        agent: 'Optimization Agent',
        message: `Auto-fix action parsed successfully for priority node: "${title}"`,
      },
    ]);
  };


  return (
    <div className="dashboard-container">
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Cpu className="logo-icon" size={20} />
          <span style={{ fontWeight: 800, fontSize: '15px', fontFamily: 'var(--font-heading)' }}>
            RAFTRA ENGINE
          </span>
        </div>

        <div className="sidebar-menu">
          <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)', paddingLeft: '14px', marginBottom: '8px', display: 'block', fontFamily: 'var(--font-mono)' }}>
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

          <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)', paddingLeft: '14px', margin: '12px 0 6px', display: 'block', fontFamily: 'var(--font-mono)' }}>
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
            onClick={() => setActiveTab('influencer')}
            className={`sidebar-item ${activeTab === 'influencer' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <Users2 size={15} />
              <span>Influencer Marketplace</span>
            </div>
          </button>

          <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)', paddingLeft: '14px', margin: '12px 0 6px', display: 'block', fontFamily: 'var(--font-mono)' }}>
            AI NETWORK
          </span>

          <button
            onClick={() => setActiveTab('agents')}
            className={`sidebar-item ${activeTab === 'agents' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <Cpu size={15} />
              <span>AI Agents</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('kb')}
            className={`sidebar-item ${activeTab === 'kb' ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="sidebar-item-left">
              <BookOpen size={15} />
              <span>Knowledge Base</span>
            </div>
          </button>

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
            <div className="user-avatar">{(brandProfile?.name || 'B').charAt(0)}</div>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 600 }}>{brandProfile?.name || 'Brand Workspace'}</h4>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{brandProfile?.url || 'loading...'}</p>
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
      <main className="dashboard-main">
        {/* Header/Top Bar */}
        <header className="dashboard-header">
          {/* Workspace Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {brandProfile?.name || (userName ? `${userName}'s Workspace` : 'My Workspace')}
            </span>
            <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} />
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

            {/* AI Assistant button */}
            <button
              onClick={() => setActiveTab('analytics')}
              className="topbar-icon-button"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--accent)', background: 'var(--accent-glow)', padding: '4px 10px', borderRadius: 'var(--radius-md)' }}
            >
              <Sparkle size={12} />
              <span>AI Assistant</span>
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
              {/* Home Greeting Title */}
              <div>
                <h1 style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>
                  Good Morning {userName} 👋
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  Your marketing agents are working background operations. Here is today's summary context.
                </p>
              </div>
              
              {!workspaceId && (
                <div style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff' }}>No Workspace Setup Detected</h3>
                  <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
                    You need to initialize your brand's AI knowledge graph before the agents can operate.
                  </p>
                  <GlowButton variant="glow" onClick={() => setAppState('onboarding')}>
                    Run Quick Setup Wizard
                  </GlowButton>
                </div>
              )}

              {/* Growth Summary metrics grid (6 cards!) */}
              <div>
                <h3 style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  TODAY'S GROWTH SUMMARY
                </h3>
                <div className="metrics-row">
                  <div className="metric-widget" onClick={() => setActiveTab('analytics')}>
                    <span className="metric-title">REVENUE</span>
                    <span className="metric-value">${metrics.revenue.toLocaleString()}</span>
                    <span className="metric-trend up" style={{ fontSize: '10px' }}>{metrics.revenue > 0 ? '+14.2%' : '0%'}</span>
                  </div>

                  <div className="metric-widget" onClick={() => setActiveTab('campaign')}>
                    <span className="metric-title">ROAS</span>
                    <span className="metric-value">{metrics.roas}x</span>
                    <span className="metric-trend up" style={{ fontSize: '10px' }}>{metrics.roas > 0 ? '+0.4x' : '0.0x'}</span>
                  </div>

                  <div className="metric-widget" onClick={() => setActiveTab('seo')}>
                    <span className="metric-title">SEO VISIBILITY</span>
                    <span className="metric-value">{metrics.seoVisibility}%</span>
                    <span className="metric-trend up" style={{ fontSize: '10px' }}>{metrics.seoVisibility > 0 ? '+3.1%' : '0%'}</span>
                  </div>

                  <div className="metric-widget" onClick={() => setActiveTab('seo')}>
                    <span className="metric-title">AI VISIBILITY</span>
                    <span className="metric-value">{metrics.aiVisibility}%</span>
                    <span className="metric-trend up" style={{ fontSize: '10px' }}>{metrics.aiVisibility > 0 ? '+12.8%' : '0%'}</span>
                  </div>

                  <div className="metric-widget" onClick={() => setActiveTab('campaign')}>
                    <span className="metric-title">CAMPAIGN HEALTH</span>
                    <span className="metric-value">{metrics.campaignHealth}%</span>
                    <span className="metric-trend up" style={{ color: 'var(--success)', fontSize: '10px' }}>{metrics.campaignHealth > 0 ? 'Optimal' : 'Offline'}</span>
                  </div>

                  <div className="metric-widget" onClick={() => setActiveTab('control')}>
                    <span className="metric-title">GROWTH SCORE</span>
                    <span className="metric-value">{metrics.growthScore}/100</span>
                    <span className="metric-trend up" style={{ fontSize: '10px' }}>{metrics.growthScore > 0 ? 'Peak' : 'Offline'}</span>
                  </div>
                </div>
              </div>

              {/* AI Agents Working Now (Agent status cards) */}
              <div>
                <h3 style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  AI AGENTS WORKING NOW
                </h3>
                <div className="agent-cards-grid">
                  {agentsList.map((agent) => (
                    <div key={agent.name} className="agent-status-card">
                      <div className="agent-status-card-header">
                        <div className="agent-name-row">
                          <span className="agent-icon-bulb working" />
                          <span className="agent-card-title">{agent.name}</span>
                        </div>
                      </div>

                      <div className="agent-metric-detail-row">
                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Current Task:</span>
                          <span style={{ fontWeight: 500, color: '#fff', textAlign: 'right' }}>{agent.task}</span>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            <span>Progress</span>
                            <span>{agent.progress}%</span>
                          </div>
                          <div className="agent-progress-chassis">
                            <div className="agent-progress-fill" style={{ width: `${agent.progress}%` }} />
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>ETA:</span>
                          <span>{agent.eta}</span>
                        </div>

                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Latest Result:</span>
                          <span style={{ color: 'var(--success)', fontWeight: 600 }}>{agent.result}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Priorities & Recent actions grid */}
              <div className="dashboard-grid-top">
                <div className="attention-center">
                  <div className="attention-header">
                    <h3 style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      AI PRIORITIES
                    </h3>
                    {priorities.length > 0 && (
                      <span className="attention-badge">{priorities.length} Tasks Queue</span>
                    )}
                  </div>

                  <div className="attention-list">
                    {priorities.length === 0 ? (
                      <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                        <CheckCircle size={22} style={{ color: 'var(--success)', marginBottom: '8px' }} />
                        <p style={{ fontSize: '12px' }}>AI Priorities resolved. Network optimized.</p>
                      </div>
                    ) : (
                      priorities.map((item) => (
                        <div key={item.id} className="attention-item">
                          <div className="attention-item-left">
                            <Zap size={15} className="attention-icon" style={{ color: item.type === 'critical' ? '#ff4757' : '#ffae00' }} />
                            <div>
                              <h4>{item.title}</h4>
                              <p>{item.description}</p>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleFixPriority(item.title)}
                              className="btn btn-primary"
                              style={{ padding: '6px 12px', fontSize: '11px', background: 'var(--success-glow)', border: '1px solid rgba(0, 255, 157, 0.2)', color: 'var(--success)', boxShadow: 'none' }}
                            >
                              Fix Automatically
                            </button>
                            <button
                              onClick={() => handleOpenReview(item.title)}
                              className="btn btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '11px' }}
                            >
                              Review
                            </button>
                            <button
                              onClick={() => handleIgnorePriority(item.title)}
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--text-secondary)' }}
                            >
                              Ignore
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent AI Actions Timeline */}
                <div className="glow-card" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    RECENT AI ACTIONS
                  </h3>
                  <div className="timeline-list">
                    <div className="timeline-item">
                      <span className="timeline-bullet" />
                      <div className="timeline-item-body">
                        <h4>Brand Analysis Completed</h4>
                        <span>Study targets extracted & logo schemas cached</span>
                      </div>
                    </div>
                    <div className="timeline-item">
                      <span className="timeline-bullet" />
                      <div className="timeline-item-body">
                        <h4>Generated 15 Creatives</h4>
                        <span>Static concepts uploaded to reviewing drafts</span>
                      </div>
                    </div>
                    <div className="timeline-item">
                      <span className="timeline-bullet" />
                      <div className="timeline-item-body">
                        <h4>Published Meta Campaign</h4>
                        <span>Campaign limits pushed to target FB adset sandbox</span>
                      </div>
                    </div>
                    <div className="timeline-item">
                      <span className="timeline-bullet" />
                      <div className="timeline-item-body">
                        <h4>Updated SEO</h4>
                        <span>Canonical rules & metadata schemas injected</span>
                      </div>
                    </div>
                    <div className="timeline-item">
                      <span className="timeline-bullet" />
                      <div className="timeline-item-body">
                        <h4>Generated Blog</h4>
                        <span>AEO keywords articles drafting completed</span>
                      </div>
                    </div>
                    <div className="timeline-item">
                      <span className="timeline-bullet" />
                      <div className="timeline-item-body">
                        <h4>Found 8 Influencers</h4>
                        <span>Audience indexes crawled & contract templates dished</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Terminal feed removed as requested */}
            </div>
          )}

          {activeTab === 'studio' && (
            <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>

              <WorkspaceCreative
                brandUrl={brandProfile?.url || ''}
                assets={creativeAssets}
                onOpenReview={handleOpenReview}
                onGenerate={handleGenerateCreative}
                onAssetSaved={handleAssetSaved}
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

          {activeTab === 'influencer' && workspaceId && (
            <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>

              <WorkspaceInfluencer workspaceId={workspaceId} />
            </div>
          )}

          {activeTab === 'agents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>AI Network Specialist Agents</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Manage specialized sub-agent rules, active graph operations, and status indicators in your growth pipeline.
                </p>
              </div>

              {/* Agent Flow Diagram */}
              <div className="glow-card" style={{ padding: '28px', background: 'rgba(90, 82, 255, 0.02)', border: '1px solid rgba(90, 82, 255, 0.1)' }}>
                <h3 style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  RAFTRA MARKETING AGENT GRAPH PATHWAY
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                  {agentsList.map((agent, idx) => (
                    <div key={agent.name} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          background: agent.progress > 0 ? 'var(--accent-glow)' : 'rgba(255, 255, 255, 0.01)',
                          border: '1px solid',
                          borderColor: agent.progress > 0 ? 'var(--accent)' : 'var(--border-color)',
                          borderRadius: '8px',
                          padding: '10px 16px',
                          fontSize: '12px',
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          color: agent.progress > 0 ? '#fff' : 'var(--text-secondary)',
                        }}
                      >
                        <span className={`agent-icon-bulb ${agent.progress > 0 ? 'working' : 'idle'}`} style={{ width: '6px', height: '6px' }} />
                        <span>{agent.name}</span>
                      </div>
                      {idx < agentsList.length - 1 && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 'bold' }}>→</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Grid of Agent Cards */}
              <div className="agent-cards-grid">
                {agentsList.map((agent) => (
                  <div key={agent.name} className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`badge-pulse ${agent.progress > 0 ? 'success' : 'warning'}`} style={{ width: '6px', height: '6px' }} />
                      <h4 style={{ fontSize: '14px' }}>{agent.name}</h4>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Task:</span>
                        <span style={{ fontWeight: 500, color: '#fff', textAlign: 'right' }}>{agent.task}</span>
                      </div>
                      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Progress:</span>
                        <span>{agent.progress}%</span>
                      </div>
                      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>ETA:</span>
                        <span>{agent.eta}</span>
                      </div>
                      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Result:</span>
                        <span style={{ color: 'var(--success)' }}>{agent.result}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'kb' && (
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '30px' }}>

              <div>
                <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>Vector Knowledge Base</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Scraped URLs, document guidelines, and semantic logs index used by your AI agents team.
                </p>
              </div>
              <div className="workspace-grid-split">
                <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h3 style={{ fontSize: '16px' }}>Ingest Brand Guidelines</h3>
                  <div className="form-group">
                    <label>Resource URL / API Docs</label>
                    <input type="text" value={brandProfile?.url || ''} onChange={(e) => setBrandProfile((prev: any) => ({ ...prev, url: e.target.value }))} style={{ color: 'white' }} />
                  </div>
                  <div className="form-group">
                    <label>Brand Voice Tone Context</label>
                    <textarea rows={4} value={brandProfile?.tone || ''} onChange={(e) => setBrandProfile((prev: any) => ({ ...prev, tone: e.target.value }))} style={{ color: 'white' }} />
                  </div>
                  <GlowButton variant="secondary" onClick={handleReindex} loading={isReindexing} style={{ width: '100%' }}>
                    Re-index Knowledge Graph
                  </GlowButton>
                </div>
                <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h3 style={{ fontSize: '16px' }}>Vector Datastores</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><FileText size={14} /> BrandVoiceEmbeddings.idx</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>208 vectors</span>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><FileText size={14} /> CompetitorAudits.idx</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>85 vectors</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>Integrations Hub</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Toggle sandbox connections to enable direct publishing nodes.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
                {['Meta Ads Sandbox', 'Google Ads Sandbox', 'LinkedIn Marketing Node', 'Twitter Social API', 'ChatGPT citation pipeline', 'Gemini Citation context'].map((plat) => (
                  <div key={plat} className="glow-card" style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ fontSize: '14px' }}>{plat}</h4>
                      <span style={{ fontSize: '11px', color: 'var(--success)' }}>Connected</span>
                    </div>
                    <span className="badge-pulse success" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>Settings & Billing Center</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Manage company settings, active plans, billing tokens, and brand settings.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Brand Configuration</h3>
                  <div className="form-group">
                    <label>Brand Name</label>
                    <input type="text" value={brandProfile?.name || ''} onChange={(e) => setBrandProfile((prev: any) => ({ ...prev, name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Brand Hue Color</label>
                    <input type="text" value={brandProfile?.colors || ''} onChange={(e) => setBrandProfile((prev: any) => ({ ...prev, colors: e.target.value }))} />
                  </div>
                  <GlowButton variant="glow" onClick={() => alert('Settings saved successfully!')} style={{ width: '100%' }}>
                    Save Settings
                  </GlowButton>
                </div>

                <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600 }}>SaaS Account Balance</h3>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Your current account credits balance is used to instantly activate specialist agent workspaces.
                  </div>
                  <div style={{ background: '#0a0a0c', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CURRENT CREDITS BALANCE</span>
                    <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>
                      ${billingBalance.toFixed(2)}
                    </div>
                  </div>
                  <GlowButton variant="secondary" onClick={handleTopUpShortcut} style={{ width: '100%' }}>
                    Add $100 Credits (Mock Top Up)
                  </GlowButton>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

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
      {activeReviewItem?.type === 'seo' || activeReviewItem?.type === 'geo' ? (
        <SEOAgencyReportModal
          isOpen={isReviewOpen}
          onClose={() => setIsReviewOpen(false)}
          item={activeReviewItem}
          onApprove={handleApprove}
        />
      ) : (
        <ReviewDrawer
          isOpen={isReviewOpen}
          onClose={() => setIsReviewOpen(false)}
          item={activeReviewItem}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}

