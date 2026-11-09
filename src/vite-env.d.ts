/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ARCLEND_ADDRESS: string
  readonly VITE_ARCLEND_DEPLOY_BLOCK: string
  readonly VITE_EURC_ADDRESS: string
  readonly VITE_CIRBTC_ADDRESS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
