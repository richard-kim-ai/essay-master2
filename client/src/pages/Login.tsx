import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight, BookOpen } from "lucide-react";
import { startLogin } from "@/const";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setIsLoading(true);
    try {
      // 마누스 OAuth 로그인 사용
      startLogin();
    } catch (error) {
      toast.error("로그인에 실패했습니다.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">논술 마스터</h1>
          </div>
          <p className="text-gray-600">
            AI 기반 맞춤형 논술 학습 플랫폼
          </p>
        </div>

        {/* Login Card */}
        <Card className="p-8 bg-white shadow-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">로그인</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이메일
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 py-2"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 py-2"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-gray-600">
                <input type="checkbox" className="rounded" />
                로그인 상태 유지
              </label>
              <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
                비밀번호 찾기
              </a>
            </div>

            {/* Login Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 font-semibold flex items-center justify-center gap-2"
            >
              {isLoading ? "로그인 중..." : "로그인"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">또는</span>
            </div>
          </div>

          {/* OAuth Login */}
          <Button
            onClick={() => startLogin()}
            variant="outline"
            className="w-full py-2 font-semibold border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            마누스로 로그인
          </Button>

          {/* Sign Up Link */}
          <div className="text-center mt-6">
            <p className="text-gray-600">
              아직 계정이 없으신가요?{" "}
              <a
                href="/signup"
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                회원가입
              </a>
            </p>
          </div>
        </Card>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 mb-2">14+</div>
            <p className="text-sm text-gray-600">학습 도구</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 mb-2">AI</div>
            <p className="text-sm text-gray-600">자동 첨삭</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 mb-2">100%</div>
            <p className="text-sm text-gray-600">무료</p>
          </div>
        </div>
      </div>
    </div>
  );
}
