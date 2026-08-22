export type AccountConsentRole = "student" | "parent" | "teacher";

export type DefaultPolicyDocument = {
  policyKey: "terms_of_service" | "privacy_policy" | "ai_learning_consent" | "teacher_ai_code";
  title: string;
  version: string;
  requiredForRoles: AccountConsentRole[];
  isRequired: boolean;
  consentType: "required_service" | "optional_ai_learning" | "teacher_ai_style" | "guardian_authorization";
  content: string;
};

const DRAFT_NOTICE = "> **법률 검토 전 운영 초안** — 본 문안은 서비스 기능 구현을 위한 초안입니다. 실제 공개·시행 전에는 개인정보보호 및 교육 서비스 전문 법률 검토를 거쳐 사업자 정보, 담당 부서, 보유 기간, 권리 행사 방법을 확정해야 합니다.\n\n";

export const DEFAULT_POLICY_DOCUMENTS: DefaultPolicyDocument[] = [
  {
    policyKey: "terms_of_service",
    title: "논술 마스터 서비스 이용약관",
    version: "2026-08-18-v1",
    requiredForRoles: ["student", "parent", "teacher"],
    isRequired: true,
    consentType: "required_service",
    content: `${DRAFT_NOTICE}# 논술 마스터 서비스 이용약관\n\n## 1. 서비스 목적\n논술 마스터는 학습 기록 관리, AI 기반 첨삭 보조, 교사 첨삭 및 커리큘럼 학습 기능을 제공합니다. AI 결과는 학습 보조 정보이며, 입시·성적·자격에 관한 최종 판단이나 교사의 전문적 평가를 대체하지 않습니다.\n\n## 2. 계정 및 역할\n학생, 학부모, 첨삭교사는 자신의 계정 역할에 맞는 정보를 정확히 제공해야 합니다. 첨삭교사는 승인된 권한 범위 안에서만 학생 답안과 AI 초안에 접근할 수 있습니다.\n\n## 3. AI 첨삭 보조\nAI는 교사가 설정·승인한 기준에 따라 첨삭 초안을 제안할 수 있습니다. 교사별 AI 보조 봇의 출력은 교사 승인 전까지 학생에게 확정 첨삭으로 제공되지 않습니다.\n\n## 4. 금지 행위\n타인의 계정 이용, 학생 답안의 무단 복사·공개, 교사 코멘트의 무단 수집·재배포, 서비스 보안 우회 행위를 금지합니다.\n\n## 5. 정책 변경\n중요 변경 시 시행일과 변경 내용을 고지하며, 재동의가 필요한 정책은 별도 확인 절차를 제공합니다.`,
  },
  {
    policyKey: "privacy_policy",
    title: "개인정보처리방침",
    version: "2026-08-18-v1",
    requiredForRoles: ["student", "parent", "teacher"],
    isRequired: true,
    consentType: "required_service",
    content: `${DRAFT_NOTICE}# 개인정보처리방침\n\n## 1. 수집 항목과 목적\n계정 생성 시 이름, 이메일, 역할을 수집하고, 서비스 이용 중 학습 답안·진도·교사 첨삭·AI 초안 및 수정 이력을 학습 서비스 제공, 교사 지도, 품질 관리 목적으로 처리합니다.\n\n## 2. 접근 통제\n학생 답안은 본인, 배정된 교사, 권한을 가진 관리자만 업무 목적 범위에서 접근합니다. 교사별 AI 보조 봇에는 식별자를 제거하거나 대체한 승인 사례만 사용합니다.\n\n## 3. 보관과 파기\n서비스 제공에 필요한 원본 데이터와 AI 개선 후보 데이터는 목적별로 분리합니다. 개선 후보 데이터는 교사·관리자 승인 및 보관 기간 설정을 거치며, 철회·삭제 요청 또는 보관 기간 만료 시 운영 정책에 따라 파기 또는 비식별 처리합니다.\n\n## 4. 정보주체 권리\n이용자는 열람, 정정, AI 개선 활용 철회, 학습 데이터 삭제를 요청할 수 있습니다. 요청은 관리자 검토 및 처리 이력으로 관리됩니다.\n\n## 5. 외부 AI 제공\nAI 첨삭 기능은 서버를 통해 모델 공급자에게 필요한 최소한의 텍스트를 전송할 수 있습니다. 공급자, 전송 범위, 보관 기준은 실제 운영 계약과 함께 별도 고지합니다.`,
  },
  {
    policyKey: "ai_learning_consent",
    title: "AI 품질 개선용 가명 학습 데이터 활용 동의",
    version: "2026-08-18-v1",
    requiredForRoles: ["student", "parent"],
    isRequired: false,
    consentType: "optional_ai_learning",
    content: `${DRAFT_NOTICE}# AI 품질 개선용 가명 학습 데이터 활용 동의\n\n본 동의는 서비스 이용에 필수 사항이 아닙니다. 동의한 경우에만 학생 답안과 교사 최종 첨삭의 식별자를 제거·대체한 사례를 AI 품질 평가와 개선 후보 검토에 활용합니다. 원본 답안은 자동으로 학습 데이터가 되지 않으며, 교사·관리자 승인과 가명처리 확인을 거친 사례만 후보가 됩니다. 동의는 언제든 철회할 수 있고, 철회 이후 신규 사례 수집은 중단됩니다.`,
  },
  {
    policyKey: "teacher_ai_code",
    title: "첨삭교사 AI 보조 봇 운영·승인 규정",
    version: "2026-08-18-v1",
    requiredForRoles: ["teacher"],
    isRequired: true,
    consentType: "teacher_ai_style",
    content: `${DRAFT_NOTICE}# 첨삭교사 AI 보조 봇 운영·승인 규정\n\n교사별 AI 보조 봇은 교사가 승인한 스타일 지침과 사례를 참고해 첨삭 초안을 작성합니다. 교사는 사례 등록 전 식별자 제거 여부를 확인하고, AI 초안을 검토·수정·승인한 뒤에만 학생에게 전달합니다. 교사는 승인 사례의 AI 개선 활용 여부를 건별로 선택할 수 있으며, 철회된 사례는 신규 개선 후보에서 제외됩니다.`,
  },
];

export function requiredPolicyKeysForRole(role: AccountConsentRole) {
  return DEFAULT_POLICY_DOCUMENTS.filter((document) => document.isRequired && document.requiredForRoles.includes(role)).map((document) => document.policyKey);
}

export function defaultPolicyContent(settingKey: string) {
  return DEFAULT_POLICY_DOCUMENTS.find((document) => document.policyKey === settingKey)?.content ?? "";
}
