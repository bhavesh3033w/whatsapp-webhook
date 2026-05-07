require("dotenv").config();

const express = require("express");
const axios = require("axios");
const { google } = require("googleapis");

const app = express();
app.use(express.json());

// 🔐 ENV VARIABLES
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "bhavesh123";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ✅ GOOGLE SERVICE ACCOUNT FROM RENDER ENV
const credentials = JSON.parse(
  process.env.GOOGLE_SERVICE_ACCOUNT
);

// ✅ FIX PRIVATE KEY
credentials.private_key =
  credentials.private_key.replace(/\\n/g, "\n");

// ✅ GOOGLE AUTH
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({
  version: "v4",
  auth,
});

// ✅ GOOGLE SHEET ID
const SPREADSHEET_ID =
  "1zgx1MFxfxKTTX7AZ8QrHc8OVQSE6JOUH325ndJaQFXE";

// 🚨 SAFETY CHECK
if (
  !ACCESS_TOKEN ||
  !PHONE_NUMBER_ID ||
  !OPENAI_API_KEY ||
  !process.env.GOOGLE_SERVICE_ACCOUNT
) {
  console.log("❌ Missing ENV variables!");
}

// ✅ SAVE DATA TO GOOGLE SHEET
async function saveToSheet(name, phone, message, reply) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!A:E",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            name,
            phone,
            message,
            reply,
            new Date().toLocaleString(),
          ],
        ],
      },
    });

    console.log("✅ Data saved to Google Sheet");

  } catch (error) {
    console.log(
      "❌ Google Sheets Error:",
      error.response?.data || error.message
    );
  }
}

// 🤖 OPENROUTER AI FUNCTION
async function getAIReply(userMessage) {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a friendly WhatsApp AI assistant. Reply short, smart and Hinglish style."
          },
          {
            role: "user",
            content: userMessage
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            "https://whatsapp-webhook-efcw.onrender.com",
          "X-Title": "WhatsApp Bot"
        }
      }
    );

    const text =
      response.data.choices?.[0]?.message?.content ||
      "Hmm… try again 🤖";

    return text.slice(0, 1500);

  } catch (error) {
    console.log(
      "🔥 AI ERROR:",
      error.response?.data || error.message
    );

    return "AI error aa gaya 😅";
  }
}

// ✅ VERIFY WEBHOOK
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ✅ RECEIVE MESSAGE
app.post("/webhook", async (req, res) => {
  try {
    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body || "";

      console.log("📩 User:", text);

      let reply = "";

      // 🎯 CUSTOM REPLIES
      if (
        text.toLowerCase() === "hi" ||
        text.toLowerCase() === "hello"
      ) {
        reply = "Hello Bhavesh 😎";
      }
      else if (text.toLowerCase() === "help") {
        reply = "Ask me anything 🤖";
      }
      else {
        reply = await getAIReply(text);
      }

      // ✅ SAVE CHAT TO SHEET
      await saveToSheet(
        "Bhavesh",
        from,
        text,
        reply
      );

      // ✅ SEND WHATSAPP REPLY
      await axios.post(
        `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: {
            body: reply
          }
        },
        {
          headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log("✅ Reply sent");
    }

    res.sendStatus(200);

  } catch (err) {
    console.error(
      "❌ WhatsApp Error:",
      err.response?.data || err.message
    );

    res.sendStatus(500);
  }
});

// ✅ HEALTH CHECK
app.get("/", (req, res) => {
  res.send("WhatsApp AI Bot running 🚀");
});

// ✅ START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});