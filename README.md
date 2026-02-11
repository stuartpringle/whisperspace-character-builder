# Whisperspace Character Builder

Web-based character builder powered by the Whisperspace rules API.

## Canonical Schema
Uses the authoritative storage schema from the SDK:
- `CharacterRecordV1` / `CharacterRecordV1Schema` (from `@whisperspace/sdk`)

## Flow

1. Basics
2. Attributes
3. Skills
4. Gear
5. Review

## Persistence

- Auto-saves to localStorage as a draft.
- Export/Import JSON for manual backups.
- Cloud sync via `https://rules-api.whisperspace.com/character-api`.

## Build

```bash
npm install
npm run build
```

## Development

```bash
npm run dev
```

## Hosting
- Target: `https://builder.whisperspace.com/`
- Build output: `dist/`
- Deploy model: build from this project directory and serve the `dist/` folder directly.

## Notes

- Uses `@whisperspace/sdk` for API access.

## Design Goals & Status

- [done] Skills are loaded from the Rules API and validated with calc endpoints.
- [done] Gear catalog (items, cyberware, narcotics, hacker gear) loaded from the Rules API.
- [done] Weapons and armour catalogs loaded from the Rules API.
- [done] Derived stats displayed in Review (Attributes, CUF, Speed, Carrying Capacity).
- [done] Wounds and Stress displayed in Review.
- [done] Move derived stats off the Attributes step and into Review.
- [done] Save flow centered on Review with a dedicated Save dialog.
- [done] Account-based cloud saves with login/signup/session persistence and polished auth/save dialog copy.
- [done] Save permissions copy clarified: `private` (just you) vs `public` (anyone).
- [done] Post-save redirect to a character view page (shareable URL).
- [done] Cache Rules API data locally with fallback messaging when offline.
- [done] Display Rules API version and cache timestamp in the footer.
- [done] Background/motivation pick + roll wired to Rules API tables.
- [done] Login/signup modal copy and layout polish (readable errors, reset flow toggle, permission guidance).
- [done] Save modal closes on outside click and now uses staged save/auth dialogs.
- [done] Visual refresh aligned to `whisperspace.com` contact/footer direction (dark slate + blue accents, starfield treatment on key panels, newsletter-style modal feel).
- [done] Save UX split into staged dialogs: Save menu, auth modal, and save-options modal by target (`cloud` vs `localStorage`).
- [done] Save options are conditional: `New copy` only appears when an existing record exists for that save target.
- [done] Reset flow now confirms and restores last saved local/cloud copy when available, else resets to blank.
- [done] Skills UX refresh: grouped/collapsible trees, search-by-name, inline tooltips, +/- controls, compact rank input, and no slug display.
- [done] Skills section headers now use inline SVG icons per attribute/focus domain.
- [done] Learning Focus skills no longer show attribute labels; they are grouped by focus domain.
- [done] Current tab persists across refresh; Back/Next controls moved next to step tabs.
- [done] Authenticated account menu now shows username with an always-visible menu (Character Builder, Character List, Settings, Log out) and active-page highlighting.
- [done] Character List page supports search, sortable columns, slot-capacity display, name-as-view-link, copy-link/edit actions, and right-aligned numeric columns.
- [done] Character List sort headers now show direction indicators (ascending/descending).
- [done] Edit/Add from Character List now checks for unsaved builder changes and prompts save-or-discard.
- [done] New cloud/local copy saves are blocked when character limit is reached.
- [done] Empty character slots are hidden while search filtering is active.
- [done] Settings page now includes account summary plus saved preferences (default visibility, default landing page).
- [done] Header/footer layout now uses shared render templates for consistent structure across builder/view/characters/settings pages.
- [done] Back-to-builder action now appears under page title on all non-builder pages.
- [done] Character builder now uses the same favicon assets as `whisperspace.com`.
- [done] Account menu hit-area was expanded/tuned for reliable hover/click interaction.
- [prototype] Added `augmented-ui` treatment to cards, step tabs, modal cards, gear cards, and primary buttons using the current Whisperspace palette.
- [done] OAuth/session reliability fix: stale cached `null` sessions no longer block fresh server session checks after redirect.
- [done] Auth guard now redirects logged-out users from protected pages (`/characters`, `/settings`) back to builder.
- [done] Logout from protected pages now returns to builder immediately.
- [prototype] Strengthened augmented-ui visual intensity (larger cuts + brighter border accents) for clearer evaluation.
- [planned] Expand the character view page to show full derived stats, wounds/stress, and gear totals.
- [planned] Add a cache refresh control for rules data.

## Integration Quick Reference
- Public app URL: `https://builder.whisperspace.com/`
- Character view URL pattern: `https://builder.whisperspace.com/character/:id`
- Rules API base (default): `https://rules-api.whisperspace.com/rules-api/latest`
- Calc API base (default): `https://rules-api.whisperspace.com/rules-api/calc`
- Character API base (default): `https://rules-api.whisperspace.com/character-api`

## Environment Variables
- `VITE_RULES_API_BASE` (override rules JSON base URL)
- `VITE_CALC_API_BASE` (override calc endpoint base URL)
- `VITE_CHARACTER_API_BASE` (override character/auth API base URL)

## API/Schema Contracts
- Canonical character schema is from `@whisperspace/sdk` (`CharacterRecordV1`).
- Client-side validation runs before save via `validateCharacterRecordV1`.
- Save visibility values sent to character API: `private` or `public`.

## Auth Expectations
- Browser-session auth uses cookies (`credentials: include` on auth/character endpoints).
- CSRF token is read from `ws_csrf` cookie and sent as `X-CSRF-Token` on sensitive requests.
- Some storage helpers also support bearer token usage from `localStorage.ws_character_api_key` for API-style calls.
- OAuth entrypoint used by UI: `${VITE_CHARACTER_API_BASE}/auth/oauth/google`.
- If unauthenticated users click `Save`, the auth modal opens first, then returns to save options/menu after successful login/signup.
- Save now follows staged flow:
  - Save menu (`Save`, `Save (LocalStorage)`, `Export (JSON)`).
  - If `Save` is clicked while logged out, auth modal opens first.
  - Save options open in a dedicated modal per target.

## Integration Gotchas
- Rules/skills/gear data are cached in `localStorage`; UI can run in cached/offline mode with stale data.
- Save may return conflict (`409`) if remote is newer; UI exposes overwrite/new-save behavior.
- Public characters are intended for view-by-link; private characters are scoped to the owner.
