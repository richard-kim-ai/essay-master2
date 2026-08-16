import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Award, Plus, Search, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const emptyIssueForm = {
  userId: "",
  courseType: "elementary" as "elementary" | "middle_high",
  level: "1",
  certificateType: "level_certificate" as "level_certificate" | "graduation_certificate",
  issueReason: "",
};

export default function AdminCertificates() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: certificates, isLoading: certificatesLoading } = trpc.admin.getAllCertificatesAdmin.useQuery(undefined, { enabled: isAdmin });
  const { data: analytics } = trpc.admin.getAnalytics.useQuery(undefined, { enabled: isAdmin });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "revoked">("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueForm, setIssueForm] = useState(emptyIssueForm);
  const [revokeTarget, setRevokeTarget] = useState<number | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const students = useMemo(() => {
    return (analytics?.users.users ?? []).filter((candidate) => candidate.role !== "admin");
  }, [analytics?.users.users]);

  const filteredCertificates = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return (certificates ?? []).filter((certificate) => {
      const student = students.find((candidate) => candidate.id === certificate.userId);
      const matchesSearch = !normalized || [student?.name, student?.email, String(certificate.userId), String(certificate.id)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
      const matchesStatus = statusFilter === "all" || certificate.status === statusFilter;
      const matchesCourse = courseFilter === "all" || certificate.courseType === courseFilter;
      const certDate = new Date(certificate.issuedAt).getTime();
      const matchesStart = !startDate || certDate >= new Date(startDate).getTime();
      const matchesEnd = !endDate || certDate <= new Date(endDate).getTime() + 86400000;
      return matchesSearch && matchesStatus && matchesCourse && matchesStart && matchesEnd;
    });
  }, [certificates, search, statusFilter, courseFilter, startDate, endDate, students]);

  const filteredSummary = useMemo(() => {
    const byCourse = filteredCertificates.reduce<Record<string, number>>((result, certificate) => {
      result[certificate.courseType] = (result[certificate.courseType] ?? 0) + 1;
      return result;
    }, {});
    return {
      total: filteredCertificates.length,
      active: filteredCertificates.filter((certificate) => certificate.status === "active").length,
      revoked: filteredCertificates.filter((certificate) => certificate.status === "revoked").length,
      byCourse,
    };
  }, [filteredCertificates]);

  const issueMutation = trpc.admin.issueCertificateAdmin.useMutation({
    onSuccess: () => {
      toast.success("수료증이 발행되었습니다.");
      setIssueOpen(false);
      setIssueForm(emptyIssueForm);
      utils.admin.getAllCertificatesAdmin.invalidate();
    },
    onError: (error) => toast.error(error.message || "수료증 발행에 실패했습니다."),
  });
  const revokeMutation = trpc.admin.revokeCertificateAdmin.useMutation({
    onSuccess: () => {
      toast.success("수료증 발행을 취소했습니다.");
      setRevokeTarget(null);
      setRevokeReason("");
      utils.admin.getAllCertificatesAdmin.invalidate();
    },
    onError: (error) => toast.error(error.message || "수료증 발행취소에 실패했습니다."),
  });
  const deleteMutation = trpc.admin.deleteCertificateAdmin.useMutation({
    onSuccess: () => {
      toast.success("수료증 기록을 삭제했습니다.");
      setDeleteTarget(null);
      utils.admin.getAllCertificatesAdmin.invalidate();
    },
    onError: (error) => toast.error(error.message || "수료증 삭제에 실패했습니다."),
  });

  const submitIssue = () => {
    const userId = Number(issueForm.userId);
    const level = issueForm.certificateType === "graduation_certificate" ? undefined : Number(issueForm.level);
    if (!userId || (!level && issueForm.certificateType === "level_certificate")) {
      toast.error("학생과 레벨을 입력해 주세요.");
      return;
    }
    issueMutation.mutate({
      userId,
      courseType: issueForm.courseType,
      level,
      certificateType: issueForm.certificateType,
      issueReason: issueForm.issueReason.trim() || undefined,
    });
  };

  if (loading) return <div className="p-12 text-center text-slate-600">권한을 확인하는 중입니다...</div>;
  if (!isAdmin) return <div className="p-12 text-center text-slate-600">관리자 권한이 필요합니다.</div>;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700"><Award className="h-8 w-8" /></div>
            <div>
              <p className="text-sm font-semibold text-amber-700">관리자 운영 콘솔</p>
              <h1 className="text-3xl font-bold text-slate-900">수료증 관리</h1>
              <p className="mt-1 text-sm text-slate-600">학생별 수료증을 발행하고, 사유를 남겨 발행취소 또는 삭제할 수 있습니다.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin"><Button variant="outline">관리자 대시보드</Button></Link>
            <Button variant="outline" className="gap-2" onClick={() => {
              if (!certificates || certificates.length === 0) {
                toast.error("내보낼 수료증 기록이 없습니다.");
                return;
              }
              const headers = ["ID", "수료증번호", "학생명", "이메일", "과정", "유형", "레벨", "상태", "발급일"];
              const rows = filteredCertificates.map(c => {
                const st = students.find((s) => s.id === c.userId);
                return [
                  c.id,
                  `"CERT-${c.id}"`,
                  `"${st?.name || "알 수 없음"}"`,
                  `"${st?.email || ""}"`,
                  c.courseType === "elementary" ? "초등" : c.courseType === "middle_high" ? "중고등" : c.courseType === "high_univ" ? "고등/대입" : "일반/직장인",
                  c.certificateType === "graduation_certificate" ? "졸업증서" : "레벨수료증",
                  c.level || "-",
                  c.status === "revoked" ? "발행취소" : "유효",
                  `"${new Date(c.issuedAt).toLocaleString()}"`
                ];
              });
              const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
              const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.setAttribute("href", url);
              link.setAttribute("download", `수료증_발급내역_${new Date().toISOString().slice(0, 10)}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              toast.success("수료증 내역이 CSV 파일로 다운로드되었습니다.");
            }}>CSV 내보내기</Button>
            <Button variant="outline" className="gap-2" onClick={() => {
              window.print();
              toast.success("인쇄 / PDF 저장 창을 호출했습니다.");
            }}>인쇄 / PDF</Button>
            <Button className="gap-2 bg-amber-600 text-white hover:bg-amber-700" onClick={() => setIssueOpen(true)}><Plus className="h-4 w-4" /> 수료증 발행</Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-5"><p className="text-xs font-semibold text-slate-500">전체 기록</p><p className="mt-2 text-3xl font-bold text-slate-900">{certificates?.length ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs font-semibold text-emerald-600">현재 유효</p><p className="mt-2 text-3xl font-bold text-emerald-700">{certificates?.filter((certificate) => certificate.status === "active").length ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs font-semibold text-rose-600">발행취소</p><p className="mt-2 text-3xl font-bold text-rose-700">{certificates?.filter((certificate) => certificate.status === "revoked").length ?? 0}</p></CardContent></Card>
        </div>

        <Card className="border-indigo-100 bg-indigo-50/60">
          <CardHeader className="pb-3"><CardTitle className="text-base">내보내기 미리보기</CardTitle><CardDescription>현재 검색·상태·과정·기간 필터가 적용된 결과입니다. 아래 수치와 동일한 행만 CSV로 다운로드됩니다.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">필터 결과</p><p className="mt-1 text-2xl font-bold text-indigo-700">{filteredSummary.total}건</p></div>
            <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">유효</p><p className="mt-1 text-2xl font-bold text-emerald-700">{filteredSummary.active}건</p></div>
            <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">발행취소</p><p className="mt-1 text-2xl font-bold text-rose-700">{filteredSummary.revoked}건</p></div>
            <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">초등 / 중고등</p><p className="mt-1 text-2xl font-bold text-slate-800">{(filteredSummary.byCourse.elementary ?? 0) + (filteredSummary.byCourse.middle_high ?? 0)}건</p></div>
            <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">고등 / 대입</p><p className="mt-1 text-2xl font-bold text-purple-700">{filteredSummary.byCourse.high_univ ?? 0}건</p></div>
            <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">일반 / 직장인</p><p className="mt-1 text-2xl font-bold text-amber-700">{filteredSummary.byCourse.general_adult ?? 0}건</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-slate-100">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div><CardTitle>발급 기록</CardTitle><CardDescription>발행취소는 기록을 보존하며, 삭제는 발행취소된 기록에만 허용됩니다.</CardDescription>{search.trim() && <p className="mt-1 text-xs font-semibold text-indigo-600">“{search.trim()}” 검색 결과 {filteredCertificates.length}건</p>}</div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <div className="relative w-full sm:w-60"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="w-full pl-9 pr-9" aria-label="학생 이름 또는 이메일 검색" placeholder="학생명 또는 이메일 검색" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button type="button" aria-label="검색어 지우기" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setSearch("")}><XCircle className="h-4 w-4" /></button>}</div>
                <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
                  <option value="all">모든 과정</option>
                  <option value="elementary">초등 논술</option>
                  <option value="middle_high">중고등 논술</option>
                  <option value="high_univ">고등 / 대입</option>
                  <option value="general_adult">일반 / 직장인</option>
                </select>
                <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                  <option value="all">모든 상태</option><option value="active">유효</option><option value="revoked">발행취소</option>
                </select>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <span>시작일:</span>
                  <Input type="date" className="h-10 w-36 text-xs" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                  <span>~ 종료일:</span>
                  <Input type="date" className="h-10 w-36 text-xs" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500"><tr><th className="px-5 py-3">학생</th><th className="px-5 py-3">과정</th><th className="px-5 py-3">유형</th><th className="px-5 py-3">상태</th><th className="px-5 py-3">발행일</th><th className="px-5 py-3 text-right">관리</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {certificatesLoading ? <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">수료증 기록을 불러오는 중입니다...</td></tr> : filteredCertificates.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">조건에 맞는 수료증 기록이 없습니다.</td></tr> : filteredCertificates.map((certificate) => {
                    const student = students.find((candidate) => candidate.id === certificate.userId);
                    const isRevoked = certificate.status === "revoked";
                    return <tr key={certificate.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4"><p className="font-semibold text-slate-900">{student?.name || `사용자 #${certificate.userId}`}</p><p className="text-xs text-slate-500">{student?.email || `ID ${certificate.userId}`}</p></td>
                      <td className="px-5 py-4">{certificate.courseType === "elementary" ? "초등 논술" : certificate.courseType === "middle_high" ? "중고등 논술" : certificate.courseType === "high_univ" ? "고등 / 대입" : "일반 / 직장인"}</td>
                      <td className="px-5 py-4">{certificate.certificateType === "graduation_certificate" ? "졸업증서" : `Level ${certificate.level} 수료증`}</td>
                      <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isRevoked ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{isRevoked ? "발행취소" : "유효"}</span></td>
                      <td className="px-5 py-4 text-xs text-slate-500">{new Date(certificate.issuedAt).toLocaleString()}</td>
                      <td className="px-5 py-4"><div className="flex justify-end gap-2">
                        {!isRevoked && <Button variant="outline" size="sm" className="gap-1 text-rose-700 hover:bg-rose-50" onClick={() => setRevokeTarget(certificate.id)}><XCircle className="h-3.5 w-3.5" /> 취소</Button>}
                        {isRevoked && <Button variant="outline" size="sm" className="gap-1 text-slate-700 hover:bg-slate-100" onClick={() => setDeleteTarget(certificate.id)}><Trash2 className="h-3.5 w-3.5" /> 삭제</Button>}

                      </div></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>관리자 수료증 발행</DialogTitle><DialogDescription>발행 전 학생과 레벨을 확인하세요. 동일 조건의 활성 수료증은 중복 발행할 수 없습니다.</DialogDescription></DialogHeader><div className="space-y-4 py-2">
        <div><label className="mb-1 block text-sm font-medium">학생</label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={issueForm.userId} onChange={(event) => setIssueForm({ ...issueForm, userId: event.target.value })}><option value="">학생을 선택하세요</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name || `사용자 #${student.id}`} · {student.email || `ID ${student.id}`}</option>)}</select></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1 block text-sm font-medium">과정</label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={issueForm.courseType} onChange={(event) => setIssueForm({ ...issueForm, courseType: event.target.value as typeof issueForm.courseType })}><option value="elementary">초등 논술</option><option value="middle_high">중고등 논술</option></select></div><div><label className="mb-1 block text-sm font-medium">유형</label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={issueForm.certificateType} onChange={(event) => setIssueForm({ ...issueForm, certificateType: event.target.value as typeof issueForm.certificateType })}><option value="level_certificate">레벨 수료증</option><option value="graduation_certificate">졸업증서</option></select></div></div>
        {issueForm.certificateType === "level_certificate" && <div><label className="mb-1 block text-sm font-medium">레벨</label><Input type="number" min={1} max={20} value={issueForm.level} onChange={(event) => setIssueForm({ ...issueForm, level: event.target.value })} /></div>}
        <div><label className="mb-1 block text-sm font-medium">발행 사유 <span className="text-slate-400">(선택)</span></label><Textarea placeholder="예: Level 2 학습 완료 및 관리자 확인" value={issueForm.issueReason} onChange={(event) => setIssueForm({ ...issueForm, issueReason: event.target.value })} /></div>
      </div><DialogFooter><Button variant="outline" onClick={() => setIssueOpen(false)}>취소</Button><Button className="bg-amber-600 text-white hover:bg-amber-700" onClick={submitIssue} disabled={issueMutation.isPending}>{issueMutation.isPending ? "발행 중..." : "발행 확정"}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={revokeTarget !== null} onOpenChange={(open) => { if (!open) { setRevokeTarget(null); setRevokeReason(""); } }}>
        <DialogContent className="sm:max-w-md p-6 space-y-4">
          <DialogHeader>
            <DialogTitle>수료증 발행취소</DialogTitle>
            <DialogDescription>발행취소하면 학생용 목록과 공유 링크에서 유효한 증서로 표시되지 않습니다. 사유는 필수입니다.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea className="min-h-[100px] w-full" placeholder="발행취소 사유를 입력하세요 (최소 2자 이상)" value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)} />
          </div>
          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>돌아가기</Button>
            <Button className="bg-rose-600 text-white hover:bg-rose-700" disabled={revokeMutation.isPending || revokeReason.trim().length < 2} onClick={() => revokeTarget && revokeMutation.mutate({ certificateId: revokeTarget, reason: revokeReason.trim() })}>
              {revokeMutation.isPending ? "취소 처리 중..." : "발행취소 확정"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>수료증 기록 삭제</DialogTitle><DialogDescription>이미 발행취소된 수료증만 삭제할 수 있습니다. 삭제 후에는 목록과 이력에서 복구할 수 없습니다.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)}>돌아가기</Button><Button className="bg-slate-900 text-white hover:bg-slate-700" disabled={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate({ certificateId: deleteTarget })}>{deleteMutation.isPending ? "삭제 중..." : "삭제 확정"}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
