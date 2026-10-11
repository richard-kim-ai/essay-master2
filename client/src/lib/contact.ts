// 운영 문의 연락처. 요금 정책, 푸터 등 화면 여러 곳에서 같은 값을 쓴다.
export const CONTACT_EMAIL = "ceo@ufinsu.com";
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;

// 푸터에 표시할 사업자 정보. 값이 정해지면 채워 넣으면 푸터에 나타나고, 비어 있는 항목은 표시하지 않는다.
// (추후 입력 예정: 상호, 대표자, 사업자등록번호, 통신판매업 신고번호, 주소, 개인정보 보호책임자)
export const COMPANY_INFO: {
  name?: string;
  ceo?: string;
  businessNumber?: string;
  mailOrderNumber?: string;
  address?: string;
  privacyOfficer?: string;
} = {};
