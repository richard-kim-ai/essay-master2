import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { BookOpen, Lock } from "lucide-react";
import { COURSE_OPTIONS, type CourseType } from "@shared/course";
import { useLearningCourse } from "@/hooks/useLearningCourse";

const CURRICULUM_DATA = {
  elementary: [
    {
      level: 1,
      title: "재미있는 낱말과 문장",
      description: "낱말 익히기, 짧은 문장 만들기, 주어-서술어 찾기",
      topics: ["낱말의 뜻 이해하기", "문장 만들기", "주어와 서술어", "그림으로 배우기"],
    },
    {
      level: 2,
      title: "이야기 만들기",
      description: "그림 보고 이야기 꾸미기, 문장 이어 붙이기, 육하원칙 글쓰기",
      topics: ["그림으로 이야기 만들기", "문장 연결하기", "육하원칙 적용", "짧은 글 짓기"],
    },
    {
      level: 3,
      title: "생각 정리하기",
      description: "중요한 내용 찾기, 짧은 글 요약하기, 내 생각 말하기",
      topics: ["핵심 내용 찾기", "요약하기", "내 의견 표현하기", "글 구조 이해하기"],
    },
    {
      level: 4,
      title: "상상력 키우기",
      description: "동화 쓰기, 편지 쓰기, 일기 쓰기 (창의적 글쓰기)",
      topics: ["동화 창작", "편지 쓰기", "일기 쓰기", "창의적 표현"],
    },
  ],
  middle_high: [
    {
      level: 1,
      title: "문장의 기초",
      description: "정확한 어휘 선택, 문장 성분 호응, 경제성, 명료성, 정확성",
      topics: ["어휘 선택의 정확성", "문장 성분 호응", "경제적 표현", "명확한 표현", "AI 문장 교정 퀴즈"],
    },
    {
      level: 2,
      title: "단락의 논리적 연결",
      description: "소주제문과 뒷받침 문장, 연역/귀납/시간/공간적 전개",
      topics: ["소주제문 이해", "뒷받침 문장", "연역적 전개", "귀납적 전개", "단락 재구성 실습"],
    },
    {
      level: 3,
      title: "구조적 분석 및 요약",
      description: "서론-본론-결론 구조, 개요 작성, 요약 규칙 적용",
      topics: ["글의 구조 분석", "개요 작성", "요약 규칙", "핵심 추출", "실시간 요약 연습"],
    },
    {
      level: 4,
      title: "비판적 사고와 주제 설정",
      description: "제시문 분석, 자신의 견해 논증, 가주제에서 참주제로",
      topics: ["제시문 분석", "주장 구성", "주제 설정", "주제문 작성", "주제 설정 위저드"],
    },
  ],
  high_univ: [],
  general_adult: [],
};

export default function Curriculum() {
  const {
    effectiveCourse: courseType,
    courseLabel,
    canLearn,
    canPersist,
    canSelectCourse,
    needsSelection,
    mode,
    setCourseType,
  } = useLearningCourse();
  const isPublicSampleExperience = mode === "public-preview";
  const isStaffPreview = mode === "staff-preview";
  const queryCourse = courseType ?? "elementary";

  const { data: progressData } = trpc.progress.getByUser.useQuery(undefined, {
    // 진도는 학습자 자신의 가입 과정에서만 읽는다. 미리보기 계정은 0건으로 표시한다.
    enabled: canPersist,
  });
  const { data: memberCurriculum } = trpc.curriculum.getDynamicByType.useQuery(queryCourse, {
    enabled: canLearn && !isPublicSampleExperience,
  });
  // 비로그인 방문자는 공개해도 되는 과정 구성 정보만 조회한다.
  const { data: publicCurriculum, isLoading: publicCurriculumLoading } = trpc.curriculum.getPublicOverview.useQuery(queryCourse, {
    enabled: canLearn && isPublicSampleExperience,
  });
  const dynamicCurriculum = (isPublicSampleExperience ? publicCurriculum : memberCurriculum) as Array<{ id?: number; level: number; title: string; description: string; topics: string[]; aiSummary?: string | null; aiTags?: string[] }> | undefined;

  // 비로그인 방문자도 샘플 모드로 전체 커리큘럼을 바로 탐색할 수 있도록 허용

  const staticCurriculum = courseType ? CURRICULUM_DATA[courseType] : [];
  // 초등·중고등 과정의 레벨별 제목·학습 주제는 검수된 표준 커리큘럼을 항상 유지한다.
  // DB의 운영 메타데이터(AI 요약·태그·식별자)만 병합해 비동기 조회 뒤 주제가 바뀌는 현상을 막는다.
  const curriculumList = staticCurriculum.length > 0
    ? staticCurriculum.map((canonical) => {
      const managed = dynamicCurriculum?.find((item) => item.level === canonical.level);
      return managed ? { ...managed, ...canonical, id: managed.id, aiSummary: managed.aiSummary, aiTags: managed.aiTags } : canonical;
    })
    // 고등/대입·일반 과정은 조회된 과정 구성만 보여준다. 다른 과정의 내용으로 대체해 보여주면 잘못된 안내가 된다.
    : dynamicCurriculum ?? [];
  const progressMap = new Map(
    progressData?.map((p) => [p.curriculumId, p]) || []
  );

  const courseNames: Record<CourseType, string> = {
    elementary: "초등 논술 과정",
    middle_high: "중고등 논술 과정",
    high_univ: "고등 / 대입 논술 과정",
    general_adult: "일반 / 직장인 논술 과정",
  };

  return (
    <div className="bg-slate-50 py-12">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-full uppercase">
              {isPublicSampleExperience ? "공개 과정 탐색" : isStaffPreview ? "운영 탐색 미리보기" : "회원 맞춤 과정"}
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-1">{courseType ? courseNames[courseType] : "학습 과정 선택 필요"}</h1>
            <p className="text-sm text-slate-600 mt-1">{isPublicSampleExperience ? "과정을 고르고 단계별 학습 구성을 미리 확인해 보세요. 레슨 학습은 회원가입 후 7일 무료 체험으로 시작할 수 있습니다." : isStaffPreview ? "선택한 과정의 커리큘럼·워크북·학습 도구를 운영 점검용으로 탐색합니다. 학습자 진도에는 영향을 주지 않습니다." : needsSelection ? "가입 과정이 확인되지 않았습니다. 마이페이지에서 과정을 설정한 후 학습을 시작해 주세요." : `${courseLabel} 과정에 맞춘 단계별 학습 레슨과 실전 논술 훈련을 제공합니다.`}</p>
          </div>
          {canSelectCourse && <select aria-label={isStaffPreview ? "운영 탐색 커리큘럼 과정" : "공개 탐색 커리큘럼 과정"} value={queryCourse} onChange={(event) => setCourseType(event.target.value as CourseType)} className="h-10 rounded-lg border border-indigo-200 bg-white px-3 text-sm font-semibold text-indigo-900">{COURSE_OPTIONS.map((course) => <option key={course.value} value={course.value}>{course.label} 논술</option>)}</select>}
        </div>

        <div className="mt-6">
            {needsSelection && <Card className="border-amber-200 bg-amber-50"><CardContent className="flex flex-col items-center gap-3 py-10 text-center text-amber-950"><p className="font-semibold">가입 과정이 없어 학습 내용을 표시할 수 없습니다.</p><p className="text-sm">마이페이지에서 내 과정을 확인하거나 설정해 주세요.</p><Link href="/mypage"><Button className="bg-indigo-600 text-white hover:bg-indigo-700">마이페이지에서 과정 확인</Button></Link></CardContent></Card>}
            {!needsSelection && !canLearn && <Card><CardContent className="py-10 text-center text-slate-600">이 계정은 학습 과정을 탐색할 수 없습니다.</CardContent></Card>}
            {canLearn &&
            <div className="grid gap-6">
              {curriculumList.length === 0 && (
                <Card>
                  <CardContent className="py-10 text-center text-slate-600">
                    {publicCurriculumLoading ? "과정 구성을 불러오는 중입니다." : "이 과정의 커리큘럼 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}
                  </CardContent>
                </Card>
              )}
              {curriculumList.map((item) => {
                const curriculumId = (item as { id?: number }).id ?? item.level;
                const progress = progressMap.get(curriculumId) ?? progressMap.get(item.level);
                const isCompleted = progress?.completed === 1;
                const isDynamicCourse = courseType === "high_univ" || courseType === "general_adult";

                return (
                  <Card
                    key={`${courseType}-${(item as { id?: number }).id ?? item.level}`}
                    className={`hover:shadow-lg transition-shadow ${
                      isCompleted ? "border-green-200 bg-green-50" : ""
                    }`}
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-block bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-semibold">
                              Level {item.level}
                            </span>
                            {isCompleted && (
                              <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                                ✓ 완료
                              </span>
                            )}
                          </div>
                          <CardTitle className="text-2xl">{item.title}</CardTitle>
                          <CardDescription className="text-base mt-2">
                            {item.description}
                          </CardDescription>
                          {(item as { aiSummary?: string }).aiSummary && (
                            <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/70 p-3 text-sm leading-6 text-slate-700">
                              <span className="mr-2 font-semibold text-indigo-700">AI 강의 요약</span>
                              {(item as { aiSummary?: string }).aiSummary}
                            </div>
                          )}
                          {((item as { aiTags?: string[] }).aiTags ?? []).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="강의 특징 태그">
                              {((item as { aiTags?: string[] }).aiTags ?? []).map((tag) => <span key={tag} className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700">#{tag}</span>)}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-6">
                        <h4 className="font-semibold text-slate-900 mb-3">
                          학습 주제
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {item.topics.map((topic) => (
                            <div
                              key={topic}
                              className="flex items-center gap-2 text-slate-600"
                            >
                              <span className="text-indigo-600">•</span>
                              {topic}
                            </div>
                          ))}
                        </div>
                      </div>

                      {progress && (
                        <div className="mb-4 p-3 bg-indigo-50 rounded-lg">
                          <p className="text-sm text-slate-600">
                            현재 점수: <span className="font-semibold">{progress.score}점</span>
                          </p>
                          <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                            <div
                              className="bg-indigo-600 h-2 rounded-full transition-all"
                              style={{
                                width: `${Math.min(progress.score || 0, 100)}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {(item as { id?: number }).id && isDynamicCourse && <Link href={`/curriculum/${queryCourse}/${item.level}`}><Button variant="outline" className="mb-2 w-full gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50">강의 상세 보기 · 생성 예문</Button></Link>}
                      {!isPublicSampleExperience ? (
                        <Link href={`/workbook/${courseType}/${item.level}`}>
                          <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                            {isDynamicCourse ? "예문과 함께 강의 열기" : isCompleted ? "다시 풀기" : "시작하기"}
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`/signup?trial=1&course=${courseType}`}>
                          <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">가입하고 7일 무료 체험으로 시작하기</Button>
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            }
          </div>
      </div>
    </div>
  );
}
