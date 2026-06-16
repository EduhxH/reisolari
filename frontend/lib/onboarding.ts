// Seller-onboarding intent: when a logged-out user clicks "Anunciar", we remember
// the intent across the account-creation flow so the post-auth interceptor can
// route them straight to the ad wizard.

const INTENT_KEY = "reisolari_intent";
export const ANUNCIAR_ROUTE = "/dashboard/marketplace/anunciar";

export function markSellerIntent(): void {
  try {
    sessionStorage.setItem(INTENT_KEY, "sell");
  } catch {
    // sessionStorage unavailable — intent simply won't persist.
  }
}

export function hasSellerIntent(): boolean {
  try {
    return sessionStorage.getItem(INTENT_KEY) === "sell";
  } catch {
    return false;
  }
}

export function consumeSellerIntent(): boolean {
  const had = hasSellerIntent();
  try {
    sessionStorage.removeItem(INTENT_KEY);
  } catch {
    // ignore
  }
  return had;
}
