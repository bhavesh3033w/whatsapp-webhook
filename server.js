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

// ✅ GOOGLE SHEETS SETUP
const auth = new google.auth.GoogleAuth({
    keyFile: "learnmateai-495610-7171574cd064.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({
  version: "v4",
  auth,
});

// ✅ PASTE YOUR GOOGLE SHEET ID
const SPREADSHEET_ID = "1zgx1MFxfxKTTX7AZ8QrHc8OVQSE6JOUH325ndJaQFXE";

// 🚨 Safety check
if (!ACCESS_TOKEN || !PHONE_NUMBER_ID || !OPENAI_API_KEY) {
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
    console.log("❌ Google Sheets Error:", error.message);
  }
}

// 🤖 OpenRouter AI function
async function getAIReply(userMessage) {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: `Reply in short WhatsApp style (friendly Hinglish): ${userMessage}`
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://whatsapp-webhook-efcw.onrender.com",
          "X-Title": "WhatsApp Bot"
        }
      }
    );

    const text =
      response.data.choices?.[0]?.message?.content ||
      "Hmm… try again 🤖";

    return text.slice(0, 1500);

  } catch (error) {
    console.log("🔥 AI ERROR:", error.response?.data || error.message);
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

// 🔹 Receive message
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
        reply = await getAIReply(text);
      }

      // ✅ SAVE TO GOOGLE SHEET
      await saveToSheet(
        "Bhavesh",
        from,
        text,
        reply
      );

      // 📩 Send reply to WhatsApp
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
  res.send("WhatsApp AI bot running 🚀");
});

// 🔹 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));