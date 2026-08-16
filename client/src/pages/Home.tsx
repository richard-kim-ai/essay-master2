import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Navigation from "@/components/Navigation";
import OfflineStatus from "@/components/OfflineStatus";
import InstallPrompt from "@/components/InstallPrompt";
import { Link } from "wouter";
import {
  BookOpen,
  Zap,
  BarChart3,
  Award,
  Users,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  FileText,
} from "lucide-react";

const FEATURES = [
  {
    icon: BookOpen,
    title: "단계별 커리큘럼",
    description: "초등부터 중고등까지 체계적인 논술 학습 커리큘럼",
  },
  {
    icon: Zap,
    title: "AI 피드백",
    description: "경제성, 명료성, 정확성 관점의 실시간 AI 첨삭",
  },
  {
    icon: FileText,
    title: "다양한 학습 도구",
    description: "단락 재구성, 요약 연습, 문장 교정 등 맞춤형 학습",
  },
  {
    icon: BarChart3,
    title: "학습 대시보드",
    description: "진도율, 성취도, 성장 그래프로 한눈에 확인",
  },
  {
    icon: Users,
    title: "선생님 첨삭",
    description: "전문 교사의 상세한 피드백과 개선 제안",
  },
  {
    icon: Award,
    title: "수료증 발급",
    description: "레벨별 수료증과 졸업증서 발급 및 공유",
  },
];

const LEARNING_TOOLS = [
  {
    href: "/quiz",
    icon: Zap,
    title: "AI 문장 교정",
    description: "문장을 입력하면 AI가 경제성, 명료성, 정확성을 평가합니다",
  },
  {
    href: "/paragraph-reordering",
    icon: FileText,
    title: "단락 재구성",
    description: "섞인 단락들을 올바른 순서로 정렬하는 드래그앤드롭 연습",
  },
  {
    href: "/summary-practice",
    icon: BookOpen,
    title: "요약 연습",
    description: "주어진 글을 읽고 핵심 내용을 요약하는 실시간 연습",
  },
  {
    href: "/mistake-notebook",
    icon: BarChart3,
    title: "오답 노트",
    description: "틀린 문제들을 자동으로 분류하여 관리하고 복습",
  },
];

const STATS = [
  { number: "10,000+", label: "활용 학생" },
  { number: "4.9/5", label: "평균 평점" },
  { number: "95%", label: "만족도" },
];

export default function Home() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <OfflineStatus />

      {/* 비로그인 방문자 안내 배너 */}
      {!isAuthenticated && (
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white py-3 px-4 text-center text-sm font-medium flex items-center justify-center gap-3 shadow-inner">
          <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">안내</span>
          <span>현재 <strong>로그인 전 샘플 모드</strong>로 플랫폼의 모든 핵심 기능을 미리 체험하실 수 있습니다.</span>
          <Link href="/login" className="underline hover:text-blue-100 font-bold ml-2">로그인 / 회원가입하기 →</Link>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge className="w-fit bg-blue-100 text-blue-700 px-4 py-2">
                  ✨ 2024년 최고의 논술 학습 플랫폼
                </Badge>
                <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
                  논술 마스터와 함께
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                    {" "}
                    글쓰기 실력 UP
                  </span>
                </h1>
                <p className="text-xl text-gray-600 leading-relaxed">
                  AI 기반 맞춤형 첨삭과 전문 교사의 피드백으로 논술 실력을 한 단계
                  업그레이드하세요.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/curriculum">
                  <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg rounded-lg">
                    지금 시작하기
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link href="/quiz">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto px-8 py-6 text-lg rounded-lg border-2 border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100"
                  >
                    <Sparkles className="w-5 h-5 mr-2 text-indigo-600" />
                    로그인 전 샘플 퀴즈 체험하기
                  </Button>
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 pt-8 border-t border-gray-200">
                {STATS.map((stat, idx) => (
                  <div key={idx}>
                    <p className="text-2xl font-bold text-blue-600">
                      {stat.number}
                    </p>
                    <p className="text-sm text-gray-600">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Visual */}
            <div className="relative hidden md:block">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-3xl blur-3xl opacity-20"></div>
              <div className="relative bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                    <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">AI 실시간 첨삭</span>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg">
                    <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">전문 교사 피드백</span>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-pink-50 rounded-lg">
                    <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">맞춤형 학습 경로</span>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-lg">
                    <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">진도 추적 대시보드</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 로그인 전용 샘플 체험 미리보기 섹션 */}
      <section className="py-16 bg-gradient-to-br from-slate-900 to-blue-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-400/30">Live Sample Experience</span>
            <h2 className="text-3xl md:text-4xl font-ext500 font-bold mt-3 mb-3">로그인 없이 바로 살펴보는 샘플 데이터</h2>
            <p className="text-slate-300 max-w-2xl mx-auto text-sm md:text-base">논술 마스터가 제공하는 AI 첨삭, 커리큘럼, 대시보드 성취도 및 수료증 발급 프리뷰를 체험해 보세요.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-slate-800/80 border-slate-700 p-6 text-white backdrop-blur shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded font-bold">샘플 대시보드</span>
                <span className="text-xs text-slate-400">초등 3단계 과정</span>
              </div>
              <h3 className="text-lg font-bold mb-2">학습 진도율 75% 프리뷰</h3>
              <div className="w-full bg-slate-700 h-2.5 rounded-full overflow-hidden my-3">
                <div className="bg-emerald-400 h-full w-3/4"></div>
              </div>
              <p className="text-xs text-slate-300 mb-4">이번 주 AI 첨삭 5회 완료, 글쓰기 정답률 92% 달성 현황 샘플 데이터</p>
              <Link href="/dashboard">
                <Button size="sm" variant="outline" className="w-full border-slate-600 text-slate-200 hover:bg-slate-700">대시보드 샘플 구경하기</Button>
              </Link>
            </Card>

            <Card className="bg-slate-800/80 border-slate-700 p-6 text-white backdrop-blur shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded font-bold">샘플 AI 첨삭</span>
                <span className="text-xs text-slate-400">경제성·명료성 분석</span>
              </div>
              <h3 className="text-lg font-bold mb-2">실시간 논술 첨삭 결과</h3>
              <div className="p-3 bg-slate-900/80 rounded-lg text-xs space-y-2 mb-4 border border-slate-700">
                <p className="text-emerald-400 font-semibold">✓ 점수: 92점 (우수)</p>
                <p className="text-slate-300 line-clamp-2">"주어와 서술어의 호응이 자연스럽고 논리 전개가 명확합니다."</p>
              </div>
              <Link href="/quiz">
                <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white">AI 퀴즈 바로 풀어보기</Button>
              </Link>
            </Card>

            <Card className="bg-slate-800/80 border-slate-700 p-6 text-white backdrop-blur shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded font-bold">샘플 수료증</span>
                <span className="text-xs text-slate-400">인증번호 발급됨</span>
              </div>
              <h3 className="text-lg font-bold mb-2">초등 논술 마스터 수료증</h3>
              <div className="p-3 bg-slate-900/80 rounded-lg text-xs space-y-1 mb-4 border border-slate-700">
                <p className="text-purple-300 font-mono">CERT-2026-SAMPLE</p>
                <p className="text-slate-400">발급일: 2026. 8. 16</p>
              </div>
              <Link href="/certificate">
                <Button size="sm" variant="outline" className="w-full border-slate-600 text-slate-200 hover:bg-slate-700">수료증 미리보기</Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* Learning Tools Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              다양한 학습 도구
            </h2>
            <p className="text-xl text-gray-600">
              각 학습 단계에 맞는 맞춤형 도구로 효과적인 학습을 경험하세요
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {LEARNING_TOOLS.map((tool, idx) => {
              const Icon = tool.icon;
              return (
                <Link key={idx} href={tool.href}>
                  <Card className="p-6 hover:shadow-lg transition-all cursor-pointer group h-full bg-white">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                        <Icon className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                          {tool.title}
                        </h3>
                        <p className="text-gray-600 text-sm">
                          {tool.description}
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0 mt-1" />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              논술 마스터의 특징
            </h2>
            <p className="text-xl text-gray-600">
              학생들의 성공을 위해 설계된 종합 학습 플랫폼
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {FEATURES.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <Card key={idx} className="p-8 hover:shadow-lg transition-all">
                  <div className="mb-4 p-3 w-fit bg-blue-100 rounded-lg">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">{feature.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            지금 바로 시작하세요
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            논술 마스터와 함께 글쓰기 실력을 한 단계 업그레이드하세요
          </p>
          <Link href="/curriculum">
            <Button className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-6 text-lg rounded-lg font-semibold">
              학습 시작하기
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-white font-semibold mb-4">논술 마스터</h4>
              <p className="text-sm">
                AI 기반 맞춤형 논술 학습 플랫폼
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">학습</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/curriculum" className="hover:text-white">커리큘럼</a></li>
                <li><a href="/dashboard" className="hover:text-white">대시보드</a></li>
                <li><a href="/quiz" className="hover:text-white">학습 도구</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">기타</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">고객 지원</a></li>
                <li><a href="#" className="hover:text-white">이용약관</a></li>
                <li><a href="#" className="hover:text-white">개인정보 보호</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">연락처</h4>
              <p className="text-sm">support@essaymaster.com</p>
              <p className="text-sm">1234-5678</p>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2024 논술 마스터. All rights reserved.</p>
          </div>
        </div>
      </footer>
      <InstallPrompt />
    </div>
  );
}
