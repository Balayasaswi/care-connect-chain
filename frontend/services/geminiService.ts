import { ChatMessage, CounsellorRequest, CounsellorRequestUrgency, CounsellorSchedule, CounsellorStudent, NetworkActorRole, NetworkConnection, NetworkStatus, SessionRecord, SessionSummary } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === "localhost" ? "http://localhost:5000" : window.location.origin);

type IpfsPinResponse = {
  cid: string;
  uri: string;
  gatewayUrl: string;
  pinSize?: number;
  timestamp?: string;
};

type BlockchainRecordPayload = {
  chainId: number;
  address: string;
  txHash: string;
  timestamp: string;
  userId?: string;
  sessionId?: string;
  cid?: string;
  contractAddress?: string;
};

type SessionPinPayload = {
  sessionId: string;
  userId: string;
  summary: SessionSummary;
  history: ChatMessage[];
  pinnedAt: string;
};

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
    history: ChatMessage[],
    userId: string
  ): Promise<SessionSummary> {
    const res = await fetch(`${API_BASE_URL}/api/summary`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        history,
        userId
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Summary error: ${errText}`);
    }

    return res.json();
  }

  async getGuardianReport(
    summaries: SessionSummary[]
  ): Promise<string> {
    if (!summaries.length) {
      return "No sessions found.";
    }

    return summaries
      .map((summary) => {
        const keywords = Array.isArray(summary.keywords) ? summary.keywords.join(", ") : "";
        return [
          `Session Date: ${summary.start_time_stamp}`,
          `Emotion: ${summary.emotion}`,
          `Keywords: ${keywords}`,
          `Summary: ${summary.summary}`
        ].join("\n");
      })
      .join("\n\n");
  }

  async pinSessionToIpfs(payload: SessionPinPayload): Promise<IpfsPinResponse> {
    const res = await fetch(`${API_BASE_URL}/api/ipfs/pin-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`IPFS pin error: ${errText}`);
    }

    return res.json();
  }

  async archiveSession(payload: SessionPinPayload & { cid?: string }): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE_URL}/api/sessions/archive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Session archive error: ${errText}`);
    }

    return res.json();
  }

  async recordBlockchainTx(payload: BlockchainRecordPayload): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE_URL}/api/blockchain/record`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Blockchain record error: ${errText}`);
    }

    return res.json();
  }

  async fetchGuardianSummaries(studentId: string, guardianEmail: string): Promise<SessionSummary[]> {
    const url = new URL(`${API_BASE_URL}/api/guardian/summaries`);
    url.searchParams.set("student_id", studentId);
    url.searchParams.set("guardian_email", guardianEmail);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Guardian summaries error: ${errText}`);
    }

    const data = await res.json();
    return Array.isArray(data.summaries) ? data.summaries : [];
  }

  async fetchCounsellorSummaries(counsellorEmail: string): Promise<SessionSummary[]> {
    const url = new URL(`${API_BASE_URL}/api/counsellor/summaries`);
    url.searchParams.set("counsellor_email", counsellorEmail);
    const res = await fetch(url.toString());
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Counsellor summaries error: ${errText}`);
    }
    const data = await res.json();
    return Array.isArray(data.summaries) ? data.summaries : [];
  }

  async fetchCounsellorStudents(counsellorEmail: string): Promise<CounsellorStudent[]> {
    const url = new URL(`${API_BASE_URL}/api/counsellor/students`);
    url.searchParams.set("counsellor_email", counsellorEmail);
    const res = await fetch(url.toString());
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Counsellor students error: ${errText}`);
    }
    const data = await res.json();
    return Array.isArray(data.students) ? data.students : [];
  }

  async createCounsellorRequest(payload: {
    studentId: string;
    sessionId?: string;
    sessionEmotion?: string;
    urgency: CounsellorRequestUrgency;
    reason?: string;
    requestedByRole: "guardian" | "institution";
    requestedByEmail: string;
  }): Promise<CounsellorRequest> {
    const res = await fetch(`${API_BASE_URL}/api/counsellor/requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        student_id: payload.studentId,
        session_id: payload.sessionId,
        session_emotion: payload.sessionEmotion,
        urgency: payload.urgency,
        reason: payload.reason,
        requested_by_role: payload.requestedByRole,
        requested_by_email: payload.requestedByEmail
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Counsellor request create error: ${errText}`);
    }

    const data = await res.json();
    return data.request as CounsellorRequest;
  }

  async fetchCounsellorRequests(counsellorEmail: string): Promise<CounsellorRequest[]> {
    const url = new URL(`${API_BASE_URL}/api/counsellor/requests`);
    url.searchParams.set("counsellor_email", counsellorEmail);
    const res = await fetch(url.toString());
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Counsellor request list error: ${errText}`);
    }
    const data = await res.json();
    return Array.isArray(data.requests) ? data.requests : [];
  }

  async createCounsellorSessionFromRequest(requestId: string, counsellorEmail: string): Promise<{ request: CounsellorRequest }> {
    const res = await fetch(`${API_BASE_URL}/api/counsellor/requests/${requestId}/create-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ counsellor_email: counsellorEmail })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Counsellor session create error: ${errText}`);
    }

    const data = await res.json();
    return { request: data.request as CounsellorRequest };
  }

  async createCounsellorSchedule(payload: {
    studentId: string;
    counsellorEmail: string;
    scheduledFor: string;
    urgency: CounsellorRequestUrgency;
    notes?: string;
    sourceRequestId?: string;
  }): Promise<CounsellorSchedule> {
    const res = await fetch(`${API_BASE_URL}/api/counsellor/schedules`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        student_id: payload.studentId,
        counsellor_email: payload.counsellorEmail,
        scheduled_for: payload.scheduledFor,
        urgency: payload.urgency,
        notes: payload.notes,
        source_request_id: payload.sourceRequestId
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Counsellor schedule create error: ${errText}`);
    }

    const data = await res.json();
    return data.schedule as CounsellorSchedule;
  }

  async fetchCounsellorSchedules(counsellorEmail: string, studentId?: string): Promise<CounsellorSchedule[]> {
    const url = new URL(`${API_BASE_URL}/api/counsellor/schedules`);
    url.searchParams.set("counsellor_email", counsellorEmail);
    if (studentId) {
      url.searchParams.set("student_id", studentId);
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Counsellor schedule list error: ${errText}`);
    }

    const data = await res.json();
    return Array.isArray(data.schedules) ? data.schedules : [];
  }

  async fetchStudentNotifications(studentId: string): Promise<CounsellorSchedule[]> {
    const url = new URL(`${API_BASE_URL}/api/student/notifications`);
    url.searchParams.set("student_id", studentId);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Student notifications error: ${errText}`);
    }

    const data = await res.json();
    return Array.isArray(data.notifications) ? data.notifications : [];
  }

  async markStudentNotificationRead(studentId: string, scheduleId: string): Promise<CounsellorSchedule> {
    const res = await fetch(`${API_BASE_URL}/api/student/notifications/${scheduleId}/read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ student_id: studentId })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Mark notification read error: ${errText}`);
    }

    const data = await res.json();
    return data.notification as CounsellorSchedule;
  }

  async fetchInstitutionSummaries(collegeCode: string): Promise<SessionSummary[]> {
    const url = new URL(`${API_BASE_URL}/api/institution/summaries`);
    url.searchParams.set("college_code", collegeCode);
    const res = await fetch(url.toString());
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Institution summaries error: ${errText}`);
    }
    const data = await res.json();
    return Array.isArray(data.summaries) ? data.summaries : [];
  }

  async fetchInstitutionStudents(collegeCode: string): Promise<CounsellorStudent[]> {
    const url = new URL(`${API_BASE_URL}/api/institution/students`);
    url.searchParams.set("college_code", collegeCode);
    const res = await fetch(url.toString());
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Institution students error: ${errText}`);
    }
    const data = await res.json();
    return Array.isArray(data.students) ? data.students : [];
  }

  async fetchSessions(
    userId: string,
    options?: { actorRole?: "student" | "guardian" | "institution" | "counsellor"; guardianEmail?: string; collegeCode?: string }
  ): Promise<SessionRecord[]> {
    const url = new URL(`${API_BASE_URL}/api/sessions`);
    url.searchParams.set("user_id", userId);
    if (options?.actorRole) {
      url.searchParams.set("actor_role", options.actorRole);
    }
    if (options?.guardianEmail) {
      url.searchParams.set("guardian_email", options.guardianEmail);
    }
    if (options?.collegeCode) {
      url.searchParams.set("college_code", options.collegeCode);
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Sessions fetch error: ${errText}`);
    }

    const data = await res.json();
    return Array.isArray(data.sessions) ? data.sessions : [];
  }

  async createNetworkConnectRequest(payload: {
    studentId: string;
    actorId: string;
    actorRole: NetworkActorRole;
    relationType?: string;
  }): Promise<NetworkConnection> {
    const res = await fetch(`${API_BASE_URL}/api/network/connect-request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        student_id: payload.studentId,
        actor_id: payload.actorId,
        actor_role: payload.actorRole,
        relation_type: payload.relationType
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Network connect error: ${errText}`);
    }

    const data = await res.json();
    return data.connection as NetworkConnection;
  }

  async updateNetworkConnectionStatus(connectionId: string, studentId: string, status: Exclude<NetworkStatus, "pending">): Promise<NetworkConnection> {
    const res = await fetch(`${API_BASE_URL}/api/network/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        connection_id: connectionId,
        student_id: studentId,
        status
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Network approve error: ${errText}`);
    }

    const data = await res.json();
    return data.connection as NetworkConnection;
  }

  async fetchNetworkConnectionsByStudent(studentId: string, statuses: NetworkStatus[] = []): Promise<NetworkConnection[]> {
    const url = new URL(`${API_BASE_URL}/api/network/my-connections`);
    url.searchParams.set("student_id", studentId);
    if (statuses.length) {
      url.searchParams.set("statuses", statuses.join(","));
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Network fetch error: ${errText}`);
    }

    const data = await res.json();
    return Array.isArray(data.connections) ? data.connections : [];
  }

  async fetchNetworkConnectionsByActor(actorId: string, actorRole: NetworkActorRole, statuses: NetworkStatus[] = []): Promise<NetworkConnection[]> {
    const url = new URL(`${API_BASE_URL}/api/network/my-connections`);
    url.searchParams.set("actor_id", actorId);
    url.searchParams.set("actor_role", actorRole);
    if (statuses.length) {
      url.searchParams.set("statuses", statuses.join(","));
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Network fetch error: ${errText}`);
    }

    const data = await res.json();
    return Array.isArray(data.connections) ? data.connections : [];
  }

  async disconnectNetworkConnection(connectionId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/network/disconnect`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ connection_id: connectionId })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Network disconnect error: ${errText}`);
    }
  }
}

export const gemini = new GeminiService();
