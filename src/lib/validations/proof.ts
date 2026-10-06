import { z } from "zod";
import { validateSlug } from "@/lib/slug";
import { sanitizeHttpsUrl } from "@/lib/urls";

export const PROOF_TYPES = [
  "certificate",
  "award",
  "achievement",
  "course_completion",
  "hackathon",
  "internship",
  "license",
  "project",
  "publication",
  "workshop",
  "custom",
] as const;

export const VISIBILITY_OPTIONS = ["private", "unlisted", "public"] as const;

export const createProofSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200, "Title must be 200 characters or fewer"),
    proofType: z.enum(PROOF_TYPES, {
      errorMap: () => ({ message: "Invalid proof type" }),
    }),
    description: z.string().max(2000, "Description must be 2000 characters or fewer").optional().nullable(),
    slug: z
      .string()
      .trim()
      .refine((val) => validateSlug(val), {
        message: "Slug must contain only lowercase letters, numbers, and single hyphens (1-80 characters)",
      })
      .optional(),
    issuerNameText: z.string().trim().max(200).optional().nullable(),
    issuerId: z.string().uuid("Invalid issuer UUID").optional().nullable(),
    issuedAt: z.string().datetime({ offset: true }).optional().nullable(),
    expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
    credentialId: z.string().trim().max(100).optional().nullable(),
    credentialUrl: z
      .string()
      .trim()
      .refine((val) => sanitizeHttpsUrl(val) !== null, {
        message: "Credential URL must be a valid https:// URL",
      })
      .optional()
      .nullable(),
    visibility: z.enum(VISIBILITY_OPTIONS).default("private"),
  })
  .strict("Unknown fields are forbidden")
  .refine(
    (data) => {
      if (data.issuedAt && data.expiresAt) {
        return new Date(data.expiresAt) > new Date(data.issuedAt);
      }
      return true;
    },
    {
      message: "Expiration date must be strictly after the issue date",
      path: ["expiresAt"],
    }
  );

export const updateProofSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    proofType: z.enum(PROOF_TYPES).optional(),
    description: z.string().max(2000).optional().nullable(),
    issuerNameText: z.string().trim().max(200).optional().nullable(),
    issuerId: z.string().uuid().optional().nullable(),
    issuedAt: z.string().datetime({ offset: true }).optional().nullable(),
    expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
    credentialId: z.string().trim().max(100).optional().nullable(),
    credentialUrl: z
      .string()
      .trim()
      .refine((val) => sanitizeHttpsUrl(val) !== null, {
        message: "Credential URL must be a valid https:// URL",
      })
      .optional()
      .nullable(),
    visibility: z.enum(VISIBILITY_OPTIONS).optional(),
  })
  .strict("Unknown fields are forbidden")
  .refine(
    (data) => {
      if (data.issuedAt && data.expiresAt) {
        return new Date(data.expiresAt) > new Date(data.issuedAt);
      }
      return true;
    },
    {
      message: "Expiration date must be strictly after the issue date",
      path: ["expiresAt"],
    }
  );

export const changeSlugSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .refine((val) => validateSlug(val), {
        message: "Slug must contain only lowercase letters, numbers, and single hyphens (1-80 characters)",
      }),
  })
  .strict("Unknown fields are forbidden");

export const reorderProofsSchema = z
  .object({
    proofIds: z
      .array(z.string().uuid("Invalid proof UUID"))
      .min(1, "At least one proof ID required"),
  })
  .strict("Unknown fields are forbidden");

export type CreateProofInput = z.infer<typeof createProofSchema>;
export type UpdateProofInput = z.infer<typeof updateProofSchema>;
export type ChangeSlugInput = z.infer<typeof changeSlugSchema>;
export type ReorderProofsInput = z.infer<typeof reorderProofsSchema>;
