import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import { registerUser, loginUser, addGuardian, getGuardian, getUserById } from "./auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Create Groq client ONCE
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Health check
app.get("/", (_req, res) => {
  res.json({ status: "Care Connect backend running" });
});

// ==================== AUTH ENDPOINTS ====================

// Register new student
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const result = await registerUser(username, email, password);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, userId: result.userId, message: "Registration successful" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const result = await loginUser(username, password);

    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    res.json({ success: true, user: result.user });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Get user profile
app.get("/api/user/:userId", (req, res) => {
  try {
    const user = getUserById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

// ==================== GUARDIAN ENDPOINTS ====================

// Add/update guardian for a student
app.post("/api/guardian/:studentId", (req, res) => {
  try {
    const { studentId } = req.params;
    const guardianData = req.body;

    if (!guardianData.guardian_name) {
      return res.status(400).json({ error: "Guardian name is required" });
    }

    const result = addGuardian(studentId, guardianData);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, message: "Guardian added successfully" });
  } catch (error) {
    console.error("Add guardian error:", error);
    res.status(500).json({ error: "Failed to add guardian" });
  }
});

// Get guardian for a student
app.get("/api/guardian/:studentId", (req, res) => {
  try {
    const guardian = getGuardian(req.params.studentId);
    
    if (!guardian) {
      return res.status(404).json({ error: "Guardian not found" });
    }

    res.json(guardian);
  } catch (error) {
    console.error("Get guardian error:", error);
    res.status(500).json({ error: "Failed to get guardian" });
  }
});

// ==================== CHAT ENDPOINT ====================

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { history = [], message, systemInstruction } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Build conversation text safely
    const conversation = [
      `SYSTEM:\n${systemInstruction}`,
      ...history.map(h => `${h.role.toUpperCase()}: ${h.content}`),
      `USER: ${message}`
    ].join("\n\n");

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",  // ✅ Current Groq production model
      messages: [
        {
          role: "user",
          content: conversation,
        },
      ],
      temperature: 0.7,
    });

    res.json({
      text: response.choices[0]?.message?.content ?? "",
    });

  } catch (error) {
    console.error("🔥 GROQ GENERATE FAILED:", error);
    res.status(500).json({ error: "Groq service failed" });
  }
});




app.listen(PORT, () => {
  console.log(`✅ Backend listening on http://localhost:${PORT}`);
});
