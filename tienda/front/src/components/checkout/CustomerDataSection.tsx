import { Input } from "@heroui/input";
import { UserIcon, PhoneIcon } from "../atoms/icons";
import { AddressIcon } from "./CheckoutIcons";
import { DeliveryMethod, CheckoutErrors } from "../../types/checkout";
import { normalizeCheckoutPhone } from "../../utils/phone";

interface CustomerDataSectionProps {
  firstName: string;
  lastName: string;
  phone: string;
  idNumber: string;
  department: string;
  city: string;
  address: string;
  additionalInfo: string;
  delivery: DeliveryMethod | null;
  errors: CheckoutErrors;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onIdNumberChange: (value: string) => void;
  onOpenDepartmentModal: () => void;
  onOpenCityModal: () => void;
  onAddressChange: (value: string) => void;
  onAdditionalInfoChange: (value: string) => void;
}

export function CustomerDataSection({
  firstName,
  lastName,
  phone,
  idNumber,
  department,
  city,
  address,
  additionalInfo,
  delivery,
  errors,
  onFirstNameChange,
  onLastNameChange,
  onPhoneChange,
  onIdNumberChange,
  onOpenDepartmentModal,
  onOpenCityModal,
  onAddressChange,
  onAdditionalInfoChange,
}: CustomerDataSectionProps) {
  return (
    <section>
      <h3 className="text-[10px] font-bold opacity-50 uppercase tracking-widest mb-4">
        Tus datos
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nombre */}
        <div className="p-4 rounded-2xl border bg-primary/5 border-primary/20">
          <div className="flex items-center gap-2 mb-2 text-black/40 dark:text-white/40">
            <UserIcon size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Nombre *</span>
          </div>
          <Input
            placeholder="Ej: Andrés"
            value={firstName}
            onValueChange={onFirstNameChange}
            variant="underlined"
            isInvalid={!!errors.firstName}
            errorMessage={errors.firstName}
            classNames={{ base: "font-bold" }}
          />
        </div>

        {/* Apellido */}
        <div className="p-4 rounded-2xl border bg-primary/5 border-primary/20">
          <div className="flex items-center gap-2 mb-2 text-black/40 dark:text-white/40">
            <UserIcon size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Apellido *</span>
          </div>
          <Input
            placeholder="Ej: Triana Garcés"
            value={lastName}
            onValueChange={onLastNameChange}
            variant="underlined"
            isInvalid={!!errors.lastName}
            errorMessage={errors.lastName}
            classNames={{ base: "font-bold" }}
          />
        </div>

        {/* Teléfono */}
        <div className="p-4 rounded-2xl border bg-primary/5 border-primary/20">
          <div className="flex items-center gap-2 mb-2 text-black/40 dark:text-white/40">
            <PhoneIcon size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Número de teléfono *</span>
          </div>
          <Input
            placeholder="Ej: 313 316 5585"
            value={phone}
            onValueChange={(value) => onPhoneChange(normalizeCheckoutPhone(value))}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={10}
            type="tel"
            variant="underlined"
            isInvalid={!!errors.phone}
            errorMessage={errors.phone}
            classNames={{ base: "font-bold" }}
          />
        </div>

        {/* Número de cédula */}
        <div className="p-4 rounded-2xl border bg-primary/5 border-primary/20">
          <div className="flex items-center gap-2 mb-2 text-black/40 dark:text-white/40">
            <span>🪪</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Número de cédula *</span>
          </div>
          <Input
            placeholder="Ej: 1234567890"
            value={idNumber}
            onValueChange={onIdNumberChange}
            type="text"
            variant="underlined"
            isInvalid={!!errors.idNumber}
            errorMessage={errors.idNumber}
            classNames={{ base: "font-bold" }}
          />
        </div>

        {/* Campos de dirección - solo mostrar cuando es envío */}
        {delivery === "shipping" && (
          <>
            {/* Departamento */}
            <div className="p-4 rounded-2xl border bg-primary/5 border-primary/20">
              <div className="flex items-center gap-2 mb-2 text-black/40 dark:text-white/40">
                <span>📍</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">Departamento *</span>
              </div>
              <button
                type="button"
                onClick={onOpenDepartmentModal}
                className={`w-full text-left bg-transparent font-bold text-sm outline-none border-b pb-2 transition-colors ${
                  errors.department 
                    ? "border-danger text-danger" 
                    : "border-primary/30 hover:border-primary text-black dark:text-white"
                }`}
              >
                {department || "Selecciona departamento"}
              </button>
              {errors.department && (
                <p className="text-danger text-xs mt-1">{errors.department}</p>
              )}
            </div>

            {/* Municipio */}
            <div className="p-4 rounded-2xl border bg-primary/5 border-primary/20">
              <div className="flex items-center gap-2 mb-2 text-black/40 dark:text-white/40">
                <span>🏘️</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">Municipio *</span>
              </div>
              <button
                type="button"
                onClick={onOpenCityModal}
                disabled={!department}
                className={`w-full text-left bg-transparent font-bold text-sm outline-none border-b pb-2 transition-colors ${
                  !department 
                    ? "opacity-50 cursor-not-allowed border-black/10 dark:border-white/10" 
                    : errors.city 
                    ? "border-danger text-danger" 
                    : "border-primary/30 hover:border-primary text-black dark:text-white"
                }`}
              >
                {city || (department ? "Selecciona municipio" : "Primero selecciona departamento")}
              </button>
              {errors.city && (
                <p className="text-danger text-xs mt-1">{errors.city}</p>
              )}
            </div>

            {/* Dirección */}
            <div className="p-4 rounded-2xl border bg-primary/5 border-primary/20 md:col-span-2">
              <div className="flex items-center gap-2 mb-2 text-black/40 dark:text-white/40">
                <AddressIcon size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Dirección *</span>
              </div>
              <Input
                placeholder="Ej: Cra 4, Isnos, Huila"
                value={address}
                onValueChange={onAddressChange}
                variant="underlined"
                isInvalid={!!errors.address}
                errorMessage={errors.address}
                classNames={{ base: "font-bold" }}
              />
              <p className="text-[10px] text-black/40 dark:text-white/40 mt-2">P.ej. Calle 56 #28-04</p>
            </div>

            {/* Información adicional */}
            <div className="p-4 rounded-2xl border bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 md:col-span-2">
              <div className="flex items-center gap-2 mb-2 text-black/40 dark:text-white/40">
                <span>📝</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">Información adicional (opcional)</span>
              </div>
              <Input
                placeholder="Ej: entregar en Servientrega Isnos Huila"
                value={additionalInfo}
                onValueChange={onAdditionalInfoChange}
                variant="underlined"
                classNames={{ base: "font-bold" }}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
