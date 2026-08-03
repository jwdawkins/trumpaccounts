/** Occasions surfaced on the home page — each pre-fills a gift-card message when
 *  the shopper lands on the build page via /shop?occasion=<slug>. */
export interface Occasion {
  label: string;
  slug: string;
  message: string;
}

export const OCCASIONS: Occasion[] = [
  { label: "Birthdays", slug: "birthday", message: "Happy Birthday!" },
  { label: "Baby Showers", slug: "baby-shower", message: "Congratulations on your new arrival!" },
  { label: "Holidays", slug: "holiday", message: "Happy Holidays!" },
  { label: "Milestones", slug: "milestone", message: "Congratulations on your milestone!" },
  { label: "Just Because", slug: "just-because", message: "Just because — thinking of you!" },
];

/** Resolve the pre-filled message for an occasion slug (empty string if unknown). */
export const occasionMessage = (slug: string | null | undefined): string =>
  OCCASIONS.find((o) => o.slug === slug)?.message ?? "";
