import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { BookOpen, Loader2, Save, Send, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function EssaySubmission() {
  const { user, isAuthenticated } = useAuth();
  const [essayId, setEssayId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"draft" | "submitted">("draft");
  const [loading, setLoading] = useState(false);
  const [essays, setEssays] = useState<any[]>([]);

  const createMutation = trpc.essaySubmission.create.useMutation();
  const updateMutation = trpc.essaySubmission.update.useMutation();
  const getByUserQuery = trpc.essaySubmission.getByUser.useQuery();

  useEffect(() => {
    if (getByUserQuery.data) {
      setEssays(getByUserQuery.data);
    }
  }, [getByUserQuery.data]);

  if (!isAuthenticated) {
    return <div className="text-center py-12">로그인이 필요합니다.</div>;
  }

  const handleSaveDraft = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("제목과 내용을 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      if (essayId) {
        await updateMutation.mutateAsync({
          id: essayId,
          title,
          content,
          status: "draft",
        });
        toast.success("임시 저장되었습니다.");
      } else {
        const result = await createMutation.mutateAsync({
          title,
          content,
          status: "draft",
        });
        setEssayId((result as any).id);
        toast.success("새 논술이 생성되었습니다.");
      }
      getByUserQuery.refetch();
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("제목과 내용을 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      if (essayId) {
        await updateMutation.mutateAsync({
          id: essayId,
          title,
          content,
          status: "submitted",
          submittedAt: new Date(),
        });
      } else {
        const result = await createMutation.mutateAsync({
          title,
          content,
          status: "submitted",
        });
        setEssayId((result as any).id);
      }
      toast.success("논술이 제출되었습니다.");
      setStatus("submitted");
      getByUserQuery.refetch();
    } catch (error) {
      console.error("Error submitting essay:", error);
      toast.error("제출 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadEssay = (essay: any) => {
    setEssayId(essay.id);
    setTitle(essay.title);
    setContent(essay.content);
    setStatus(essay.status);
  };

  const handleNewEssay = () => {
    setEssayId(null);
    setTitle("");
    setContent("");
    setStatus("draft");
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
        <h1 className="text-4xl font-bold text-gray-900 mb-8">논술 제출</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Essay List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  내 논술
                </CardTitle>
                <CardDescription>
                  {essays.length}개의 논술
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  onClick={handleNewEssay}
                  variant="outline"
                  className="w-full"
                >
                  새 논술 작성
                </Button>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {essays.map((essay) => (
                    <button
                      key={essay.id}
                      onClick={() => handleLoadEssay(essay)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        essayId === essay.id
                          ? "bg-indigo-50 border-indigo-300"
                          : "bg-white border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <p className="font-medium text-sm text-gray-900 truncate">
                        {essay.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {essay.status === "submitted" ? "제출됨" : "임시 저장"}
                      </p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Essay Editor */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>논술 작성</CardTitle>
                <CardDescription>
                  {status === "submitted" ? "제출된 논술입니다" : "작성 중인 논술입니다"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    제목
                  </label>
                  <Input
                    placeholder="논술의 제목을 입력하세요"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={status === "submitted"}
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    내용
                  </label>
                  <Textarea
                    placeholder="논술을 작성하세요..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={15}
                    className="resize-none"
                    disabled={status === "submitted"}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    {content.length} / 10000 자
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {status !== "submitted" && (
                    <>
                      <Button
                        onClick={handleSaveDraft}
                        disabled={loading || !title.trim() || !content.trim()}
                        variant="outline"
                        className="flex-1"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            저장 중...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            임시 저장
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={loading || !title.trim() || !content.trim()}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            제출 중...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            제출하기
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Status Info */}
            {status === "submitted" && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-6">
                  <p className="text-sm text-green-800">
                    ✓ 이 논술은 제출되었습니다. 선생님의 첨삭을 기다리고 있습니다.
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
