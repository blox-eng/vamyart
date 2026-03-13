// tRPC v11 wire format: raw JSON input, no {"json": ...} wrapper.
// Spec: https://trpc.io/docs/rpc
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

export async function trpcMutation(procedure: string, input: unknown) {
  const res = await fetch(`${BASE_URL}/api/trpc/${procedure}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function trpcQuery(procedure: string, input?: unknown) {
  const url = new URL(`${BASE_URL}/api/trpc/${procedure}`);
  if (input !== undefined) {
    url.searchParams.set("input", JSON.stringify(input));
  }
  const res = await fetch(url.toString());
  return res.json();
}

// tRPC v11 success response: { result: { data: <value> } }
export function extractResult(response: unknown) {
  return (response as { result: { data: unknown } }).result?.data;
}
