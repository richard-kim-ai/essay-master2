// 메일(인증·비밀번호 재설정) 속 링크의 주소를 만드는 규칙.
// 링크의 도메인을 요청자가 정하게 하면, 서비스가 보낸 정상 메일로 피해자를 다른 사이트에 보내 토큰을 가로챌 수 있다.
// 그래서 서버 설정(PUBLIC_BASE_URL)을 우선하고, 없을 때만 현재 요청의 주소를 쓴다.

type RequestLike = { protocol: string; headers: Record<string, unknown> };

export function requestOrigin(req: RequestLike) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto?.toString().split(",")[0])?.trim() || req.protocol || "https";
  const host = req.headers.host?.toString() || "localhost:3000";
  return `${protocol}://${host}`;
}

export function configuredPublicOrigin(value = process.env.PUBLIC_BASE_URL): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function publicBaseUrl(req: RequestLike, configured: string | undefined = process.env.PUBLIC_BASE_URL) {
  return configuredPublicOrigin(configured) ?? requestOrigin(req);
}
