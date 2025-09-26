const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 10000;

const COINBASE_API_KEY = process.env.COINBASE_API_KEY;
const COINBASE_API_URL = 'https://api.commerce.coinbase.com/charges';

// CORS для GitHub Pages
app.use(cors({
  origin: 'https://terminal-trade.github.io',
  credentials: true
}));
app.use(bodyParser.json());
app.use(express.static('public'));

// Загружаем продукты
const productsPath = path.join(__dirname, 'products.json');
let productLinks = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));

// Проданные файлы
let soldFiles = {};
for (let key of Object.keys(productLinks)) soldFiles[key] = [];

// Создание checkout на Coinbase
app.post('/create-checkout', async (req, res) => {
  const { product } = req.body;
  if (!productLinks[product]) return res.status(400).json({ error: 'Product not found' });

  try {
    const body = {
      name: `Product ${product}`,
      description: `Purchase ${product}`,
      local_price: { amount: '35.00', currency: 'USD' },
      pricing_type: 'fixed_price'
    };

    const response = await fetch(COINBASE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CC-Api-Key': COINBASE_API_KEY,
        'X-CC-Version': '2018-03-22'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (data?.data?.hosted_url) res.json({ checkoutUrl: data.data.hosted_url });
    else res.status(500).json({ error: 'Failed to create checkout', details: data });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Webhook Coinbase
app.post('/webhook', (req, res) => {
  const event = req.body.event;
  if (!event) return res.sendStatus(400);

  if (event.type === 'charge:confirmed') {
    const productKey = event.data.name.split(' ')[1];
    const available = productLinks[productKey].filter(link => !soldFiles[productKey].includes(link));
    if (available.length === 0) return res.sendStatus(200);

    const file = available[0];
    soldFiles[productKey].push(file);
    console.log(`Sold file for ${productKey}: ${file}`);
  }

  res.sendStatus(200);
});

// Получение ссылки только после подтверждения оплаты
app.get('/download/:product', (req, res) => {
  const product = req.params.product;
  if (!productLinks[product]) return res.json({ fileUrl: null });

  // Отдаём только уже проданный файл
  const sold = soldFiles[product];
  if (!sold || sold.length === 0) return res.json({ fileUrl: null });

  res.json({ fileUrl: sold[sold.length - 1] }); // последняя проданная ссылка
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('COINBASE_API_KEY =', COINBASE_API_KEY ? 'OK' : 'NOT SET');
});
