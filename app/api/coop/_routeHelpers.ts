export const ALLOWED_COLLECTIONS = [
  "employee_loan",
  "user",
  "employee_loan_payment",
  "coop_savings_membership",
  "cutoff_settings",
] as const;

export type AllowedCollection = (typeof ALLOWED_COLLECTIONS)[number];

export function normalizeBaseUrl(base: string) {
  return base.replace(/\/+$/, "");
}

export function buildExternalUrlFromUrl(reqUrl: string, externalBase: unknown) {
  // Preserve legacy behavior where undefined becomes the literal string "undefined"
  const base = normalizeBaseUrl(String(externalBase));

  const { searchParams } = new URL(reqUrl);
  const collection = searchParams.get("collection");
  const id = searchParams.get("id");

  if (!collection || !ALLOWED_COLLECTIONS.includes(collection as AllowedCollection)) {
    throw new Error("Invalid or missing collection parameter");
  }

  const externalParams = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== "collection" && key !== "id") externalParams.append(key, value);
  });

  let url = `${base}/items/${collection}`;
  if (id) url += `/${id}`;

  const qs = externalParams.toString();
  if (qs) url += `?${qs}`;

  return url;
}
