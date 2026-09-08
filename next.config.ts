import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phase 12c: /api/admin/migrate reads the ./drizzle SQL files at runtime
  // (drizzle-orm's migrator). Next's serverless bundler only includes files
  // it can trace from actual require()/import calls, and raw .sql files
  // read via fs are invisible to that trace — without this they'd be
  // missing from the deployed function and every migration attempt would
  // fail with "no such file or directory" in production despite working
  // locally. See node_modules/next/dist/docs .../output.md.
  outputFileTracingIncludes: {
    "/api/admin/migrate": ["./drizzle/**/*"],
  },
};

export default nextConfig;
