import { ChatMessage, SessionSummary } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";

const API_BASE_URL = "http://localhost:5000";

class GeminiService {
  async getChatResponse(
    history: ChatMessage[],
    userInput: string
  ): Promise<string> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          history,
          message: userInput,
          systemInstruction: SYSTEM_INSTRUCTION,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Backend error: ${errText}`);
      }

      const data = await res.json();
      return data.text || "";
    } catch (error) {
      console.error("Frontend → Backend chat error:", error);
      throw error; // let ChatWindow catch it
    }
  }

  // (stub for later – backend endpoint not added yet)
  async generateSummary(
    _history: ChatMessage[],
    _userId: string
  ): Promise<SessionSummary> {
    throw new Error("Summary endpoint not implemented yet.");
  }

  async getGuardianReport(
    _summaries: SessionSummary[]
  ): Promise<string> {
    throw new Error("Guardian report endpoint not implemented yet.");
  }
}

export const gemini = new GeminiService();
