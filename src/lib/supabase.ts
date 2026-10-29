import { createClient } from '@supabase/supabase-js';

const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
// Prefer the current Supabase publishable-key name, while retaining the legacy anon-key name for existing deployments.
const configuredSupabasePublicKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  '';
export const supabaseConfigured = Boolean(
  configuredSupabaseUrl &&
  configuredSupabasePublicKey &&
  !/YOUR_PROJECT_REF|YOUR_SUPABASE_PUBLISHABLE_ANON_KEY|PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE|PASTE_YOUR_SUPABASE_ANON_KEY_HERE|placeholder|replace_me/i.test(
    `${configuredSupabaseUrl} ${configuredSupabasePublicKey}`,
  ),
);

// Keep the UI renderable when environment variables are missing or still placeholders.
// Requests require the real public Supabase URL/key supplied locally or in Vercel.
const supabaseUrl = supabaseConfigured ? configuredSupabaseUrl : 'https://missing-project.supabase.co';
const supabasePublicKey = supabaseConfigured ? configuredSupabasePublicKey : 'missing-public-supabase-key';

export const supabase = createClient(supabaseUrl, supabasePublicKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Profile = {
  id: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  role: 'member' | 'author' | 'admin';
  created_at: string;
};

export type TopupCategory = {
  id: string;
  slug: string;
  label: string;
  icon: string;
  accent: string;
  sort_order: number;
  created_at: string;
};

export type Brand = {
  id: string;
  slug: string;
  name: string;
  category_id: string;
  image_url: string;
  requires_server: boolean;
  server_label: string;
  sort_order: number;
  created_at: string;
};

export type Package = {
  id: string;
  brand_id: string;
  name: string;
  description: string;
  price: number;
  sort_order: number;
  featured: boolean;
  provider_code?: string;
  created_at: string;
};

export type Order = {
  id: string;
  code: string;
  user_id: string;
  category_id: string;
  brand_id: string;
  package_id: string;
  target: string;
  server: string;
  price: number;
  status: 'pending' | 'processing' | 'success' | 'failed';
  created_at: string;
  payment_method: string;
  total_amount: number;
  unique_code: number;
  payment_proof_path?: string | null;
  payment_submitted_at?: string | null;
  category?: TopupCategory | null;
  brand?: Brand | null;
  package?: Package | null;
};

export type PromoBanner = {
  id: string;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_link: string;
  image_url: string;
  accent: string;
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type Testimonial = {
  id: string;
  name: string;
  role: string;
  avatar_url: string;
  rating: number;
  message: string;
  sort_order: number;
  created_at: string;
};

export type Faq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
  created_at: string;
};

export type OrderLookup = {
  o_code: string;
  o_status: 'pending' | 'processing' | 'success' | 'failed' | string;
  o_total_amount: number;
  o_payment_method: string;
  o_brand_name: string;
  o_package_name: string;
  o_target: string;
  o_created_at: string;
};

