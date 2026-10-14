/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_IS_SCANNER_V2_PREVIEW?: string;
  readonly VITE_API_BASE?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
