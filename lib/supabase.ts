import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 클라이언트 사이드용 (공개 키)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 서버 전용 관리자 클라이언트 (Service Role Key - RLS 우회용)
export const getServiceSupabase = () => {
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables.');
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey);
};
