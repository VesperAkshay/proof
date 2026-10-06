import pg from "pg";
import fs from "node:fs";
import path from "node:path";

export async function runRollback(connectionStringOverride?: string) {
  const connectionString = connectionStringOverride || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const pool = new pg.Pool({ connectionString, max: 1 });
  const client = await pool.connect();

  try {
    const downMigrationPath = path.resolve(
      process.cwd(),
      "src/db/migrations/0000_goofy_next_avengers_down.sql"
    );

    if (!fs.existsSync(downMigrationPath)) {
      throw new Error(`Down migration file not found: ${downMigrationPath}`);
    }

    const sqlContent = fs.readFileSync(downMigrationPath, "utf-8");

    console.log("⚡ Executing rollback (down migration)...");
    await client.query("BEGIN");
    await client.query(sqlContent);
    await client.query("COMMIT");
    console.log("✓ Down migration executed successfully. All tables dropped.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Rollback failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Execute directly if run as main script
if (process.argv[1]?.endsWith("rollback.ts") || process.argv[1]?.endsWith("rollback.js")) {
  runRollback()
    .then(() => {
      console.log("Rollback completed.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Rollback error:", err);
      process.exit(1);
    });
}
