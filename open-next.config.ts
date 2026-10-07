/**
 * OpenNext Cloudflare Configuration
 *
 * NOTE (Cloudflare Deployment / Option B):
 * Proof is deployed to Cloudflare Workers using @opennextjs/cloudflare.
 * This adapter compiles Next.js 15 App Router server logic into a Cloudflare Worker
 * and bundles static assets into `.open-next/assets`.
 *
 * Why this is necessary:
 * 1. Resolves Cloudflare Pages 25 MiB file upload limit:
 *    Next.js creates Webpack server cache files (.next/cache/.../0.pack ~80 MiB)
 *    which cause raw Cloudflare Pages deployments to fail. OpenNext isolates
 *    only required static assets in `.open-next/assets` and strips cache packs.
 * 2. Full-stack edge execution:
 *    Enables full App Router SSR, Clerk auth middleware, Neon PostgreSQL queries,
 *    and API route execution on Cloudflare's global edge network.
 */
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
