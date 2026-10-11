// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ auth: { user: { id: 3, role: "user", tag: "중고등" } as any, loading: false }, recommendations: vi.fn(), navigate: vi.fn() }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => mock.auth }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({children}: any) => <main>{children}</main> }));
vi.mock("wouter", () => ({ useLocation: () => ["/mistake-notebook", mock.navigate] }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({curriculum: {getMistakes: {invalidate: vi.fn()}}}),
  curriculum: {
    getMistakes: {useQuery: () => ({data: [], isLoading: false})},
    getRecommendedQuestions: {useQuery: mock.recommendations},
    removeMistake: {useMutation: () => ({mutate: vi.fn()})},
    awardReviewKing: {useMutation: () => ({mutate: vi.fn()})},
  },
}}));
import MistakeNotebook from "./MistakeNotebook";
import { COURSE_OPTIONS } from "@shared/course";
let root: Root;let container: HTMLDivElement;
const rows = COURSE_OPTIONS.map(({value}) => ({id:value,courseType:value,level:2,lessonIndex:1,title:`문항-${value}`,prompt:'주장과 근거를 찾으세요.'}));
async function render() {await act(async () => root.render(<MistakeNotebook/>));}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();mock.auth={user:{id:3,role:'user',tag:'중고등'},loading:false};
  mock.recommendations.mockReturnValue({data:rows,isLoading:false});
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
});
afterEach(async () => {await act(async () => root.unmount());container.remove();});
describe('취약 영역 추천 내 과정 필터',()=>{
  it.each(COURSE_OPTIONS)('$label 학생에게 자기 과정 카드와 해당 레슨 연결만 제공한다',async ({value,label})=>{
    mock.auth.user.tag=label;await render();
    const start=Array.from(container.querySelectorAll('button')).filter(b=>b.textContent?.includes('지금 풀러 가기'));
    expect(start).toHaveLength(1);
    expect(container.textContent).toContain(`문항-${value}`);
    for(const c of COURSE_OPTIONS.filter(c=>c.value!==value))expect(container.textContent).not.toContain(`문항-${c.value}`);
    expect(container.textContent).toContain('2단계');
    await act(async()=>start[0].click());
    expect(mock.navigate).toHaveBeenCalledWith(`/workbook/${value}/2?lesson=1`);
  });
  it('인증 확인 중 추천 API를 호출하거나 다른 과정 샘플을 표시하지 않는다',async()=>{
    mock.auth={user:null,loading:true};await render();
    expect(mock.recommendations.mock.lastCall?.[1].enabled).toBe(false);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.textContent).not.toContain('문항-elementary');
    expect(container.textContent).not.toContain('소주제문과 뒷받침 문장 구분하기');
  });
  it('내 과정 문항이 없을 때 다른 과정 추천으로 대체하지 않는다',async()=>{
    mock.recommendations.mockReturnValue({data:rows.filter(r=>r.courseType==='elementary'),isLoading:false});await render();
    expect(container.textContent).toContain('현재 내 과정에 추천할 기출문제가 없습니다.');
    expect(container.textContent).not.toContain('문항-elementary');
  });
  it('계정이 바뀌면 기존 캐시의 이전 과정 문항을 숨긴다',async()=>{
    await render();mock.auth.user={id:4,role:'user',tag:'고등/대입'};await render();
    expect(container.textContent).toContain('문항-high_univ');
    expect(container.textContent).not.toContain('문항-middle_high');
  });
  it('비로그인 미리보기는 API 호출 없이 샘플을 유지한다',async()=>{
    mock.auth.user=null;await render();
    expect(mock.recommendations.mock.lastCall?.[1].enabled).toBe(false);
    expect(container.textContent).toContain('소주제문과 뒷받침 문장 구분하기');
  });
});
