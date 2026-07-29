import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { configureAmplify } from "./lib/amplify";
import { AuthProvider } from "./lib/auth";
import { CartProvider } from "./lib/cart";
import "./index.css";

configureAmplify();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </AuthProvider>
  </React.StrictMode>,
);
