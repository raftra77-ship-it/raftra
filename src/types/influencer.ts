export interface InfluencerItemExtended {
  id: string;
  name: string;
  handle: string;
  avatar?: string;
  platform: 'Facebook' | 'Instagram' | 'YouTube';
  niche: string;
  allNiches?: string[];
  category: 'Nano' | 'Micro' | 'Macro';
  expectedPrice: string;
  deliverables: string[];
  followers: string;
  avgViews?: string;
  location?: string;
  email?: string;
  phone?: string;
  profileLink?: string;
  fakeFollowerScore: number;
  rating: number;
  reviewsCount: number;
  recentWorks: string[];
  topComments: { author: string; text: string }[];
  recentPosts?: { id: string; url: string; likes: string; comments: string }[];
}
