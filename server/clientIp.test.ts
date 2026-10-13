import { describe, expect, it } from "vitest";
import { getTrustedProxyHops, resolveClientIp } from "./clientIp";

describe("resolveClientIp", () => {
  it("요청자가 앞에 끼워 넣은 X-Forwarded-For 값은 무시하고 프록시가 덧붙인 값을 사용한다", () => {
    const req = { headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9" }, socket: { remoteAddress: "10.0.0.1" } };
    expect(resolveClientIp(req, 1)).toBe("203.0.113.9");
  });

  it("값을 바꿔 보내도 같은 접속자는 같은 IP로 판별된다", () => {
    const first = resolveClientIp({ headers: { "x-forwarded-for": "1.1.1.1, 203.0.113.9" } }, 1);
    const second = resolveClientIp({ headers: { "x-forwarded-for": "2.2.2.2, 203.0.113.9" } }, 1);
    expect(first).toBe(second);
  });

  it("프록시가 둘이면 오른쪽에서 두 번째 값을 사용한다", () => {
    const req = { headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9, 198.51.100.7" } };
    expect(resolveClientIp(req, 2)).toBe("203.0.113.9");
  });

  it("헤더가 없거나 신뢰 프록시가 0이면 연결 주소를 사용한다", () => {
    expect(resolveClientIp({ headers: {}, socket: { remoteAddress: "10.0.0.1" } }, 1)).toBe("10.0.0.1");
    expect(resolveClientIp({ headers: { "x-forwarded-for": "6.6.6.6" }, socket: { remoteAddress: "10.0.0.1" } }, 0)).toBe("10.0.0.1");
    expect(resolveClientIp({ headers: {} }, 1)).toBe("unknown");
  });

  it("신뢰 프록시 수 설정이 비었거나 잘못되면 1을 사용한다", () => {
    expect(getTrustedProxyHops(undefined)).toBe(1);
    expect(getTrustedProxyHops("")).toBe(1);
    expect(getTrustedProxyHops("abc")).toBe(1);
    expect(getTrustedProxyHops("-2")).toBe(1);
    expect(getTrustedProxyHops("0")).toBe(0);
    expect(getTrustedProxyHops("2")).toBe(2);
  });
});
