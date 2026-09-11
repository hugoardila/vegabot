import React, { useRef, useState, useEffect } from "react";
import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Play, Pause, VolumeX, Volume2, Trash2, Plus, ChevronLeft, ChevronRight, Grid3x3 } from "lucide-react";
import { adminService } from "../../services/admin";
import { VideoSelectorModal } from "./VideoSelectorModal";

interface HeroBannerProps {
  escena1Url: string | null;
  escena2Url: string | null;
  isAdmin: boolean;
  token: string | null;
  onRefresh: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  escena1Url,
  escena2Url,
  isAdmin,
  token,
  onRefresh,
}) => {
  const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8080/api").replace("/api", "");
  
  // Parse URLs como arrays
  const parseVideos = (urlString: string | null): string[] => {
    if (!urlString) return [];
    try {
      const parsed = JSON.parse(urlString);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : (parsed ? [parsed] : []);
    } catch {
      return urlString ? [urlString] : [];
    }
  };

  const [escena1Videos, setEscena1Videos] = useState<string[]>(() => parseVideos(escena1Url));
  const [escena2Videos, setEscena2Videos] = useState<string[]>(() => parseVideos(escena2Url));
  
  const [currentIndex1, setCurrentIndex1] = useState(0);
  const [currentIndex2, setCurrentIndex2] = useState(0);
  
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [activeScene, setActiveScene] = useState<1 | 2>(1);

  // Video Controls State
  const [isPlaying1, setIsPlaying1] = useState(false);
  const [isMuted1, setIsMuted1] = useState(true);
  const [isPlaying2, setIsPlaying2] = useState(false);
  const [isMuted2, setIsMuted2] = useState(true);

  const videoRef1 = useRef<HTMLVideoElement>(null);
  const videoRef2 = useRef<HTMLVideoElement>(null);

  // Update videos when props change
  useEffect(() => {
    setEscena1Videos(parseVideos(escena1Url));
    setEscena2Videos(parseVideos(escena2Url));
  }, [escena1Url, escena2Url]);

  useEffect(() => {
    setIsMuted1(true);
    setIsMuted2(true);

    const startPlayback = (
      video: HTMLVideoElement | null,
      setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>,
    ) => {
      if (!video) return;
      video.muted = true;
      video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    };

    const frame = window.requestAnimationFrame(() => {
      startPlayback(videoRef1.current, setIsPlaying1);
      startPlayback(videoRef2.current, setIsPlaying2);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentIndex1, currentIndex2, escena1Videos, escena2Videos]);

  // Construir URLs finales
  const getFinalUrl = (url: string) => {
    if (!url) return "";
    return url.startsWith("/") ? API_BASE + url : url;
  };

  // ── Controls for Video 1 ────────────────────────────────────────
  const togglePlay1 = () => {
    if (!videoRef1.current) return;
    if (!videoRef1.current.paused) {
      videoRef1.current.pause();
      setIsPlaying1(false);
    } else {
      videoRef1.current.play().catch(() => {});
      setIsPlaying1(true);
    }
  };
  const toggleMute1 = () => setIsMuted1((prev) => !prev);
  const handleVideoEnded1 = () => setIsPlaying1(false);

  const nextVideo1 = () => {
    if (escena1Videos.length > 1) {
      setCurrentIndex1((prev) => (prev + 1) % escena1Videos.length);
      setIsPlaying1(false);
    }
  };

  const prevVideo1 = () => {
    if (escena1Videos.length > 1) {
      setCurrentIndex1((prev) => (prev - 1 + escena1Videos.length) % escena1Videos.length);
      setIsPlaying1(false);
    }
  };

  // ── Controls for Video 2 ────────────────────────────────────────
  const togglePlay2 = () => {
    if (!videoRef2.current) return;
    if (!videoRef2.current.paused) {
      videoRef2.current.pause();
      setIsPlaying2(false);
    } else {
      videoRef2.current.play().catch(() => {});
      setIsPlaying2(true);
    }
  };
  const toggleMute2 = () => setIsMuted2((prev) => !prev);
  const handleVideoEnded2 = () => setIsPlaying2(false);

  const nextVideo2 = () => {
    if (escena2Videos.length > 1) {
      setCurrentIndex2((prev) => (prev + 1) % escena2Videos.length);
      setIsPlaying2(false);
    }
  };

  const prevVideo2 = () => {
    if (escena2Videos.length > 1) {
      setCurrentIndex2((prev) => (prev - 1 + escena2Videos.length) % escena2Videos.length);
      setIsPlaying2(false);
    }
  };

  // ── Admin Actions ───────────────────────────────────────────────
  const handleAddVideo = async (videoUrl: string) => {
    if (!token) return;
    try {
      const videos = activeScene === 1 ? escena1Videos : escena2Videos;
      
      if (videos.length >= 5) {
        alert("Máximo 5 videos por escena");
        return;
      }

      const newVideos = [...videos, videoUrl];
      const settingKey = activeScene === 1 ? 'escena_1_url' : 'escena_2_url';
      await adminService.updateSettings({ [settingKey]: JSON.stringify(newVideos) }, token);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Error al agregar el video.");
    }
  };

  const handleDeleteVideo = async (scene: 1 | 2, index: number) => {
    if (!token) return;
    if (!window.confirm(`¿Eliminar este video?`)) return;
    
    try {
      const videos = scene === 1 ? escena1Videos : escena2Videos;
      const newVideos = videos.filter((_, i) => i !== index);
      const settingKey = scene === 1 ? 'escena_1_url' : 'escena_2_url';
      await adminService.updateSettings({ [settingKey]: JSON.stringify(newVideos) }, token);
      
      // Ajustar índice actual si es necesario
      if (scene === 1 && currentIndex1 >= newVideos.length && newVideos.length > 0) {
        setCurrentIndex1(newVideos.length - 1);
      }
      if (scene === 2 && currentIndex2 >= newVideos.length && newVideos.length > 0) {
        setCurrentIndex2(newVideos.length - 1);
      }
      
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("Error eliminando el video.");
    }
  };

  const openManageModal = (scene: 1 | 2) => {
    setActiveScene(scene);
    setShowManageModal(true);
  };

  const openAddVideoModal = (scene: 1 | 2) => {
    setActiveScene(scene);
    setShowVideoModal(true);
  };

  // Render Scene
  const renderScene = (
    sceneNum: 1 | 2,
    videos: string[],
    currentIndex: number,
    videoRef: React.RefObject<HTMLVideoElement>,
    isPlaying: boolean,
    isMuted: boolean,
    togglePlay: () => void,
    toggleMute: () => void,
    handleVideoEnded: () => void,
    nextVideo: () => void,
    prevVideo: () => void
  ) => {
    const currentVideo = videos[currentIndex];
    const finalUrl = currentVideo ? getFinalUrl(currentVideo) : "";

    return (
      <div className="relative rounded-2xl overflow-hidden shadow-xl bg-black/5 dark:bg-white/5 hover:ring-2 hover:ring-primary/20 transition-all">
        {finalUrl ? (
          <>
            <video
              key={finalUrl}
              ref={videoRef}
              src={finalUrl}
              autoPlay
              loop={videos.length === 1}
              muted={isMuted}
              playsInline
              preload="auto"
              onEnded={() => {
                if (videos.length > 1) nextVideo();
                else handleVideoEnded();
              }}
              onPlay={() => sceneNum === 1 ? setIsPlaying1(true) : setIsPlaying2(true)}
              onPause={() => sceneNum === 1 ? setIsPlaying1(false) : setIsPlaying2(false)}
              className="w-full h-full object-cover opacity-90"
            />
            
            {/* Controles */}
            <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4 z-30 flex items-center gap-1 md:gap-2">
              <button onClick={togglePlay} className="size-8 md:size-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 transition-all active:scale-90" title={isPlaying ? "Pausar" : "Reproducir"}>
                {isPlaying ? <Pause size={14} className="md:w-[18px] md:h-[18px]" fill="currentColor" /> : <Play size={14} className="md:w-[18px] md:h-[18px] ml-0.5" fill="currentColor" />}
              </button>
              <button onClick={toggleMute} className="size-8 md:size-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 transition-all active:scale-90" title={isMuted ? "Activar Sonido" : "Silenciar"}>
                {isMuted ? <VolumeX size={14} className="md:w-[18px] md:h-[18px]" /> : <Volume2 size={14} className="md:w-[18px] md:h-[18px]" />}
              </button>
            </div>

            {/* Navegación de videos */}
            {videos.length > 1 && (
              <>
                <button onClick={prevVideo} className="absolute left-2 top-1/2 -translate-y-1/2 z-30 size-8 md:size-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 transition-all active:scale-90">
                  <ChevronLeft size={16} className="md:w-[20px] md:h-[20px]" />
                </button>
                <button onClick={nextVideo} className="absolute right-2 top-1/2 -translate-y-1/2 z-30 size-8 md:size-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 transition-all active:scale-90">
                  <ChevronRight size={16} className="md:w-[20px] md:h-[20px]" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full">
                  <span className="text-white text-[10px] md:text-xs font-bold">{currentIndex + 1} / {videos.length}</span>
                </div>
              </>
            )}

            {/* Admin Controls */}
            {isAdmin && (
              <div className="absolute top-2 right-2 md:top-3 md:right-3 z-40 flex items-center gap-1 md:gap-2">
                <Button isIconOnly size="sm" color="secondary" variant="shadow" onPress={() => openManageModal(sceneNum)} className="backdrop-blur-md min-w-6 w-6 h-6 md:min-w-8 md:w-8 md:h-8" title="Gestionar videos">
                  <Grid3x3 size={12} className="md:w-[14px] md:h-[14px]" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-black/30 dark:text-white/30 border-2 border-dashed border-black/10 dark:border-white/10 rounded-2xl">
            <p className="text-sm md:text-lg font-bold mb-1 md:mb-2">Escena {sceneNum}</p>
            {isAdmin ? (
              <Button size="sm" color="primary" variant="shadow" startContent={<Plus size={12} className="md:w-[14px] md:h-[14px]" />} onPress={() => openAddVideoModal(sceneNum)} className="font-bold text-xs h-6 md:h-8">
                <span className="hidden md:inline">Agregar Video</span>
                <span className="md:hidden">+</span>
              </Button>
            ) : (
              <p className="text-xs md:text-sm opacity-70">Sin video</p>
            )}
          </div>
        )}
      </div>
    );
  };

  const hasAnyVideo = escena1Videos.length > 0 || escena2Videos.length > 0;
  if (!hasAnyVideo && !isAdmin) return null;

  return (
    <>
      <div className="relative w-full mb-6">
        <div className="w-full h-[300px] md:h-[400px] lg:h-[450px] grid grid-cols-2 gap-2 md:gap-4">
          {renderScene(1, escena1Videos, currentIndex1, videoRef1, isPlaying1, isMuted1, togglePlay1, toggleMute1, handleVideoEnded1, nextVideo1, prevVideo1)}
          {renderScene(2, escena2Videos, currentIndex2, videoRef2, isPlaying2, isMuted2, togglePlay2, toggleMute2, handleVideoEnded2, nextVideo2, prevVideo2)}
        </div>
      </div>

      {/* Video Selector Modal */}
      {token && (
        <VideoSelectorModal isOpen={showVideoModal} onClose={() => setShowVideoModal(false)} onSelectVideo={handleAddVideo} token={token} />
      )}

      {/* Manage Videos Modal */}
      {token && isAdmin && (
        <Modal isOpen={showManageModal} onOpenChange={setShowManageModal} placement="center" backdrop="blur" size="2xl">
          <ModalContent className="dark:bg-[#0a0a0a] bg-white">
            <ModalHeader className="border-b border-black/10 dark:border-white/10">
              <span className="font-bold">Gestionar Escena {activeScene}</span>
            </ModalHeader>
            <ModalBody className="py-6">
              <div className="grid grid-cols-1 gap-3">
                {(activeScene === 1 ? escena1Videos : escena2Videos).map((video, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10">
                    <div className="flex-1 flex items-center gap-3">
                      <span className="text-sm font-bold opacity-60">#{index + 1}</span>
                      <span className="text-xs truncate flex-1">{video.split('/').pop()}</span>
                    </div>
                    <Button isIconOnly size="sm" color="danger" variant="flat" onPress={() => handleDeleteVideo(activeScene, index)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                {(activeScene === 1 ? escena1Videos : escena2Videos).length < 5 && (
                  <Button color="primary" variant="flat" startContent={<Plus size={16} />} onPress={() => { setShowManageModal(false); openAddVideoModal(activeScene); }} className="font-bold">
                    Agregar video ({(activeScene === 1 ? escena1Videos : escena2Videos).length}/5)
                  </Button>
                )}
              </div>
            </ModalBody>
            <ModalFooter className="border-t border-black/10 dark:border-white/10">
              <Button onPress={() => setShowManageModal(false)} className="font-bold">Cerrar</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </>
  );
};
