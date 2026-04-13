import { clerkClient } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { userId, sessionClaims } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const role = (user.publicMetadata as { role?: string })?.role;
    const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
    const isOwner = primaryEmail === "joni0627@gmail.com";

    if (role !== "admin" && !isOwner) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const { email } = await req.json();

    if (!email) {
      return new NextResponse("Email is required", { status: 400 });
    }

    const host = req.headers.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const origin = req.headers.get('origin') || `${protocol}://${host}`;

    console.log(`[INVITE] Creating invitation for ${email} from origin ${origin}`);

    // Check for existing pending invitations for this email and revoke them
    const existingInvitations = await client.invitations.getInvitationList({
      status: "pending",
    });
    
    const pendingInv = existingInvitations.data.find(inv => inv.emailAddress === email);
    if (pendingInv) {
      console.log(`[INVITE] Revoking existing pending invitation ${pendingInv.id} for ${email}`);
      await client.invitations.revokeInvitation(pendingInv.id);
    }

    // Create the invitation using Clerk Backend SDK
    const invitation = await client.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${origin}/sign-up`, 
      publicMetadata: {
        role: "user", 
      },
      ignoreExisting: true, 
    });

    console.log(`[INVITE] Invitation created: ${invitation.id}`);
    return NextResponse.json(invitation);
  } catch (error: any) {
    console.error("[INVITATION_ERROR]", error);
    return new NextResponse(error.message || "Internal Error", { status: 500 });
  }
}
