import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { LanguageToggle } from "@/components/LanguageToggle";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { DocumentsDropdown } from "@/components/DocumentsDropdown";
import { UserDropdown } from "@/components/UserDropdown";
import { Footer } from "@/components/Footer";
import { DaycareSelectionPage } from "@/pages/DaycareSelectionPage";
import { RoleSelectionPage } from "@/pages/RoleSelectionPage";
import { LoginPage } from "@/pages/LoginPage";
import { SuperAdminLoginPage } from "@/pages/SuperAdminLoginPage";
import { Dashboard } from "@/pages/Dashboard";
import { ChildrenPage } from "@/pages/ChildrenPage";
import { ChildDetailPage } from "@/pages/ChildDetailPage";
import { ChildTrackingPage } from "@/pages/ChildTrackingPage";
import { EntriesPage } from "@/pages/EntriesPage";
import { TripsPage } from "@/pages/TripsPage";
import { UsersPage } from "@/pages/UsersPage";
import { DaycaresPage } from "@/pages/DaycaresPage";
import { SuperAdminUsersPage } from "@/pages/SuperAdminUsersPage";
import { SuperAdminStatsPage } from "@/pages/SuperAdminStatsPage";
import { MunicipalitiesPage } from "@/pages/MunicipalitiesPage";
import AuditLogsPage from "@/pages/AuditLogsPage";
import ChangePasswordPage from "@/pages/ChangePasswordPage";
import AbsencesPage from "@/pages/AbsencesPage";
import MessagesPage from "@/pages/MessagesPage";
import DocumentsPage from "@/pages/DocumentsPage";
import MealMenuPage from "@/pages/MealMenuPage";
import FormsPage from "@/pages/FormsPage";
import GdprPage from "@/pages/GdprPage";
import DeleteRequestsPage from "@/pages/DeleteRequestsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { PrivacyPolicyPage } from "@/pages/PrivacyPolicyPage";
import { TermsOfServicePage } from "@/pages/TermsOfServicePage";
import NotFound from "@/pages/not-found";
import type { ReactNode } from "react";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, needsPasswordChange } = useAuth();
  const [location] = useLocation();
  
  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }
  
  if (needsPasswordChange && location !== '/change-password') {
    return <Redirect to="/change-password" />;
  }
  
  return <>{children}</>;
}

/**
 * Screens built around personal data.
 *
 * Every one of these endpoints rejects a super admin and logs ACCESS_DENIED, which
 * is the whole point of the role: the product's GDPR position is that the operator
 * can see anonymised statistics and nothing else. The pages still rendered for
 * them, though, so a super admin saw "Children -- 0 children" and an empty
 * messaging screen. Nothing leaked, but it reads as "you have access, there is
 * simply nothing here" rather than "this is not yours to see" -- exactly the wrong
 * impression when a municipality is auditing the separation.
 */
function PersonalDataRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useTranslation();

  if (user?.role === 'super_admin') {
    return (
      <div className="p-8 text-center" data-testid="text-personal-data-blocked">
        <p className="text-muted-foreground">{t('gdprDenial')}</p>
      </div>
    );
  }

  return <>{children}</>;
}

function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:m-2"
          data-testid="skip-to-content"
          onClick={(e) => {
            e.preventDefault();
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
              mainContent.focus();
              mainContent.scrollIntoView({ behavior: 'smooth' });
            }
          }}
        >
          Skip to main content
        </a>
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header 
            className="flex items-center justify-between gap-2 p-4 border-b"
            role="banner"
            aria-label="Site header"
          >
            <SidebarTrigger data-testid="button-sidebar-toggle" aria-label="Toggle sidebar navigation" />
            <nav className="flex items-center gap-2" aria-label="Utility navigation">
              <DocumentsDropdown />
              <NotificationDropdown />
              <LanguageToggle />
              <UserDropdown />
            </nav>
          </header>
          <main 
            id="main-content" 
            className="flex-1 overflow-y-auto p-6"
            role="main"
            aria-label="Main content"
            tabIndex={-1}
          >
            {children}
          </main>
          <Footer />
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      <Route path="/select-role/:daycareCode">
        {isAuthenticated ? (
          <Redirect to="/dashboard" />
        ) : (
          <RoleSelectionPage />
        )}
      </Route>

      <Route path="/login/daycareleader/:daycareCode">
        {({ daycareCode }) => isAuthenticated ? (
          <Redirect to="/dashboard" />
        ) : (
          <LoginPage role="daycareleader" daycareCode={daycareCode} />
        )}
      </Route>

      <Route path="/login/staff/:daycareCode">
        {({ daycareCode }) => isAuthenticated ? (
          <Redirect to="/dashboard" />
        ) : (
          <LoginPage role="staff" daycareCode={daycareCode} />
        )}
      </Route>

      <Route path="/login/guardian/:daycareCode">
        {({ daycareCode }) => isAuthenticated ? (
          <Redirect to="/dashboard" />
        ) : (
          <LoginPage role="guardian" daycareCode={daycareCode} />
        )}
      </Route>

      <Route path="/super-admin/login">
        {isAuthenticated ? (
          <Redirect to="/dashboard" />
        ) : (
          <SuperAdminLoginPage />
        )}
      </Route>

      <Route path="/change-password">
        <ProtectedRoute>
          <ChangePasswordPage />
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <Dashboard />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/children">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <PersonalDataRoute>
              <ChildrenPage />
            </PersonalDataRoute>
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/children/:id">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <PersonalDataRoute>
              <ChildTrackingPage />
            </PersonalDataRoute>
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/children/:id/details">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <PersonalDataRoute>
              <ChildDetailPage />
            </PersonalDataRoute>
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/entries/new">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <PersonalDataRoute>
              <EntriesPage />
            </PersonalDataRoute>
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/trips">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <PersonalDataRoute>
              <TripsPage />
            </PersonalDataRoute>
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/users">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <UsersPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/daycares">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <DaycaresPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/super-admin/users">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <SuperAdminUsersPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/super-admin/stats">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <SuperAdminStatsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/super-admin/municipalities">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <MunicipalitiesPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/super-admin/audit-logs">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <AuditLogsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/absences">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <PersonalDataRoute>
              <AbsencesPage />
            </PersonalDataRoute>
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/messages">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <PersonalDataRoute>
              <MessagesPage />
            </PersonalDataRoute>
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/documents">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <PersonalDataRoute>
              <DocumentsPage />
            </PersonalDataRoute>
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/menu">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <MealMenuPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/forms">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <PersonalDataRoute>
              <FormsPage />
            </PersonalDataRoute>
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/gdpr">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <GdprPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/delete-requests">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <DeleteRequestsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/audit-logs">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <AuditLogsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/settings">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <SettingsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/privacy-policy">
        <PrivacyPolicyPage />
      </Route>

      <Route path="/terms-of-service">
        <TermsOfServicePage />
      </Route>

      <Route path="/">
        {isAuthenticated ? (
          <Redirect to="/dashboard" />
        ) : (
          <DaycareSelectionPage />
        )}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Toaster />
        <Router />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
