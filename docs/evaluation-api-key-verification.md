# 외부 첨삭 API 키 암호화 검증 절차

관리자는 운영 환경과 분리된 테스트 키를 사용하여 검증해야 합니다. `/admin/evaluation-models`에서 모델 ID, HTTPS Endpoint, 허용 도메인, 테스트 API 키를 입력하고 저장합니다. 저장 직후 화면의 등록 모델 목록에는 모델 ID, Endpoint, 제한 시간, 허용 도메인만 보이며 API 키는 다시 표시되지 않아야 합니다.

DB 접근 권한이 있는 운영 담당자는 `evaluation_model_configs.encryptedApiKey` 값을 확인합니다. 이 값은 입력한 테스트 키와 달라야 하며 `.`으로 구분된 세 조각의 base64url 형식(IV·인증 태그·암호문)으로만 확인합니다. 실제 키 전체를 운영 로그, 화면 캡처, 티켓, 채팅에 복사해서는 안 됩니다. 같은 테스트 키를 두 번 저장하면 난수 IV 때문에 두 암호문이 서로 달라야 합니다.

서버 내부에서는 `decryptSecret(encryptedApiKey)`로만 호출 시점에 복호화합니다. 관리자 모델 목록 API는 `encryptedApiKey`를 응답에서 제거하므로 브라우저 개발자 도구의 응답 본문과 서버 운영 로그에도 평문 키가 없어야 합니다. 회귀 검사는 `pnpm exec vitest run server/security.test.ts server/evaluationNotification.test.ts`로 실행하며, 이 테스트는 복호화 가능성·평문 비포함·암호문 매번 변경을 점검합니다.

검증이 끝나면 테스트 키를 폐기하고 실제 키를 새로 등록합니다. Endpoint는 HTTPS와 허용 도메인을 동시에 만족해야 하며, localhost와 사설 IP는 저장 단계에서 거부됩니다.
