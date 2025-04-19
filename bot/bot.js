require("dotenv").config({ path: __dirname + "/.env" }); // подключаем локальный .env
const TelegramBot = require("node-telegram-bot-api");

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Добро пожаловать! Выберите действие:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📲 WhatsApp", url: "https://wa.me/79991234567" }],
        [{ text: "📞 Позвонить", url: "tel:+79991234567" }],
        [{ text: "🆘 SOS", callback_data: "sos" }]
      ]
    }
  });
});

bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  if (query.data === "sos") {
    bot.sendMessage(chatId, "🆘 SOS: оператор уведомлён и скоро свяжется!");
  }
});
