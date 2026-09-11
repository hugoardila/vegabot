import { useRef, useState } from "react";
import { Button } from "@heroui/button";
import { API_URL } from "../../config/api";

interface VideoUploadButtonProps {
  token: string;
  onUploadStart?: () => void;
  onUploadProgress?: (progress: number) => void;
  onUploadComplete?: () => void;
  onUploadError?: (error: string) => void;
}

export const VideoUploadButton: React.FC<VideoUploadButtonProps> = ({
  token,
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onUploadClick = () => {
    fileInputRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    e.target.value = "";

    setUploading(true);
    setUploadProgress(0);
    onUploadStart?.();

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        const progress = Math.round((ev.loaded / ev.total) * 100);
        setUploadProgress(progress);
        onUploadProgress?.(progress);
      }
    };
    xhr.onload = () => {
      setUploading(false);
      setUploadProgress(0);
      if (xhr.status >= 200 && xhr.status < 300) {
        onUploadComplete?.();
      } else {
        try {
          const body = JSON.parse(xhr.responseText);
          onUploadError?.(body.error || "Error al subir el video");
        } catch {
          onUploadError?.("Error al subir el video");
        }
      }
    };
    xhr.onerror = () => {
      setUploading(false);
      setUploadProgress(0);
      onUploadError?.("Error de red al subir el video");
    };

    const formData = new FormData();
    formData.append("video", file);
    xhr.open("POST", `${API_URL}/upload_video`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
  };

  return (
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
  );
};
