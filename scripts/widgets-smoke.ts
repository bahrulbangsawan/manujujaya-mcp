/**
 * Smoke test of the committed widget bundle in a real browser:
 *
 *   bun run widgets:smoke                 # uses installed Google Chrome (playwright-core channel "chrome")
 *   CHROME_PATH=/path/to/chrome bun run widgets:smoke
 *
 * For each view it renders renderViewHtml(WIDGET_HTML, view) inside <iframe sandbox="allow-scripts">
 * (opaque origin, no forms, no storage) with the hosts' default CSP, under an ext-apps AppBridge host page
 * that answers tools/call from widgets/dev/fixtures.ts. It asserts the view's landmark text, no <form>, no
 * repeated opening tool call, no console errors or page errors, and zero network requests; the transaksi
 * view also round-trips one transactions_page call. It never contacts Qasir or the Worker.
 */
import path from "node:path";
import { chromium, type Frame, type Page } from "playwright-core";
import { build } from "vite";
import { WIDGET_HTML, WIDGET_SOURCE_HASH } from "../src/widgets/bundled";
import { VIEW_TOOL, VIEWS, type ViewName } from "../src/widgets/contract";
import { renderViewHtml } from "../src/widgets/resources";
import { VIEW_LABEL } from "../widgets/src/app/viewPaths";
import { SAMPLE_ARGS } from "../widgets/dev/fixtures";
import { computeWidgetSourceHash } from "./lib/widget-source-hash";
import type { SmokeHost, SmokeMountOptions } from "./widgets-smoke-host";

const ROOT = path.resolve(import.meta.dirname, "..");
const VIEW_TIMEOUT_MS = 20_000;

/**
 * The restrictive CSP MCP Apps hosts apply when a resource declares no domains (ext-apps spec 2026-01-26).
 * Chrome does not report requests from sandboxed srcdoc frames to Playwright, so network attempts are
 * caught inside the frame instead: blocked ones fire securitypolicyviolation, allowed ones leave
 * resource-timing entries. Violations without a URL (zod's guarded eval probe reports "eval") are not requests.
 */
const HOST_DEFAULT_CSP =
  "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' data:; connect-src 'none'";
const NETWORK_PROBE =
  '<script>window.__mjNetwork=[];document.addEventListener("securitypolicyviolation",function(e){if(!/^(eval|inline|wasm-eval|trusted-types-sink)$/.test(e.blockedURI))window.__mjNetwork.push(e.effectiveDirective+" "+e.blockedURI)});</script>';

/** The view HTML as a host would serve it, plus the CSP meta and the in-frame network probe. */
function instrumentWidgetHtml(html: string): string {
  const head = /<head(\s[^>]*)?>/i.exec(html);
  if (!head) throw new Error("widget HTML has no <head>");
  const at = head.index + head[0].length;
  return `${html.slice(0, at)}<meta http-equiv="Content-Security-Policy" content="${HOST_DEFAULT_CSP}">${NETWORK_PROBE}${html.slice(at)}`;
}

/** Fixture text each view must render from its opening tool result (see widgets/dev/fixtures.ts SAMPLE_ARGS). */
const LANDMARK: Record<ViewName, string> = {
  penjualan: "Tunai",
  produk: "Produk 1",
  stok: "Kopi 3 - Reguler",
  pembelian: "PO-2026-0001",
  transaksi: "INV/20260915/0000",
  piutang: "Pelanggan E",
};

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

/** The host page script: scripts/widgets-smoke-host.ts bundled into one IIFE (ext-apps AppBridge + fixtures). */
async function bundleHostScript(): Promise<string> {
  const output = await build({
    configFile: false,
    root: ROOT,
    logLevel: "silent",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      write: false,
      minify: false,
      emptyOutDir: false,
      lib: { entry: path.join(ROOT, "scripts", "widgets-smoke-host.ts"), formats: ["iife"], name: "WidgetsSmokeHost" },
    },
  });
  const results = Array.isArray(output) ? output : [output];
  for (const result of results) {
    if (!("output" in result)) continue;
    const chunk = result.output.find((item) => item.type === "chunk");
    if (chunk && chunk.type === "chunk") return chunk.code;
  }
  throw new Error("Vite produced no host script chunk");
}

async function widgetFrame(page: Page): Promise<Frame> {
  const deadline = Date.now() + VIEW_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
    if (frame) return frame;
    await page.waitForTimeout(50);
  }
  throw new Error("widget iframe never attached");
}

function textIncludes(frame: Frame, text: string, timeout = VIEW_TIMEOUT_MS): Promise<unknown> {
  return frame.waitForFunction((needle) => document.body?.innerText.includes(needle) ?? false, text, { timeout });
}

async function smokeView(page: Page, hostScript: string, view: ViewName): Promise<void> {
  const consoleErrors: string[] = [];
  const requests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 200));
  });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message.slice(0, 200)}`));
  page.on("request", (request) => requests.push(request.url().slice(0, 120)));
  await page.route("**/*", (route) => route.abort());

  await page.setContent('<!doctype html><html lang="id"><head><meta charset="utf-8"><title>widgets smoke host</title></head><body></body></html>');
  await page.addScriptTag({ content: hostScript });

  const tool = VIEW_TOOL[view];
  const mount: SmokeMountOptions = {
    html: instrumentWidgetHtml(renderViewHtml(WIDGET_HTML, view)),
    tool,
    args: SAMPLE_ARGS[tool] as Record<string, unknown>,
  };
  await page.evaluate((options) => window.__smoke.mount(options), mount);
  const frame = await widgetFrame(page);

  let rendered = true;
  try {
    await textIncludes(frame, LANDMARK[view]);
  } catch {
    rendered = false;
  }
  const heading = await frame.evaluate(() => document.querySelector("h1")?.textContent?.trim() ?? "");
  check(`${view}: renders "${LANDMARK[view]}" under heading ${VIEW_LABEL[view]}`, rendered && heading === VIEW_LABEL[view], `h1="${heading}"`);
  const padding = await frame.evaluate(() => {
    let element: HTMLElement | null = document.querySelector("h1");
    while (element) {
      const style = getComputedStyle(element);
      if (style.paddingLeft === "16px" && style.paddingRight === "16px") {
        return { left: style.paddingLeft, right: style.paddingRight };
      }
      element = element.parentElement;
    }
    return { left: "", right: "" };
  });
  check(`${view}: 16px left and right padding`, padding.left === "16px" && padding.right === "16px", `${padding.left}/${padding.right}`);


  check(`${view}: no <form> elements`, (await frame.evaluate(() => document.querySelectorAll("form").length)) === 0);

  if (view === "transaksi") {
    const loadedCount = async () =>
      Number((await frame.evaluate(() => /(\d+) transaksi dimuat/.exec(document.body.innerText)?.[1] ?? "0")) || 0);
    const before = await loadedCount();
    await frame.getByRole("button", { name: "Muat lebih banyak" }).click();
    let after = before;
    try {
      await frame.waitForFunction((count) => Number(/(\d+) transaksi dimuat/.exec(document.body.innerText)?.[1] ?? "0") > count, before, {
        timeout: VIEW_TIMEOUT_MS,
      });
      after = await loadedCount();
    } catch {
      // reported below
    }
    const pagerCalls = await page.evaluate(() => window.__smoke.calls.filter((call) => call.name === "transactions_page"));
    check(
      "transaksi: one transactions_page round trip appends rows",
      pagerCalls.length === 1 && pagerCalls[0]?.arguments.page === 2 && after > before,
      `rows ${before} → ${after}`,
    );
  }

  const host: Pick<SmokeHost, "calls" | "events"> = await page.evaluate(() => ({ calls: window.__smoke.calls, events: window.__smoke.events }));
  check(`${view}: host delivered the opening tool call`, host.events.includes("toolresult"), host.events.join(","));
  const repeated = host.calls.filter((call) => call.name === tool).length;
  check(`${view}: opening tool result reused (no repeated ${tool} call)`, repeated === 0, `${repeated} call(s)`);
  check(`${view}: no console errors or page errors`, consoleErrors.length === 0, consoleErrors.join(" | "));
  const frameNetwork = await frame.evaluate(() => [
    ...((window as unknown as { __mjNetwork?: string[] }).__mjNetwork ?? []),
    ...performance.getEntriesByType("resource").map((entry) => entry.name),
  ]);
  const network = [...requests, ...frameNetwork];
  check(`${view}: zero network requests`, network.length === 0, network.join(", ").slice(0, 300));
}

async function main(): Promise<void> {
  const currentHash = computeWidgetSourceHash(ROOT);
  if (currentHash !== WIDGET_SOURCE_HASH) {
    throw new Error("src/widgets/bundled.ts is stale: run bun run widgets:bundle");
  }
  check("bundle present", WIDGET_HTML.length > 0, `${WIDGET_HTML.length} chars, source ${WIDGET_SOURCE_HASH.slice(0, 12)}`);

  const hostScript = await bundleHostScript();
  const executablePath = process.env.CHROME_PATH?.trim();
  const browser = await chromium.launch(executablePath ? { executablePath, headless: true } : { channel: "chrome", headless: true });
  try {
    for (const view of VIEWS) {
      const page = await browser.newPage({ viewport: { width: 900, height: 1000 }, timezoneId: "Asia/Jakarta", locale: "id-ID" });
      try {
        await smokeView(page, hostScript, view);
      } catch (err) {
        check(`${view}: smoke run`, false, err instanceof Error ? err.message.split("\n")[0] : String(err));
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll widget smoke checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error("Widget smoke test crashed:", err instanceof Error ? err.message : err);
  process.exit(2);
});
