/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TENCENT_APP_ID: string
  readonly VITE_TENCENT_LICENSE_KEY: string
  readonly VITE_TENCENT_SECRET_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
