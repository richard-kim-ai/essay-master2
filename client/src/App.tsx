import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Curriculum from "./pages/Curriculum";
import CurriculumDetail from "./pages/CurriculumDetail";
import Dashboard from "./pages/Dashboard";
import AIAutoFeedback from "./pages/AIAutoFeedback";
import AIFeedbackCompare from "./pages/AIFeedbackCompare";
import EssaySubmission from "./pages/EssaySubmission";
import TeacherFeedback from "./pages/TeacherFeedback";
import Certificate from "./pages/Certificate";
import Workbook from "./pages/Workbook";
import QuizPage from "./pages/QuizPage";
import ParagraphReordering from "./pages/ParagraphReordering";
import SummaryPractice from "./pages/SummaryPractice";
import MistakeNotebook from "./pages/MistakeNotebook";
import TopicWizard from "./pages/TopicWizard";
import ThesisChecklist from "@/pages/ThesisChecklist";
import OfflineEssays from "@/pages/OfflineEssays";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import SocialProviderSettings from "./pages/SocialProviderSettings";
import AdminStudentDetail from "./pages/AdminStudentDetail";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminCertificates from "@/pages/AdminCertificates";
import AdminCurriculumManager from "@/pages/AdminCurriculumManager";
import Layout from "./components/Layout";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/login"} component={Login} />
      <Route path={"/signup"} component={Signup} />
      <Route path={"/verify-email"} component={VerifyEmail} />
      <Route path={"/forgot-password"} component={ForgotPassword} />
      <Route path={"/reset-password"} component={ResetPassword} />
      <Route path={"/admin"}>
        {(params) => (
          <Layout>
            <AdminDashboard />
          </Layout>
        )}
      </Route>
      <Route path={"/admin/certificates"}>
        {(params) => (
          <Layout>
            <AdminCertificates />
          </Layout>
        )}
      </Route>
      <Route path={"/admin/curriculum"}>
        {(params) => (
          <Layout>
            <AdminCurriculumManager />
          </Layout>
        )}
      </Route>
      <Route path={"/admin/student/:id"}>
        {(params) => (
          <Layout>
            <AdminStudentDetail />
          </Layout>
        )}
      </Route>
      <Route path={"/admin/social-providers"}>
        {(params) => (
          <Layout>
            <SocialProviderSettings />
          </Layout>
        )}
      </Route>
      <Route path={"/"} component={Home} />
      <Route path={"/curriculum/:courseType/:level"}>
        {(params) => (
          <Layout>
            <CurriculumDetail />
          </Layout>
        )}
      </Route>
      <Route path={"/curriculum"}>
        {(params) => (
          <Layout>
            <Curriculum />
          </Layout>
        )}
      </Route>
      <Route path={"/dashboard"}>
        {(params) => (
          <Layout>
            <Dashboard />
          </Layout>
        )}
      </Route>
      <Route path={"/ai-auto-feedback"}>
        {(params) => (
          <Layout>
            <AIAutoFeedback />
          </Layout>
        )}
      </Route>
      <Route path={"/ai-feedback-compare/:id"}>
        {(params) => (
          <Layout>
            <AIFeedbackCompare />
          </Layout>
        )}
      </Route>
      <Route path={"/essay-submission"}>
        {(params) => (
          <Layout>
            <EssaySubmission />
          </Layout>
        )}
      </Route>
      <Route path={"/offline-essays"}>
        {(params) => (
          <Layout>
            <OfflineEssays />
          </Layout>
        )}
      </Route>
      <Route path={"/teacher-feedback/:essayId"}>
        {(params) => (
          <Layout>
            <TeacherFeedback />
          </Layout>
        )}
      </Route>
      <Route path={"/certificate"}>
        {(params) => (
          <Layout>
            <Certificate />
          </Layout>
        )}
      </Route>
      <Route path={"/workbook/:courseType/:level"}>
        {(params) => (
          <Layout>
            <Workbook />
          </Layout>
        )}
      </Route>
      <Route path={"/quiz"}>
        {(params) => (
          <Layout>
            <QuizPage />
          </Layout>
        )}
      </Route>
      <Route path={"/paragraph-reordering"}>
        {(params) => (
          <Layout>
            <ParagraphReordering />
          </Layout>
        )}
      </Route>
      <Route path={"/summary-practice"}>
        {(params) => (
          <Layout>
            <SummaryPractice />
          </Layout>
        )}
      </Route>
      <Route path={"/mistake-notebook"}>
        {(params) => (
          <Layout>
            <MistakeNotebook />
          </Layout>
        )}
      </Route>
      <Route path={"/topic-wizard"}>
        {(params) => (
          <Layout>
            <TopicWizard />
          </Layout>
        )}
      </Route>
      <Route path={"/thesis-checklist"}>
        {(params) => (
          <Layout>
            <ThesisChecklist />
          </Layout>
        )}
      </Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
