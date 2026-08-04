import { mountApp } from "./ui/app.ts";

const app = document.querySelector<HTMLElement>("#app");

if (!app) throw new Error("#app is missing");
mountApp(app);
