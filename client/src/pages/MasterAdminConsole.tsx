import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ShieldAlert, UserCheck, UserX, Search, ArrowLeft, Users, UserCog, CheckCircle, Shield } from "lucide-react";
import { Link } from "wouter";

export default function MasterAdminConsole() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: usersList, isLoading, refetch } = trpc.admin.getAllUsersMasterAdmin.useQuery();
  const utils = trpc.useUtils();

  const updateUserRoleMutation = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => {
      toast.success("사용자 권한이 성공적으로 변경되었습니다.");
      refetch();
      utils.admin.getAnalytics.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "권한 변경 중 오류가 발생했습니다.");
    },
  });

  const approveTeacherMutation = trpc.admin.approveTeacher.useMutation({
    onSuccess: () => {
      toast.success("교사 회원 승인이 완료되었습니다.");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "교사 승인 중 오류가 발생했습니다.");
    },
  });

  const filteredUsers = useMemo(() => {
    if (!usersList) return [];
    return usersList.filter((u) => {
      const nameMatch = (u.name || "").toLowerCase().includes(searchQuery.toLowerCase());
      const emailMatch = (u.email || "").toLowerCase().includes(searchQuery.toLowerCase());
      if (searchQuery && !nameMatch && !emailMatch) return false;

      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "approved" && u.teacherStatus !== "approved") return false;
        if (statusFilter === "pending" && u.teacherStatus !== "pending") return false;
      }
      return true;
    });
  }, [usersList, searchQuery, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    if (!usersList) return { total: 0, students: 0, teachers: 0, admins: 0, pendingTeachers: 0 };
    return {
      total: usersList.length,
      students: usersList.filter((u) => u.role === "user").length,
      teachers: usersList.filter((u) => u.role === "teacher").length,
      admins: usersList.filter((u) => u.role === "admin").length,
      pendingTeachers: usersList.filter((u) => u.role === "teacher" && u.teacherStatus === "pending").length,
    };
  }, [usersList]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6 px-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="gap-1 text-slate-600 pl-0">
                <ArrowLeft className="h-4 w-4" /> 일반 관리자 대시보드로 돌아가기
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">총괄 관리자 통합 계정 콘솔</h1>
          <p className="text-sm text-slate-500">학생, 첨삭 교사, 일반 관리자의 계정 상태와 권한을 일괄 모니터링하고 제어합니다.</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="bg-white border-slate-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">전체 등록 계정</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.total}명</h3>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600"><Users className="h-6 w-6" /></div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">학습자 (학생)</p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">{stats.students}명</h3>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600"><UserCheck className="h-6 w-6" /></div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">첨삭 교사회원</p>
              <h3 className="text-2xl font-bold text-indigo-600 mt-1">{stats.teachers}명</h3>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600"><UserCog className="h-6 w-6" /></div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">승인 대기 교사</p>
              <h3 className="text-2xl font-bold text-amber-600 mt-1">{stats.pendingTeachers}명</h3>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600"><ShieldAlert className="h-6 w-6" /></div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">총괄 관리자</p>
              <h3 className="text-2xl font-bold text-purple-600 mt-1">{stats.admins}명</h3>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 text-purple-600"><Shield className="h-6 w-6" /></div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold">계정 및 권한 통합 관리</CardTitle>
              <CardDescription>검색 및 필터를 통해 특정 사용자의 권한을 변경하거나 교사회원을 승인할 수 있습니다.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="이름 또는 이메일 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-60 text-sm"
                />
              </div>
              <select
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">모든 권한(역할)</option>
                <option value="user">학생(학습자)</option>
                <option value="teacher">첨삭 교사</option>
                <option value="admin">관리자</option>
              </select>
              <select
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">모든 상태</option>
                <option value="approved">승인 완료</option>
                <option value="pending">승인 대기중</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase bg-slate-50">
                  <th className="py-3 px-4">ID / 이름</th>
                  <th className="py-3 px-4">이메일</th>
                  <th className="py-3 px-4">권한 (Role)</th>
                  <th className="py-3 px-4">교사 레벨 / 상태</th>
                  <th className="py-3 px-4">가입일</th>
                  <th className="py-3 px-4 text-right">권한 제어 / 작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">전체 사용자 계정 목록을 불러오는 중입니다...</td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">검색 조건에 일치하는 계정이 없습니다.</td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-semibold text-slate-900">{u.name || `사용자 #${u.id}`}</td>
                      <td className="py-3 px-4 text-slate-600">{u.email || "소셜 로그인 계정"}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-800' : u.role === 'teacher' ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {u.role === 'admin' ? '총괄/관리자' : u.role === 'teacher' ? '첨삭 교사' : '일반 학생'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs">
                        {u.role === 'teacher' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-indigo-600">Level {u.teacherLevel || 1}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.teacherStatus === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {u.teacherStatus === 'approved' ? '승인완료' : '승인대기'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">해당없음</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {u.role === 'teacher' && u.teacherStatus === 'pending' && (
                          <Button
                            size="sm"
                            className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                            onClick={() => approveTeacherMutation.mutate({ userId: u.id })}
                          >
                            <CheckCircle className="h-3.5 w-3.5" /> 교사 승인
                          </Button>
                        )}
                        <select
                          className="h-8 rounded border border-slate-200 bg-white px-2 text-xs font-medium"
                          value={u.role}
                          onChange={(e) => updateUserRoleMutation.mutate({ userId: u.id, newRole: e.target.value as any })}
                        >
                          <option value="user">학생(User)</option>
                          <option value="teacher">교사(Teacher)</option>
                          <option value="admin">관리자(Admin)</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
