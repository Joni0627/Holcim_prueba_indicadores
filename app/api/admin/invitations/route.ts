import { clerkClient } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId, sessionClaims } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const role = (sessionClaims?.publicMetadata as { role?: string })?.role;
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
    const isOwner = primaryEmail === "joni0627@gmail.com";

    if (role !== "admin" && !isOwner) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Fetch pending invitations from Clerk
    const invitations = await client.invitations.getInvitationList({
      status: "pending",
    });

    const simplifiedInvitations = invitations.data.map(inv => ({
      id: inv.id,
      email: inv.emailAddress,
      createdAt: inv.createdAt,
      status: inv.status,
    }));

    return NextResponse.json(simplifiedInvitations);
  } catch (error: any) {
    console.error("[INVITATIONS_GET_ERROR]", error);
    return new NextResponse(error.message || "Internal Error", { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId, sessionClaims } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const role = (sessionClaims?.publicMetadata as { role?: string })?.role;
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
    const isOwner = primaryEmail === "joni0627@gmail.com";

    if (role !== "admin" && !isOwner) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const invitationId = searchParams.get("invitationId");

    if (!invitationId) {
      return new NextResponse("Missing invitationId", { status: 400 });
    }

    await client.invitations.revokeInvitation(invitationId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[INVITATION_REVOKE_ERROR]", error);
    return new NextResponse(error.message || "Internal Error", { status: 500 });
  }
}
