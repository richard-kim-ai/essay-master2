# 결제 연동 가이드

현재 결제는 **임시(테스트) 결제**입니다. 결제 제공자(PG)가 확정되면 이 문서의 순서대로 실제 결제로 바꿉니다.

## 지금의 동작

- `PAYMENT_PROVIDER`가 없거나 `mock`이면 임시 결제입니다. 결제하기를 누르면 실제 청구 없이 바로 결제 완료로 처리되고 이용권이 시작됩니다.
- 임시 결제 주문은 `payment_orders.provider = 'mock'`, `isTest = 1`로 기록되어 관리자 결제 화면에 "테스트"로 표시됩니다. 실제 매출 집계에 섞이지 않도록 테스트 주문 수를 따로 보여 줍니다.
- 이용권 가격·기간·AI 평가 횟수는 `shared/plans.ts` 한 곳에서 정합니다(요금 페이지·결제 화면·서버 한도가 모두 이 값을 씁니다).
- 이용 자격 규칙(`server/billing/entitlements.ts`): 이용권(기간 안) > 7일 무료 체험(1회) > 이용권 필요. 교사·관리자는 한도가 없고 학부모는 AI 평가 대상이 아닙니다.

## 구성 요소

| 위치 | 역할 |
|---|---|
| `shared/plans.ts` | 이용권 정의(가격·기간·횟수) |
| `server/billing/providers.ts` | 결제 제공자 인터페이스(`createCheckout`, `refund`)와 임시 결제 구현 |
| `server/billing/entitlements.ts` | AI 평가 이용 자격 계산(순수 함수) |
| `server/billing/service.ts` | 사용자의 이용 자격 조회 |
| `server/billingDb.ts` | 주문·이용권·사용량·정산 데이터 접근 |
| `server/billingRouter.ts` | `billing.*`(결제), `settlement.*`(교사 정산) API |
| `client/src/pages/Checkout.tsx` | 이용권 선택·결제·해지 |
| `client/src/pages/AdminBilling.tsx` | 관리자 결제 내역·환불·이용권·교사 정산 |

## 실제 결제로 바꾸는 순서

1. 제공자를 정하고 가맹점 계약·테스트 키를 받습니다. 연동 예정 환경 변수:
   - PortOne: `PORTONE_API_SECRET`, `PORTONE_STORE_ID`, `PORTONE_CHANNEL_KEY`
   - 토스페이먼츠: `TOSS_PAYMENTS_SECRET_KEY`, `TOSS_PAYMENTS_CLIENT_KEY`
2. `server/billing/providers.ts`의 해당 제공자 구현(`notConfiguredProvider` 자리)을 채웁니다.
   - `createCheckout`: 제공자에 주문을 만들고 `{ status: "redirect", url }`(결제창 이동) 또는 `{ status: "paid", paymentKey }`를 돌려줍니다.
   - `refund`: 제공자의 취소 API를 호출하고 성공했을 때만 `{ refunded: true }`를 돌려줍니다.
3. **승인 확인을 서버에서** 합니다. 결제창에서 돌아온 뒤(또는 웹훅으로) 제공자 서버에 결제 상태·금액을 직접 조회하고, 우리 주문의 금액과 같을 때만 `billingDb.confirmOrderAndActivateSubscription`을 호출합니다. 클라이언트가 보낸 "결제 성공" 값만 믿고 이용권을 만들면 안 됩니다. 이 함수는 `pending` 주문에만 한 번 적용되므로 웹훅이 중복으로 와도 안전합니다.
4. 웹훅 엔드포인트(예: `/api/payments/webhook/:provider`)를 추가하고, 제공자가 정한 방식으로 서명을 검증합니다.
5. 운영 환경 변수 `PAYMENT_PROVIDER`를 `portone` 또는 `tosspayments`로 바꿉니다. 바꾸는 순간부터 새 주문은 `isTest = 0`으로 기록됩니다.
6. 소액 실결제와 환불을 한 번씩 시험합니다(관리자 > 결제·정산 관리 > 결제 내역 > 환불).
7. 이용약관·환불 정책·사업자 정보(`COMPANY_INFO`)를 게시합니다(전자상거래법 표시 의무).

## 주의

- 아직 연동되지 않은 제공자(`portone`, `tosspayments`)를 설정하면 결제가 **항상 실패**합니다. 설정만 바꿔서 결제가 성공한 것처럼 처리되는 일을 막기 위한 것입니다.
- 임시 결제로 만든 이용권은 실제 결제로 전환할 때 그대로 남습니다. 필요하면 관리자 화면에서 테스트 주문을 환불 처리해 이용권을 끝내세요.
- 환불은 주문을 만든 제공자로 처리합니다(임시 결제 주문을 실제 제공자로 환불하지 않습니다).

## DB 반영(마이그레이션 0049)

새 테이블 4개(`payment_orders`, `subscriptions`, `teacher_settlement_rates`, `teacher_settlements`)만 추가합니다. 기존 테이블과 데이터는 바꾸지 않습니다.

```bash
node scripts/apply-migration.mjs drizzle/0049_billing_and_settlement.sql          # 계획만 출력
node scripts/apply-migration.mjs drizzle/0049_billing_and_settlement.sql --apply  # 실제 적용
```

## 서버 환경 변수

| 변수 | 설명 |
|---|---|
| `PAYMENT_PROVIDER` | `mock`(기본) / `portone` / `tosspayments` |
| `PUBLIC_BASE_URL` | 서비스 주소(예: `https://example.com`). 메일 속 인증·재설정 링크의 주소로 쓰입니다 |
