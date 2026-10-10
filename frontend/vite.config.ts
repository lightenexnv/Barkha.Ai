import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import http from "node:http";
import { componentTagger } from "lovable-tagger";

const LOCAL_BACKEND = "http://127.0.0.1:8000";
const DEPLOYED_BACKEND = "https://barkha-ai-backend.onrender.com";

/**
 * True when a backend answers on the origin. Probes "/" (no database work):
 * /health pings MongoDB, which can take seconds when it is not running
 * locally and would wrongly look like "no backend".
 */
const isUp = (origin: string, timeoutMs = 1500) =>
  new Promise<boolean>((resolve) => {
    const req = http.get(`${origin}/`, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve((res.statusCode ?? 500) < 500);
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(false));
  });

/**
 * Dev proxy for /api and /health. Requests go to the local backend when one is
 * running and to the deployed backend otherwise, re-checked every few seconds,
 * so `npm run dev` works with or without `uvicorn` and never hits CORS.
 * Set DEV_API_TARGET to pin a specific backend.
 */
const backendProxy = (pinned?: string): ProxyOptions => ({
  target: pinned || LOCAL_BACKEND,
  changeOrigin: true,
  secure: true,
  configure(proxy, options) {
    if (pinned) return;
    let current = "";
    const choose = async () => {
      const next = (await isUp(LOCAL_BACKEND)) ? LOCAL_BACKEND : DEPLOYED_BACKEND;
      // http-proxy reads options.target on every request
      options.target = next;
      if (next !== current) {
        current = next;
        console.log(`\n  [api] proxying /api to ${next === LOCAL_BACKEND ? "local backend" : "deployed backend"} (${next})\n`);
      }
    };
    void choose();
    setInterval(choose, 5000).unref();
    proxy.on("error", (err, _req, res) => {
      console.warn(`  [api] proxy error: ${err.message}`);
      if ("writeHead" in res && !res.headersSent) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ detail: "The API server could not be reached. Please retry." }));
      }
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    server: {
      host: "::",
      port: 8080,
      // One proxy entry (a regex key) so the backend check runs once
      proxy: { "^/(api|health)(/|$)": backendProxy(env.DEV_API_TARGET) },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
