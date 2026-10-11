import express from "express";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chooseEncoding, compressJsonResponses, serveIndexHtml, servePrecompressed, setStaticHeaders } from "./_core/staticAssets";

const JS_SOURCE = "console.log('hello world');".repeat(200);
const HTML_SOURCE = "<!doctype html><html><body><div id=root></div>" + "x".repeat(2000) + "</body></html>";
const BIG_JSON = { items: Array.from({ length: 200 }, (_, index) => ({ id: index, text: "논술 마스터 문항" })) };

let root: string;
let server: http.Server;
let baseUrl: string;

function request(pathname: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    http
      .get(`${baseUrl}${pathname}`, { headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
      })
      .on("error", reject);
  });
}

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "static-assets-"));
  fs.mkdirSync(path.join(root, "assets"));
  fs.writeFileSync(path.join(root, "assets", "app-abc123.js"), JS_SOURCE);
  fs.writeFileSync(path.join(root, "assets", "app-abc123.js.br"), zlib.brotliCompressSync(JS_SOURCE));
  fs.writeFileSync(path.join(root, "assets", "app-abc123.js.gz"), zlib.gzipSync(JS_SOURCE));
  fs.writeFileSync(path.join(root, "assets", "plain-def456.js"), JS_SOURCE); // 압축본 없음
  fs.writeFileSync(path.join(root, "index.html"), HTML_SOURCE);
  fs.writeFileSync(path.join(root, "index.html.gz"), zlib.gzipSync(HTML_SOURCE));

  const app = express();
  app.get("/api/big", compressJsonResponses(), (_req, res) => void res.json(BIG_JSON));
  app.get("/api/small", compressJsonResponses(), (_req, res) => void res.json({ ok: true }));
  app.use(servePrecompressed(root));
  app.use(express.static(root, { index: false, setHeaders: (res, filePath) => setStaticHeaders(res, filePath) }));
  app.use("*", serveIndexHtml(root));
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(root, { recursive: true, force: true });
});

describe("Accept-Encoding 선택", () => {
  it("지원하는 방식 중 선호 순서대로 고르고, 거부(q=0)와 헤더 없음은 압축하지 않는다", () => {
    expect(chooseEncoding("gzip, deflate, br", ["br", "gzip"])).toBe("br");
    expect(chooseEncoding("gzip", ["br", "gzip"])).toBe("gzip");
    expect(chooseEncoding("br;q=0, gzip", ["br", "gzip"])).toBe("gzip");
    expect(chooseEncoding("*", ["br", "gzip"])).toBe("br");
    expect(chooseEncoding("identity", ["br", "gzip"])).toBeNull();
    expect(chooseEncoding(undefined, ["br", "gzip"])).toBeNull();
  });
});

describe("미리 압축한 정적 파일", () => {
  it("brotli를 받을 수 있으면 .br을 원래 형식(JS)으로 보내고 오래 캐시한다", async () => {
    const res = await request("/assets/app-abc123.js", { "Accept-Encoding": "gzip, br" });
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("br");
    expect(res.headers["content-type"]).toMatch(/javascript/);
    expect(res.headers["cache-control"]).toContain("immutable");
    expect(res.headers.vary).toContain("Accept-Encoding");
    expect(zlib.brotliDecompressSync(res.body).toString()).toBe(JS_SOURCE);
    expect(res.body.length).toBeLessThan(JS_SOURCE.length);
  });

  it("gzip만 받을 수 있으면 .gz를 보낸다", async () => {
    const res = await request("/assets/app-abc123.js", { "Accept-Encoding": "gzip" });
    expect(res.headers["content-encoding"]).toBe("gzip");
    expect(zlib.gunzipSync(res.body).toString()).toBe(JS_SOURCE);
  });

  it("압축을 받지 못하면 원본을 그대로 보낸다", async () => {
    const res = await request("/assets/app-abc123.js", { "Accept-Encoding": "identity" });
    expect(res.headers["content-encoding"]).toBeUndefined();
    expect(res.body.toString()).toBe(JS_SOURCE);
    expect(res.headers["cache-control"]).toContain("immutable");
  });

  it("압축본이 없는 파일은 원본으로 응답한다", async () => {
    const res = await request("/assets/plain-def456.js", { "Accept-Encoding": "br, gzip" });
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBeUndefined();
    expect(res.body.toString()).toBe(JS_SOURCE);
  });

  it("폴더 밖 경로는 열지 않는다", async () => {
    const res = await request("/%2e%2e/%2e%2e/etc/passwd.js", { "Accept-Encoding": "br" });
    expect(res.headers["content-encoding"]).toBeUndefined();
    expect(res.body.toString()).not.toContain("root:");
  });
});

describe("index.html", () => {
  it("항상 새로 확인하게 하고(no-cache) 압축본을 보낸다", async () => {
    const res = await request("/", { "Accept-Encoding": "gzip" });
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-cache");
    expect(res.headers["content-encoding"]).toBe("gzip");
    expect(zlib.gunzipSync(res.body).toString()).toBe(HTML_SOURCE);
  });

  it("화면 경로(SPA)도 index.html로 응답한다", async () => {
    const res = await request("/mypage", { "Accept-Encoding": "identity" });
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-cache");
    expect(res.body.toString()).toBe(HTML_SOURCE);
  });
});

describe("JSON 응답 압축", () => {
  it("큰 JSON은 gzip으로 압축하고 내용은 그대로다", async () => {
    const res = await request("/api/big", { "Accept-Encoding": "gzip" });
    expect(res.headers["content-encoding"]).toBe("gzip");
    expect(Number(res.headers["content-length"])).toBe(res.body.length);
    expect(JSON.parse(zlib.gunzipSync(res.body).toString())).toEqual(BIG_JSON);
    expect(res.body.length).toBeLessThan(JSON.stringify(BIG_JSON).length / 2);
  });

  it("작은 JSON과 압축 미지원 클라이언트는 그대로 보낸다", async () => {
    const small = await request("/api/small", { "Accept-Encoding": "gzip" });
    expect(small.headers["content-encoding"]).toBeUndefined();
    expect(JSON.parse(small.body.toString())).toEqual({ ok: true });

    const plain = await request("/api/big", { "Accept-Encoding": "identity" });
    expect(plain.headers["content-encoding"]).toBeUndefined();
    expect(JSON.parse(plain.body.toString())).toEqual(BIG_JSON);
  });
});
