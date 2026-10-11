export const LEGACY_ESSAY_KEY = "essay_master_offline_essays";
export const essayStorageKey = (userId: number) =>
  `essay_master_offline_essays_v2_${userId}`;

export type StoredEssay = {
  localId: string;
  userId: number;
  id?: number;
  clientId: string;
  title: string;
  content: string;
  status: "draft" | "submitted" | "reviewed";
  syncRevision: number;
  isDirty: boolean;
  updatedAt: string;
  createdAt: string;
  syncError?: string;
  teacherFeedback?: any;
  aiFeedback?: any;
};
const uuid = () => `local_${globalThis.crypto.randomUUID()}`;
const dateString = (value: unknown) =>
  value instanceof Date
    ? value.toISOString()
    : typeof value === "string"
      ? value
      : new Date().toISOString();

export function newLocalEssay(
  userId: number,
  title = "",
  content = ""
): StoredEssay {
  const localId = uuid();
  const now = new Date().toISOString();
  return {
    localId,
    clientId: localId,
    userId,
    title,
    content,
    status: "draft",
    syncRevision: 0,
    isDirty: true,
    createdAt: now,
    updatedAt: now,
  };
}
export function fromServerEssay(row: any): StoredEssay {
  const clientId = row.clientId || `server_${row.id}`;
  return {
    ...row,
    localId: clientId,
    clientId,
    userId: row.userId,
    syncRevision: row.syncRevision ?? 0,
    isDirty: false,
    updatedAt: dateString(row.updatedAt),
    createdAt: dateString(row.createdAt),
  };
}
export function readEssays(
  userId: number,
  storage: Storage = localStorage
): StoredEssay[] {
  const raw = storage.getItem(essayStorageKey(userId));
  if (!raw) return [];
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows)) throw new Error("보관함 형식이 올바르지 않습니다.");
  return rows.filter(
    (row): row is StoredEssay =>
      row?.userId === userId &&
      typeof row.localId === "string" &&
      typeof row.title === "string" &&
      typeof row.content === "string"
  );
}
export function writeEssays(
  userId: number,
  essays: StoredEssay[],
  storage: Storage = localStorage
) {
  storage.setItem(
    essayStorageKey(userId),
    JSON.stringify(essays.filter(row => row.userId === userId))
  );
}

/** 최신 서버 목록이 기기에서 아직 동기화하지 않은 글을 덮어쓰지 않는다. */
export function mergeServerEssays(
  local: StoredEssay[],
  server: any[],
  userId: number
): StoredEssay[] {
  const result = [...local.filter(row => row.userId === userId)];
  for (const value of server.filter(row => row.userId === userId)) {
    const remote = fromServerEssay(value);
    const index = result.findIndex(
      row => row.id === remote.id || row.clientId === remote.clientId
    );
    if (index < 0) result.push(remote);
    else if (!result[index].isDirty)
      result[index] = { ...remote, localId: result[index].localId };
  }
  return result.sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  );
}

/** 응답이 오는 동안 더 수정한 글은 서버 ID·버전만 반영하고 새 수정은 동기화 대기로 남긴다. */
export function applySyncedEssay(
  current: StoredEssay,
  sent: StoredEssay,
  remote: any
): StoredEssay {
  const unchanged =
    current.title === sent.title &&
    current.content === sent.content &&
    current.updatedAt === sent.updatedAt;
  return {
    ...current,
    id: remote.id,
    syncRevision: remote.syncRevision ?? 0,
    status: remote.status,
    isDirty: !unchanged,
    syncError: undefined,
    ...(unchanged ? { updatedAt: dateString(remote.updatedAt) } : {}),
  };
}

/** 소유자가 확인되지 않는 구형 캐시는 자동 업로드하지 않는다. 명시적 가져오기로 새 초안만 만든다. */
export function legacyEssayCandidates(
  userId: number,
  storage: Storage = localStorage
): any[] {
  if (storage.getItem(`${essayStorageKey(userId)}_legacy_imported`)) return [];
  const raw = storage.getItem(LEGACY_ESSAY_KEY);
  if (!raw) return [];
  const rows = JSON.parse(raw);
  return Array.isArray(rows)
    ? rows.filter(
        row =>
          row &&
          typeof row.title === "string" &&
          typeof row.content === "string" &&
          (row.userId === undefined || row.userId === userId)
      )
    : [];
}
export function importLegacyEssays(
  userId: number,
  storage: Storage = localStorage
): StoredEssay[] {
  const imported = legacyEssayCandidates(userId, storage).map(row =>
    newLocalEssay(userId, row.title, row.content)
  );
  // 원래 캐시는 삭제하거나 자동으로 다른 계정의 글과 연결하지 않는다.
  return imported;
}
