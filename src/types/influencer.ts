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
  /* Social proof is optional because for most of the roster it does not exist yet.
     Every one of the 42 parsed creators carried the SAME stamped values - rating 4.85,
     "25 reviews", a single past client "D2C Brand Collab" - and none carried a review at
     all, so the profile modal generated one at render time. Brands book and pay creators
     on this screen, so an absent rating has to read as absent rather than as 4.85. */
  rating?: number | null;
  reviewsCount?: number | null;
  recentWorks?: string[];
  topComments?: { author: string; text: string }[];
  recentPosts?: { id: string; url: string; likes: string; comments: string }[];
}
