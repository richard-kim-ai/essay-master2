import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  applySyncedEssay,
  mergeServerEssays,
  readEssays,
  writeEssays,
  type StoredEssay,
} from "@/lib/essayStorage";

export function useEssayWorkspace(userId?: number, allowServer = true) {
  const [online, setOnline] = useState(navigator.onLine);
  const [rows, setRows] = useState<StoredEssay[]>([]);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const rowsRef = useRef(rows);
  const ownerRef = useRef(userId);
  ownerRef.current = userId;
  const flight = useRef<Promise<void> | null>(null);
  const sync = trpc.essaySubmission.syncDraft.useMutation();
  const workspace = trpc.essaySubmission.workspace.useQuery(undefined, {
    enabled: !!userId && online && allowServer,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const commit = useCallback(
    (next: StoredEssay[]) => {
      if (!userId || ownerRef.current !== userId) return;
      writeEssays(userId, next); // 브라우저 저장 실패 때 성공이라고 표시하지 않는다.
      rowsRef.current = next;
      setRows(next);
    },
    [userId]
  );

  useEffect(() => {
    setReady(false);
    rowsRef.current = [];
    setRows([]);
    setError("");
    if (!userId) return;
    try {
      const stored = readEssays(userId);
      rowsRef.current = stored;
      setRows(stored);
      setReady(true);
    } catch {
      setError(
        "기기 보관함을 읽지 못했습니다. 브라우저 저장 공간을 확인해 주세요."
      );
    }
  }, [userId]);
  useEffect(() => {
    const connected = () => setOnline(true);
    const disconnected = () => setOnline(false);
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    return () => {
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
    };
  }, []);
  useEffect(() => {
    if (!userId || !ready || !workspace.data || !allowServer) return;
    try {
      commit(mergeServerEssays(rowsRef.current, workspace.data, userId));
    } catch {
      setError(
        "서버 글을 기기에 보관하지 못했습니다. 저장 공간을 확인해 주세요."
      );
    }
  }, [workspace.data, ready, userId, commit, allowServer]);

  const synchronize = useCallback(async () => {
    if (!userId || !navigator.onLine || !ready || !allowServer) return;
    if (flight.current) return flight.current;
    const owner = userId;
    const run = async () => {
      setSyncing(true);
      setError("");
      let failed = false;
      try {
        const pending = rowsRef.current.filter(
          row =>
            row.userId === owner &&
            row.isDirty &&
            row.title.trim() &&
            row.content.trim()
        );
        for (const sent of pending) {
          if (ownerRef.current !== owner || !navigator.onLine) break;
          try {
            const remote = await sync.mutateAsync({
              id: sent.id,
              clientId: sent.clientId,
              title: sent.title.trim(),
              content: sent.content,
              baseRevision: sent.id ? sent.syncRevision : undefined,
            });
            if (ownerRef.current !== owner) break;
            commit(
              rowsRef.current.map(row =>
                row.localId === sent.localId
                  ? applySyncedEssay(row, sent, remote)
                  : row
              )
            );
          } catch (err) {
            if (ownerRef.current !== owner) break;
            failed = true;
            const message =
              err instanceof Error ? err.message : "동기화에 실패했습니다.";
            commit(
              rowsRef.current.map(row =>
                row.localId === sent.localId
                  ? { ...row, syncError: message, isDirty: true }
                  : row
              )
            );
          }
        }
        if (ownerRef.current === owner && navigator.onLine) {
          const fetched = await workspace.refetch();
          if (fetched.data)
            commit(mergeServerEssays(rowsRef.current, fetched.data, owner));
        }
        if (failed && ownerRef.current === owner)
          setError(
            "일부 글이 아직 동기화되지 않았습니다. 글에 표시된 안내를 확인해 주세요."
          );
      } catch (err) {
        if (ownerRef.current === owner)
          setError(
            err instanceof Error ? err.message : "동기화를 완료하지 못했습니다."
          );
      } finally {
        flight.current = null;
        setSyncing(false);
      }
    };
    flight.current = run();
    return flight.current;
  }, [userId, ready, commit, sync.mutateAsync, workspace.refetch, allowServer]);
  const latestSync = useRef(synchronize);
  latestSync.current = synchronize;
  useEffect(() => {
    if (online && ready && userId && allowServer) void latestSync.current();
  }, [online, ready, userId, allowServer]);

  return {
    rows: rows.filter(row => row.userId === userId),
    ready,
    online,
    syncing,
    error:
      error ||
      (workspace.error
        ? "서버 보관함에 연결할 수 없습니다. 기기 글은 유지됩니다."
        : ""),
    commit,
    synchronize,
    latestRows: () => rowsRef.current.filter(row => row.userId === userId),
    refresh: workspace.refetch,
  };
}
