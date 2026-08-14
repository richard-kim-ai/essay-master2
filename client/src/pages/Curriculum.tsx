import { useAuth } from "@/_core/hooks/useAuth";
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { BookOpen, Lock } from "lucide-react";

type CourseType = "elementary" | "middle_high" | "high_univ" | "general_adult";

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
  const [courseType, setCourseType] = React.useState<CourseType>("middle_high");
  const { data: progressData } = trpc.progress.getByUser.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: dynamicCurriculum } = trpc.curriculum.getDynamicByType.useQuery(courseType, {
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return <div className="text-center py-12">로그인이 필요합니다.</div>;
  }

  const curriculumList = dynamicCurriculum && dynamicCurriculum.length > 0
    ? dynamicCurriculum
    : CURRICULUM_DATA[courseType];
  const progressMap = new Map(
    progressData?.map((p) => [p.curriculumId, p]) || []
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">커리큘럼</h1>

        {/* Course Type Tabs */}
        <Tabs
          value={courseType}
          onValueChange={(value) =>
            setCourseType(value as CourseType)
          }
          className="mb-8"
        >
          <TabsList className="grid w-full max-w-2xl grid-cols-2 gap-1 sm:grid-cols-4">
            <TabsTrigger value="elementary">초등</TabsTrigger>
            <TabsTrigger value="middle_high">중고등</TabsTrigger>
            <TabsTrigger value="high_univ">고등/대입</TabsTrigger>
            <TabsTrigger value="general_adult">일반/직장인</TabsTrigger>
          </TabsList>

          <TabsContent value={courseType} className="mt-8">
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
                          {(item as { thumbnailUrl?: string }).thumbnailUrl && (
                            <img src={(item as { thumbnailUrl?: string }).thumbnailUrl} alt="" className="mb-4 h-40 w-full rounded-xl object-cover" loading="lazy" />
                          )}
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

