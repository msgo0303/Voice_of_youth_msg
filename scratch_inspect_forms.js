const { createClient } = require('@supabase/supabase-js');

const url = 'https://dgakgpwkuaoktejdenzu.supabase.co';
// anon key
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnYWtncHdrdWFva3RlamRlbnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNzgxOTUsImV4cCI6MjEwNDg1NDE5NX0.uTgegmYnEmIw5jMdBD9WjU0EQu_SoEMASc8S9SxGl5Y';

const supabase = createClient(url, key);

async function inspectForms() {
  const { data, error } = await supabase.from('forms').select('*');
  console.log('Forms count:', data ? data.length : 0);
  if (data) {
    data.forEach(f => {
      console.log(`Form ID: ${f.id} | Title: ${f.title} | Status: ${f.status} | ChatID: ${f.response_chat_id} | TopicID: ${f.response_topic_id}`);
    });
  }
  if (error) console.error('Forms error:', error);
}

inspectForms();
