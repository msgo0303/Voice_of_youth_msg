-- Migration: Upgrade schema to v1.0 specification
-- Date: 2026-09-13

-- 1. Upgrade forms table
ALTER TABLE public.forms
    ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completion_message TEXT,
    ADD COLUMN IF NOT EXISTS response_chat_id BIGINT,
    ADD COLUMN IF NOT EXISTS response_topic_id INT;

-- Update forms status check constraint
ALTER TABLE public.forms DROP CONSTRAINT IF EXISTS forms_status_check;
ALTER TABLE public.forms ADD CONSTRAINT forms_status_check
    CHECK (status IN ('DRAFT', 'ACTIVE', 'PUBLISHED', 'CLOSED', 'ARCHIVED'));

-- 2. Upgrade questions table
ALTER TABLE public.questions
    ADD COLUMN IF NOT EXISTS description TEXT;

-- Update questions question_type check constraint
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_question_type_check;
ALTER TABLE public.questions ADD CONSTRAINT questions_question_type_check
    CHECK (question_type IN ('TEXT', 'SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'RATING', 'NUMERIC', 'CHECKBOX'));

-- 3. Upgrade responses table
ALTER TABLE public.responses
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS previous_telegram_message_id BIGINT;

-- 4. Upgrade response_answers table (Critical: add question_snapshot)
ALTER TABLE public.response_answers
    ADD COLUMN IF NOT EXISTS question_snapshot JSONB;

-- Comment for documentation
COMMENT ON COLUMN public.response_answers.question_snapshot IS 'Snapshot of question text, type, and options at the time of submission';
