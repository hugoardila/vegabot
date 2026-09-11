import { Button } from "@heroui/button";
import { RaffleEvent } from "../../types/roulette";

interface EventHeaderProps {
  event: RaffleEvent | null;
  isAdmin: boolean;
  isDashboardView: boolean;
  viewEventId: number | null;
  onToggleAdminPanel: () => void;
  onBackToLive: () => void;
}

export function EventHeader({
  event,
  isAdmin,
  isDashboardView,
  viewEventId,
  onToggleAdminPanel,
  onBackToLive,
}: EventHeaderProps) {
  return (
    <div className="bg-primary/10 p-8 border-b border-black/5 dark:border-white/10 flex flex-col items-center relative text-black dark:text-white">
      {isAdmin && viewEventId && (
        <Button
          className="absolute left-6 top-6 bg-warning/20 text-warning-600 dark:text-warning-500 font-bold border border-warning/30"
          size="sm"
          onClick={onBackToLive}
        >
          ⬅️ Volver a Sorteo en Vivo
        </Button>
      )}
      {isAdmin && (
        <Button
          className="absolute right-6 top-6 bg-primary text-white font-bold"
          size="sm"
          onClick={onToggleAdminPanel}
        >
          {isDashboardView ? "Ver Ruleta" : "⚙️ Gestionar"}
        </Button>
      )}
      <div className="size-24 bg-primary text-white rounded-full flex items-center justify-center text-4xl mb-4 shadow-xl shadow-primary/20 ring-8 ring-primary/5">
        🎰
      </div>
      <h2 className="text-2xl font-bold tracking-tight">{event?.title || "Sorteo de Premios"}</h2>
      <div className="flex items-center gap-2 mt-2">
        {event?.is_active ? (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 text-success text-[10px] font-bold uppercase tracking-widest">
            <div className="size-1.5 rounded-full bg-success animate-pulse" />
            Sorteo Activo: {event.prize}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 text-black/40 dark:text-white/40 text-[10px] font-bold uppercase tracking-widest">
            Sin Sorteo Activo
          </div>
        )}
      </div>
    </div>
  );
}
