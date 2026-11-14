// Minimal declarations for the Node built-ins used by test/math/coverage-report.test.ts
// (the core package has no @types/node; tests run under Node via vitest).
declare module "node:fs" {
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function writeFileSync(path: string, data: string): void;
}
declare module "node:path" {
  export function dirname(path: string): string;
  export function resolve(...parts: string[]): string;
}
declare module "node:url" {
  export function fileURLToPath(url: string): string;
}
interface ImportMeta {
  url: string;
}
