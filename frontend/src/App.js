import { createBrowserRouter, createRoutesFromElements, Navigate, Route, RouterProvider } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import TicketsPage from "./pages/TicketsPage";
import WorkspacePage from "./pages/WorkspacePage";
import WorkItemPage from "./pages/WorkItemPage";
import RequestsPage from "./pages/RequestsPage";
import NewRequestPage from "./pages/NewRequestPage";
import RequestDetailPage from "./pages/RequestDetailPage";
import MyWorkPage from "./pages/MyWorkPage";
import HomePage from "./pages/HomePage";
import ArchivePage from "./pages/ArchivePage";
import PeoplePage from "./pages/PeoplePage";
import ProfilePage from "./pages/ProfilePage";
import AppShell from "./components/layout/AppShell";
import NavigationGuard from "./components/navigation/NavigationGuard";

const router = createBrowserRouter(createRoutesFromElements(
      <Route element={<NavigationGuard />}>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/demo"
          element={
            <ProtectedRoute>
              <TicketsPage />
            </ProtectedRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/my-work" element={<MyWorkPage />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/requests/new" element={<NewRequestPage />} />
          <Route path="/requests/:requestId" element={<RequestDetailPage />} />
          <Route path="/workspaces/:workspaceSlug" element={<WorkspacePage />} />
          <Route path="/workspaces/:workspaceSlug/items/:itemId" element={<WorkItemPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
));

export default function App() {
  return <RouterProvider router={router} />;
}
