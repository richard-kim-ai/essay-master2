import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import type { Request, RequestHandler, Response } from "express";

// 화면 로딩 속도용 정적 파일·응답 처리.
// - 빌드 때 만든 .br/.gz 파일을 Accept-Encoding에 맞춰 보낸다(실행 중 압축 비용 없음).
// - 해시가 붙은 assets/ 파일은 오래 캐시하고, index.html은 항상 새로 확인한다.
// - tRPC JSON 응답은 크기가 클 때 gzip으로 압축한다.

export type ContentEncoding = "br" | "gzip";

/** 빌드 때 미리 압축하는 확장자. scripts/precompress.mjs와 같은 목록을 쓴다. */
export const PRECOMPRESSIBLE_EXTENSIONS = new Set([".js", ".css", ".html", ".svg", ".json", ".webmanifest"]);

const ENCODING_SUFFIX: Record<ContentEncoding, string> = { br: ".br", gzip: ".gz" };
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

/** Accept-Encoding 헤더에서 받아들일 수 있는 방식 중 available 순서대로 먼저 맞는 것을 고른다. */
export function chooseEncoding<T extends string>(header: string | undefined, available: readonly T[]): T | null {
  if (!header) return null;
  const weights = new Map<string, number>();
  for (const part of header.split(",")) {
    const [name, ...params] = part.trim().toLowerCase().split(";");
    const key = name?.trim();
    if (!key) continue;
    let weight = 1;
    for (const param of params) {
      const match = param.trim().match(/^q=([0-9.]+)$/);
      if (match) weight = Number(match[1]);
    }
    weights.set(key, weight);
  }
  const wildcard = weights.get("*");
  for (const encoding of available) {
    if ((weights.get(encoding) ?? wildcard ?? 0) > 0) return encoding;
  }
  return null;
}

/** 파일 종류별 캐시 정책. express.static의 setHeaders와 미리 압축한 파일 응답이 함께 쓴다. */
export function setStaticHeaders(res: Response, filePath: string) {
  const normalized = filePath.split(path.sep).join("/");
  if (normalized.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
  else if (normalized.includes("/assets/")) res.setHeader("Cache-Control", IMMUTABLE_CACHE);
  else res.setHeader("Cache-Control", "public, max-age=3600");
  if (PRECOMPRESSIBLE_EXTENSIONS.has(path.extname(normalized))) res.setHeader("Vary", "Accept-Encoding");
}

function sendVariant(req: Request, res: Response, next: (error?: unknown) => void, file: string) {
  const ext = path.extname(file);
  const encoding = chooseEncoding<ContentEncoding>(req.headers["accept-encoding"], ["br", "gzip"]);
  if (!encoding) return next();
  const variant = `${file}${ENCODING_SUFFIX[encoding]}`;
  fs.stat(variant, (error, stat) => {
    if (error || !stat.isFile()) return next();
    res.type(ext);
    res.setHeader("Content-Encoding", encoding);
    setStaticHeaders(res, file);
    res.sendFile(variant, { dotfiles: "deny" }, (sendError) => {
      if (sendError && !res.headersSent) next(sendError);
    });
  });
}

/** 미리 압축한 .br/.gz 파일이 있으면 그것을 보내고, 없으면 다음 핸들러(express.static)로 넘긴다. */
export function servePrecompressed(root: string): RequestHandler {
  const resolvedRoot = path.resolve(root);
  return (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (!PRECOMPRESSIBLE_EXTENSIONS.has(path.extname(req.path))) return next();
    let relative: string;
    try {
      relative = decodeURIComponent(req.path);
    } catch {
      return next();
    }
    const file = path.join(resolvedRoot, relative);
    if (!file.startsWith(resolvedRoot + path.sep)) return next();
    sendVariant(req, res, next, file);
  };
}

/** SPA 진입 파일(index.html) 응답. 항상 새로 확인하게 하고 압축본이 있으면 압축본을 보낸다. */
export function serveIndexHtml(root: string): RequestHandler {
  const indexFile = path.resolve(root, "index.html");
  return (req, res, next) => {
    const fallback = (error?: unknown) => {
      if (error) return next(error);
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(indexFile, (sendError) => {
        if (sendError && !res.headersSent) next(sendError);
      });
    };
    sendVariant(req, res, fallback, indexFile);
  };
}

function normalizeEndArgs(args: unknown[]) {
  let [chunk, encoding, callback] = args;
  if (typeof chunk === "function") {
    callback = chunk;
    chunk = undefined;
    encoding = undefined;
  } else if (typeof encoding === "function") {
    callback = encoding;
    encoding = undefined;
  }
  return {
    chunk,
    encoding: typeof encoding === "string" ? (encoding as BufferEncoding) : undefined,
    callback: typeof callback === "function" ? (callback as () => void) : undefined,
  };
}

function chunkToBuffer(chunk: unknown, encoding?: BufferEncoding) {
  return typeof chunk === "string" ? Buffer.from(chunk, encoding) : Buffer.from(chunk as Uint8Array);
}

/**
 * JSON 응답을 gzip으로 압축한다(tRPC 응답). tRPC 어댑터는 본문을 write()로 나눠 쓰고 end()로 닫으므로,
 * 첫 write 시점에 JSON 응답인지 정해 본문을 모은 뒤 end()에서 한 번에 압축한다.
 * 크기가 작은 응답(로그인 등)은 압축 없이 그대로 보낸다. JSON이 아니거나 이미 압축된 응답은 건드리지 않는다.
 */
export function compressJsonResponses(minBytes = 1024): RequestHandler {
  return (req, res, next) => {
    if (!chooseEncoding<"gzip">(req.headers["accept-encoding"], ["gzip"])) return next();
    const originalWrite = res.write.bind(res) as (...args: unknown[]) => boolean;
    const originalEnd = res.end.bind(res) as (...args: unknown[]) => Response;
    const chunks: Buffer[] = [];
    let buffering: boolean | null = null;

    const shouldBuffer = () => {
      if (buffering === null) {
        buffering =
          !res.headersSent &&
          /json/i.test(String(res.getHeader("Content-Type") ?? "")) &&
          !res.getHeader("Content-Encoding") &&
          res.statusCode !== 204 &&
          res.statusCode !== 304;
      }
      return buffering;
    };

    res.write = ((chunk: unknown, encodingArg?: unknown, callback?: unknown) => {
      if (!shouldBuffer()) return originalWrite(chunk, encodingArg, callback);
      const done = typeof encodingArg === "function" ? encodingArg : callback;
      chunks.push(chunkToBuffer(chunk, typeof encodingArg === "string" ? (encodingArg as BufferEncoding) : undefined));
      if (typeof done === "function") (done as () => void)();
      return true;
    }) as typeof res.write;

    res.end = ((...args: unknown[]) => {
      if (!shouldBuffer()) return originalEnd(...args);
      const { chunk, encoding, callback } = normalizeEndArgs(args);
      if (chunk !== undefined && chunk !== null) chunks.push(chunkToBuffer(chunk, encoding));
      const body = Buffer.concat(chunks);
      if (body.length < minBytes) return originalEnd(body, callback);
      zlib.gzip(body, (error, compressed) => {
        if (error) return void originalEnd(body, callback);
        res.setHeader("Content-Encoding", "gzip");
        res.setHeader("Vary", "Accept-Encoding");
        res.setHeader("Content-Length", compressed.length);
        originalEnd(compressed, callback);
      });
      return res;
    }) as typeof res.end;
    next();
  };
}
