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

    if (role !== "admin") {
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

    if (role !== "admin") {
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

export async function DELETE(req: Request) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const role = (user.publicMetadata as { role?: string })?.role;

    if (role !== "admin") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");

    if (!targetUserId) {
      return new NextResponse("Missing userId", { status: 400 });
    }

    // Prevent self-deletion
    if (targetUserId === userId) {
      return new NextResponse("Cannot delete yourself", { status: 400 });
    }

    // Delete user from Clerk
    await client.users.deleteUser(targetUserId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[USER_DELETE_ERROR]", error);
    return new NextResponse(error.message || "Internal Error", { status: 500 });
  }
}
