import { useAuth } from "@/_core/hooks/useAuth";
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { BookOpen, Lock } from "lucide-react";
import { getCourseTypeFromUserTag, type CourseType } from "@shared/course";
import { ADMIN_PREVIEW_COURSES, readAdminPreviewCourse, saveAdminPreviewCourse } from "@/lib/adminPreviewCourse";

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
  const { user, isAuthenticated } = useAuth();
  const userCourse = getCourseTypeFromUserTag(user?.tag);
  const isSampleUser = Boolean(user?.email?.includes("@sample.com") || user?.email?.includes("@sample."));
  const isAdminPreview = user?.role === "admin";
  const [sampleCourse, setSampleCourse] = React.useState<CourseType>(() => {
    const stored = localStorage.getItem("essaymaster-sample-course");
    return ["elementary", "middle_high", "high_univ", "general_adult"].includes(stored || "") ? stored as CourseType : "elementary";
  });
  const [adminPreviewCourse, setAdminPreviewCourse] = React.useState<CourseType>(() => readAdminPreviewCourse());
  const courseType = isSampleUser ? sampleCourse : isAdminPreview ? adminPreviewCourse : userCourse;

  const { data: progressData } = trpc.progress.getByUser.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: dynamicCurriculum } = trpc.curriculum.getDynamicByType.useQuery(courseType, {
    enabled: isAuthenticated,
  });

  // 비로그인 방문자도 샘플 모드로 전체 커리큘럼을 바로 탐색할 수 있도록 허용

  const staticCurriculum = CURRICULUM_DATA[courseType] || CURRICULUM_DATA["middle_high"];
  // 초등·중고등 과정의 레벨별 제목·학습 주제는 검수된 표준 커리큘럼을 항상 유지한다.
  // DB의 운영 메타데이터(AI 요약·태그·식별자)만 병합해 비동기 조회 뒤 주제가 바뀌는 현상을 막는다.
  const curriculumList = staticCurriculum.length > 0
    ? staticCurriculum.map((canonical) => {
      const managed = dynamicCurriculum?.find((item) => item.level === canonical.level);
      return managed ? { ...managed, ...canonical, id: managed.id, aiSummary: managed.aiSummary, aiTags: managed.aiTags } : canonical;
    })
    : dynamicCurriculum && dynamicCurriculum.length > 0 ? dynamicCurriculum : CURRICULUM_DATA["middle_high"];
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
    <div className="min-h-screen bg-gray-50 py-12">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-full uppercase">
              {isSampleUser ? "샘플 맞춤 과정" : isAdminPreview ? "관리자 탐색 미리보기" : "회원 맞춤 과정"}
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mt-1">{courseNames[courseType]}</h1>
            <p className="text-sm text-slate-600 mt-1">{isSampleUser ? "샘플에서 선택한 과정의 단계별 레슨을 체험하세요. 회원가입 후 학습 기록을 이어갈 수 있습니다." : isAdminPreview ? "선택한 과정의 커리큘럼·워크북·학습 도구를 운영 점검용으로 탐색합니다. 학습자 진도에는 영향을 주지 않습니다." : "회원가입 시 선택하신 과정에 최적화된 단계별 학습 레슨과 실전 논술 훈련을 제공합니다."}</p>
          </div>
          {(isSampleUser || isAdminPreview) && <select aria-label={isAdminPreview ? "관리자 탐색 커리큘럼 과정" : "샘플 커리큘럼 과정"} value={isAdminPreview ? adminPreviewCourse : sampleCourse} onChange={(event) => { const course = event.target.value as CourseType; if (isAdminPreview) { setAdminPreviewCourse(course); saveAdminPreviewCourse(course); } else { setSampleCourse(course); localStorage.setItem("essaymaster-sample-course", course); } }} className="h-10 rounded-lg border border-indigo-200 bg-white px-3 text-sm font-semibold text-indigo-900">{ADMIN_PREVIEW_COURSES.map((course) => <option key={course.value} value={course.value}>{course.label}</option>)}</select>}
        </div>

        <div className="mt-6">
            <div className="grid gap-6">
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
                        <h4 className="font-semibold text-gray-900 mb-3">
                          학습 주제
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {item.topics.map((topic) => (
                            <div
                              key={topic}
                              className="flex items-center gap-2 text-gray-600"
                            >
                              <span className="text-indigo-600">•</span>
                              {topic}
                            </div>
                          ))}
                        </div>
                      </div>

                      {progress && (
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-gray-600">
                            현재 점수: <span className="font-semibold">{progress.score}점</span>
                          </p>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div
                              className="bg-indigo-600 h-2 rounded-full transition-all"
                              style={{
                                width: `${Math.min(progress.score || 0, 100)}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {(item as { id?: number }).id && (courseType === "high_univ" || courseType === "general_adult") && <Link href={`/curriculum/${courseType}/${item.level}`}><Button variant="outline" className="mb-2 w-full gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50">강의 상세 보기 · PDF 자료</Button></Link>}
                      <Link href={isDynamicCourse ? `/curriculum/${courseType}/${item.level}` : `/workbook/${courseType}/${item.level}`}>
                        <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                          {isDynamicCourse ? "강의 열기" : isCompleted ? "다시 풀기" : "시작하기"}
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
      </div>
    </div>
  );
}
