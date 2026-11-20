import { createFileRoute } from "@tanstack/react-router";
import { Shell, type AppSearch } from "@/components/shell";
import { OverviewView } from "@/views/overview";
import { CeoView, DispatchView, OrchestratorView, ProjectsView, QuotasView, TasksView } from "@/views/flow";
import { MatrixView, OrgView, ProfileView, ReviewsView, StaffView } from "@/views/people";
import { ActivityView, DocsView, ReportsView, SettingsView } from "@/views/system";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): AppSearch => ({
    view: typeof search.view === "string" && search.view ? search.view : "ceo",
    id: typeof search.id === "string" ? search.id : "",
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: Home,
});

function Home() {
  const search = Route.useSearch();
  return (
    <Shell search={search}>
      <Screen search={search} />
    </Shell>
  );
}

function Screen({ search }: { search: AppSearch }) {
  switch (search.view) {
    case "ceo":
      return <CeoView />;
    case "dispatch":
      return <DispatchView />;
    case "orchestrator":
      return <OrchestratorView />;
    case "org":
      return <OrgView />;
    case "staff":
      return <StaffView q={search.q} />;
    case "matrix":
      return <MatrixView />;
    case "profile":
      return <ProfileView id={search.id} />;
    case "reviews":
      return <ReviewsView />;
    case "quotas":
      return <QuotasView />;
    case "projects":
      return <ProjectsView />;
    case "tasks":
      return <TasksView />;
    case "reports":
      return <ReportsView />;
    case "docs":
      return <DocsView />;
    case "activity":
      return <ActivityView />;
    case "settings":
      return <SettingsView />;
    default:
      return <OverviewView />;
  }
}
