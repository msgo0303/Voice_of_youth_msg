-- Migration: Upgrade admin_requests table to include requested_role
ALTER TABLE public.admin_requests
    ADD COLUMN IF NOT EXISTS requested_role TEXT DEFAULT 'ADMIN',
    ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES public.admins(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
