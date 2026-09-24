import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import PageContainer from "../components/layout/PageContainer";
import RequestDetailPanel from "../components/requests/RequestDetailPanel";
import { Button } from "../components/ui/Button";

export default function RequestDetailPage() {
  const { requestId } = useParams();
  return (
    <PageContainer className="max-w-4xl">
      <Button asChild variant="ghost" className="mb-4 -ml-4">
        <Link to="/requests"><ArrowLeft className="h-4 w-4" /> Requests</Link>
      </Button>
      <RequestDetailPanel requestId={requestId} />
    </PageContainer>
  );
}
