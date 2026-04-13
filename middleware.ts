import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)', 
  '/sign-up(.*)',
  '/unauthorized(.*)',
  '/api/clerk-webhook(.*)'
]);

export default clerkMiddleware(async (auth, request) => {
  const { userId } = auth();

  if (!isPublicRoute(request)) {
    if (!userId) {
      auth().protect();
      return;
    }

    // Fetch user to check metadata
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const role = (user.publicMetadata as { role?: string })?.role;
    const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
    const isOwner = email === "joni0627@gmail.com";

    // If no role and not owner, they are not invited/authorized
    if (!role && !isOwner) {
      const url = new URL('/unauthorized', request.url);
      return NextResponse.redirect(url);
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
