import { useEffect, useState } from "react";
import { Check, ArrowLeft, ArrowRight, Gift, TrendingUp, CreditCard, User, Send, Plus, Minus, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/lib/cart";
import { getCatalog, type CatalogProduct, type DeliveryMethod, type VerificationMode } from "@/lib/api";
import { dollarsToCents } from "@/lib/format";
import { occasionMessage } from "@/lib/occasions";
import visaQuarter from "@/assets/brands/visa_quarter.png";
import amazonQuarter from "@/assets/brands/amazon_quarter.png";
import starbucksQuarter from "@/assets/brands/starbucks_quarter.png";
import walmartQuarter from "@/assets/brands/walmart_quarter.png";

const DENOMINATIONS = [25, 50, 100, 150, 200, 250, 500];
const SPLIT_OPTIONS = [10, 20, 25, 50, 100];
const STEPS = ["The Gift", "Invest", "The Card", "For Whom", "Send It"];
const STEP_ICONS = [Gift, TrendingUp, CreditCard, User, Send];
const LAST_STEP = STEPS.length - 1;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// The storefront offers exactly these four brands, in this order. The provider
// catalog can carry several variants per brand (e.g. Physical vs Virtual Visa,
// multiple Walmart SKUs), so we pick ONE canonical product per brand from the
// live catalog and show a clean label — while keeping the real (opaque) provider
// id the recipient later redeems against.
interface BrandOption {
  id: string;
  key: string;
  label: string;
  description: string;
}

const BRANDS: { key: string; label: string; description: string; prefer?: (p: CatalogProduct) => boolean }[] = [
  {
    key: "visa",
    label: "Visa Gift Card",
    description:
      "A virtual prepaid Visa card delivered digitally — no physical card to wait for. Spend it anywhere Visa is accepted online, or add it to Apple Pay / Google Pay to tap in stores.",
    prefer: (p) => /virtual/i.test(p.name),
  },
  {
    key: "amazon",
    label: "Amazon",
    description: "Redeemable for millions of items on Amazon.com. Never expires and has no fees.",
  },
  {
    key: "starbucks",
    label: "Starbucks",
    description: "Good for coffee, food, and treats at any Starbucks location or in the Starbucks app.",
  },
  {
    key: "walmart",
    label: "Walmart",
    description:
      "Spend it on almost anything at Walmart stores and Walmart.com — groceries, toys, electronics, and more. Excludes restricted items like alcohol, tobacco, and firearms.",
    prefer: (p) => /prohibited/i.test(p.name),
  },
];

// Branded quarter-circle art for the card preview's top-right corner, keyed by brand.
const BRAND_IMAGES: Record<string, string> = {
  visa: visaQuarter,
  amazon: amazonQuarter,
  starbucks: starbucksQuarter,
  walmart: walmartQuarter,
};

function resolveBrands(products: CatalogProduct[]): BrandOption[] {
  const out: BrandOption[] = [];
  for (const b of BRANDS) {
    const matches = products.filter((p) => p.name.toLowerCase().includes(b.key));
    if (matches.length === 0) continue;
    // Prefer the configured variant; otherwise the shortest name (the plainest SKU).
    const pick =
      (b.prefer && matches.find(b.prefer)) ||
      [...matches].sort((a, c) => a.name.length - c.name.length)[0];
    out.push({ id: pick.id, key: b.key, label: b.label, description: b.description });
  }
  return out;
}

export function CardConfigurator() {
  const { toast } = useToast();
  const { add } = useCart();

  const [step, setStep] = useState(0);
  // How far the user has unlocked. Grows only when the current step is complete,
  // so later steps stay locked even though some carry valid defaults.
  const [maxUnlocked, setMaxUnlocked] = useState(0);

  // Amount: a preset, or a custom dollar entry.
  const [amount, setAmount] = useState<number>(100);
  const [customAmountMode, setCustomAmountMode] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>("");

  // Trump Account split: a preset %, or a custom %.
  const [split, setSplit] = useState<number>(50);
  const [customSplitMode, setCustomSplitMode] = useState(false);
  const [customSplit, setCustomSplit] = useState<string>("");

  const [currentAge, setCurrentAge] = useState<number>(0);
  const [returnRate, setReturnRate] = useState<number>(8); // assumed annual return %

  // Gift-card brand selection (the gifter chooses).
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);

  // Recipient details (were previously gathered at checkout).
  const [verificationMode, setVerificationMode] = useState<VerificationMode>("OPEN");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("SELF");
  // OPEN gifts can be bought in a quantity; VERIFIED gifts get one card per name.
  const [quantity, setQuantity] = useState(1);
  const [recipientNames, setRecipientNames] = useState<string[]>([""]);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");

  // Gift message — pre-filled when arriving from an occasion (/shop?occasion=…).
  const [message, setMessage] = useState<string>(() =>
    occasionMessage(new URLSearchParams(window.location.search).get("occasion")),
  );

  // Multi-card delivery. When buying more than one card the gifter can send them
  // all to one contact ("SAME") or address each card ("INDIVIDUAL"). Per-card
  // contact/message live in parallel arrays indexed by card; `activeCard` is the
  // carousel position. `null` choice → smart default (verified → individual).
  const [deliveryModeChoice, setDeliveryModeChoice] = useState<"SAME" | "INDIVIDUAL" | null>(null);
  const [cardContacts, setCardContacts] = useState<string[]>([]);
  const [cardMessages, setCardMessages] = useState<string[]>([]);
  const [activeCard, setActiveCard] = useState(0);
  // Scheduled send date — the day the email/text goes out. UI-captured only for
  // now; NOT yet threaded into the order pipeline. See TODO in handleAddToCart.
  const [sendDate, setSendDate] = useState(() => new Date().toISOString().slice(0, 10)); // defaults to today
  const [cardDates, setCardDates] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    getCatalog()
      .then((products) => {
        if (live) setBrands(resolveBrands(products));
      })
      .catch(() => {
        /* Catalog optional for the illustrative math; brand step shows a notice. */
      });
    return () => {
      live = false;
    };
  }, []);

  // Resolve the effective amount/split from preset-or-custom.
  const resolvedAmount = customAmountMode ? Math.max(0, Number(customAmount) || 0) : amount;
  const resolvedSplit = customSplitMode
    ? Math.min(100, Math.max(0, Math.round(Number(customSplit) || 0)))
    : split;
  const is100 = resolvedSplit === 100;

  const investmentAmount = (resolvedAmount * resolvedSplit) / 100;
  const spendableAmount = resolvedAmount - investmentAmount;
  const growth = 1 + returnRate / 100;
  const projectedAt18 = investmentAmount * Math.pow(growth, Math.max(0, 18 - currentAge));
  const projectedAt65 = projectedAt18 * Math.pow(growth, 47); // 65 - 18 = 47 more years
  const totalGiftValue = spendableAmount + projectedAt18;

  const selectedBrand = brands.find((b) => b.id === selectedBrandId) ?? null;
  const brandImage = !is100 && selectedBrand ? BRAND_IMAGES[selectedBrand.key] : null;

  // Recipient/delivery requirements mirror the server (services/domain/cart.ts).
  // Split across the two steps: the Recipient step owns the name check; the
  // Delivery step owns the email/phone check (message on that step is optional).
  // VERIFIED requires every name filled in; OPEN just needs a quantity ≥ 1.
  const recipientStepValid =
    verificationMode !== "VERIFIED"
      ? quantity >= 1
      : recipientNames.length > 0 && recipientNames.every((n) => n.trim().length > 0);
  // How many cards this configuration produces (drives the preview indicator).
  const cardCount = verificationMode === "VERIFIED" ? recipientNames.length : quantity;

  // Delivery model: only meaningful for 2+ cards sent by email/text. Default is
  // per-card for verified gifts, one-contact-for-all for open batches.
  const effectiveDeliveryMode = deliveryModeChoice ?? (verificationMode === "VERIFIED" ? "INDIVIDUAL" : "SAME");
  const individual = cardCount > 1 && deliveryMethod !== "SELF" && effectiveDeliveryMode === "INDIVIDUAL";
  const activeIdx = Math.min(Math.max(activeCard, 0), Math.max(0, cardCount - 1));

  // Earliest selectable send date (today, local) for the date pickers.
  const today = new Date().toISOString().slice(0, 10);
  const contactValid = (v: string) =>
    deliveryMethod === "EMAIL" ? EMAIL_RE.test(v.trim()) : v.trim().length > 0;
  const addressedCount = Array.from({ length: cardCount }).filter((_, i) =>
    contactValid(cardContacts[i] ?? ""),
  ).length;

  const deliveryStepValid =
    deliveryMethod === "SELF"
      ? true
      : !individual
        ? contactValid(deliveryMethod === "EMAIL" ? recipientEmail : recipientPhone)
        : Array.from({ length: cardCount }).every((_, i) => contactValid(cardContacts[i] ?? ""));

  // Name shown on the card preview — follows the carousel while addressing individually.
  const previewIdx = individual && step === LAST_STEP ? activeIdx : 0;
  const recipientDisplay = verificationMode === "VERIFIED" ? recipientNames[previewIdx]?.trim() ?? "" : "";
  const MIN_AMOUNT = 10;
  const canAddToCart =
    resolvedAmount >= MIN_AMOUNT &&
    resolvedSplit >= 1 &&
    (is100 || !!selectedBrandId) &&
    recipientStepValid &&
    deliveryStepValid;

  // Per-step completion — every required step must be complete to add to cart.
  const stepComplete = [
    resolvedAmount >= MIN_AMOUNT, // Amount
    resolvedSplit >= 1, // Trump Split
    is100 || !!selectedBrandId, // Gift Card
    recipientStepValid, // Recipient
    deliveryStepValid, // Delivery (message is optional)
  ];

  // Navigation gate: you advance one step at a time. The step immediately after
  // the current one becomes available only when the current step is complete
  // (via "Next" or by clicking it); everything further ahead stays locked.
  // Already-visited steps stay open for review — `maxUnlocked` only moves forward.
  const currentComplete = stepComplete[step];

  const fmt = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
  const fmtCents = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  const presetBtn = (active: boolean) =>
    `text-lg font-semibold py-3 px-5 transition-colors border ${
      active
        ? "bg-accent text-accent-foreground border-accent"
        : "bg-transparent text-white border-white/20 hover:border-accent"
    }`;
  const fieldInput =
    "mt-1 w-full bg-transparent border border-white/30 text-white py-2 px-3 focus:border-accent focus:outline-none placeholder:text-white/30";
  const stepBtn =
    "w-10 h-10 rounded-full border border-white/30 text-white flex items-center justify-center transition-colors hover:border-accent hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-white/30 disabled:hover:text-white";
  // Squared up/down chevron button for the quantity spinner.
  const spinBtn =
    "w-8 h-6 border border-white/25 text-white flex items-center justify-center transition-colors hover:border-accent hover:text-accent hover:bg-accent/10 disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:border-white/25 disabled:hover:text-white disabled:hover:bg-transparent";
  const MAX_CARDS = 50;

  function handleAddToCart() {
    if (!canAddToCart) return;
    const base = {
      totalAmount: dollarsToCents(resolvedAmount),
      trumpPercent: resolvedSplit,
      allowedGiftCardProducts: is100 || !selectedBrand ? [] : [selectedBrand.id],
      brandName: is100 ? undefined : selectedBrand?.label,
      verificationMode,
      deliveryMethod,
    };
    // Contact + message per card: individually addressed cards use their own
    // entry; otherwise every card shares the single contact/message.
    const contactFor = (i: number) => {
      if (deliveryMethod === "SELF") return {};
      const raw = individual ? cardContacts[i] ?? "" : deliveryMethod === "EMAIL" ? recipientEmail : recipientPhone;
      const v = raw.trim();
      return deliveryMethod === "EMAIL" ? { recipientEmail: v } : { recipientPhone: v };
    };
    const messageFor = (i: number) => (individual ? cardMessages[i] ?? "" : message).trim() || undefined;
    // TODO(send-date): scheduled send date is collected in the UI (sendDate /
    // cardDates) but not yet passed here. Thread it into GiftDraft → CartItemInput
    // → POST /orders and the funding/dispatch worker so sends fire on that date.
    // const dateFor = (i: number) => (individual ? cardDates[i] : sendDate) || undefined;

    // VERIFIED → one card per name; OPEN → `quantity` identical cards.
    if (verificationMode === "VERIFIED") {
      recipientNames.forEach((name, i) =>
        add({ ...base, recipientName: name.trim(), ...contactFor(i), message: messageFor(i) }),
      );
    } else {
      for (let i = 0; i < quantity; i++) add({ ...base, ...contactFor(i), message: messageFor(i) });
    }
    toast({
      title: cardCount > 1 ? `${cardCount} cards added to cart` : "Added to cart",
      description: `${fmt(resolvedAmount)} each · ${resolvedSplit}% to Trump Account${
        is100 || !selectedBrand ? "" : ` · ${selectedBrand.label}`
      }`,
    });
  }

  const infoBox = "border bg-[#060D18] p-6 text-center";

  return (
    <div className="bg-primary text-white p-8 md:p-12 border border-accent/20 shadow-2xl">
      {/* Main: step wizard (left) + live card (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* LEFT — multi-step builder */}
        <div className="order-2 lg:order-1">
          {/* Step progress — interlocking arrows pointing right. An icon + label
              per step; fill color marks status and later steps stay locked. */}
          <div className="flex mb-8 gap-1.5">
            {STEPS.map((label, i) => {
              const Icon = STEP_ICONS[i];
              const active = i === step;
              const unlocked = i <= maxUnlocked; // a step the user has actually reached
              const done = unlocked && stepComplete[i]; // reached and valid
              const isNext = i === step + 1 && currentComplete; // the immediate next, clickable
              const reachable = unlocked || isNext;

              // Chevron: a left triangle notch cut in, a right triangle pointing out.
              const clip =
                "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)";

              // Fill states follow navigation, not validity: the current step glows,
              // a reached-and-completed step is a soft gold tint, the next clickable
              // step gets a gold ring hint, and everything still locked is dim.
              const fill = active
                ? "bg-gradient-to-br from-accent to-accent/80 text-accent-foreground shadow-lg shadow-accent/25"
                : done
                  ? "bg-accent/20 text-accent hover:bg-accent/30"
                  : isNext
                    ? "bg-white/[0.06] text-white/80 ring-1 ring-inset ring-accent/50 hover:bg-white/10"
                    : "bg-white/[0.02] text-white/25 cursor-not-allowed";

              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (!reachable) return;
                    setMaxUnlocked((m) => Math.max(m, i));
                    setStep(i);
                  }}
                  disabled={!reachable}
                  aria-current={active ? "step" : undefined}
                  style={{ clipPath: clip }}
                  className={`group/step relative flex-1 min-w-0 py-3.5 pl-5 pr-4 flex flex-col items-center gap-1.5 transition-all duration-300 ${fill}`}
                >
                  <Icon size={17} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
                  <span
                    className={`hidden sm:block text-[11px] tracking-wide truncate max-w-full ${
                      active ? "font-bold" : "font-medium"
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Step content */}
          <div className="min-h-[190px]">
            {step === 0 && (
              <div>
                <h3 className="text-xl font-serif font-bold mb-1 text-accent">Select the gift amount</h3>
                <p className="text-sm text-white/50 mb-5">Pick a preset or enter a custom amount ($10 minimum).</p>
                <div className="flex flex-wrap gap-3">
                  {DENOMINATIONS.map((val) => (
                    <button
                      key={val}
                      onClick={() => {
                        setAmount(val);
                        setCustomAmountMode(false);
                      }}
                      className={presetBtn(!customAmountMode && amount === val)}
                    >
                      ${val}
                    </button>
                  ))}
                  {customAmountMode ? (
                    <div className="inline-flex items-center border border-accent bg-accent/10">
                      <span className="text-lg font-semibold text-accent pl-3">$</span>
                      <input
                        type="number"
                        min={MIN_AMOUNT}
                        inputMode="decimal"
                        autoFocus
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        placeholder="Amount"
                        className="w-24 bg-transparent text-white text-lg font-semibold py-3 px-2 focus:outline-none placeholder:text-white/40"
                      />
                    </div>
                  ) : (
                    <button onClick={() => setCustomAmountMode(true)} className={`${presetBtn(false)} min-w-[9rem]`}>
                      Custom
                    </button>
                  )}
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <h3 className="text-xl font-serif font-bold mb-1 text-accent">Trump Account split</h3>
                <p className="text-sm text-white/50 mb-5">How much of the gift is invested for their future?</p>
                <div className="flex flex-wrap gap-3">
                  {SPLIT_OPTIONS.map((val) => (
                    <button
                      key={val}
                      onClick={() => {
                        setSplit(val);
                        setCustomSplitMode(false);
                      }}
                      className={presetBtn(!customSplitMode && split === val)}
                    >
                      {val}%
                    </button>
                  ))}
                  {customSplitMode ? (
                    <div className="inline-flex items-center border border-accent bg-accent/10">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        inputMode="numeric"
                        autoFocus
                        value={customSplit}
                        onChange={(e) => setCustomSplit(e.target.value)}
                        placeholder="1–100"
                        className="w-20 bg-transparent text-white text-lg font-semibold py-3 px-3 focus:outline-none placeholder:text-white/40"
                      />
                      <span className="text-lg font-semibold text-accent pr-3">%</span>
                    </div>
                  ) : (
                    <button onClick={() => setCustomSplitMode(true)} className={`${presetBtn(false)} min-w-[9rem]`}>
                      Custom
                    </button>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h3 className="text-xl font-serif font-bold mb-1 text-accent">Select the gift card</h3>
                <p className="text-sm text-white/50 mb-5">The spendable portion loads onto this card.</p>
                {is100 ? (
                  <p className="text-sm text-white/60 border border-white/10 bg-white/5 p-4">
                    At 100% the entire gift funds the Trump Account — there&rsquo;s no spendable gift card to choose.
                  </p>
                ) : brands.length === 0 ? (
                  <p className="text-sm text-white/50">Loading gift-card options…</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {brands.map((b) => {
                      const active = selectedBrandId === b.id;
                      const img = BRAND_IMAGES[b.key];
                      return (
                        <button
                          key={b.id}
                          onClick={() => setSelectedBrandId(b.id)}
                          className={`group relative overflow-hidden text-left p-4 border transition-colors ${
                            active
                              ? "bg-accent/10 border-accent"
                              : "bg-transparent border-white/20 hover:border-accent"
                          }`}
                        >
                          {/* Brand art, faded into the card's top-right as a watermark */}
                          {img && (
                            <img
                              src={img}
                              alt=""
                              aria-hidden
                              className={`absolute top-0 right-0 w-24 h-auto pointer-events-none select-none transition-opacity duration-300 ${
                                active ? "opacity-100" : "opacity-50 group-hover:opacity-75"
                              }`}
                              style={{
                                WebkitMaskImage:
                                  "radial-gradient(circle farthest-side at top right, black 40%, transparent 100%)",
                                maskImage:
                                  "radial-gradient(circle farthest-side at top right, black 40%, transparent 100%)",
                              }}
                            />
                          )}
                          <div className="relative">
                            <div className="flex items-center gap-2">
                              {active && <Check size={15} strokeWidth={3} className="shrink-0 text-accent" />}
                              <span className={`font-semibold ${active ? "text-accent" : "text-white"}`}>{b.label}</span>
                            </div>
                            <p className="text-xs text-white/50 mt-1.5 leading-relaxed max-w-[85%]">{b.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xl font-serif font-bold mb-1 text-accent">Who&rsquo;s it for?</h3>
                  <p className="text-sm text-white/50">Choose how the gift can be claimed.</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {([
                    ["OPEN", "Open", "Anyone can claim the gift so long as they have an active Trump Account."],
                    [
                      "VERIFIED",
                      "Trump Account Verified",
                      "The name must match the account owner of the Trump Account.",
                    ],
                  ] as [VerificationMode, string, string][]).map(([m, label, desc]) => {
                    const active = verificationMode === m;
                    return (
                      <div key={m} className="flex items-stretch gap-3">
                        <button
                          onClick={() => setVerificationMode(m)}
                          className={`flex-1 text-left p-4 border transition-colors ${
                            active ? "bg-accent/10 border-accent" : "bg-transparent border-white/20 hover:border-accent"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {active && <Check size={15} strokeWidth={3} className="shrink-0 text-accent" />}
                            <span className={`font-semibold ${active ? "text-accent" : "text-white"}`}>{label}</span>
                          </div>
                          <p className="text-xs text-white/50 mt-1.5 leading-relaxed">{desc}</p>
                        </button>

                        {/* Quantity spinner sits to the right of the Open box:
                            the count, then stacked up/down chevrons. */}
                        {m === "OPEN" && active && (
                          <div className="flex items-center gap-3 shrink-0 border border-accent/40 bg-accent/5 px-4">
                            <span className="text-2xl font-serif font-bold text-accent tabular-nums w-7 text-center">
                              {quantity}
                            </span>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                aria-label="More cards"
                                onClick={() => setQuantity((q) => Math.min(MAX_CARDS, q + 1))}
                                disabled={quantity >= MAX_CARDS}
                                className={spinBtn}
                              >
                                <ChevronUp size={16} strokeWidth={2.5} />
                              </button>
                              <button
                                type="button"
                                aria-label="Fewer cards"
                                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                disabled={quantity <= 1}
                                className={`${spinBtn} -mt-px`}
                              >
                                <ChevronDown size={16} strokeWidth={2.5} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* VERIFIED — one card per named account owner. */}
                {verificationMode === "VERIFIED" && (
                  <div>
                    <label className="text-xs uppercase tracking-wider text-white/50 font-semibold">
                      Trump Account owner {recipientNames.length > 1 ? "names" : "name"}
                    </label>
                    <div className="mt-2 space-y-2">
                      {recipientNames.map((name, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            value={name}
                            onChange={(e) =>
                              setRecipientNames((names) => names.map((n, i) => (i === idx ? e.target.value : n)))
                            }
                            placeholder={recipientNames.length > 1 ? `Full name #${idx + 1}` : "Full name"}
                            className="flex-1 bg-transparent border border-white/30 text-white py-2 px-3 focus:border-accent focus:outline-none placeholder:text-white/30"
                          />
                          {recipientNames.length > 1 && (
                            <button
                              type="button"
                              aria-label={`Remove name ${idx + 1}`}
                              onClick={() => setRecipientNames((names) => names.filter((_, i) => i !== idx))}
                              className={`${stepBtn} shrink-0`}
                            >
                              <Minus size={16} strokeWidth={2.5} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setRecipientNames((names) => [...names, ""])}
                      disabled={recipientNames.length >= MAX_CARDS}
                      className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-accent transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Plus size={16} strokeWidth={2.5} /> Add another name
                    </button>
                    {recipientNames.some((n) => n.trim() === "") && (
                      <p className="text-xs text-red-300/80 mt-2">Enter a name for every card.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xl font-serif font-bold mb-1 text-accent">Send it</h3>
                  <p className="text-sm text-white/50">Choose how the gift reaches them.</p>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-white/50 font-semibold">Delivery method</label>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {([
                      ["EMAIL", "Email"],
                      ["SMS", "Text"],
                      ["SELF", "Share myself"],
                    ] as [DeliveryMethod, string][]).map(([m, l]) => (
                      <button key={m} onClick={() => setDeliveryMethod(m)} className={presetBtn(deliveryMethod === m)}>
                        {l}
                      </button>
                    ))}
                  </div>
                  {deliveryMethod === "SELF" && (
                    <p className="text-xs text-white/50 mt-2 leading-relaxed">
                      We&rsquo;ll generate a printable PDF gift certificate
                      {cardCount > 1 ? " for each card" : ""} with the claim details — download it, print it, or share it
                      however you like.
                    </p>
                  )}
                </div>

                {/* 2+ cards by email/text → same-for-all vs address-each toggle */}
                {cardCount > 1 && deliveryMethod !== "SELF" && (
                  <div>
                    <label className="text-xs uppercase tracking-wider text-white/50 font-semibold">
                      Sending {cardCount} cards
                    </label>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <button onClick={() => setDeliveryModeChoice("SAME")} className={presetBtn(!individual)}>
                        Same for all
                      </button>
                      <button onClick={() => setDeliveryModeChoice("INDIVIDUAL")} className={presetBtn(individual)}>
                        Individually
                      </button>
                    </div>
                    <p className="text-xs text-white/40 mt-2">
                      {individual
                        ? "Address each card on the preview to the right →"
                        : `All ${cardCount} cards go to one contact — a separate ${
                            deliveryMethod === "EMAIL" ? "email" : "text"
                          } is sent for each.`}
                    </p>
                  </div>
                )}

                {/* Order (single card / same-for-all): date → contact → message */}
                {/* Scheduled send date for the whole batch */}
                {deliveryMethod !== "SELF" && !individual && (
                  <div>
                    <label className="text-xs uppercase tracking-wider text-white/50 font-semibold">
                      Send date{" "}
                      <span className="normal-case tracking-normal text-white/30">
                        — when the {deliveryMethod === "EMAIL" ? "email" : "text"} goes out
                      </span>
                    </label>
                    <input
                      type="date"
                      min={today}
                      value={sendDate}
                      onChange={(e) => setSendDate(e.target.value)}
                      className={`${fieldInput} [color-scheme:dark]`}
                    />
                  </div>
                )}

                {/* Single contact (single card, or "same for all") */}
                {deliveryMethod === "EMAIL" && !individual && (
                  <div>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="recipient@example.com"
                      className={fieldInput}
                    />
                    {!EMAIL_RE.test(recipientEmail.trim()) && (
                      <p className="text-xs text-red-300/80 mt-1">Enter a valid email address.</p>
                    )}
                  </div>
                )}
                {deliveryMethod === "SMS" && !individual && (
                  <div>
                    <input
                      type="tel"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="+1 555 123 4567"
                      className={fieldInput}
                    />
                    {recipientPhone.trim() === "" && (
                      <p className="text-xs text-red-300/80 mt-1">Enter a mobile number.</p>
                    )}
                  </div>
                )}

                {/* Individually: fields live under the card; show progress here */}
                {individual && (
                  <div className="border border-accent/30 bg-accent/5 p-4 text-sm text-white/70">
                    Addressing <span className="font-semibold text-white">card {activeIdx + 1} of {cardCount}</span> on
                    the preview to the right.
                    <div className="mt-1 text-xs text-white/40">{addressedCount} of {cardCount} cards addressed.</div>
                  </div>
                )}

                {/* Shared gift message (single card / same-for-all / share-myself) */}
                {!individual && (
                  <div>
                    <label className="text-xs uppercase tracking-wider text-white/50 font-semibold">
                      Gift message <span className="normal-case tracking-normal text-white/30">(optional)</span>
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={500}
                      rows={3}
                      placeholder="Add a personal note for the card…"
                      className="mt-1 w-full bg-transparent border border-white/30 text-white py-2 px-3 focus:border-accent focus:outline-none placeholder:text-white/30 resize-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Wizard nav */}
          <div className="flex items-center justify-between gap-4 mt-8">
            <button
              type="button"
              aria-label="Previous step"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="group w-14 h-14 rounded-full border border-white/25 text-white flex items-center justify-center transition-all hover:border-accent hover:text-accent disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:border-white/25"
            >
              <ArrowLeft size={22} strokeWidth={2} className="transition-transform group-enabled:group-hover:-translate-x-0.5" />
            </button>
            {step < LAST_STEP ? (
              <button
                type="button"
                aria-label="Next step"
                onClick={() => {
                  const next = Math.min(LAST_STEP, step + 1);
                  setMaxUnlocked((m) => Math.max(m, next));
                  setStep(next);
                }}
                disabled={!currentComplete}
                className="group w-14 h-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg shadow-accent/20 transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <ArrowRight size={22} strokeWidth={2.5} className="transition-transform group-enabled:group-hover:translate-x-0.5" />
              </button>
            ) : (
              <button
                onClick={handleAddToCart}
                disabled={!canAddToCart}
                className="px-8 py-3 bg-accent text-accent-foreground font-serif font-bold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add to Cart
              </button>
            )}
          </div>
          {step === LAST_STEP && !canAddToCart && (
            <p className="text-xs text-white/40 mt-3">
              {!is100 && !selectedBrandId
                ? "Go back to “Gift Card” to pick one, then finish the delivery details."
                : !recipientStepValid
                  ? "Go back to “Recipient” and enter the account owner’s name."
                  : individual
                    ? `Address all ${cardCount} cards (${addressedCount} of ${cardCount} done) to add to your cart.`
                    : "Finish the delivery details (email / phone) to add this to your cart."}
            </p>
          )}
        </div>

        {/* RIGHT — the card being built */}
        <div className="order-1 lg:order-2 flex flex-col items-center gap-5">
          <div className="relative isolate w-full max-w-[400px]">
            {/* Stacked "backs" that peek out when buying more than one card */}
            {cardCount > 1 && (
              <div aria-hidden className="absolute inset-x-4 -top-2 h-4 rounded-t-md bg-primary border border-accent/20 shadow-lg -z-10" />
            )}
            {cardCount > 2 && (
              <div aria-hidden className="absolute inset-x-8 -top-4 h-4 rounded-t-md bg-primary border border-accent/10 shadow-lg -z-20" />
            )}
            {/* Carousel arrows while addressing cards individually */}
            {step === LAST_STEP && individual && (
              <>
                <button
                  type="button"
                  aria-label="Previous card"
                  onClick={() => setActiveCard(Math.max(0, activeIdx - 1))}
                  disabled={activeIdx === 0}
                  className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/60 border border-white/20 text-white flex items-center justify-center transition-colors hover:bg-black/80 hover:border-accent disabled:opacity-25 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  aria-label="Next card"
                  onClick={() => setActiveCard(Math.min(cardCount - 1, activeIdx + 1))}
                  disabled={activeIdx === cardCount - 1}
                  className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/60 border border-white/20 text-white flex items-center justify-center transition-colors hover:bg-black/80 hover:border-accent disabled:opacity-25 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
            <div className="relative w-full aspect-[1.586/1] shadow-2xl overflow-hidden transition-transform duration-500 hover:scale-[1.02]">
            {/* Card Base */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#060D18] to-primary" />

            {/* Decorative Pattern */}
            <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMiIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==')]" />

            {/* Brand quarter-circle in the top-right (gold accent fallback) */}
            {brandImage ? (
              <img
                src={brandImage}
                alt=""
                aria-hidden
                className="absolute top-0 right-0 w-28 md:w-32 h-auto pointer-events-none select-none"
                style={{
                  // Radial mask centered on the card's top-right corner (the quarter-
                  // circle's center), with radius = X (the arc). Solid through the middle,
                  // fading to transparent at the outer curve so it dissolves into the card.
                  WebkitMaskImage:
                    "radial-gradient(circle farthest-side at top right, black 55%, transparent 100%)",
                  maskImage:
                    "radial-gradient(circle farthest-side at top right, black 55%, transparent 100%)",
                }}
              />
            ) : (
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-accent/30 to-transparent rounded-bl-full opacity-60" />
            )}

            {/* Card Content */}
            <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-between text-white">
              <div>
                <div className="flex items-center gap-3 max-w-[62%]">
                  <div className="w-10 h-10 border-2 border-accent flex items-center justify-center font-serif font-bold text-xl text-accent bg-primary/50">
                    T
                  </div>
                  <div className="leading-tight">
                    <div className="font-serif font-bold text-base tracking-wider text-white uppercase">Trump Account</div>
                    <div className="text-xs text-accent tracking-widest font-medium uppercase mt-0.5">
                      {is100 || !selectedBrand ? "Gift Card" : `${selectedBrand.label} Card`}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-end gap-4 pr-2">
                  <span className="text-3xl font-serif font-bold text-white shrink-0">{fmt(resolvedAmount)}</span>
                  {recipientDisplay && (
                    <div className="text-[11px] uppercase tracking-wider text-accent/80 min-w-0 pb-0.5">
                      To
                      <span className="block text-sm font-serif font-semibold text-white normal-case tracking-normal truncate">
                        {recipientDisplay}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex gap-1 h-3 bg-white/10 p-0.5">
                  <div
                    className="h-full bg-accent transition-all duration-500 ease-out"
                    style={{ width: `${resolvedSplit}%` }}
                  />
                  <div
                    className="h-full bg-white/80 transition-all duration-500 ease-out"
                    style={{ width: `${100 - resolvedSplit}%` }}
                  />
                </div>

                <div className="flex justify-between text-sm font-sans">
                  <div>
                    <div className="text-accent text-xs uppercase tracking-wider font-semibold mb-1">Invested</div>
                    <div className="font-semibold text-lg">{fmtCents(investmentAmount)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white/70 text-xs uppercase tracking-wider font-semibold mb-1">Spendable</div>
                    <div className="font-semibold text-lg">{fmtCents(spendableAmount)}</div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
          {/* Under the card: per-card address fields while addressing individually,
              otherwise the "how many cards / total" indicator. */}
          {step === LAST_STEP && individual ? (
            <div className="w-full max-w-[400px] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">
                  Card {activeIdx + 1} of {cardCount}
                  {recipientDisplay && <span className="text-white/50 font-normal"> · {recipientDisplay}</span>}
                </span>
                <span className="text-white/40">{addressedCount}/{cardCount} addressed</span>
              </div>
              {/* Order (individual): date → contact → message — matches same-for-all */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-white/40 font-semibold">
                  Send date — when this card&rsquo;s {deliveryMethod === "EMAIL" ? "email" : "text"} goes out
                </label>
                <input
                  type="date"
                  min={today}
                  value={cardDates[activeIdx] ?? today}
                  onChange={(e) =>
                    setCardDates((arr) => {
                      const c = arr.slice();
                      c[activeIdx] = e.target.value;
                      return c;
                    })
                  }
                  className="mt-1 w-full bg-transparent border border-white/30 text-white py-2 px-3 focus:border-accent focus:outline-none [color-scheme:dark]"
                />
              </div>
              {deliveryMethod === "EMAIL" ? (
                <input
                  type="email"
                  value={cardContacts[activeIdx] ?? ""}
                  onChange={(e) =>
                    setCardContacts((arr) => {
                      const c = arr.slice();
                      c[activeIdx] = e.target.value;
                      return c;
                    })
                  }
                  placeholder="recipient@example.com"
                  className="w-full bg-transparent border border-white/30 text-white py-2 px-3 focus:border-accent focus:outline-none placeholder:text-white/30"
                />
              ) : (
                <input
                  type="tel"
                  value={cardContacts[activeIdx] ?? ""}
                  onChange={(e) =>
                    setCardContacts((arr) => {
                      const c = arr.slice();
                      c[activeIdx] = e.target.value;
                      return c;
                    })
                  }
                  placeholder="+1 555 123 4567"
                  className="w-full bg-transparent border border-white/30 text-white py-2 px-3 focus:border-accent focus:outline-none placeholder:text-white/30"
                />
              )}
              <textarea
                value={cardMessages[activeIdx] ?? ""}
                onChange={(e) =>
                  setCardMessages((arr) => {
                    const c = arr.slice();
                    c[activeIdx] = e.target.value;
                    return c;
                  })
                }
                maxLength={500}
                rows={2}
                placeholder="Personal note for this card… (optional)"
                className="w-full bg-transparent border border-white/30 text-white py-2 px-3 focus:border-accent focus:outline-none placeholder:text-white/30 resize-none"
              />
              {!contactValid(cardContacts[activeIdx] ?? "") && (
                <p className="text-xs text-red-300/80">
                  {deliveryMethod === "EMAIL"
                    ? "Enter a valid email for this card."
                    : "Enter a mobile number for this card."}
                </p>
              )}
            </div>
          ) : cardCount > 1 ? (
            <div className="flex items-center gap-2 text-sm">
              <Layers size={16} className="text-accent" />
              <span className="font-semibold text-white">{cardCount} cards</span>
              <span className="text-white/30">·</span>
              <span className="text-white/60">{fmt(resolvedAmount * cardCount)} total</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Informational panels — the projected value of what's being built above */}
      <div className="mt-12 pt-10 border-t border-white/10 space-y-6">
        {/* Three summaries in one row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {/* True Gift Value */}
          <div className={`${infoBox} border-accent/30 flex flex-col justify-center`}>
            <div className="text-xs uppercase tracking-[0.2em] text-accent/70 font-semibold mb-1">True Gift Value</div>
            <div className="text-xs text-white/50 mb-3">Cash to spend + Trump Account by age 18</div>
            <div className="text-4xl md:text-5xl font-serif font-bold text-accent leading-none transition-all duration-300">
              {fmt(totalGiftValue)}
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-white/60">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-white/60 inline-block" />
                {fmtCents(spendableAmount)} spendable
              </span>
              <span className="text-white/30">+</span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-accent inline-block" />
                {fmt(projectedAt18)} by 18
              </span>
            </div>
          </div>

          {/* Retirement value */}
          <div className={`${infoBox} border-white/10 flex flex-col justify-center`}>
            <div className="text-xs uppercase tracking-[0.2em] text-white/50 font-semibold mb-1">If Kept to Retirement (Age 65)</div>
            <div className="text-4xl md:text-5xl font-serif font-semibold text-white/90 leading-none transition-all duration-300">
              {fmt(projectedAt65)}
            </div>
            <div className="text-xs text-white/35 mt-2">At {returnRate}% avg annual return · illustration only</div>
          </div>

          {/* Plain-language summary */}
          <div className={`${infoBox} border-accent/20 flex flex-col justify-center`}>
            <p className="text-base font-serif leading-relaxed text-white">
              Your <span className="font-bold text-accent">{fmt(resolvedAmount)}</span> gift gives them <span className="font-bold">{fmtCents(spendableAmount)}</span> to spend today and an estimated <span className="font-bold text-accent text-xl block mt-1">{fmt(projectedAt18)}</span> in their Trump Account by age 18!
            </p>
          </div>
        </div>

        {/* Adjusters — two sliders in one row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-white/10 bg-white/5 px-5 py-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs uppercase tracking-[0.15em] text-white/50 font-semibold">Current Age</span>
              <span className="text-sm font-medium text-white">
                {currentAge === 0 ? "Newborn" : `${currentAge} yrs`}
              </span>
            </div>
            <Slider value={[currentAge]} onValueChange={(vals) => setCurrentAge(vals[0])} min={0} max={17} step={1} />
            <div className="flex justify-between text-[11px] text-white/35 mt-1">
              <span>Newborn</span>
              <span>17</span>
            </div>
          </div>

          <div className="border border-white/10 bg-white/5 px-5 py-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs uppercase tracking-[0.15em] text-white/50 font-semibold">Assumed Annual Return</span>
              <span className="text-sm font-medium text-white">{returnRate}%</span>
            </div>
            <Slider value={[returnRate]} onValueChange={(vals) => setReturnRate(vals[0])} min={3} max={12} step={1} />
            <div className="flex justify-between text-[11px] text-white/35 mt-1">
              <span>3%</span>
              <span>12%</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-white/40 leading-relaxed text-center max-w-3xl mx-auto">
          Projections use the assumed annual return above, based on historical U.S. stock market performance. Actual results will vary. Trump Account investments are in U.S. equity index funds.
        </p>
      </div>
    </div>
  );
}
