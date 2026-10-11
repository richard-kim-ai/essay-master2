import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { getLatestGuardianConsentStatusForUser } from "../db";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// 초등 과정 학생은 보호자(법정대리인) 동의가 유효한 동안만 이용할 수 있다. 로그인할 때만 확인하면
// 동의를 철회한 뒤에도 이미 발급된 로그인 세션이 계속 쓰이므로, 요청마다 확인한다(60초 캐시).
const GUARDIAN_STATUS_CACHE_MS = 60_000;
const guardianStatusCache = new Map<number, { status: string | null; checkedAt: number }>();

export function clearGuardianStatusCache(userId?: number) {
  if (userId === undefined) guardianStatusCache.clear();
  else guardianStatusCache.delete(userId);
}

async function guardianStatusOf(userId: number) {
  const cached = guardianStatusCache.get(userId);
  if (cached && Date.now() - cached.checkedAt < GUARDIAN_STATUS_CACHE_MS) return cached.status;
  const status = await getLatestGuardianConsentStatusForUser(userId);
  guardianStatusCache.set(userId, { status, checkedAt: Date.now() });
  return status;
}

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (ctx.user.role === "user" && ctx.user.tag === "초등") {
    const status = await guardianStatusOf(ctx.user.id);
    if (status && status !== "approved") {
      throw new TRPCError({ code: "FORBIDDEN", message: "보호자(법정대리인)의 동의가 확인되지 않아 이용할 수 없습니다. 보호자 동의 상태는 운영팀에 문의해 주세요." });
    }
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
