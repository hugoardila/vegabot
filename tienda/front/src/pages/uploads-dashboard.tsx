import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/button";
import { useAuth } from "../context/AuthContext";
import { adminService } from "../services/admin";
import { API_URL } from "../config/api";
import { VideoUploadButton } from "../components/organisms/VideoUploadButton";
import { UploadProgressBar } from "../components/molecules/UploadProgressBar";

type UploadBucket = "productos" | "facturas" | "videos";

type UploadItem = {
  name: string;
  url: string;
  type: "image" | "video" | "pdf" | "file";
  size?: number;
  modified?: number;
};

const API_BASE = API_URL.replace("/api", "");

const bucketLabels: Record<UploadBucket, string> = {
  productos: "📦 Productos",
  facturas: "🧾 Facturas",
  videos: "🎬 Videos",
};

const formatBytes = (bytes?: number) => {
  if (!bytes && bytes !== 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export default function UploadsDashboardPage() {
  const { token, user } = useAuth();
  const [bucket, setBucket] = useState<UploadBucket>("productos");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const canUpload = user?.role === "admin" || user?.role === "super_admin";

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => (b.modified || 0) - (a.modified || 0));
  }, [items]);

  const refresh = async (b: UploadBucket) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminService.listUploads(b, token);
      setItems((res?.files as UploadItem[]) || []);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar la lista");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh(bucket);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, token]);

  const onOpen = (item: UploadItem) => {
    const url = item.url.startsWith("http") ? item.url : `${API_BASE}${item.url}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const onDelete = async (item: UploadItem) => {
    if (!token) return;
    const ok = window.confirm(`¿Eliminar este archivo?\n\n${item.name}`);
    if (!ok) return;
    setDeleting(item.name);
    try {
      await adminService.deleteUpload(bucket, item.name, token);
      setItems((prev) => prev.filter((x) => x.name !== item.name));
    } catch (e: any) {
      alert(e?.message || "No se pudo eliminar");
    } finally {
      setDeleting(null);
    }
  };

  const handleUploadStart = () => {
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
  };

  const handleUploadProgress = (progress: number) => {
    setUploadProgress(progress);
  };

  const handleUploadComplete = () => {
    setUploading(false);
    setUploadProgress(0);
    refresh(bucket);
  };

  const handleUploadError = (errorMsg: string) => {
    setUploading(false);
    setUploadProgress(0);
    setUploadError(errorMsg);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-black dark:text-white">
            Panel de Archivos
          </h2>
          <p className="text-sm text-black/50 dark:text-white/50 font-medium">
            Ver y eliminar archivos en `uploads/`
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(bucketLabels) as UploadBucket[]).map((b) => (
            <Button
              key={b}
              size="sm"
              variant={bucket === b ? "shadow" : "flat"}
              className={
                bucket === b
                  ? "bg-primary text-white font-bold"
                  : "bg-black/5 dark:bg-white/5 text-black dark:text-white font-bold"
              }
              onClick={() => setBucket(b)}
            >
              {bucketLabels[b]}
            </Button>
          ))}

          <Button
            size="sm"
            variant="flat"
            className="bg-black/5 dark:bg-white/5 text-black dark:text-white font-bold"
            onClick={() => refresh(bucket)}
            isDisabled={loading || uploading}
          >
            ↻ Actualizar
          </Button>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-black text-black dark:text-white">{bucketLabels[bucket]}</span>
            <span className="text-xs text-black/50 dark:text-white/50 font-bold">
              ({sortedItems.length} archivos)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Botón Agregar Video — solo visible cuando el tab Videos está activo y el usuario es admin */}
            {bucket === "videos" && canUpload && token && (
              <VideoUploadButton
                token={token}
                onUploadStart={handleUploadStart}
                onUploadProgress={handleUploadProgress}
                onUploadComplete={handleUploadComplete}
                onUploadError={handleUploadError}
              />
            )}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-black/50 dark:text-white/50 font-bold">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                Cargando...
              </div>
            )}
          </div>
        </div>

        {/* Barra de progreso de subida */}
        {uploading && <UploadProgressBar progress={uploadProgress} />}

        {/* Error de subida */}
        {uploadError && (
          <div className="px-5 py-3 text-sm text-danger font-bold bg-danger/10 flex items-center justify-between border-b border-black/5 dark:border-white/10">
            <span>{uploadError}</span>
            <button
              className="ml-4 text-danger font-black"
              onClick={() => setUploadError(null)}
            >
              ✕
            </button>
          </div>
        )}

        {error && (
          <div className="px-5 py-4 text-sm text-danger font-bold bg-danger/10">
            {error}
          </div>
        )}

        {!loading && sortedItems.length === 0 ? (
          <div className="p-10 text-center text-black/50 dark:text-white/50">
            <div className="text-4xl mb-2">📭</div>
            <p className="font-bold">No hay archivos en esta carpeta</p>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {sortedItems.map((item) => {
              const src = item.url.startsWith("http") ? item.url : `${API_BASE}${item.url}`;
              const isBusy = deleting === item.name;
              return (
                <div
                  key={item.url}
                  className={`group rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-white dark:bg-black/20 ${
                    isBusy ? "opacity-60" : "opacity-100"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    className="w-full aspect-square bg-black/5 dark:bg-white/5 flex items-center justify-center overflow-hidden"
                    title="Abrir"
                  >
                    {item.type === "video" ? (
                      <video src={src} className="w-full h-full object-cover" preload="metadata" />
                    ) : item.type === "image" ? (
                      <img
                        src={src}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : item.type === "pdf" ? (
                      <div className="text-center">
                        <div className="text-5xl">📄</div>
                        <div className="text-[10px] font-bold text-black/50 dark:text-white/50 mt-2 px-3 break-words">
                          PDF
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="text-5xl">📎</div>
                        <div className="text-[10px] font-bold text-black/50 dark:text-white/50 mt-2 px-3 break-words">
                          Archivo
                        </div>
                      </div>
                    )}
                  </button>

                  <div className="p-3 flex flex-col gap-2">
                    <div className="min-h-[32px]">
                      <p className="text-[11px] font-bold text-black dark:text-white break-words line-clamp-2">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-black/50 dark:text-white/50 font-bold">
                        {formatBytes(item.size)}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="flat"
                        className="flex-1 bg-black/5 dark:bg-white/5 text-black dark:text-white font-bold text-[11px]"
                        onClick={() => onOpen(item)}
                      >
                        Ver
                      </Button>
                      <Button
                        size="sm"
                        variant="flat"
                        className="bg-danger/10 text-danger font-black text-[11px]"
                        onClick={() => onDelete(item)}
                        isDisabled={isBusy}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
