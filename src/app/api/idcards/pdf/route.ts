// ID card PDF: the holder (own card) or Admin IT / CEO (?userId=).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isId } from "@/lib/serialize";
import { cardPdf } from "@/lib/idcard";
import { pdfResponse } from "@/lib/pdf";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const asked = req.nextUrl.searchParams.get("userId");
  const userId = asked && ["admin_it", "ceo"].includes(user.role) && isId(asked) ? asked : user.userId;
  const card = await prisma.idCard.findUnique({ where: { userId } });
  if (!card) return NextResponse.json({ error: "No ID card has been issued" }, { status: 404 });
  const bytes = await cardPdf(card.number);
  if (!bytes) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return pdfResponse(bytes, `CIMP-BIIF-ID-${card.number}.pdf`, true);
}
