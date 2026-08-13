import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowLeft, BookOpen, FileText, Award, BarChart3, UserCheck, Calendar, Save, StickyNote } from "lucide-react";
import { Link, useParams } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function AdminStudentDetail() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const params = useParams<{ id: string }>();
  const studentId = parseInt(params.id || "0", 10);

  const utils = trpc.useUtils();
  const { data: student, isLoading } = trpc.admin.getStudentDetail.useQuery(
    { studentId },
    { enabled: isAdmin && studentId > 0 }
  );

  const updateNotesMutation = trpc.admin.updateStudentNotes.useMutation({
    onSuccess: () => {
      toast.success("관리자 메모가 성공적으로 저장되었습니다.");
      utils.admin.getStudentDetail.invalidate({ studentId });
    },
    onError: (err) => {
      toast.error(err.message || "메모 저장 중 오류가 발생했습니다.");
    },
  });

  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (student?.user && (student.user as any).adminNotes !== undefined) {
      setNotes((student.user as any).adminNotes || "");
    }
  }, [student]);

  const handleSaveNotes = () => {
    updateNotesMutation.mutate({ studentId, adminNotes: notes });
  };

  if (authLoading) {
    return <div className="min-h-screen bg-slate-50 p-12 text-center text-slate-600">불러오는 중입니다...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-20 text-center">
        <h1 className="text-xl font-bold text-slate-800">접근 권한이 없습니다.</h1>
        <Link href="/">
          <Button className="mt-4">홈으로 돌아가기</Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 p-12 text-center text-slate-600">학생 상세 정보를 불러오는 중입니다...</div>;
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-20 text-center">
        <h1 className="text-xl font-bold text-slate-800">해당 학생을 찾을 수 없습니다.</h1>
        <Link href="/admin">
          <Button className="mt-4">관리자 대시보드로 돌아가기</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/admin">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> 관리자 대시보드로 돌아가기
            </Button>
          </Link>
          <span className="text-xs font-semibold px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full">
            학생 상세 분석 및 관리자 메모
          </span>
        </div>

        {/* Student Profile Card */}
        <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-blue-50/30">
          <CardHeader className="flex flex-row items-center gap-4 pb-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-2xl shadow-inner">
              {student.user.name?.[0] || "학"}
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-slate-900">{student.user.name || `사용자 #${student.user.id}`}</CardTitle>
              <CardDescription className="text-sm text-slate-600 mt-0.5">
                {student.user.email || "소셜 계정"} • 가입일: {new Date(student.user.createdAt).toLocaleDateString()}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">누적 논술 제출</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{student.submissions.length}건</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">AI 자동 첨삭 이용</p>
              <p className="text-xl font-bold text-sky-600 mt-1">{student.aiFeedbacks.length}회</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">취득 수료증</p>
              <p className="text-xl font-bold text-indigo-600 mt-1">{student.certificates.length}개</p>
            </div>
          </CardContent>
        </Card>

        {/* Admin Notes Card */}
        <Card className="border-amber-200 bg-amber-50/30 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-amber-900">
              <StickyNote className="w-5 h-5 text-amber-600" />
              <span>관리자 전용 학습 상담 및 특이사항 메모</span>
            </CardTitle>
            <CardDescription className="text-xs text-amber-700">
              선생님이나 관리자만 열람하고 수정할 수 있는 학생별 메모장입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="예: 글쓰기 구조는 우수하나 어휘 선택에 대한 피드백 필요 (학부모 상담 일지 등)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-white border-amber-200 min-h-[120px] text-sm"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={updateNotesMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
              >
                <Save className="w-4 h-4" />
                {updateNotesMutation.isPending ? "저장 중..." : "메모 저장하기"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Submissions Section */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>최근 논술 제출 및 첨삭 내역</span>
            </CardTitle>
            <CardDescription>학생이 제출한 논술과 선생님/AI 첨삭 상태입니다.</CardDescription>
          </CardHeader>
          <CardContent>
            {student.submissions.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">아직 제출된 논술 내역이 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {student.submissions.map((sub: any) => (
                  <div key={sub.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900">{sub.title}</h4>
                      <span className="text-xs px-2.5 py-1 rounded bg-blue-50 text-blue-700 font-semibold uppercase">
                        {sub.courseType} • Level {sub.level}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2">{sub.content}</p>
                    <p className="text-xs text-slate-400">제출일: {new Date(sub.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Certificates Section */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              <span>보유 수료증 목록</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {student.certificates.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">아직 발급된 수료증이 없습니다.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {student.certificates.map((cert: any) => (
                  <div key={cert.id} className="p-4 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/40 to-white flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{cert.title}</p>
                      <p className="text-xs text-slate-500 mt-1">인증번호: {cert.certNumber}</p>
                    </div>
                    <span className="text-xs bg-indigo-600 text-white font-bold px-2.5 py-1 rounded-lg">발급완료</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
