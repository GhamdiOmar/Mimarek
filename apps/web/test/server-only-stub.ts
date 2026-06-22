// `server-only` is a Next.js client/server boundary marker that throws if imported into a
// client bundle. In the node-based vitest environment it has no meaning, so server-only libs
// (e.g. lib/buyer-routing.ts) are aliased to this empty module — see vitest.config.ts.
export {};
