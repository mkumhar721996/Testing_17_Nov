import { createApp } from "./server.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const host = arg("host", process.env.HOST ?? "127.0.0.1");
const port = Number(arg("port", process.env.PORT ?? "3000"));

createApp().listen(port, host, () => {
  console.log(`background-worker listening on ${host}:${port}`);
});
