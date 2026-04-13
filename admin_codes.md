# Códigos de Administración - Invitaciones (Clerk)

Este documento detalla la implementación técnica de las rutas de administración para la gestión de invitaciones de usuarios utilizando el SDK de Clerk.

---

## 📂 1. Enviar Invitación (`/app/api/admin/invite/route.ts`)

Esta ruta permite a un administrador enviar una invitación por correo electrónico a un nuevo usuario.

### 🛠️ Características Técnicas:
- **Método:** `POST`
- **Seguridad:** 
    - Verifica que el usuario esté autenticado.
    - Valida que el usuario tenga el rol `admin` en sus metadatos públicos.
- **Lógica:**
    - Recibe el `email` del cuerpo de la petición.
    - Detecta automáticamente el `origin` (URL base) para configurar el enlace de redirección tras el registro.
    - Crea la invitación en Clerk asignando por defecto el rol `user`.
    - `ignoreExisting: true`: Evita errores si el usuario ya existe en la base de datos de Clerk.

### 📝 Código Fuente:
```typescript
import { clerkClient } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { userId, sessionClaims } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const role = (sessionClaims?.publicMetadata as { role?: string })?.role;
    const user = await clerkClient.users.getUser(userId);
    const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
    const isOwner = primaryEmail === "joni0627@gmail.com";

    if (role !== "admin" && !isOwner) return new NextResponse("Forbidden", { status: 403 });

    const { email } = await req.json();
    if (!email) return new NextResponse("Email is required", { status: 400 });

    const host = req.headers.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const origin = req.headers.get('origin') || `${protocol}://${host}`;

    const invitation = await clerkClient.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: origin,
      publicMetadata: { role: "user" },
      ignoreExisting: true,
    });

    return NextResponse.json(invitation);
  } catch (error: any) {
    return new NextResponse(error.message || "Internal Error", { status: 500 });
  }
}
```

---

## 📂 2. Gestión de Invitaciones (`/app/api/admin/invitations/route.ts`)

Esta ruta maneja el listado de invitaciones pendientes y la revocación de las mismas.

### 🛠️ Características Técnicas (GET):
- **Propósito:** Listar todas las invitaciones con estado `pending`.
- **Lógica:** Consulta a Clerk y devuelve un objeto simplificado con `id`, `email`, `createdAt` y `status`.

### 🛠️ Características Técnicas (DELETE):
- **Propósito:** Revocar (cancelar) una invitación enviada.
- **Parámetros:** Requiere `invitationId` como query parameter.
- **Lógica:** Llama a `clerkClient.invitations.revokeInvitation` para invalidar el enlace de registro.

### 📝 Código Fuente:
```typescript
import { clerkClient } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// LISTAR INVITACIONES PENDIENTES
export async function GET() {
  try {
    const { userId, sessionClaims } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const role = (sessionClaims?.publicMetadata as { role?: string })?.role;
    const user = await clerkClient.users.getUser(userId);
    const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
    const isOwner = primaryEmail === "joni0627@gmail.com";

    if (role !== "admin" && !isOwner) return new NextResponse("Forbidden", { status: 403 });

    const invitations = await clerkClient.invitations.getInvitationList({ status: "pending" });
    const simplified = invitations.data.map(inv => ({
      id: inv.id,
      email: inv.emailAddress,
      createdAt: inv.createdAt,
      status: inv.status,
    }));

    return NextResponse.json(simplified);
  } catch (error: any) {
    return new NextResponse(error.message || "Internal Error", { status: 500 });
  }
}

// REVOCAR INVITACIÓN
export async function DELETE(req: Request) {
  try {
    const { userId, sessionClaims } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const role = (sessionClaims?.publicMetadata as { role?: string })?.role;
    const user = await clerkClient.users.getUser(userId);
    const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
    const isOwner = primaryEmail === "joni0627@gmail.com";

    if (role !== "admin" && !isOwner) return new NextResponse("Forbidden", { status: 403 });

    const { searchParams } = new URL(req.url);
    const invitationId = searchParams.get("invitationId");
    if (!invitationId) return new NextResponse("Missing invitationId", { status: 400 });

    await clerkClient.invitations.revokeInvitation(invitationId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return new NextResponse(error.message || "Internal Error", { status: 500 });
  }
}
```
