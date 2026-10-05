export const COMPANY_LOGOS: Record<string, { src: string; alt: string }> = {
  "american hairline (ahl)": { src: "/brand/ahl.png", alt: "American Hairline" },
  "alchemane (alc)": { src: "/brand/alchemane.png", alt: "Alchemane Hair Extensions" },
  ydigital: { src: "/brand/ydigital.png", alt: "YDigital" },
};

/** The three group logos, in the order they appear on the form header. */
export const GROUP_LOGOS = [
  COMPANY_LOGOS["american hairline (ahl)"],
  COMPANY_LOGOS["ydigital"],
  COMPANY_LOGOS["alchemane (alc)"],
];

/** Logo of a company; null when the company has none. */
export function companyLogo(company: string | undefined | null) {
  return COMPANY_LOGOS[(company ?? "").trim().toLowerCase()] ?? null;
}
