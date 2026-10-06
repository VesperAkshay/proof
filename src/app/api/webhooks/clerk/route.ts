import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("CLERK_WEBHOOK_SECRET is not configured.");
    return NextResponse.json(
      { error: "Webhook secret missing on server." },
      { status: 500 }
    );
  }

  // Retrieve Svix headers
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing required Svix headers." },
      { status: 400 }
    );
  }

  const payload = await req.text();
  const wh = new Webhook(webhookSecret);
  let evt: { type: string; data: { id?: string } };

  try {
    evt = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as unknown as { type: string; data: { id?: string } };
  } catch (err) {
    console.error("Error verifying webhook signature:", err);
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 400 }
    );
  }

  const eventType = evt.type;
  console.log(`Received Clerk webhook: ${eventType}`);

  if (eventType === "user.deleted") {
    const deletedAuthUserId = evt.data.id;
    if (deletedAuthUserId) {
      await db
        .update(users)
        .set({ status: "deleted", updatedAt: new Date() })
        .where(eq(users.authUserId, deletedAuthUserId));
      console.log(`Marked user status as deleted for authUserId: ${deletedAuthUserId}`);
    }
  }

  return NextResponse.json({ success: true });
}
