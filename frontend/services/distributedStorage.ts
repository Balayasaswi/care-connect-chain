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
  storedAt: string;
};

const REPLICA_INDEX_KEY = 'care-connect:replica-index:v1';
const HELIA_BLOCKSTORE_NAME = 'care-connect-helia-blockstore';

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

export async function storeSessionReplicaOnDevice(payload: SessionReplicaPayload): Promise<LocalReplicaInfo> {
  const storedAt = new Date().toISOString();
  const storageKey = `care-connect:session:${payload.userId}:${payload.sessionId}`;

  const envelope = {
    ...payload,
    replica: {
      storedAt,
      source: 'browser'
    }
  };

  if (canUseBrowserStorage()) {
    window.localStorage.setItem(storageKey, JSON.stringify(envelope));
  }

  let localCid: string | undefined;
  let status: LocalReplicaInfo['status'] = 'device-only';
  let error: string | undefined;

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
    }
  } catch (heliaError) {
    error = heliaError instanceof Error ? heliaError.message : 'Unknown local IPFS error';
    status = 'device-only';
  }

  upsertReplicaIndex({
    sessionId: payload.sessionId,
    userId: payload.userId,
    storageKey,
    localCid,
    status,
    storedAt
  });

  return {
    storageKey,
    localCid,
    storedAt,
    status,
    error
  };
}
