const PRIVATE_IPV4 = /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;

export type EvaluationModelConnection = {
  modelId: string;
  endpoint: string;
  allowedDomains: string[];
  apiKey: string;
  timeoutMs: number;
};

export function validateExternalEvaluationEndpoint(endpoint: string, allowedDomains: string[]) {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { valid: false as const, message: "Endpoint URL 형식이 올바르지 않습니다." };
  }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:") return { valid: false as const, message: "외부 첨삭 Endpoint는 HTTPS만 사용할 수 있습니다." };
  if (hostname === "localhost" || hostname === "::1" || PRIVATE_IPV4.test(hostname) || hostname.startsWith("fe80:") || hostname.startsWith("fc") || hostname.startsWith("fd")) {
    return { valid: false as const, message: "localhost·사설 IP·링크 로컬 주소는 사용할 수 없습니다." };
  }
  const normalizedDomains = allowedDomains.map((domain) => domain.trim().toLowerCase()).filter(Boolean);
  const isAllowed = normalizedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  if (!isAllowed) return { valid: false as const, message: "Endpoint 호스트가 허용 도메인 목록에 없습니다." };
  return { valid: true as const, url, hostname };
}

export function normalizeAllowedDomains(domains: string[]) {
  return Array.from(new Set(domains.map((domain) => domain.trim().toLowerCase()).filter(Boolean)));
}
