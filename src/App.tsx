import { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import { OnboardingWizard } from './components/OnboardingWizard';
import { TerminalFeed } from './components/TerminalFeed';
import type { LogLine } from './components/TerminalFeed';
import { ReviewDrawer } from './components/ReviewDrawer';
import type { ReviewItem } from './components/ReviewDrawer';
import { WorkspaceCreative } from './components/workspaces/WorkspaceCreative';
import { WorkspaceCampaign } from './components/workspaces/WorkspaceCampaign';
import type { CampaignItem } from './components/workspaces/WorkspaceCampaign';
import { WorkspaceSEO } from './components/workspaces/WorkspaceSEO';
import { WorkspaceAnalytics } from './components/workspaces/WorkspaceAnalytics';
import type { ChatMessage } from './components/workspaces/WorkspaceAnalytics';
import { WorkspaceSocial } from './components/workspaces/WorkspaceSocial';
import type { SocialPostItem } from './components/workspaces/WorkspaceSocial';
import { WorkspaceInfluencer } from './components/workspaces/WorkspaceInfluencer';
import type { InfluencerItem } from './components/workspaces/WorkspaceInfluencer';
import { GlowButton } from './components/GlowButton';
import './App.css';

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
  FileText
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
}

interface BlogDraft {
  id: string;
  title: string;
  excerpt: string;
  keywords: string;
  status: 'pending_review' | 'published';
}

function App() {
  // App views: 'landing' | 'onboarding' | 'dashboard'
  const [appState, setAppState] = useState<'landing' | 'onboarding' | 'dashboard'>('landing');

  // Dashboard navigation tab
  const [activeTab, setActiveTab] = useState<NavigationTab>('control');

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
  const [creativeAssets, setCreativeAssets] = useState<CreativeAsset[]>([
    {
      id: 'cr-1',
      headline: 'Consolidate 20 marketing tools into one.',
      bodyText: 'Stop switching between tools for creatives, campaign optimizations, SEO tracking, and influencers. Raftra AI coordinates your entire acquisition loop.',
      cta: 'Start Free Trial',
      type: 'Facebook Static',
      status: 'pending_review',
    },
    {
      id: 'cr-2',
      headline: 'Launch campaign angles in minutes.',
      bodyText: 'Let our AI Creative Director draft copy, layout specs, and audience targeting automatically. Retain human review, deploy in one click.',
      cta: 'Start Free',
      type: 'LinkedIn Text',
      status: 'approved',
    },
  ]);

  // Campaign items
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([
    {
      id: 'cp-1',
      platform: 'Meta',
      name: 'Facebook Conversions - LeadGen',
      objective: 'Lead Conversions',
      budget: 3500,
      roas: 3.8,
      status: 'active',
    },
    {
      id: 'cp-2',
      platform: 'Google',
      name: 'Google High-Intent Search Ads',
      objective: 'Sales Conversions',
      budget: 4800,
      roas: 4.2,
      status: 'pending_review',
    },
  ]);

  // SEO Blogs
  const [seoBlogs, setSeoBlogs] = useState<BlogDraft[]>([
    {
      id: 'seo-1',
      title: 'Why AI Search Engines (GEO) are Replacing Traditional SEO in 2026',
      excerpt: 'ChatGPT, Claude, and Gemini citation indexes are changing discovery. Here is how entity optimization works.',
      keywords: 'GEO optimization, answer engine marketing',
      status: 'pending_review',
    },
    {
      id: 'seo-2',
      title: 'Unified Growth Operating Systems vs Fragmented SaaS Stacks',
      excerpt: 'Understand the ROI advantages of coordinating marketing nodes from one AI terminal.',
      keywords: 'marketing operations ROI',
      status: 'published',
    },
  ]);

  // Social posts
  const [socialPosts, setSocialPosts] = useState<SocialPostItem[]>([
    {
      id: 'sp-1',
      platform: 'LinkedIn',
      caption: 'The cost of switching between 20 marketing tools is higher than you think. Inconsistent messaging, slow turnaround, ignored SEO indexing. Raftra AI aligns your entire marketing loop.',
      scheduledFor: 'Tomorrow, 10:00 AM',
      status: 'scheduled',
    },
    {
      id: 'sp-2',
      platform: 'Twitter',
      caption: 'Traditional SEO is dead. GEO is the future. If Claude or ChatGPT aren\'t citing your product, you\'re invisible.',
      scheduledFor: 'Next Monday, 4:00 PM',
      status: 'published',
    },
  ]);

  // Influencers Match
  const [influencers, setInfluencers] = useState<InfluencerItem[]>([
    {
      id: 'inf-1',
      name: 'Alex GrowthOps',
      handle: '@alexgrowth',
      platform: 'TikTok',
      niche: 'SaaS Tech',
      fitScore: 94,
      successRate: 88,
      status: 'available',
    },
    {
      id: 'inf-2',
      name: 'Sarah Productivity',
      handle: '@sarahprod',
      platform: 'Instagram',
      niche: 'Lifestyle & Travel',
      fitScore: 78,
      successRate: 82,
      status: 'available',
    },
    {
      id: 'inf-3',
      name: 'B2B Marketing Pro',
      handle: '@b2bgrowth',
      platform: 'YouTube',
      niche: 'B2B Growth',
      fitScore: 96,
      successRate: 91,
      status: 'collaborating',
    },
  ]);

  // Claude conversation logs
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 'c-1',
      sender: 'claude',
      text: 'Hello! I am Claude, your Data Analyst agent. I am parsing active endpoints for aura.com. Ask me anything about your campaigns, conversions or budget distribution.',
    },
  ]);

  // AI Priorities List
  const [priorities, setPriorities] = useState([
    { id: 'p-1', title: 'ROAS decreased 12%', description: 'Facebook conversion adset cp-1 CPA rose to $28.40 (limit $22.00).', type: 'critical' },
    { id: 'p-2', title: 'Frequency high', description: 'Meta campaign target frequency hit 4.8x. Creative fatigue risk detected.', type: 'warning' },
    { id: 'p-3', title: 'Creative fatigue', description: 'Google search text creative CTR dropped below baseline by 15%.', type: 'warning' },
    { id: 'p-4', title: 'New GEO opportunity', description: 'AEO crawler detected Rising query density for "aura models review" on ChatGPT.', type: 'opportunity' },
    { id: 'p-5', title: 'Blog needs update', description: 'GEO index crawler suggests adding entity schema linking model docs to Blog 1.', type: 'update' },
  ]);

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
  ]);

  // Dynamic simulation log loops
  useEffect(() => {
    if (appState !== 'dashboard') return;

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
  }, [appState]);

  // Onboarding Complete Handler
  const handleOnboardingComplete = (data: { url: string; name: string; tone: string; colors: string }) => {
    setBrandProfile({
      url: data.url,
      name: data.name,
      tone: data.tone,
      colors: data.colors,
    });
    setAppState('dashboard');
  };

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
    } else if (itemId.includes('GEO') || itemId.includes('seo-')) {
      const blog = seoBlogs[0];
      reviewItem = {
        id: blog.id,
        type: 'seo',
        title: 'Citations optimization content review',
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
      setPriorities((prev) => prev.filter((p) => !p.title.toLowerCase().includes('geo') && !p.title.toLowerCase().includes('opportunity')));
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

  const handleCollaborateInfluencer = (id: string) => {
    setInfluencers((prev) =>
      prev.map((inf) =>
        inf.id === id
          ? {
              ...inf,
              status: 'collaborating',
            }
          : inf
      )
    );
    const influencer = influencers.find((i) => i.id === id);
    const name = influencer ? influencer.name : 'Creator';

    const timeStr = new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        time: timeStr,
        agent: 'Publishing Agent',
        message: `Proposal contract dispatched to ${name}. Status: active partnership initialized.`,
      },
    ]);
  };

  // Claude chat analyzer response simulator
  const handleSendClaudeMessage = (message: string) => {
    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: message,
    };
    setChatHistory((prev) => [...prev, userMsg]);

    let response = 'I am auditing the dataset connected for this query. Let me know if you need specific ROAS breakdowns.';
    if (message.toLowerCase().includes('conversion') || message.toLowerCase().includes('drop')) {
      response = 'Conversions dropped by 12% on cp-1. Optimization Agent suggests redistributing $35/day budget limit to cp-2 to avoid creative fatigue.';
    } else if (message.toLowerCase().includes('fatigue')) {
      response = 'Creative fatigue is flagged on Facebook Static Adset 4. Average CPM rose by 18%. Swapping Concept A headline will increase CTR by ~0.45%.';
    } else if (message.toLowerCase().includes('forecast') || message.toLowerCase().includes('revenue')) {
      response = 'Next month revenue is forecasted to hit $45,000 (+7.1%) if Google Adset budget limits are expanded by 14%.';
    }

    setTimeout(() => {
      setChatHistory((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'claude',
          text: response,
        },
      ]);
    }, 1000);
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

  const handleIgnorePriority = (title: string) => {
    setPriorities((prev) => prev.filter((p) => p.title !== title));
  };

  if (appState === 'landing') {
    return (
      <LandingPage
        onStartFree={() => setAppState('onboarding')}
        onBookDemo={() => alert('Demo booked! Aura integration specialist will contact you.')}
      />
    );
  }

  if (appState === 'onboarding') {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  }

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

        <div className="sidebar-footer">
          <div className="user-avatar">{brandProfile.name.charAt(0)}</div>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 600 }}>{brandProfile.name}</h4>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{brandProfile.url}</p>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="dashboard-main">
        {/* Header/Top Bar */}
        <header className="dashboard-header">
          {/* Workspace Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              Aura Growth Group
            </span>
            <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} />
          </div>

          <div className="header-actions-group">
            {/* Search / Command Palette */}
            <div className="topbar-search-trigger">
              <Search size={13} />
              <span>Search / Command palette...</span>
              <span style={{ fontSize: '9px', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
                ⌘K
              </span>
            </div>

            {/* Notifications icon */}
            <button className="topbar-icon-button">
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
            <div className="user-avatar" style={{ width: '28px', height: '28px', fontSize: '11px', cursor: 'pointer' }}>
              A
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
                  Good Morning Aryan 👋
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  Your marketing agents are working background operations. Here is today's summary context.
                </p>
              </div>

              {/* Growth Summary metrics grid (6 cards!) */}
              <div>
                <h3 style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  TODAY'S GROWTH SUMMARY
                </h3>
                <div className="metrics-row">
                  <div className="metric-widget" onClick={() => setActiveTab('analytics')}>
                    <span className="metric-title">REVENUE</span>
                    <span className="metric-value">$42,390</span>
                    <span className="metric-trend up" style={{ fontSize: '10px' }}>+14.2%</span>
                  </div>

                  <div className="metric-widget" onClick={() => setActiveTab('campaign')}>
                    <span className="metric-title">ROAS</span>
                    <span className="metric-value">4.0x</span>
                    <span className="metric-trend up" style={{ fontSize: '10px' }}>+0.4x</span>
                  </div>

                  <div className="metric-widget" onClick={() => setActiveTab('seo')}>
                    <span className="metric-title">SEO VISIBILITY</span>
                    <span className="metric-value">82%</span>
                    <span className="metric-trend up" style={{ fontSize: '10px' }}>+3.1%</span>
                  </div>

                  <div className="metric-widget" onClick={() => setActiveTab('seo')}>
                    <span className="metric-title">AI VISIBILITY</span>
                    <span className="metric-value">71%</span>
                    <span className="metric-trend up" style={{ fontSize: '10px' }}>+12.8%</span>
                  </div>

                  <div className="metric-widget" onClick={() => setActiveTab('campaign')}>
                    <span className="metric-title">CAMPAIGN HEALTH</span>
                    <span className="metric-value">94%</span>
                    <span className="metric-trend up" style={{ color: 'var(--success)', fontSize: '10px' }}>Optimal</span>
                  </div>

                  <div className="metric-widget" onClick={() => setActiveTab('control')}>
                    <span className="metric-title">GROWTH SCORE</span>
                    <span className="metric-value">96/100</span>
                    <span className="metric-trend up" style={{ fontSize: '10px' }}>Peak</span>
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

              {/* Dynamic live log terminal feed at bottom */}
              <TerminalFeed logs={logs} height="280px" />
            </div>
          )}

          {activeTab === 'studio' && (
            <WorkspaceCreative
              brandUrl={brandProfile.url}
              assets={creativeAssets}
              onOpenReview={handleOpenReview}
            />
          )}

          {activeTab === 'campaign' && (
            <WorkspaceCampaign
              campaigns={campaigns}
              onOpenReview={handleOpenReview}
              onToggleStatus={handleToggleCampaign}
            />
          )}

          {activeTab === 'seo' && (
            <WorkspaceSEO
              blogs={seoBlogs}
              onOpenReview={handleOpenReview}
            />
          )}

          {activeTab === 'analytics' && (
            <WorkspaceAnalytics
              chatHistory={chatHistory}
              onSendMessage={handleSendClaudeMessage}
            />
          )}

          {activeTab === 'social' && (
            <WorkspaceSocial
              posts={socialPosts}
              onOpenReview={handleOpenReview}
              onComposePost={handleComposeSocial}
            />
          )}

          {activeTab === 'influencer' && (
            <WorkspaceInfluencer
              influencers={influencers}
              onCollaborate={handleCollaborateInfluencer}
            />
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
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
                    <input type="text" value={brandProfile.url} disabled style={{ opacity: 0.6 }} />
                  </div>
                  <div className="form-group">
                    <label>Brand Voice Tone Context</label>
                    <textarea rows={4} value={`Default generated guidelines matching: ${brandProfile.tone}. Competitors scraped.`} disabled style={{ opacity: 0.6 }} />
                  </div>
                  <GlowButton variant="secondary" style={{ width: '100%' }}>
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
                <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>Settings Center</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Manage company settings, active plans, billing tokens, and brand settings.
                </p>
              </div>
              <div className="glow-card" style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="form-group">
                  <label>Brand Name</label>
                  <input type="text" value={brandProfile.name} onChange={(e) => setBrandProfile((prev) => ({ ...prev, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Brand Hue Color</label>
                  <input type="text" value={brandProfile.colors} onChange={(e) => setBrandProfile((prev) => ({ ...prev, colors: e.target.value }))} />
                </div>
                <GlowButton variant="glow" onClick={() => alert('Settings saved successfully!')}>
                  Save Settings
                </GlowButton>
              </div>
            </div>
          )}
        </div>
      </main>

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

export default App;
