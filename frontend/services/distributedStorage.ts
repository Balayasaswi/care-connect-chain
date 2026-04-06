import { ChatMessage, LocalReplicaInfo } from '../types.ts';

type SessionReplicaSummary = {
  userid?: string;
  start_time_stamp?: string;
  end_time_stamp?: string;
  keywords?: string[];
  emotion?: string;
  summary?: string;
  [key: string]: unknown;
};

type SessionReplicaPayload = {
  sessionId: string;
  userId: string;
  summary: SessionReplicaSummary;
  history: ChatMessage[];
  pinnedAt: string;
};

type ReplicaIndexEntry = {
  sessionId: string;
  userId: string;
  storageKey: string;
  localCid?: string;
  status: LocalReplicaInfo['status'];
  mode?: NonNullable<LocalReplicaInfo['mode']>;
  storedAt: string;
};

const REPLICA_INDEX_KEY = 'care-connect:replica-index:v1';
const HELIA_BLOCKSTORE_NAME = 'care-connect-helia-blockstore';
const LOCAL_KUBO_API_BASE = String(
  import.meta.env.VITE_LOCAL_IPFS_API_BASE || 'http://127.0.0.1:5001/api/v0',
)
  .trim()
  .replace(/\/$/, '');

type HeliaNode = unknown;
type UnixFsAddApi = {
  addBytes: (bytes: Uint8Array) => Promise<{ toString: () => string } | string>;
};

let heliaNodePromise: Promise<HeliaNode | null> | null = null;

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readReplicaIndex(): ReplicaIndexEntry[] {
  if (!canUseBrowserStorage()) return [];

  try {
    const raw = window.localStorage.getItem(REPLICA_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeReplicaIndex(entries: ReplicaIndexEntry[]) {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(REPLICA_INDEX_KEY, JSON.stringify(entries));
}

function upsertReplicaIndex(entry: ReplicaIndexEntry) {
  const current = readReplicaIndex();
  const filtered = current.filter((item) => item.storageKey !== entry.storageKey);
  writeReplicaIndex([entry, ...filtered].slice(0, 200));
}

function parseKuboAddResponse(rawText: string): string | null {
  const lines = String(rawText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const parsed = JSON.parse(lines[i]);
      if (parsed?.Hash) {
        return String(parsed.Hash);
      }
    } catch {
      // ignore malformed lines
    }
  }

  return null;
}

async function addToLocalKubo(envelope: unknown): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const formData = new FormData();
  formData.append(
    'file',
    new Blob([JSON.stringify(envelope)], { type: 'application/json' }),
    'session.json',
  );

  const endpoint = new URL(`${LOCAL_KUBO_API_BASE}/add`);
  endpoint.searchParams.set('pin', 'true');
  endpoint.searchParams.set('cid-version', '1');

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    return null;
  }

  const rawText = await response.text();
  return parseKuboAddResponse(rawText);
}

async function getHeliaNode(): Promise<HeliaNode | null> {
  if (typeof window === 'undefined') return null;

  if (!heliaNodePromise) {
    heliaNodePromise = (async () => {
      try {
        // @ts-ignore Runtime dependency installed in frontend package.
        const blockstoreModule = await import('blockstore-idb');
        // @ts-ignore Runtime dependency installed in frontend package.
        const heliaModule = await import('helia');
        const blockstore = new blockstoreModule.IDBBlockstore(HELIA_BLOCKSTORE_NAME);
        await blockstore.open();
        return heliaModule.createHelia({ blockstore });
      } catch (error) {
        console.warn('Helia initialization failed, using device-only replica:', error);
        return null;
      }
    })();
  }

  return heliaNodePromise;
}

export async function storeSessionReplicaOnDevice(
  payload: SessionReplicaPayload,
): Promise<LocalReplicaInfo> {
  const storedAt = new Date().toISOString();
  const storageKey = `care-connect:session:${payload.userId}:${payload.sessionId}`;

  const envelope = {
    ...payload,
    replica: {
      storedAt,
      source: 'browser',
    },
  };

  if (canUseBrowserStorage()) {
    window.localStorage.setItem(storageKey, JSON.stringify(envelope));
  }

  let localCid: string | undefined;
  let status: LocalReplicaInfo['status'] = 'device-only';
  let mode: NonNullable<LocalReplicaInfo['mode']> = 'device-only';
  let error: string | undefined;

  try {
    const kuboCid = await addToLocalKubo(envelope);
    if (kuboCid) {
      localCid = kuboCid;
      status = 'ipfs+device';
      mode = 'kubo';
    }
  } catch (kuboError) {
    error = kuboError instanceof Error ? kuboError.message : 'Unknown local Kubo error';
  }

  if (!localCid) {
    try {
      const helia = await getHeliaNode();
      if (helia) {
        // @ts-ignore Runtime dependency installed in frontend package.
        const unixfsModule = await import('@helia/unixfs');
        const fs = unixfsModule.unixfs(helia) as UnixFsAddApi;
        const bytes = new TextEncoder().encode(JSON.stringify(envelope));
        const cid = await fs.addBytes(bytes);
        localCid = typeof cid === 'string' ? cid : cid.toString();
        status = 'ipfs+device';
        mode = 'helia';
      }
    } catch (heliaError) {
      const heliaMessage =
        heliaError instanceof Error ? heliaError.message : 'Unknown local IPFS error';
      error = error ? `${error}; ${heliaMessage}` : heliaMessage;
      status = 'device-only';
    }
  }

  upsertReplicaIndex({
    sessionId: payload.sessionId,
    userId: payload.userId,
    storageKey,
    localCid,
    status,
    mode,
    storedAt,
  });

  return {
    storageKey,
    localCid,
    storedAt,
    status,
    mode,
    error,
  };
}
