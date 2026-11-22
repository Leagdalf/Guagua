import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./styles";
import { App } from "./App";

// Unter ?preview zeigt die App alle Bausteine in allen Zuständen.
const Preview = lazy(() => import("./ui/Preview"));
const showPreview = new URLSearchParams(window.location.search).has("preview");

const root = document.getElementById("root");
if (!root) throw new Error("Element #root fehlt in index.html");

createRoot(root).render(
  <StrictMode>
    {showPreview ? (
      <Suspense fallback={null}>
        <Preview />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
