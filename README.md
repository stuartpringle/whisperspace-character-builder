# Whisperspace Character Builder

Web-based character builder powered by the Whisperspace rules API.

## Canonical Schema
Uses the authoritative storage schema from the SDK:
- `CharacterRecordV1` / `CharacterRecordV1Schema` (from `@whisperspace/sdk`)

## Flow

1. Origin
2. Archetype
3. Feats
4. Skills & Attributes
5. Equipment
6. Review

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
- [done] Previous/Next controls now render inside the main content card container.
- [done] Header account area now uses a username-triggered dropdown (Settings, Log out) with active-page highlighting and inline Builder submenu actions (`Save`, `Import`, `Reset`).
- [done] Character List page supports search, sortable columns, slot-capacity display, name-as-view-link, copy-link/edit actions, and right-aligned numeric columns.
- [done] Character List sort headers now show direction indicators (ascending/descending).
- [done] Edit/Add from Character List now checks for unsaved builder changes and prompts save-or-discard.
- [done] New cloud/local copy saves are blocked when character limit is reached.
- [done] Empty character slots are hidden while search filtering is active.
- [done] Settings page now includes account summary plus saved preferences (default visibility, default landing page).
- [done] Header/footer layout now uses shared render templates for consistent structure across builder/view/characters/settings pages.
- [done] Non-builder pages no longer render a separate Back-to-builder button; global nav handles page switching consistently.
- [done] Character builder now uses the same favicon assets as `whisperspace.com`.
- [done] Account menu hit-area was expanded/tuned for reliable hover/click interaction.
- [prototype] Added `augmented-ui` treatment to cards, step tabs, modal cards, gear cards, and primary buttons using the current Whisperspace palette.
- [done] OAuth/session reliability fix: stale cached `null` sessions no longer block fresh server session checks after redirect.
- [done] Auth guard now redirects logged-out users from protected pages (`/characters`, `/settings`) back to builder.
- [done] Logout from protected pages now returns to builder immediately.
- [prototype] Strengthened augmented-ui visual intensity (larger cuts + brighter border accents) for clearer evaluation.
- [done] Gear item and weapon cards now support drag-and-drop reordering.
- [done] Gear layout now prioritizes `Weapons` and `Armour` above `Items`, with clearer section grouping.
- [done] Weapons and items now render as collapsed-by-default rows with click-to-expand details.
- [done] Item and weapon rows now include explicit drag handles for reorder, plus inline qty/ammo controls.
- [done] Gear catalog search now includes matching owned items as quick-add options.
- [done] Added gameplay-effect editing UI for items, weapons, and armour (category + target + +/- amount + removable tags).
- [done] Cut-corner components now share a consistent `25px` top/bottom padding treatment.
- [done] Remove buttons now use a stronger hover state for clearer destructive affordance.
- [done] Gear row headers now label collapsed weapon/item columns for readability.
- [done] Reload control now uses an icon button with hover tooltip.
- [done] Gear search now filters both catalog options and currently equipped inventory/weapon rows.
- [done] Gameplay effect editor now auto-collapses after adding a new effect.
- [done] Drag/reorder handlers now set HTML5 `dataTransfer` payloads for better browser compatibility.
- [done] Builder flow now follows character-creation order: `Origin -> Archetype -> Feats -> Skills -> Attributes -> Equipment -> Review`.
- [done] `Skills` and `Attributes` are now merged into a single `Skills & Attributes` step, with derived attributes shown at the top.
- [done] `Skills & Attributes` now has explicit section headers and card-based metric display for Physique/Reflex/Social/Mental plus Cool Under Fire/Speed/Carrying Capacity.
- [done] Attribute metric cards are now centered and use subtle hover lighting; skill rows also use a subtle hover highlight.
- [done] Skill tooltip resolution now uses Rules API `skill_tooltips.json` label matching (case-insensitive/id fallback) and only shows info icons when text exists.
- [done] Background authoring/picker moved from `Archetype` to `Origin`; `Archetype` currently displays Rules API narrative intro text.
- [done] Rules narrative extraction now reads direct `text` nodes in `rules.json` (not only paragraph-child structures), improving concept/archetype/credits copy rendering reliability.
- [done] Tooltips are now loaded independently of skills data and cached separately; missing tooltip payloads no longer block skills loading.
- [done] Drag handles now use dedicated draggable elements with explicit HTML5 transfer payload + drop parsing fallback for improved cross-browser reorder behavior.
- [done] Review page UI refresh: hero header, compact stat pills, carded content sections (Attributes/Skills/Equipment/Health), cleaner list styling, and integrated notes card for better visual consistency.
- [done] Calc compatibility hardening: derive/validate requests now include full equipment payloads (`weapons`, `armour`, `items`, `feats`) plus normalized `gameplayEffects` to align with current Rules API calc contracts.
- [done] Derive response handling now accepts either top-level attribute fields or nested `attributes` payloads and supports `cuf`/`coolUnderFire` and `carryingCapacity` response variants.
- [done] Gameplay-effects calc alignment now uses a normalized top-level `gameplayEffects` list for derive/validate calls, while per-entity payload objects are sent without embedded `gameplayEffects` to prevent double-application.
- [done] Tooltip lookup now supports current Rules API ID-based maps (`skillsById` / `skills`) as well as label-based compatibility maps.
- [done] Removed the temporary in-app Calc Debug Panel from the user-facing Skills & Attributes UI now that gameplay-effects deployment is stable.
- [done] Skill rank inputs now show gameplay-adjusted effective ranks (clamped to max rank 5), while editing still updates underlying base invested ranks.
- [done] Gameplay-effect editors for weapons, armour, and items now include `Cancel` actions next to `Add`.
- [done] Cloud save compatibility fix: persistence payloads now strip transient `gameplayEffects` fields to satisfy current character schema validation; gameplay tags are rehydrated into the active editor state after save.
- [done] Save-options checkbox copy updated to `Save as new character` (removed inline tooltip glyph).
- [done] Builder step persistence now restores the `Review` tab on refresh (no forced fallback to `Origin`).
- [done] Review-step navigation now swaps `Next` for `Save` and opens the save flow directly.
- [done] Weapon/item drag-to-reorder now works by click-and-hold on the row/card area (not only a drag-handle icon).
- [done] Skills now show rank pips (0-5) beside rank controls as a visual rank indicator.
- [done] Origin Motivation/Background pickers now default to the current sheet-selected values when available.
- [done] Weapon ammo edits are capped to catalog max ammo values; top-row +/- controls also enforce the max cap.
- [done] Melee weapons without explicit ammo now show `-` ammo, hide top-row reload/decrement controls, and disable ammo editing.
- [done] Drag-and-drop polish now adds drag/hover card states and live list reflow while dragging over targets.
- [done] Drag-and-drop flicker reduction: live reordering on hover is now rate-limited and deduped per target index to avoid rapid jitter.
- [done] Builder right-column account menu now includes `Save`, `Import`, and `Reset`; menu frame border was removed.
- [done] Account label now shows full user email.
- [done] Builder header now integrates shared Whisperspace nav JSON from `https://whisperspace.com/nav/main-menu.v1.json` with fallback data and active-link styling.
- [done] Derive calls are now de-duplicated by request signature and in-flight gated to avoid repeat calc polling / rate-limit loops.
- [done] Derive trigger matrix now runs on: entering `Skills & Attributes` / `Review`, skill-rank changes, gameplay-effect field changes (weapons/items/armour/feats), and save actions.
- [done] Added `429` handling with cooldown backoff (15s) plus visible debug error messaging to avoid repeated rate-limit hammering.
- [done] Origin step now displays concept and starting-credits guidance text sourced dynamically from `rules.json`.
- [done] Origin step now includes starting credits generation (`1d12 * 50 + 800`) and manual credit override.
- [done] Equipment summary now shows current `Credits` balance instead of total item cost.
- [done] Adding an inventory entry now merges into quantity when an equivalent gear record already exists.
- [done] Armour now supports carried sets via `armours[]` with a single equipped selector via `equippedArmourId`.
- [done] Added a modular dice-roller service (`src/ui/dice.ts`) with pluggable providers and a default CSS 3D animation provider; Origin roll actions now use this contract.
- [done] Armour management now uses carried-armour cards with equip actions and equipped highlighting; `Equip Armour` action is now `Add Armour`.
- [done] Armour now follows the same row/card interaction model as weapons/items: click row to expand/edit details, while `Equip` is the only action that changes equipped armour.
- [done] Armour row `Equip` / `Remove` action buttons now use standard button padding/height for visual consistency with other controls.
- [done] Buying the same armour again now creates a new carried armour instance (no merge/quantity behavior), preserving independent durability tracking per armour piece.
- [done] Skills budget controls now group `Remaining`, editable `Total`, and an `Add` increment field/action.
- [done] Credits controls now support amount-based `Add`/`Remove`, plus equipment acquisition modes: `Buy` (enforces credits and auto-deducts costs) or `Acquire` (no cost checks).
- [done] Credits adjustment controls moved into a dedicated modal (`Add/Remove`) opened beside the credits display in Equipment; modal uses vertical/grid layout with current balance, amount input, and Add/Remove actions.
- [done] In `Buy` mode, item quantity controls become buy/sell actions (`+` buys one with credit checks, `-` sells one), and gear remove actions become sell actions that credit back item/weapon/armour value.
- [done] Equipment add buttons now switch labels in `Buy` mode (`Buy Weapon/Armour/Gear (<cost> credits)`) and disable when credits are insufficient; `Acquire` mode keeps standard `Add` labels and the mode selector now uses a switch-style toggle.
- [done] Equipment add rows now include `Preview` actions for weapon/armour/gear catalogs, opening a modal with full selected-entry details before buy/add.
- [done] Preview modal now hides internal IDs, maps weapon `skillId` to `Skill Used` with pretty skill labels, title-cases field labels, and renders detail fields in two columns beneath Name on larger screens.
- [planned] Expand the character view page to show full derived stats, wounds/stress, and gear totals.
- [planned] Add a cache refresh control for rules data.

- [done] Builder header now shows larger horizontal `Save`/`Import`/`Reset` actions directly under the `Character Builder` title; account dropdown now holds `My Characters`, `Settings`, and `Log out`, while buy/sell labels are simplified (`Buy (...)`, `Sell (...)`).

- [done] Gear card hover highlight now applies to both collapsed and expanded cards (weapon/item/armour), and the temporary `.equipped-row` row-only highlight class has been removed.
- [done] Cloud save visibility now defaults per-character to the last chosen value for that character (when available), instead of always using global default visibility.
- [done] Character list/fetch calls now force cookie-session auth (`credentials: include`) to prevent cross-account list leakage from stale API-key auth contexts.

- [done] Character list now includes `Delete` actions, `Copy Link` click feedback (`Copied` tooltip), and auth modal Enter-to-login behavior on the password field; auth now returns to Save only when login was initiated from Save flow.
- [done] `/characters` polish pass: primary CTA label is now `New Character`, the account submenu stays expanded with correct active highlighting on submenu routes (`/characters`, `/settings`), and character rows now use the same hover highlight treatment as other equipment/list rows.
- [done] Non-builder headers now label the builder return action as `Continue Building`; default landing preference fallback is now `My Characters`; and Skills now include an `Add / Remove` modal (mirroring credits adjustments) with guardrails that block removing points already spent and show an inline warning.
- [done] Skills layout polish: removed the large direct `Total` points input, added a `Skill Points` heading for the budget block, and moved `Learning Focus` to sit just below the skill-points section.
- [done] Header account navigation now renders as a single inline menu tree: the user submenu items are part of the same menu stack with visual indentation (instead of a floating dropdown), and the account menu block is positioned slightly higher in the header for better alignment.
- [done] Header account navigation simplified again: removed the separate user-name trigger row and now renders `My Characters` / `Settings` / `Log out` directly as indented entries in the normal menu list under `Continue Building`.
- [done] Header account navigation now uses fully normal (non-indented) menu entries for `Continue Building`, `My Characters`, `Settings`, and `Log out`; `Log out` is styled with a softer danger variant to stand out from standard nav actions.
- [done] Header `Log out` now reuses the same `ghost danger` visual style as inventory/remove actions for consistent destructive-action styling across the app.
- [done] Equipment catalog selectors now always include costs in option labels (`Name (<cost> credits)`) for weapons, armour, and items across both `Buy` and `Acquire` modes; `Buy` action buttons were simplified to `Buy Weapon`, `Buy Armour`, and `Buy Gear` (no inline cost suffix).
- [done] Origin name field now includes a `Generate` action that creates sci-fi style names (built-in generator), enabling quick character naming without leaving the builder.
- [done] Review tab polish pass: added richer hero metadata tags, expanded summary pills (including skill-point spent/remaining), equipped-armour-aware loadout listing, and subtle review-card hover polish.
- [done] Landing-page behavior now applies only immediately after successful login (not on refresh or deep-link page loads), and dice-roll UI now stays visible until manually closed so Motivation/Background/credits rolls are reliably visible.
- [done] Fixed dice modal mount scope: roll dialogs now render from the main builder view (not only `/characters`), so `Roll Motivation` / `Roll Background` always show the die animation and result modal in Origin.
- [done] Dice UX changed from modal to in-page overlay: a 3D die now pops from bottom-left and travels across the screen during rolls, while a bottom-right result toast displays `Rolled <notation>: <result>` with contextual detail (for example credits or selected motivation/background) before auto-dismissing.

- [done] On logout/session expiry during builder editing, cloud-only drafts are now cleared from editor view; builder restores only explicitly user-saved local copies (if present), otherwise resets to a blank sheet.

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
- Gameplay-effect tags are stored on gear/feat entries and normalized into a top-level `gameplayEffects` array for calc requests (`derive-*` and `validate-sheet`); entity payloads are sent without embedded `gameplayEffects` fields for compatibility with current deployed calc behavior.
- Character API persistence schema currently rejects `gameplayEffects` on weapon/gear/feat records; cloud saves remove those transient UI fields before submit.
- During schema migration, the builder can read/write legacy `armour` and new `armours` + `equippedArmourId` fields.
- [done] Catalog action rows now use tighter no-wrap action-group layout so `Preview` + `Buy ...` controls avoid awkward line breaks (with mobile wrap fallback).

- [done] Weapon rows now show keyword chips with tooltips sourced from Rules API `weapon_keywords.json`, including `X` keyword template matching (for example `Piercing 2`).
- [done] Gear row polish pass: hover highlighting for weapons/armour/items plus reusable equipped-row emphasis styling for equipped armour.
