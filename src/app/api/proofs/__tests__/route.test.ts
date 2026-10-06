/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as listProofsRoute, POST as createProofRoute } from "../route";
import { PATCH as updateProofRoute } from "../[id]/route";
import { POST as publishProofRoute } from "../[id]/publish/route";
import * as identityService from "@/services/identity";
import * as proofService from "@/services/proof";
import * as clerkNextjs from "@clerk/nextjs/server";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/services/identity", () => ({
  getProfileByAuthUserId: vi.fn(),
}));

vi.mock("@/services/proof", () => ({
  createProof: vi.fn(),
  listProofsForUser: vi.fn(),
  updateProof: vi.fn(),
  transitionLifecycle: vi.fn(),
  ProofError: class ProofError extends Error {
    code: string;
    statusCode: number;
    suggestions?: string[];
    constructor(code: string, statusCode: number, message: string, suggestions?: string[]) {
      super(message);
      this.name = "ProofError";
      this.code = code;
      this.statusCode = statusCode;
      this.suggestions = suggestions;
    }
  },
}));

describe("Proof API Routes & Anti-Mass-Assignment (M4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication Barriers", () => {
    it("returns 401 UNAUTHORIZED when no auth token is present", async () => {
      vi.mocked(clerkNextjs.auth).mockResolvedValue({ userId: null } as any);

      const res = await listProofsRoute();
      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 404 NOT_FOUND when user has not claimed a handle", async () => {
      vi.mocked(clerkNextjs.auth).mockResolvedValue({ userId: "clerk_123" } as any);
      vi.mocked(identityService.getProfileByAuthUserId).mockResolvedValue(null);

      const res = await listProofsRoute();
      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error.code).toBe("NOT_FOUND");
    });
  });

  describe("POST /api/proofs (Anti-Mass-Assignment)", () => {
    beforeEach(() => {
      vi.mocked(clerkNextjs.auth).mockResolvedValue({ userId: "clerk_123" } as any);
      vi.mocked(identityService.getProfileByAuthUserId).mockResolvedValue({
        id: "user-123",
        username: "akshay",
        usernameNormalized: "akshay",
      } as any);
    });

    it("rejects unknown and protected fields (verificationStatus, lifecycleState, userId)", async () => {
      // Attempt mass assignment by passing forbidden fields
      const maliciousBody = {
        title: "Malicious Fake Cert",
        proofType: "certificate",
        verificationStatus: "ISSUER_VERIFIED", // Protected field
        lifecycleState: "PUBLISHED",          // Protected field
        userId: "hacked-user-id",             // Server derived
      };

      const req = new NextRequest("http://localhost:3000/api/proofs", {
        method: "POST",
        body: JSON.stringify(maliciousBody),
        headers: { "Content-Type": "application/json" },
      });

      const res = await createProofRoute(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error.code).toBe("VALIDATION_ERROR");
      expect(proofService.createProof).not.toHaveBeenCalled();
    });

    it("creates proof successfully with valid schema input", async () => {
      const validBody = {
        title: "AWS Solutions Architect",
        proofType: "certificate",
        description: "Official AWS certification",
        visibility: "public",
      };

      vi.mocked(proofService.createProof).mockResolvedValue({
        id: "proof-123",
        userId: "user-123",
        slug: "aws-solutions-architect",
        title: "AWS Solutions Architect",
        lifecycleState: "DRAFT",
        verificationStatus: "SELF_REPORTED",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/proofs", {
        method: "POST",
        body: JSON.stringify(validBody),
        headers: { "Content-Type": "application/json" },
      });

      const res = await createProofRoute(req);
      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data.proof.id).toBe("proof-123");
      expect(data.proof.lifecycleState).toBe("DRAFT");
      expect(proofService.createProof).toHaveBeenCalledWith("user-123", expect.objectContaining(validBody));
    });
  });

  describe("PATCH /api/proofs/:id (Anti-Mass-Assignment)", () => {
    beforeEach(() => {
      vi.mocked(clerkNextjs.auth).mockResolvedValue({ userId: "clerk_123" } as any);
      vi.mocked(identityService.getProfileByAuthUserId).mockResolvedValue({
        id: "user-123",
        username: "akshay",
      } as any);
    });

    it("rejects attempt to modify verificationStatus directly via update endpoint", async () => {
      const maliciousBody = {
        verificationStatus: "ISSUER_VERIFIED",
      };

      const req = new NextRequest("http://localhost:3000/api/proofs/proof-123", {
        method: "PATCH",
        body: JSON.stringify(maliciousBody),
        headers: { "Content-Type": "application/json" },
      });

      const res = await updateProofRoute(req, {
        params: Promise.resolve({ id: "proof-123" }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe("VALIDATION_ERROR");
      expect(proofService.updateProof).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/proofs/:id/publish", () => {
    it("successfully publishes proof for owner", async () => {
      vi.mocked(clerkNextjs.auth).mockResolvedValue({ userId: "clerk_123" } as any);
      vi.mocked(identityService.getProfileByAuthUserId).mockResolvedValue({
        id: "user-123",
        username: "akshay",
      } as any);

      vi.mocked(proofService.transitionLifecycle).mockResolvedValue({
        id: "proof-123",
        lifecycleState: "PUBLISHED",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/proofs/proof-123/publish", {
        method: "POST",
      });

      const res = await publishProofRoute(req, {
        params: Promise.resolve({ id: "proof-123" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.proof.lifecycleState).toBe("PUBLISHED");
      expect(proofService.transitionLifecycle).toHaveBeenCalledWith(
        "proof-123",
        "user-123",
        "PUBLISHED"
      );
    });
  });
});
