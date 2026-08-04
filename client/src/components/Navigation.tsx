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
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  submenu?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "커리큘럼", href: "/curriculum", icon: BookOpen },
  { label: "대시보드", href: "/dashboard", icon: BarChart3 },
  { label: "학습 도구", href: "#", submenu: true },
  { label: "수료증", href: "/certificate", icon: Award },
];

const LEARNING_TOOLS: NavItem[] = [
  { label: "AI 문장 교정", href: "/quiz", icon: Zap },
  { label: "단락 재구성", href: "/paragraph-reordering", icon: FileText },
  { label: "요약 연습", href: "/summary-practice", icon: BookOpen },
  { label: "오답 노트", href: "/mistake-notebook", icon: BarChart3 },
];

export default function Navigation() {
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const isActive = (href: string) => location === href;

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/">
            <span className="flex items-center gap-2 font-bold text-xl text-blue-600 hover:text-blue-700 transition-colors cursor-pointer">
              <BookOpen className="w-6 h-6" />
              <span className="hidden sm:inline">논술 마스터</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              if (item.submenu) {
                return (
                  <DropdownMenu key={item.label}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="text-gray-700 hover:text-blue-600"
                      >
                        {item.label}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      {LEARNING_TOOLS.map((tool) => {
                        const Icon = tool.icon;
                        return (
                          <DropdownMenuItem key={tool.href} asChild>
                            <Link href={tool.href}>
                              <span className="flex items-center gap-2 cursor-pointer">
                                {Icon && <Icon className="w-4 h-4" />}
                                {tool.label}
                              </span>
                            </Link>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive(item.href) ? "default" : "ghost"}
                    className={`text-gray-700 hover:text-blue-600 ${isActive(item.href) ? "bg-blue-100 text-blue-600" : ""}`}
                  >
                    {Icon && <Icon className="w-4 h-4 mr-2" />}
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* Right Side - Auth & Mobile Menu */}
          <div className="flex items-center gap-2">
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 text-gray-700"
                  >
                    <User className="w-4 h-4" />
                    <span className="hidden sm:inline text-sm">{user.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled>
                    <span className="text-sm">{user.email}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()}>
                    <LogOut className="w-4 h-4 mr-2" />
                    로그아웃
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={startLogin}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                로그인
              </Button>
            )}

            {/* Mobile Menu */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <div className="flex flex-col gap-4 mt-8">
                  {/* Mobile Nav Items */}
                  {NAV_ITEMS.map((item) => {
                    if (item.submenu) {
                      return (
                        <div key={item.label}>
                          <p className="px-4 py-2 font-semibold text-gray-900">
                            {item.label}
                          </p>
                          <div className="pl-4 space-y-2">
                            {LEARNING_TOOLS.map((tool) => {
                              const Icon = tool.icon;
                              return (
                                <Link key={tool.href} href={tool.href}>
                                  <span
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer block"
                                  >
                                    {Icon && <Icon className="w-4 h-4" />}
                                    {tool.label}
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    const Icon = item.icon;
                    return (
                      <Link key={item.href} href={item.href}>
                        <span
                          onClick={() => setIsOpen(false)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors cursor-pointer block ${
                            isActive(item.href)
                              ? "bg-blue-100 text-blue-600 font-semibold"
                              : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          {Icon && <Icon className="w-4 h-4" />}
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
