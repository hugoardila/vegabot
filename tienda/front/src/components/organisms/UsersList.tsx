import React, { useState, useMemo } from "react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Pagination } from "@heroui/pagination";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { CreateAdminModal } from "./CreateAdminModal";
import { useAuth } from "../../context/AuthContext";
import type { User } from "../../types";

interface UsersListProps {
  users: User[];
  isLoading: boolean;
  onUpdateUser: (id: string, data: { role?: string; status?: boolean; password?: string; email?: string }) => void;
  onCreateAdmin?: (data: { full_name: string; email: string; password: string; phone?: string }) => Promise<void>;
}

const LockIcon = ({ size = 16 }: { size?: number }) => (
  <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const EditIcon = ({ size = 16 }: { size?: number }) => (
  <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const EyeIcon = ({ size = 16 }: { size?: number }) => (
  <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const UsersList: React.FC<UsersListProps> = ({ users, isLoading, onUpdateUser, onCreateAdmin }) => {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === "super_admin";
  
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const itemsPerPage = 10;

  // Password modal state
  const [passwordModal, setPasswordModal] = useState<{ userId: string; userName: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Edit Email modal state
  const [emailModal, setEmailModal] = useState<{ userId: string; userName: string; currentEmail: string } | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState(false);

  // View Details modal state
  const [detailsModal, setDetailsModal] = useState<User | null>(null);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && u.phone.toLowerCase().includes(q)) ||
        (u.id_number && u.id_number.toLowerCase().includes(q))
    );
  }, [users, searchQuery]);

  const pages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage]);

  // Reset to page 1 when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const roleColorMap: Record<string, "primary" | "warning" | "secondary" | "default"> = {
    super_admin: "secondary",
    admin: "primary",
    cliente: "warning",
  };

  const openPasswordModal = (userId: string, userName: string, userRole: string) => {
    // Si el usuario actual es solo admin y está intentando cambiar contraseña de un admin o super_admin, no permitir
    if (!isSuperAdmin && (userRole === "admin" || userRole === "super_admin")) {
      alert("No tienes permisos para cambiar la contraseña de administradores.");
      return;
    }
    
    setPasswordModal({ userId, userName });
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordSuccess(false);
    setShowPassword(false);
  };

  const handleChangePassword = () => {
    setPasswordError("");

    if (newPassword.length < 6) {
      setPasswordError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden.");
      return;
    }

    if (passwordModal) {
      onUpdateUser(passwordModal.userId, { password: newPassword });
      setPasswordSuccess(true);
      setTimeout(() => {
        setPasswordModal(null);
      }, 1500);
    }
  };

  const openEmailModal = (userId: string, userName: string, currentEmail: string, userRole: string) => {
    // Si el usuario actual es solo admin y está intentando editar un admin o super_admin, no permitir
    if (!isSuperAdmin && (userRole === "admin" || userRole === "super_admin")) {
      alert("No tienes permisos para editar el correo de administradores.");
      return;
    }
    
    setEmailModal({ userId, userName, currentEmail });
    setNewEmail(currentEmail || "");
    setEmailError("");
    setEmailSuccess(false);
  };

  const handleChangeEmail = () => {
    setEmailError("");

    if (!newEmail || !newEmail.includes("@")) {
      setEmailError("Ingresa un correo electrónico válido.");
      return;
    }

    if (emailModal) {
      onUpdateUser(emailModal.userId, { email: newEmail });
      setEmailSuccess(true);
      setTimeout(() => {
        setEmailModal(null);
      }, 1500);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-2">
          <div>
            <h2 className="text-2xl font-bold text-black dark:text-white">Gestión de Usuarios</h2>
            <p className="text-xs text-black/40 dark:text-white/40 mt-1">
              {filteredUsers.length} usuario{filteredUsers.length !== 1 ? "s" : ""} registrado{filteredUsers.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30 dark:text-white/30">🔍</span>
              <input
                type="text"
                placeholder="Buscar por nombre, email, teléfono o cédula..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-sm outline-none focus:border-primary/40 transition-colors text-black dark:text-white placeholder:text-black/30 dark:placeholder:text-white/30"
              />
            </div>
            {onCreateAdmin && isSuperAdmin && (
              <Button
                color="primary"
                variant="shadow"
                className="font-bold shrink-0"
                onClick={() => setShowCreateModal(true)}
              >
                ＋ Crear Admin
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-black/5 dark:border-white/5 p-4 shadow-sm">
            <p className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-1">Total</p>
            <p className="text-2xl font-bold text-primary">{users.length}</p>
          </div>
          <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-black/5 dark:border-white/5 p-4 shadow-sm">
            <p className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-1">Admins</p>
            <p className="text-2xl font-bold text-violet-500">{users.filter(u => u.role === "admin").length}</p>
          </div>
          <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-black/5 dark:border-white/5 p-4 shadow-sm">
            <p className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-1">Activos</p>
            <p className="text-2xl font-bold text-success">{users.filter(u => u.status).length}</p>
          </div>
          <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-black/5 dark:border-white/5 p-4 shadow-sm">
            <p className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-1">Inactivos</p>
            <p className="text-2xl font-bold text-danger">{users.filter(u => !u.status).length}</p>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <Table
            aria-label="Tabla de usuarios registrados"
            className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm min-w-[800px]"
            isHeaderSticky
          >
          <TableHeader>
            <TableColumn>NOMBRE</TableColumn>
            <TableColumn>EMAIL</TableColumn>
            <TableColumn>TELÉFONO</TableColumn>
            <TableColumn>ROL</TableColumn>
            <TableColumn>ESTADO</TableColumn>
            <TableColumn>REGISTRO</TableColumn>
            <TableColumn align="center">ACCIONES</TableColumn>
          </TableHeader>
          <TableBody
            emptyContent={"No hay usuarios registrados."}
            isLoading={isLoading}
          >
            {paginatedUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="size-8 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                      {user.full_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-bold truncate max-w-[140px]">{user.full_name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-black/60 dark:text-white/60 truncate block max-w-[160px]">
                    {user.email || "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {user.phone || "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={roleColorMap[user.role] || "default"}
                    className="capitalize font-bold"
                  >
                    {user.role === "super_admin" ? "Super Admin" : user.role === "admin" ? "Admin" : "Cliente"}
                  </Chip>
                </TableCell>
                <TableCell>
                  <Chip
                    className="capitalize border-none gap-1"
                    color={user.status ? "success" : "danger"}
                    size="sm"
                    variant="dot"
                  >
                    {user.status ? "Activo" : "Inactivo"}
                  </Chip>
                </TableCell>
                <TableCell>
                  <p className="text-xs text-black/50 dark:text-white/50">
                    {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </TableCell>
                <TableCell>
                  <div className="relative flex justify-center items-center gap-2">
                    {/* Botón Ver Detalles - solo para clientes */}
                    {user.role === "cliente" && (
                      <Button
                        isIconOnly
                        size="sm"
                        variant="flat"
                        color="secondary"
                        title="Ver detalles"
                        onClick={() => setDetailsModal(user)}
                      >
                        <EyeIcon size={14} />
                      </Button>
                    )}
                    <Button
                      isIconOnly
                      size="sm"
                      variant="flat"
                      color="primary"
                      title={!isSuperAdmin && (user.role === "admin" || user.role === "super_admin") ? "Sin permisos" : "Cambiar email"}
                      onClick={() => openEmailModal(user.id, user.full_name, user.email || "", user.role)}
                      isDisabled={!isSuperAdmin && (user.role === "admin" || user.role === "super_admin")}
                    >
                      <EditIcon size={14} />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="flat"
                      color="warning"
                      title={!isSuperAdmin && (user.role === "admin" || user.role === "super_admin") ? "Sin permisos" : "Cambiar contraseña"}
                      onClick={() => openPasswordModal(user.id, user.full_name, user.role)}
                      isDisabled={!isSuperAdmin && (user.role === "admin" || user.role === "super_admin")}
                    >
                      <LockIcon size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      color={user.status ? "danger" : "success"}
                      className="font-bold"
                      onClick={() => onUpdateUser(user.id, { status: !user.status })}
                      isDisabled={!isSuperAdmin && (user.role === "admin" || user.role === "super_admin")}
                      title={!isSuperAdmin && (user.role === "admin" || user.role === "super_admin") ? "Sin permisos" : undefined}
                    >
                      {user.status ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>

        {pages > 1 && (
          <div className="flex w-full justify-center mt-4 mb-2">
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

      {/* Password Change Modal */}
      <Modal
        isOpen={!!passwordModal}
        onOpenChange={(open) => { if (!open) setPasswordModal(null); }}
        size="md"
        backdrop="blur"
        className="dark:bg-[#0a0a0a] bg-white"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span className="text-xl font-bold">Cambiar Contraseña</span>
                <p className="text-xs font-normal text-black/40 dark:text-white/40">
                  Usuario: {passwordModal?.userName}
                </p>
              </ModalHeader>
              <ModalBody className="pb-2 flex flex-col gap-4">
                {passwordSuccess ? (
                  <div className="p-6 rounded-2xl bg-success/10 text-success text-center">
                    <p className="text-3xl mb-2">✅</p>
                    <p className="font-bold text-sm">¡Contraseña actualizada con éxito!</p>
                  </div>
                ) : (
                  <>
                    {passwordError && (
                      <div className="p-3 rounded-xl bg-danger/10 text-danger text-sm font-bold text-center">
                        {passwordError}
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-2 block">
                        Nueva Contraseña
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="w-full px-4 py-3 pr-12 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-sm outline-none focus:border-primary/40 transition-colors text-black dark:text-white"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white transition-colors text-xs font-bold"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? "🙈" : "👁️"}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-2 block">
                        Confirmar Contraseña
                      </label>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repite la contraseña"
                        className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-sm outline-none focus:border-primary/40 transition-colors text-black dark:text-white"
                      />
                    </div>
                    {newPassword && confirmPassword && (
                      <div className={`text-xs font-bold text-center p-2 rounded-lg ${
                        newPassword === confirmPassword ? "text-success bg-success/10" : "text-danger bg-danger/10"
                      }`}>
                        {newPassword === confirmPassword ? "✓ Las contraseñas coinciden" : "✗ Las contraseñas no coinciden"}
                      </div>
                    )}
                  </>
                )}
              </ModalBody>
              {!passwordSuccess && (
                <ModalFooter className="gap-2">
                  <Button variant="flat" onClick={onClose}>
                    Cancelar
                  </Button>
                  <Button
                    color="primary"
                    className="font-bold"
                    onClick={handleChangePassword}
                    isDisabled={!newPassword || !confirmPassword}
                  >
                    Cambiar Contraseña
                  </Button>
                </ModalFooter>
              )}
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Edit Email Modal */}
      <Modal
        isOpen={!!emailModal}
        onOpenChange={(open) => { if (!open) setEmailModal(null); }}
        size="md"
        backdrop="blur"
        className="dark:bg-[#0a0a0a] bg-white"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span className="text-xl font-bold">Cambiar Correo Electrónico</span>
                <p className="text-xs font-normal text-black/40 dark:text-white/40">
                  Usuario: {emailModal?.userName}
                </p>
              </ModalHeader>
              <ModalBody className="pb-2 flex flex-col gap-4">
                {emailSuccess ? (
                  <div className="p-6 rounded-2xl bg-success/10 text-success text-center">
                    <p className="text-3xl mb-2">✅</p>
                    <p className="font-bold text-sm">¡Correo actualizado con éxito!</p>
                  </div>
                ) : (
                  <>
                    {emailError && (
                      <div className="p-3 rounded-xl bg-danger/10 text-danger text-sm font-bold text-center">
                        {emailError}
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-2 block">
                        Nuevo Correo Electrónico
                      </label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="ejemplo@correo.com"
                        className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-sm outline-none focus:border-primary/40 transition-colors text-black dark:text-white"
                      />
                    </div>
                  </>
                )}
              </ModalBody>
              {!emailSuccess && (
                <ModalFooter className="gap-2">
                  <Button variant="flat" onClick={onClose}>
                    Cancelar
                  </Button>
                  <Button
                    color="primary"
                    className="font-bold"
                    onClick={handleChangeEmail}
                    isDisabled={!newEmail}
                  >
                    Guardar Cambios
                  </Button>
                </ModalFooter>
              )}
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Create Admin Modal */}
      {onCreateAdmin && (
        <CreateAdminModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreateAdmin={onCreateAdmin}
        />
      )}

      {/* View Details Modal - Solo para clientes */}
      <Modal
        isOpen={!!detailsModal}
        onOpenChange={(open) => { if (!open) setDetailsModal(null); }}
        size="2xl"
        backdrop="blur"
        className="dark:bg-[#0a0a0a] bg-white"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 border-b border-black/10 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="size-12 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xl font-bold">
                    {detailsModal?.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-xl font-bold">{detailsModal?.full_name}</span>
                    <p className="text-xs font-normal text-black/40 dark:text-white/40">
                      Detalles del Cliente
                    </p>
                  </div>
                </div>
              </ModalHeader>
              <ModalBody className="py-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Información Personal */}
                  <div className="col-span-1 md:col-span-2">
                    <p className="text-xs uppercase font-bold text-primary mb-3 tracking-widest">
                      Información Personal
                    </p>
                  </div>

                  <div className="bg-black/5 dark:bg-white/5 rounded-xl p-4 border border-black/10 dark:border-white/10">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-2">
                      Nombre Completo
                    </p>
                    <p className="text-sm font-bold text-black dark:text-white">
                      {detailsModal?.full_name || "—"}
                    </p>
                  </div>

                  <div className="bg-black/5 dark:bg-white/5 rounded-xl p-4 border border-black/10 dark:border-white/10">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-2">
                      Correo Electrónico
                    </p>
                    <p className="text-sm font-bold text-black dark:text-white break-all">
                      {detailsModal?.email || "—"}
                    </p>
                  </div>

                  <div className="bg-black/5 dark:bg-white/5 rounded-xl p-4 border border-black/10 dark:border-white/10">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-2">
                      Teléfono
                    </p>
                    <p className="text-sm font-bold text-black dark:text-white">
                      {detailsModal?.phone || "—"}
                    </p>
                  </div>

                  <div className="bg-black/5 dark:bg-white/5 rounded-xl p-4 border border-black/10 dark:border-white/10">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-2">
                      Cédula / ID
                    </p>
                    <p className="text-sm font-bold text-black dark:text-white">
                      {detailsModal?.id_number || "—"}
                    </p>
                  </div>

                  {/* Estado de la Cuenta */}
                  <div className="col-span-1 md:col-span-2 mt-4">
                    <p className="text-xs uppercase font-bold text-primary mb-3 tracking-widest">
                      Estado de la Cuenta
                    </p>
                  </div>

                  <div className="bg-black/5 dark:bg-white/5 rounded-xl p-4 border border-black/10 dark:border-white/10">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-2">
                      Rol
                    </p>
                    <Chip
                      size="sm"
                      variant="flat"
                      color="warning"
                      className="capitalize font-bold"
                    >
                      Cliente
                    </Chip>
                  </div>

                  <div className="bg-black/5 dark:bg-white/5 rounded-xl p-4 border border-black/10 dark:border-white/10">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-2">
                      Estado
                    </p>
                    <Chip
                      className="capitalize border-none gap-1"
                      color={detailsModal?.status ? "success" : "danger"}
                      size="sm"
                      variant="dot"
                    >
                      {detailsModal?.status ? "Activo" : "Inactivo"}
                    </Chip>
                  </div>

                  <div className="bg-black/5 dark:bg-white/5 rounded-xl p-4 border border-black/10 dark:border-white/10">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-2">
                      Fecha de Registro
                    </p>
                    <p className="text-sm font-bold text-black dark:text-white">
                      {detailsModal?.created_at ? new Date(detailsModal.created_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : "—"}
                    </p>
                  </div>

                  <div className="bg-black/5 dark:bg-white/5 rounded-xl p-4 border border-black/10 dark:border-white/10">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-2">
                      Última Actualización
                    </p>
                    <p className="text-sm font-bold text-black dark:text-white">
                      {detailsModal?.updated_at ? new Date(detailsModal.updated_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : "—"}
                    </p>
                  </div>

                  {/* ID del Usuario */}
                  <div className="col-span-1 md:col-span-2 bg-black/5 dark:bg-white/5 rounded-xl p-4 border border-black/10 dark:border-white/10">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-black/40 dark:text-white/40 mb-2">
                      ID del Usuario (Sistema)
                    </p>
                    <p className="text-xs font-mono text-black/60 dark:text-white/60 break-all">
                      {detailsModal?.id || "—"}
                    </p>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className="border-t border-black/10 dark:border-white/10">
                <Button color="primary" variant="flat" onClick={onClose} className="font-bold">
                  Cerrar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};
