// Admin portal (handoff §7.3). Gated by the Cognito `admins` group + a
// dedicated authorizer in M5 — never trust the SPA alone (§8).
// M5 fills in: dashboard aggregates, orders table, ops queue, admin actions.
export function AdminHome() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p className="mt-2 text-slate-600">
        Dashboards, orders, and the manual-ops queue arrive in M5. This route
        will be gated by the Cognito <code>admins</code> group.
      </p>
      <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-400">
        Admin dashboard — coming in M5
      </div>
    </section>
  );
}
