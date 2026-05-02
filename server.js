require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// 🔐 ENV VARIABLES
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "bhavesh123";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 🚨 Safety check
if (!ACCESS_TOKEN || !PHONE_NUMBER_ID || !GEMINI_API_KEY) {
  console.log("❌ Missing ENV variables. Check Render Environment!");
}

// 🤖 Gemini function (FINAL FIXED)
async function getGeminiReply(userMessage) {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: `Reply in short WhatsApp style (friendly, Hinglish allowed): ${userMessage}`
              }
            ]
          }
        ]
      },
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    const text =
      response.data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Hmm… try again 🤖";

    return text.slice(0, 1500);
  } catch (error) {
    console.log("🔥 GEMINI ERROR:", error.response?.data || error.message);
    return "AI error aa gaya 😅 try again.";
  }
}

// 🔹 Verify Webhook
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified ✅");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// 🔹 Receive message + reply
app.post("/webhook", async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body?.toLowerCase() || "";

      console.log("User:", text);

      let reply = "";

      // 🎯 Custom replies
      if (text === "hi" || text === "hello") {
        reply = "Hello Bhavesh 😎";
      } else if (text === "help") {
        reply = "Ask me anything 🤖";
      } else {
        reply = await getGeminiReply(text);
      }

      // 📩 Send message to WhatsApp
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
    console.error("❌ WhatsApp Error:", err.response?.data || err.message);
    res.sendStatus(500);
  }
});

// 🔹 Health check
app.get("/", (req, res) => {
  res.send("WhatsApp + Gemini bot running 🚀");
});

// 🔹 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));