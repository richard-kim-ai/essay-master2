// 수료증 보관 이미지(압축본) 검증.
// PDF는 발급 순간 브라우저에서만 만들어 내려받게 하고, 서버에는 압축 이미지(WebP/JPEG)만 보관한다.
// 브라우저가 보낸 값이므로 크기·형식을 서버에서 다시 확인한다.

export const MAX_ARCHIVE_IMAGE_BYTES = 300 * 1024;
/** base64 문자열 길이 상한(원본 300kB ≈ base64 400kB). 큰 입력은 디코딩하기 전에 거절한다. */
export const MAX_ARCHIVE_BASE64_LENGTH = Math.ceil((MAX_ARCHIVE_IMAGE_BYTES * 4) / 3) + 8;
/** 발급 후 이 시간 안에만 학습자가 직접 보관 이미지를 올릴 수 있다(관리자는 제한 없음). */
export const OWNER_ARCHIVE_WINDOW_MS = 30 * 60 * 1000;

export type ArchiveMimeType = "image/webp" | "image/jpeg";

function detectMimeType(bytes: Buffer): ArchiveMimeType | null {
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

/** base64 이미지가 WebP 또는 JPEG이고 크기 제한 안인지 확인한다. 통과하면 형식과 바이트 수를 돌려준다. */
export function parseArchiveImage(imageBase64: string): { mimeType: ArchiveMimeType; bytes: number } {
  if (typeof imageBase64 !== "string" || imageBase64.length === 0) throw new Error("보관 이미지가 비어 있습니다.");
  if (imageBase64.length > MAX_ARCHIVE_BASE64_LENGTH) throw new Error("보관 이미지가 너무 큽니다(최대 300kB).");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) throw new Error("보관 이미지 형식이 올바르지 않습니다.");
  const decoded = Buffer.from(imageBase64, "base64");
  if (decoded.length === 0 || decoded.length > MAX_ARCHIVE_IMAGE_BYTES) throw new Error("보관 이미지가 너무 큽니다(최대 300kB).");
  const mimeType = detectMimeType(decoded);
  if (!mimeType) throw new Error("보관 이미지는 WebP 또는 JPEG만 올릴 수 있습니다.");
  return { mimeType, bytes: decoded.length };
}

/** 학습자가 본인 수료증의 보관 이미지를 올릴 수 있는 시간(발급 직후)인지 판단한다. */
export function isWithinOwnerArchiveWindow(issuedAt: Date | string, now = new Date()) {
  const issuedMs = new Date(issuedAt).getTime();
  if (Number.isNaN(issuedMs)) return false;
  return now.getTime() - issuedMs <= OWNER_ARCHIVE_WINDOW_MS;
}
