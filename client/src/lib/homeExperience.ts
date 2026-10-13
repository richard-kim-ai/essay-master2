export type HomePrimaryAction = {
  href: string;
  label: string;
  description: string;
};

export function getHomePrimaryAction(
  isAuthenticated: boolean,
  role?: string | null,
): HomePrimaryAction {
  if (!isAuthenticated) {
    return {
      href: "/curriculum",
      label: "나에게 맞는 과정 찾기",
      description: "과정을 둘러보고 원하는 단계부터 시작할 수 있습니다.",
    };
  }

  if (role === "admin") {
    return {
      href: "/admin",
      label: "운영 현황 보기",
      description: "학습자 현황과 운영 도구로 바로 이동합니다.",
    };
  }

  if (role === "teacher") {
    return {
      href: "/teacher-mypage",
      label: "지도 학생 보기",
      description: "담당 학생의 학습 현황과 피드백 업무를 확인합니다.",
    };
  }

  return {
    href: "/mypage",
    label: "내 학습 이어가기",
    description: "내 과정, 최근 학습 기록, 다음 할 일을 확인합니다.",
  };
}

export function getHomeSecondaryAction(isAuthenticated: boolean) {
  return isAuthenticated
    ? { href: "/curriculum", label: "다른 과정 살펴보기" }
    : { href: "/login", label: "로그인 / 회원가입" };
}
