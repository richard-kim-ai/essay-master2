type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  ip?: string;
};

// 요청자가 보낸 X-Forwarded-For 값은 위조할 수 있으므로 맨 앞 값을 믿으면 안 된다.
// 신뢰하는 프록시가 덧붙인 값은 목록의 오른쪽 끝에 있으므로, 오른쪽에서 hops번째 값을 사용한다.
// 프록시 없이 직접 노출되는 환경에서는 TRUSTED_PROXY_HOPS=0으로 두면 연결 주소만 사용한다.
export function getTrustedProxyHops(raw: string | undefined = process.env.TRUSTED_PROXY_HOPS): number {
  if (raw === undefined || raw.trim() === "") return 1;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 1;
}

export function resolveClientIp(req: RequestLike, trustedProxyHops = getTrustedProxyHops()): string {
  const forwarded = req.headers["x-forwarded-for"];
  const chain = (Array.isArray(forwarded) ? forwarded.join(",") : forwarded ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (trustedProxyHops > 0 && chain.length >= trustedProxyHops) {
    return chain[chain.length - trustedProxyHops];
  }
  return req.socket?.remoteAddress || req.ip || "unknown";
}
