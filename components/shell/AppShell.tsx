import BottomNav from "./BottomNav";
import TopBar from "./TopBar";

/**
 * The centred column every signed-in screen sits in.
 * `.shell-col` reserves bottom padding for the fixed nav so the last row is
 * never hidden behind it.
 */
export default function AppShell({
  children,
  topBarRight,
}: {
  children: React.ReactNode;
  topBarRight?: React.ReactNode;
}) {
  return (
    <div className="shell">
      <TopBar right={topBarRight} />
      <main className="shell-col">{children}</main>
      <BottomNav />
    </div>
  );
}
