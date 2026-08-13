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
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  submenu?: NavItem[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "커리큘럼", href: "/curriculum", icon: BookOpen },
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

  const handleMobileSubmenuToggle = (label: string) => {
    setOpenMobileSubmenu(openMobileSubmenu === label ? null : label);
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
              <span className="font-bold text-lg text-gray-900 hidden sm:inline">
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
                      {user?.role === "admin" && <Link href="/admin/social-providers"><DropdownMenuItem className="cursor-pointer"><Settings className="w-4 h-4 mr-2" /><span>소셜 로그인 설정</span></DropdownMenuItem></Link>}
                      <DropdownMenuItem onClick={logout} className="cursor-pointer">
                        <LogOut className="w-4 h-4 mr-2" />
                        <span>로그아웃</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Mobile Menu */}
                <Sheet>
                  <SheetTrigger asChild className="md:hidden">
                    <Button variant="ghost" size="icon">
                      <Menu className="w-5 h-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-72">
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
                                        <button className="w-full flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm">
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
                            <button className="w-full flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                              {Icon && <Icon className="w-4 h-4" />}
                              <span className="text-sm font-medium">
                                {item.label}
                              </span>
                            </button>
                          </Link>
                        );
                      })}

                      {user?.role === "admin" && <Link href="/admin/social-providers"><button className="mb-3 flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><Settings className="w-4 h-4" />소셜 로그인 설정</button></Link>}
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
