import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import PageContainer from "../components/layout/PageContainer";
import NewRequestForm from "../components/requests/NewRequestForm";
import { Button } from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";
import { pageSurvives, useDraftScope } from "../components/navigation/NavigationGuard";

export default function NewRequestPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const setDirty = useDraftScope("new-request-page", pageSurvives(pathname));

  return (
    <PageContainer className="max-w-3xl">
      <Button asChild variant="ghost" className="mb-4 -ml-4">
        <Link to="/requests"><ArrowLeft className="h-4 w-4" /> Requests</Link>
      </Button>
      <PageHeader
        eyebrow="Request intake"
        title="Submit a work request"
        description="Send a Creative & Design request for triage."
      />
      <Panel className="p-5 sm:p-6">
        <NewRequestForm onDirty={setDirty} onCreated={(request) => navigate(`/requests/${request.id}`)} />
      </Panel>
    </PageContainer>
  );
}
