require("dotenv").config({ path: __dirname + "/.env" });
const TelegramBot = require("node-telegram-bot-api");

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error("❌ BOT_TOKEN не найден в .env");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

bot.on("polling_error", (err) => {
  if (err?.message?.includes("ERR_UNESCAPED_CHARACTERS")) {
    console.warn("⚠️ polling_error: путь запроса содержит неэкранированные символы");
  } else {
    console.error("❌ polling_error:", err.message || err);
  }
});


bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, "Добро пожаловать в Авто Финанс! 🚗 Переходите в наше приложение — в нем каталог автомобилей, условия проката, аренды и выкупа, а также контактная информация. Всё просто и быстро!", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "💬 WhatsApp",
            url: encodeURI("https://wa.me/79300357432") // ✅ экранируем URL на всякий случай
          }
        ],
        [
          {
            text: "📞 Позвонить",
            callback_data: "call" // ✅ оставляем как есть (только латиница и цифры)
          }
        ]
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

  bot.answerCallbackQuery(query.id); // ✅ подтверждаем клик
});

console.log("🤖 Бот запущен и слушает команды...");
