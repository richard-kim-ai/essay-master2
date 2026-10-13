// 빌드 산출물(dist/public)의 텍스트 파일을 brotli(.br)와 gzip(.gz)으로 미리 압축한다.
// 서버(server/_core/staticAssets.ts)가 Accept-Encoding에 맞춰 이 파일을 그대로 보낸다.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const ROOT = path.resolve(process.argv[2] ?? "dist/public");
// server/_core/staticAssets.ts의 PRECOMPRESSIBLE_EXTENSIONS와 같은 목록
const EXTENSIONS = new Set([".js", ".css", ".html", ".svg", ".json", ".webmanifest"]);
const MIN_BYTES = 1024;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

if (!fs.existsSync(ROOT)) {
  console.error(`[precompress] 폴더를 찾을 수 없습니다: ${ROOT}`);
  process.exit(1);
}

let files = 0;
let original = 0;
let brotli = 0;
for (const file of walk(ROOT)) {
  if (!EXTENSIONS.has(path.extname(file))) continue;
  const source = fs.readFileSync(file);
  if (source.length < MIN_BYTES) continue;
  const br = zlib.brotliCompressSync(source, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: source.length },
  });
  const gz = zlib.gzipSync(source, { level: 9 });
  fs.writeFileSync(`${file}.br`, br);
  fs.writeFileSync(`${file}.gz`, gz);
  files += 1;
  original += source.length;
  brotli += br.length;
}

console.log(`[precompress] ${files}개 파일 압축: ${(original / 1024).toFixed(0)}kB -> br ${(brotli / 1024).toFixed(0)}kB`);
