import type { MetadataRoute } from "next";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { users, proofs } from "@/db/schema";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://proof.so";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
  ];

  try {
    // 1. Active user profiles
    const activeUsers = await db
      .select({
        username: users.username,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.status, "active"));

    for (const user of activeUsers) {
      routes.push({
        url: `${BASE_URL}/@${user.username}`,
        lastModified: user.updatedAt,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }

    // 2. Published & public proofs (exclude private, unlisted, DRAFT, ARCHIVED)
    const publishedProofs = await db
      .select({
        slug: proofs.slug,
        username: users.username,
        updatedAt: proofs.updatedAt,
      })
      .from(proofs)
      .innerJoin(users, eq(proofs.userId, users.id))
      .where(
        and(
          eq(users.status, "active"),
          eq(proofs.lifecycleState, "PUBLISHED"),
          eq(proofs.visibility, "public")
        )
      );

    for (const proof of publishedProofs) {
      routes.push({
        url: `${BASE_URL}/@${proof.username}/${proof.slug}`,
        lastModified: proof.updatedAt,
        changeFrequency: "weekly",
        priority: 0.9,
      });
    }
  } catch (error) {
    console.error("Failed to generate sitemap entries:", error);
  }

  return routes;
}
