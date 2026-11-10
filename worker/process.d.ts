// lib/cms/defaults.ts reads process.env when it runs in Next, and checks `typeof process` first. The Worker runs
// without Node's `process`, so to TypeScript it is only possibly there.
declare var process: { env: Record<string, string | undefined> } | undefined;
