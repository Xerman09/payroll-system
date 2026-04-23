import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders } from "@/lib/api-helper";

/**
 * Proxy route for Directus assets.
 * This ensures assets are fetched from the correct company instance
 * based on the active session/cookie.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const config = await resolveApiConfig();
    
    if (!config) {
      return new NextResponse("Not Found: Company not selected", { status: 404 });
    }

    const directusUrl = config.apiBase.replace(/\/+$/, "");
    const assetUrl = `${directusUrl}/assets/${id}`;

    // Forward the request to Directus
    const res = await fetch(assetUrl, {
      method: "GET",
      headers: buildForwardHeaders(req, config),
      // Do not cache on the server side to ensure we respect company switching
      cache: 'no-store'
    });

    if (!res.ok) {
      console.error(`Asset fetch failed: ${res.status} ${res.statusText} from ${assetUrl}`);
      return new NextResponse(`Asset not found`, { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";

    // Return the binary data with appropriate headers
    return new NextResponse(res.body, {
      headers: {
        "Content-Type": contentType,
        // Browser caching for performance
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Asset proxy error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
