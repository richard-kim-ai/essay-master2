import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WifiOff, FileText, ArrowLeft, RefreshCw, CheckCircle, Clock } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function OfflineEssays() {
  const [essays, setEssays] = useState<any[]>([]);
  const [selectedEssay, setSelectedEssay] = useState<any | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 로컬 스토리지에서 캐시된 논술 불러오기
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
          }
        }
      }
    } catch (e) {
      console.error("Failed to load offline essays:", e);
      toast.error("오프라인 보관함을 불러오는 중 오류가 발생했습니다.");
    }
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
              <p className="text-sm text-slate-600">인터넷 연결이 없을 때도 이전에 작성하거나 임시 저장한 논술을 읽을 수 있습니다.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={isOnline ? "default" : "destructive"} className="px-3 py-1 text-sm font-medium">
              {isOnline ? "온라인 상태" : "오프라인 상태"}
            </Badge>
            <Button variant="outline" size="sm" onClick={loadOfflineEssays} className="gap-2">
              <RefreshCw className="h-4 w-4" /> 새로고침
            </Button>
            <Link href="/essay-submission">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> 작성 페이지로
              </Button>
            </Link>
          </div>
        </div>

        {!isOnline && (
          <Card className="mb-6 border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm">
            <div className="flex items-start gap-3">
              <WifiOff className="h-5 w-5 mt-0.5 text-amber-600 shrink-0" />
              <div className="text-sm">
                <strong>현재 오프라인 모드로 동작 중입니다.</strong> 기기에 안전하게 캐시된 논술 목록과 작성 내용을 열람하실 수 있습니다. 네트워크가 복구되면 최신 서버 데이터와 자동 동기화됩니다.
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
                  저장된 오프라인 논술이 없습니다.<br />온라인 상태에서 글을 작성하거나 임시 저장해 보세요.
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {essays.map((essay) => (
                    <div
                      key={essay.id}
                      onClick={() => setSelectedEssay(essay)}
                      className={`cursor-pointer rounded-xl p-3 text-left transition border ${
                        selectedEssay?.id === essay.id
                          ? "bg-blue-50 border-blue-300 shadow-sm"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-slate-900 truncate max-w-[160px]">{essay.title || "제목 없음"}</span>
                        <Badge variant={essay.status === "submitted" ? "default" : "secondary"} className="text-[10px]">
                          {essay.status === "submitted" ? "제출 완료" : "임시 저장"}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{essay.content || "내용이 없습니다."}</p>
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                        <Clock className="h-3 w-3" />
                        {new Date(essay.updatedAt || essay.createdAt || Date.now()).toLocaleDateString()}
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
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900">{selectedEssay.title}</CardTitle>
                      <CardDescription className="mt-1 flex items-center gap-2">
                        <span>상태: {selectedEssay.status === "submitted" ? "제출 완료" : "임시 저장"}</span>
                        <span>•</span>
                        <span>마지막 수정: {new Date(selectedEssay.updatedAt || Date.now()).toLocaleString()}</span>
                      </CardDescription>
                    </div>
                    <Badge variant={selectedEssay.status === "submitted" ? "default" : "secondary"}>
                      {selectedEssay.status === "submitted" ? <CheckCircle className="h-3 w-3 mr-1 inline" /> : <Clock className="h-3 w-3 mr-1 inline" />}
                      {selectedEssay.status === "submitted" ? "제출됨" : "임시저장"}
                    </Badge>
                  </div>
                ) : (
                  <CardTitle className="text-lg font-medium text-slate-700">논술을 선택해주세요</CardTitle>
                )}
              </CardHeader>
              <CardContent className="flex-1 p-6">
                {selectedEssay ? (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-slate-50 p-5 border border-slate-200/80 min-h-[300px] whitespace-pre-wrap text-slate-800 leading-relaxed font-sans">
                      {selectedEssay.content}
                    </div>
                    {selectedEssay.feedback && (
                      <div className="rounded-xl bg-blue-50/70 p-4 border border-blue-200">
                        <h3 className="font-semibold text-blue-900 mb-1 text-sm">선생님 / AI 첨삭 내용</h3>
                        <p className="text-sm text-blue-800 whitespace-pre-wrap">{selectedEssay.feedback}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-20 text-center text-slate-400">
                    <FileText className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <p>왼쪽 목록에서 열람할 논술을 선택하세요.</p>
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
