/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CID_CONTRACT_ADDRESS?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_LOCAL_IPFS_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
