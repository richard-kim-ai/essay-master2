import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { startLogin } from "@/const";
import { BookOpen, Zap, Users, Award, ArrowRight, LogIn } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Navigation */}
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <BookOpen className="w-8 h-8 text-indigo-600" />
              <span className="text-2xl font-bold text-gray-900">논술 마스터</span>
            </div>
            <Button
              onClick={() => startLogin()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <LogIn className="w-4 h-4 mr-2" />
              로그인
            </Button>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              논술 실력을 <span className="text-indigo-600">체계적으로</span> 키우세요
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              초등부터 고등까지, 단계별 커리큘럼과 AI 피드백으로 논술의 기초부터 완성까지
            </p>
            <Button
              onClick={() => startLogin()}
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-lg px-8 py-6"
            >
              지금 시작하기
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <BookOpen className="w-8 h-8 text-indigo-600 mb-2" />
                <CardTitle>단계별 커리큘럼</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Level 1~4로 구성된 체계적인 학습 과정
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <Zap className="w-8 h-8 text-yellow-500 mb-2" />
                <CardTitle>AI 피드백</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  경제성, 명료성, 정확성 관점의 즉각적인 피드백
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <Users className="w-8 h-8 text-green-500 mb-2" />
                <CardTitle>선생님 첨삭</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  전문 선생님의 상세한 문장별 첨삭 피드백
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <Award className="w-8 h-8 text-purple-500 mb-2" />
                <CardTitle>수료증 발급</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  레벨별 수료증 및 졸업증서 발급
                </p>
              </CardContent>
            </Card>
          </div>

          {/* CTA Section */}
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              지금 바로 시작하세요
            </h2>
            <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
              로그인하여 초등 또는 중고등 과정을 선택하고 논술 학습을 시작하세요
            </p>
            <Button
              onClick={() => startLogin()}
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              로그인하기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated view
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-indigo-600" />
            <span className="text-2xl font-bold text-gray-900">논술 마스터</span>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">환영합니다!</p>
            <p className="text-lg font-semibold text-gray-900">{user?.name}</p>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">학습을 시작하세요</h1>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Elementary Course */}
          <Link href="/curriculum?type=elementary">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
              <CardHeader>
                <CardTitle className="text-2xl">초등 과정</CardTitle>
                <CardDescription>
                  낱말과 문장부터 상상력까지
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  초등학생을 위한 쉽고 재미있는 글쓰기 기초 학습
                </p>
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">📚 Level 1: 재미있는 낱말과 문장</p>
                  <p className="text-sm text-gray-500">📚 Level 2: 이야기 만들기</p>
                  <p className="text-sm text-gray-500">📚 Level 3: 생각 정리하기</p>
                  <p className="text-sm text-gray-500">📚 Level 4: 상상력 키우기</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Middle/High School Course */}
          <Link href="/curriculum?type=middle_high">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
              <CardHeader>
                <CardTitle className="text-2xl">중고등 과정</CardTitle>
                <CardDescription>
                  문장부터 논술까지 완벽하게
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  중고등학생을 위한 체계적인 논술 학습
                </p>
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">📚 Level 1: 문장의 기초</p>
                  <p className="text-sm text-gray-500">📚 Level 2: 단락의 논리적 연결</p>
                  <p className="text-sm text-gray-500">📚 Level 3: 구조적 분석 및 요약</p>
                  <p className="text-sm text-gray-500">📚 Level 4: 비판적 사고와 주제 설정</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Quick Links */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <Link href="/dashboard">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>학습 대시보드</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  진도율과 성취도를 한눈에 확인하세요
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/essay-submission">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>논술 제출</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  작성한 논술을 제출하고 피드백을 받으세요
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/ai-auto-feedback">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>AI 자동 첨삭</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  AI가 즉시 논술을 첨삭해드립니다
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
