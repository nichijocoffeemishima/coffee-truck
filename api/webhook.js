const https = require('https');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'ok' });
  }
  const events     = req.body ? (req.body.events || []) : [];
  const LINE_TOKEN = process.env.LINE_CHANNEL_TOKEN;
  const GAS_URL    = process.env.GAS_URL;

  try {
    await Promise.all(events.map(async (event) => {

      // 友だち追加
      if (event.type === 'follow') {
        await replyMessage(event.replyToken, LINE_TOKEN,
          'ご登録ありがとうございます☕\n\n' +
          'Decaf specialty 日常です。\n\n' +
          '下のメニューから、\n' +
          '番号札呼び出しシステム\n' +
          'をお使いいただけます。\n\n' +
          'なお、クーポン等\nは現在準備中です。\n' +
          '開始しましたらお知らせいたします。'
        );
      }

      // メッセージ受信
      if (event.type === 'message' && event.message.type === 'text') {
        const text    = event.message.text.trim();
        const userId  = event.source.userId;
        const cleaned = text.replace(/^番号[：:：\s]*/,'').trim();
        const num     = parseInt(cleaned);

        // 「何組待ち」「待ち人数」などの問い合わせ
        if (text.match(/何組|待ち|まち|何人|なんにん/)) {
          const count = await getWaitCount(GAS_URL);
          await replyMessage(event.replyToken, LINE_TOKEN,
            count === 0
              ? '現在お待ちのお客様はいません☕\nすぐにご提供できます！'
              : '現在 ' + count + ' 組お待ちです。\nもうしばらくお待ちください☕'
          );
          return;
        }

        if (isNaN(num) || num < 1 || num > 999) return;

        const result = await linkUserToTicket(userId, num, GAS_URL);

        if (result === 'success') {
          // 登録成功時に待ち人数も取得して表示
          const count = await getWaitCount(GAS_URL);
          const waitMsg = count <= 1
            ? 'まもなくご提供できます！'
            : '現在 ' + count + ' 組お待ちです。';
          await replyMessage(event.replyToken, LINE_TOKEN,
            '番号札 #' + String(num).padStart(3, '0') + ' で登録しました！\n\n' +
            waitMsg + '\n\n' +
            'できあがりましたらこちらでお知らせします。\nしばらくお待ちください☕'
          );
        } else if (result === 'already_taken') {
          await replyMessage(event.replyToken, LINE_TOKEN,
            '番号 ' + num + ' はすでに別のお客様が登録済みです。\n\n' +
            '正しい番号札の番号を\nもう一度送ってください。'
          );
        } else {
          await replyMessage(event.replyToken, LINE_TOKEN,
            '番号 ' + num + ' の注文が見つかりませんでした。\n' +
            '正しい番号をもう一度送ってください。'
          );
        }
      }
    }));

    res.status(200).json({ status: 'ok' });

  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).json({ status: 'error', message: err.message });
  }
};

// 待ち人数をGASから取得
async function getWaitCount(GAS_URL) {
  try {
    const url = GAS_URL + '?action=getWaitCount&t=' + Date.now();
    const response = await fetch(url);
    const data = await response.json();
    return data.count || 0;
  } catch (e) {
    console.error('待ち人数取得エラー:', e);
    return 0;
  }
}

function replyMessage(replyToken, token, text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: 'text', text: text }],
    });
    const options = {
      hostname: 'api.line.me',
      path: '/v2/bot/message/reply',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'Content-Length': Buffer.byteLength(body, 'utf8'),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) console.error('LINE reply error:', data);
        resolve();
      });
    });
    req.on('error', reject);
    req.write(body, 'utf8');
    req.end();
  });
}

async function linkUserToTicket(userId, ticketNum, GAS_URL) {
  const url = GAS_URL
    + '?action=registerLiff'
    + '&ticketNum=' + ticketNum
    + '&userId=' + encodeURIComponent(userId)
    + '&t=' + Date.now();
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.success) return 'success';
    if (data.error === 'already_taken') return 'already_taken';
    return 'not_found';
  } catch (e) {
    console.error('GAS連携エラー:', e);
    return 'not_found';
  }
}
