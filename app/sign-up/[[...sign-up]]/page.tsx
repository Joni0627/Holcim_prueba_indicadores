import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <SignUp 
        routing="path" 
        path="/sign-up" 
        signInUrl="/sign-in"
        afterSignUpUrl="/"
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
