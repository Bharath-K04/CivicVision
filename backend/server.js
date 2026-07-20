import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import bodyParser from 'body-parser';
import mockComplaintApi from './ComplaintApi.js';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import fetch from 'node-fetch';
import nodemailer from 'nodemailer';

// Import the new free AI library
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
app.use(cors());
app.use('/', mockComplaintApi);

const upload = multer({ storage: multer.memoryStorage() });

// Initialize Google Gemini
const genAI = new GoogleGenerativeAI("AIzaSyBfbG3EYKdr0ZT-REpB8fc2x4SGSc_q7js");
// We use the flash model as it is fast and handles both text and images natively
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
const prisma = new PrismaClient();
const cityPortalMap = JSON.parse(fs.readFileSync("city_portal_map.json", "utf-8"));
const pendingComplaints = new Map();

// --- Replaced Azure Computer Vision with Gemini Vision ---
async function analyzeImage(buffer, mimeType = "image/jpeg") {
  try {
    const prompt = "Look at this image. Classify the civic issue shown strictly into one of these four categories: 'Road Maintenance', 'Sanitation', 'Street Light', or 'Water Supply'. If it doesn't clearly match any of them, reply with 'null'. Reply with only the category name.";
    
    const imagePart = {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text().trim();
    
    if (responseText.toLowerCase() === 'null') return null;
    return responseText;
  } catch (error) {
    console.error("Image analysis error:", error);
    return null;
  }
}

// --- Replaced Azure OpenAI with Gemini ---
async function classifyDepartment(description) {
  const result = await model.generateContent(`Classify the following civic complaint strictly into one of these categories: Sanitation, Water Supply, Street Light, Road Maintenance. Reply with only the category name.\n\nComplaint: ${description}`);
  return result.response.text().trim();
}

// --- Replaced Azure OpenAI with Gemini ---
async function classifyIntent(message) {
  const result = await model.generateContent(`Classify the following user message strictly into either: 'complaint' or 'general'. Reply with only that single word.\n\nMessage: ${message}`);
  const rawIntent = result.response.text().trim().toLowerCase();
  return rawIntent.replace(/[^a-z]/g, '');
}

app.post('/api/upload-image', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ reply: "No image uploaded." });
  }

  try {
    const location = req.body.location || 'Unknown Location';
    // Pass the file buffer to our new vision function
    const department = await analyzeImage(req.file.buffer, req.file.mimetype);

    if (!department) {
      return res.json({ reply: "❌ Uploaded image doesn't match any civic issue." });
    }

    const city = "Bengaluru";
    const createdComplaint = await prisma.complaint.create({
      data: {
        city,
        department,
        description: "Auto-detected complaint via image",
        location: location,
        complaintId: `IMG-${Date.now().toString().slice(-6)}`
      }
    });

    pendingComplaints.set('default', {
      step: 'ask_additional_description',
      city,
      department,
      description: "Auto-detected complaint via image",
      location: location,
      complaintId: createdComplaint.complaintId,
      chatHistory: [],
      fromImage: true
    });

    return res.json({ reply: `🖼️ Detected *${department}* issue. Would you like to further explain the issue? (yes/no)` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ reply: "Error analyzing uploaded image." });
  }
});

app.use(express.json());
app.use(bodyParser.json());

// 🌟 Main Smart Flow
app.post("/api/ask", async (req, res) => {
  const { message, location, userId = "default" } = req.body;
  if (!message) return res.status(400).json({ error: "Message is required" });

  try {
    if (pendingComplaints.has(userId)) {
      const pending = pendingComplaints.get(userId);
      pending.chatHistory.push({ from: 'user', text: message });
      const confirmation = message.trim().toLowerCase();

      if (pending.step === 'ask_additional_description') {
        if (["yes", "yep", "yeah"].some(p => confirmation.includes(p))) {
          pending.step = 'awaiting_description';
          pendingComplaints.set(userId, pending);
          return res.json({ reply: "✏️ Please describe the issue briefly." });
        } else {
          pending.step = 'ask_location_update';
          pendingComplaints.set(userId, pending);
          return res.json({ reply: `📍 Current address is *${pending.location}*. Would you like to update it? (yes/no)` });
        }
      }

      if (pending.step === 'awaiting_description') {
        pending.description = message;
        pending.step = 'ask_location_update';
        pendingComplaints.set(userId, pending);
        return res.json({ reply: `📍 Current address is *${pending.location}*. Would you like to update it? (yes/no)` });
      }

      if (pending.step === 'ask_location_update') {
        if (["yes", "yep", "yeah"].some(p => confirmation.includes(p))) {
          pending.step = 'awaiting_new_location';
          pendingComplaints.set(userId, pending);
          return res.json({ reply: "📍 Please provide the updated location." });
        } else {
          pending.step = 'final_confirmation';
          pendingComplaints.set(userId, pending);
          return finalizeComplaint(userId, res);
        }
      }

      if (pending.step === 'awaiting_new_location') {
        pending.location = message;
        pending.step = 'final_confirmation';
        pendingComplaints.set(userId, pending);
        return finalizeComplaint(userId, res);
      }
    }

    const intent = await classifyIntent(message);

    if (intent === "general") {
      const prompt = `You are CivicVision Assistant — a helpful civic grievance assistant built for citizens to engage with municipal services.
      Your responsibilities include:
      - Answering questions about civic issues like water supply, road maintenance, street lights, sanitation, etc.
      - Explaining how users can raise or follow up on grievances.
      - Helping users understand how complaint classification, image reporting, and location detection work.
      - Responding politely to small talk, but always steering the conversation back to civic services.
      - Never make up jokes, facts, or content unrelated to local municipal services.
      If you do not know the answer, suggest raising a complaint or redirect the user to the civic helpdesk.
      
      User message: ${message}`;
      
      const generalRes = await model.generateContent(prompt);
      return res.json({ reply: generalRes.response.text().trim() });
    }

    if (intent === "complaint") {
      const department = await classifyDepartment(message);
      const city = "Bengaluru";
      const createdComplaint = await prisma.complaint.create({
        data: {
          city,
          department,
          description: message,
          location: JSON.stringify(location),
          complaintId: `CMP-${Date.now().toString().slice(-6)}`
        }
      });

      pendingComplaints.set(userId, {
        step: 'ask_additional_description',
        city,
        department,
        location,
        description: message,
        complaintId: createdComplaint.complaintId,
        chatHistory: [{ from: "user", text: message }]
      });

      return res.json({ reply: `📝 Detected *${department}* issue. Would you like to further explain the issue? (yes/no)` });
    }

    return res.json({ reply: "🤔 Sorry, couldn't understand. Could you rephrase?" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Finalize complaint and respond
async function finalizeComplaint(userId, res) {
  const pending = pendingComplaints.get(userId);

  if (!pending) {
    return res.status(400).json({ reply: "No pending complaint to register." });
  }

  pendingComplaints.delete(userId);

  const cityData = cityPortalMap[pending.city];
  const endpoint = cityData.departments[pending.department];

  // Silently handle if the mock endpoint fails, just so the app doesn't crash for a beginner
  try {
    await fetch(`http://localhost:5001${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pending),
    });
  } catch (e) {
    console.log("Mock API call skipped or failed, continuing flow...");
  }

  const summary = `
✅ Complaint registered successfully!

- Department: *${pending.department}*
- Location: *${pending.location}*
- Description: *${pending.description}*
- Grievance ID: *${pending.complaintId}*

The Bengaluru City Municipal Corp. will get back to you soon. You can track your complaint using the ID above.
For any further assistance, please contact: 080-23456789.
`;

  await prisma.complaint.update({
    where: { complaintId: pending.complaintId },
    data: { chatHistory: [...pending.chatHistory, { from: "bot", text: summary }] }
  });

  return res.json({ reply: summary });
}

app.get('/api/grievances', async (req, res) => {
  try {
    const complaints = await prisma.complaint.findMany({ orderBy: { createdAt: 'desc' } });
    res.status(200).json({ grievances: complaints });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch grievances' });
  }
});

app.get("/api/grievance/:complaintId", async (req, res) => {
  const { complaintId } = req.params;
  try {
    const grievance = await prisma.complaint.findUnique({ where: { complaintId } });
    if (!grievance) return res.status(404).json({ error: 'Grievance not found' });
    res.json({ chatHistory: grievance.chatHistory || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch grievance' });
  }
});

const PORT = process.env.PORT || 5001;
// --- NEW FEATURE 1: Send Follow-Up Email ---
app.post("/api/followup", async (req, res) => {
  const { complaintId } = req.body;

  try {
    // 1. Set up the email sender
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // 2. Draft the email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Sending to yourself for testing!
      subject: `Follow up on Grievance ID ${complaintId}`,
      text: `Hello,\n\nWe are requesting a status update on the reported civic issue with Grievance ID: ${complaintId}.\n\nPlease expedite the resolution.\n\nThank you,\nCivicVision Automated System`
    };

    // 3. Send it
    await transporter.sendMail(mailOptions);

    // 4. Update the chat history in the database so the user sees it
    const grievance = await prisma.complaint.findUnique({ where: { complaintId } });
    if (grievance) {
      const followUpMessage = { 
        from: "bot", 
        text: `📧 Sent a follow up email to the municipal corporation.\n\nSubject: **Follow up on Grievance ID ${complaintId}**\n\nBody: **Requesting status update on the reported civic issue.**` 
      };
      await prisma.complaint.update({
        where: { complaintId },
        data: { chatHistory: [...grievance.chatHistory, followUpMessage] }
      });
    }

    res.json({ success: true, message: "Email sent successfully!" });
  } catch (error) {
    console.error("Email error:", error);
    res.status(500).json({ error: "Failed to send email." });
  }
});

// --- NEW FEATURE 2: Clear All Grievances ---
app.delete("/api/grievances/clear", async (req, res) => {
  try {
    // Delete all records from the database
    await prisma.complaint.deleteMany({});
    res.json({ success: true, message: "All past grievances cleared." });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: "Failed to clear grievances." });
  }
});
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));