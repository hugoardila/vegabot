import { UploadIcon, CheckIcon } from "./CheckoutIcons";
import { MAX_RECEIPTS } from "../../hooks/useCheckout";

interface ReceiptUploadProps {
  receipts: File[];
  errors: {
    receipts?: string;
  };
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
}

export function ReceiptUpload({
  receipts,
  errors,
  onFileChange,
  onRemoveFile,
}: ReceiptUploadProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Header + counter badge */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[10px] font-bold opacity-50 uppercase tracking-widest">
          Comprobantes de pago (Mínimo 1, Máximo 2) *
        </h4>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          receipts.length >= MAX_RECEIPTS
            ? "bg-danger/10 text-danger"
            : receipts.length > 0
            ? "bg-success/10 text-success"
            : "bg-black/10 dark:bg-white/10 text-black/40 dark:text-white/40"
        }`}>
          {receipts.length}/{MAX_RECEIPTS} fotos
        </span>
      </div>
      {errors.receipts && (
        <p className="text-danger text-xs mb-3 font-medium">{errors.receipts}</p>
      )}

      <div className="flex flex-col gap-4">
        {/* File Upload Box */}
        <label
          className={`relative flex flex-col items-center justify-center w-full min-h-[140px] rounded-2xl border-2 border-dashed transition-all duration-200 select-none ${
            receipts.length >= MAX_RECEIPTS
              ? "border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black/30 dark:text-white/30 cursor-not-allowed opacity-50 pointer-events-none"
              : errors.receipts
              ? "border-danger bg-danger/5 text-danger cursor-pointer"
              : "border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 text-black dark:text-white hover:border-primary/50 active:scale-[0.98] cursor-pointer"
          }`}
          onClick={(e) => {
            if (receipts.length >= MAX_RECEIPTS) e.preventDefault();
          }}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6 pointer-events-none">
            <UploadIcon size={32} />
            <p className="mb-2 text-sm font-semibold mt-3">
              {receipts.length >= MAX_RECEIPTS ? "Límite alcanzado" : "Toca para subir fotos"}
            </p>
            <p className="text-xs opacity-60">
              {receipts.length >= MAX_RECEIPTS
                ? `Solo se permiten ${MAX_RECEIPTS} fotos como máximo`
                : `Puedes agregar ${MAX_RECEIPTS - receipts.length} foto${MAX_RECEIPTS - receipts.length !== 1 ? "s" : ""} más (JPG, PNG)`
              }
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            multiple
            accept="image/*"
            disabled={receipts.length >= MAX_RECEIPTS}
            onChange={onFileChange}
          />
        </label>

        {/* Thumbnails preview */}
        {receipts.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {receipts.map((file, index) => {
              const previewUrl = URL.createObjectURL(file);
              return (
                <div key={index} className="relative rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 aspect-square">
                  <img
                    src={previewUrl}
                    alt={`Comprobante ${index + 1}`}
                    className="w-full h-full object-cover"
                    onLoad={() => URL.revokeObjectURL(previewUrl)}
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); onRemoveFile(index); }}
                    className="absolute top-1.5 right-1.5 bg-danger text-white rounded-full size-7 flex items-center justify-center text-sm font-bold shadow-lg"
                    aria-label="Eliminar foto"
                  >
                    ×
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-2 py-1 truncate">
                    {file.name}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {receipts.length === 0 && (
          <div className="text-xs text-warning bg-warning/10 p-3 rounded-xl border border-warning/20 flex items-center gap-2 font-medium">
            ⚠️ Te falta subir el comprobante
          </div>
        )}
        {receipts.length >= 1 && (
          <div className="text-xs text-success bg-success/10 p-3 rounded-xl border border-success/20 flex items-center gap-2 font-bold">
            <CheckIcon size={16} /> ¡Comprobante listo!
          </div>
        )}
      </div>
    </div>
  );
}
