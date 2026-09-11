export interface CheckoutProfile {
  fullName: string;
  phone: string;
  idNumber: string;
  email: string;
}

const CHECKOUT_PROFILE_KEY = "vega_checkout_profile";

const emptyProfile: CheckoutProfile = {
  fullName: "",
  phone: "",
  idNumber: "",
  email: "",
};

export function saveCheckoutProfile(profile: Partial<CheckoutProfile>) {
  if (typeof window === "undefined") return;
  const next = { ...emptyProfile, ...profile };
  window.sessionStorage.setItem(CHECKOUT_PROFILE_KEY, JSON.stringify(next));
}

export function getCheckoutProfile(): CheckoutProfile {
  if (typeof window === "undefined") return emptyProfile;

  try {
    const stored = window.sessionStorage.getItem(CHECKOUT_PROFILE_KEY);
    return stored ? { ...emptyProfile, ...JSON.parse(stored) } : emptyProfile;
  } catch {
    return emptyProfile;
  }
}
