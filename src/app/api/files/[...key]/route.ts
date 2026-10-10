import { NextResponse, type NextRequest } from "next/server";
import { getAuthNid, getFile } from "@/lib/data/repo";

export const runtime = "nodejs";

/** Serves the signed-in nutritionist's uploaded files (logo, PDF templates). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  if (!(await getAuthNid())) return new NextResponse("Unauthorized", { status: 401 });
  const { key } = await params;
  const file = await getFile(key.map(decodeURIComponent).join("/"));
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": "inline",
    },
  });
}
