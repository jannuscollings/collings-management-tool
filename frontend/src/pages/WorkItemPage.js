import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import { Button } from "../components/ui/Button";
import WorkItemPanel from "../components/work/WorkItemPanel";
import { pageSurvives, useDraftScope } from "../components/navigation/NavigationGuard";

export default function WorkItemPage() {
  const { workspaceSlug, itemId } = useParams();
  const { pathname } = useLocation();
  const setDirty = useDraftScope(`work-item-page:${itemId}`, pageSurvives(pathname));
  return <PageContainer className="max-w-4xl pb-16 shell:pb-[34px]">
    <Button asChild variant="ghost" className="mb-4 -ml-4"><Link to={`/workspaces/${workspaceSlug}`}><ArrowLeft className="h-4 w-4" /> Back to workspace</Link></Button>
    <WorkItemPanel key={itemId} itemId={itemId} expectedWorkspace={workspaceSlug} onDirty={setDirty} />
  </PageContainer>;
}
