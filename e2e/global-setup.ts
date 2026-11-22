import { buildApp, startServer } from "./support/server";

export default async function globalSetup(): Promise<void> {
  buildApp();
  await startServer();
}
