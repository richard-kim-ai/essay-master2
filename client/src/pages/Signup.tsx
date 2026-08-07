import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, Lock, User, ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import { startLogin } from "@/const";

export default function Signup() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.password) {
      toast.error("모든 필드를 입력해주세요.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("비밀번호가 일치하지 않습니다.");
      return;
    }

    if (formData.password.length < 8) {
      toast.error("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    if (!formData.agreeTerms) {
      toast.error("약관에 동의해주세요.");
      return;
    }

    setIsLoading(true);
    try {
      // 마누스 OAuth 로그인 사용
      startLogin();
    } catch (error) {
      toast.error("회원가입에 실패했습니다.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-800 rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">논술 마스터</h1>
          </div>
          <p className="text-gray-600">
            지금 시작하세요. 무료입니다!
          </p>
        </div>

        {/* Signup Card */}
        <Card className="p-8 bg-white shadow-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">회원가입</h2>

          <form onSubmit={handleSignup} className="space-y-4">
            {/* Name Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이름
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  name="name"
                  placeholder="홍길동"
                  value={formData.name}
                  onChange={handleChange}
                  className="pl-10 py-2"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Email Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이메일
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  type="email"
                  name="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={handleChange}
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
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-10 py-2"
                  disabled={isLoading}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                8자 이상의 비밀번호를 입력해주세요.
              </p>
            </div>

            {/* Confirm Password Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호 확인
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  type="password"
                  name="confirmPassword"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="pl-10 py-2"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Terms Agreement */}
            <div className="space-y-2">
              <label className="flex items-start gap-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="agreeTerms"
                  checked={formData.agreeTerms}
                  onChange={handleChange}
                  className="mt-1"
                  disabled={isLoading}
                />
                <span>
                  <a href="#" className="text-blue-600 hover:underline">
                    이용약관
                  </a>
                  과{" "}
                  <a href="#" className="text-blue-600 hover:underline">
                    개인정보처리방침
                  </a>
                  에 동의합니다.
                </span>
              </label>
            </div>

            {/* Signup Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 font-semibold flex items-center justify-center gap-2"
            >
              {isLoading ? "가입 중..." : "회원가입"}
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

          {/* OAuth Signup */}
          <Button
            onClick={() => startLogin()}
            variant="outline"
            className="w-full py-2 font-semibold border-2 border-green-600 text-green-600 hover:bg-green-50"
          >
            마누스로 회원가입
          </Button>

          {/* Login Link */}
          <div className="text-center mt-6">
            <p className="text-gray-600">
              이미 계정이 있으신가요?{" "}
              <a
                href="/login"
                className="text-green-600 hover:text-green-700 font-semibold"
              >
                로그인
              </a>
            </p>
          </div>
        </Card>

        {/* Benefits */}
        <div className="mt-8 space-y-3">
          <div className="flex items-center gap-3 text-gray-700">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-sm">AI 기반 맞춤형 피드백</span>
          </div>
          <div className="flex items-center gap-3 text-gray-700">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-sm">14개 이상의 학습 도구</span>
          </div>
          <div className="flex items-center gap-3 text-gray-700">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-sm">완전 무료 사용</span>
          </div>
        </div>
      </div>
    </div>
  );
}
