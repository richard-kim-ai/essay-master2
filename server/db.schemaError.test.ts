import { describe, expect, it } from "vitest";
import { getUsersSchemaMismatchMessage } from "./db";

describe("getUsersSchemaMismatchMessage", () => {
  it("adds an actionable migration hint for missing users columns", () => {
    const error = new Error("Failed query: select `avatarUrl` from `users`");
    error.cause = new Error("Unknown column 'users.avatarUrl' in 'field list'");

    expect(getUsersSchemaMismatchMessage(error)).toBe(
      "users 테이블 스키마가 현재 코드와 맞지 않습니다. 설정된 DATABASE_URL에 대해 `pnpm db:migrate`를 실행하거나 로컬 DB라면 `pnpm local-db:up`을 다시 실행해주세요. 누락된 컬럼: users.avatarUrl.",
    );
  });

  it("ignores unrelated database errors", () => {
    expect(getUsersSchemaMismatchMessage(new Error("Access denied"))).toBeNull();
  });
});
