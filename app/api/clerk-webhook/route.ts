import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
  }

  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400
    });
  }

  const { id } = evt.data;
  const eventType = evt.type;

  if (eventType === 'user.created') {
    const { email_addresses, id: userId, public_metadata } = evt.data;
    const primaryEmail = email_addresses[0]?.email_address;

    if (!primaryEmail) {
      console.error('User created without email address');
      return new Response('No email address found', { status: 400 });
    }

    // WHITELIST LOGIC
    const client = await clerkClient();
    const normalizedEmail = primaryEmail.trim().toLowerCase();
    
    // 1. Check if the user ALREADY has a role (e.g., joined via invitation link)
    if ((public_metadata as { role?: string })?.role) {
      console.log(`[WEBHOOK] User ${normalizedEmail} joined with pre-assigned role: ${(public_metadata as any).role}`);
      return new Response('User authorized via metadata', { status: 200 });
    }

    // 2. Check for invitations (joined via direct URL or link)
    // We fetch invitations to see if this email is authorized. 
    // We check both pending and accepted to be safe, as Clerk might change status during sign-up.
    const invitationsResponse = await client.invitations.getInvitationList({
      limit: 500 
    });
    
    const invitation = invitationsResponse.data.find(
      (inv) => inv.emailAddress.trim().toLowerCase() === normalizedEmail
    );

    if (invitation) {
      console.log(`[WEBHOOK] Authorized user ${normalizedEmail} found in invitations list (Status: ${invitation.status}).`);
      const role = (invitation.publicMetadata as { role?: string })?.role || 'user';
      
      await client.users.updateUser(userId, {
        publicMetadata: { role }
      });

      // Revoke if still pending, otherwise it's already accepted
      if (invitation.status === 'pending') {
        try {
          await client.invitations.revokeInvitation(invitation.id);
          console.log(`[WEBHOOK] Invitation ${invitation.id} revoked for ${normalizedEmail}`);
        } catch (e) {
          console.error('Failed to revoke invitation in webhook:', e);
        }
      }

      return new Response('User authorized and promoted', { status: 200 });
    }

    // 3. ABSOLUTE REJECTION: If not in whitelist, DELETE the user immediately
    console.warn(`[WEBHOOK] SECURITY ALERT: Unauthorized user ${normalizedEmail} tried to sign up. Executing immediate deletion.`);
    try {
      await client.users.deleteUser(userId);
      console.log(`[WEBHOOK] Unauthorized user ${userId} (${normalizedEmail}) successfully deleted.`);
    } catch (deleteError) {
      console.error(`[WEBHOOK] CRITICAL ERROR: Failed to delete unauthorized user ${userId}:`, deleteError);
      return new Response('Failed to delete unauthorized user', { status: 500 });
    }
    
    return new Response('Unauthorized user deleted', { status: 200 });
  }

  return new Response('', { status: 200 });
}
