// 결제 제공자(PG) 연동 지점. 결제 흐름의 나머지(주문·이용권·한도)는 이 인터페이스만 보고 동작한다.
//
// 현재: PAYMENT_PROVIDER 미설정 또는 "mock" → 실제 결제 없이 즉시 결제 완료로 처리하는 임시(테스트) 결제.
// 실제 결제 연동: 이 파일에 제공자 구현(createCheckout·refund)을 추가하고 환경 변수 PAYMENT_PROVIDER를 바꾼다.
// 자세한 순서는 docs/payment-integration.md 참고.

export type CheckoutRequest = {
  /** 우리 쪽 주문 번호(제공자에 전달하고, 웹훅·승인 확인 때 다시 받는다) */
  orderId: string;
  amountKrw: number;
  planName: string;
  buyer: { id: number; name: string | null; email: string | null };
};

export type CheckoutResult =
  /** 결제가 바로 끝났다(임시 결제, 또는 간편결제처럼 즉시 승인되는 경우) */
  | { status: "paid"; paymentKey: string }
  /** 결제창으로 이동해야 한다. 승인은 돌아온 뒤 서버가 제공자에게 확인한다. */
  | { status: "redirect"; url: string }
  | { status: "failed"; reason: string };

export type RefundResult = { refunded: boolean; reason?: string };

export interface PaymentProvider {
  /** 주문에 기록되는 제공자 이름 */
  name: string;
  /** true면 실제 돈이 오가지 않는 테스트 결제 */
  isTest: boolean;
  createCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
  refund(input: { paymentKey: string; amountKrw: number; reason: string }): Promise<RefundResult>;
}

/** 임시 결제: 실제 결제 없이 곧바로 승인된 것으로 처리한다. 결제 연동이 확정되기 전까지만 사용한다. */
export const mockProvider: PaymentProvider = {
  name: "mock",
  isTest: true,
  async createCheckout({ orderId }) {
    return { status: "paid", paymentKey: `mock_${orderId}` };
  },
  async refund() {
    return { refunded: true };
  },
};

/** 아직 연동되지 않은 실제 제공자. 설정만 바꿔서 결제가 "성공한 것처럼" 처리되는 일이 없도록 항상 실패한다. */
function notConfiguredProvider(name: string): PaymentProvider {
  const reason = `${name} 결제 연동이 아직 설정되지 않았습니다. 운영팀에 문의해 주세요.`;
  return {
    name,
    isTest: false,
    async createCheckout() {
      return { status: "failed", reason };
    },
    async refund() {
      return { refunded: false, reason };
    },
  };
}

// 연동 예정 제공자와 필요한 환경 변수(연동 시 구현을 채운다)
//  - portone:       PORTONE_API_SECRET, PORTONE_STORE_ID, PORTONE_CHANNEL_KEY
//  - tosspayments:  TOSS_PAYMENTS_SECRET_KEY, TOSS_PAYMENTS_CLIENT_KEY
export const KNOWN_PROVIDERS = ["mock", "portone", "tosspayments"] as const;

export function getPaymentProvider(name: string | undefined = process.env.PAYMENT_PROVIDER): PaymentProvider {
  const key = (name ?? "mock").trim().toLowerCase() || "mock";
  if (key === "mock") return mockProvider;
  if (key === "portone" || key === "tosspayments") return notConfiguredProvider(key);
  throw new Error(`알 수 없는 결제 제공자입니다: ${key}`);
}
