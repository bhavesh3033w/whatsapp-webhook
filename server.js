const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// 🔐 ENV VARIABLES
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "bhavesh123";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// 🔹 VERIFY WEBHOOK (Meta verification)
app.get('/webhook', (req, res) => {
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

// 🔹 RECEIVE MESSAGE + AUTO REPLY
app.post('/webhook', async (req, res) => {
  try {
    console.log("Incoming 🔥:", JSON.stringify(req.body, null, 2));

    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body?.toLowerCase();

      console.log("User:", text);

      let reply = "Default reply 🤖";

      // 🔥 SMART RESPONSES
      if (text === "hi" || text === "hello") {
        reply = "Hello Bhavesh 😎";
      } else if (text === "help") {
        reply = "How can I help you?";
      } else {
        reply = `You said: ${text} 😎`;
      }

      // 🔹 SEND MESSAGE BACK
      await axios.post(
        `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: reply }
        },
        {
          headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
    res.sendStatus(500);
  }
});

// 🔹 ROOT ROUTE (health check)
app.get('/', (req, res) => {
  res.send("Webhook server running 🚀");
});

// 🔹 PORT (Render ke liye important)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));