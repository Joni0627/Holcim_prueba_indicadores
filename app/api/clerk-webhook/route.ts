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
    const { email_addresses, id: userId } = evt.data;
    const primaryEmail = email_addresses[0]?.email_address;

    if (!primaryEmail) {
      console.error('User created without email address');
      return new Response('No email address found', { status: 400 });
    }

    // WHITELIST LOGIC
    const client = await clerkClient();
    
    // 1. Check if it's the super admin (joni0627@gmail.com)
    const superAdminEmail = "joni0627@gmail.com";
    if (primaryEmail.toLowerCase() === superAdminEmail.toLowerCase()) {
      console.log(`[WEBHOOK] Super Admin ${primaryEmail} joined. Assigning admin role.`);
      await client.users.updateUser(userId, {
        publicMetadata: { role: 'admin' }
      });
      return new Response('Super Admin authorized', { status: 200 });
    }

    // 2. Check for pending invitations
    const invitationsResponse = await client.invitations.getInvitationList({
      status: 'pending'
    });
    
    const pendingInvitation = invitationsResponse.data.find(
      (inv) => inv.emailAddress.toLowerCase() === primaryEmail.toLowerCase()
    );

    if (pendingInvitation) {
      console.log(`[WEBHOOK] Authorized user ${primaryEmail} joined via invitation.`);
      // Assign role from invitation metadata or default to 'user'
      const role = (pendingInvitation.publicMetadata as { role?: string })?.role || 'user';
      
      await client.users.updateUser(userId, {
        publicMetadata: { role }
      });

      // Revoke the invitation as it's now "accepted"
      try {
        await client.invitations.revokeInvitation(pendingInvitation.id);
      } catch (e) {
        console.error('Failed to revoke invitation in webhook:', e);
      }

      return new Response('User authorized and promoted', { status: 200 });
    }

    // 3. If not in whitelist, DELETE the user immediately
    console.warn(`[WEBHOOK] Unauthorized user ${primaryEmail} tried to sign up. Deleting...`);
    await client.users.deleteUser(userId);
    
    return new Response('Unauthorized user deleted', { status: 200 });
  }

  return new Response('', { status: 200 });
}
