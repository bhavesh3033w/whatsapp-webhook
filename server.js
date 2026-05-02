const express = require('express');
const app = express();

// JSON parse (future ke liye useful)
app.use(express.json());

// 🔹 VERIFY WEBHOOK (GET request)
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = "bhavesh123";

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log("Webhook verified ✅");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// 🔹 RECEIVE MESSAGES (POST request)
app.post('/webhook', (req, res) => {
  console.log("Incoming webhook data 🔥:");
  console.log(JSON.stringify(req.body, null, 2));

  // Always respond 200 OK
  res.sendStatus(200);
});

// 🔹 ROOT (optional check)
app.get('/', (req, res) => {
  res.send("Webhook server running 🚀");
});

// 🔹 PORT (IMPORTANT for Render)
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log("Server running on port " + PORT);
  });