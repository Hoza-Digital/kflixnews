import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the STORY publishing dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>STORY — Publishing Dashboard<\/title>/i);
  assert.match(html, />Dashboard</);
  assert.match(html, />New Article</);
  assert.match(html, />Recent Articles</);
  assert.match(html, /role="columnheader">Editor</);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("server-renders the full new article page", async () => {
  const response = await render("/admin/new-atricle");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, />Post a new article</);
  assert.match(html, />Article story</);
  assert.match(html, />Cover image</);
  assert.match(html, />Workflow</);
  assert.match(html, /aria-label="Insert image from library"/);
  assert.match(html, /type="checkbox"[^>]*\/>Headline|Headline<\/label>/);
  assert.match(html, /href="\/"[^>]*>Dashboard|>Dashboard<\/a>/i);

  const workflowIndex = html.indexOf(">Workflow<");
  const coverIndex = html.indexOf(">Cover image<");
  const authorIndex = html.indexOf(">Author ");
  const publishIndex = html.indexOf(">Publish now<");
  assert.ok(coverIndex < workflowIndex && workflowIndex < authorIndex && authorIndex < publishIndex);
  assert.match(html, /workflow-card workflow-floating-card/);
  assert.doesNotMatch(html, /Make the article live immediately|Schedule a future publish time/);
  assert.doesNotMatch(html, /workflow-floating-heading"><span class="section-number">03/);
  assert.match(html, /class="field full-field"><span>Category /);
});
