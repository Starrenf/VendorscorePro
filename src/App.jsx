import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import { AppStateProvider } from "./state/AppState";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import RoleManagement from "./pages/RoleManagement";
import CommunicationCenter from "./pages/CommunicationCenter";
import AssetFoundation from "./pages/AssetFoundation";
import Onboarding from "./pages/Onboarding";
import OrgHub from "./pages/OrgHub";
import JoinOrg from "./pages/JoinOrg";
import Suppliers from "./pages/Suppliers";
import SupplierMasterData from "./pages/SupplierMasterData";
import SupplierDetail from "./pages/SupplierDetail";
import NewEvaluation from "./pages/NewEvaluation";
import EvaluationDetail from "./pages/EvaluationDetail";
import AdminWeights from "./pages/AdminWeights";
import AdminOrganizations from "./pages/AdminOrganizations";
import Insights from "./pages/Insights";
import Methodiek from "./pages/Methodiek";
import StatusOverview from "./pages/StatusOverview";
import IntroPage from "./pages/IntroPage";
import Handleiding from "./pages/Handleiding";
import Dashboard from "./pages/Dashboard";
import CriticalAppsPage from "./pages/CriticalAppsPage";
import SoftwareLandscape from "./pages/SoftwareLandscape";
import AIRegister from "./pages/AIRegister";
import Wiki from "./pages/Wiki";
import WikiAdmin from "./pages/WikiAdmin";
import ArchitectureCockpit from "./pages/architecture/ArchitectureCockpit";
import MoraAbout from "./pages/architecture/MoraAbout";
import ArchitectureDomains from "./pages/architecture/ArchitectureDomains";
import ArchitectureRelations from "./pages/architecture/ArchitectureRelations";
import ArchitectView from "./pages/architecture/ArchitectView";
import ArchitectureMatchReview from "./pages/architecture/ArchitectureMatchReview";

export default function App() {
  return (
    <AppStateProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/kroonjuwelen" element={<CriticalAppsPage />} />
          <Route path="/landschap" element={<SoftwareLandscape />} />
          <Route path="/architecture" element={<ArchitectureCockpit />} />
          <Route path="/architecture/about" element={<MoraAbout />} />
          <Route path="/architecture/domains" element={<ArchitectureDomains />} />
          <Route path="/architecture/relations" element={<ArchitectureRelations />} />
          <Route path="/architecture/architect" element={<ArchitectView />} />
          <Route path="/architecture/matches" element={<ArchitectureMatchReview />} />
          <Route path="/ai-register" element={<AIRegister />} />
          <Route path="/wiki/admin" element={<WikiAdmin />} />
          <Route path="/wiki" element={<Wiki />} />
          <Route path="/wiki/:slug" element={<Wiki />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/status" element={<StatusOverview />} />
          <Route path="/over" element={<IntroPage />} />
          <Route path="/handleiding" element={<Handleiding />} />
          <Route path="/login" element={<Login />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/roles" element={<RoleManagement />} />
          <Route path="/settings/communications" element={<CommunicationCenter />} />
          <Route path="/onboarding" element={<Onboarding />} />

          <Route path="/org" element={<OrgHub />} />
          <Route path="/join/:slug" element={<JoinOrg />} />

          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/suppliers/masterdata" element={<SupplierMasterData />} />
          <Route path="/assets" element={<AssetFoundation />} />
          <Route path="/suppliers/:id" element={<SupplierDetail />} />

          <Route path="/methodiek" element={<Methodiek />} />

          <Route path="/evaluations/new" element={<NewEvaluation />} />
          <Route path="/evaluations/:id" element={<EvaluationDetail />} />

          <Route path="/admin" element={<Navigate to="/admin/orgs" replace />} />

          <Route path="/admin/orgs" element={<AdminOrganizations />} />
          <Route path="/admin/weights" element={<AdminWeights />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </AppStateProvider>
  );
}
