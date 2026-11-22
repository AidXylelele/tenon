import { defineConfig, type Plugin } from "vite";
import nextConfig from "../next.config";

const WORKER_CHUNKS = "/_next/static/chunks/:file*";

async function workerPolicy(): Promise<string> {
  const rules = (await nextConfig.headers?.()) ?? [];
  const chunks = rules.find(({ source }) => source === WORKER_CHUNKS);
  const policy = chunks?.headers.find(
    ({ key }) => key === "Content-Security-Policy",
  );

  if (policy === undefined) throw new Error("No policy for worker chunks.");

  return policy.value;
}

function workerPolicyOnChunks(policy: string): Plugin {
  return {
    name: "worker-policy-on-chunks",
    configurePreviewServer(server) {
      server.middlewares.use("/assets", (_request, response, next) => {
        response.setHeader("Content-Security-Policy", policy);
        next();
      });
    },
  };
}

export default defineConfig(async () => {
  const policy = await workerPolicy();
  const chunks = workerPolicyOnChunks(policy);
  return { plugins: [chunks] };
});
