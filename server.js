require("dotenv").config();

const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const { google } = require("googleapis");

const app = express();
app.use(express.json());

// 🔐 ENV VARIABLES
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "bhavesh123";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ✅ GOOGLE SERVICE ACCOUNT
const credentials = JSON.parse(
  process.env.GOOGLE_SERVICE_ACCOUNT
);

// ✅ FIX PRIVATE KEY
credentials.private_key = credentials.private_key
  .replace(/\\\\n/g, "\n")
  .replace(/\\n/g, "\n");

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

// 🤖 AI FUNCTION
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
              "You are a friendly WhatsApp AI assistant. Reply short and easy Hinglish style."
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

    return (
      response.data.choices?.[0]?.message?.content ||
      "AI error 😅"
    ).slice(0, 1500);

  } catch (error) {
    console.log(
      "🔥 AI ERROR:",
      error.response?.data || error.message
    );

    return "AI error aa gaya 😅";
  }
}

// ✅ DOWNLOAD MEDIA
async function downloadMedia(mediaId, outputPath) {
  try {
    const mediaRes = await axios.get(
      `https://graph.facebook.com/v19.0/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`
        }
      }
    );

    const mediaUrl = mediaRes.data.url;

    const media = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`
      }
    });

    fs.writeFileSync(outputPath, media.data);

    console.log("✅ Media downloaded");

  } catch (error) {
    console.log(
      "❌ Media download error:",
      error.message
    );
  }
}

// ✅ PDF TEXT EXTRACTION
async function extractPDFText(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);

  return data.text;
}

// ✅ IMAGE OCR
async function extractImageText(filePath) {
  const result = await Tesseract.recognize(
    filePath,
    "eng"
  );

  return result.data.text;
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

      let text = "";
      let reply = "";

      // ✅ TEXT MESSAGE
      if (message.type === "text") {
        text = message.text.body;

        console.log("📩 User:", text);

        if (
          text.toLowerCase() === "hi" ||
          text.toLowerCase() === "hello"
        ) {
          reply = "Hello Bhavesh 😎";
        }
        else if (text.toLowerCase() === "help") {
          reply = "Send text, PDF or image 📄🖼️";
        }
        else {
          reply = await getAIReply(text);
        }
      }

      // ✅ PDF DOCUMENT
      else if (message.type === "document") {
        text = "PDF Uploaded";

        const mediaId = message.document.id;

        const fileName =
          `file_${Date.now()}.pdf`;

        const filePath = path.join(
          __dirname,
          fileName
        );

        await downloadMedia(mediaId, filePath);

        const extractedText = (
          await extractPDFText(filePath)
        ).slice(0, 5000);

        reply = await getAIReply(
          `Summarize this PDF in easy Hinglish:\n${extractedText}`
        );

        // ✅ SAFE DELETE
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // ✅ IMAGE MESSAGE
      else if (message.type === "image") {
        text = "Image Uploaded";

        const mediaId = message.image.id;

        const filePath = path.join(
          __dirname,
          `image_${Date.now()}.jpg`
        );

        await downloadMedia(mediaId, filePath);

        const extractedText = (
          await extractImageText(filePath)
        ).slice(0, 3000);

        // ✅ EMPTY OCR CHECK
        if (!extractedText.trim()) {
          reply = "Image me text detect nahi hua 😅";
        }
        else {
          reply = await getAIReply(
            `Explain these notes in easy Hinglish:\n${extractedText}`
          );
        }

        // ✅ SAFE DELETE
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // ✅ UNSUPPORTED MESSAGE
      else {
        reply =
          "Abhi main sirf text, PDF aur images samajh sakta hu 😄";
      }

      // ✅ SAVE TO GOOGLE SHEET
      await saveToSheet(
        "Bhavesh",
        from,
        text || "Unknown Message",
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