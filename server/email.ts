import { createHash, randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
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

// 로그인처럼 동시에 많이 호출되는 곳에서는 서버 전체를 멈추지 않도록 비동기로 검증한다.
const scryptAsync = promisify(scrypt) as (password: string, salt: string, keylen: number) => Promise<Buffer>;

export async function verifyPasswordAsync(password: string, storedHash: string) {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) return false;

  const actual = await scryptAsync(password, salt, PASSWORD_KEY_LENGTH);
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

export async function sendGuardianConsentEmail({
  to,
  guardianName,
  childName,
  consentUrl,
}: {
  to: string;
  guardianName: string;
  childName: string;
  consentUrl: string;
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
      subject: "[논술 마스터] 만 14세 미만 자녀의 회원가입에 대한 법정대리인 동의 요청",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.7;color:#172033;max-width:560px;margin:0 auto">
          <h1 style="color:#2563eb">논술 마스터</h1>
          <p>${escapeHtml(guardianName)}님, 안녕하세요.</p>
          <p>${escapeHtml(childName)} 학생이 논술 마스터에 회원가입을 신청하며 보호자님을 법정대리인으로 입력했습니다. 「개인정보 보호법」에 따라 만 14세 미만 아동의 개인정보를 수집·이용하려면 법정대리인의 동의가 필요합니다.</p>
          <p>아래 버튼을 눌러 동의서 내용을 확인하고 동의 여부를 선택해 주세요. 동의하시기 전에는 자녀가 서비스를 이용할 수 없습니다.</p>
          <p><a href="${escapeHtml(consentUrl)}" style="display:inline-block;background:#2563eb;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">동의서 확인하고 동의하기</a></p>
          <p style="font-size:13px;color:#64748b">이 링크는 14일 동안 유효합니다. 자녀의 가입을 모르거나 동의하지 않으신다면 이 메일을 무시해 주세요. 동의하지 않으면 자녀의 가입은 완료되지 않습니다.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Guardian consent email failed: ${response.status} ${detail}`);
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

/** 관리자가 보내는 공지 메일. 본문은 일반 텍스트로 받아 HTML로 안전하게 바꿔 보낸다. */
export async function sendAnnouncementEmail({
  to,
  name,
  subject,
  body,
}: {
  to: string;
  name: string;
  subject: string;
  body: string;
}) {
  if (!ENV.resendApiKey || !ENV.emailFrom) {
    throw new Error("Email delivery is not configured");
  }

  const paragraphs = body
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: ENV.emailFrom,
      to: [to],
      subject: subject.slice(0, 150),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.7;color:#172033;max-width:560px;margin:0 auto">
          <h1 style="color:#4338ca">논술 마스터</h1>
          <p>${escapeHtml(name)}님, 안녕하세요.</p>
          ${paragraphs}
          <p style="font-size:13px;color:#64748b">이 메일은 논술 마스터 운영팀이 회원님께 보낸 공지입니다.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Announcement email failed: ${response.status} ${detail}`);
  }
}
