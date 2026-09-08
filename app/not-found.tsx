export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-center text-white p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-6xl font-black text-blue-500 tracking-tight">404</h1>
        <h2 className="text-2xl font-bold text-white">Página no encontrada</h2>
        <p className="text-slate-400 text-sm">
          La página que buscas no existe o ha sido movida.
        </p>
        <div className="pt-4">
          <a
            href="/"
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl transition-all"
          >
            Volver al Inicio
          </a>
        </div>
      </div>
    </div>
  );
}
