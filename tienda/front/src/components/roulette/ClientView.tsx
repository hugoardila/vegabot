import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { RaffleEvent, Participant } from "../../types/roulette";
import { WheelSVG } from "./WheelSVG";
import { Segment } from "../../types/roulette";

interface ClientViewProps {
  event: RaffleEvent | null;
  participants: Participant[];
  isRegistered: boolean;
  registering: boolean;
  regError: string;
  segments: Segment[];
  wheelRef: React.RefObject<SVGGElement>;
  onRegister: () => void;
}

export function ClientView({
  event,
  participants,
  isRegistered,
  registering,
  regError,
  segments,
  wheelRef,
  onRegister,
}: ClientViewProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!event) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-black/40 dark:text-white/20">
        <span className="text-6xl">🎰</span>
        <p className="text-base font-semibold">No hay sorteo activo</p>
        <p className="text-sm text-center">
          El administrador abrirá uno pronto. ¡Vuelve más tarde!
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-8 gap-7 max-w-lg mx-auto w-full">
      {/* Prize card */}
      <div className="w-full p-5 rounded-3xl bg-gradient-to-br from-violet-500/20 via-fuchsia-500/10 to-pink-500/20 border border-violet-500/30 text-center">
        <p className="text-[10px] uppercase tracking-widest text-violet-500/80 dark:text-violet-300/60 mb-2">
          Sorteo en curso
        </p>
        <h2 className="text-xl font-black leading-tight mb-1">{event.title}</h2>
        <div className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-xl bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10">
          <span className="text-2xl">🎁</span>
          <span className="text-sm font-bold text-black dark:text-white">{event.prize}</span>
        </div>
        {event.description && (
          <p className="text-xs text-black/60 dark:text-white/40 mt-3 leading-relaxed">{event.description}</p>
        )}
        <p className="text-black/60 dark:text-white/40 text-xs mt-3">
          👥 {event.participant_count} participantes registrados
        </p>
      </div>

      {/* Registration section */}
      {!event.winner_id && (
        <div className="w-full">
          {isRegistered ? (
            <div className="flex flex-col items-center gap-2 py-5 px-6 rounded-2xl bg-success/10 border border-success/30 text-center">
              <span className="text-3xl">✅</span>
              <p className="font-black text-success text-lg">¡Ya estás participando!</p>
              <p className="text-xs text-success/70 dark:text-white/40">
                El administrador girará la ruleta pronto. ¡Suerte!
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              {!user ? (
                <button
                  onClick={() => navigate("/login")}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-black text-base hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-violet-500/30"
                >
                  🔑 Inicia sesión para participar
                </button>
              ) : (
                <>
                  <div className="w-full p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-center">
                    <p className="text-xs text-black/60 dark:text-white/40 mb-1">Participarás como</p>
                    <p className="font-bold text-black dark:text-white">{user.full_name}</p>
                    {(user as any).phone && (
                      <p className="text-xs text-black/60 dark:text-white/40 mt-0.5">📱 {(user as any).phone}</p>
                    )}
                  </div>
                  {regError && (
                    <p className="text-danger text-xs font-semibold">⚠️ {regError}</p>
                  )}
                  <button
                    disabled={registering}
                    onClick={onRegister}
                    className={`w-full py-4 rounded-2xl font-black text-base transition-all shadow-2xl ${
                      registering
                        ? "bg-white/10 text-white/30 cursor-not-allowed"
                        : "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white hover:scale-[1.02] active:scale-95 shadow-violet-500/30"
                    }`}
                  >
                    {registering ? "Registrando…" : "🎟️ ¡Registrarme para participar!"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Winner already announced */}
      {event.winner_id && event.winner_name && (
        <div className="w-full p-5 rounded-3xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/40 text-center">
          <p className="text-yellow-400 text-xs font-bold uppercase tracking-widest mb-3">🏆 Ganador del sorteo</p>
          <p className="text-3xl font-black">{event.winner_name}</p>
          {user && event.winner_name === user.full_name && (
            <p className="text-yellow-300 text-sm font-bold mt-2 animate-bounce">¡Eres tú! 🎉 ¡Felicitaciones!</p>
          )}
        </div>
      )}

      {/* Read-only wheel */}
      <div className="flex flex-col items-center gap-3 w-full">
        <p className="text-[10px] uppercase tracking-widest text-white/30">Participantes en la ruleta</p>
        <WheelSVG ref={wheelRef} segments={segments} />
        {participants.length < 2 && (
          <p className="text-xs text-white/30 text-center">Esperando más participantes…</p>
        )}
      </div>
    </div>
  );
}
