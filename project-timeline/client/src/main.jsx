/**
 * main.jsx — React app entry point.
 *
 * In full-stack mode this file is served by:
 *   - Vite dev server (development)
 *   - Express static middleware (production):
 *       app.use(express.static(path.join(__dirname, '../client/dist')));
 *
 * Build command: cd client && npm run build
 * Output goes to: client/dist/ (served by Express in production)
 */

import React from "react";
import ReactDOM from "react-dom/client";
import Root from "./Root";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
