import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { Button } from "@heroui/button";
import { SunIcon, MoonIcon } from "../components/atoms/icons";
import { DashboardLayout } from "../components/templates/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import { useRoulette } from "../hooks/useRoulette";
import {
  EventHeader,
  ClientView,
  AdminPanel,
  WinnerModal,
} from "../components/roulette";

// ─── Inner View Component ────────────────────────────────────────────────────
export function RouletteView({ isDashboardView = false }: { isDashboardView?: boolean }) {
  const {
    event,
    participants,
    paginatedParticipants,
    loading,
    segments,
    isRegistered,
    registering,
    regError,
    showAdminPanel,
    setShowAdminPanel,
    adminTab,
    setAdminTab,
    allEvents,
    editForm,
    setEditForm,
    savingEvent,
    showEventForm,
    setShowEventForm,
    spinning,
    winner,
    showWinner,
    setShowWinner,
    wheelRef,
    partPage,
    partTotalPages,
    handleRegister,
    handleDraw,
    handleSaveEvent,
    handleResetRaffle,
    handleRemoveParticipant,
    openAdminPanel,
    setPartPage,
    viewEventId,
    setViewEventId,
    isAdmin,
  } = useRoulette(isDashboardView);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={isDashboardView ? "flex flex-col flex-1" : "min-h-screen bg-[#0a0a0a] text-white flex flex-col"}>
      <div className="max-w-2xl mx-auto py-8 px-4 w-full flex-1">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#0d0d0d] rounded-[2.5rem] border border-black/5 dark:border-white/10 overflow-hidden shadow-2xl shadow-black/5 flex flex-col"
        >
          <EventHeader
            event={event}
            isAdmin={isAdmin}
            isDashboardView={isDashboardView}
            viewEventId={viewEventId}
            onToggleAdminPanel={() => setShowAdminPanel(!showAdminPanel)}
            onBackToLive={() => {
              setViewEventId(null);
              if (window.innerWidth < 768) setShowAdminPanel(false);
            }}
          />

          <div className="p-6 md:p-10 flex-grow flex flex-col gap-8 text-black dark:text-white">
            {isAdmin && showAdminPanel ? (
              <AdminPanel
                event={event}
                participants={participants}
                paginatedParticipants={paginatedParticipants}
                partPage={partPage}
                partTotalPages={partTotalPages}
                allEvents={allEvents}
                editForm={editForm}
                savingEvent={savingEvent}
                showEventForm={showEventForm}
                adminTab={adminTab}
                spinning={spinning}
                segments={segments}
                wheelRef={wheelRef}
                onTabChange={(tab) => {
                  setAdminTab(tab);
                  if (tab === "evento") openAdminPanel();
                }}
                onDraw={handleDraw}
                onResetRaffle={handleResetRaffle}
                onRemoveParticipant={handleRemoveParticipant}
                onPageChange={setPartPage}
                onEditFormChange={setEditForm}
                onSaveEvent={handleSaveEvent}
                onShowEventForm={() => {
                  setShowEventForm(true);
                  setEditForm({ title: "", prize: "", description: "", is_active: true });
                }}
                onHideEventForm={() => setShowEventForm(false)}
                onViewEvent={(id) => {
                  setViewEventId(id);
                  setAdminTab("participantes");
                  if (window.innerWidth < 768) setShowAdminPanel(false);
                }}
              />
            ) : (
              <ClientView
                event={event}
                participants={participants}
                isRegistered={isRegistered}
                registering={registering}
                regError={regError}
                segments={segments}
                wheelRef={wheelRef}
                onRegister={handleRegister}
              />
            )}
          </div>
        </motion.div>
      </div>

      {showWinner && winner && (
        <WinnerModal winner={winner} event={event} onClose={() => setShowWinner(false)} />
      )}
    </div>
  );
}

// ─── Main Page Component ─────────────────────────────────────────────────────
export default function RoulettePage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const sidebarContent = (
    <nav className="flex flex-col gap-1">
      <div className="mb-6 flex flex-col gap-1">
        <p className="text-[10px] uppercase font-bold text-black/40 dark:text-white/40 mb-2 px-2 tracking-widest">
          Navegación
        </p>
        <button
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
          onClick={() => navigate("/")}
        >
          📦 Catálogo de Productos
        </button>
        <button className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm bg-primary text-white font-medium shadow-lg shadow-primary/20">
          🎰 Ruleta de Sorteos
        </button>
      </div>
      
      <p className="text-[10px] uppercase font-bold text-black/40 dark:text-white/40 mb-2 px-2 tracking-widest">
        Cuenta
      </p>
      <button
        className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
        onClick={() => navigate("/")}
      >
        👤 Mi Perfil
      </button>
    </nav>
  );

  return (
    <DashboardLayout
      isAdmin={user?.role === "admin" || user?.role === "super_admin"}
      isMenuOpen={isMenuOpen}
      setIsMenuOpen={setIsMenuOpen}
      isCartOpen={false}
      setIsCartOpen={() => {}}
      headerContent={
        <div className="flex items-center justify-between w-full h-full">
          <div className="flex items-center gap-3 lg:hidden">
            <Button
              isIconOnly
              className="bg-black/5 dark:bg-white/5"
              size="sm"
              variant="flat"
              onClick={() => setIsMenuOpen(true)}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
            <div className="size-8 bg-yellow-400 rounded-lg flex items-center justify-center font-bold text-lg text-black">
              V
            </div>
          </div>

          <div className="flex-grow max-w-md hidden lg:block">
            <h1 className="text-sm font-bold ml-2 lg:ml-0 text-black/40 dark:text-white/40 uppercase tracking-[0.2em]">
              Ruleta de Premios
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              isIconOnly
              className="bg-black/5 dark:bg-white/5"
              size="sm"
              variant="flat"
              onClick={toggleTheme}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </Button>
            <Button
              className="bg-danger/10 text-danger text-xs font-bold"
              size="sm"
              variant="flat"
              onClick={logout}
            >
              Cerrar Sesión
            </Button>
          </div>
        </div>
      }
      sidebarContent={sidebarContent}
      cartSidebarContent={null}
    >
      <RouletteView isDashboardView />
    </DashboardLayout>
  );
}
