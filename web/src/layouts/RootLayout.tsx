import { Outlet, Link } from "react-router-dom";

export function RootLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            Gift&nbsp;Platform
          </Link>
          <nav className="flex gap-4 text-sm text-slate-500">
            <Link to="/" className="hover:text-slate-900">
              Store
            </Link>
            <Link to="/admin" className="hover:text-slate-900">
              Admin
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
