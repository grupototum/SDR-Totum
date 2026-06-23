import { createFileRoute } from "@tanstack/react-router";
import { FlowsList } from "@/components/flows/FlowsList";

export const Route = createFileRoute("/builder/")({
  head: () => ({
    meta: [{ title: "Fluxos — Builder · SDR Totum" }],
  }),
  component: FlowsList,
});
