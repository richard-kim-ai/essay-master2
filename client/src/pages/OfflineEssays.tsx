import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WifiOff, FileText, ArrowLeft, RefreshCw, CheckCircle, Clock, Edit3, Trash2, Save, Cloud } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function OfflineEssays() {
  const [essays, setEssays] = useState<any[]>([]);
  const [selectedEssay, setSelectedEssay] = useState<any | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [syncing, setSyncing] = useState(false);

  const createMutation = trpc.essaySubmission.create.useMutation();
  const updateMutation = trpc.essaySubmission.update.useMutation();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("온라인 상태로 전환되었습니다. 서버 동기화를 시작합니다.");
      syncPendingEssays();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("오프라인 상태로 전환되었습니다. 로컬 보관함을 이용해주세요.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    loadOfflineEssays();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const loadOfflineEssays = () => {
    try {
      const cached = localStorage.getItem("essay_master_offline_essays");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setEssays(parsed);
          if (parsed.length > 0 && !selectedEssay) {
            setSelectedEssay(parsed[0]);
            setEditTitle(parsed[0].title || "");
            setEditContent(parsed[0].content || "");
          }
        }
      }
    } catch (e) {
      console.error("Failed to load offline essays:", e);
      toast.error("오프라인 보관함을 불러오는 중 오류가 발생했습니다.");
    }
  };

  const saveEssaysToStorage = (updated: any[]) => {
    setEssays(updated);
    try {
      localStorage.setItem("essay_master_offline_essays", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save offline essays cache:", e);
    }
  };

  const handleSelectEssay = (essay: any) => {
    setSelectedEssay(essay);
    setEditTitle(essay.title || "");
    setEditContent(essay.content || "");
    setIsEditing(false);
  };

  const handleSaveLocalEdit = () => {
    if (!selectedEssay) return;
    if (!editTitle.trim() || !editContent.trim()) {
      toast.error("제목과 내용을 모두 입력해주세요.");
      return;
    }

    const updatedList = essays.map((item) =>
      item.id === selectedEssay.id
        ? { ...item, title: editTitle, content: editContent, updatedAt: new Date().toISOString(), isDirty: true }
        : item
    );

    saveEssaysToStorage(updatedList);
    setSelectedEssay({ ...selectedEssay, title: editTitle, content: editContent, updatedAt: new Date().toISOString(), isDirty: true });
    setIsEditing(false);
    toast.success("오프라인 보관함에 수정 사항이 저장되었습니다.");

    if (navigator.onLine) {
      syncPendingEssays();
    }
  };

  const handleDeleteEssay = () => {
    if (!selectedEssay) return;
    if (!confirm("정말 이 논술 글을 삭제하시겠습니까?")) return;

    const updatedList = essays.filter((item) => item.id !== selectedEssay.id);
    saveEssaysToStorage(updatedList);
    setSelectedEssay(updatedList.length > 0 ? updatedList[0] : null);
    if (updatedList.length > 0) {
      setEditTitle(updatedList[0].title || "");
      setEditContent(updatedList[0].content || "");
    }
    toast.success("삭제되었습니다.");
  };

  const syncPendingEssays = async () => {
    if (!navigator.onLine || syncing) return;
    setSyncing(true);
    try {
      const dirtyItems = essays.filter((item) => item.isDirty || typeof item.id === "string" || item.id > 1000000);
      let newlySynced = [...essays];

      for (const item of dirtyItems) {
        if (typeof item.id === "string" || item.id > 1000000) {
          // 새로 생성된 오프라인 글
          const res = await createMutation.mutateAsync({
            title: item.title,
            content: item.content,
            status: item.status || "draft",
          });
          if (res && (res as any).id) {
            newlySynced = newlySynced.map((e) => (e.id === item.id ? { ...res, isDirty: false } : e));
          }
        } else {
          // 수정된 기존 글
          await updateMutation.mutateAsync({
            id: item.id,
            title: item.title,
            content: item.content,
            status: item.status || "draft",
          });
          newlySynced = newlySynced.map((e) => (e.id === item.id ? { ...e, isDirty: false } : e));
        }
      }

      saveEssaysToStorage(newlySynced);
      if (dirtyItems.length > 0) {
        toast.success("오프라인 작성/수정된 논술이 서버와 성공적으로 동기화되었습니다.");
      }
    } catch (e) {
      console.error("Sync failed:", e);
      toast.error("서버 동기화 중 일부 오류가 발생했습니다. 네트워크 상태를 확인해주세요.");
    } finally {
      setSyncing(false);
    }
  };

  const handleAddNewOfflineEssay = () => {
    const newTemp = {
      id: "offline_" + Date.now(),
      title: "새 오프라인 논술",
      content: "여기에 오프라인으로 작성할 내용을 입력하세요.",
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDirty: true,
    };
    const updatedList = [newTemp, ...essays];
    saveEssaysToStorage(updatedList);
    setSelectedEssay(newTemp);
    setEditTitle(newTemp.title);
    setEditContent(newTemp.content);
    setIsEditing(true);
    toast.success("새 오프라인 논술이 생성되었습니다.");
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
              <WifiOff className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">오프라인 논술 보관함</h1>
              <p className="text-sm text-slate-600">인터넷 연결이 없을 때도 글을 작성, 수정, 삭제하고 온라인 복귀 시 자동 동기화할 수 있습니다.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={isOnline ? "default" : "destructive"} className="px-3 py-1 text-sm font-medium">
              {isOnline ? "온라인 상태" : "오프라인 상태"}
            </Badge>
            {isOnline && (
              <Button variant="outline" size="sm" onClick={syncPendingEssays} disabled={syncing} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "동기화 중..." : "서버 동기화"}
              </Button>
            )}
            <Button variant="default" size="sm" onClick={handleAddNewOfflineEssay} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
              <FileText className="h-4 w-4" /> 오프라인 글쓰기
            </Button>
            <Link href="/essay-submission">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> 작성 페이지
              </Button>
            </Link>
          </div>
        </div>

        {!isOnline && (
          <Card className="mb-6 border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm">
            <div className="flex items-start gap-3">
              <WifiOff className="h-5 w-5 mt-0.5 text-amber-600 shrink-0" />
              <div className="text-sm">
                <strong>현재 오프라인 모드로 동작 중입니다.</strong> 작성 및 수정하신 내용은 로컬에 안전하게 보관되며, 네트워크가 연결되면 서버에 자동으로 동기화됩니다.
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-3">
            <Card className="p-4 shadow-sm">
              <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" /> 보관된 글 목록 ({essays.length})
              </h2>
              {essays.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  저장된 오프라인 논술이 없습니다.<br />'오프라인 글쓰기' 버튼을 눌러 시작해보세요.
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {essays.map((essay) => (
                    <div
                      key={essay.id}
                      onClick={() => handleSelectEssay(essay)}
                      className={`cursor-pointer rounded-xl p-3 text-left transition border ${
                        selectedEssay?.id === essay.id
                          ? "bg-blue-50 border-blue-300 shadow-sm"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-slate-900 truncate max-w-[140px]">{essay.title || "제목 없음"}</span>
                        <div className="flex items-center gap-1">
                          {essay.isDirty && <span className="h-2 w-2 rounded-full bg-amber-500" title="동기화 대기중" />}
                          <Badge variant={essay.status === "submitted" ? "default" : "secondary"} className="text-[10px]">
                            {essay.status === "submitted" ? "제출" : "임시"}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{essay.content || "내용이 없습니다."}</p>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(essay.updatedAt || essay.createdAt || Date.now()).toLocaleDateString()}</span>
                        {essay.isDirty && <span className="text-amber-600 font-medium">동기화 대기</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="md:col-span-2">
            <Card className="h-full shadow-sm flex flex-col">
              <CardHeader className="border-b border-slate-100 pb-4">
                {selectedEssay ? (
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      {!isEditing ? (
                        <CardTitle className="text-xl font-bold text-slate-900">{selectedEssay.title}</CardTitle>
                      ) : (
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="논술 제목을 입력하세요"
                          className="text-lg font-bold w-full sm:w-[320px]"
                        />
                      )}
                      <CardDescription className="mt-1 flex items-center gap-2 flex-wrap">
                        <span>상태: {selectedEssay.status === "submitted" ? "제출 완료" : "임시 저장"}</span>
                        <span>•</span>
                        <span>마지막 수정: {new Date(selectedEssay.updatedAt || Date.now()).toLocaleString()}</span>
                        {selectedEssay.isDirty && <span className="text-amber-600 font-semibold">(미동기화 변경 사항 있음)</span>}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isEditing ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-1">
                            <Edit3 className="h-4 w-4" /> 수정
                          </Button>
                          <Button variant="destructive" size="sm" onClick={handleDeleteEssay} className="gap-1">
                            <Trash2 className="h-4 w-4" /> 삭제
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="default" size="sm" onClick={handleSaveLocalEdit} className="gap-1 bg-green-600 hover:bg-green-700">
                            <Save className="h-4 w-4" /> 저장
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); setEditTitle(selectedEssay.title); setEditContent(selectedEssay.content); }}>
                            취소
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <CardTitle className="text-lg font-medium text-slate-700">논술을 선택해주세요</CardTitle>
                )}
              </CardHeader>
              <CardContent className="flex-1 p-6">
                {selectedEssay ? (
                  <div className="space-y-4">
                    {!isEditing ? (
                      <div className="rounded-xl bg-slate-50 p-5 border border-slate-200/80 min-h-[300px] whitespace-pre-wrap text-slate-800 leading-relaxed font-sans">
                        {selectedEssay.content}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">본문 내용 수정 (오프라인 임시 저장)</label>
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          placeholder="논술 내용을 입력하세요..."
                          className="min-h-[300px] font-sans text-base leading-relaxed"
                        />
                      </div>
                    )}

                    {selectedEssay.feedback && !isEditing && (
                      <div className="rounded-xl bg-blue-50/70 p-4 border border-blue-200">
                        <h3 className="font-semibold text-blue-900 mb-1 text-sm">선생님 / AI 첨삭 내용</h3>
                        <p className="text-sm text-blue-800 whitespace-pre-wrap">{selectedEssay.feedback}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-20 text-center text-slate-400">
                    <FileText className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <p>왼쪽 목록에서 열람할 논술을 선택하거나 새로운 글을 작성하세요.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
