import assert from "node:assert/strict";
import test from "node:test";
import { Resend } from "resend";

test("the email SDK preserves single and batch delivery receipt shapes", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    assert(url.startsWith("https://api.resend.com/emails"));
    return new Response(JSON.stringify(url.endsWith("/batch") ? { data: [{ id: "fixture-id" }] } : { id: "fixture-id" }), { headers: { "content-type": "application/json" } });
  };
  const client = new Resend("re_fixture");
  const email = { from: "fixture@example.test", to: "recipient@example.test", subject: "Fixture", html: "<p>Fixture</p>" };
  assert.equal((await client.emails.send(email)).data?.id, "fixture-id");
  assert.equal((await client.batch.send([email])).data?.data[0].id, "fixture-id");
  assert.equal(requests.length, 2);
});
