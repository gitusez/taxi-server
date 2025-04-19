require("dotenv").config({ path: __dirname + "/.env" }); // ← добавили
const TelegramBot = require("node-telegram-bot-api");

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error("❌ BOT_TOKEN не найден в .env");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, "Добро пожаловать! Выберите действие:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💬 WhatsApp", url: "https://wa.me/79991234567" }],
        [{ text: "📞 Позвонить", callback_data: "call" }],
      ]
    }
  });
});

bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === "call") {
    bot.sendMessage(chatId, "📞 Позвоните по номеру: +7 800 555 34 32");
  }

  bot.answerCallbackQuery(query.id); // Обязательно подтверждаем клик
});

console.log("🤖 Бот запущен и слушает команды...");
