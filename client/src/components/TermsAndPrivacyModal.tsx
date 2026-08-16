import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

interface Props {
  type: "terms" | "privacy" | null;
  onClose: () => void;
}

export function TermsAndPrivacyModal({ type, onClose }: Props) {
  const settingKey = type === "terms" ? "terms_of_service" : "privacy_policy";
  const { data: content, isLoading } = trpc.admin.getSiteSettingAdmin.useQuery({ settingKey }, { enabled: !!type });

  const defaultTerms = `제1조(목적) 이 약관은 논술 마스터(Essay Master) 플랫폼(이하 "회사"라 함)이 제공하는 논술 교육 및 학습 관리 서비스(이하 "서비스"라 함)의 이용조건 및 절차, 회사와 회원 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
제2조(용어의 정의) 이 약관에서 사용하는 용어의 정의는 다음과 같습니다.
1. "서비스"란 구현되는 단말기(PC, 태블릿, 모바일 등)와 상관없이 회원이 이용할 수 있는 논술 마스터 제반 서비스를 의미합니다.
2. "회원"이란 회사의 서비스에 접속하여 이 약관에 동의하고 회사가 제공하는 아이디를 부여받은 자를 말합니다.
제3조(약관의 효력과 변경) 본 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이 발생합니다.`;

  const defaultPrivacy = `논술 마스터(Essay Master)는 개인정보보호법 등 관련 법령을 준수하며, 이용자의 권익 보호에 최선을 다합니다.
1. 수집하는 개인정보 항목: 성명, 이메일, 비밀번호, 학습 진도 기록, 첨삭 제출물
2. 개인정보의 수집 및 이용 목적: 회원 가입 의사 확인, AI 및 교사 맞춤형 논술 첨삭 서비스 제공, 수료증 발급
3. 개인정보의 보유 및 이용 기간: 회원 탈퇴 시까지 또는 관계 법령에 따라 보존 필요 시까지`;

  const textToDisplay = content || (type === "terms" ? defaultTerms : defaultPrivacy);

  return (
    <Dialog open={type !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{type === "terms" ? "이용약관" : "개인정보처리방침"}</DialogTitle>
          <DialogDescription>논술 마스터 서비스 이용에 관한 중요 정책입니다.</DialogDescription>
        </DialogHeader>
        <div className="py-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
          {isLoading ? "불러오는 중..." : textToDisplay}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
