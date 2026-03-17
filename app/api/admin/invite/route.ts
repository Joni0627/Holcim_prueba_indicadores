import { clerkClient } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { userId, sessionClaims } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Check if the user has the 'admin' role in publicMetadata
    const role = (sessionClaims?.publicMetadata as { role?: string })?.role;
    
    // Get user details to check email (bootstrapping admin)
    const user = await clerkClient.users.getUser(userId);
    const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
    const isOwner = primaryEmail === "joni0627@gmail.com";

    if (role !== "admin" && !isOwner) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const { email } = await req.json();

    if (!email) {
      return new NextResponse("Email is required", { status: 400 });
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || "";
    const signUpUrl = `${origin}/sign-up`;

    // Create the invitation using Clerk Backend SDK
    const invitation = await clerkClient.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: origin, // Redirect to home after sign up
      publicMetadata: {
        role: "user", // Default role for invited users
      },
    });

    return NextResponse.json(invitation);
  } catch (error: any) {
    console.error("[INVITATION_ERROR]", error);
    return new NextResponse(error.message || "Internal Error", { status: 500 });
  }
}
