# Money Transfer Flow Implementation Plan

## Objective

Build the complete in-memory Money Transfer React prototype from `money-transfer-figma-make.json`, treating that JSON as the source of truth for content, field order, validation, transitions, accessibility, and responsive behavior. Use `@figma/astraui` components and Astra token utilities exclusively for visual styling. Never imply that real money moved.

## Repository and Design-System Findings

- The app is an empty React/Vite scaffold: `src/App.tsx` currently renders only a centered empty `div`.
- `src/index.css` currently contains only the Tailwind import.
- The user-mentioned `styles/global.css` is not present in the repository. Do not invent a second design-token layer; import Astra’s shipped CSS into `src/index.css` and use its existing semantic utilities and typography.
- Installed packages are `@figma/astraui-kit@0.1.3` and `@figma/astraui@1.0.0`. Consumer components come from `@figma/astraui`.
- Relevant available Astra components are `InputField`, `TextareaField`, `SelectField`, `Button`, `ButtonGroup`, `Badge`, `Modal`, and Astra icons such as `X`.
- Astra has no Alert/Banner, DatePicker, Spinner, description-list, or danger-button component. Use the closest allowed Astra equivalent:
  - token-only status surfaces for persistent error/info messaging;
  - `InputField type="date"` for the transfer date;
  - the primary `Button` loading label and a token-based progress indicator inside the card for processing;
  - token-based key/value rows for review;
  - Astra `Button variant="neutral"` with Astra danger tokens for the destructive dialog action.
- `SelectField` does not support option groups, disabled individual options, or passthrough ARIA props. Preserve the requested group labels in option text, mark the selected From account as unavailable in its label, reject that option in the controlled `onChange` safety net, and add an accessibility adapter that labels/focuses the rendered combobox without modifying the package.
- Astra `Modal` handles Escape, backdrop close, role, and scroll locking, but does not trap/restore focus. Add app-level focus containment and restoration around the Astra component.
- Do not use `ThemeProvider`, because its implementation persists theme state to `localStorage`, which conflicts with the explicit no-persistence requirement. The prototype will use Astra’s default light tokens without theme state.

## Files to Change

### `src/index.css`

- Keep all imports first.
- Import Tailwind and `@figma/astraui/styles.css`.
- Do not add colors, spacing, radii, font sizes, font families, or any new CSS custom properties.
- Add only minimal non-token behavioral utilities if JSX utilities cannot express them, such as a visually-hidden helper; prefer Tailwind utilities in JSX first.
- Set no custom font. All text will inherit Astra’s `font-sans` / Instrument Sans stack defined by the imported stylesheet.

### `src/money-transfer.ts` (new behavior/data module)

Create a typed, UI-independent module containing:

- `TransferStep`, `TransferValues`, `TransferErrors`, account, recipient, and destination types.
- Exact fictional source-account and recipient data from the JSON.
- `getTodayValue()` returning a local-calendar `YYYY-MM-DD` value, avoiding UTC date drift.
- `getMaxTransferDate()` returning the same local date one calendar year ahead.
- `createDefaultValues()` returning empty From/To/Amount/Memo and today as the transfer date.
- Account/destination lookup helpers.
- Locale formatting helpers:
  - account balances and visible transfer amounts with `Intl.NumberFormat("en-US", { style: "currency" })`;
  - accessible currency-name text with `currencyDisplay: "name"`;
  - long review/success dates with weekday, month, day, and year.
- `validateTransfer(values)` returning at most one message per field, in the exact rule order from the JSON:
  - required From;
  - required To, then same-account prevention;
  - required Amount, valid number, greater than zero, no more than two decimal places, then today-only balance limit;
  - required Date, not in the past, no more than one year ahead;
  - Memo no longer than 140 characters.
- Amount parsing that preserves invalid text, accepts a single decimal separator, distinguishes non-numeric/zero/negative/precision errors, and only formats a valid value with no more than two decimals to two decimals on blur.
- A local fictional reference generator in the form `TRF-XXXXXXXX`, using browser randomness only and no storage/network access.

### `src/App.tsx`

Implement the prototype with local React state and small local presentation/adaptor components. No state-management library and no persistence.

## Application State and Transitions

Maintain:

- `step`: `form | review | processing | success`.
- `values`: all five form values.
- `touched`: touched fields for blur validation.
- `submitAttempted`: controls the summary after Continue.
- `cancelOpen`: whether the cancel dialog is open.
- `cancelReturnStep`: the form/review step from which Cancel was opened.
- `reference`: generated once when confirmation starts.
- refs for the summary, each field, each step heading, the dialog wrapper, and the Cancel trigger.

Transitions:

1. **Form → Review** only when all validations pass.
2. Invalid Continue remains on Form, preserves values, displays summary and inline errors, then moves focus to the summary.
3. **Review → Form** via Edit details, preserving all values and moving focus to the Details heading.
4. **Review → Processing** via Confirm transfer; generate the fictional reference and set the card busy.
5. **Processing → Success** after 1500 ms; clean up the timeout if the component unmounts or state changes.
6. **Success → Form** via Make another transfer; reset values, touched state, errors, and reference.
7. Cancel from Form or Review opens the dialog while remembering the originating step.
8. Discard closes the dialog, resets the transfer, and returns to the default Form.
9. Keep editing, Escape, backdrop click, or modal close returns to the previous step and restores focus to its Cancel button.

## Shared Page Structure

- Full-height Astra `bg-brand-tertiary` canvas with token-based page padding.
- Centered readable-width content area using the closest documented Astra container utility; no arbitrary width literals.
- Page header on the canvas containing:
  - a focusable role-based heading for the current view;
  - exact subtitle;
  - Astra `Badge label="Simulation"`.
- Three-step indicator: `1 Details · 2 Review · 3 Done`.
  - Details active on form.
  - Review active on review and processing.
  - Done active on success.
  - Active state uses Astra brand tokens; inactive states use Astra secondary text/surface tokens.
- One Astra surface card using `bg-surface-bg`, `rounded-corner-lg`, `p-xl`, and tokenized gaps.
- A visually hidden `aria-live="polite"` region announces step changes.
- Focus the new step heading after each step transition; focus the success heading when success renders.

## Details Form

Render fields in the exact order:

1. **From** — Astra `SelectField`.
   - Placeholder: `Select an account`.
   - Options show name, mask, and locale-formatted available balance.
   - Selected account determines amount symbol/code.
   - Helper becomes `Available: {formattedBalance}` after selection.
2. **To** — Astra `SelectField`.
   - Placeholder: `Select an account or recipient`.
   - Flatten Astra’s unsupported groups while retaining explicit prefixes `My accounts —` and `Saved recipients —` in labels.
   - Keep the currently selected From account visible as `Unavailable — selected as From` and reject selection through the controlled handler.
3. **Amount** — Astra `InputField`.
   - Currency symbol prefix and read-only currency code suffix.
   - `inputMode="decimal"`, placeholder `0.00`.
   - Format valid input to two decimals on blur without silently correcting invalid precision.
4. **Transfer date** — Astra `InputField type="date"`.
   - Default/min today; max one local calendar year ahead.
5. **Memo (optional)** — Astra `TextareaField`.
   - Two rows, placeholder `e.g. October rent`, max length behavior aligned with validation.
   - Character counter uses exact `{n}/140` format and remains visible with the helper text.

Field accessibility/adapters:

- Render visible token-styled labels with `(required)` for required fields and `(optional)` for Memo, associated to controls wherever the component exposes a native ID.
- For Astra SelectField, use a wrapper ref to apply `aria-labelledby`, `aria-describedby`, `aria-invalid`, and a stable focus target to its rendered combobox because the kit API does not expose these props.
- Render helper and error elements with stable IDs.
- When invalid, set `aria-invalid="true"`, point `aria-describedby` to helper/error content, and show an Astra `X` icon plus exact error text using danger tokens.
- Validate touched fields on blur. On every change, clear a field’s error immediately once the current value is valid. Revalidate dependencies when From or Date changes so same-account and today-only balance errors stay accurate.

Error summary:

- Show only after Continue is pressed with one or more errors.
- Use a persistent token-based error surface with `role="alert"`, `tabIndex={-1}`, an Astra error icon, and exact singular/plural title: `Please fix 1 error to continue` / `Please fix {n} errors to continue`.
- List errors in visual field order.
- Use Astra subtle Buttons as the error links; activation focuses the corresponding input/combobox/textarea.

Actions and notice:

- `Continue to review` uses Astra primary Button.
- `Cancel` uses Astra neutral Button.
- Mobile: buttons stack full width with primary first.
- Desktop: actions are inline/right-aligned with secondary left of primary. Render breakpoint-specific Astra button groups so visible DOM/tab order matches visual order at both layouts.
- Add the exact persistent info copy: `This is a demo. No real money will be moved.` using an Astra-token status surface, not Toast, because the message must remain visible.

## Review Step

- Inline in the same card, never a modal.
- Exact title/subtitle.
- Render token-based key/value rows in this order:
  1. Amount — visually emphasized with Astra heading typography, visible value `{formattedAmount} {currency}`, plus visually hidden full currency-name text for screen readers.
  2. From — `{fromName} · {fromMasked}`.
  3. To — `{toName} · {toMasked}`.
  4. Date — `Today` for today; `Scheduled for {longDate}` for future dates.
  5. Memo — memo value or `—`.
  6. Balance after transfer — only for today, formatted in the source currency.
- Mobile rows stack label above value; desktop rows become two columns through responsive utilities.
- Actions:
  - primary `Confirm transfer`;
  - neutral `Edit details`;
  - subtle `Cancel`.
- Use separate mobile/desktop button groups to keep visual and keyboard order aligned.

## Processing State

- Keep the Review content visible to avoid layout shift.
- Set `aria-busy="true"` on the card.
- Change the primary action label to exact `Sending…` and set both `disabled` and `aria-disabled`.
- Disable Edit and Cancel as specified.
- Show a compact token-colored animated progress indicator near the action label using existing Astra/Tailwind animation utilities only; do not introduce a custom spinner token or raw size/color.
- No request, storage, or backend interaction.

## Success State

- Use Astra success semantics without inventing a missing icon: an Astra `Badge variant="success"` supplies the kit-native success marker.
- Heading:
  - `Transfer submitted` when the date is today.
  - `Transfer scheduled` for a future date.
- Body: `{formattedAmount} to {toName} on {longDate}.`
- Reference: `Reference: TRF-XXXXXXXX`.
- Disclaimer: `Simulation only — no real money was moved.`
- Primary action: `Make another transfer`.
- Focus the success heading on render.

## Cancel Confirmation Dialog

Use Astra `Modal size="small"` with:

- Title: `Cancel this transfer?`
- Body: `The details you entered will be discarded.`
- Destructive action: `Discard transfer`, implemented with Astra neutral Button plus Astra danger text/border tokens because no danger Button variant exists.
- Secondary action: `Keep editing`.

Accessibility supplementation around Astra Modal:

- Save the active Cancel trigger before opening.
- On open, focus `Keep editing` as the safe default.
- Trap Tab and Shift+Tab within the dialog.
- Escape/backdrop/close are all equivalent to Keep editing.
- Restore focus to the originating Cancel button after close.
- Add an accessible name to Astra’s internal close button via the wrapper ref because the kit does not provide one.

## Responsive Behavior

- Verify at 390px and 1440px.
- Below the Astra/Tailwind `sm` breakpoint:
  - single column;
  - full-width card within token page padding;
  - stacked full-width buttons, primary first;
  - review labels above values;
  - modal constrained by the kit and available viewport.
- At and above `sm`:
  - centered readable card;
  - inline right-aligned actions;
  - two-column review rows.
- Use only Astra spacing, typography, surface, color, radius, and focus utilities. No arbitrary-value classes, hex/rgb values, inline visual styles, or new CSS variables.

## Validation and Edge Cases

- Empty submit produces From, To, and Amount errors; Date is valid by default.
- Preserve all valid/invalid text when validation appears or when returning from Review.
- Same-account selection remains visibly unavailable and cannot update the controlled To value; validation still catches pre-existing same-account state after From changes.
- Scheduled transfers do not run the available-balance rule, matching the JSON exactly.
- Today transfers do run the balance rule and show post-transfer balance on Review.
- Date comparisons use local date-only values to avoid timezone errors.
- A From-account currency change updates the symbol/code immediately without converting the entered amount.
- Empty Memo renders `—` on Review.
- Processing timeout cannot update stale/unmounted state.
- Reference is fictional, generated locally, and reset for another transfer/discard.

## Verification

1. Run `npm run build`; fix any TypeScript/Vite errors without replacing Astra components.
2. Run `npm run format`, then rerun `npm run build` if formatting changes source.
3. Search changed source for prohibited styling and controls:
   - no hex/rgb color literals;
   - no arbitrary pixel/rem classes or visual inline styles;
   - no raw `button`, `input`, `select`, or `textarea` elements;
   - no `localStorage`, fetch/XHR, or network/backend code;
   - no non-Astra font declarations.
4. Inspect the live preview at 390px and 1440px using the already-running server; do not start another server.
5. Keyboard walkthrough:
   - tab order follows visual order;
   - selects and all actions work with keyboard;
   - touched blur validation and invalid Continue work;
   - summary receives focus and each error action focuses its field;
   - Review heading focus and Edit preservation work;
   - processing disables every action for about 1.5 seconds;
   - Success heading receives focus;
   - dialog traps focus, Escape keeps editing, and focus returns to Cancel.
6. Functional scenarios:
   - empty form errors;
   - zero, negative, non-numeric, and over-precision amount errors;
   - same-account prevention;
   - past and more-than-one-year date errors;
   - today amount over available balance;
   - valid today flow and post-transfer balance;
   - valid scheduled flow and scheduled success copy;
   - Edit details preservation;
   - Cancel/Keep editing preservation and Cancel/Discard reset;
   - Make another transfer reset.
7. Confirm every label, message, title, action, and disclaimer matches the attached JSON and no copy claims that real money was transferred.
