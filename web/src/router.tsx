import { createBrowserRouter } from "react-router-dom";
import { RootLayout } from "./layouts/RootLayout";
import { BuyerHome } from "./routes/buyer/BuyerHome";
import { History } from "./routes/buyer/History";
import { ClaimLanding } from "./routes/recipient/ClaimLanding";
import { AdminHome } from "./routes/admin/AdminHome";
import { NotFound } from "./routes/NotFound";

// Three route groups per handoff §7. Auth gating (Cognito admins group for
// /admin, claim-token for /claim) is wired in M3/M5; these are skeletons.
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/", element: <BuyerHome /> },
      { path: "/history", element: <History /> },
      { path: "/claim/:token", element: <ClaimLanding /> },
      { path: "/admin", element: <AdminHome /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
