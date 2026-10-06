import { NextRequest, NextResponse } from "next/server";
import { getPublicProof } from "@/services/proof";
import { getAuthorizedDownloadUrl } from "@/services/processing";

interface RouteParams {
  params: Promise<{
    handle: string;
    slug: string;
  }>;
}

export async function GET(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { handle, slug } = await params;

  const result = await getPublicProof(handle, slug);

  if (!result) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Proof or requested evidence asset not found.",
        },
      },
      {
        status: 404,
        headers: {
          "X-Robots-Tag": "noindex, nofollow",
        },
      }
    );
  }

  if (result.isRedirect) {
    return NextResponse.redirect(new URL(`${result.redirectTo}/download`, req.url), 301);
  }

  if (!result.primaryAsset) {
    return NextResponse.json(
      {
        error: {
          code: "NO_EVIDENCE_ATTACHED",
          message: "This proof does not have an attached evidence document.",
        },
      },
      {
        status: 404,
        headers: {
          "X-Robots-Tag": "noindex, nofollow",
        },
      }
    );
  }

  try {
    const signedDownloadUrl = await getAuthorizedDownloadUrl(result.primaryAsset.id);
    return NextResponse.redirect(signedDownloadUrl, 307);
  } catch (error) {
    const status = error && typeof error === "object" && "statusCode" in error ? (error as { statusCode: number }).statusCode : 500;
    return NextResponse.json(
      {
        error: {
          code: "DOWNLOAD_FAILED",
          message: error instanceof Error ? error.message : "Failed to generate download URL",
        },
      },
      { status }
    );
  }
}
