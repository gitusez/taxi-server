// server.js
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const morgan = require("morgan");
const compression = require("compression");
const crypto = require("crypto");
const path = require("path");
const nodemailer = require("nodemailer");


const app = express();

// 🔁 Кэш в памяти на 10 секунд
let carCache = {
  data: null,
  timestamp: 0,
  duration: 10 * 1000 // 10 секунд
};

// 🔧 Middleware
app.use(morgan("dev"));
app.use(compression());
app.use(cors({
  origin: "*",
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Проверка Content-Type
app.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/api/cars/combined") {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("application/json")) {
      return res.status(415).json({ success: false, error: "Content-Type must be application/json" });
    }
  }
  next();
});

// Обработка JSON с проверкой
app.use(express.json({
  strict: true,
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch {
      throw new Error("Invalid JSON");
    }
  }
}));

// Обработка ошибок JSON
app.use((err, req, res, next) => {
  if (err.message === "Invalid JSON") {
    return res.status(400).json({ success: false, error: "Невалидный JSON" });
  }
  next(err);
});

// Хелпер: SHA1-сигнатура
function generateSignature(jsonBody, apiKey) {
  return crypto.createHash("sha1").update(jsonBody + apiKey).digest("hex");
}

// Запрос к CRM
async function fetchCars(url, apiKey, filterOwnerId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const requestData = {
    timestamp,
    filters: { filter_owner_id: filterOwnerId },
    items: 100,
    offset: 0
  };

  const jsonRequest = JSON.stringify(requestData);
  const signature = generateSignature(jsonRequest, apiKey);

  const response = await axios.post(url, requestData, {
    headers: {
      "Authorization": signature,
      "Content-Type": "application/json"
    }
  });

  return response.data;
}

// 🚘 Основной эндпоинт

app.post("/api/cars/combined", async (req, res) => {
  try {
    const { items = 30, offset = 0 } = req.body;

    const now = Date.now();
    // if (carCache.data && now - carCache.timestamp < carCache.duration) {
    //   const paginatedCars = carCache.data.slice(offset, offset + items);
    //   return res.json({ success: true, cars_list: paginatedCars });
    // }
    if (carCache.data && now - carCache.timestamp < carCache.duration) {
      const paginatedCars = carCache.data.slice(offset, offset + items);
      console.log(`📦 Отдаём ${paginatedCars.length} авто из кэша (offset: ${offset}, items: ${items})`);
      return res.json({ success: true, cars_list: paginatedCars });
    }
    

    const accounts = [
      {
        url: "https://premiergroup.taxicrm.ru/api/public/v1/cars/list",
        apiKey: "ff841cef5fb5602e51ae7432230078906c9577af",
        ownerIds: ["cc9af95f-1f44-557a-89ab-d2c6e36d7e9d"]
      },
      {
        url: "https://premierm.taxicrm.ru/api/public/v1/cars/list",
        apiKey: "c7611ef537404fad4ac7043a2b3d148caf71328d",
        ownerIds: ["5ca94f01-64a1-5e14-9d22-4a69d0851e77"]
      },
      {
        url: "https://premierplus.taxicrm.ru/api/public/v1/cars/list",
        apiKey: "f6bb44ed1116ca11dd5eeae3772f41c6ef6f90e7",
        ownerIds: ["08bd7d68-9c8f-5d7c-b73c-5fca59168f7b", "164b685f-ca1b-5ac6-9f59-3ee0fa42e98a"]
      }
    ];

// 📩 Отправка заявки на Яндекс.Почту
app.post("/api/send-request", async (req, res) => {
  const { name, phone, request } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ success: false, message: "Имя и телефон обязательны" });
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.yandex.ru",
    port: 465,
    secure: true,
    auth: {
      user: "Premier-Group-order@yandex.ru",
      pass: "9ad-8Ce-9Fv-ECc"
    }
  });

  const mailOptions = {
    from: "Premier-Group-order@yandex.ru",
    to: "Premier-Group-order@yandex.ru", // или другую почту
    subject: "Заявка с сайта",
    html: `
      <h2>Новая заявка</h2>
      <p><strong>Имя:</strong> ${name}</p>
      <p><strong>Телефон:</strong> ${phone}</p>
      <p><strong>Желаемая машина:</strong> ${request || 'не указано'}</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (error) {
    console.error("Ошибка отправки:", error);
    res.status(500).json({ success: false, message: "Ошибка отправки письма" });
  }
});

    const promises = accounts.flatMap(account =>
      account.ownerIds.map(async ownerId => {
        try {
          const data = await fetchCars(account.url, account.apiKey, ownerId);
          if (data.success && data.cars_list) {
            const list = Array.isArray(data.cars_list)
              ? data.cars_list
              : Object.values(data.cars_list);
    
            const filtered = list.filter(car => car.status === 20);
    
            console.log(`✅ Найдено ${filtered.length} авто у владельца ${ownerId}:`);
            filtered.forEach(car => {
              console.log(`→ ${car.brand || ''} ${car.model || ''} | ${car.number || '—'} | Статус: ${car.status}`);
            });
    
            return filtered;
          } else {
            console.warn(`⚠️ Пустой или неуспешный ответ от ${account.url}`);
          }
        } catch (err) {
          console.error(`❌ Ошибка при запросе к ${account.url} для владельца ${ownerId}:`, err.message);
        }
    
        return []; // Возвращаем пустой список, чтобы Promise.all не ломался
      })
    );
    
    const results = await Promise.all(promises);
    const allCars = results.flat();
    

    // Фильтрация дубликатов по ID
    const uniqueCars = Array.from(new Set(allCars.map(car => car.id)))
      .map(id => {
        return allCars.find(car => car.id === id);
      });

    console.log(`\n🚗 Всего уникальных авто: ${uniqueCars.length}`);
    uniqueCars.forEach((car, i) => {
      console.log(`#${i + 1}: ${car.brand || ''} ${car.model || ''} (${car.number || '—'})`);
    });

    // Сжимаем данные
    // const reducedCars = uniqueCars.map(car => ({
    //   id: car.id,
    //   brand: car.brand,
    //   model: car.model,
    //   year: car.year,
    //   avatar: car.avatar,
    //   color: car.color,
    //   number: car.number,
    //   odometer: car.odometer_manual? `${car.odometer_manual.toLocaleString("ru-RU")} км`: (car.odometer ? `${car.odometer.toLocaleString("ru-RU")} км` : "—"), // ✅ пробег
    //   fuel_type: car.fuel_type,
    //   transmission: car.transmission,    // ✅ тип КПП
    //   equipment: car.equipment,          // ✅ комплектация
    // }));

    const reducedCars = uniqueCars.map(car => {
      const odoRaw = car.odometer_manual ?? car.odometer; // 👈 выбираем первое валидное
      const odo = typeof odoRaw === 'number' ? odoRaw : 0;
    
      return {
        id: car.id,
        brand: car.brand,
        model: car.model,
        year: car.year,
        avatar: car.avatar,
        color: car.color,
        number: car.number,
        odometer: odo, // числовое значение для сортировки
        odometer_display: odo ? `${odo.toLocaleString("ru-RU")} км` : "—", // строка для вывода
        fuel_type: car.fuel_type,
        transmission: car.transmission,
        equipment: car.equipment
      };
    });
    

    // Обновляем кэш
    carCache.data = reducedCars;
    carCache.timestamp = Date.now();

    const paginatedCars = reducedCars.slice(offset, offset + items);
    res.json({ success: true, cars_list: paginatedCars });
  } catch (error) {
    console.error("❌ Ошибка объединения:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🔗 Обслуживание фронта
const frontendPath = "/var/www/autofinanceapp.ru/public";
app.use(express.static(frontendPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// Подключение Telegram-бота
require("./bot/bot.js");

// ▶️ Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
