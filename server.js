// server.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const basicAuth = require('express-basic-auth');
const express = require("express");
const app = express();
const cors = require("cors");
const axios = require("axios");
const morgan = require("morgan");
const compression = require("compression");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const fs = require("fs");
const multer = require('multer');


// const upload = multer({
//   storage: multer.diskStorage({
//     destination: function (req, file, cb) {
//       const number = (req.body.number || '').toUpperCase().replace(/\s/g, '');
//       const dir = path.join('/var/www/autofinanceapp.ru/photos', number);
//       fs.mkdirSync(dir, { recursive: true });
//       cb(null, dir);
//     },
// filename: function (req, file, cb) {
//   const number = (req.body.number || '').toUpperCase().replace(/\s/g, '');
//   const ext = path.extname(file.originalname).toLowerCase();
//   const dir = path.join('/var/www/autofinanceapp.ru/photos', number);

//   // Читаем текущие файлы и определяем следующий индекс
//   fs.readdir(dir, (err, files) => {
//     const count = Array.isArray(files)
//       ? files.filter(f => f.startsWith(number)).length + 1
//       : 1;
//     const filename = `${number}_${count}${ext}`;
//     cb(null, filename);
//   });
// }

//   }),
//   fileFilter: function (req, file, cb) {
//     const allowed = ['.jpeg', '.jpg', '.png'];
//     const ext = path.extname(file.originalname).toLowerCase();
//     cb(null, allowed.includes(ext));
//   }
// });

// app.post('/api/photos/upload', upload.array('photos', 10), (req, res) => {
//   res.json({ success: true });
// });

const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const number = (req.body.number || '')
        .toUpperCase()
        .replace(/\s/g, '')
        .replace(/А/g, 'A')
        .replace(/В/g, 'B')
        .replace(/Е/g, 'E')
        .replace(/К/g, 'K')
        .replace(/М/g, 'M')
        .replace(/Н/g, 'H')
        .replace(/О/g, 'O')
        .replace(/Р/g, 'P')
        .replace(/С/g, 'C')
        .replace(/Т/g, 'T')
        .replace(/У/g, 'Y')
        .replace(/Х/g, 'X');

      const dir = path.join('/var/www/autofinanceapp.ru/photos', number);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },

    filename: function (req, file, cb) {
      const number = (req.body.number || '')
        .toUpperCase()
        .replace(/\s/g, '')
        .replace(/А/g, 'A')
        .replace(/В/g, 'B')
        .replace(/Е/g, 'E')
        .replace(/К/g, 'K')
        .replace(/М/g, 'M')
        .replace(/Н/g, 'H')
        .replace(/О/g, 'O')
        .replace(/Р/g, 'P')
        .replace(/С/g, 'C')
        .replace(/Т/g, 'T')
        .replace(/У/g, 'Y')
        .replace(/Х/g, 'X');

      const ext = path.extname(file.originalname).toLowerCase();
      const dir = path.join('/var/www/autofinanceapp.ru/photos', number);

      fs.readdir(dir, (err, files) => {
        const count = Array.isArray(files)
          ? files.filter(f => f.startsWith(number)).length + 1
          : 1;
        const filename = `${number}_${count}${ext}`;
        cb(null, filename);
      });
    }
  }),

  fileFilter: function (req, file, cb) {
    const allowed = ['.jpeg', '.jpg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});


// 📤 Загрузка фото
app.post('/api/photos/upload', upload.array('photos', 10), (req, res) => {
  res.json({ success: true });
});


const transporter = nodemailer.createTransport({
  host: "smtp.yandex.ru",
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// Бросит в консоль: либо OK, либо конкретную ошибку аутентификации
transporter.verify()
  .then(() => console.log("SMTP: авторизация прошла успешно"))
  .catch(err => console.error("SMTP: ошибка авторизации:", err));

const manualPricesPath = '/var/www/taxi-data/manual-prices.json';
let manualPrices = {};

function loadManualPrices() {
  try {
    const data = fs.readFileSync(manualPricesPath, 'utf-8');
    manualPrices = JSON.parse(data);
    console.log("[✔] Загружены ручные цены");
  } catch (err) {
    console.warn("[!] Не удалось загрузить ручные цены:", err.message);
    manualPrices = {};
  }
}

loadManualPrices();

// Автообновление при изменении файла
fs.watchFile(manualPricesPath, { interval: 1000 }, () => {
  console.log("[↻] Обнаружено изменение manual-prices.json, перезагрузка...");
  loadManualPrices();
  carCache.data = null; // 🔥 Сброс кэша
  console.log("[ℹ] Кэш сброшен после обновления цен");
});


// const app = express();

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
  // origin: "https://autofinanceapp.ru/",
    origin: [
    "https://autofinanceapp.ru",     // ваш продакшн-домен
    "http://127.0.0.1:5500",          // Live Server по IP
    "http://localhost:5500",          // Live Server по localhost
    "http://localhost:3000"         
  ],
  methods: ["GET","POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Защита Админ Панели

// const ADMIN_USER = process.env.ADMIN_USER;
// const ADMIN_PASS = process.env.ADMIN_PASS;
// app.use(
//   ['/admin-prices.html', '/api/manual-prices'],
//   basicAuth({
//     users: { [ADMIN_USER]: ADMIN_PASS },
//     challenge: true,
//     realm: 'Admin Area'
//   })
// );

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

if (!ADMIN_USER || !ADMIN_PASS) {
  console.error('❌ ПЕРЕМЕННЫЕ ADMIN_USER и ADMIN_PASS не заданы в .env — защита админки отключена');
} else {
  app.use(
    ['/admin-prices.html', '/api/manual-prices'],
    basicAuth({
      users: { [ADMIN_USER]: ADMIN_PASS },
      challenge: true,
      realm: 'Admin Area'
    })
  );
}



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


// Добавляем маршрут для “logout” — сброса Basic Auth
app.get('/logout', (req, res) => {
  // Возвращаем 401 и заголовок, чтобы браузер сбросил учётки
  res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
  res.status(401).send('Logged out');
});

// 📩 Отправка заявки на Яндекс.Почту
// app.post("/api/send-request", async (req, res) => {
//   const { name, phone, request } = req.body;

//   if (!name || !phone) {
//     return res.status(400).json({ success: false, message: "Имя и телефон обязательны" });
//   }

//   const transporter = nodemailer.createTransport({
//     host: "smtp.yandex.ru",
//     port: 465,
//     secure: true,
//     auth: {
//       user: process.env.MAIL_USER,
//       pass: process.env.MAIL_PASS
//     }
//   });

//   const mailOptions = {
//     from: "Premier-Group-order@yandex.ru",
//     to: "Premier-Group-order@yandex.ru", // или другую почту
//     subject: "Заявка с сайта",
//     html: `
//       <h2>Новая заявка</h2>
//       <p><strong>Имя:</strong> ${name}</p>
//       <p><strong>Телефон:</strong> ${phone}</p>
//       <p><strong>Желаемая машина:</strong> ${request || 'не указано'}</p>
//     `
//   };

//   try {
//     await transporter.sendMail(mailOptions);
//     res.json({ success: true });
//   } catch (error) {
//     console.error("Ошибка отправки:", error);
//     res.status(500).json({ success: false, message: "Ошибка отправки письма" });
//   }
// });

// 🚘 Основной эндпоинт


app.post("/api/send-request", async (req, res) => {
  const { name, phone, request } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ success: false, message: "Имя и телефон обязательны" });
  }

  try {
    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to:   process.env.MAIL_USER,
      subject: "Заявка с сайта",
      html: `
        <h2>Новая заявка</h2>
        <p><strong>Имя:</strong> ${name}</p>
        <p><strong>Телефон:</strong> ${phone}</p>
        <p><strong>Желаемая машина:</strong> ${request || 'не указано'}</p>
      `
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Ошибка отправки письма:", error);
    res.status(500).json({ success: false, message: error.message || "Ошибка отправки письма" });
  }
});



app.post("/api/cars/combined", async (req, res) => {
  try {
    const { items = 30, offset = 0 } = req.body;

    const now = Date.now();
    if (carCache.data && now - carCache.timestamp < carCache.duration) {
      const paginatedCars = carCache.data.slice(offset, offset + items);
      console.log(`📦 Отдаём ${paginatedCars.length} авто из кэша (offset: ${offset}, items: ${items})`);
      return res.json({
        success: true,
        cars_list: paginatedCars,
        total: carCache.data.length
      });
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

    // const reducedCars = uniqueCars.map(car => {
    //   const odoRaw = car.odometer_manual ?? car.odometer; // 👈 выбираем первое валидное
    //   const odo = typeof odoRaw === 'number' ? odoRaw : 0;
    
    //   return {
    //     id: car.id,
    //     brand: car.brand,
    //     model: car.model,
    //     year: car.year,
    //     avatar: car.avatar,
    //     color: car.color,
    //     number: car.number,
    //     odometer: odo, // числовое значение для сортировки
    //     odometer_display: odo ? `${odo.toLocaleString("ru-RU")} км` : "—", // строка для вывода
    //     fuel_type: car.fuel_type,
    //     transmission: car.transmission,
    //     equipment: car.equipment
    //   };
    // });

    const reducedCars = uniqueCars.map(car => {
      const odoRaw = car.odometer_manual ?? car.odometer;
      const odo = typeof odoRaw === 'number' ? odoRaw : 0;
    
      // Ручные цены
      const number = (car.number || "").replace(/\s/g, "").toUpperCase();
      const manual = manualPrices[number] || {};
    
      return {
        id: car.id,
        brand: car.brand,
        model: car.model,
        year: car.year,
        avatar: car.avatar,
        color: car.color,
        number: car.number,
        odometer: odo,
        odometer_display: odo ? `${odo.toLocaleString("ru-RU")} км` : "—",
        fuel_type: car.fuel_type,
        transmission: car.transmission,

    // Комплектация: из manual, если не пусто, иначе — из car.equipment
    equipment:    (manual.equipment || car.equipment),

    // Описание: из manual, если не пусто, иначе — пустая строка
    description:  (manual.description || ""),

    // Вся структура ручных цен
    manual_price: manual
      };
    });
    
    

    // Обновляем кэш
    carCache.data = reducedCars;
    carCache.timestamp = Date.now();

    // const paginatedCars = reducedCars.slice(offset, offset + items);
    // res.json({ success: true, cars_list: paginatedCars });
    const paginatedCars = reducedCars.slice(offset, offset + items);
res.json({
  success: true,
  cars_list: paginatedCars,
  total: reducedCars.length
});

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


// const fs = require('fs');
const PHOTO_DIR = "/var/www/autofinanceapp.ru/photos";
// 📷 Раздаём статические файлы из каталога /var/www/autofinanceapp.ru/photos
app.use('/photos', express.static(PHOTO_DIR));


// 📷 Эндпоинт: отдать список фото по номеру
app.get('/api/photos/:number', (req, res) => {
  const number = req.params.number.replace(/\s/g, '').toUpperCase();
  const folderPath = path.join(PHOTO_DIR, number);

  fs.readdir(folderPath, (err, files) => {
    if (err || !files) {
      return res.status(404).json({ success: false, error: 'Фотографии не найдены' });
    }

    const photoFiles = files
      .filter(f => f.startsWith(number + '_') && /\.(jpe?g|png)$/i.test(f))
      .map(f => `/photos/${number}/${f}`);

    res.json({ success: true, photos: photoFiles });
  });
});


// Подключение Telegram-бота
require("./bot/bot.js");


// 📄 Получение всех ручных цен
app.get('/api/manual-prices', (req, res) => {
  res.json(manualPrices);
});

// 💾 Сохранение новых цен
app.post('/api/manual-prices', (req, res) => {
  try {
    const updated = req.body;
    if (typeof updated !== 'object') throw new Error("Некорректный формат данных");

    // Перезаписываем файл
    fs.writeFileSync(manualPricesPath, JSON.stringify(updated, null, 2), 'utf-8');
    manualPrices = updated;

    console.log("[✔] Обновлены ручные цены через интерфейс администратора");
    res.json({ success: true });
  } catch (err) {
    console.error("[✖] Ошибка при сохранении ручных цен:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ▶️ Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
