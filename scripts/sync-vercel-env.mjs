import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function loadEnvLocal() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].trim().replace(/^"|"$/g, "");
  }
  return env;
}

const localEnv = loadEnvLocal();
const keys = [
  ["CLERK_SECRET_KEY", true],
  ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", false],
  ["NEXT_PUBLIC_CLERK_SIGN_IN_URL", false],
  ["NEXT_PUBLIC_CLERK_SIGN_UP_URL", false],
  ["NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL", false],
  ["NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL", false],
  ["DATABASE_URL", true],
  ["VIRUSTOTAL_API_KEY", true],
  ["ADMIN_ALERT_EMAIL", false],
  ["RESEND_FROM", false],
];

function addEnv(name, value, environments, sensitive) {
  const args = [
    "vercel",
    "env",
    "add",
    name,
    environments,
    "--yes",
    "--force",
    sensitive ? "--sensitive" : "--no-sensitive",
  ];
  const result = spawnSync("cmd.exe", ["/c", "npx", ...args], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
    input: `${value}\n`,
    windowsHide: true,
  });
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const redacted = combined.includes(value)
    ? combined.split(value).join("[redacted]")
    : combined;
  if (result.error) {
    console.log(`failed ${name} (${environments}): ${result.error.message}`);
    return false;
  }
  if (result.status !== 0) {
    console.log(`failed ${name} (${environments}): ${redacted.trim()}`);
    return false;
  }
  console.log(`set ${name} (${environments})`);
  return true;
}

for (const [name, sensitive] of keys) {
  const value = localEnv[name];
  if (!value) {
    console.log(`skip ${name}: missing locally`);
    continue;
  }
  if (sensitive) {
    addEnv(name, value, "production,preview", true);
  } else {
    addEnv(name, value, "production,preview,development", false);
  }
}
