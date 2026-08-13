import { randomBytes } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { decryptSecret } from "./security";

type Provider = "google" | "kakao" | "naver";
type ProviderProfile = { id: string; email: string | null; name: string | null };

const PROVIDERS: Record<Provider, { label: string; scopes: string[] }> = {
  google: { label: "Google", scopes: ["openid", "email", "profile"] },
  kakao: { label: "카카오", scopes: ["profile_nickname", "account_email"] },
  naver: { label: "네이버", scopes: ["name", "email", "profile_image"] },
};

function isProvider(value: string): value is Provider {
  return value === "google" || value === "kakao" || value === "naver";
}

function safeOrigin(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function callbackUrl(origin: string, provider: Provider) {
  return `${origin}/api/social/${provider}/callback`;
}

function stateCookie(provider: Provider) {
  return `social-state-${provider}`;
}

function encodeState(value: { state: string; origin: string }) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeState(value: string) {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { state?: string; origin?: string };
    return parsed.state && parsed.origin ? { state: parsed.state, origin: parsed.origin } : null;
  } catch {
    return null;
  }
}

function providerConfig(provider: Provider) {
  return db.getSocialProviderConfig(provider);
}

async function fetchProviderProfile(provider: Provider, code: string, redirectUri: string, clientId: string, clientSecret: string): Promise<ProviderProfile> {
  if (provider === "google") {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }) });
    if (!tokenResponse.ok) throw new Error("Google token exchange failed");
    const token = await tokenResponse.json() as { access_token?: string };
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token || ""}` } });
    if (!profileResponse.ok) throw new Error("Google profile request failed");
    const profile = await profileResponse.json() as { sub?: string; email?: string; name?: string };
    if (!profile.sub) throw new Error("Google profile id is missing");
    return { id: profile.sub, email: profile.email ?? null, name: profile.name ?? null };
  }

  if (provider === "kakao") {
    const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code }) });
    if (!tokenResponse.ok) throw new Error("Kakao token exchange failed");
    const token = await tokenResponse.json() as { access_token?: string };
    const profileResponse = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: `Bearer ${token.access_token || ""}` } });
    if (!profileResponse.ok) throw new Error("Kakao profile request failed");
    const profile = await profileResponse.json() as { id?: number; kakao_account?: { email?: string; profile?: { nickname?: string } } };
    if (!profile.id) throw new Error("Kakao profile id is missing");
    return { id: String(profile.id), email: profile.kakao_account?.email ?? null, name: profile.kakao_account?.profile?.nickname ?? null };
  }

  const tokenResponse = await fetch("https://nid.naver.com/oauth2.0/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code }) });
  if (!tokenResponse.ok) throw new Error("Naver token exchange failed");
  const token = await tokenResponse.json() as { access_token?: string };
  const profileResponse = await fetch("https://openapi.naver.com/v1/nid/me", { headers: { Authorization: `Bearer ${token.access_token || ""}` } });
  if (!profileResponse.ok) throw new Error("Naver profile request failed");
  const body = await profileResponse.json() as { response?: { id?: string; email?: string; name?: string; nickname?: string } };
  const profile = body.response;
  if (!profile?.id) throw new Error("Naver profile id is missing");
  return { id: profile.id, email: profile.email ?? null, name: profile.name ?? profile.nickname ?? null };
}

async function signInWithProfile(provider: Provider, profile: ProviderProfile, res: Response, req: Request) {
  const openId = `${provider}_${profile.id}`.slice(0, 64);
  let user = await db.getUserByOpenId(openId);
  if (!user && profile.email) user = await db.getUserByEmail(profile.email.toLowerCase());
  if (user) {
    if (user.openId === openId) {
      user = await db.updateUserSocialIdentity(user.id, openId, profile.name, profile.email?.toLowerCase() ?? user.email, provider);
    } else {
      await db.updateUserSocialProfile(user.id, { name: profile.name ?? undefined, email: profile.email?.toLowerCase() ?? undefined, loginMethod: provider });
      user = await db.getUserById(user.id);
    }
  } else {
    user = await db.createEmailUser({ openId, name: profile.name, email: profile.email?.toLowerCase() ?? null, loginMethod: provider, emailVerifiedAt: new Date() });
  }
  if (!user) throw new Error("Social account could not be created");
  const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "학습자" });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
}

export function registerSocialOAuthRoutes(app: Express) {
  app.get("/api/social/:provider/start", async (req: Request, res: Response) => {
    const provider = req.params.provider;
    if (!isProvider(provider)) { res.status(404).send("Unknown provider"); return; }
    const origin = safeOrigin(req.query.origin);
    if (!origin) { res.status(400).send("Invalid origin"); return; }
    const config = await providerConfig(provider);
    if (!config?.enabled || !config.clientId || !config.clientSecretEncrypted) {
      res.redirect(`${origin}/login?social=unavailable&provider=${provider}`);
      return;
    }
    const state = randomBytes(24).toString("hex");
    res.cookie(stateCookie(provider), encodeState({ state, origin }), { httpOnly: true, secure: req.protocol === "https", sameSite: "lax", path: "/", maxAge: 600 });
    const redirectUri = callbackUrl(origin, provider);
    const authorizeUrl = provider === "google"
      ? `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: config.clientId, redirect_uri: redirectUri, response_type: "code", scope: PROVIDERS[provider].scopes.join(" "), state }).toString()}`
      : provider === "kakao"
        ? `https://kauth.kakao.com/oauth/authorize?${new URLSearchParams({ client_id: config.clientId, redirect_uri: redirectUri, response_type: "code", scope: PROVIDERS[provider].scopes.join(","), state }).toString()}`
        : `https://nid.naver.com/oauth2.0/authorize?${new URLSearchParams({ response_type: "code", client_id: config.clientId, redirect_uri: redirectUri, state }).toString()}`;
    res.redirect(authorizeUrl);
  });

  app.get("/api/social/:provider/callback", async (req: Request, res: Response) => {
    const provider = req.params.provider;
    if (!isProvider(provider)) { res.status(404).send("Unknown provider"); return; }
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const stored = cookies[stateCookie(provider)] ? decodeState(cookies[stateCookie(provider)]) : null;
    res.clearCookie(stateCookie(provider), { httpOnly: true, secure: req.protocol === "https", sameSite: "lax", path: "/" });
    const origin = stored?.origin || "/login";
    if (!state || !stored || state !== stored.state) { res.redirect(`${origin}/login?social=error&provider=${provider}`); return; }
    try {
      const config = await providerConfig(provider);
      if (!config?.enabled || !config.clientId || !config.clientSecretEncrypted) throw new Error("Social provider is not configured");
      const secret = decryptSecret(config.clientSecretEncrypted);
      const redirectOrigin = origin;
      const profile = await fetchProviderProfile(provider, String(req.query.code || ""), callbackUrl(redirectOrigin, provider), config.clientId, secret);
      await signInWithProfile(provider, profile, res, req);
      res.redirect(`${redirectOrigin}/`);
    } catch (error) {
      console.error(`[Social OAuth] ${provider} callback failed`, error);
      const redirectOrigin = origin;
      res.redirect(`${redirectOrigin}/login?social=error&provider=${provider}`);
    }
  });
}
