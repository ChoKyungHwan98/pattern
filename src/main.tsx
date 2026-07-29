import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ProjectStoreProvider } from "./application/ProjectStore";
import { App } from "./presentation/App";
import "./presentation/styles/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProjectStoreProvider>
      <App />
    </ProjectStoreProvider>
  </StrictMode>,
);
