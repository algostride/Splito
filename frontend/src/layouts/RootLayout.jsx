import { Outlet } from 'react-router-dom';

/**
 * Just the outlet. The background and the page height belong to AppShell for
 * signed-in routes, and Login/Register are full-height on their own, so
 * painting a background here duplicated the shell's job and left the two
 * auth pages with a pale band below `min-h-[80vh]`.
 */
const RootLayout = () => <Outlet />;

export default RootLayout;
