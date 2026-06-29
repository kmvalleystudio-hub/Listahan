# Future: AI subscription & “Improve with AI” (deferred)

**`SAYCART_REMINDER_LIST_TOOLS_DONE_AI_SUB`** — Revisit this document **after all list tools are done** (voice bulk, scan/OCR flow, grocery + todo parity, polish). Then implement or schedule: subscriptions, backend proxy, and Improve with AI.

---

## Product decisions (from planning discussion)

- **Hybrid flow:** Keep local OCR first; add optional **“Improve with AI”** after scan/upload results (Results tab), subscriber-only.
- **Plan A (~$1/mo):** Ad-free (no AI entitlement).
- **Plan B (~$2.5/mo):** Ad-free + **AI** (e.g. Improve with AI + any future AI list features).
- **Usage cap (Plan B):** Budget **~20 improves/month per user** as a reasonable default (balance UX vs API cost); tune from real `$/improve` telemetry. Alternatives discussed: 10 (tight), 30 (more headroom).
- **Multilingual / better suggestions:** OpenAI path helps non–English and messy OCR vs local `scanOcrLexicon` heuristics.
- **Security:** API key should live on a **backend**, not in the app (today `openaiBulkItems.ts` uses client key for bulk voice — Improve with AI should not repeat that pattern for production).

## Economics (illustrative — verify with live usage)

- Store fee **~15–30%** off gross subscription.
- Plan B **$2.50** → net after store roughly **~$1.75–2.12** before OpenAI.
- Variable cost: **`improves × cost_per_improve`**; example **20 × ~$0.02 ≈ $0.40/mo** API per heavy-consistent user (actuals vary by model, prompt size, list length).
- **Out of pocket to run:** Mostly **Apple Developer (~$99/yr)**, **Google Play (~$25 once)**, **OpenAI pay-as-you-go**, **small hosting** (~$0–25/mo early) for proxy — no large upfront license.

## Current codebase status (snapshot)

- **Listahan Pro (ad-free)** — RevenueCat scaffold in app (`ProSubscriptionProvider`, Settings). Requires Play + RevenueCat dashboard setup; see `docs/REVENUECAT_PRO_SETUP.md`.
- Subscriptions **not live** until API keys, Play product, and new AAB are shipped.
- OpenAI used for **bulk voice grocery** parsing in `src/services/openaiBulkItems.ts` only.
- Scan “smart review” uses **local** `scanOcrLexicon` (no OpenAI).

## Next session checklist

- [ ] Define JSON contract for Improve with AI (grocery vs todo).
- [ ] Backend endpoint + auth + **per-user monthly cap** for Plan B.
- [ ] IAP / subscription products (A vs B) and entitlement checks in app.
- [ ] UI: button on scan Results after OCR; loading/error; optional preview before apply.
- [ ] Migrate or isolate client OpenAI key (bulk voice) behind same proxy when ready.
