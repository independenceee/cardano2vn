import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { authOptions } from "~/app/api/auth/[...nextauth]/route";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const address = (session?.user as { address?: string })?.address;
  if (!session?.user || !address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { postId, type } = await req.json();
  if (!postId || !type) {
    return NextResponse.json({ error: "Missing postId or type" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { wallet: address } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.reaction.deleteMany({
    where: {
      userId: user.id,
      postId,
    },
  });

  await prisma.reaction.create({
    data: {
      userId: user.id,
      postId,
      type,
    },
  });

  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get("postId");
  if (!postId) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }

  const me = req.nextUrl.searchParams.get("me");
  if (me === "1") {
    const session = await getServerSession(authOptions);
    const address = (session?.user as { address?: string })?.address;
    if (!session?.user || !address) {
      return NextResponse.json({ currentUserReaction: null });
    }
    const user = await prisma.user.findUnique({ where: { wallet: address } });
    if (!user) {
      return NextResponse.json({ currentUserReaction: null });
    }
    const reaction = await prisma.reaction.findFirst({
      where: { userId: user.id, postId },
      select: { type: true },
    });
    return NextResponse.json({ currentUserReaction: reaction?.type || null });
  }

  const reactions = await prisma.reaction.findMany({
    where: { postId },
    select: { type: true },
  });
  const counts: { [type: string]: number } = {};
  reactions.forEach(r => {
    counts[r.type] = (counts[r.type] || 0) + 1;
  });
  return NextResponse.json({ reactions: counts });
} 