import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./styles";
import { App } from "./App";

// Unter ?preview zeigt die App alle Bausteine in allen Zuständen, aber nur im Entwicklungsmodus.
// Im Bündel ist `import.meta.env.DEV` ein festes `false`: Der Import fällt weg und es entsteht kein Chunk.
const Preview = import.meta.env.DEV ? lazy(() => import("./ui/Preview")) : null;
const showPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has("preview");

const root = document.getElementById("root");
if (!root) throw new Error("Element #root fehlt in index.html");

createRoot(root).render(
  <StrictMode>
    {Preview && showPreview ? (
      <Suspense fallback={null}>
        <Preview />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
