import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./essayWorkspace",()=>({syncEssayDraft:vi.fn(),getEssayWorkspace:vi.fn(),requestEssayTeacherFeedback:vi.fn()}));
vi.mock("./db",async(importOriginal)=>{const actual=await importOriginal<typeof import('./db')>();return {...actual,getEssaySubmissionById:vi.fn(),getLatestGuardianConsentStatusForUser:vi.fn()};});
import {appRouter} from './routers';
import * as workspace from './essayWorkspace';
import * as db from './db';
const caller=(user:any)=>appRouter.createCaller({user,req:{headers:{}},res:{}} as any);
const student={id:77,openId:'testing-student',role:'user',tag:'중고등',createdAt:new Date('2020-01-01')};
const aiInput={essayId:7,essayTitle:'내 글',essayContent:'학생과 교사가 함께 학교 규칙을 정하는 것이 바람직하다. 각자의 의견을 듣고 공통 기준을 마련해야 한다.',courseType:'middle_high' as const,level:1};
beforeEach(()=>vi.clearAllMocks());
describe('글 작업공간 API 세션과 AI 원문 보호',()=>{
 it('동기화·목록·교사 요청은 비로그인 상태에서 차단한다',async()=>{
  const guest=caller(null);
  await expect(guest.essaySubmission.workspace()).rejects.toMatchObject({code:'UNAUTHORIZED'});
  await expect(guest.essaySubmission.syncDraft({clientId:'local_123',title:'제목',content:'본문'})).rejects.toMatchObject({code:'UNAUTHORIZED'});
  await expect(guest.essaySubmission.requestTeacher({essayId:7})).rejects.toMatchObject({code:'UNAUTHORIZED'});
  expect(workspace.syncEssayDraft).not.toHaveBeenCalled();
 });
 it('브라우저 owner가 아닌 세션 사용자 ID로만 서비스에 전달한다',async()=>{
  vi.mocked(workspace.syncEssayDraft).mockResolvedValue({id:7,userId:77} as any);
  const input={clientId:'local_123',title:'제목',content:'본문'};
  await caller(student).essaySubmission.syncDraft(input);
  expect(workspace.syncEssayDraft).toHaveBeenCalledWith(77,input);
 });
 it('AI 원문 글 소유자가 다르면 평가 호출 이전에 차단한다',async()=>{
  vi.mocked(db.getEssaySubmissionById).mockResolvedValue({id:7,userId:88,title:aiInput.essayTitle,content:aiInput.essayContent} as any);
  await expect(caller(student).aiAutoFeedback.create(aiInput)).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('서버 동기화 전 본문이면 AI 원문 연결 요청을 거절한다',async()=>{
  vi.mocked(db.getEssaySubmissionById).mockResolvedValue({id:7,userId:77,title:aiInput.essayTitle,content:'아직 서버에는 다른 본문'} as any);
  await expect(caller(student).aiAutoFeedback.create(aiInput)).rejects.toMatchObject({code:'CONFLICT'});
 });
 it('학생은 저장한 글 평가 과정도 다른 과정으로 변경할 수 없다',async()=>{
  vi.mocked(db.getEssaySubmissionById).mockResolvedValue({id:7,userId:77,title:aiInput.essayTitle,content:aiInput.essayContent} as any);
  await expect(caller(student).aiAutoFeedback.create({...aiInput,courseType:'elementary'})).rejects.toMatchObject({code:'FORBIDDEN'});
 });
});
