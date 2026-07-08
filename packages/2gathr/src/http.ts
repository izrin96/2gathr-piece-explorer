import { ofetch } from "ofetch";

// Base client for the private 2gathr/TopPort API. Exact endpoints are confirmed
// via the HTTP-inspection task (Task 8) and wired up in a later phase.
export function createHttpClient(baseURL: string) {
  return ofetch.create({ baseURL, retry: 1, timeout: 15_000 });
}
