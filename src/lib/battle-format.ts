// Phase 7: the platform-wide battle format. Just one category for now —
// no picker UI, every battle uses this. Kept as a named constant (rather
// than inlined) because it's stored per-row on `battles.category` too, so a
// future "pick a category" feature is additive, not a rewrite.
export const PITCH_CATEGORY = "Verkaufe dein Produkt oder deine Leistung in 15 Sekunden";

// How long a 'scheduled' battle's two brands have to each upload their
// video, counted from challenge acceptance (not from when the challenge was
// first sent — see CHALLENGE_WINDOW_MS in src/lib/challenge.ts, a separate
// clock for "should we even do this"). 2 weeks — enough time for an actual
// production, not just a phone clip.
export const PRODUCTION_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

// How long voting stays open once BOTH videos are in — for 'open' battles
// that's immediately at creation; for 'scheduled' battles, whenever the
// second side uploads. 1 week: long enough for word-of-mouth on a young
// platform, short enough to stay a "this week's battle" event.
export const VOTING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
