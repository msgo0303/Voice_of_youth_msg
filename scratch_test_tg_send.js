const https = require('https');

const botToken = '8639864400:AAGiBD8Uz9iTmvVmnDd1rKysVXNn1yznHsQ';

async function testSend(chatId, topicId, label) {
  const payload = {
    chat_id: chatId,
    text: `🧪 [테스트 메시지 - ${label}]\n일시: ${new Date().toLocaleString('ko-KR')}`
  };
  if (topicId) {
    payload.message_thread_id = topicId;
  }

  const data = JSON.stringify(payload);

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(`Response for ${label} (chat: ${chatId}, topic: ${topicId}):`, body);
        resolve(body);
      });
    });

    req.on('error', (err) => {
      console.error(`Error for ${label}:`, err);
      resolve(null);
    });
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('Testing Telegram Bot API...');
  await testSend(-1003721720880, 2, 'Group -1003721720880 Topic 2');
  await testSend('-1003721720880', 2, 'String Group -1003721720880 Topic 2');
  await testSend(-1003721720880, null, 'Group -1003721720880 General');
  await testSend(1284576145, null, 'User 1284576145');
}

runTests();
