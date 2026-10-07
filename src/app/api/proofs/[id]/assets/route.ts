import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { proofs, assets, proofAssets } from "@/db/schema";
import { getProfileByAuthUserId } from "@/services/identity";
import { apiError, apiSuccess } from "@/lib/api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return apiError("UNAUTHORIZED", "Authentication required.", 401);
    }

    const user = await getProfileByAuthUserId(authUserId);
    if (!user) {
      return apiError("NOT_FOUND", "Profile not found.", 404);
    }

    const { id: proofId } = await params;

    const [proof] = await db
      .select()
      .from(proofs)
      .where(and(eq(proofs.id, proofId), eq(proofs.userId, user.id)))
      .limit(1);

    if (!proof) {
      return apiError("NOT_FOUND", "Proof not found or access denied.", 404);
    }

    const body = await req.json().catch(() => ({}));
    const { assetId, role = "evidence" } = body;

    if (!assetId || typeof assetId !== "string") {
      return apiError("VALIDATION_ERROR", "Field 'assetId' is required.", 400);
    }

    const [asset] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.id, assetId), eq(assets.ownerId, user.id)))
      .limit(1);

    if (!asset) {
      return apiError("NOT_FOUND", "Asset not found or access denied.", 404);
    }

    await db
      .insert(proofAssets)
      .values({
        proofId,
        assetId,
        role: role === "cover" ? "cover" : "evidence",
        sortOrder: 0,
      })
      .onConflictDoNothing();

    if (proof.verificationStatus === "SELF_REPORTED") {
      await db
        .update(proofs)
        .set({
          verificationStatus: "DOCUMENT_UPLOADED",
          updatedAt: new Date(),
        })
        .where(eq(proofs.id, proofId));
    }

    return apiSuccess({ success: true, assetId, proofId });
  } catch (error: unknown) {
    console.error("Attach proof asset error:", error);
    return apiError("INTERNAL_ERROR", "Failed to attach asset to proof.", 500);
  }
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return apiError("UNAUTHORIZED", "Authentication required.", 401);
    }

    const user = await getProfileByAuthUserId(authUserId);
    if (!user) {
      return apiError("NOT_FOUND", "Profile not found.", 404);
    }

    const { id: proofId } = await params;

    const attached = await db
      .select({
        proofAsset: proofAssets,
        asset: assets,
      })
      .from(proofAssets)
      .innerJoin(assets, eq(proofAssets.assetId, assets.id))
      .where(and(eq(proofAssets.proofId, proofId), eq(assets.ownerId, user.id)));

    return apiSuccess({
      assets: attached.map(({ proofAsset, asset }) => ({
        id: asset.id,
        role: proofAsset.role,
        filename: asset.originalFilename,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        status: asset.status,
      })),
    });
  } catch (error: unknown) {
    console.error("Get proof assets error:", error);
    return apiError("INTERNAL_ERROR", "Failed to retrieve proof assets.", 500);
  }
}
