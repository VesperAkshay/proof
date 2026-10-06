import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import path from "node:path";

export async function runMigrations(connectionStringOverride?: string) {
  const connectionString = connectionStringOverride || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const pool = new pg.Pool({ connectionString, max: 1 });
  const db = drizzle(pool);

  try {
    const migrationsFolder = path.resolve(process.cwd(), "src/db/migrations");
    console.log(`⚡ Running migrations from: ${migrationsFolder}`);
    await migrate(db, { migrationsFolder });
    console.log("✓ Database migrations executed successfully.");
  } finally {
    await pool.end();
  }
}

// Execute directly if run as main script
if (process.argv[1]?.endsWith("migrate.ts") || process.argv[1]?.endsWith("migrate.js")) {
  runMigrations()
    .then(() => {
      console.log("Done.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Migration error:", err);
      process.exit(1);
    });
}
