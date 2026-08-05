import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lib/pdf/TransactionReportDocument.tsx reads its embedded font (a Turkish-
  // safe DejaVu Sans, not the PDF spec's Helvetica — see that file's header
  // comment for why) from lib/pdf/fonts/*.ttf via a plain fs path at request
  // time. Next's file-tracing usually finds a fs.readFileSync call like that
  // on its own, but a non-code asset a route depends on is exactly the case
  // the tracer sometimes misses — and a font missing only in a serverless
  // deployment (never locally, where the whole repo is on disk) is a
  // confusing way to find that out. Naming it here makes it explicit instead
  // of relying on static analysis to succeed.
  outputFileTracingIncludes: {
    "/api/export/transactions-pdf": ["./lib/pdf/fonts/**"],
  },
};

export default nextConfig;
