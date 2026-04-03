const line = require('@line/bot-sdk');
const { GoogleSpreadsheet } = require('google-spreadsheet');

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(lineConfig);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'ok' });
  }

  const events = req.body.events || [];

  await Promise.all(events.map(async (event) => {
    if (event.type === 'follow') {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'ご来店ありがとうございます！☕\n\nお手元の番号札の番号を\n数字だけ送信してください。\n（例: 3）',
      });
    }

    if (event.type === 'message' && event.message.type === 'text') {
      const num = parseInt(event.message.text.trim());
      const userId = event.source.userId;

      if (isNaN(num) || num < 1 || num > 999) return;

      const ok = await linkUserToTicket(userId, num);

      if (ok) {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '番号札 #' + String(num).padStart(3, '0') + ' で登録しました！☕\n\nできあがりましたらこちらでお知らせします。\nしばらくお待ちください。',
        });
      } else {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '番号 ' + num + ' の注文が見つかりませんでした。\n正しい番号をもう一度送ってください。',
        });
      }
    }
  }));

  res.status(200).json({ status: 'ok' });
};

async function linkUserToTicket(userId, ticketNum) {
  const GAS_URL = process.env.GAS_URL;
  const url = GAS_URL
    + '?action=registerLiff'
    + '&ticketNum=' + ticketNum
    + '&userId=' + encodeURIComponent(userId)
    + '&t=' + Date.now();

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.success === true;
  } catch (e) {
    console.error('GAS連携エラー:', e);
    return false;
  }
}
