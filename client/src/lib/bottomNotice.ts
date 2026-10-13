import { useEffect, useSyncExternalStore } from "react";

// 화면 하단에 고정되는 안내(회원가입 배너, 푸시 알림 안내, 앱 설치 안내)가 서로 겹치지 않도록
// 한 번에 하나만 보이게 조정한다. 보이고 싶은 안내 중 우선순위가 가장 높은 것만 활성화된다.

export const BOTTOM_NOTICE_PRIORITY = {
  signupBanner: 3,
  pushPermission: 2,
  installApp: 1,
} as const;

const requests = new Map<string, number>();
const listeners = new Set<() => void>();
let activeId: string | null = null;

function recompute() {
  let next: string | null = null;
  let nextPriority = -Infinity;
  requests.forEach((priority, id) => {
    if (priority > nextPriority) {
      next = id;
      nextPriority = priority;
    }
  });
  if (next !== activeId) {
    activeId = next;
    listeners.forEach((listener) => listener());
  }
}

export function requestBottomNotice(id: string, priority: number) {
  requests.set(id, priority);
  recompute();
}

export function releaseBottomNotice(id: string) {
  requests.delete(id);
  recompute();
}

export function getActiveBottomNotice() {
  return activeId;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 이 안내가 지금 화면에 보여도 되는지 반환한다. wantsToShow가 true인 동안 자리를 요청한다. */
export function useBottomNotice(id: string, priority: number, wantsToShow: boolean): boolean {
  useEffect(() => {
    if (!wantsToShow) return;
    requestBottomNotice(id, priority);
    return () => releaseBottomNotice(id);
  }, [id, priority, wantsToShow]);
  const active = useSyncExternalStore(subscribe, getActiveBottomNotice, () => null);
  return wantsToShow && active === id;
}

/** 하단 고정 안내가 하나라도 떠 있는지(푸터가 가려지지 않게 여백을 넣을 때 사용). */
export function useHasBottomNotice(): boolean {
  return useSyncExternalStore(subscribe, getActiveBottomNotice, () => null) !== null;
}
