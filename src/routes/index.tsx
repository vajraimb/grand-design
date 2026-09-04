import { createFileRoute } from "@tanstack/react-router";
import { GalaxyView } from "@/components/galaxy-view";
import { Overlay } from "@/components/overlay";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <GalaxyView />
      <Overlay />
    </main>
  );
}
