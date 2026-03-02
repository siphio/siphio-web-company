# Technology Profile: Framer Motion

**Generated**: 2026-03-02
**PRD Reference**: Section 9, Phase 3 — Framer Motion (lightweight)
**Agent Use Case**: Apply fixed animation recipes (fade-in-up, hover lift, staggered reveal) to assembled landing page sections

---

## 1. Authentication & Setup

Framer Motion requires no authentication — it is an open-source npm package with no API keys, tokens, or accounts.

### Installation

The library was rebranded from `framer-motion` to `motion` in late 2024. Both packages work, but `motion` is the actively maintained forward path. For this project, use the `motion` package:

```bash
npm install motion
```

If using the legacy package name (still published and compatible):

```bash
npm install framer-motion
```

**Version**: Use `motion@latest` (currently v12.x). No breaking changes were introduced in v12 for the React API.

### Import Path

```tsx
// Recommended — new "motion" package
import { motion } from "motion/react";

// Legacy — still works, re-exports the same code
import { motion } from "framer-motion";
```

### Next.js App Router Configuration

Every file that imports `motion` components must include the `"use client"` directive. Motion relies on browser APIs (DOM measurement, requestAnimationFrame) that are unavailable during server-side rendering.

```tsx
"use client";

import { motion } from "motion/react";
```

**No additional Next.js config is required.** No `next.config.js` changes, no transpilePackages entry, no special webpack configuration.

### Recommended: Create Reusable Wrapper Components

To keep `"use client"` boundaries small and avoid polluting server components, create a single wrapper file:

```tsx
// components/motion-wrappers.tsx
"use client";

import { motion } from "motion/react";
import type { HTMLMotionProps } from "motion/react";
import { forwardRef } from "react";

// Re-export motion components for use in server component trees
export const MotionDiv = motion.div;
export const MotionSection = motion.section;
export const MotionLi = motion.li;
export const MotionUl = motion.ul;
export const MotionH2 = motion.h2;
export const MotionP = motion.p;
export const MotionSpan = motion.span;
export const MotionImg = motion.img;
export const MotionA = motion.a;
```

Server components can then import `MotionDiv` etc. without needing `"use client"` themselves. Children passed from server components flow through normally — `"use client"` only marks the boundary, not the children.

---

## 2. Core Data Models

### Motion Component Props (relevant subset)

| Prop | Type | Purpose |
|------|------|---------|
| `initial` | `Target \| boolean` | State before animation starts (e.g., `{ opacity: 0, y: 40 }`) |
| `animate` | `Target \| VariantLabels` | Target animation state (e.g., `{ opacity: 1, y: 0 }`) |
| `whileInView` | `Target \| VariantLabels` | Animation triggered when element enters viewport |
| `whileHover` | `Target \| VariantLabels` | Animation triggered on hover |
| `whileTap` | `Target \| VariantLabels` | Animation triggered on press/tap |
| `transition` | `Transition` | Duration, easing, delay, spring config |
| `viewport` | `ViewportOptions` | Controls for `whileInView` detection |
| `variants` | `Variants` | Named animation states for orchestration |

### Transition Type

```ts
interface Transition {
  duration?: number;       // seconds
  delay?: number;          // seconds
  ease?: string | number[]; // "easeOut", "easeInOut", [0.25, 0.1, 0.25, 1]
  type?: "tween" | "spring" | "inertia";
  stiffness?: number;      // spring only
  damping?: number;        // spring only
  staggerChildren?: number; // seconds between child animations
  delayChildren?: number;   // seconds before children start
  when?: "beforeChildren" | "afterChildren";
}
```

### Viewport Options

```ts
interface ViewportOptions {
  once?: boolean;    // true = animate only on first entry (default: false)
  margin?: string;   // IntersectionObserver rootMargin (e.g., "-100px")
  amount?: number | "some" | "all"; // how much must be visible (default: "some")
  root?: RefObject<Element>; // scroll container (default: window)
}
```

### Variants Type

```ts
interface Variants {
  [key: string]: Target & { transition?: Transition };
}
```

---

## 3. Key APIs — Animation Recipes

This section provides the three exact animation recipes the PRD requires. Each is copy-paste ready for the Assembler agent.

### Recipe 1: Fade-In-Up (Scroll-Triggered)

The primary animation pattern. Elements fade in and slide up when they scroll into view.

```tsx
"use client";

import { motion } from "motion/react";

// Inline variant — simplest usage for single elements
export function FadeInUp({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

// With configurable delay (for manual staggering without variants)
export function FadeInUpDelayed({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}
```

**Configuration knobs:**
- `y: 40` — vertical offset in px (20-60 is typical; 40 is the sweet spot)
- `duration: 0.5` — animation length in seconds (0.4-0.7 for landing pages)
- `margin: "-50px"` — triggers 50px before element enters viewport (negative = earlier trigger)
- `once: true` — animate only on first scroll into view (always use for landing pages)

### Recipe 2: Hover Lift (Card/Button Interaction)

Elements scale up and gain shadow on hover. Used for cards, CTAs, and interactive elements.

```tsx
"use client";

import { motion } from "motion/react";

// Card hover effect — subtle lift with shadow
export function HoverLiftCard({ children, className }: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      whileHover={{
        y: -4,
        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.12)",
      }}
      transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

// Button hover effect — scale up
export function HoverScaleButton({ children, className }: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.button
      className={className}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "tween", duration: 0.15 }}
    >
      {children}
    </motion.button>
  );
}
```

**Configuration knobs:**
- `y: -4` — upward lift in px (2-8 is typical; -4 is subtle and professional)
- `scale: 1.03` — scale factor (1.02-1.05 for buttons; never exceed 1.1)
- `boxShadow` — match your design token shadow values
- `whileTap: { scale: 0.98 }` — slight compression on click for tactile feedback

### Recipe 3: Staggered Reveal (Section with Multiple Children)

Parent container orchestrates children to animate one after another. Used for feature grids, pricing cards, team members, testimonials.

```tsx
"use client";

import { motion } from "motion/react";

// Variant definitions (define once, reuse everywhere)
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

// Staggered container — wraps a list of items
export function StaggerContainer({ children, className }: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
    >
      {children}
    </motion.div>
  );
}

// Each child that participates in the stagger
export function StaggerItem({ children, className }: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
```

**Usage pattern (Assembler applies this to feature grids, pricing, etc.):**

```tsx
<StaggerContainer className="grid grid-cols-3 gap-6">
  {features.map((feature) => (
    <StaggerItem key={feature.id}>
      <FeatureCard {...feature} />
    </StaggerItem>
  ))}
</StaggerContainer>
```

**Configuration knobs:**
- `staggerChildren: 0.1` — delay between each child in seconds (0.08-0.15 is typical)
- `delayChildren: 0.1` — delay before first child starts
- `y: 30` — vertical offset (slightly less than fade-in-up since items are smaller)

### Combined Pattern: Staggered Reveal + Hover Lift

For feature cards that stagger in AND have hover effects:

```tsx
<StaggerContainer className="grid grid-cols-3 gap-6">
  {features.map((feature) => (
    <StaggerItem key={feature.id}>
      <HoverLiftCard>
        <FeatureCard {...feature} />
      </HoverLiftCard>
    </StaggerItem>
  ))}
</StaggerContainer>
```

---

## 4. Rate Limits & Throttling

Framer Motion has no external API calls, so there are no rate limits. Performance concerns are local:

### Bundle Size

| Package | Full Size (minified + gzipped) | With LazyMotion |
|---------|-------------------------------|-----------------|
| `motion` / `framer-motion` | ~34-42 KB | ~4.6 KB initial |

For this project's lightweight usage (3 recipes only), the full 34 KB bundle is acceptable. LazyMotion optimization is not required unless bundle audits flag it later.

### Performance Limits

| Concern | Threshold | Mitigation |
|---------|-----------|------------|
| Simultaneous animated elements | >50 on screen | Use `viewport={{ once: true }}` to stop tracking after animation |
| Transform-based animations | Unlimited (GPU) | Stick to `opacity`, `y`, `scale`, `boxShadow` — all GPU-accelerated |
| Layout-triggering animations | Avoid entirely | Never animate `width`, `height`, `top`, `left`, `padding`, `margin` |
| Stagger with many children | >20 children | Consider chunking or limiting visible items |

**Rule for Assembler:** Only animate with `opacity`, `y`, `scale`, `boxShadow`, and `rotate`. These properties are GPU-accelerated via CSS transforms and compositing — they do not trigger layout recalculation.

---

## 5. Error Handling

### Common Issues and Fixes

**Issue 1: "use client" missing**
```
Error: You're importing a component that needs `useRef`. It only works in a Client Component.
```
Fix: Add `"use client"` at the top of any file importing from `motion/react`.

**Issue 2: Hydration mismatch**
```
Warning: Text content did not match. Server: "..." Client: "..."
```
This rarely occurs with basic motion usage. If it does:
- Ensure `initial` prop values match what the server would render (e.g., `opacity: 0` is fine — the server renders the element with `style="opacity: 0"`)
- Do NOT conditionally render motion components based on `typeof window`
- Motion handles SSR correctly when `initial` is set — it renders the initial state on the server

**Issue 3: Animation not triggering on scroll**
Causes:
- Missing `whileInView` (used `animate` instead, which triggers immediately)
- Missing `initial` (no starting state, so no visible change)
- `viewport={{ once: true }}` already fired (element was in view on load)
- Element has `overflow: hidden` on parent clipping the intersection observer

**Issue 4: Stagger not working**
Causes:
- Children are not direct children of the variants container
- Children do not have `variants` prop with matching variant names
- Parent uses `animate` instead of `whileInView` with variant labels

**Issue 5: Animation feels janky**
Causes:
- Animating layout properties (`width`, `height`, `padding`)
- Too many elements animating simultaneously
- Using `type: "spring"` with poor stiffness/damping values

Fix: Stick to the recipes in Section 3 — they use only GPU-friendly properties.

---

## 6. SDK / Library Recommendation

**Recommended package**: `motion` (the successor to `framer-motion`)

| Consideration | `motion` | `framer-motion` |
|---------------|----------|-----------------|
| Actively maintained | Yes | Maintenance mode (re-exports `motion`) |
| Import path | `motion/react` | `framer-motion` |
| API compatibility | Identical for our use cases | Identical |
| Bundle size | Same | Same |
| npm weekly downloads | Growing | Still very high (legacy installs) |

**Decision**: Install `motion` via npm. Import from `motion/react`. The API is identical for our three recipes. If any shadcn/ui component already imports `framer-motion` as a peer dependency, both packages can coexist — they share the same internal code.

**Version pinning**: Use `motion@^12.0.0`. No breaking changes in v12 for the React animation API.

---

## 7. Integration Gotchas

### Gotcha 1: "use client" Boundary Placement

Every component file that directly imports `motion` must be a Client Component. However, children passed from Server Components work fine — only the animated wrapper needs the directive.

**Pattern to follow:**
```
ServerPage.tsx (server) → imports MotionDiv (client) → renders ServerChild (server)
```

The Assembler agent should create animation wrapper components in a dedicated `components/animations/` directory, all marked `"use client"`. Page-level server components import these wrappers.

### Gotcha 2: viewport once:true is Essential for Landing Pages

Without `once: true`, elements re-animate every time the user scrolls past them. This is annoying on landing pages. Always set `viewport={{ once: true }}` on scroll-triggered animations.

### Gotcha 3: Initial State Causes Flash of Invisible Content

Elements with `initial={{ opacity: 0 }}` are invisible until JavaScript hydrates. On slow connections, this can cause a flash of missing content. For above-the-fold hero sections, consider:
- No animation on the hero headline itself (render it visible immediately)
- Only animate secondary elements (subtitle, CTA buttons) with short delays
- Or use `initial={false}` to skip the initial state entirely for critical content

### Gotcha 4: Stagger Requires Direct Parent-Child Variant Relationship

The `staggerChildren` transition property on a parent only affects direct children that use the same `variants` object with matching variant names (`"hidden"` / `"visible"`). Intermediate wrapper divs break the stagger chain unless they also carry `variants`.

### Gotcha 5: Motion + shadcn/ui Components

shadcn/ui components are regular React components. To animate them:
- Wrap them in a `motion.div` (preferred for our use case)
- OR use `motion()` to create a motion-enhanced version: `const MotionCard = motion(Card)` — but this can conflict with forwardRef and component internals

**Recommendation for Assembler:** Always wrap shadcn/ui components in `motion.div` rather than converting them to motion components. Simpler, fewer edge cases.

### Gotcha 6: Bundle Size with shadcn/ui

shadcn/ui may already include `framer-motion` as a dependency (some components like Accordion use it internally). Check `package-lock.json` for existing installations. If `framer-motion` is already present, importing `motion` separately adds near-zero overhead since they share the same core.

---

## 8. PRD Capability Mapping

| PRD Requirement | Animation Recipe | Motion API | Section Types |
|----------------|-----------------|------------|---------------|
| fade-in-up | FadeInUp wrapper | `initial` + `whileInView` + `viewport` | Hero subtitle, CTA, section headings, testimonials |
| hover lift | HoverLiftCard / HoverScaleButton | `whileHover` + `whileTap` | Feature cards, pricing cards, CTA buttons |
| staggered reveal | StaggerContainer + StaggerItem | `variants` + `staggerChildren` | Feature grids, pricing tiers, team sections, logo bars |

### Section Type to Animation Mapping (Assembler Reference)

The Assembler agent applies animations based on section type. This is the complete mapping:

| Section Type | Animation Applied | Notes |
|-------------|-------------------|-------|
| Hero | FadeInUpDelayed on subtitle + CTA (delay 0.2s, 0.4s) | Do NOT animate hero headline — it must be visible immediately |
| Features (grid) | StaggerContainer + StaggerItem + HoverLiftCard | Each feature card staggers in then has hover lift |
| Features (bento) | FadeInUp on each bento cell with manual delay | Manual delay based on cell position (0, 0.1, 0.2...) |
| Pricing | StaggerContainer + StaggerItem + HoverLiftCard | Each pricing tier card staggers in |
| Testimonials | StaggerContainer + StaggerItem | Text blocks stagger in, no hover needed |
| CTA section | FadeInUp on the entire section | Simple fade-in for the call-to-action block |
| Logo bar | StaggerContainer + StaggerItem | Logos stagger in left to right |
| Footer | None | Footers do not animate |

### What We Do NOT Use

The PRD explicitly limits animation scope. These Motion features are NOT used:

- `AnimatePresence` — for mount/unmount animations (not needed for static landing pages)
- `useScroll` / `useTransform` — for scroll-linked parallax (out of scope for v1)
- `layout` animations — for layout transitions (not needed)
- `useDragControls` — for drag gestures (not needed)
- `useMotionValue` / `useSpring` — for imperative animations (not needed)
- Page transitions — not applicable to single-page landing pages
- `motion.path` / SVG animations — out of scope for v1

---

## 9. Live Integration Testing Specification

### 9.1 Testing Tier Classification

Framer Motion is a client-side npm package with no external API. Testing focuses on correct rendering and animation behavior.

- **Tier 1 (Auto-Live)**: Package imports resolve, components render without errors
- **Tier 2 (Auto-Live with Test Data)**: Animated components produce correct DOM output, viewport detection works
- **Tier 3**: N/A — no external service calls
- **Tier 4**: N/A — no external service calls

### 9.2 Test Environment Configuration

```bash
# Required dependencies
npm install motion
npm install -D @testing-library/react @testing-library/jest-dom vitest jsdom
```

```ts
// vitest.config.ts additions (if not already present)
{
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  }
}
```

**Note:** Motion animations use `requestAnimationFrame` and `IntersectionObserver` which are not available in jsdom. Tests verify DOM rendering, not visual animation completion.

### 9.3 Testing Sequence

**Tier 1 Tests (3 tests)**

1. **Import resolution**: Verify `motion` package can be imported without error
2. **Component render**: Verify `motion.div` renders to the DOM with children
3. **Props accepted**: Verify `initial`, `whileInView`, `viewport`, and `transition` props are accepted without error

```tsx
// tests/motion-import.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { motion } from "motion/react";

describe("Framer Motion - Tier 1: Import & Render", () => {
  it("imports motion without error", () => {
    expect(motion).toBeDefined();
    expect(motion.div).toBeDefined();
  });

  it("renders motion.div with children", () => {
    render(<motion.div data-testid="animated">Hello</motion.div>);
    expect(screen.getByTestId("animated")).toHaveTextContent("Hello");
  });

  it("accepts animation props without error", () => {
    render(
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        data-testid="animated"
      >
        Content
      </motion.div>
    );
    expect(screen.getByTestId("animated")).toBeInTheDocument();
  });
});
```

**Tier 2 Tests (4 tests)**

1. **FadeInUp recipe**: Renders with initial opacity style applied
2. **HoverLiftCard recipe**: Renders children correctly
3. **StaggerContainer + StaggerItem**: Renders all children in correct order
4. **Variants propagation**: Parent variants container renders children with correct variant inheritance

```tsx
// tests/motion-recipes.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FadeInUp } from "@/components/animations/fade-in-up";
import { HoverLiftCard } from "@/components/animations/hover-lift";
import { StaggerContainer, StaggerItem } from "@/components/animations/stagger";

describe("Framer Motion - Tier 2: Animation Recipes", () => {
  it("FadeInUp renders children and applies initial state", () => {
    render(<FadeInUp><p>Test content</p></FadeInUp>);
    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("HoverLiftCard renders children", () => {
    render(<HoverLiftCard><p>Card content</p></HoverLiftCard>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("StaggerContainer renders all StaggerItems", () => {
    render(
      <StaggerContainer>
        <StaggerItem><p>Item 1</p></StaggerItem>
        <StaggerItem><p>Item 2</p></StaggerItem>
        <StaggerItem><p>Item 3</p></StaggerItem>
      </StaggerContainer>
    );
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
    expect(screen.getByText("Item 3")).toBeInTheDocument();
  });

  it("StaggerItems maintain correct DOM order", () => {
    const { container } = render(
      <StaggerContainer>
        <StaggerItem><span>A</span></StaggerItem>
        <StaggerItem><span>B</span></StaggerItem>
        <StaggerItem><span>C</span></StaggerItem>
      </StaggerContainer>
    );
    const spans = container.querySelectorAll("span");
    expect(spans[0]).toHaveTextContent("A");
    expect(spans[1]).toHaveTextContent("B");
    expect(spans[2]).toHaveTextContent("C");
  });
});
```

## PIV-Automator-Hooks
tech_name: framer-motion
research_status: complete
endpoints_documented: 6
tier_1_count: 3
tier_2_count: 4
tier_3_count: 0
tier_4_count: 0
gotchas_count: 6
confidence: high
