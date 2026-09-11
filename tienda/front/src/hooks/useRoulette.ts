import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { RaffleEvent, Participant, DrawResult, Segment, AdminTab } from "../types/roulette";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

// ─── Colors ───────────────────────────────────────────────────────────────────
export const COLORS = [
  "#6366f1", "#ec4899", "#f97316", "#22c55e", "#3b82f6",
  "#eab308", "#8b5cf6", "#f43f5e", "#14b8a6", "#06b6d4",
  "#84cc16", "#f472b6", "#fb923c", "#34d399", "#60a5fa",
];

// ─── Wheel geometry ───────────────────────────────────────────────────────────
export const CX = 220;
export const CY = 220;
export const R = 195;

export function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function slicePath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polarToCartesian(cx, cy, r, start);
  const e = polarToCartesian(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)} Z`;
}

export function buildSegments(participants: Participant[]): Segment[] {
  const n = participants.length;
  if (n === 0) return [];
  const span = 360 / n;
  return participants.map((p, i) => ({
    ...p,
    startAngle: -90 + i * span,
    endAngle: -90 + (i + 1) * span,
    midAngle: -90 + (i + 0.5) * span,
    color: COLORS[i % COLORS.length],
  }));
}

export const PART_PER_PAGE = 10;

export function useRoulette(isDashboardView: boolean) {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  // ── Shared state
  const [event, setEvent] = useState<RaffleEvent | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Client state
  const [isRegistered, setIsRegistered] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState("");
  const [viewEventId, setViewEventId] = useState<number | null>(null);

  // ── Admin state
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState<AdminTab>("participantes");
  const [allEvents, setAllEvents] = useState<RaffleEvent[]>([]);
  const [editForm, setEditForm] = useState<Partial<RaffleEvent>>({
    title: "",
    prize: "",
    description: "",
    is_active: true,
  });
  const [savingEvent, setSavingEvent] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);

  // ── Wheel / spin state
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<DrawResult["winner"] | null>(null);
  const [showWinner, setShowWinner] = useState(false);
  const accRotRef = useRef(0);
  const wheelRef = useRef<SVGGElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const segments = buildSegments(participants);
  const [partPage, setPartPage] = useState(1);
  const partTotalPages = Math.ceil(participants.length / PART_PER_PAGE) || 1;
  const paginatedParticipants = useMemo(() => {
    const start = (partPage - 1) * PART_PER_PAGE;
    return participants.slice(start, start + PART_PER_PAGE);
  }, [participants, partPage]);

  // ── Fetch helpers ─────────────────────────────────────────────────────────
  const fetchEventData = useCallback(async () => {
    try {
      const url = viewEventId
        ? `${API_URL}/raffle/events/${viewEventId}`
        : `${API_URL}/raffle/active`;
      const res = await fetch(url);
      const data = await res.json();
      setEvent(data ?? null);
    } catch {
      setEvent(null);
    }
  }, [viewEventId]);

  const fetchParticipants = useCallback(async () => {
    try {
      const url = viewEventId
        ? `${API_URL}/raffle/events/${viewEventId}/participants`
        : `${API_URL}/raffle/participants`;
      const res = await fetch(url);
      if (res.ok) {
        const data: Participant[] = await res.json();
        setParticipants(data);
        if (user) {
          setIsRegistered(data.some((p) => String(p.user_id) === user.id));
        }
      }
    } catch {
      /* ignore */
    }
  }, [user, viewEventId]);

  const fetchAdminEvents = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/raffle/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAllEvents(await res.json());
    } catch {
      /* ignore */
    }
  }, [token]);

  // ── Initial load & view change ───────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchEventData(), fetchParticipants()]).finally(() =>
      setLoading(false),
    );
  }, [fetchEventData, fetchParticipants]);

  // ── Auto-open admin panel in dashboard view
  useEffect(() => {
    if (isDashboardView && isAdmin && !showAdminPanel) {
      openAdminPanel();
    }
  }, [isDashboardView, isAdmin]);

  // ── Poll for winner (client view) ─────────────────────────────────────────
  useEffect(() => {
    if (isAdmin) return;

    pollRef.current = setInterval(async () => {
      const res = await fetch(`${API_URL}/raffle/active`).catch(() => null);
      if (!res?.ok) return;
      const data: RaffleEvent | null = await res.json().catch(() => null);
      if (data?.winner_id && !showWinner) {
        setEvent(data);
        const winnerParticipant = participants.find((p) => p.id === data.winner_id);
        if (winnerParticipant) {
          setWinner({
            id: winnerParticipant.id,
            name: data.winner_name ?? winnerParticipant.name,
            phone: data.winner_phone ?? winnerParticipant.phone ?? "",
          });
          setShowWinner(true);
          clearInterval(pollRef.current!);
        }
      }
    }, 4000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isAdmin, showWinner, participants]);

  // ── Register ──────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!token) {
      navigate("/login");
      return;
    }
    setRegistering(true);
    setRegError("");
    try {
      const res = await fetch(`${API_URL}/raffle/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: user?.full_name, phone: (user as any)?.phone }),
      });
      if (res.status === 409) {
        setIsRegistered(true);
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setRegError(err.error ?? "Error al registrarse");
        return;
      }
      setIsRegistered(true);
      fetchParticipants();
    } finally {
      setRegistering(false);
    }
  };

  // ── Admin: Draw ───────────────────────────────────────────────────────────
  const handleDraw = async () => {
    if (spinning || participants.length < 2) return;
    setSpinning(true);
    setWinner(null);

    try {
      const res = await fetch(`${API_URL}/raffle/draw`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Error al girar");
        return;
      }
      const data: DrawResult = await res.json();

      const seg = segments[data.index];
      const prevMod = accRotRef.current % 360;
      const targetMod = (((-90 - seg.midAngle) % 360) + 360) % 360;
      const diff = (targetMod - prevMod + 360) % 360;
      const newRot = accRotRef.current + diff + 360 * 6;
      accRotRef.current = newRot;

      if (wheelRef.current) {
        wheelRef.current.style.transition = "transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)";
        wheelRef.current.style.transform = `rotate(${newRot}deg)`;
        wheelRef.current.style.transformOrigin = `${CX}px ${CY}px`;
      }

      setTimeout(() => {
        setWinner(data.winner);
        setShowWinner(true);
        setSpinning(false);
        fetchEventData();
        fetchParticipants();
      }, 5300);
    } catch {
      setSpinning(false);
    }
  };

  // ── Admin: Save event ─────────────────────────────────────────────────────
  const handleSaveEvent = async () => {
    if (!editForm.title?.trim() || !editForm.prize?.trim() || !token) return;
    setSavingEvent(true);
    try {
      const isNew = !editForm.id;
      const url = isNew
        ? `${API_URL}/raffle/events`
        : `${API_URL}/raffle/events/${editForm.id}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setShowEventForm(false);
        setEditForm({ title: "", prize: "", description: "", is_active: true });
        fetchAdminEvents();
        fetchEventData();
        fetchParticipants();
      }
    } finally {
      setSavingEvent(false);
    }
  };

  const handleResetRaffle = async (id: number) => {
    if (!token || !confirm("¿Reiniciar la ruleta? Esto borrará el ganador y todos los participantes."))
      return;
    await fetch(`${API_URL}/raffle/events/${id}/reset`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchEventData();
    fetchParticipants();
    setWinner(null);
    setShowWinner(false);
    accRotRef.current = 0;
    if (wheelRef.current) {
      wheelRef.current.style.transition = "none";
      wheelRef.current.style.transform = "rotate(0deg)";
    }
  };

  const handleRemoveParticipant = async (id: number) => {
    if (!token) return;
    await fetch(`${API_URL}/raffle/participants/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchParticipants();
  };

  // ── Open admin panel ──────────────────────────────────────────────────────
  const openAdminPanel = () => {
    setShowAdminPanel(true);
    fetchAdminEvents();
  };

  return {
    // Auth & navigation
    user,
    token,
    isAdmin,
    navigate,

    // Shared state
    event,
    participants,
    loading,
    segments,

    // Client state
    isRegistered,
    registering,
    regError,

    // Admin state
    showAdminPanel,
    setShowAdminPanel,
    adminTab,
    setAdminTab,
    allEvents,
    editForm,
    setEditForm,
    savingEvent,
    showEventForm,
    setShowEventForm,
    viewEventId,
    setViewEventId,

    // Wheel/spin state
    spinning,
    winner,
    showWinner,
    setShowWinner,
    accRotRef,
    wheelRef,

    // Pagination
    partPage,
    setPartPage,
    partTotalPages,
    paginatedParticipants,

    // Handlers
    handleRegister,
    handleDraw,
    handleSaveEvent,
    handleResetRaffle,
    handleRemoveParticipant,
    openAdminPanel,
    fetchAdminEvents,
    fetchParticipants,
    fetchEventData,
  };
}
