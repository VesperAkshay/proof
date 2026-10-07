import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required").optional(),
  DATABASE_POOL_URL: z.string().min(1).optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET_NAME: z.string().default("proof-assets"),
  R2_QUARANTINE_BUCKET_NAME: z.string().default("proof-quarantine"),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates environment variables at application boot.
 * Enforces fail-fast behavior if required secrets or configurations are missing.
 */
export function validateEnv(env: Record<string, string | undefined> = process.env): {
  isValid: boolean;
  config: EnvConfig;
  errors?: string[];
} {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    return {
      isValid: false,
      config: envSchema.parse({}),
      errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
    };
  }

  // In production, enforce strict presence of critical infrastructure secrets
  if (result.data.NODE_ENV === "production") {
    const missing: string[] = [];
    if (!env.DATABASE_URL) missing.push("DATABASE_URL");
    if (!env.CLERK_SECRET_KEY) missing.push("CLERK_SECRET_KEY");
    if (!env.R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");

    if (missing.length > 0) {
      return {
        isValid: false,
        config: result.data,
        errors: missing.map((key) => `Missing required production secret: ${key}`),
      };
    }
  }

  return {
    isValid: true,
    config: result.data,
  };
}
