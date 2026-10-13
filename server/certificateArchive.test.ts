import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getCertificateById: vi.fn(),
    getCertificateArchive: vi.fn(),
    saveCertificateArchive: vi.fn(),
  };
});

import * as db from "./db";
import { appRouter } from "./routers";
import { MAX_ARCHIVE_IMAGE_BYTES, isWithinOwnerArchiveWindow, parseArchiveImage } from "./certificateArchive";
import type { TrpcContext } from "./_core/context";

function callerFor(user: Record<string, unknown> | null) {
  const ctx = { user, req: { protocol: "https", headers: { host: "essay.example.com" }, socket: {} } as any, res: {} as any } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

function webp(extraBytes = 20) {
  return Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP"), Buffer.alloc(extraBytes, 1)]).toString("base64");
}
function jpeg() {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20, 2)]).toString("base64");
}

const owner = { id: 7, role: "user", tag: "초등", name: "학생" };
const admin = { id: 1, role: "admin", name: "관리자" };
const freshCertificate = { id: 50, userId: 7, status: "active", issuedAt: new Date() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.saveCertificateArchive).mockResolvedValue(true);
});

describe("보관 이미지 검증", () => {
  it("WebP와 JPEG만 받고 형식·크기를 돌려준다", () => {
    expect(parseArchiveImage(webp())).toMatchObject({ mimeType: "image/webp" });
    expect(parseArchiveImage(jpeg())).toMatchObject({ mimeType: "image/jpeg" });
  });

  it("PNG·SVG·잘못된 base64는 거절한다", () => {
    expect(() => parseArchiveImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]).toString("base64"))).toThrow("WebP 또는 JPEG");
    expect(() => parseArchiveImage(Buffer.from("<svg onload=alert(1)>").toString("base64"))).toThrow("WebP 또는 JPEG");
    expect(() => parseArchiveImage("data:image/webp;base64,AAAA")).toThrow("형식");
    expect(() => parseArchiveImage("")).toThrow("비어");
  });

  it("300kB를 넘는 이미지는 거절한다", () => {
    const huge = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP"), Buffer.alloc(MAX_ARCHIVE_IMAGE_BYTES, 1)]).toString("base64");
    expect(() => parseArchiveImage(huge)).toThrow("너무 큽니다");
  });

  it("학습자는 발급 후 30분 안에만 올릴 수 있다", () => {
    const now = new Date("2026-10-13T12:00:00Z");
    expect(isWithinOwnerArchiveWindow(new Date("2026-10-13T11:40:00Z"), now)).toBe(true);
    expect(isWithinOwnerArchiveWindow(new Date("2026-10-13T11:20:00Z"), now)).toBe(false);
    expect(isWithinOwnerArchiveWindow("not-a-date", now)).toBe(false);
  });
});

describe("certificate.saveArchive", () => {
  it("본인 수료증을 발급 직후에 올리면 저장한다", async () => {
    vi.mocked(db.getCertificateById).mockResolvedValue(freshCertificate as any);
    const result = await callerFor(owner).certificate.saveArchive({ certificateId: 50, imageBase64: webp() });
    expect(result.saved).toBe(true);
    expect(db.saveCertificateArchive).toHaveBeenCalledWith(expect.objectContaining({ certificateId: 50, mimeType: "image/webp", createdBy: 7 }));
  });

  it("다른 사람의 수료증, 시간이 지난 수료증, 취소된 수료증은 학습자가 올릴 수 없다", async () => {
    vi.mocked(db.getCertificateById).mockResolvedValue({ ...freshCertificate, userId: 99 } as any);
    await expect(callerFor(owner).certificate.saveArchive({ certificateId: 50, imageBase64: webp() })).rejects.toMatchObject({ code: "FORBIDDEN" });

    vi.mocked(db.getCertificateById).mockResolvedValue({ ...freshCertificate, issuedAt: new Date(Date.now() - 3 * 60 * 60 * 1000) } as any);
    await expect(callerFor(owner).certificate.saveArchive({ certificateId: 50, imageBase64: webp() })).rejects.toMatchObject({ code: "FORBIDDEN" });

    vi.mocked(db.getCertificateById).mockResolvedValue({ ...freshCertificate, status: "revoked" } as any);
    await expect(callerFor(owner).certificate.saveArchive({ certificateId: 50, imageBase64: webp() })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.saveCertificateArchive).not.toHaveBeenCalled();
  });

  it("관리자는 시간이 지난 수료증에도 올릴 수 있고, 잘못된 파일은 거절된다", async () => {
    vi.mocked(db.getCertificateById).mockResolvedValue({ ...freshCertificate, issuedAt: new Date("2026-01-01") } as any);
    await callerFor(admin).certificate.saveArchive({ certificateId: 50, imageBase64: jpeg() });
    expect(db.saveCertificateArchive).toHaveBeenCalledWith(expect.objectContaining({ mimeType: "image/jpeg", createdBy: 1 }));

    await expect(callerFor(admin).certificate.saveArchive({ certificateId: 50, imageBase64: Buffer.from("not an image").toString("base64") })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("이미 보관된 수료증은 덮어쓰지 않는다", async () => {
    vi.mocked(db.getCertificateById).mockResolvedValue(freshCertificate as any);
    vi.mocked(db.saveCertificateArchive).mockRejectedValue(new Error("이미 보관된 수료증 이미지가 있습니다."));
    await expect(callerFor(owner).certificate.saveArchive({ certificateId: 50, imageBase64: webp() })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "이미 보관된 수료증 이미지가 있습니다." });
  });

  it("로그인하지 않으면 올릴 수 없다", async () => {
    await expect(callerFor(null).certificate.saveArchive({ certificateId: 50, imageBase64: webp() })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("admin.getCertificateArchive", () => {
  it("관리자만 보관 이미지를 볼 수 있다", async () => {
    vi.mocked(db.getCertificateArchive).mockResolvedValue({ mimeType: "image/webp", bytes: 30, imageData: webp(), createdAt: new Date() } as any);
    const result = await callerFor(admin).admin.getCertificateArchive({ certificateId: 50 });
    expect(result?.mimeType).toBe("image/webp");
    await expect(callerFor(owner).admin.getCertificateArchive({ certificateId: 50 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("보관본이 없으면 null을 돌려준다", async () => {
    vi.mocked(db.getCertificateArchive).mockResolvedValue(undefined);
    expect(await callerFor(admin).admin.getCertificateArchive({ certificateId: 51 })).toBeNull();
  });
});
