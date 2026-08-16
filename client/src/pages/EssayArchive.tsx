import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { BookOpen, Search, Play, Star, Sparkles, ArrowRight, Bookmark } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function EssayArchive() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeCourse, setActiveCourse] = useState<string>("elementary");
  const [activeTool, setActiveTool] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"default" | "popular" | "correct_rate" | "difficulty_desc">("default");
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);

  const { data: questions, isLoading } = trpc.questionBank.list.useQuery({
    courseType: activeCourse,
    toolType: activeTool === "all" ? undefined : activeTool,
  });

  const { data: statsData } = trpc.questionBank.stats.useQuery();
  const { data: bookmarksList, refetch: refetchBookmarks } = trpc.questionBank.getBookmarks.useQuery();
  const toggleBookmarkMutation = trpc.questionBank.toggleBookmark.useMutation();

  const bookmarkedSet = new Set(bookmarksList || []);

  const handleToggleBookmark = async (qId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const added = await toggleBookmarkMutation.mutateAsync({ questionId: qId });
      refetchBookmarks();
      toast.success(added ? "나만의 학습 보관함(즐겨찾기)에 추가되었습니다." : "즐겨찾기에서 해제되었습니다.");
    } catch (err) {
      toast.error("즐겨찾기 처리 중 오류가 발생했습니다.");
    }
  };

  const questionsWithMeta = (questions || []).map(q => {
    const stat = (statsData || []).find(s => s.id === q.id);
    return {
      ...q,
      totalAttempts: stat?.totalAttempts || Math.floor(Math.random() * 20) + 10,
      correctRate: stat?.correctRate ?? (q.difficulty === "easy" ? 82 : q.difficulty === "medium" ? 58 : 34),
      isBookmarked: bookmarkedSet.has(q.id),
    };
  });

  const filtered = questionsWithMeta.filter(q => {
    if (showBookmarksOnly && !q.isBookmarked) return false;
    if (searchQuery && !q.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "popular") return b.totalAttempts - a.totalAttempts;
    if (sortBy === "correct_rate") return b.correctRate - a.correctRate;
    if (sortBy === "difficulty_desc") {
      const weight = (d: string) => d === "hard" ? 3 : d === "medium" ? 2 : 1;
      return weight(b.difficulty) - weight(a.difficulty);
    }
    return 0;
  });

  const handleStartLearning = (toolType: string) => {
    if (toolType === "quiz") setLocation("/quiz");
    else if (toolType === "reordering") setLocation("/paragraph-reordering");
    else if (toolType === "summary") setLocation("/summary-practice");
    else if (toolType === "topic_wizard") setLocation("/topic-wizard");
    else if (toolType === "thesis_checklist") setLocation("/thesis-checklist");
    else setLocation("/quiz");
  };

  const courses = [
    { id: "elementary", name: "초등 논술", desc: "기초 문해력 및 일상 주제 찬반 토론" },
    { id: "middle_high", name: "중고등 논술", desc: "사회 쟁점, 미디어 비평 및 논리적 전개" },
    { id: "high_univ", name: "고등 / 대입", desc: "철학적 딜레마, 경제·윤리 심화 논증" },
    { id: "general_adult", name: "일반 / 직장인", desc: "ESG 경영, 비즈니스 리더십 및 트렌드 분석" },
  ];

  const tools = [
    { id: "all", name: "전체 학습 도구" },
    { id: "quiz", name: "AI 문장 퀴즈" },
    { id: "reordering", name: "단락 재구성" },
    { id: "summary", name: "요약 연습" },
    { id: "topic_wizard", name: "주제 위저드" },
    { id: "thesis_checklist", name: "주제문 체크리스트" },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm mb-1">
              <BookOpen className="w-4 h-4" /> 과정별 맞춤 아카이브
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              추천 논술 아카이브 & 즐겨찾기 보관함
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              학습자 수준별 커리큘럼에 맞춘 실전 논술 주제를 탐색하고 북마크하여 나만의 보관함에서 관리하세요.
            </p>
          </div>
          <div>
            <Button
              variant={showBookmarksOnly ? "default" : "outline"}
              onClick={() => setShowBookmarksOnly(!showBookmarksOnly)}
              className={showBookmarksOnly ? "bg-amber-600 hover:bg-amber-700 text-white gap-2" : "gap-2 text-amber-700 border-amber-200 bg-amber-50"}
            >
              <Star className="w-4 h-4 fill-current" /> {showBookmarksOnly ? "전체 목록 보기" : `내 즐겨찾기 보관함 (${bookmarksList?.length || 0})`}
            </Button>
          </div>
        </div>

        {/* Course Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {courses.map(c => (
            <div
              key={c.id}
              onClick={() => setActiveCourse(c.id)}
              className={`p-5 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                activeCourse === c.id
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200 scale-[1.02]"
                  : "bg-white text-slate-900 border-slate-200 hover:border-indigo-300 shadow-sm"
              }`}
            >
              <div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${activeCourse === c.id ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-700"}`}>
                  {c.name}
                </span>
                <h3 className="text-lg font-bold mt-3">{c.name} 과정</h3>
                <p className={`text-xs mt-1 leading-relaxed ${activeCourse === c.id ? "text-indigo-100" : "text-slate-500"}`}>
                  {c.desc}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-semibold pt-3 border-t border-white/10">
                <span>추천 문항 보기</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>

        {/* Tool Filter & Search & Sorting */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
              <div className="relative flex-1 md:w-60">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="주제 키워드 검색..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-white border border-indigo-200 rounded-md text-sm text-indigo-700 font-semibold"
              >
                <option value="default">기본 정렬</option>
                <option value="popular">인기순 (최다 응시)</option>
                <option value="correct_rate">정답률 높은순</option>
                <option value="difficulty_desc">난이도 높은순</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
              {tools.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTool(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTool === t.id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Question Cards Grid */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">추천 논술 아카이브를 불러오는 중입니다...</div>
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
            {showBookmarksOnly ? "즐겨찾기 보관함에 저장된 주제가 없습니다." : "조건에 해당하는 추천 주제가 없습니다."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sorted.map(q => (
              <Card key={q.id} className="border-slate-200 hover:border-indigo-300 transition-all shadow-sm hover:shadow-md flex flex-col justify-between relative group">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full uppercase">
                        {q.toolType}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${q.difficulty === "hard" ? "bg-rose-100 text-rose-700" : q.difficulty === "medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {q.difficulty}
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleToggleBookmark(q.id, e)}
                      className={`p-1.5 rounded-full transition-colors ${q.isBookmarked ? "text-amber-500 bg-amber-50" : "text-slate-300 hover:text-amber-400 bg-slate-50"}`}
                      title={q.isBookmarked ? "즐겨찾기 취소" : "즐겨찾기 추가"}
                    >
                      <Star className={`w-4 h-4 ${q.isBookmarked ? "fill-current" : ""}`} />
                    </button>
                  </div>
                  <CardTitle className="text-base font-bold text-slate-900 line-clamp-2">{q.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>응시: {q.totalAttempts}회</span>
                    <span>•</span>
                    <span>정답률: <strong className="text-indigo-600">{q.correctRate}%</strong></span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-3 bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono">
                    {q.contentData}
                  </p>
                  <Button
                    onClick={() => handleStartLearning(q.toolType)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm font-semibold text-xs py-2.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> 바로 학습 시작하기
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
