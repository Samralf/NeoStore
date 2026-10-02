import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");
const config = resolve(root, "dist/server/wrangler.json");
const envFile = resolve(root, ".dev.vars");
const persistDir = resolve(root, ".wrangler/state");

const child = spawn(
  process.execPath,
  [wrangler, "dev", "--config", config, "--env-file", envFile, "--persist-to", persistDir],
  { cwd: root, stdio: "inherit" },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
