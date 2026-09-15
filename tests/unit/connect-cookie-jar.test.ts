import { describe, expect, it } from "vitest";
import { CookieJar } from "../../src/connect/cookie-jar";

const WWW = new URL("https://www.qasir.id/api/auth/login");
const MERCHANT = new URL("https://bengkel-manuju-jaya-621095.qasir.id/dashboard");
const NOW = Date.parse("2026-09-15T00:00:00Z");

describe("CookieJar", () => {
  it("scopes host-only cookies to their host", () => {
    const jar = new CookieJar();
    jar.applySetCookie(WWW, "laravel_session=a; Path=/; HttpOnly", NOW);
    jar.applySetCookie(MERCHANT, "laravel_session=b; Path=/", NOW);
    expect(jar.headerFor(WWW, NOW)).toBe("laravel_session=a");
    expect(jar.headerFor(MERCHANT, NOW)).toBe("laravel_session=b");
  });

  it("shares Domain=.qasir.id cookies across subdomains", () => {
    const jar = new CookieJar();
    jar.applySetCookie(WWW, "shared=1; Domain=.qasir.id", NOW);
    expect(jar.headerFor(MERCHANT, NOW)).toBe("shared=1");
  });

  it("ignores cookies for foreign or unrelated domains", () => {
    const jar = new CookieJar();
    jar.applySetCookie(WWW, "evil=1; Domain=example.com", NOW);
    jar.applySetCookie(WWW, "tld=1; Domain=id", NOW);
    jar.applySetCookie(WWW, "sibling=1; Domain=pos.qasir.id", NOW);
    expect(jar.toJSON(NOW)).toEqual([]);
  });

  it("drops Max-Age<=0 and past Expires, replacing existing entries", () => {
    const jar = new CookieJar();
    jar.applySetCookie(WWW, "a=1; Path=/", NOW);
    jar.applySetCookie(WWW, "b=1; Path=/", NOW);
    jar.applySetCookie(WWW, "a=deleted; Max-Age=0; Path=/", NOW);
    jar.applySetCookie(WWW, "b=deleted; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/", NOW);
    jar.applySetCookie(WWW, "c=1; Max-Age=-5", NOW);
    expect(jar.headerFor(WWW, NOW)).toBe("");
  });

  it("expires cookies over time and Max-Age wins over Expires", () => {
    const jar = new CookieJar();
    jar.applySetCookie(WWW, "short=1; Expires=Wed, 01 Jan 2031 00:00:00 GMT; Max-Age=60", NOW);
    expect(jar.headerFor(WWW, NOW + 30_000)).toBe("short=1");
    expect(jar.headerFor(WWW, NOW + 61_000)).toBe("");
  });

  it("honours paths and round-trips through JSON", () => {
    const jar = new CookieJar();
    jar.applySetCookie(WWW, "api=1; Path=/api", NOW);
    expect(jar.headerFor(new URL("https://www.qasir.id/sign-in"), NOW)).toBe("");
    expect(jar.headerFor(WWW, NOW)).toBe("api=1");
    const copy = CookieJar.fromJSON(JSON.parse(JSON.stringify(jar.toJSON(NOW))));
    expect(copy.headerFor(WWW, NOW)).toBe("api=1");
    expect(CookieJar.fromJSON([{ name: "x", value: "1", domain: "evil.example", hostOnly: true, path: "/" }]).toJSON()).toEqual([]);
    expect(CookieJar.fromJSON("garbage").toJSON()).toEqual([]);
  });

  it("reads Set-Cookie via getSetCookie on a Headers object", () => {
    const headers = new Headers();
    headers.append("set-cookie", "a=1; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Path=/");
    headers.append("set-cookie", "b=2; Path=/");
    const jar = new CookieJar();
    jar.applyResponse(WWW, headers, NOW);
    expect(jar.get(WWW, "a", NOW)).toBe("1");
    expect(jar.headerFor(WWW, NOW).split("; ").sort()).toEqual(["a=1", "b=2"]);
  });
});
