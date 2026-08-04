import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { BookOpen, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AIAutoFeedback() {
  const { user, isAuthenticated } = useAuth();
  const [courseType, setCourseType] = useState<"elementary" | "middle_high">("middle_high");
  const [level, setLevel] = useState<string>("1");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [feedback, setFeedback] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const createFeedbackMutation = trpc.aiAutoFeedback.create.useMutation();

  if (!isAuthenticated) {
    return <div className="text-center py-12">로그인이 필요합니다.</div>;
  }

  const handleGenerateFeedback = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("제목과 내용을 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      const result = await createFeedbackMutation.mutateAsync({
        essayTitle: title,
        essayContent: content,
        courseType,
        level: parseInt(level),
      });

      // 피드백 데이터 파싱
      if (!result) return;
      const feedbackData = {
        structureScore: (result as any).structureScore || 0,
        logicScore: (result as any).logicScore || 0,
        expressionScore: (result as any).expressionScore || 0,
        overallScore: (result as any).overallScore || 0,
        strengths: (result as any).strengths ? JSON.parse((result as any).strengths) : [],
        weaknesses: (result as any).weaknesses ? JSON.parse((result as any).weaknesses) : [],
        suggestions: (result as any).suggestions ? JSON.parse((result as any).suggestions) : [],
        overallComment: (result as any).overallComment || "",
      };

      setFeedback(feedbackData);
      toast.success("AI 첨삭이 완료되었습니다!");
    } catch (error) {
      console.error("Error generating feedback:", error);
      toast.error("첨삭 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80">
              <BookOpen className="w-8 h-8 text-indigo-600" />
              <span className="text-2xl font-bold text-gray-900">논술 마스터</span>
            </div>
          </Link>
          <div className="text-right">
            <p className="text-sm text-gray-600">{user?.name}</p>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">AI 자동 첨삭</h1>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>논술 입력</CardTitle>
                <CardDescription>
                  작성한 논술을 입력하면 AI가 즉시 첨삭해드립니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Course Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    과정 선택
                  </label>
                  <Select value={courseType} onValueChange={(value: any) => setCourseType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="elementary">초등 과정</SelectItem>
                      <SelectItem value="middle_high">중고등 과정</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Level */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    레벨 선택
                  </label>
                  <Select value={level} onValueChange={setLevel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Level 1</SelectItem>
                      <SelectItem value="2">Level 2</SelectItem>
                      <SelectItem value="3">Level 3</SelectItem>
                      <SelectItem value="4">Level 4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    제목
                  </label>
                  <Input
                    placeholder="논술의 제목을 입력하세요"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    논술 내용
                  </label>
                  <Textarea
                    placeholder="작성한 논술을 입력하세요..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={10}
                    className="resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    {content.length} / 5000 자
                  </p>
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleGenerateFeedback}
                  disabled={loading || !title.trim() || !content.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      첨삭 중...
                    </>
                  ) : (
                    "AI 첨삭 받기"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Feedback Section */}
          <div className="space-y-6">
            {feedback ? (
              <>
                {/* Score Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>평가 결과</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Overall Score */}
                    <div className="p-4 bg-indigo-50 rounded-lg">
                      <div className="text-center">
                        <p className="text-sm text-gray-600 mb-2">종합 점수</p>
                        <p className="text-4xl font-bold text-indigo-600">
                          {feedback.overallScore}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">/ 100</p>
                      </div>
                    </div>

                    {/* Detailed Scores */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">구조</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {feedback.structureScore}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">논리</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {feedback.logicScore}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">표현</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {feedback.expressionScore}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Strengths */}
                {feedback.strengths && feedback.strengths.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        강점
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {feedback.strengths.map((strength: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-green-600 mt-1">✓</span>
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Weaknesses */}
                {feedback.weaknesses && feedback.weaknesses.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                        약점
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {feedback.weaknesses.map((weakness: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-orange-600 mt-1">!</span>
                            {weakness}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Suggestions */}
                {feedback.suggestions && feedback.suggestions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>개선 제안</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {feedback.suggestions.map((suggestion: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-indigo-600 mt-1">{idx + 1}.</span>
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Overall Comment */}
                {feedback.overallComment && (
                  <Card>
                    <CardHeader>
                      <CardTitle>종합 평가</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700 leading-relaxed">
                        {feedback.overallComment}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-500">
                    논술을 입력하고 "AI 첨삭 받기" 버튼을 클릭하면
                  </p>
                  <p className="text-gray-500">
                    첨삭 결과가 여기에 표시됩니다
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
