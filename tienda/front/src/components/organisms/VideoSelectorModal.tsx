import React, { useEffect, useState } from "react";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { adminService } from "../../services/admin";
import { API_URL } from "../../config/api";
import { VideoUploadButton } from "./VideoUploadButton";

type UploadItem = {
  name: string;
  url: string;
  type: "image" | "video" | "pdf" | "file";
  size?: number;
  modified?: number;
};

interface VideoSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo: (videoUrl: string) => void;
  token: string;
}

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

export const VideoSelectorModal: React.FC<VideoSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectVideo,
  token,
}) => {
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState<UploadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminService.listUploads("videos", token);
      const allFiles = (res?.files as UploadItem[]) || [];
      const videoFiles = allFiles
        .filter((f) => f.type === "video")
        .sort((a, b) => (b.modified || 0) - (a.modified || 0));
      setVideos(videoFiles);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar la lista de videos");
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadVideos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSelect = () => {
    if (selectedVideo) {
      onSelectVideo(selectedVideo);
      onClose();
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
    loadVideos();
  };

  const handleUploadError = (errorMsg: string) => {
    setUploading(false);
    setUploadProgress(0);
    setUploadError(errorMsg);
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onClose}
      size="5xl"
      scrollBehavior="inside"
      className="dark:bg-[#0a0a0a] bg-white"
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="border-b border-black/5 dark:border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-black dark:text-white">
                  Seleccionar Video
                </h3>
                <p className="text-xs text-black/50 dark:text-white/50 font-normal mt-1">
                  Elige un video de la biblioteca o sube uno nuevo
                </p>
              </div>
              <VideoUploadButton
                token={token}
                onUploadStart={handleUploadStart}
                onUploadProgress={handleUploadProgress}
                onUploadComplete={handleUploadComplete}
                onUploadError={handleUploadError}
              />
            </ModalHeader>

            <ModalBody className="py-6">
              {/* Barra de progreso */}
              {uploading && (
                <div className="mb-4 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-black/70 dark:text-white/70">
                      Subiendo video...
                    </span>
                    <span className="text-sm font-black text-primary">
                      {uploadProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error de subida */}
              {uploadError && (
                <div className="mb-4 p-4 bg-danger/10 rounded-2xl border border-danger/20 flex items-center justify-between">
                  <span className="text-sm font-bold text-danger">
                    {uploadError}
                  </span>
                  <button
                    className="text-danger font-black"
                    onClick={() => setUploadError(null)}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-3 text-sm font-bold text-black/50 dark:text-white/50">
                    Cargando videos...
                  </span>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-4 bg-danger/10 rounded-2xl border border-danger/20">
                  <p className="text-sm font-bold text-danger">{error}</p>
                </div>
              )}

              {/* Videos Grid */}
              {!loading && !error && videos.length === 0 && (
                <div className="py-12 text-center">
                  <div className="text-6xl mb-4">📹</div>
                  <p className="text-black/50 dark:text-white/50 font-bold">
                    No hay videos disponibles
                  </p>
                  <p className="text-xs text-black/40 dark:text-white/40 mt-1">
                    Sube tu primer video usando el botón de arriba
                  </p>
                </div>
              )}

              {!loading && videos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {videos.map((video) => {
                    const src = video.url.startsWith("http")
                      ? video.url
                      : `${API_BASE}${video.url}`;
                    const isSelected = selectedVideo === video.url;

                    return (
                      <button
                        key={video.url}
                        onClick={() => setSelectedVideo(video.url)}
                        className={`group relative rounded-2xl overflow-hidden border-2 transition-all ${
                          isSelected
                            ? "border-primary ring-4 ring-primary/20 scale-[0.98]"
                            : "border-black/10 dark:border-white/10 hover:border-primary/50"
                        }`}
                      >
                        <div className="aspect-video bg-black/5 dark:bg-white/5 flex items-center justify-center overflow-hidden">
                          <video
                            src={src}
                            className="w-full h-full object-cover"
                            preload="metadata"
                            muted
                            playsInline
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <div className="size-12 rounded-full bg-primary text-white flex items-center justify-center font-black text-2xl">
                                ✓
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="p-2 bg-white dark:bg-black/20">
                          <p className="text-[10px] font-bold text-black dark:text-white truncate">
                            {video.name}
                          </p>
                          <p className="text-[9px] text-black/50 dark:text-white/50 font-bold">
                            {formatBytes(video.size)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ModalBody>

            <ModalFooter className="border-t border-black/5 dark:border-white/10">
              <Button
                variant="flat"
                className="bg-black/5 dark:bg-white/5 text-black dark:text-white font-bold"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                color="primary"
                variant="shadow"
                className="font-bold"
                onClick={handleSelect}
                isDisabled={!selectedVideo}
              >
                Seleccionar Video
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
