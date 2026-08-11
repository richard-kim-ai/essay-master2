import { describe, expect, it } from "vitest";
import {
  createVerificationToken,
  hashVerificationToken,
} from "./email";

describe("Essay Master Integration & Security Flows", () => {
  it("validates offline service worker assets and manifest structure", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    const manifestPath = path.join(process.cwd(), "client/public/manifest.webmanifest");
    const swPath = path.join(process.cwd(), "client/public/sw.js");

    const manifestRaw = await fs.readFile(manifestPath, "utf-8");
    const swRaw = await fs.readFile(swPath, "utf-8");

    const manifest = JSON.parse(manifestRaw);
    expect(manifest.name).toBe("논술 마스터");
    expect(manifest.display).toBe("standalone");
    expect(swRaw).toContain("essay-master-shell-v1");
    expect(swRaw).toContain("caches.open");
  });

  it("ensures email verification TTL and token hashing logic are sound", () => {
    const tokenA = createVerificationToken();
    const tokenB = createVerificationToken();

    expect(tokenA).not.toBe(tokenB);
    expect(hashVerificationToken(tokenA)).toBe(hashVerificationToken(tokenA));
    expect(hashVerificationToken(tokenA)).not.toBe(hashVerificationToken(tokenB));
  });
});
