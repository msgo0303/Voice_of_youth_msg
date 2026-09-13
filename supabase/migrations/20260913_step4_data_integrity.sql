-- Migration: Step 4 Data Integrity & Constraints

-- 1. Ensure admins.telegram_user_id UNIQUE constraint
ALTER TABLE public.admins DROP CONSTRAINT IF EXISTS admins_telegram_user_id_key;
ALTER TABLE public.admins ADD CONSTRAINT admins_telegram_user_id_key UNIQUE (telegram_user_id);

-- 2. Partial unique index on admin_requests to enforce maximum 1 PENDING request per telegram_user_id at DB level
DROP INDEX IF EXISTS idx_unique_pending_admin_request;
CREATE UNIQUE INDEX idx_unique_pending_admin_request ON public.admin_requests (telegram_user_id) WHERE (status = 'PENDING');
