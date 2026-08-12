import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { ENV } from "./_core/env";

const PASSWORD_KEY_LENGTH = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) return false;

  const actual = scryptSync(password, salt, PASSWORD_KEY_LENGTH);
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export function createVerificationToken() {
  return randomBytes(32).toString("hex");
}

export function hashVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}: {
  to: string;
  name: string;
  resetUrl: string;
}) {
  if (!ENV.resendApiKey || !ENV.emailFrom) {
    throw new Error("Email delivery is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: ENV.emailFrom,
      to: [to],
      subject: "논술 마스터 비밀번호 재설정 안내",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.7;color:#172033;max-width:560px;margin:0 auto">
          <h1 style="color:#2563eb">논술 마스터</h1>
          <p>${escapeHtml(name)}님, 비밀번호 재설정 요청을 받았습니다.</p>
          <p>아래 버튼을 눌러 새 비밀번호를 설정해 주세요.</p>
          <p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#2563eb;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">비밀번호 재설정</a></p>
          <p style="font-size:13px;color:#64748b">이 링크는 1시간 동안 유효합니다. 요청하지 않았다면 이 메일을 무시해 주세요.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Password reset email failed: ${response.status} ${detail}`);
  }
}

export async function sendVerificationEmail({
  to,
  name,
  verificationUrl,
}: {
  to: string;
  name: string;
  verificationUrl: string;
}) {
  if (!ENV.resendApiKey || !ENV.emailFrom) {
    throw new Error("Email delivery is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: ENV.emailFrom,
      to: [to],
      subject: "논술 마스터 이메일 인증을 완료해 주세요",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.7;color:#172033;max-width:560px;margin:0 auto">
          <h1 style="color:#2563eb">논술 마스터</h1>
          <p>${escapeHtml(name)}님, 회원가입을 환영합니다.</p>
          <p>아래 버튼을 눌러 이메일 인증을 완료하면 학습 기록을 안전하게 저장할 수 있습니다.</p>
          <p><a href="${escapeHtml(verificationUrl)}" style="display:inline-block;background:#2563eb;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">이메일 인증하기</a></p>
          <p style="font-size:13px;color:#64748b">이 링크는 24시간 동안 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email delivery failed: ${response.status} ${detail}`);
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });
}
