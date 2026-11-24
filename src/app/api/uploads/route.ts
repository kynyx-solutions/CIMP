// Direct upload to file storage (S3 only), step 1.
//   POST { purpose, name, size } → { direct: true, url, contentType, ticket }   PUT the file to url,
//        then send { …fields, upload: ticket } as JSON to the usual upload route.
//        → { direct: false } when files are stored locally: send the multipart form as before.
// The route that receives the ticket checks access, the size and the file's bytes.
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { isUploadPurpose, type UploadPurpose } from "@/lib/documents";
import { canRequestFinance } from "@/lib/finance";
import { directUploads } from "@/lib/storage";
import { createTicket } from "@/lib/uploads";
import { limitRequest } from "@/lib/ratelimit";

const mayUpload = (role: string, purpose: UploadPurpose) => (purpose === "invoice" ? canRequestFinance(role) : role === "incubatee");

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!isUploadPurpose(body.purpose) || typeof body.name !== "string" || typeof body.size !== "number")
    return NextResponse.json({ error: "purpose, name and size are required" }, { status: 400 });
  if (!mayUpload(user.role, body.purpose)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!directUploads()) return NextResponse.json({ direct: false });

  const limited = limitRequest(req, [{ key: `upload:${user.userId}`, limit: 40, windowMs: 3600000 }], "uploads");
  if (limited) return limited;
  const t = await createTicket(user.userId, body.purpose, body.name.slice(0, 200), body.size);
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 400 });
  return NextResponse.json({ direct: true, ...t });
}
