import { createFileRoute } from "@tanstack/react-router";
import { V2Builder } from "@/components/flow-v2/V2Builder";

export const Route = createFileRoute("/builder/edit")({
  head: () => ({
    meta: [{ title: "Editor de Flow — SDR Totum" }],
  }),
  validateSearch: (search: Record<string, unknown>): { flow?: string } => ({
    flow: typeof search.flow === "string" ? search.flow : undefined,
  }),
  component: BuilderEditPage,
});

function BuilderEditPage() {
  const { flow } = Route.useSearch();
  return <V2Builder flowId={flow} />;
}
