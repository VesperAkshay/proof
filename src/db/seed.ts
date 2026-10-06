import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { reservedHandles, issuers } from "./schema";

export const CANONICAL_RESERVED_HANDLES = [
  // Authentication & account routes
  { handleNormalized: "login", reason: "System route: authentication" },
  { handleNormalized: "logout", reason: "System route: authentication" },
  { handleNormalized: "signup", reason: "System route: authentication" },
  { handleNormalized: "register", reason: "System route: authentication" },
  { handleNormalized: "auth", reason: "System route: authentication" },
  { handleNormalized: "me", reason: "System route: current user context" },
  { handleNormalized: "u", reason: "System route: internal profile rewrite" },
  { handleNormalized: "account", reason: "System route: user settings" },
  { handleNormalized: "settings", reason: "System route: user settings" },
  { handleNormalized: "profile", reason: "System route: user profile" },
  { handleNormalized: "dashboard", reason: "System route: user dashboard" },
  { handleNormalized: "admin", reason: "System route: administration" },

  // Core product routes
  { handleNormalized: "api", reason: "System route: API endpoints" },
  { handleNormalized: "proof", reason: "Brand route: core keyword" },
  { handleNormalized: "proofs", reason: "Brand route: core keyword" },
  { handleNormalized: "verify", reason: "System route: verification" },
  { handleNormalized: "verification", reason: "System route: verification" },
  { handleNormalized: "explore", reason: "System route: discovery" },
  { handleNormalized: "search", reason: "System route: search" },
  { handleNormalized: "home", reason: "System route: landing" },
  { handleNormalized: "app", reason: "System route: app shell" },

  // System & infrastructure endpoints
  { handleNormalized: "root", reason: "Reserved technical name" },
  { handleNormalized: "null", reason: "Reserved programming literal" },
  { handleNormalized: "undefined", reason: "Reserved programming literal" },
  { handleNormalized: "system", reason: "Reserved technical name" },
  { handleNormalized: "assets", reason: "System route: static asset storage" },
  { handleNormalized: "uploads", reason: "System route: file upload pipeline" },
  { handleNormalized: "static", reason: "System route: static assets" },
  { handleNormalized: "public", reason: "System route: public assets" },
  { handleNormalized: "cdn", reason: "System route: content delivery" },
  { handleNormalized: "media", reason: "System route: media assets" },
  { handleNormalized: "download", reason: "System route: file download" },
  { handleNormalized: "downloads", reason: "System route: file download" },
  { handleNormalized: "qr", reason: "System route: QR code generation" },
  { handleNormalized: "status", reason: "System route: service status" },
  { handleNormalized: "health", reason: "System route: health check" },
  { handleNormalized: "healthz", reason: "System route: liveness probe" },
  { handleNormalized: "readyz", reason: "System route: readiness probe" },

  // Brand protection & staff
  { handleNormalized: "proofso", reason: "Brand protection: proof.so" },
  { handleNormalized: "proof-so", reason: "Brand protection: proof.so" },
  { handleNormalized: "official", reason: "Protected staff/authority role" },
  { handleNormalized: "team", reason: "Protected staff role" },
  { handleNormalized: "staff", reason: "Protected staff role" },
  { handleNormalized: "moderator", reason: "Protected staff role" },
  { handleNormalized: "support", reason: "System route: customer support" },
  { handleNormalized: "help", reason: "System route: documentation and help" },
  { handleNormalized: "terms", reason: "Legal: terms of service" },
  { handleNormalized: "privacy", reason: "Legal: privacy policy" },
  { handleNormalized: "security", reason: "Security: vulnerability disclosure" },
  { handleNormalized: "about", reason: "Company: about page" },
  { handleNormalized: "blog", reason: "Company: blog" },
  { handleNormalized: "pricing", reason: "Company: pricing" },
  { handleNormalized: "docs", reason: "Company: documentation" },
  { handleNormalized: "legal", reason: "Company: legal portal" },
  { handleNormalized: "faq", reason: "Company: FAQ" },
  { handleNormalized: "contact", reason: "Company: contact portal" },
  { handleNormalized: "press", reason: "Company: press relations" },
  { handleNormalized: "careers", reason: "Company: careers" },
];

export const CANONICAL_ISSUERS = [
  {
    name: "Amazon Web Services",
    websiteUrl: "https://aws.amazon.com",
    domain: "aws.amazon.com",
    verificationMethod: "issuer_url",
    status: "active",
  },
  {
    name: "Google Cloud",
    websiteUrl: "https://cloud.google.com",
    domain: "cloud.google.com",
    verificationMethod: "issuer_url",
    status: "active",
  },
  {
    name: "Microsoft Learn",
    websiteUrl: "https://learn.microsoft.com",
    domain: "microsoft.com",
    verificationMethod: "issuer_url",
    status: "active",
  },
  {
    name: "Coursera",
    websiteUrl: "https://www.coursera.org",
    domain: "coursera.org",
    verificationMethod: "issuer_url",
    status: "active",
  },
  {
    name: "GitHub",
    websiteUrl: "https://github.com",
    domain: "github.com",
    verificationMethod: "issuer_url",
    status: "active",
  },
  {
    name: "Harvard University",
    websiteUrl: "https://harvard.edu",
    domain: "harvard.edu",
    verificationMethod: "issuer_url",
    status: "active",
  },
  {
    name: "MIT OpenCourseWare",
    websiteUrl: "https://ocw.mit.edu",
    domain: "mit.edu",
    verificationMethod: "issuer_url",
    status: "active",
  },
];

export async function seedDatabase(connectionStringOverride?: string) {
  const connectionString = connectionStringOverride || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const pool = new pg.Pool({ connectionString, max: 1 });
  const db = drizzle(pool);

  try {
    console.log("🌱 Seeding reserved handles...");
    await db
      .insert(reservedHandles)
      .values(CANONICAL_RESERVED_HANDLES)
      .onConflictDoNothing();
    console.log(`✓ Seeded ${CANONICAL_RESERVED_HANDLES.length} reserved handles.`);

    console.log("🌱 Seeding verified issuers...");
    await db
      .insert(issuers)
      .values(CANONICAL_ISSUERS)
      .onConflictDoNothing();
    console.log(`✓ Seeded ${CANONICAL_ISSUERS.length} canonical issuers.`);
  } finally {
    await pool.end();
  }
}

// Execute directly if run as main script
if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  seedDatabase()
    .then(() => {
      console.log("Seed completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Seed error:", err);
      process.exit(1);
    });
}
