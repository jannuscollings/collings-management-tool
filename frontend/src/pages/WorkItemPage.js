import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import { Button } from "../components/ui/Button";
import WorkItemPanel from "../components/work/WorkItemPanel";

export default function WorkItemPage() {
  const { workspaceSlug, itemId } = useParams();
  return <PageContainer className="max-w-4xl">
    <Button asChild variant="ghost" className="mb-4 -ml-4"><Link to={`/workspaces/${workspaceSlug}`}><ArrowLeft className="h-4 w-4" /> Back to workspace</Link></Button>
    <WorkItemPanel key={itemId} itemId={itemId} expectedWorkspace={workspaceSlug} />
  </PageContainer>;
}
