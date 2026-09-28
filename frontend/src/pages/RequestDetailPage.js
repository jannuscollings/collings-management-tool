import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import PageContainer from "../components/layout/PageContainer";
import RequestDetailPanel from "../components/requests/RequestDetailPanel";
import { Button } from "../components/ui/Button";
import { pageSurvives, useDraftScope } from "../components/navigation/NavigationGuard";

export default function RequestDetailPage() {
  const { requestId } = useParams();
  const { pathname } = useLocation();
  const setDirty = useDraftScope(`request-page:${requestId}`, pageSurvives(pathname));
  return (
    <PageContainer className="max-w-4xl">
      <Button asChild variant="ghost" className="mb-4 -ml-4">
        <Link to="/requests"><ArrowLeft className="h-4 w-4" /> Requests</Link>
      </Button>
      <RequestDetailPanel requestId={requestId} onDirty={setDirty} />
    </PageContainer>
  );
}
