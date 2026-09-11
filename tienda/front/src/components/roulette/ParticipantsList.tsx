import { Pagination } from "@heroui/pagination";
import { Button } from "@heroui/button";
import { Participant, RaffleEvent } from "../../types/roulette";
import { COLORS, PART_PER_PAGE } from "../../hooks/useRoulette";

interface ParticipantsListProps {
  participants: Participant[];
  paginatedParticipants: Participant[];
  partPage: number;
  partTotalPages: number;
  event: RaffleEvent | null;
  onPageChange: (page: number) => void;
  onRemoveParticipant: (id: number) => void;
}

export function ParticipantsList({
  participants,
  paginatedParticipants,
  partPage,
  partTotalPages,
  event,
  onPageChange,
  onRemoveParticipant,
}: ParticipantsListProps) {
  if (participants.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2">
        Participantes registrados ({participants.length})
      </p>
      <div className="grid gap-2">
        {paginatedParticipants.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
              event?.winner_id === p.id
                ? "bg-yellow-500/10 border-yellow-500/30"
                : "bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5"
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className="size-10 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0 shadow-lg"
                style={{ backgroundColor: COLORS[(partPage - 1) * PART_PER_PAGE + i % COLORS.length] }}
              >
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold flex items-center gap-2">
                  {p.name}
                  {event?.winner_id === p.id && <span className="text-yellow-500">🏆</span>}
                </p>
                {p.phone && <p className="text-xs opacity-40 font-medium">{p.phone}</p>}
              </div>
            </div>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              color="danger"
              onClick={() => onRemoveParticipant(p.id)}
              className="opacity-20 hover:opacity-100 transition-opacity"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </Button>
          </div>
        ))}
      </div>

      {partTotalPages > 1 && (
        <div className="flex w-full justify-center mt-2">
          <Pagination
            isCompact
            showControls
            color="primary"
            page={partPage}
            total={partTotalPages}
            onChange={onPageChange}
            variant="light"
          />
        </div>
      )}
    </div>
  );
}
