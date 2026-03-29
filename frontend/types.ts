
export type Emotion = 'CRITICAL' | 'BAD' | 'NEUTRAL' | 'GOOD' | 'HAPPY';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SessionSummary {
  userid: string;
  start_time_stamp: string;
  end_time_stamp: string;
  keywords: string[];
  emotion: Emotion;
  summary: string;
}

export interface IpfsPinInfo {
  cid: string;
  uri: string;
  gatewayUrl: string;
  pinnedAt: string;
}

export interface OnChainRecord {
  txHash: string;
  chainId: number;
  contractAddress: string;
  storedAt: string;
}

export interface SessionRecord {
  id: string;
  summary: SessionSummary;
  history: ChatMessage[];
  status: 'active' | 'completed';
  ipfs?: IpfsPinInfo;
  onChain?: OnChainRecord;
}

export type UserRole = 'student' | 'guardian' | 'counsellor' | 'institution';

export interface User {
  id: string;
  email: string;
  username?: string;
  role: UserRole;
  name?: string;
  studentEmail?: string;
  studentId?: string;
  organization?: string;      // For counsellors
  institutionName?: string;   // For institutions
  collegeCode?: string;       // For institutions (login identifier)
  crrNumber?: string;         // For counsellors
}

export interface CounsellorStudent {
  id: string;
  username: string;
  email: string;
}

export type NetworkActorRole = 'student' | 'guardian' | 'counsellor' | 'institution';
export type NetworkStatus = 'pending' | 'active' | 'rejected' | 'blocked';

export interface NetworkConnection {
  id: string;
  student_id: string;
  actor_id: string;
  actor_role: NetworkActorRole;
  relation_type?: string;
  status: NetworkStatus;
  created_at: string;
  updated_at: string;
}
