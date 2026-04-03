const https = require('https');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'ok' });
  }

  const events = req.body ? (req.body.events || []) : [];
  const LINE_TOKEN = process.env.LINE_CHANNEL_TOKEN;
  const GAS_URL    = process.env.GAS_URL;

  try {
    await Promise.all(events.map(async (event) => {

      if (event.type === 'follow') {
        await replyMessage(event.replyToken, LINE_TOKEN,
          'ご来店ありがとうございます！\n\nお手元の番号札の番号を\n数字だけ送信してください。\n（例: 3）'
        );
      }

      if (event.type === 'message' && event.message.type === 'text') {
        const num    = parseInt(event.message.text.trim());
        const userId = event.source.userId;

        if (isNaN(num) || num < 1 || num > 999) return;

        const ok = await linkUserToTicket(userId, num, GAS_URL);

        if (ok) {
          await replyMessage(event.replyToken, LINE_TOKEN,
            '番号札 #' + String(num).padStart(3, '0') + ' で登録しました！\n\nできあがりましたらお知らせします。\nしばらくお待ちください。'
          );
        } else {
          await replyMessage(event.replyToken, LINE_TOKEN,
            '番号 ' + num + ' の注文が見つかりませんでした。\n正しい番号をもう一度送ってください。'
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

function replyMessage(replyToken, token, text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: 'text', text: text }],
    });

    const options = {
