export interface User {
  id: string;
  email: string;
  github_id: string | null;
  github_username: string | null;
  github_access_token: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
  last_login: Date | null;
  is_active: boolean;
  email_verified: boolean;
  role: string;
  stripe_customer_id: string | null;
  onboarding_completed: boolean;
}

export interface Profile {
  id: string;
  user_id: string;
  slug: string;
  bio: string | null;
  tagline: string | null;
  ai_generated_bio: string | null;
  bio_edited: boolean;
  profile_image_url: string | null;
  cover_image_url: string | null;
  social_links: SocialLinks | null;
  donation_message: string;
  minimum_donation: number;
  suggested_amounts: number[];
  theme_settings: ThemeSettings | null;
  is_public: boolean;
  view_count: number;
  github_sync_enabled: boolean;
  last_github_sync: Date | null;
  total_supporters: number;
  total_received_usd: number;
  created_at: Date;
  updated_at: Date;
}

export interface SocialLinks {
  twitter?: string;
  linkedin?: string;
  website?: string;
  youtube?: string;
}

export interface ThemeSettings {
  primaryColor?: string;
  layout?: 'default' | 'compact' | 'minimal';
}

export interface Balance {
  id: string;
  user_id: string;
  available_balance: number;
  pending_balance: number;
  lifetime_received: number;
  lifetime_spent: number;
  currency: string;
  updated_at: Date;
}

export interface GitHubRepo {
  id: string;
  user_id: string;
  repo_id: number;
  name: string;
  full_name: string;
  description: string | null;
  url: string;
  stars: number;
  forks: number;
  language: string | null;
  topics: string[];
  is_featured: boolean;
  created_at: Date;
  updated_at: Date;
  synced_at: Date;
}

export interface GitHubContribution {
  id: string;
  user_id: string;
  year: number;
  total_contributions: number;
  contribution_data: ContributionData;
  synced_at: Date;
}

export interface ContributionData {
  weeks: Array<{
    contributionDays: Array<{
      contributionCount: number;
      date: string;
    }>;
  }>;
}

export interface SessionData {
  userId: string;
  email: string;
  username: string | null;
  isLoggedIn: boolean;
}
