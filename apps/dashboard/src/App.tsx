import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { IssuesPage } from "./pages/IssuesPage";
import { LoginPage } from "./pages/LoginPage";
import { ProjectsPage } from "./pages/ProjectsPage";

function ProtectedLayout() {
  const { user, loading, logout } = useAuth();

  if (loading) return <div className="loading">세션 확인 중...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      <header className="topbar">
        <Link className="wordmark" to="/">
          errtrack<span className="tld">_</span>
        </Link>
        <div className="topbar-spacer" />
        <span className="user-email">{user.email}</span>
        <button className="btn btn-ghost" onClick={() => void logout()}>
          로그아웃
        </button>
      </header>
      <Outlet />
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<IssuesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
