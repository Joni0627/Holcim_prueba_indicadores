import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <SignIn 
        routing="path" 
        path="/sign-in" 
        signUpUrl="/sign-up"
        afterSignInUrl="/"
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-slate-900 border border-slate-800 shadow-2xl",
          }
        }}
      />
    </div>
  );
}
