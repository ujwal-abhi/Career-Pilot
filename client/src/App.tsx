import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SlowServerNotice } from "./components/SlowServerNotice";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";

// Code splitting: each page below is downloaded only when someone first opens it, instead of
// all of them (and the chart library) being packed into the one file every visitor must
// download up front. Login and Register stay in the main file on purpose: they are the first
// thing a new visitor sees, so they should not wait for a second download.
//
// The pages use named exports, so each import() result is reshaped into the { default }
// object that React.lazy expects.
const Dashboard = lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const Applications = lazy(() => import("./pages/Applications").then((module) => ({ default: module.Applications })));
const Resumes = lazy(() => import("./pages/Resumes").then((module) => ({ default: module.Resumes })));
const JobMatchPage = lazy(() => import("./pages/JobMatch").then((module) => ({ default: module.JobMatchPage })));
const TailorPage = lazy(() => import("./pages/Tailor").then((module) => ({ default: module.TailorPage })));
const InterviewPrepPage = lazy(() =>
  import("./pages/InterviewPrep").then((module) => ({ default: module.InterviewPrepPage }))
);
const PracticePage = lazy(() => import("./pages/Practice").then((module) => ({ default: module.PracticePage })));
const AnalyticsPage = lazy(() => import("./pages/Analytics").then((module) => ({ default: module.AnalyticsPage })));
const SchedulePage = lazy(() => import("./pages/Schedule").then((module) => ({ default: module.SchedulePage })));

// Shown for the moment a page's file is being downloaded.
function PageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-300">Loading…</div>
  );
}

function App() {
  return (
    <AuthProvider>
      <SlowServerNotice />
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/applications"
            element={
              <ProtectedRoute>
                <Applications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resumes"
            element={
              <ProtectedRoute>
                <Resumes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/job-match"
            element={
              <ProtectedRoute>
                <JobMatchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tailor"
            element={
              <ProtectedRoute>
                <TailorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interview-prep"
            element={
              <ProtectedRoute>
                <InterviewPrepPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/practice"
            element={
              <ProtectedRoute>
                <PracticePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/schedule"
            element={
              <ProtectedRoute>
                <SchedulePage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;