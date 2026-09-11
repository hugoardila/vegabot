import { Button } from "@heroui/button";
import { RaffleEvent, Participant, AdminTab } from "../../types/roulette";
import { WheelSVG } from "./WheelSVG";
import { ParticipantsList } from "./ParticipantsList";
import { EventForm } from "./EventForm";
import { Segment } from "../../types/roulette";
import React from "react";

interface AdminPanelProps {
  event: RaffleEvent | null;
  participants: Participant[];
  paginatedParticipants: Participant[];
  partPage: number;
  partTotalPages: number;
  allEvents: RaffleEvent[];
  editForm: Partial<RaffleEvent>;
  savingEvent: boolean;
  showEventForm: boolean;
  adminTab: AdminTab;
  spinning: boolean;
  segments: Segment[];
  wheelRef: React.RefObject<SVGGElement>;
  onTabChange: (tab: AdminTab) => void;
  onDraw: () => void;
  onResetRaffle: (id: number) => void;
  onRemoveParticipant: (id: number) => void;
  onPageChange: (page: number) => void;
  onEditFormChange: (form: Partial<RaffleEvent>) => void;
  onSaveEvent: () => void;
  onShowEventForm: () => void;
  onHideEventForm: () => void;
  onViewEvent: (id: number) => void;
}

export function AdminPanel({
  event,
  participants,
  paginatedParticipants,
  partPage,
  partTotalPages,
  allEvents,
  editForm,
  savingEvent,
  showEventForm,
  adminTab,
  spinning,
  segments,
  wheelRef,
  onTabChange,
  onDraw,
  onResetRaffle,
  onRemoveParticipant,
  onPageChange,
  onEditFormChange,
  onSaveEvent,
  onShowEventForm,
  onHideEventForm,
  onViewEvent,
}: AdminPanelProps) {
  return (
    <div className="flex-1 w-full flex flex-col gap-5 text-black dark:text-white">
      {/* Tabs */}
      <div className="flex gap-2 rounded-2xl bg-black/5 dark:bg-white/5 p-1 border border-black/5 dark:border-white/5">
        {(["participantes", "evento"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all capitalize ${
              adminTab === tab
                ? "bg-primary text-white shadow-lg shadow-primary/20"
                : "text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white"
            }`}
          >
            {tab === "participantes" ? "👥 Participantes" : "🎁 Evento"}
          </button>
        ))}
      </div>

      {/* ── TAB: Participantes ────────────────────────────────────────── */}
      {adminTab === "participantes" && (
        <div className="flex flex-col gap-4">
          {/* Event summary */}
          {event ? (
            <div className="p-6 rounded-2xl border border-black/5 dark:border-white/10 bg-primary/5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] text-primary font-bold uppercase tracking-widest mb-1">Evento activo</p>
                <p className="font-black text-xl leading-tight">{event.title}</p>
                <p className="text-black/50 dark:text-white/50 text-sm mt-1">
                  Premio: <span className="text-primary font-bold">{event.prize}</span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="text-3xl font-black">{participants.length}</span>
                <span className="text-[10px] uppercase font-bold opacity-30 tracking-wider">Users</span>
                {event.winner_id && (
                  <Button
                    size="sm"
                    variant="flat"
                    color="danger"
                    onClick={() => onResetRaffle(event.id)}
                    className="text-[10px] font-bold h-7"
                  >
                    🔄 Reiniciar
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-10 rounded-3xl border border-dashed border-black/10 dark:border-white/10 text-center text-black/30 dark:text-white/30 text-xs font-bold uppercase tracking-widest">
              Sin evento activo
            </div>
          )}

          {/* Wheel + Draw button */}
          {event && !event.winner_id && (
            <div className="flex flex-col items-center gap-5">
              <div className="relative">
                {spinning && (
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                      background: "radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)",
                      animation: "pulse 1s ease-in-out infinite",
                    }}
                  />
                )}
                <WheelSVG ref={wheelRef} segments={segments} />
              </div>

              <button
                disabled={spinning || participants.length < 2}
                onClick={onDraw}
                className={`px-14 py-4 rounded-2xl text-lg font-black tracking-wide transition-all shadow-2xl ${
                  spinning || participants.length < 2
                    ? "bg-white/10 text-white/30 cursor-not-allowed"
                    : "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white hover:scale-105 active:scale-95 shadow-violet-500/30"
                }`}
              >
                {spinning ? "Girando…" : participants.length < 2 ? "Mínimo 2 participantes" : "🎰 GIRAR RULETA"}
              </button>
            </div>
          )}

          {/* Winner already drawn */}
          {event?.winner_id && event.winner_name && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 text-center">
              <p className="text-yellow-400 text-xs font-bold uppercase tracking-widest mb-2">🏆 Ganador del sorteo</p>
              <p className="text-3xl font-black text-white mb-1">{event.winner_name}</p>
              {event.winner_phone && <p className="text-yellow-300/80 text-sm">📱 {event.winner_phone}</p>}
              <button
                onClick={() => onResetRaffle(event.id)}
                className="mt-4 px-5 py-2 rounded-xl bg-white/10 text-white/60 text-xs hover:bg-white/20 transition-colors"
              >
                🔄 Nueva ronda
              </button>
            </div>
          )}

          {/* Participants list */}
          <ParticipantsList
            participants={participants}
            paginatedParticipants={paginatedParticipants}
            partPage={partPage}
            partTotalPages={partTotalPages}
            event={event}
            onPageChange={onPageChange}
            onRemoveParticipant={onRemoveParticipant}
          />
        </div>
      )}

      {/* ── TAB: Evento ───────────────────────────────────────────────── */}
      {adminTab === "evento" && (
        <div className="flex flex-col gap-4">
          <button
            onClick={onShowEventForm}
            className="w-full py-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30 text-sm font-bold hover:bg-primary/30 transition-colors"
          >
            + Crear Nuevo Evento
          </button>

          {/* Event form */}
          {showEventForm && (
            <EventForm
              editForm={editForm}
              savingEvent={savingEvent}
              onEditFormChange={onEditFormChange}
              onSave={onSaveEvent}
              onCancel={onHideEventForm}
            />
          )}

          {/* Events list */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-widest text-black/40 dark:text-white/40">Historial de eventos</p>
            {allEvents.length === 0 && (
              <p className="text-sm text-black/30 dark:text-white/30 text-center py-6">Sin eventos creados aún</p>
            )}
            {allEvents.map((ev) => (
              <div
                key={ev.id}
                className={`p-3 rounded-2xl border flex items-start justify-between gap-3 ${
                  ev.is_active
                    ? "bg-primary/10 border-primary/30 text-black dark:text-white"
                    : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-black dark:text-white"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold truncate">{ev.title}</p>
                    {ev.is_active && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-success/20 text-success font-bold uppercase">Activo</span>
                    )}
                  </div>
                  <p className="text-xs text-primary/80 truncate">{ev.prize}</p>
                  <p className="text-[10px] text-black/40 dark:text-white/40 mt-0.5">
                    {ev.participant_count} participantes{ev.winner_id && " · Ganador elegido ✓"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    title="Ver datos de este evento"
                    onClick={() => onViewEvent(ev.id)}
                    className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-success/20 text-success transition-colors"
                  >
                    👁️
                  </button>
                  <button
                    title="Editar evento"
                    onClick={() => onEditFormChange(ev)}
                    className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-primary/20 text-primary transition-colors"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
