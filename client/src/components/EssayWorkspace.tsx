import React, { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import LoginRequired from "@/components/LoginRequired";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText,
  Cloud,
  WifiOff,
  RefreshCw,
  Plus,
  Save,
  Sparkles,
  Send,
  Copy,
  Loader2,
  BookOpen,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useEssayWorkspace } from "@/hooks/useEssayWorkspace";
import {
  essayStorageKey,
  importLegacyEssays,
  legacyEssayCandidates,
  newLocalEssay,
  type StoredEssay,
} from "@/lib/essayStorage";
import {
  getCourseTypeFromUserTag,
  COURSE_OPTIONS,
  type CourseType,
} from "@shared/course";
import { EvaluationLoadingState } from "@/components/EvaluationLoadingState";

function feedbackList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(v => typeof v === "string");
  if (typeof value === "string") {
    try {
      const rows = JSON.parse(value);
      return Array.isArray(rows) ? rows.filter(v => typeof v === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function EssayWorkspace({
  offline = false,
}: {
  offline?: boolean;
}) {
  const auth = useAuth();
  const [lastOfflineUser] = useState(() => {
    try {
      const cached = JSON.parse(
        localStorage.getItem("essay_workspace_last_owner") || "null"
      );
      return cached && Number.isInteger(cached.id) ? cached : null;
    } catch {
      return null;
    }
  });
  // 이 정보는 기기 글을 여는 용도뿐이다. 서버 인증이나 권한으로 사용하지 않는다.
  const user = auth.user || (!navigator.onLine ? lastOfflineUser : null);
  const authLoading = auth.loading;
  const [, navigate] = useLocation();
  const store = useEssayWorkspace(user?.id, Boolean(auth.user));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const editorSource = useRef({ title: "", content: "" });
  const [busy, setBusy] = useState<"teacher" | "ai" | null>(null);
  const [evaluationStep, setEvaluationStep] = useState(0);
  const [legacy, setLegacy] = useState<any[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [teacherResult, setTeacherResult] = useState("");
  const [course, setCourse] = useState<CourseType>("middle_high");
  const teacherRequest = trpc.essaySubmission.requestTeacher.useMutation();
  const aiRequest = trpc.aiAutoFeedback.create.useMutation();
  const selected = store.rows.find(
    row => row.localId === selectedId && row.userId === user?.id
  );
  const enrolled =
    user?.role === "user" && user.tag !== "학부모"
      ? getCourseTypeFromUserTag(user.tag)
      : course;
  const quota = trpc.aiAutoFeedback.getTodayQuota.useQuery(undefined, {
    enabled: !!auth.user && store.online,
  });
  const unsaved =
    !!selected && (title !== selected.title || content !== selected.content);
  const locked = !!selected && selected.status !== "draft";
  const disabled = busy !== null || store.syncing;

  useEffect(() => {
    if (!auth.user) {
      if (!auth.loading && navigator.onLine)
        localStorage.removeItem("essay_workspace_last_owner");
      return;
    }
    try {
      localStorage.setItem(
        "essay_workspace_last_owner",
        JSON.stringify({
          id: auth.user.id,
          role: auth.user.role,
          tag: auth.user.tag,
        })
      );
    } catch {}
  }, [auth.user?.id]);
  useEffect(() => {
    if (busy !== "ai") {
      setEvaluationStep(0);
      return;
    }
    const timer = window.setInterval(
      () => setEvaluationStep(step => Math.min(3, step + 1)),
      2000
    );
    return () => window.clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    setSelectedId(null);
    setTitle("");
    setContent("");
    setTeacherResult("");
    setLegacy([]);
    if (user) {
      try {
        setLegacy(legacyEssayCandidates(user.id));
      } catch {
        toast.error("기존 기기 글을 읽지 못했습니다.");
      }
    }
  }, [user?.id]);
  useEffect(() => {
    if (!store.ready || selectedId || !store.rows.length) return;
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get("essay"));
    const first = store.rows.find(row => row.id === id) || store.rows[0];
    setSelectedId(first.localId);
    setTitle(first.title);
    setContent(first.content);
    editorSource.current = { title: first.title, content: first.content };
  }, [store.ready, store.rows, selectedId]);
  useEffect(() => {
    if (!selected) return;
    const previous = editorSource.current;
    setTitle(current =>
      current === previous.title ? selected.title : current
    );
    setContent(current =>
      current === previous.content ? selected.content : current
    );
    editorSource.current = { title: selected.title, content: selected.content };
  }, [selected?.title, selected?.content]);
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const choose = (row: StoredEssay) => {
    if (
      unsaved &&
      !window.confirm(
        "저장하지 않은 수정이 있습니다. 저장하지 않고 다른 글을 열까요?"
      )
    )
      return;
    setSelectedId(row.localId);
    setTitle(row.title);
    setContent(row.content);
    setTeacherResult("");
    editorSource.current = { title: row.title, content: row.content };
  };
  const add = () => {
    if (
      !user ||
      !store.ready ||
      (unsaved &&
        !window.confirm("수정 내용을 저장하지 않고 새 글을 작성할까요?"))
    )
      return;
    try {
      const row = newLocalEssay(user.id);
      store.commit([row, ...store.latestRows()]);
      setSelectedId(row.localId);
      setTitle(row.title);
      setContent(row.content);
      setTeacherResult("");
      editorSource.current = { title: row.title, content: row.content };
    } catch {
      toast.error("기기에 저장할 수 없습니다. 저장 공간을 확인해 주세요.");
    }
  };
  const save = async () => {
    if (!selected || !title.trim() || !content.trim() || locked) return null;
    try {
      const draft = {
        ...selected,
        title: title.trim(),
        content,
        isDirty: true,
        updatedAt: new Date().toISOString(),
        syncError: undefined,
      };
      store.commit(
        store
          .latestRows()
          .map(row => (row.localId === selected.localId ? draft : row))
      );
      setTitle(draft.title);
      if (store.online) await store.synchronize();
      return (
        store.latestRows().find(row => row.localId === selected.localId) || null
      );
    } catch {
      toast.error(
        "글을 저장하지 못했습니다. 내용을 복사해 보관하고 저장 공간을 확인해 주세요."
      );
      return null;
    }
  };
  const saveClick = async () => {
    const row = await save();
    if (row)
      toast.success(
        row.isDirty
          ? "기기에 저장했습니다. 서버 동기화는 대기 중입니다."
          : "기기와 서버에 저장했습니다."
      );
  };
  const copyDraft = () => {
    if (!user || !selected) return;
    try {
      const copy = newLocalEssay(
        user.id,
        `${selected.title} (수정본)`,
        selected.content
      );
      store.commit([copy, ...store.latestRows()]);
      choose(copy);
    } catch {
      toast.error("수정본을 기기에 저장하지 못했습니다.");
    }
  };
  const readyForRequest = async () => {
    if (!auth.user || !store.online || !navigator.onLine) {
      toast.info("로그인된 온라인 상태에서 첨삭을 요청할 수 있습니다.");
      return null;
    }
    if (!selected || !title.trim() || !content.trim()) {
      toast.info("제목과 본문을 작성해 주세요.");
      return null;
    }
    if (locked && unsaved) return null;
    if (!locked && (unsaved || selected.isDirty)) await save();
    else await store.synchronize();
    const row = store
      .latestRows()
      .find(row => row.localId === selected.localId);
    if (!row?.id || row.isDirty) {
      toast.error(
        "서버 동기화를 완료한 뒤 첨삭을 요청해 주세요. 기기 글은 유지됩니다."
      );
      return null;
    }
    return row;
  };
  const requestTeacher = async () => {
    setBusy("teacher");
    try {
      const row = await readyForRequest();
      if (!row) return;
      const result = await teacherRequest.mutateAsync({ essayId: row.id! });
      store.commit(
        store
          .latestRows()
          .map(item =>
            item.localId === row.localId
              ? { ...item, status: result.status, isDirty: false }
              : item
          )
      );
      setTeacherResult(
        "담당 교사에게 첨삭을 요청했습니다. 완료 후 이 화면에서 피드백을 확인할 수 있습니다."
      );
      await store.synchronize();
      toast.success("교사 첨삭을 요청했습니다.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "교사 첨삭을 요청하지 못했습니다."
      );
    } finally {
      setBusy(null);
    }
  };
  const requestAi = async () => {
    setBusy("ai");
    try {
      const row = await readyForRequest();
      if (!row) return;
      if (row.content.trim().length < 20) {
        toast.info("AI 첨삭은 20자 이상 작성한 글에서 이용할 수 있습니다.");
        return;
      }
      const result = await aiRequest.mutateAsync({
        essayId: row.id!,
        essayTitle: row.title,
        essayContent: row.content.trim(),
        courseType: enrolled,
        level: 1,
      });
      // 자유 글은 레슨 1 체험 제출로 위장하지 않는다. 서버의 이용권·동의·한도를 그대로 적용한다.
      store.commit(
        store
          .latestRows()
          .map(item =>
            item.localId === row.localId
              ? { ...item, aiFeedback: result }
              : item
          )
      );
      await store.synchronize();
      await quota.refetch();
      toast.success(
        result.fallback_used
          ? "기본 분석 결과가 제공되었습니다. AI 평가를 다시 요청할 수 있습니다."
          : "AI 피드백을 받았습니다."
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "AI 첨삭을 요청하지 못했습니다."
      );
    } finally {
      setBusy(null);
    }
  };
  const doImport = () => {
    if (!user) return;
    try {
      const imported = importLegacyEssays(user.id);
      store.commit([...imported, ...store.latestRows()]);
      localStorage.setItem(`${essayStorageKey(user.id)}_legacy_imported`, "1");
      setLegacy([]);
      setShowImport(false);
      if (store.online) void store.synchronize();
      toast.success(
        `${imported.length}개 글을 현재 계정의 새 초안으로 가져왔습니다.`
      );
    } catch {
      toast.error(
        "기기 글을 가져오지 못했습니다. 기존 글은 삭제하지 않았습니다."
      );
    }
  };

  if (authLoading && !user)
    return (
      <div role="status" className="p-10 text-center">
        보관함을 확인하고 있습니다...
      </div>
    );
  if (!user) return <LoginRequired />;
  const ai = selected?.aiFeedback;
  const teacher = selected?.teacherFeedback;
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9 text-slate-900">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold text-indigo-700 mb-1">
            나의 글쓰기 학습
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold">
            {offline ? "오프라인 논술 보관함" : "논술 작성 · 첨삭"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            글을 작성해 보관하고, 온라인에서 첨삭을 받은 뒤 수정본으로 다시
            연습하세요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${store.online ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}
          >
            {store.online ? "온라인" : "오프라인 · 기기에 보관"}
          </span>
          <Button
            variant="outline"
            onClick={() => void store.synchronize()}
            disabled={!store.online || !store.ready || disabled}
            className="bg-white gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${store.syncing ? "animate-spin" : ""}`}
            />
            {store.syncing ? "동기화 중" : "서버 동기화"}
          </Button>
          <Button
            onClick={add}
            disabled={!store.ready || disabled}
            className="bg-indigo-600 text-white hover:bg-indigo-700 gap-2"
          >
            <Plus className="h-4 w-4" />새 글 작성
          </Button>
        </div>
      </header>
      <nav
        aria-label="글쓰기 학습 순서"
        className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {[
          { name: "1. 학습 · 주제 정하기", href: "/curriculum" },
          {
            name: "2. 작성 · 보관",
            href: offline ? "/offline-essays" : "/essay-submission",
          },
          { name: "3. 온라인 첨삭 요청", href: "#essay-review" },
          { name: "4. 피드백 · 수정", href: "#essay-feedback" },
        ].map(step => (
          <a
            key={step.name}
            href={step.href}
            onClick={e => {
              if (step.href.startsWith("/")) {
                e.preventDefault();
                if (
                  !unsaved ||
                  window.confirm("수정 내용을 저장하지 않고 이동할까요?")
                )
                  navigate(step.href);
              }
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-slate-700 hover:border-indigo-300 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {step.name}
          </a>
        ))}
      </nav>
      {store.error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
        >
          {store.error}
        </p>
      )}
      {!store.online && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          작성한 글은 이 기기에 저장됩니다. 인터넷이 연결되면 현재 계정의
          미동기화 글을 서버로 보냅니다. 첨삭 요청은 온라인에서 직접 선택해
          주세요.
        </p>
      )}
      {!!legacy.length && (
        <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <p className="text-sm text-indigo-900">
            이전 보관 방식으로 저장된 글 {legacy.length}개가 있습니다. 본인의
            글인지 확인한 뒤 가져오세요.
          </p>
          <Button
            variant="outline"
            onClick={() => setShowImport(true)}
            className="bg-white text-indigo-800"
          >
            기존 기기 글 확인
          </Button>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="h-fit border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base flex gap-2 items-center">
              <FileText className="h-4 w-4 text-indigo-600" />내 글 (
              {store.rows.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[65vh] overflow-y-auto">
            {!store.ready ? (
              <p role="status" className="text-sm text-slate-500">
                기기 보관함을 준비하고 있습니다.
              </p>
            ) : !store.rows.length ? (
              <p className="text-sm text-slate-500 py-4">
                새 글 작성으로 시작하세요.
              </p>
            ) : (
              store.rows.map(row => (
                <button
                  key={row.localId}
                  disabled={disabled}
                  aria-pressed={row.localId === selectedId}
                  onClick={() => choose(row)}
                  className={`w-full min-w-0 rounded-xl border p-3 text-left focus-visible:ring-2 focus-visible:ring-indigo-500 ${row.localId === selectedId ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                >
                  <p className="truncate text-sm font-bold">
                    {row.title || "제목 없는 초안"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {row.status === "reviewed"
                      ? "교사 첨삭 완료"
                      : row.status === "submitted"
                        ? "교사 첨삭 대기"
                        : row.aiFeedback
                          ? "AI 피드백 있음"
                          : "작성 중"}
                  </p>
                  <p
                    className={`mt-2 text-[11px] ${row.isDirty ? "text-amber-800" : "text-emerald-800"}`}
                  >
                    {row.isDirty ? "기기 저장 · 동기화 대기" : "서버 저장 완료"}
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>
        <div className="min-w-0 space-y-5">
          {selected ? (
            <>
              <Card className="border-slate-200 bg-white">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap gap-2 items-center justify-between">
                    <CardTitle className="text-lg">
                      {locked ? "첨삭 요청한 원문" : "내 논술 작성"}
                    </CardTitle>
                    <span className="text-xs text-slate-600">
                      {unsaved
                        ? "저장하지 않은 수정"
                        : selected.isDirty
                          ? "서버 동기화 대기"
                          : "서버 저장 완료"}
                    </span>
                  </div>
                  {locked && (
                    <p className="text-xs text-slate-600">
                      요청한 원문은 보존됩니다. 아래에서 수정본을 만들어 다시
                      작성할 수 있습니다.
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label
                      htmlFor="essay-title"
                      className="mb-2 block text-sm font-semibold"
                    >
                      제목
                    </label>
                    <Input
                      id="essay-title"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      maxLength={255}
                      disabled={locked || !!busy}
                      placeholder="주장이나 글의 주제를 제목으로 적어 보세요."
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="essay-content"
                      className="mb-2 block text-sm font-semibold"
                    >
                      본문
                    </label>
                    <Textarea
                      id="essay-content"
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      maxLength={20000}
                      disabled={locked || !!busy}
                      className="min-h-[340px] sm:min-h-[420px] text-sm sm:text-base leading-7 resize-y"
                      placeholder="주장 → 근거와 사례 → 반대 의견 검토 → 결론 순서로 작성해 보세요."
                    />
                    <p className="mt-2 text-xs text-slate-500 text-right">
                      {content.length.toLocaleString()} / 20,000자
                    </p>
                  </div>
                  {selected.syncError && (
                    <div
                      role="alert"
                      className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
                    >
                      <p>{selected.syncError}</p>
                      <Button
                        variant="outline"
                        onClick={copyDraft}
                        className="mt-3 bg-white"
                      >
                        기기 글을 새 초안으로 복사
                      </Button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {!locked && (
                      <Button
                        onClick={() => void saveClick()}
                        disabled={
                          disabled ||
                          !title.trim() ||
                          !content.trim() ||
                          (!unsaved && !selected.isDirty)
                        }
                        className="bg-indigo-600 text-white hover:bg-indigo-700 gap-2"
                      >
                        <Save className="h-4 w-4" />
                        {store.syncing
                          ? "저장 · 동기화 중"
                          : store.online
                            ? "저장 · 서버 동기화"
                            : "기기에 저장"}
                      </Button>
                    )}
                    {locked && !ai && !teacher && (
                      <Button
                        variant="outline"
                        onClick={copyDraft}
                        disabled={disabled}
                        className="bg-white gap-2"
                      >
                        <Copy className="h-4 w-4" />
                        수정본 만들기
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card id="essay-review" className="border-indigo-100 bg-white">
                <CardHeader>
                  <CardTitle className="text-lg">온라인 첨삭 요청</CardTitle>
                  <p className="text-sm text-slate-600">
                    저장한 글로 AI 피드백을 받거나 담당 교사에게 첨삭을
                    요청하세요.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {user.role !== "user" && (
                    <label className="text-sm font-semibold">
                      평가 과정
                      <select
                        aria-label="평가 과정"
                        value={course}
                        onChange={e => setCourse(e.target.value as CourseType)}
                        className="ml-3 rounded-md border px-2 py-1"
                      >
                        {COURSE_OPTIONS.map(c => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {quota.data?.isTrial && (
                    <p className="text-xs text-slate-600">
                      7일 체험의 무료 AI 평가는 레슨 1의 첫 서술형 풀이에서
                      제공됩니다. 자유 글 첨삭은 이용권 범위에 따라 제공됩니다.
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      onClick={() => void requestAi()}
                      disabled={
                        !store.online ||
                        disabled ||
                        !content.trim() ||
                        !title.trim() ||
                        content.trim().length < 20
                      }
                      className="bg-indigo-600 text-white hover:bg-indigo-700 gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      {busy === "ai" ? "AI 피드백 작성 중" : "AI 첨삭 요청"}
                    </Button>
                    <Button
                      onClick={() => void requestTeacher()}
                      disabled={
                        !store.online ||
                        disabled ||
                        locked ||
                        !content.trim() ||
                        !title.trim()
                      }
                      variant="outline"
                      className="border-indigo-200 bg-indigo-50 text-indigo-900 gap-2"
                    >
                      <Send className="h-4 w-4" />
                      {busy === "teacher"
                        ? "요청 중"
                        : selected.status === "submitted"
                          ? "교사 첨삭 대기"
                          : selected.status === "reviewed"
                            ? "교사 첨삭 완료"
                            : "담당 교사 첨삭 요청"}
                    </Button>
                  </div>
                  {!store.online && (
                    <p className="text-xs text-amber-800">
                      온라인 연결 후 첨삭 요청 버튼을 사용할 수 있습니다.
                    </p>
                  )}
                  {teacherResult && (
                    <p role="status" className="text-sm text-emerald-800">
                      {teacherResult}
                    </p>
                  )}
                  {busy === "ai" && (
                    <EvaluationLoadingState step={evaluationStep} />
                  )}
                </CardContent>
              </Card>
              <Card id="essay-feedback" className="border-emerald-100 bg-white">
                <CardHeader>
                  <div className="flex flex-wrap gap-2 justify-between items-center">
                    <CardTitle className="text-lg">
                      피드백 확인 · 다시 쓰기
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void store.synchronize()}
                      disabled={!store.online || disabled}
                    >
                      피드백 새로고침
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!ai && !teacher && (
                    <p className="text-sm text-slate-500">
                      첨삭이 완료되면 이곳에 피드백이 표시됩니다. 요청한 글은 내
                      글 목록에서 다시 열 수 있습니다.
                    </p>
                  )}
                  {ai && (
                    <section className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                      <h3 className="font-bold text-indigo-950">
                        AI 피드백 · {ai.overallScore ?? 0}점
                      </h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {ai.overallComment}
                      </p>
                      {feedbackList(ai.suggestions).length > 0 && (
                        <ul className="mt-3 space-y-2 text-sm text-slate-700">
                          {feedbackList(ai.suggestions).map((s, i) => (
                            <li key={i}>• {s}</li>
                          ))}
                        </ul>
                      )}
                    </section>
                  )}
                  {teacher && (
                    <section className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                      <h3 className="font-bold text-emerald-950">
                        담당 교사 피드백
                        {teacher.overallScore !== null
                          ? ` · ${teacher.overallScore}점`
                          : ""}
                      </h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {teacher.overallComment ||
                          "교사 첨삭 내용을 확인해 주세요."}
                      </p>
                    </section>
                  )}
                  {(ai || teacher) && (
                    <Button
                      variant="outline"
                      onClick={copyDraft}
                      disabled={disabled}
                      className="bg-white gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      피드백을 참고해 수정본 작성
                    </Button>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-dashed border-slate-300 bg-white">
              <CardContent className="p-10 text-center">
                <BookOpen className="mx-auto h-9 w-9 text-indigo-300" />
                <h2 className="mt-4 font-bold text-lg">
                  배운 내용을 나의 글로 정리해 보세요.
                </h2>
                <p className="my-3 text-sm text-slate-600">
                  내 글을 선택하거나 새 글을 작성한 뒤, 첨삭을 요청할 수
                  있습니다.
                </p>
                <Button
                  onClick={add}
                  disabled={!store.ready}
                  className="bg-indigo-600 text-white"
                >
                  새 글 작성
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>기존 기기 글 가져오기</DialogTitle>
            <DialogDescription>
              아래 글이 본인의 글인지 확인해 주세요. 현재 계정의 새 초안으로
              복사하며, 이전 첨삭 요청 상태는 가져오지 않습니다. 온라인
              상태에서는 가져온 초안이 서버에 저장됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {legacy.map((row, i) => (
              <div key={i} className="rounded-lg border p-3">
                <p className="font-semibold text-sm">{row.title}</p>
                <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                  {row.content}
                </p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>
              취소
            </Button>
            <Button onClick={doImport} className="bg-indigo-600 text-white">
              본인 글 확인 · 가져오기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
