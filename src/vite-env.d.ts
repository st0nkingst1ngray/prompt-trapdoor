/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional pre-fill for the private harness Worker URL (never the token). */
  readonly VITE_HARNESS_API_URL?: string
}
