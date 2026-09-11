import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/auth";

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, updateUser, isAuthenticated, logout } = useAuth();
  
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: "", phone: "", email: "", password: "", id_number: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: "", text: "" });


  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (user) {
      setProfileForm({
        full_name: user.full_name || "",
        phone: (user as any).phone || "",
        email: user.email || "",
        password: "",
        id_number: (user as any).id_number || "",
      });
      
      // Solo activar modo edición si viene del estado de navegación con autoEdit
      // Esto se establece cuando es un usuario nuevo de Google
      if ((location.state as any)?.autoEdit) {
        setProfileEditing(true);
        // Limpiar el estado para que no se active de nuevo
        window.history.replaceState({}, document.title);
      }
    }
  }, [user, isAuthenticated, navigate, location.state]);

  const executeSaveProfile = async () => {
    if (!token) return;
    setProfileSaving(true);
    setProfileMsg({ type: "", text: "" });
    try {
      const response = await authService.updateProfile(token, profileForm);
      
      // Actualizar el usuario con los datos retornados por el backend
      if ((response as any).user) {
        updateUser((response as any).user);
      } else {
        // Fallback: actualizar con los datos del formulario
        updateUser(profileForm);
      }
      
      setProfileEditing(false);
      setProfileForm(prev => ({ ...prev, password: "" }));
      setProfileMsg({ type: "success", text: "¡Perfil actualizado con éxito! Serás redirigido..." });
      setTimeout(() => {
        setProfileMsg({ type: "", text: "" });
        navigate("/");
      }, 1500);
    } catch (error: any) {
      setProfileMsg({ type: "error", text: error.message || "Error al actualizar" });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveProfile = () => {
    executeSaveProfile();
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 w-full">
      {profileMsg.text && (
        <div className={`mb-4 p-4 rounded-2xl text-center font-bold text-sm ${
          profileMsg.type === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
        }`}>
          {profileMsg.text}
        </div>
      )}
      <div className="bg-white dark:bg-[#0d0d0d] rounded-[2.5rem] border border-black/5 dark:border-white/5 overflow-hidden shadow-2xl shadow-black/5">
        <div className="bg-primary/10 p-8 border-b border-black/5 dark:border-white/5 flex flex-col items-center relative">
          {!profileEditing && (
            <button
              className="absolute right-6 top-6 bg-primary text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
              onClick={() => setProfileEditing(true)}
            >
              Editar
            </button>
          )}
          <div className="size-24 bg-primary text-white rounded-full flex items-center justify-center text-3xl font-bold shadow-xl shadow-primary/30 mb-4 ring-8 ring-primary/5">
            {user?.full_name?.charAt(0) || "U"}
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{user?.full_name || "Usuario"}</h2>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 text-success text-[10px] font-bold uppercase tracking-widest">
              <div className="size-1.5 rounded-full bg-success animate-pulse" />
              Cuenta Activa
            </div>
            <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest ${
              user?.role === "admin" || user?.role === "super_admin" ? "bg-primary/20 text-primary" : "bg-white/5 text-white/50"
            }`}>
              {user?.role === "admin" || user?.role === "super_admin" ? "Administrador" : "Cliente"}
            </span>
          </div>
        </div>

        <div className="p-8 grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-2xl border transition-all ${
              profileEditing ? "bg-primary/5 border-primary/20" : "bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5"
            }`}>
              <div className="flex items-center gap-2 mb-2 text-black/40 dark:text-white/40">
                <span>👤</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">Nombre Completo</span>
              </div>
              {profileEditing ? (
                <input
                  className="w-full bg-transparent font-bold text-sm outline-none border-b border-primary/30 pb-1 focus:border-primary transition-colors text-black dark:text-white"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                  placeholder="Ej: Juan Pérez"
                />
              ) : (
                <p className="font-bold text-sm tracking-tight">{user?.full_name || "No especificado"}</p>
              )}
            </div>

            {([
              { label: "Teléfono", key: "phone", icon: "📞" },
              { label: "Correo Electrónico", key: "email", icon: "✉️" },
              { label: "Número de Identificación", key: "id_number", icon: "🆔" },
            ] as const).map((item) => (
              <div key={item.key} className={`p-4 rounded-2xl border transition-all ${
                profileEditing ? "bg-primary/5 border-primary/20" : "bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5"
              }`}>
                <div className="flex items-center gap-2 mb-2 text-black/40 dark:text-white/40">
                  <span>{item.icon}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
                </div>
                {profileEditing ? (
                    <input
                      className="w-full bg-transparent font-bold text-sm outline-none border-b border-primary/30 pb-1 focus:border-primary transition-colors text-black dark:text-white"
                      value={(profileForm as any)[item.key]}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (item.key === "phone" || item.key === "id_number") {
                          val = val.replace(/\D/g, "");
                          // Limitar teléfono a 10 dígitos
                          if (item.key === "phone" && val.length > 10) {
                            val = val.slice(0, 10);
                          }
                        }
                        setProfileForm({ ...profileForm, [item.key]: val });
                      }}
                      placeholder={
                        item.key === "phone" ? "Ej: 3001234567" : 
                        item.key === "email" ? "correo@ejemplo.com" : 
                        item.key === "id_number" ? "Ej: 1234567890" : ""
                      }
                      inputMode={item.key === "phone" || item.key === "id_number" ? "numeric" : undefined}
                      type={item.key === "email" ? "email" : "text"}
                      maxLength={item.key === "phone" ? 10 : undefined}
                    />
                ) : (
                  <p className="font-bold text-sm tracking-tight">
                    {(user as any)?.[item.key] || "No especificado"}
                  </p>
                )}
              </div>
            ))}

            {profileEditing && (
              <div className="p-4 rounded-2xl border bg-primary/5 border-primary/20 transition-all md:col-span-2">
                 <div className="flex items-center gap-2 mb-2 text-black/40 dark:text-white/40">
                  <span>🔒</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Nueva Contraseña (Opcional)</span>
                </div>
                <input
                  className="w-full bg-transparent font-bold text-sm outline-none border-b border-primary/30 pb-1 focus:border-primary transition-colors text-black dark:text-white"
                  placeholder="Deja vacío para no cambiar"
                  type="password"
                  value={profileForm.password}
                  onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                />
              </div>
            )}
          </div>

          {profileEditing ? (
            <div className="flex gap-3">
              <button
                className="flex-grow bg-primary text-white font-bold py-4 rounded-2xl text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
                disabled={profileSaving}
                onClick={handleSaveProfile}
              >
                {profileSaving ? "Guardando..." : "Guardar Cambios"}
              </button>
              <button
                className="bg-black/5 dark:bg-white/5 font-bold py-4 px-6 rounded-2xl text-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                onClick={() => setProfileEditing(false)}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="pt-6 border-t border-black/5 dark:border-white/5 flex justify-end">
              <button
                className="bg-danger/10 text-danger font-bold px-6 py-2 rounded-xl text-sm hover:bg-danger/20 transition-colors"
                onClick={logout}
              >
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default ProfilePage;
