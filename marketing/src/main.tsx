import { createRoot } from "react-dom/client";
import App from "./App";
import { configureAmplify } from "./lib/amplify";
import { AuthProvider } from "./lib/auth";
import { CartProvider } from "./lib/cart";
import "./index.css";

configureAmplify();

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <CartProvider>
      <App />
    </CartProvider>
  </AuthProvider>,
);
