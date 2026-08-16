import { useState } from "react";
import { Link, useLocation } from "wouter";
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
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  submenu?: NavItem[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "커리큘럼", href: "/curriculum", icon: BookOpen },
  { label: "추천 아카이브", href: "/essay-archive", icon: GraduationCap },
  { label: "대시보드", href: "/dashboard", icon: BarChart3 },
  { label: "오프라인 보관함", href: "/offline-essays", icon: FileText },
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
  { label: "수료증", href: "/certificate", icon: Award },
];

export default function Navigation() {
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [openMobileSubmenu, setOpenMobileSubmenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled>
                        <span className="text-xs text-gray-500">
                          {user?.email}
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
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
                              <span>관리자 대시보드</span>
                            </DropdownMenuItem>
                          </Link>
                          <Link href="/admin/certificates">
                            <DropdownMenuItem className="cursor-pointer">
                              <Award className="w-4 h-4 mr-2" />
                              <span>수료증 관리</span>
                            </DropdownMenuItem>
                          </Link>
                          <Link href="/admin/curriculum">
                            <DropdownMenuItem className="cursor-pointer">
                              <BookOpen className="w-4 h-4 mr-2" />
                              <span>커리큘럼 카테고리 관리</span>
                            </DropdownMenuItem>
                          </Link>
                          <Link href="/admin/social-providers">
                            <DropdownMenuItem className="cursor-pointer">
                              <Settings className="w-4 h-4 mr-2" />
                              <span>소셜 로그인 및 푸시 설정</span>
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
                          <p className="px-4 text-xs font-bold text-indigo-600 uppercase mb-2">관리자 메뉴 (마이페이지 하위)</p>
                          <Link href="/admin">
                            <button onClick={handleMobileLinkClick} className="mb-2 flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm text-gray-800 bg-indigo-50 hover:bg-indigo-100 font-semibold">
                              <Settings className="w-4 h-4 text-indigo-600" />
                              <span>학습자 전체 대시보드</span>
                            </button>
                          </Link>
                          <Link href="/admin/certificates">
                            <button onClick={handleMobileLinkClick} className="mb-2 flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                              <Award className="w-4 h-4" />
                              <span>수료증 관리</span>
                            </button>
                          </Link>
                          <Link href="/admin/curriculum">
                            <button onClick={handleMobileLinkClick} className="mb-2 flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                              <BookOpen className="w-4 h-4" />
                              <span>커리큘럼 카테고리 관리</span>
                            </button>
                          </Link>
                          <Link href="/admin/social-providers">
                            <button onClick={handleMobileLinkClick} className="mb-2 flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                              <Settings className="w-4 h-4" />
                              <span>소셜 로그인 및 푸시 설정</span>
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
