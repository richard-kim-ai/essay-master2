import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Menu,
  X,
  BookOpen,
  BarChart3,
  Zap,
  FileText,
  Award,
  ArrowRight,
  LogOut,
  User,
  ChevronDown,
  Settings,
  GraduationCap,
  Edit3,
  Check,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  submenu?: NavItem[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "커리큘럼", href: "/curriculum", icon: BookOpen },
  { label: "추천 아카이브", href: "/essay-archive", icon: GraduationCap },
  {
    label: "학습 도구",
    href: "#",
    icon: Zap,
    submenu: [
      { label: "AI 문장 교정", href: "/quiz", icon: Zap },
      { label: "단락 재구성", href: "/paragraph-reordering", icon: FileText },
      { label: "요약 연습", href: "/summary-practice", icon: BookOpen },
      { label: "오답 노트", href: "/mistake-notebook", icon: BarChart3 },
      { label: "주제 설정 위저드", href: "/topic-wizard", icon: BookOpen },
      { label: "주제문 체크리스트", href: "/thesis-checklist", icon: FileText },
    ],
  },
];

export default function Navigation() {
  const { user, isAuthenticated, logout, refresh } = useAuth() as any;
  const [location] = useLocation();
  const [openMobileSubmenu, setOpenMobileSubmenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user?.name || "");
  const [editAvatar, setEditAvatar] = useState(user?.avatarUrl || "");

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("프로필이 성공적으로 수정되었습니다.");
      setIsEditingProfile(false);
      if (typeof refresh === "function") refresh();
    },
    onError: (err) => {
      toast.error(err.message || "프로필 수정 중 오류가 발생했습니다.");
    }
  });

  const handleMobileSubmenuToggle = (label: string) => {
    setOpenMobileSubmenu(openMobileSubmenu === label ? null : label);
  };

  const handleMobileLinkClick = () => {
    setMobileMenuOpen(false);
    setOpenMobileSubmenu(null);
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-base sm:text-lg text-gray-900 tracking-tight">
                논술 마스터
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              if (item.submenu) {
                return (
                  <DropdownMenu key={item.label}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="flex items-center gap-1 text-gray-700 hover:text-blue-600"
                      >
                        {Icon && <Icon className="w-4 h-4" />}
                        {item.label}
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      {item.submenu.map((subitem) => {
                        const SubIcon = subitem.icon;
                        return (
                          <Link key={subitem.href} href={subitem.href}>
                            <DropdownMenuItem className="cursor-pointer">
                              {SubIcon && (
                                <SubIcon className="w-4 h-4 mr-2" />
                              )}
                              <span>{subitem.label}</span>
                            </DropdownMenuItem>
                          </Link>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const tips: Record<string, string> = {
                        "커리큘럼": "💡 초등·중고등·고등대입·일반 4대 과정의 맞춤형 커리큘럼을 탐색해보세요!",
                        "추천 아카이브": "💡 주제별 기출·실전 논술 문제를 모아보고 북마크와 주간 플래너에 연동하세요!",
                        "대시보드": "💡 주간 AI 첨삭 사용량과 학습 진도율을 한눈에 파악할 수 있는 메인 센터입니다.",
                        "오프라인 보관함": "💡 네트워크가 불안정할 때도 작성 중인 글을 임시 저장하고 자동 동기화하세요.",
                        "수료증": "💡 레벨별 정식 수료증을 미리보기하고 고해상도 PNG 또는 PDF로 즉시 다운로드하세요!",
                      };
                      if (tips[item.label]) {
                        toast.info(tips[item.label]);
                      }
                    }}
                    className={`flex items-center gap-1 ${
                      location === item.href
                        ? "text-blue-600 bg-blue-50"
                        : "text-gray-700 hover:text-blue-600"
                    }`}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {!isAuthenticated && (
              <div className="hidden lg:flex items-center gap-1.5 mr-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold gap-1"
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/trpc/auth.loginWithEmail", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ json: { email: "student@sample.com", password: "sample1234" } }),
                      });
                      if (res.ok) {
                        window.location.href = "/dashboard";
                      } else {
                        window.location.href = "/login";
                      }
                    } catch {
                      window.location.href = "/login";
                    }
                  }}
                >
                  ✨ 샘플 모드 체험
                </Button>
              </div>
            )}

            {isAuthenticated ? (
              <>
                {/* Desktop User Menu */}
                <div className="hidden md:block">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="flex items-center gap-2 text-gray-700"
                      >
                        <User className="w-4 h-4" />
                        <span className="text-sm">{user?.name || "사용자"}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 p-3 transition-all duration-200 animate-in fade-in-80 zoom-in-95">
                      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                        <div>
                          <p className="text-xs font-bold text-gray-900">{user?.name || "사용자"}</p>
                          <p className="text-[11px] text-gray-500 truncate max-w-[160px]">{user?.email}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50"
                          onClick={(e) => {
                            e.preventDefault();
                            setEditName(user?.name || "");
                            setEditAvatar(user?.avatarUrl || "");
                            setIsEditingProfile(!isEditingProfile);
                          }}
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1" />
                          {isEditingProfile ? "닫기" : "프로필 편집"}
                        </Button>
                      </div>

                      {isEditingProfile && (
                        <div className="py-3 border-b border-gray-100 space-y-2.5">
                          <div>
                            <label className="text-[11px] font-bold text-gray-700 block mb-1">닉네임 변경</label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full h-8 px-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="닉네임 입력"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-gray-700 block mb-1">프로필 이미지 URL</label>
                            <input
                              type="text"
                              value={editAvatar}
                              onChange={(e) => setEditAvatar(e.target.value)}
                              className="w-full h-8 px-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="https:// 이미지 주소"
                            />
                          </div>
                          <Button
                            size="sm"
                            className="w-full h-7 bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1 font-semibold"
                            onClick={() => {
                              updateProfileMutation.mutate({
                                name: editName,
                                avatarUrl: editAvatar || undefined,
                              });
                            }}
                          >
                            <Check className="w-3.5 h-3.5" /> 저장하기
                          </Button>
                        </div>
                      )}
                      <DropdownMenuSeparator />
                      <Link href="/dashboard">
                        <DropdownMenuItem className="cursor-pointer font-semibold text-gray-800">
                          <BarChart3 className="w-4 h-4 mr-2 text-blue-600" />
                          <span>학습 대시보드</span>
                        </DropdownMenuItem>
                      </Link>
                      <Link href="/offline-essays">
                        <DropdownMenuItem className="cursor-pointer font-semibold text-gray-800">
                          <FileText className="w-4 h-4 mr-2 text-indigo-600" />
                          <span>오프라인 보관함</span>
                        </DropdownMenuItem>
                      </Link>
                      <Link href="/certificate">
                        <DropdownMenuItem className="cursor-pointer font-semibold text-gray-800">
                          <Award className="w-4 h-4 mr-2 text-purple-600" />
                          <span>수료증</span>
                        </DropdownMenuItem>
                      </Link>
                      {(user?.role === "teacher" || user?.role === "admin") && (
                        <>
                          <DropdownMenuSeparator />
                          <Link href="/teacher-mypage">
                            <DropdownMenuItem className="cursor-pointer font-bold text-blue-600">
                              <GraduationCap className="w-4 h-4 mr-2" />
                              <span>교사 마이페이지 (지도학생)</span>
                            </DropdownMenuItem>
                          </Link>
                        </>
                      )}
                      {user?.role === "admin" && (
                        <>
                          <DropdownMenuSeparator />
                          <Link href="/admin">
                            <DropdownMenuItem className="cursor-pointer font-bold text-indigo-600">
                              <Settings className="w-4 h-4 mr-2" />
                              <span>관리자 운영 콘솔 (대시보드)</span>
                            </DropdownMenuItem>
                          </Link>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={logout} className="cursor-pointer">
                        <LogOut className="w-4 h-4 mr-2" />
                        <span>로그아웃</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Mobile Menu */}
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild className="md:hidden">
                    <Button variant="ghost" size="icon">
                      <Menu className="w-5 h-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-72 overflow-y-auto">
                    <div className="flex flex-col gap-4 mt-8">
                      {/* User Info */}
                      <div className="px-4 py-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm font-semibold text-gray-900">
                          {user?.name || "사용자"}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {user?.email}
                        </p>
                      </div>

                      {/* Mobile MyPage / Account Submenu Section */}
                      <div className="border-b border-gray-200 pb-3 mb-2">
                        <p className="px-4 text-xs font-bold text-blue-600 uppercase mb-2">마이페이지 & 개인 기록</p>
                        <Link href="/dashboard">
                          <button onClick={handleMobileLinkClick} className="mb-1 flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm text-gray-800 hover:bg-gray-100 font-semibold">
                            <BarChart3 className="w-4 h-4 text-blue-600" />
                            <span>학습 대시보드</span>
                          </button>
                        </Link>
                        <Link href="/offline-essays">
                          <button onClick={handleMobileLinkClick} className="mb-1 flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm text-gray-800 hover:bg-gray-100 font-semibold">
                            <FileText className="w-4 h-4 text-indigo-600" />
                            <span>오프라인 보관함</span>
                          </button>
                        </Link>
                        <Link href="/certificate">
                          <button onClick={handleMobileLinkClick} className="mb-1 flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm text-gray-800 hover:bg-gray-100 font-semibold">
                            <Award className="w-4 h-4 text-purple-600" />
                            <span>수료증</span>
                          </button>
                        </Link>
                      </div>

                      {/* Mobile Navigation Items */}
                      {NAV_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isOpen = openMobileSubmenu === item.label;

                        if (item.submenu) {
                          return (
                            <div key={item.label}>
                              <button
                                onClick={() =>
                                  handleMobileSubmenuToggle(item.label)
                                }
                                className="w-full flex items-center justify-between px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  {Icon && <Icon className="w-4 h-4" />}
                                  <span className="text-sm font-medium">
                                    {item.label}
                                  </span>
                                </div>
                                <ChevronDown
                                  className={`w-4 h-4 transition-transform ${
                                    isOpen ? "rotate-180" : ""
                                  }`}
                                />
                              </button>

                              {/* Submenu Items */}
                              {isOpen && (
                                <div className="ml-4 mt-2 space-y-1 border-l-2 border-gray-200 pl-4">
                                  {item.submenu.map((subitem) => {
                                    const SubIcon = subitem.icon;
                                    return (
                                      <Link
                                        key={subitem.href}
                                        href={subitem.href}
                                      >
                                        <button onClick={handleMobileLinkClick} className="w-full flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm">
                                          {SubIcon && (
                                            <SubIcon className="w-4 h-4" />
                                          )}
                                          <span>{subitem.label}</span>
                                        </button>
                                      </Link>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          <Link key={item.href} href={item.href}>
                            <button onClick={handleMobileLinkClick} className="w-full flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                              {Icon && <Icon className="w-4 h-4" />}
                              <span className="text-sm font-medium">
                                {item.label}
                              </span>
                            </button>
                          </Link>
                        );
                      })}

                      {user?.role === "admin" && (
                        <div className="border-t border-gray-200 pt-3 mt-2">
                          <p className="px-4 text-xs font-bold text-indigo-600 uppercase mb-2">관리자 운영 메뉴</p>
                          <Link href="/admin">
                            <button onClick={handleMobileLinkClick} className="mb-2 flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm text-gray-800 bg-indigo-50 hover:bg-indigo-100 font-semibold">
                              <Settings className="w-4 h-4 text-indigo-600" />
                              <span>관리자 운영 콘솔 (대시보드)</span>
                            </button>
                          </Link>
                        </div>
                      )}
                      <div className="border-t border-gray-200 pt-4">
                        <Button
                          onClick={logout}
                          variant="outline"
                          className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <LogOut className="w-4 h-4" />
                          로그아웃
                        </Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </>
            ) : (
              <>
                {/* Desktop Login Button */}
                <Button
                  onClick={() => startLogin()}
                  className="hidden md:flex bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  로그인
                  <ArrowRight className="w-4 h-4" />
                </Button>

                {/* Mobile Login Button */}
                <Sheet>
                  <SheetTrigger asChild className="md:hidden">
                    <Button variant="ghost" size="icon">
                      <Menu className="w-5 h-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-72">
                    <div className="flex flex-col gap-4 mt-8">
                      <Button
                        onClick={() => startLogin()}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
                      >
                        로그인
                        <ArrowRight className="w-4 h-4" />
                      </Button>

                      <div className="border-t border-gray-200 pt-4 space-y-2">
                        {NAV_ITEMS.map((item) => {
                          const Icon = item.icon;
                          if (item.submenu) return null;

                          return (
                            <Link key={item.href} href={item.href}>
                              <button className="w-full flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                                {Icon && <Icon className="w-4 h-4" />}
                                <span className="text-sm font-medium">
                                  {item.label}
                                </span>
                              </button>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
