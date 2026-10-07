import { z } from "zod";

export const reportReasonEnum = z.enum([
  "impersonation",
  "spam",
  "copyright",
  "fraud",
  "harassment",
  "other",
]);

export const createReportSchema = z.object({
  targetType: z.enum(["proof", "profile"], {
    required_error: "Target type must be either 'proof' or 'profile'",
  }),
  targetId: z.string().uuid("Target ID must be a valid UUID"),
  reason: reportReasonEnum,
  details: z.string().max(1000, "Details cannot exceed 1000 characters").optional().nullable(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

export const updateReportStatusSchema = z.object({
  status: z.enum(["ACTIONED", "DISMISSED"], {
    required_error: "Status must be either ACTIONED or DISMISSED",
  }),
});

export const takedownProofSchema = z.object({
  proofId: z.string().uuid("Proof ID must be a valid UUID"),
  reason: z.string().min(3, "Reason must be at least 3 characters").max(500),
});

export const suspendUserSchema = z.object({
  userId: z.string().uuid("User ID must be a valid UUID"),
  reason: z.string().min(3, "Reason must be at least 3 characters").max(500),
});

export const unsuspendUserSchema = z.object({
  userId: z.string().uuid("User ID must be a valid UUID"),
  reason: z.string().min(3, "Reason must be at least 3 characters").max(500),
});

export const restoreProofSchema = z.object({
  proofId: z.string().uuid("Proof ID must be a valid UUID"),
  reason: z.string().min(3, "Reason must be at least 3 characters").max(500),
});
