import React, { Suspense } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import AdminGuard from './components/AdminGuard';
import { FiltersProvider } from './context/FiltersContext';
import { Toaster } from 'react-hot-toast';

const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Users = React.lazy(() => import('./pages/Users'));
const Characters = React.lazy(() => import('./pages/Characters'));
const CoinTransactions = React.lazy(() => import('./pages/CoinTransactions'));
const ChatLogs = React.lazy(() => import('./pages/ChatLogs'));
const Orders = React.lazy(() => import('./pages/Orders'));
const Settings = React.lazy(() => import('./pages/Settings'));
const PricingManagement = React.lazy(() => import('./pages/PricingManagement'));
const UserActivity = React.lazy(() => import('./pages/UserActivity'));
const ContactMessages = React.lazy(() => import('./pages/ContactMessages'));
const AIGenerationLogs = React.lazy(() => import('./pages/AIGenerationLogs'));
const PrivateContent = React.lazy(() => import('./pages/PrivateContent'));
const PrivateContentPacks = React.lazy(() => import('./pages/PrivateContentPacks'));
const PrivateContentPackCreate = React.lazy(() => import('./pages/PrivateContentPackCreate'));
const APIsManagement = React.lazy(() => import('./pages/APIsManagement'));
const CodeInjections = React.lazy(() => import('./pages/CodeInjections'));
const AdminAccess = React.lazy(() => import('./pages/AdminAccess'));
const SetPassword = React.lazy(() => import('./pages/SetPassword'));
const ActivationFailed = React.lazy(() => import('./pages/ActivationFailed'));
// const BannerManagement = React.lazy(() => import('./pages/BannerManagement'));

export default function AdminApp() {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const handleLogout = () => {
    try {
      localStorage.removeItem('pornily:auth:raw');
      localStorage.removeItem('pornily:auth:token');
      localStorage.removeItem('pornily:auth:access_token');
      localStorage.removeItem('access_token');
    } catch (e) { }
    try {
      window.location.assign('/');
    } catch (e) {
      window.location.href = '/';
    }
  };
  const getNavLinkClass = (isActive: boolean) => (
    `flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors ${sidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4'} ${isActive ? 'bg-blue-500 text-white' : 'text-black! hover:bg-gray-100'}`
  );
  const renderNavLink = (to: string, label: string, icon: React.ReactNode) => (
    <NavLink
      to={to}
      title={sidebarCollapsed ? label : undefined}
      aria-label={label}
      className={({ isActive }) => getNavLinkClass(isActive)}
    >
      {icon}
      {!sidebarCollapsed && <span className="whitespace-nowrap">{label}</span>}
    </NavLink>
  );

  return (
    <AdminGuard>
      <FiltersProvider>
        <Toaster position="top-right" />
        <div className="min-h-screen bg-gray-50" data-admin-root>
          <div className="flex h-screen">
            {/* Sidebar */}
            <aside className={`bg-white border-r border-gray-200 hidden md:flex flex-col overflow-hidden shrink-0 transition-all duration-200 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
              <div className="h-16 flex items-center px-4 border-b border-gray-200 shrink-0">
                {!sidebarCollapsed && (
                  <h1 className="text-xl font-bold text-blue-600 whitespace-nowrap">Admin Dashboard</h1>
                )}
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed((prev) => !prev)}
                  className={`${sidebarCollapsed ? 'mx-auto' : 'ml-auto'} p-2 rounded-md hover:bg-gray-100`}
                  aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  <svg className={`w-5 h-5 text-gray-700 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>
              <div className="p-4 text-xs font-semibold text-gray-900 uppercase tracking-wider shrink-0" aria-hidden="true"></div>
              <nav className="flex-1 px-3 space-y-1 overflow-y-auto pb-4">
                {renderNavLink(
                  "dashboard",
                  "Dashboard",
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                )}

                {renderNavLink(
                  "users",
                  "User Management",
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}

                {renderNavLink(
                  "characters",
                  "Character Management",
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}

                {renderNavLink(
                  "private-content",
                  "Private Content",
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}

                {renderNavLink(
                  "pricing",
                  "Pricing Plans",
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}

                {renderNavLink(
                  "orders",
                  "Order History",
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                )}

                {renderNavLink(
                  "coins",
                  "Coin Transactions",
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}

                {renderNavLink(
                  "chatlogs",
                  "System Prompts",
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}

                {renderNavLink(
                  "code-injections",
                  "Code Injections",
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                )}

                {renderNavLink(
                  "settings",
                  "Setting & Configuration",
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}

                {/* {renderNavLink(
                  "banner-management",
                  "Banner Management",
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )} */}

                {renderNavLink(
                  "contact-messages",
                  "Contact Messages",
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
              </nav>
            </aside>

            {/* Main area */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Topbar */}
              <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 justify-between">
                <div className="flex items-center gap-4">
                  <button className="md:hidden p-2 rounded-md hover:bg-gray-100">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <a
                    href="/"
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-black bg-white hover:bg-gray-50 transition-colors"
                    style={{ color: '#000' }}
                  >
                    Back to Site
                  </a>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    Logout
                  </button>
                  <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center cursor-pointer">
                    <span className="text-white font-semibold text-sm">A</span>
                  </div>
                </div>
              </header>

              {/* Content */}
              <main className="admin-main p-6 bg-gray-50 flex-1 overflow-y-auto overflow-x-auto min-w-0">
                <div className="text-black w-full min-w-0">
                  <Suspense fallback={<div className="p-6 text-black">Loading admin section…</div>}>
                    <Routes>
                      <Route index element={<Navigate to="dashboard" replace />} />
                      <Route path="dashboard" element={<Dashboard />} />
                      <Route path="users" element={<Users />} />
                      <Route path="characters" element={<Characters />} />
                      <Route path="coins" element={<CoinTransactions />} />
                      <Route path="pricing" element={<PricingManagement />} />
                      <Route path="orders" element={<Orders />} />
                      <Route path="chatlogs" element={<ChatLogs />} />
                      <Route path="settings" element={<Settings />} />
                      <Route path="user-activity/:id" element={<UserActivity />} />
                      <Route path="contact-messages" element={<ContactMessages />} />
                      <Route path="content-management" element={<AIGenerationLogs />} />
                      <Route path="private-content" element={<PrivateContent />} />
                      <Route path="private-content/packs" element={<PrivateContentPacks />} />
                      <Route path="private-content/packs/create" element={<PrivateContentPackCreate />} />
                      <Route path="api-management" element={<APIsManagement />} />
                      <Route path="code-injections" element={<CodeInjections />} />
                      <Route path="admin-access" element={<AdminAccess />} />
                      <Route path="set-password" element={<SetPassword />} />
                      <Route path="activation-failed" element={<ActivationFailed />} />
                      {/* <Route path="banner-management" element={<BannerManagement />} /> */}
                    </Routes>
                  </Suspense>
                </div>
              </main>
            </div>
          </div>
        </div>
      </FiltersProvider>
    </AdminGuard>
  );
}


