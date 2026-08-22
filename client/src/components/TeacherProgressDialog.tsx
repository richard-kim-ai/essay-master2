import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CheckCircle2, ClipboardCheck } from "lucide-react";

type ManagedStudent = {
  id: number;
  name: string | null;
  courseType: "elementary" | "middle_high" | "high_univ" | "general_adult";
  courseLabel: string;
};

export function TeacherProgressDialog({ student }: { student: ManagedStudent }) {
  const [open, setOpen] = useState(false);
  const [curriculumId, setCurriculumId] = useState("");
  const [score, setScore] = useState("0");
  const [completed, setCompleted] = useState(false);
  const { data: curriculum = [] } = trpc.curriculum.getByType.useQuery(student.courseType, { enabled: open });
  const utils = trpc.useUtils();
  const updateProgress = trpc.teacherOperations.updateStudentProgress.useMutation({
    onSuccess: () => {
      toast.success("학생 진도가 반영되었습니다.");
      utils.teacherOperations.managedStudents.invalidate();
      setOpen(false);
    },
    onError: (error) => toast.error(error.message || "진도 반영에 실패했습니다."),
  });

  const submit = () => {
    if (!curriculumId) return toast.error("반영할 과정 단계를 선택해주세요.");
    const numericScore = Number(score);
    if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100) return toast.error("점수는 0~100점으로 입력해주세요.");
    updateProgress.mutate({ studentId: student.id, curriculumId: Number(curriculumId), score: numericScore, completed });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}><ClipboardCheck className="h-3.5 w-3.5" />진도 관리</Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{student.name || "학생"} 학생 진도 관리</DialogTitle>
          <DialogDescription>{student.courseLabel} 과정의 학습 단계와 평가 점수를 교사 권한으로 반영합니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <label className="block text-sm font-medium text-slate-700">학습 단계<select value={curriculumId} onChange={(event) => setCurriculumId(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="">단계 선택</option>{curriculum.map((item) => <option key={item.id} value={item.id}>Level {item.level} · {item.title}</option>)}</select></label>
          <label className="block text-sm font-medium text-slate-700">평가 점수<Input type="number" min="0" max="100" className="mt-1.5" value={score} onChange={(event) => setScore(event.target.value)} /></label>
          <label className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm font-medium text-emerald-800"><input type="checkbox" checked={completed} onChange={(event) => setCompleted(event.target.checked)} /><CheckCircle2 className="h-4 w-4" />이 단계를 완료로 처리</label>
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button><Button type="button" className="bg-indigo-700 hover:bg-indigo-800" disabled={updateProgress.isPending} onClick={submit}>{updateProgress.isPending ? "반영 중..." : "진도 반영"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
