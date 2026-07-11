# Mobile Avatar Studio Design Review

## 1. Findings on the Approved Design & Current Implementation

*Ordered by severity of the gap between the current `index.html` and the approved specification.*

1. **CRITICAL: Architectural Paradigm Mismatch**
   The current `index.html` uses a linear, monolithic flow (`Drop Portrait -> Global Settings -> Generate`). The approved spec mandates a modular, slot-based architecture (`Immediate Default Avatar -> Select Specific Ingredient -> Modify/Capture -> Return to Avatar`). The entire DOM and state management must be fundamentally rewritten before any new features are added.
2. **HIGH: Mobile Layout Failure**
   The current CSS relies on a CSS Grid (`1fr 1.12fr`) that collapses into a stacked column on mobile (`max-width: 620px`). This forces users to scroll past a massive 290px drop-zone and all settings just to see the 3D preview. The avatar is completely disconnected from the inputs.
3. **HIGH: Missing UI Hooks for Phases 2-5**
   There is no spatial logic allocated for the Solid/Experimental toggle, the instruction text field, or the Workshop state. The current UI is too dense to just "drop in" a command bar without breaking the layout.
4. **MEDIUM: Capture Pipeline Complexity**
   The spec outlines a sophisticated capture pipeline (Capture -> Smart Focus/Masking -> Brush Refinement -> Render). The current `index.html` only contains a basic `<canvas>` crop box. A dedicated full-screen or bottom-sheet overlay system is required to handle the new `IngredientDialog` and `FocusMask` components safely on a small screen.

---

## 2. Three Mobile Interface Variants

### Variant A: The Modular Workbench (Bottom-Sheet Driven)
* **Information Architecture:** Fixed 3D stage (top 45%), scrollable grid of ingredient slots (bottom 55%).
* **First-Run Experience:** Instantly loads the default avatar. The bottom grid pulses slightly to indicate that ingredients can be tapped.
* **Avatar Stage:** Fixed at the top, allowing uninterrupted drag-to-rotate while interacting with UI below.
* **Ingredient Editing:** Tapping a slot opens a tall bottom-sheet (modal) dedicated entirely to that ingredient (camera, gallery, masking tools).
* **Solid/Experimental Toggle:** A tactile pill switch floating at the top-right of the 3D stage.
* **Instruction Field:** When Experimental is on, a sticky search-like input bar pushes down the ingredient grid and docks just below the 3D stage.
* **Workshop State:** The instruction field turns a distinct accent color and gains a "Terminal/Wrench" icon when authenticated.
* **Visual Direction:** Skeuomorphic touches flattened into modern UI. Soft drop shadows, rounded chunky cards, very tactile.
* **Strengths:** Extremely familiar iOS-style customization flow. Keeps the avatar visible at all times during navigation.
* **Risks:** The 3D stage might feel cramped on small screens (e.g., iPhone SE) when the instruction field appears.
* **What to Prototype:** The z-index and transition animations between the ingredient grid and the full-screen camera/masking bottom sheet.

### Variant B: The Immersive Lookbook (Swipe/Carousel Driven)
* **Information Architecture:** Full-bleed 3D stage covering the entire background. UI consists of floating horizontal carousels at the bottom.
* **First-Run Experience:** Full-screen avatar with minimal UI chrome. The active carousel defaults to "Face" presets.
* **Avatar Stage:** The entire screen. The avatar stands in the center.
* **Ingredient Editing:** Swipe left/right to change categories (Face, Hair, Top). Swipe up on a category to open the "Capture/Edit" full-screen overlay.
* **Solid/Experimental Toggle:** A Floating Action Button (FAB) in the top-left that expands horizontally.
* **Instruction Field:** A chat-like overlay that slides up from the bottom, pushing the carousels away.
* **Workshop State:** System messages appear as inline chat bubbles confirming token changes.
* **Visual Direction:** Glassmorphism, blurred panels, high reliance on the 3D rendering for visual impact.
* **Strengths:** Visually stunning, maximizes screen real estate, highly engaging for children.
* **Risks:** Discoverability is low. Swiping up to access the camera is a hidden gesture. 
* **What to Prototype:** The gesture conflict between rotating the 3D avatar (horizontal drag) and swiping the carousels.

### Variant C: The Contextual Crafter (Spatial Hybrid)
* **Information Architecture:** 3D stage (top 60%), dynamic action feed (bottom 40%).
* **First-Run Experience:** Avatar loads with subtle glowing hotspots on the head, torso, and legs. 
* **Avatar Stage:** Dominates the view, acts as the primary navigation.
* **Ingredient Editing:** Users tap directly on the 3D avatar's body parts. Tapping the shirt opens a popover or replaces the action feed with "Top" ingredients.
* **Solid/Experimental Toggle:** A chunky, literal switch at the top center of the screen.
* **Instruction Field:** A permanent, wide text box at the very bottom of the screen (resembling a command console).
* **Workshop State:** The console background turns black with green text, resembling a hacker terminal.
* **Visual Direction:** Game-like, high contrast, chunky borders, highly legible monospace typography.
* **Strengths:** Incredibly intuitive and playful. Unifies the text-command paradigm with the UI.
* **Risks:** Hitting specific body parts accurately on a small mobile screen is notoriously difficult and risks failing the 44px accessibility constraint.
* **What to Prototype:** 3D raycasting accuracy on mobile web and determining fallback behaviors for missed taps.

---

## 3. Recommendation

**I recommend Variant A (The Modular Workbench), with a deliberate hybrid element from Variant C for the Workshop.**

*Why?* The spec demands an accessible, dependable tool that handles complex multi-step pipelines (Capture -> Smart Mask -> Refine -> Render). Variant A's explicit grid of slots and bottom-sheet modals provide the necessary real estate and clear boundaries for these complex flows without relying on hidden gestures (Variant B) or error-prone 3D raycasting (Variant C). 

For the hybrid element: When the user enters the password-gated Developer Workshop, the instruction field should adopt the high-contrast "Console" aesthetic from Variant C to clearly differentiate it from the standard Experimental natural language input, reinforcing that they are now typing configuration commands, not avatar prompts.

---

## 4. Design Tokens & Mobile Layout Guidance

**Typography**
* Base Font Size: `16px` (CRITICAL: Prevents iOS Safari from auto-zooming on the instruction field).
* Headers: `Fraunces`, `700` weight for major titles. `Space Grotesk`, `700` for panel headers.
* Data/Input/Workshop: `DM Mono`, `500` weight.

**Colors**
* `bg-paper`: `var(--paper)` (`#f6f1e4`) (Base app background)
* `bg-panel`: `#ffffff` (Ingredient sheets and chips)
* `accent-solid`: `var(--copper)` (`#c9643b`) (Primary buttons)
* `accent-experimental`: `var(--sky)` (`#9dc9c8`) (To clearly indicate Experimental mode is active)
* `text-ink`: `var(--ink)` (`#16251e`)
* `border-line`: `var(--line)` (`#223d33`) (For chunky, intentional borders)

**Spacing & Component Hierarchy**
* Base Unit: `8px`. Mobile gutters: `16px`.
* Layout: 
  1. Top `45vh`: `SkinViewer` (Fixed, sticky).
  2. Middle `55vh`: `LocalLibrary` Grid (`display: grid; grid-template-columns: 1fr 1fr; gap: 12px;`).
  3. Modals: `IngredientDialog` should be a `transform: translateY(0)` bottom-sheet covering the bottom `80vh` when active.

**Motion**
* Use `transform` and `opacity` exclusively for bottom-sheet sliding. 
* Keep durations under `250ms` with an `ease-out` timing function.
* Respect `@media (prefers-reduced-motion)`.

**Touch & Accessibility (44px Rule)**
* All ingredient chips, tabs, and buttons MUST have `min-height: 44px` and `min-width: 44px`.
* The "Smart Focus" brush size slider must have a thumb target of `44px`.
* Use `aria-live="polite"` for the instruction field responses (e.g., announcing "Shirt changed to dark blue").

**States**
* **Empty:** Not applicable for the avatar (starts complete), but applies to "Saved Ingredients". Use a dashed border placeholder with an explicit "Take Photo" CTA.
* **Offline:** A slim, non-blocking banner at the very top: *"Offline. Local generation active."*
* **Error:** Never clear the active canvas. Show a red-tinted toast over the ingredient sheet: *"Couldn't analyze photo. [Keep Current] [Retry]"*.

---

## 5. Roadmap Changes Required Before Coding

The current roadmap (`2026-07-10-mobile-avatar-studio-roadmap.md`) misses a critical refactoring step in Phase 1. 

**Add to Phase 1 (Solid Avatar Studio Implementation):**
* **Step 0: DOM & Architecture Refactor.** Before adding PWA support or offline capabilities, completely rewrite `index.html` and `SkinComposer`. Break the monolithic generation script into the isolated `IngredientRenderer` modules defined in the spec. Transition the CSS from the desktop side-by-side grid to the top-bottom mobile workbench layout.
* **Reasoning:** You cannot build the Experimental feature set on top of the current linear desktop form. The UI state must be decoupled into independent slots (Face, Hair, Top, etc.) before you can target them with text commands in Phase 2.

---

## 6. Using Gemini / AGY for UI Implementation

* **Exact Model:** **Gemini 3.1 Pro (High)**. This model is essential for holding the complex multi-phase constraints (WebGL, IndexedDB, mobile CSS, component boundaries) in context simultaneously.
* **Mode:** Use the **Antigravity IDE or AGY CLI** in an interactive terminal session. 
* **Agent Strategy:** 
  * Use the primary agent to draft the CSS grid refactor and DOM structure using `multi_replace_file_content`.
  * For the complex WebGL/Three.js refactoring of `SkinViewer` and `SkinComposer`, use the `invoke_subagent` tool to spawn the `self` subagent. Task the subagent specifically with rewriting the canvas compositing logic in isolation, then integrate its work.
* **Available Tools:** 
  * Use `view_file` to read the existing `app.js` and identify how Three.js is currently initialized.
  * Use `multi_replace_file_content` for surgical CSS/HTML updates.
  * Use `run_command` with local HTTP servers (e.g., `python3 -m http.server`) to validate the mobile layout, though visual checks will require human feedback. (Do not hallucinate visual/browser testing tools that don't exist in the environment).

---

## 7. Meaningful Disagreement

**Disagreement:** The specification states that the Developer Workshop uses the *same* instruction field as the user prompt to edit design tokens, typography, and spacing (e.g., typing `change primary-color to #ff0000`).

**Why this is a problem:** Typing strict configuration syntax (CSS variables, hex codes, spacing units) on a mobile software keyboard is incredibly frustrating. The auto-correct will fight the user, and the lack of precision makes it a poor experience for the developer/owner.

**What evidence would change my recommendation:**
If telemetry or user testing shows that the Developer Workshop is primarily accessed via desktop browsers (where physical keyboards make text-based config easy), then the unified text field is a brilliant, lightweight solution. 
However, if the owner intends to use the Workshop on mobile devices, I strongly recommend building a dedicated, visual Workshop overlay (sliders, color pickers, numeric steppers) that is hidden behind the password gate, rather than relying purely on natural language or strict syntax typing on mobile.
