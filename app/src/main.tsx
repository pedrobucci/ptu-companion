import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./styles/pokemon-tokens.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Offline-first desktop app talking to a local Tauri command, not a
      // flaky network — no need for the default aggressive refetch/retry
      // behavior tuned for browsers hitting a remote API.
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
