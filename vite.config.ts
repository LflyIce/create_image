import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { loadEnv, type Plugin } from "vite";
import type { IncomingMessage } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function doubaoImageProxy(apiKey?: string): Plugin {
  return {
    name: "doubao-image-proxy",
    configureServer(server) {
      server.middlewares.use("/api/doubao/images", async (request, response) => {
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        if (!apiKey) {
          response.statusCode = 200;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ error: "未配置 ARK_API_KEY，无法调用 Doubao Seedream 4.0" }));
          return;
        }

        try {
          const body = await readRequestBody(request);
          const arkResponse = await fetch("https://ark.cn-beijing.volces.com/api/v3/images/generations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`
            },
            body
          });

          const text = await arkResponse.text();
          response.statusCode = arkResponse.status;
          response.setHeader("Content-Type", arkResponse.headers.get("Content-Type") ?? "application/json");
          response.end(text);
        } catch (error) {
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Doubao 代理请求失败" }));
        }
      });
    }
  };
}

function readRequestBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const localEnv = readLocalEnv(process.cwd());

  return {
    plugins: [react(), doubaoImageProxy(env.ARK_API_KEY || localEnv.ARK_API_KEY || process.env.ARK_API_KEY)],
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      globals: true
    }
  };
});

function readLocalEnv(root: string) {
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) return {} as Record<string, string>;

  return readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .reduce<Record<string, string>>((result, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return result;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) return result;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
      result[key] = value;
      return result;
    }, {});
}
