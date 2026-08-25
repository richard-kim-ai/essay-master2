import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

const Curriculum = lazy(() => import("./pages/Curriculum"));
const EssayArchive = lazy(() => import("./pages/EssayArchive"));
const CurriculumDetail = lazy(() => import("./pages/CurriculumDetail"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AIAutoFeedback = lazy(() => import("./pages/AIAutoFeedback"));
const AIFeedbackCompare = lazy(() => import("./pages/AIFeedbackCompare"));
const EssaySubmission = lazy(() => import("./pages/EssaySubmission"));
const TeacherFeedback = lazy(() => import("./pages/TeacherFeedback"));
const Certificate = lazy(() => import("./pages/Certificate"));
const Workbook = lazy(() => import("./pages/Workbook"));
const QuizPage = lazy(() => import("./pages/QuizPage"));
const ParagraphReordering = lazy(() => import("./pages/ParagraphReordering"));
const SummaryPractice = lazy(() => import("./pages/SummaryPractice"));
const MistakeNotebook = lazy(() => import("./pages/MistakeNotebook"));
const Notifications = lazy(() => import("./pages/Notifications"));
const TopicWizard = lazy(() => import("./pages/TopicWizard"));
const ThesisChecklist = lazy(() => import("@/pages/ThesisChecklist"));
const OfflineEssays = lazy(() => import("@/pages/OfflineEssays"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const TeacherSignup = lazy(() => import("./pages/TeacherSignup"));
const TeacherMyPage = lazy(() => import("./pages/TeacherMyPage"));
const TeacherWritingExamples = lazy(() => import("./pages/TeacherWritingExamples"));
const AiGuideHistory = lazy(() => import("./pages/AiGuideHistory"));
const WritingExampleLibrary = lazy(() => import("./pages/WritingExampleLibrary"));
const MyPageHub = lazy(() => import("./pages/MyPageHub"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const SocialProviderSettings = lazy(() => import("./pages/SocialProviderSettings"));
const AdminStudentDetail = lazy(() => import("./pages/AdminStudentDetail"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const AdminCertificates = lazy(() => import("@/pages/AdminCertificates"));
const AdminCurriculumManager = lazy(() => import("@/pages/AdminCurriculumManager"));
const AdminQuestionBank = lazy(() => import("@/pages/AdminQuestionBank"));
const AdminTheoryContent = lazy(() => import("@/pages/AdminTheoryContent"));
const AdminLessonConnections = lazy(() => import("@/pages/AdminLessonConnections"));
const AdminEvaluationModels = lazy(() => import("@/pages/AdminEvaluationModels"));
const AdminTermsManager = lazy(() => import("@/pages/AdminTermsManager"));
const AdminAIGovernance = lazy(() => import("@/pages/AdminAIGovernance"));
const AdminAcademicPermissions = lazy(() => import("@/pages/AdminAcademicPermissions"));
const MasterAdminConsole = lazy(() => import("@/pages/MasterAdminConsole"));
const ParentPortal = lazy(() => import("@/pages/ParentPortal"));
const StudentAssignments = lazy(() => import("@/pages/StudentAssignments"));
const Pricing = lazy(() => import("./pages/Pricing"));

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-4" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-sm">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" aria-hidden="true" />
        화면을 준비하고 있습니다.
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/teacher-signup" component={TeacherSignup} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/admin">{() => <Layout><AdminDashboard /></Layout>}</Route>
        <Route path="/admin/certificates">{() => <Layout><AdminCertificates /></Layout>}</Route>
        <Route path="/admin/curriculum">{() => <Layout><AdminCurriculumManager /></Layout>}</Route>
        <Route path="/admin/question-bank">{() => <Layout><AdminQuestionBank /></Layout>}</Route>
        <Route path="/admin/evaluation-models">{() => <Layout><AdminEvaluationModels /></Layout>}</Route>
        <Route path="/admin/theory-content">{() => <Layout><AdminTheoryContent /></Layout>}</Route>
        <Route path="/admin/lesson-connections">{() => <Layout><AdminLessonConnections /></Layout>}</Route>
        <Route path="/admin/student/:id">{() => <Layout><AdminStudentDetail /></Layout>}</Route>
        <Route path="/admin/social-providers">{() => <Layout><SocialProviderSettings /></Layout>}</Route>
        <Route path="/admin/terms">{() => <Layout><AdminTermsManager /></Layout>}</Route>
        <Route path="/admin/ai-governance">{() => <Layout><AdminAIGovernance /></Layout>}</Route>
        <Route path="/admin/academic-permissions">{() => <Layout><AdminAcademicPermissions /></Layout>}</Route>
        <Route path="/master-admin">{() => <Layout><MasterAdminConsole /></Layout>}</Route>
        <Route path="/parent-portal">{() => <Layout><ParentPortal /></Layout>}</Route>
        <Route path="/" component={Home} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/curriculum/:courseType/:level">{() => <Layout><CurriculumDetail /></Layout>}</Route>
        <Route path="/curriculum">{() => <Layout><Curriculum /></Layout>}</Route>
        <Route path="/essay-archive">{() => <Layout><EssayArchive /></Layout>}</Route>
        <Route path="/my-assignments">{() => <Layout><StudentAssignments /></Layout>}</Route>
        <Route path="/mypage">{() => <Layout><MyPageHub /></Layout>}</Route>
        <Route path="/dashboard">{() => <Layout><MyPageHub /></Layout>}</Route>
        <Route path="/dashboard-detail">{() => <Layout><Dashboard /></Layout>}</Route>
        <Route path="/teacher-mypage">{() => <Layout><TeacherMyPage /></Layout>}</Route>
        <Route path="/teacher/writing-examples">{() => <Layout><TeacherWritingExamples /></Layout>}</Route>
        <Route path="/ai-auto-feedback">{() => <Layout><AIAutoFeedback /></Layout>}</Route>
        <Route path="/ai-feedback-compare/:id">{() => <Layout><AIFeedbackCompare /></Layout>}</Route>
        <Route path="/essay-submission">{() => <Layout><EssaySubmission /></Layout>}</Route>
        <Route path="/offline-essays">{() => <Layout><OfflineEssays /></Layout>}</Route>
        <Route path="/notifications">{() => <Layout><Notifications /></Layout>}</Route>
        <Route path="/teacher-feedback/:essayId">{() => <Layout><TeacherFeedback /></Layout>}</Route>
        <Route path="/certificate">{() => <Layout><Certificate /></Layout>}</Route>
        <Route path="/workbook/:courseType/:level">{() => <Layout><Workbook /></Layout>}</Route>
        <Route path="/quiz">{() => <Layout><QuizPage /></Layout>}</Route>
        <Route path="/paragraph-reordering">{() => <Layout><ParagraphReordering /></Layout>}</Route>
        <Route path="/summary-practice">{() => <Layout><SummaryPractice /></Layout>}</Route>
        <Route path="/mistake-notebook">{() => <Layout><MistakeNotebook /></Layout>}</Route>
        <Route path="/topic-wizard">{() => <Layout><TopicWizard /></Layout>}</Route>
        <Route path="/thesis-checklist">{() => <Layout><ThesisChecklist /></Layout>}</Route>
        <Route path="/ai-guide-history">{() => <Layout><AiGuideHistory /></Layout>}</Route>
        <Route path="/writing-examples">{() => <Layout><WritingExampleLibrary /></Layout>}</Route>
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
