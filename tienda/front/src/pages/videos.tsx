import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@heroui/button";
import { Pagination } from "@heroui/pagination";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { useAuth } from "../context/AuthContext";
import { adminService } from "../services/admin";
import { API_URL } from "../config/api";
import { usePagination } from "../hooks/usePagination";

type UploadItem = {
  name: string;
  url: string;
  type: "image" | "video" | "pdf" | "file";
  size?: number;
  modified?: number;
};

const API_BASE = API_URL.replace("/api", "");

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

export default function VideosPage() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<UploadItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canDelete = user?.role === "admin" || user?.role === "super_admin";
  const canUpload = user?.role === "admin" || user?.role === "super_admin";

  const videos = useMemo(() => {
    return items
      .filter((x) => x.type === "video")
      .sort((a, b) => (b.modified || 0) - (a.modified || 0));
  }, [items]);

  const {
    currentPage,
    setCurrentPage,
    pages,
    paginatedItems: paginatedVideos,
  } = usePagination(videos, 20, [videos]);

  const getPublicUrl = (item: UploadItem) =>
    item.url.startsWith("http") ? item.url : `${API_BASE}${item.url}`;

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminService.listUploads("videos", token);
      setItems((res?.files as UploadItem[]) || []);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar la lista");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onOpen = (item: UploadItem) => {
    setPreviewItem(item);
  };

  const onDelete = async (item: UploadItem) => {
    if (!token || !canDelete) return;
    const ok = window.confirm(`¿Eliminar este video?\n\n${item.name}`);
    if (!ok) return;
    setDeleting(item.name);
    try {
      await adminService.deleteUpload("videos", item.name, token);
      setItems((prev) => prev.filter((x) => x.name !== item.name));
      if (previewItem?.name === item.name) setPreviewItem(null);
    } catch (e: any) {
      alert(e?.message || "No se pudo eliminar");
    } finally {
      setDeleting(null);
    }
  };

  const onUploadClick = () => {
    fileInputRef.current?.click();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    // Reset input so same file can be re-selected
    e.target.value = "";

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    // Simulate progress while uploading (XHR for real progress)
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };
    xhr.onload = async () => {
      setUploading(false);
      setUploadProgress(0);
      if (xhr.status >= 200 && xhr.status < 300) {
        await refresh();
      } else {
        try {
          const body = JSON.parse(xhr.responseText);
          setUploadError(body.error || "Error al subir el video");
        } catch {
          setUploadError("Error al subir el video");
        }
      }
    };
    xhr.onerror = () => {
      setUploading(false);
      setUploadProgress(0);
      setUploadError("Error de red al subir el video");
    };

    const formData = new FormData();
    formData.append("video", file);
    xhr.open("POST", `${API_URL}/upload_video`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-black dark:text-white">
            Videos
          </h2>
          <p className="text-sm text-black/50 dark:text-white/50 font-medium"></p>
        </div>

        <div className="flex gap-2">
          {canUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={onFileSelected}
              />
              <Button
                size="sm"
                variant="shadow"
                className="bg-primary text-white font-bold"
                onClick={onUploadClick}
                isDisabled={uploading}
              >
                {uploading ? `Subiendo ${uploadProgress}%` : "＋ Agregar Video"}
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="flat"
            className="bg-black/5 dark:bg-white/5 text-black dark:text-white font-bold"
            onClick={refresh}
            isDisabled={loading || uploading}
          >
            ↻ Actualizar
          </Button>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-black text-black dark:text-white">🎬 Videos</span>
            <span className="text-xs text-black/50 dark:text-white/50 font-bold">
              ({videos.length})
            </span>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-xs text-black/50 dark:text-white/50 font-bold">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              Cargando...
            </div>
          )}
        </div>

        {uploadError && (
          <div className="px-5 py-3 text-sm text-danger font-bold bg-danger/10 flex items-center justify-between">
            <span>{uploadError}</span>
            <button
              className="ml-4 text-danger font-black"
              onClick={() => setUploadError(null)}
            >
              ✕
            </button>
          </div>
        )}

        {uploading && (
          <div className="px-5 py-3 bg-primary/5 border-b border-black/5 dark:border-white/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-black/70 dark:text-white/70">
                Subiendo video...
              </span>
              <span className="text-xs font-black text-primary">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="px-5 py-4 text-sm text-danger font-bold bg-danger/10">
            {error}
          </div>
        )}

        {!loading && videos.length === 0 ? (
          <div className="p-10 text-center text-black/50 dark:text-white/50">
            <div className="text-4xl mb-2">📭</div>
            <p className="font-bold">No hay videos</p>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {paginatedVideos.map((item) => {
              const src = getPublicUrl(item);
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
                    title="Ver"
                  >
                    <div className="relative w-full h-full">
                      <video
                        src={src}
                        className="w-full h-full object-cover"
                        preload="metadata"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="opacity-90 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-full w-12 h-12 flex items-center justify-center">
                          ▶
                        </div>
                      </div>
                    </div>
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
                        className={`${canDelete ? "flex-1" : "w-full"} bg-black/5 dark:bg-white/5 text-black dark:text-white font-bold text-[11px]`}
                        onClick={() => onOpen(item)}
                      >
                        Ver
                      </Button>
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="flat"
                          className="bg-danger/10 text-danger font-black text-[11px]"
                          onClick={() => onDelete(item)}
                          isDisabled={isBusy}
                        >
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {pages > 1 && (
          <div className="flex w-full justify-center p-5 border-t border-black/5 dark:border-white/10">
            <Pagination
              isCompact
              showControls
              color="primary"
              page={currentPage}
              total={pages}
              onChange={setCurrentPage}
              variant="light"
            />
          </div>
        )}
      </div>

      <Modal
        isOpen={!!previewItem}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null);
        }}
        backdrop="opaque"
        size="3xl"
        scrollBehavior="inside"
        className="dark:bg-[#0a0a0a] bg-white"
      >
        <ModalContent>
          {() => {
            const item = previewItem;
            if (!item) return null;
            const src = getPublicUrl(item);
            return (
              <>
                <ModalHeader className="border-b border-black/5 dark:border-white/10">
                  <div className="min-w-0">
                    <p className="font-black text-black dark:text-white truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-black/50 dark:text-white/50 font-bold">
                      {item.size != null ? formatBytes(item.size) : ""}
                    </p>
                  </div>
                </ModalHeader>
                <ModalBody className="py-4">
                  <div className="w-full aspect-[9/16] sm:aspect-video bg-black rounded-2xl overflow-hidden border border-black/10 dark:border-white/10">
                    <video
                      src={src}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-xs text-black/50 dark:text-white/50 font-medium mt-3">
                    En celular se muestra en 9:16; en PC/tablet en 16:9. Sin estirar ni recortar.
                  </p>
                </ModalBody>
                <ModalFooter className="border-t border-black/5 dark:border-white/10 flex gap-2">
                  <Button
                    variant="flat"
                    className="flex-1 bg-black/5 dark:bg-white/5 text-black dark:text-white font-bold"
                    onClick={() => window.open(src, "_blank", "noopener,noreferrer")}
                  >
                    Abrir en pestaña
                  </Button>
                  <Button
                    variant="flat"
                    className="flex-1 bg-primary text-white font-black"
                    onClick={() => setPreviewItem(null)}
                  >
                    Cerrar
                  </Button>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </div>
  );
}

