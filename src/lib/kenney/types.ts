/**
 * Family-agnostic Kenney asset manifest schema.
 *
 * A manifest declares everything the generic renderer and animation layer need
 * for ONE pack family. If a renderer branch is ever needed for a specific
 * family, the schema is missing something — fix the schema, not the renderer.
 *
 * Coordinate space: all sizes and anchors are in "body-box units" — fractions
 * of the body box side (the body sprite is 1.0 × 1.0). The renderer multiplies
 * by the requested render size, so the exported asset resolution only affects
 * crispness, never layout.
 */

/** A part's centre in body-box fractions; (0.5, 0.5) is the body's middle. */
export interface Anchor {
  x: number;
  y: number;
  /** Multiplies the sprite's size in body-box units. */
  scale: number;
}

export interface KenneySprite {
  /**
   * Asset file basename without extension or variant suffix, e.g. 'circle'
   * resolves to `<state>.png` (fixed art) or `<state>.<variant>.png`
   * (colorable). Must match the raw pack filename so the prep script can find
   * it: raw names are `<variant>_<sourcePattern>_<asset>` (colorable) or
   * `<sourcePattern>_<asset>` (fixed).
   */
  asset: string;
  /** Sprite size in body-box units. */
  size: { w: number; h: number };
  /**
   * Raw-pack filename (no extension) override when the pack names this state
   * inconsistently (e.g. Shape Characters' yellow hands are `hand_yellow_*`
   * while every other color is `<variant>_hand_*`).
   */
  raw?: string;
  /**
   * Per-part placements hosted by this state. A part whose own `instances` is
   * empty is placed wherever the active state of its host part says (e.g. a
   * body shape declares where that shape's face and hands go). This is how
   * body-dependent placement stays family-agnostic.
   */
  places?: Record<string, KenneyPartInstance[]>;
}

/** One rendered placement of a part. */
export interface KenneyPartInstance {
  anchor: Anchor;
  /** Render a mirrored copy (scaleX -1) for the opposite side. */
  flip?: boolean;
}

export interface KenneyPart {
  id: string;
  /** Render order; lower values render behind. */
  z: number;
  /** One or more placements (e.g. hands render left + right). */
  instances: KenneyPartInstance[];
  /**
   * When true the part participates in color-variant selection: the prep
   * script exports one asset per variant (`<state>.<variant>.png`) and the
   * renderer picks the variant nearest the recipe palette. When false the part
   * is fixed art with one asset per state.
   */
  colorable: boolean;
  /** Optional — a recipe may omit this part. */
  optional?: boolean;
  /** Discrete states the pack actually provides for this part. */
  states: Record<string, KenneySprite>;
  /** Raw-pack filename pattern used by the prep script. */
  sourcePattern: string;
}

/** A color variant the pack ships (e.g. blue/green/...). */
export interface KenneyVariant {
  id: string;
  label: string;
  /** Representative RGB, used to match a recipe palette to the nearest variant. */
  rgb: [number, number, number];
}

/** A discrete animation group the pack's assets genuinely support. */
export interface KenneyAnimationGroup {
  /** Which part the group swaps (must exist in the manifest). */
  part: string;
  /** State ids to cycle through (must exist in the part's states). */
  states: string[];
  /** Base interval between swaps in ms. */
  intervalMs: number;
  /** How long to hold a non-first state before reverting (e.g. a blink). */
  holdMs?: number;
  /** True if the group should be randomized per cycle (e.g. gestures). */
  jitterMs?: number;
}

export interface KenneyFamilyManifest {
  /** Family id; the recipe's `source` must match. */
  family: string;
  label: string;
  /** Body box side in the pack's native coordinate space (e.g. 80). */
  bodyPx: number;
  /** Composite canvas in body-box units; >1 accommodates hands outside the box. */
  canvas: { w: number; h: number };
  colorVariants: KenneyVariant[];
  parts: KenneyPart[];
  animations: Record<string, KenneyAnimationGroup>;
  /**
   * Event-driven hand gestures, keyed by app action. The animation layer's
   * `gesture(state)` API plays one of these states briefly then restores the
   * recipe's default. Family-agnostic: just maps action → hand state id.
   */
  eventGestures?: Record<string, { state: string }>;
}

/** Family-agnostic recipe shape, stored on ME. */
export interface KenneyRecipe {
  source: string;
  /** part id -> chosen state id. */
  parts: Record<string, string>;
  /** Hex color used to pick the nearest color variant for colorable parts. */
  palette: string | null;
}
