import { stopServer } from "./support/server";

export default async function globalTeardown(): Promise<void> {
  await stopServer();
}
