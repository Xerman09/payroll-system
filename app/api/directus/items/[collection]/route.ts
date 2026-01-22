// app/api/directus/items/[collection]/route.ts
import { NextRequest } from "next/server";
import { directusProxyRequest } from "@/lib/directus/server";

export const dynamic = "force-dynamic";

function getSearch(req: NextRequest): string {
  const url = new URL(req.url);
  return url.search; // includes leading "?"
}

async function handle(req: NextRequest, params: { collection: string }) {
  const bodyText = req.method === "GET" || req.method === "HEAD" ? null : await req.text().catch(() => null);

  return directusProxyRequest({
    collection: params.collection,
    method: req.method,
    search: getSearch(req),
    bodyText,
    contentType: req.headers.get("content-type"),
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ collection: string }> }) {
  const params = await ctx.params;
  return handle(req, params);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ collection: string }> }) {
  const params = await ctx.params;
  return handle(req, params);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ collection: string }> }) {
  const params = await ctx.params;
  return handle(req, params);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ collection: string }> }) {
  const params = await ctx.params;
  return handle(req, params);
}
