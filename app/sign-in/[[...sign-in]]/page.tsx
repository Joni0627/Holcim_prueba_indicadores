import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-black text-blue-600 tracking-tighter">PSC QUBE</h1>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-2">Expedición Malagueño</p>
        </div>
        <SignIn 
          routing="path" 
          path="/sign-in" 
          signUpUrl="/sign-up"
          afterSignInUrl="/"
        />
      </div>
    </div>
  );
}
