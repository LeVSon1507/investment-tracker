import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";

// In Vite dev mode, /api/* requests hit the Vite static file server instead of
// executing the serverless function. This plugin intercepts those requests and
// runs the handler in-process using Vite's SSR module loader.
function devApiPlugin(): Plugin {
  return {
    name: "dev-api",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api", async (req, res) => {
        try {
          const mod = await server.ssrLoadModule("/api/market.ts");
          const handler = mod.default as (
            request: Request,
          ) => Promise<Response>;
          const request = new Request(`http://localhost/api${req.url ?? ""}`);
          const response = await handler(request);
          const body = await response.text();
          res.setHeader(
            "Content-Type",
            response.headers.get("Content-Type") ?? "application/json",
          );
          res.statusCode = response.status;
          res.end(body);
        } catch (error) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApiPlugin()],
});
