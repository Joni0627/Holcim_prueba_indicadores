import { clerkClient } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
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

    // Fetch all users from Clerk
    const users = await client.users.getUserList({
      limit: 100,
    });

    const simplifiedUsers = users.data.map(u => ({
      id: u.id,
      email: u.emailAddresses[0]?.emailAddress,
      firstName: u.firstName,
      lastName: u.lastName,
      role: (u.publicMetadata as { role?: string })?.role || "user",
      createdAt: u.createdAt,
      lastSignInAt: u.lastSignInAt,
    }));

    return NextResponse.json(simplifiedUsers);
  } catch (error: any) {
    console.error("[USERS_GET_ERROR]", error);
    return new NextResponse(error.message || "Internal Error", { status: 500 });
  }
}

export async function PATCH(req: Request) {
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

    const { targetUserId, newRole } = await req.json();

    if (!targetUserId || !newRole) {
      return new NextResponse("Missing data", { status: 400 });
    }

    // Update user metadata in Clerk
    await client.users.updateUserMetadata(targetUserId, {
      publicMetadata: {
        role: newRole,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[USER_UPDATE_ERROR]", error);
    return new NextResponse(error.message || "Internal Error", { status: 500 });
  }
}
