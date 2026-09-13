const { createClient } = require('@supabase/supabase-js');

const url = 'https://dgakgpwkuaoktejdenzu.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnYWtncHdrdWFva3RlamRlbnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNzgxOTUsImV4cCI6MjEwNDg1NDE5NX0.uTgegmYnEmIw5jMdBD9WjU0EQu_SoEMASc8S9SxGl5Y';

const supabase = createClient(url, anonKey);

async function checkTelegramConfig() {
  console.log('--- Checking Forms ---');
  const { data: forms, error: fErr } = await supabase.from('forms').select('id, title, response_chat_id, response_topic_id, status');
  console.log('Forms:', forms, fErr);

  console.log('--- Checking Forum Topics ---');
  const { data: topics, error: tErr } = await supabase.from('forum_topics').select('*');
  console.log('Forum topics:', topics, tErr);
}

checkTelegramConfig();
