import React, { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { FaFacebookF, FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa6";
import { adminService } from "../../../services/admin";

export interface SocialLinks {
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
  youtube_url: string;
}

interface SocialLinksModalProps {
  isOpen: boolean;
  links: SocialLinks;
  token: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (links: SocialLinks) => void;
}

const SOCIAL_FIELDS = [
  {
    key: "facebook_url" as const,
    label: "Facebook",
    placeholder: "https://facebook.com/vegaimportadora",
    icon: FaFacebookF,
    iconContainerClass: "bg-[#1877F2]/10 text-[#1877F2]",
    iconClass: "",
  },
  {
    key: "instagram_url" as const,
    label: "Instagram",
    placeholder: "https://instagram.com/vegaimportadora",
    icon: FaInstagram,
    iconContainerClass: "bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#FCAF45] text-white",
    iconClass: "",
  },
  {
    key: "tiktok_url" as const,
    label: "TikTok",
    placeholder: "https://tiktok.com/@vegaimportadora",
    icon: FaTiktok,
    iconContainerClass: "bg-black text-white",
    iconClass: "[filter:drop-shadow(-1px_0_0_#25F4EE)_drop-shadow(1px_0_0_#FE2C55)]",
  },
  {
    key: "youtube_url" as const,
    label: "YouTube",
    placeholder: "https://youtube.com/@vegaimportadora",
    icon: FaYoutube,
    iconContainerClass: "bg-[#FF0000] text-white",
    iconClass: "",
  },
];

export const SocialLinksModal: React.FC<SocialLinksModalProps> = ({
  isOpen,
  links,
  token,
  onOpenChange,
  onSaved,
}) => {
  const [form, setForm] = useState<SocialLinks>(links);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(links);
    setError("");
  }, [isOpen, links]);

  const handleSave = async () => {
    if (!token) {
      setError("Tu sesión no está disponible. Inicia sesión nuevamente.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const response = await adminService.updateSettings(
        {
          facebook_url: form.facebook_url,
          instagram_url: form.instagram_url,
          tiktok_url: form.tiktok_url,
          youtube_url: form.youtube_url,
        },
        token,
      );
      const savedLinks: SocialLinks = {
        facebook_url: String(response.facebook_url || ""),
        instagram_url: String(response.instagram_url || ""),
        tiktok_url: String(response.tiktok_url || ""),
        youtube_url: String(response.youtube_url || ""),
      };
      onSaved(savedLinks);
      onOpenChange(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible guardar los enlaces.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      backdrop="opaque"
      className="border border-black/10 bg-white dark:border-white/10 dark:bg-[#0a0a0a]"
      isOpen={isOpen}
      size="md"
      onOpenChange={onOpenChange}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1 text-black dark:text-white">
              Redes sociales
              <span className="text-xs font-normal text-black/50 dark:text-white/50">
                Los iconos públicos abrirán estos perfiles en una pestaña nueva.
              </span>
            </ModalHeader>
            <ModalBody className="gap-3">
              {SOCIAL_FIELDS.map(
                ({ key, label, placeholder, icon: Icon, iconContainerClass, iconClass }) => (
                <Input
                  key={key}
                  label={label}
                  placeholder={placeholder}
                  startContent={
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${iconContainerClass}`}
                    >
                      <Icon className={iconClass} size={15} />
                    </span>
                  }
                  type="url"
                  value={form[key]}
                  variant="bordered"
                  onValueChange={(value) => setForm((current) => ({ ...current, [key]: value }))}
                />
                ),
              )}

              {error && (
                <p className="rounded-md bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
                  {error}
                </p>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button color="primary" isLoading={isSaving} onPress={handleSave}>
                Guardar enlaces
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
