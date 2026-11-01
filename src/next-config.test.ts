import { describe, expect, it } from "vitest";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import nextConfig from "../next.config.mjs";

interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

async function cacheControlFor(pathname: string) {
  const rules: HeaderRule[] = (await nextConfig.headers?.()) ?? [];
  const values = rules
    .filter((rule: HeaderRule) => getPathMatch(rule.source, { strict: true })(pathname))
    .flatMap((rule: HeaderRule) => rule.headers)
    .filter((header: { key: string; value: string }) => header.key.toLowerCase() === "cache-control")
    .map((header: { key: string; value: string }) => header.value);
  return values.at(-1);
}

describe("next.config Cache-Control", () => {
  it.each(["/", "/login", "/signup", "/dashboard", "/inbox/123", "/settings/team", "/join/abc"])(
    "keeps %s out of shared caches",
    async (pathname) => {
      const value = await cacheControlFor(pathname);
      expect(value).toBe("private, no-store");
      expect(value).not.toMatch(/public|s-maxage|stale-while-revalidate/);
    },
  );

  it("sends no-store on API routes", async () => {
    expect(await cacheControlFor("/api/whatsapp/templates")).toBe("no-store");
  });

  it.each(["/_next/static/chunks/app.js", "/_next/image"])(
    "leaves %s to Next's own caching",
    async (pathname) => {
      expect(await cacheControlFor(pathname)).toBeUndefined();
    },
  );
});
