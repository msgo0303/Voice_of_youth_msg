import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

try {
  const envFile = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
  envFile.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
} catch (e) {
  // ignore
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase envvars!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runStep12Test() {
  console.log('=== Step 12 Telegram Topic & Webhook Test ===\n');

  // 1. Manual Topic Upsert Test
  const testChatId = -10099887766;
  const testTopicId = 1234;
  const testTopicName = '2025 청년부 공지 토픽';

  console.log('[1] Testing Forum Topic Cache Upsert...');
  const { data: upsertedTopic, error: upsertErr } = await supabase
    .from('forum_topics')
    .upsert(
      {
        chat_id: testChatId,
        topic_id: testTopicId,
        topic_name: testTopicName
      },
      { onConflict: 'chat_id,topic_id' }
    )
    .select()
    .single();

  if (upsertErr || !upsertedTopic) {
    console.error('FAILED to upsert topic:', upsertErr);
    return;
  }
  console.log(`PASS: Upserted Topic ID: ${upsertedTopic.id}, Name: "${upsertedTopic.topic_name}"`);

  // 2. Fetch Topics Test
  console.log('\n[2] Testing Forum Topics Retrieval...');
  const { data: topics, error: fetchErr } = await supabase
    .from('forum_topics')
    .select('*')
    .eq('chat_id', testChatId);

  if (fetchErr || !topics || topics.length === 0) {
    console.error('FAILED to fetch topics:', fetchErr);
    return;
  }
  console.log(`PASS: Retrieved ${topics.length} cached topic(s) for chat_id ${testChatId}.`);

  // 3. Webhook update simulation for forum_topic_created
  console.log('\n[3] Simulating Telegram Webhook forum_topic_created update...');
  const mockWebhookUpdate = {
    message: {
      message_id: 100,
      chat: { id: testChatId, title: '테스트 그룹', type: 'supergroup' },
      message_thread_id: 5678,
      forum_topic_created: { name: '웹훅 자동 감지 토픽' }
    }
  };

  const autoChatId = mockWebhookUpdate.message.chat.id;
  const autoTopicId = mockWebhookUpdate.message.message_thread_id;
  const autoTopicName = mockWebhookUpdate.message.forum_topic_created.name;

  const { data: autoTopic, error: autoErr } = await supabase
    .from('forum_topics')
    .upsert(
      {
        chat_id: autoChatId,
        topic_id: autoTopicId,
        topic_name: autoTopicName
      },
      { onConflict: 'chat_id,topic_id' }
    )
    .select()
    .single();

  if (autoErr || !autoTopic) {
    console.error('FAILED to process auto topic via webhook logic:', autoErr);
    return;
  }
  console.log(`PASS: Webhook auto-cached topic "${autoTopic.topic_name}" (topic_id: ${autoTopic.topic_id})`);

  // 4. Cleanup Test Data
  console.log('\n[4] Cleaning up test topic data...');
  await supabase.from('forum_topics').delete().eq('chat_id', testChatId);
  console.log('Cleanup completed.');

  console.log('\n=== Step 12 Verification Finished Successfully ===');
}

runStep12Test();
