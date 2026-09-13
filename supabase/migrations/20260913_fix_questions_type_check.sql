-- Fix questions.type check constraint to include all 7 question types
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_type_check;
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_question_type_check;

ALTER TABLE public.questions ADD CONSTRAINT questions_type_check
    CHECK (type IN ('SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'DROPDOWN', 'LINEAR_SCALE', 'SATISFACTION', 'TEXT', 'CHECKBOX', 'RATING'));
