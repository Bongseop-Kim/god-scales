import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/app.tsx";

const app = document.querySelector("#app");

if (!app) throw new Error("#app is missing");

createRoot(app).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
