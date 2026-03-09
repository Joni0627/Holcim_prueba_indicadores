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
    if (role !== "admin") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const { email } = await req.json();

    if (!email) {
      return new NextResponse("Email is required", { status: 400 });
    }

    // Create the invitation using Clerk Backend SDK
    const invitation = await clerkClient.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL || "/",
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
