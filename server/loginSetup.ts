// 이메일·비밀번호 로그인 설정 스크립트(scripts/set-login-password.mts)의 판단 로직.
// Manus 로그인으로만 만들어진 계정은 비밀번호·이메일 인증 값이 비어 있어 이메일 로그인이 불가능하다.
// 이미 있는 이메일에는 createAdminAccount가 쓰이지 않으므로, 기존 계정에 비밀번호를 설정하거나 새 관리자를 만든다.

export const MIN_LOGIN_PASSWORD_LENGTH = 10;

export type ExistingLoginUser = {
  id: number;
  email: string | null;
  passwordHash: string | null;
  emailVerifiedAt: Date | string | null;
  loginMethod: string | null;
  role: string;
};

export type LoginSetupPlan =
  | { action: "create_admin"; needsName: boolean }
  | { action: "update"; hadPassword: boolean; verifyEmail: boolean; promoteToAdmin: boolean; setLoginMethod: boolean };

export function normalizeLoginEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validateLoginPassword(password: string) {
  if (password.length < MIN_LOGIN_PASSWORD_LENGTH) return `비밀번호는 ${MIN_LOGIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;
  if (password.length > 128) return "비밀번호는 128자 이하여야 합니다.";
  return null;
}

/** 계정이 없으면 관리자를 새로 만들고, 있으면 비밀번호를 설정하며 필요한 값(이메일 인증·로그인 방식)을 채운다. */
export function planLoginSetup(existing: ExistingLoginUser | undefined, options: { makeAdmin: boolean; name?: string }): LoginSetupPlan {
  if (!existing) return { action: "create_admin", needsName: !options.name || options.name.trim().length < 2 };
  return {
    action: "update",
    hadPassword: Boolean(existing.passwordHash),
    verifyEmail: !existing.emailVerifiedAt,
    promoteToAdmin: options.makeAdmin && existing.role !== "admin",
    setLoginMethod: !existing.loginMethod,
  };
}
