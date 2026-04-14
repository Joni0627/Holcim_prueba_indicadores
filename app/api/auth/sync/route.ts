import { clerkClient, auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    // If user already has a role, no need to sync
    if ((user.publicMetadata as { role?: string })?.role) {
      return NextResponse.json({ success: true, alreadyHasRole: true });
    }

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!userEmail) {
      return NextResponse.json({ error: "User has no email" }, { status: 400 });
    }

    // List invitations to see if there's a pending one for this email
    const invitations = await client.invitations.getInvitationList();
    const pendingInvitation = invitations.find(
      (inv) => inv.emailAddress.toLowerCase() === userEmail.toLowerCase() && inv.status === "pending"
    );

    if (pendingInvitation) {
      // Update user metadata to 'user' role
      await client.users.updateUser(userId, {
        publicMetadata: {
          ...user.publicMetadata,
          role: "user",
        },
      });

      // Optionally revoke the invitation since it's now "accepted" manually
      try {
        await client.invitations.revokeInvitation(pendingInvitation.id);
      } catch (e) {
        console.error("Failed to revoke invitation:", e);
      }

      return NextResponse.json({ success: true, updated: true });
    }

    return NextResponse.json({ success: false, message: "No pending invitation found" });
  } catch (error) {
    console.error("Error in auth sync:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
