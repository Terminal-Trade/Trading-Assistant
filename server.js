const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const COINBASE_API_KEY = process.env.COINBASE_API_KEY;
const COINBASE_API_URL = 'https://api.commerce.coinbase.com/charges';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Загружаем продукты
let rawData = fs.readFileSync(path.join(__dirname, 'products.json'));
let productLinks = JSON.parse(rawData);

// Состояние проданных/выданных файлов
let soldFiles = {
  product1: [],
  product2: [],
  product3: []
};

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

    if (data && data.data && data.data.hosted_url) {
      res.json({ checkoutUrl: data.data.hosted_url });
    } else {
      res.status(500).json({ error: 'Failed to create checkout', details: data });
    }

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Webhook от Coinbase
app.post('/webhook', (req, res) => {
  const event = req.body.event;
  if (!event) return res.sendStatus(400);

  if (event.type === 'charge:confirmed') {
    const productKey = event.data.name.split(' ')[1]; // Берем "product1" из "Product product1"
    const available = productLinks[productKey].filter(link => !soldFiles[productKey].includes(link));
    if (available.length === 0) {
      console.log(`All files sold for ${productKey}`);
      return res.sendStatus(200);
    }

    const file = available[0];
    soldFiles[productKey].push(file);
    console.log(`Sold file for ${productKey}: ${file}`);
  }

  res.sendStatus(200);
});

// Endpoint выдачи ссылки после оплаты
app.get('/download/:product', (req, res) => {
  const product = req.params.product;
  const available = productLinks[product].filter(link => !soldFiles[product].includes(link));

  if (!available || available.length === 0) return res.json({ fileUrl: null });

  const fileUrl = available[0];
  soldFiles[product].push(fileUrl);
  res.json({ fileUrl });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('COINBASE_API_KEY =', COINBASE_API_KEY ? 'OK' : 'NOT SET');
});
