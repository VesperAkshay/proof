import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import * as schema from "./schema";

// Ensure WebSocket constructor is set if running in specific serverless runtimes
if (typeof WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = WebSocket;
}

const connectionString =
  process.env.DATABASE_POOL_URL || process.env.DATABASE_URL || "";

const pool = new Pool({ connectionString });

export const db = drizzle(pool, { schema });
export { schema };
