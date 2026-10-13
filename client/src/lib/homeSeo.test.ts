// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { HOME_SEO, applyHomeSeo } from "./homeSeo";

const html = readFileSync(`${process.cwd()}/client/index.html`, "utf8");
const length = (text: string) => Array.from(text).length;

describe("홈페이지 SEO 엄격한 길이 제한", () => {
  beforeEach(() => { document.head.innerHTML = "<title>기존 페이지</title>"; });

  it("제목 30~60자, 설명 50~160자, 키워드 3~8개 제한을 준수한다", () => {
    expect(length(HOME_SEO.title)).toBe(53);
    expect(length(HOME_SEO.title)).toBeGreaterThanOrEqual(30);
    expect(length(HOME_SEO.title)).toBeLessThanOrEqual(60);
    expect(length(HOME_SEO.description)).toBe(154);
    expect(length(HOME_SEO.description)).toBeGreaterThanOrEqual(50);
    expect(length(HOME_SEO.description)).toBeLessThanOrEqual(160);
    expect(HOME_SEO.keywords).toHaveLength(7);
    expect(HOME_SEO.keywords.length).toBeGreaterThanOrEqual(3);
    expect(HOME_SEO.keywords.length).toBeLessThanOrEqual(8);
    expect(new Set(HOME_SEO.keywords).size).toBe(HOME_SEO.keywords.length);
  });

  it("초기 HTML과 런타임 SEO가 동일하고 키워드 태그가 하나다", () => {
    expect(html.match(/<title>(.*?)<\/title>/)?.[1]).toBe(HOME_SEO.title);
    expect(html.match(/name="description" content="(.*?)"/)?.[1]).toBe(HOME_SEO.description);
    expect(html.match(/name="keywords" content="(.*?)"/)?.[1]).toBe(HOME_SEO.keywords.join(", "));
    expect(html.match(/name="keywords"/g)).toHaveLength(1);
  });

  it("document.title과 메타 태그를 설정하고 중복 없이 적용한 뒤 이전 상태를 복원한다", () => {
    const cleanup = applyHomeSeo();
    expect(document.title).toBe(HOME_SEO.title);
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(HOME_SEO.description);
    expect(document.querySelector('meta[name="keywords"]')?.getAttribute("content")).toBe(HOME_SEO.keywords.join(", "));
    const secondCleanup = applyHomeSeo();
    expect(document.querySelectorAll('meta[name="keywords"]')).toHaveLength(1);
    secondCleanup();
    cleanup();
    expect(document.title).toBe("기존 페이지");
    expect(document.querySelector('meta[name="keywords"]')).toBeNull();
  });
});
