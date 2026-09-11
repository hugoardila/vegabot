import { motion } from "framer-motion";
import { Button } from "@heroui/button";
import { RaffleEvent } from "../../types/roulette";
import { DrawResult } from "../../types/roulette";

interface WinnerModalProps {
  winner: DrawResult["winner"];
  event: RaffleEvent | null;
  onClose: () => void;
}

export function WinnerModal({ winner, event, onClose }: WinnerModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm bg-white dark:bg-[#0d0d0d] rounded-[3rem] border border-yellow-500/20 shadow-[0_32px_64px_-16px_rgba(234,179,8,0.2)] overflow-hidden"
      >
        <div className="bg-yellow-500 p-10 flex flex-col items-center gap-4 relative">
          <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-white/20 to-transparent" />
          <div className="size-24 rounded-full bg-white flex items-center justify-center text-4xl shadow-2xl relative z-10">
            🏆
          </div>
          <h3 className="text-black font-black text-2xl tracking-tight relative z-10 uppercase">
            ¡Tenemos un Ganador!
          </h3>
        </div>

        <div className="p-10 flex flex-col items-center gap-6 text-center text-black dark:text-white">
          <div className="flex flex-col items-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-30 mb-3">
              Afortunado/a
            </p>
            <p className="text-3xl font-black tracking-tight">{winner.name}</p>
            {event && (
              <div className="mt-4 px-4 py-2 rounded-2xl bg-primary/5 text-primary text-sm font-bold border border-primary/10">
                Premio: {event.prize}
              </div>
            )}
          </div>

          <Button
            className="w-full bg-black dark:bg-white dark:text-black text-white font-black py-7 text-lg rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all outline-none"
            onClick={onClose}
          >
            ¡Felicidades! 🎉
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
