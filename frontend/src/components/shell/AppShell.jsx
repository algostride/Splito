import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Rail from './Rail';
import Drawer from './Drawer';
import TopBar from './TopBar';

/**
 * The app chrome: a sticky rail on the left from `md` up, a top bar and a
 * drawer below it, and the routed page filling the rest.
 *
 * `min-h-dvh` rather than `h-dvh`: the rail is `h-dvh sticky`, and pinning the
 * page to a viewport height would clip long screens instead of letting the
 * document scroll.
 */
const AppShell = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-dvh flex bg-bg">
      <Rail />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar onOpenMenu={() => setDrawerOpen(true)} />
        <main className="flex-1 min-w-0 flex flex-col">
          <Outlet />
        </main>
      </div>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
};

export default AppShell;
