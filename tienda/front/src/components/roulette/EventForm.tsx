import { Button } from "@heroui/button";
import { RaffleEvent } from "../../types/roulette";

interface EventFormProps {
  editForm: Partial<RaffleEvent>;
  savingEvent: boolean;
  onEditFormChange: (form: Partial<RaffleEvent>) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function EventForm({
  editForm,
  savingEvent,
  onEditFormChange,
  onSave,
  onCancel,
}: EventFormProps) {
  return (
    <div className="p-6 rounded-3xl bg-primary/5 border border-primary/20 flex flex-col gap-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">
        {editForm.id ? "Editar Evento" : "Nuevo Evento"}
      </p>
      <input
        className="bg-black/5 dark:bg-white/8 border border-black/10 dark:border-white/15 rounded-xl px-3 py-2.5 text-sm text-black dark:text-white outline-none focus:border-primary placeholder:text-black/30 dark:placeholder:text-white/25"
        placeholder="Título del sorteo *  (ej: Rifa del Laptop Gaming)"
        value={editForm.title ?? ""}
        onChange={(e) => onEditFormChange({ ...editForm, title: e.target.value })}
      />
      <input
        className="bg-black/5 dark:bg-white/8 border border-black/10 dark:border-white/15 rounded-xl px-3 py-2.5 text-sm text-black dark:text-white outline-none focus:border-primary placeholder:text-black/30 dark:placeholder:text-white/25"
        placeholder="Premio a rifar *  (ej: Laptop Lenovo Legion 5)"
        value={editForm.prize ?? ""}
        onChange={(e) => onEditFormChange({ ...editForm, prize: e.target.value })}
      />
      <textarea
        className="bg-black/5 dark:bg-white/8 border border-black/10 dark:border-white/15 rounded-xl px-3 py-2.5 text-sm text-black dark:text-white outline-none focus:border-primary resize-none placeholder:text-black/30 dark:placeholder:text-white/25"
        placeholder="Descripción / condiciones (opcional)"
        rows={2}
        value={editForm.description ?? ""}
        onChange={(e) => onEditFormChange({ ...editForm, description: e.target.value })}
      />
      <button
        type="button"
        className="flex items-center gap-3 cursor-pointer bg-transparent border-none p-0"
        onClick={() => onEditFormChange({ ...editForm, is_active: !editForm.is_active })}
      >
        <div
          className={`w-11 h-6 rounded-full transition-colors relative ${
            editForm.is_active ? "bg-primary" : "bg-black/20 dark:bg-white/20"
          }`}
        >
          <div
            className={`absolute top-1 size-4 rounded-full bg-white transition-all ${
              editForm.is_active ? "left-6" : "left-1"
            }`}
          />
        </div>
        <span className="text-sm text-black/70 dark:text-white/70">
          Activar evento ahora
        </span>
      </button>
      <div className="flex gap-3 mt-4 pt-2">
        <Button
          className="flex-grow bg-primary text-white font-black py-6"
          onClick={onSave}
          isLoading={savingEvent}
          disabled={!editForm.title?.trim() || !editForm.prize?.trim()}
        >
          {editForm.id ? "Guardar" : "Crear"}
        </Button>
        <Button
          className="bg-black/5 dark:bg-white/5 font-bold py-6 px-8"
          onClick={onCancel}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
