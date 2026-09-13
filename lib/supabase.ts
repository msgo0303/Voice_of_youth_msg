import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://dgakgpwkuaoktejdenzu.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnYWtncHdrdWFva3RlamRlbnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNzgxOTUsImV4cCI6MjEwNDg1NDE5NX0.uTgegmYnEmIw5jMdBD9WjU0EQu_SoEMASc8S9SxGl5Y';

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY !== '여기에_SERVICE_ROLE_KEY_입력'
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : supabaseAnonKey; // Fallback to anonKey if service_role key is not configured yet

// 클라이언트 사이드용 (공개 키)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 서버 전용 관리자 클라이언트 (Service Role Key - RLS 우회용)
export const getServiceSupabase = () => {
  return createClient(supabaseUrl, supabaseServiceRoleKey);
};
