import { NextRequest, NextResponse } from "next/server";
import { getPublicProof } from "@/services/proof";
import { generateQrCodeSvg, getCanonicalProofQrUrl } from "@/services/sharing";

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
    return new NextResponse("Proof not found", {
      status: 404,
      headers: {
        "X-Robots-Tag": "noindex, nofollow",
        "Content-Type": "text/plain",
      },
    });
  }

  if (result.isRedirect) {
    return NextResponse.redirect(new URL(`${result.redirectTo}/qr.svg`, req.url), 301);
  }

  const canonicalUrl = getCanonicalProofQrUrl(result.user.username, result.proof.slug);
  const svg = await generateQrCodeSvg(canonicalUrl);

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
