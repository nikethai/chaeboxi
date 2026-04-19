import 'i18next'

declare module 'i18next' {
  interface CustomTypeOptions {
    returnNull: false
  }
}

declare module 'core-js/actual'

declare global {
  interface File {
    path?: string
  }
}
