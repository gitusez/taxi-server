// server.js
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const morgan = require("morgan");
const crypto = require("crypto");

const app = express();

app.use(morgan("dev"));
app.use(cors({
  origin: "*",
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Функция для генерации SHA1-подписи (JSON-тело + API ключ)
function generateSignature(jsonBody, apiKey) {
  return crypto.createHash("sha1").update(jsonBody + apiKey).digest("hex");
}

// Функция для запроса авто у одного аккаунта
async function fetchCars(url, apiKey, filterOwnerId) {
  const timestamp = Math.floor(Date.now() / 1000);
  // Формируем тело запроса; передаём фильтр в виде объекта
  const requestData = {
    timestamp: timestamp,
    filters: { filter_owner_id: filterOwnerId }, // если API принимает объект фильтров
    items: 100,  // можно настроить, сколько записей получить
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

// Эндпоинт для объединения данных из трёх аккаунтов
app.post("/api/cars/combined", async (req, res) => {
  try {
    // Задаём параметры для каждого аккаунта
    const accounts = [
      {
        url: "https://premiergroup.taxicrm.ru/api/public/v1/cars/list",
        apiKey: "ff841cef5fb5602e51ae7432230078906c9577af", // замените на ваш ключ для первого аккаунта
        ownerIds: ["cc9af95f-1f44-557a-89ab-d2c6e36d7e9d"]
      },
      {
        url: "https://premierm.taxicrm.ru/api/public/v1/cars/list",
        apiKey: "c7611ef537404fad4ac7043a2b3d148caf71328d", // замените на ваш ключ для второго аккаунта
        ownerIds: ["5ca94f01-64a1-5e14-9d22-4a69d0851e77"]
      },
      {
        url: "https://premierplus.taxicrm.ru/api/public/v1/cars/list",
        apiKey: "f6bb44ed1116ca11dd5eeae3772f41c6ef6f90e7", // замените на ваш ключ для третьего аккаунта
        // Если для третьего аккаунта нужно фильтровать сразу по двум значениям,
        // передаём массив owner_id
        ownerIds: ["08bd7d68-9c8f-5d7c-b73c-5fca59168f7b", "164b685f-ca1b-5ac6-9f59-3ee0fa42e98a"]
      }
    ];

    // Для каждого аккаунта запускаем запросы (если API не поддерживает передачу массива, можно делать по одному)
    const promises = accounts.map(async account => {
      // Если ownerIds – массив, можно запросить для каждого и объединить, например:
      let cars = [];
      for (const ownerId of account.ownerIds) {
        const data = await fetchCars(account.url, account.apiKey, ownerId);
        if (data.success && data.cars_list) {
          const list = Array.isArray(data.cars_list)
            ? data.cars_list
            : Object.values(data.cars_list);
          cars = cars.concat(list);
        }
      }
      return cars;
    });

    const results = await Promise.all(promises);
    // Объединяем результаты всех аккаунтов в один массив
    const combinedCars = results.flat();

    res.json({ success: true, cars_list: combinedCars });
  } catch (error) {
    console.error("Ошибка объединения:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
