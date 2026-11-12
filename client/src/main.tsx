import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import App from "./App";
import "./index.css";

// The theme switch sits inside the Account dialog, so the saved theme is applied before the first paint.
document.documentElement.classList.toggle("dark", localStorage.getItem("theme") === "dark");

const root = document.getElementById("root");
if (!root) {
  throw new Error("The page has no #root element to mount the app in");
}
createRoot(root).render(<App />);
