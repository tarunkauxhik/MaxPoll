import AppShell from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/States";

/** Placeholder so the shell is navigable and the nav's active state is
 *  verifiable. Real screen: Phase 7.2. */
export default function Page() {
  return (
    <AppShell>
      <EmptyState icon="◇" message="Spaces arrive in phase 7." />
    </AppShell>
  );
}
