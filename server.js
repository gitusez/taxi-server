const express = require("express");
const cors = require("cors");
const axios = require("axios");
const morgan = require("morgan");
const compression = require("compression");
const crypto = require("crypto");
const path = require("path");

const app = express();

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

app.use((err, req, res, next) => {
  if (err.message === "Invalid JSON") {
    return res.status(400).json({ success: false, error: "Невалидный JSON" });
  }
  next(err);
});

function generateSignature(jsonBody, apiKey) {
  return crypto.createHash("sha1").update(jsonBody + apiKey).digest("hex");
}

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

app.post("/api/cars/combined", async (req, res) => {
  try {
    const { items = 30, offset = 0 } = req.body;

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

    const promises = accounts.map(async account => {
      let cars = [];

      for (const ownerId of account.ownerIds) {
        const data = await fetchCars(account.url, account.apiKey, ownerId);
        if (data.success && data.cars_list) {
          const list = Array.isArray(data.cars_list)
            ? data.cars_list
            : Object.values(data.cars_list);

          const filtered = list.filter(car => car.status === 20);
          cars = cars.concat(filtered);
        }
      }

      return cars;
    });

    const results = await Promise.all(promises);
    const allCars = results.flat();

    const paginatedCars = allCars.slice(offset, offset + items);

    res.json({ success: true, cars_list: paginatedCars });
  } catch (error) {
    console.error("Ошибка объединения:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
