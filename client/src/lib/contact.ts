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

// 기초 이론 콘텐츠의 저작권 등록 정보. 푸터와 같은 방식으로, registrationNumber가 비어 있으면 표기하지 않는다.
// (등록번호가 정해지면 registrationNumber를 채우면 푸터에 표시된다. author는 필요할 때만 채운다.)
export const COPYRIGHT_INFO: {
  workTitle: string;
  author?: string;
  registrationNumber?: string;
  verifyUrl: string;
} = {
  workTitle: "논술의 기초",
  verifyUrl: "https://www.cros.or.kr/psnsys/cmmn/infoPage.do?w2xPath=/ui/twc/sch/regInfSerc/regInfSercList.xml",
};
