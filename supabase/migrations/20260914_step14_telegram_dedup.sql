-- Step 14: Telegram Update Deduplication Table
CREATE TABLE IF NOT EXISTS public.telegram_updates (
    update_id BIGINT PRIMARY KEY,
    received_at TIMESTAMPTZ DEFAULT NOW()
);
