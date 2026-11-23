import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { installSlowRequestTracking } from "./utils/slowRequests";
import { installStaleChunkReload } from "./utils/staleChunk";

// Both run once, before anything is drawn. See the two files for what they do and why.
installSlowRequestTracking();
installStaleChunkReload();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);