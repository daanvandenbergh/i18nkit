/**
 * scribekit :: hero settings (SEED)
 * ===============================
 * The skill copies this file to your blog content dir as `hero.settings.js`, then recolours the
 * palette and swaps the brand identity to match your site (see hero_image.md). It is the ONE place
 * your project defines how heroes look; the design/layout lives in the skill's `hero.js`, and each
 * post's text lives in its own `<slug>/hero.js`. Edit freely, then run `regenerate-heroes` to
 * re-render every hero with your changes.
 *
 * Exports:
 *   - brand     - font, badge/logo, eyebrow, and default byline shared by every hero.
 *   - gradients - the named background options a post picks from (6 techniques over one palette).
 */

/**
 * The brand palette: `R, G, B` triplets, reused opaque (`rgb(...)`) and as same-hue zero-alpha
 * fades (`rgba(..., 0)`) so gradients never band. Recolour these to your site's tokens - keep one
 * distinct hue per slot and a dark `violetDeep` so white hero text stays legible.
 *
 * @prop c.pink {string} Light accent hue that blooms in from a corner (`R, G, B`).
 * @prop c.lilac {string} Light accent hue that blooms in from a corner (`R, G, B`).
 * @prop c.peach {string} Light accent hue that blooms in from a corner (`R, G, B`).
 * @prop c.blue {string} Light accent hue that blooms in from a corner (`R, G, B`).
 * @prop c.violet {string} The base ramp's lightest violet (`R, G, B`).
 * @prop c.violetMid {string} The base ramp's mid violet (`R, G, B`).
 * @prop c.violetDeep {string} The base ramp's darkest violet (`R, G, B`); keep it dark so white text stays legible.
 */
const c = {
    pink: "255, 194, 224",
    lilac: "201, 184, 255",
    peach: "255, 214, 168",
    blue: "184, 224, 255",
    violet: "143, 107, 255",
    violetMid: "107, 75, 214",
    violetDeep: "74, 47, 174",
};

/**
 * Wraps a palette triplet as an opaque `rgb(...)` colour.
 * @param t {string} An `R, G, B` triplet (e.g. `"143, 107, 255"`).
 * @returns {string} The `rgb(R, G, B)` CSS colour.
 */
const rgb = (t) => `rgb(${t})`;
/**
 * Wraps a palette triplet as a same-hue, zero-alpha `rgba(..., 0)` fade (banding-free).
 * @param t {string} An `R, G, B` triplet (e.g. `"143, 107, 255"`).
 * @returns {string} The `rgba(R, G, B, 0)` CSS colour.
 */
const fade = (t) => `rgba(${t}, 0)`;

/**
 * Brand identity baked into every hero (shared by every post). Recolour/rebrand this to your project.
 *
 * @prop brand.font {object} The webfont applied to all hero text.
 * @prop brand.font.family {string} CSS `font-family` name to apply (e.g. `"Space Grotesk"`).
 * @prop brand.font.url {string} Stylesheet URL that serves the family (e.g. a Google Fonts link); loaded once per render.
 * @prop brand.badge {string|object} Your logo/mark for the eyebrow badge - EITHER an inline SVG/glyph
 *     string, OR a `{ src }` image resolved relative to THIS file so it loads in the headless render,
 *     e.g. `{ src: new URL("../public/logo/logo-rounded.png", import.meta.url).href }`.
 * @prop brand.badge.src {string} Image URL, when `badge` is an object.
 * @prop brand.accent {string} `R, G, B` triplet for an inline-SVG badge glyph's colour (ignored for image logos).
 * @prop brand.eyebrow {string} The uppercase site/brand name shown above the title.
 * @prop brand.byline {object} Default byline fields. Optional. A hero shows a byline only when its post
 *     defines `byline`; this default then fills in any field the post omits (e.g. a shared avatar). A post
 *     with no `byline` renders without one, so setting this never forces a byline onto every hero.
 * @prop brand.byline.name {string} Author display name shown next to the avatar.
 * @prop brand.byline.role {string} Author role/title shown under the name.
 * @prop brand.byline.avatar {string|object} Author avatar shown in the byline - an inline SVG string, OR a
 *     `{ src }` image resolved like `badge` (e.g. `{ src: new URL("../public/assets/authors/jane.svg", import.meta.url).href }`).
 *     Falls back to the brand `badge` when omitted.
 * @prop brand.byline.avatar.src {string} Image URL, when `avatar` is an object.
 */
export const brand = {
    font: { family: "Space Grotesk", url: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" },
    badge: "文",
    accent: "107, 75, 214",
    eyebrow: "I18NKIT",
    byline: { name: "Author Name", role: "" },
};

/**
 * The gradient options a post picks from. The 6 recipes are different constructions over the SAME
 * palette slots, so the family stays cohesive when you recolour the palette. Tune a recipe's stop
 * positions here if needed; keep the palette mapping consistent across all six.
 *
 * @prop gradients {object[]} The named background options (6 of them); a post picks one by `name`.
 * @prop gradients[].name {string} The gradient's identifier - one of `radial-mesh`, `diagonal-ribbon`,
 *     `aurora-glow`, `soft-sweep`, `horizon-glow`, `veil`.
 * @prop gradients[].css {string} A full CSS `background` value built from the palette above.
 */
export const gradients = [
    {
        name: "radial-mesh",
        css: [
            `radial-gradient(120% 120% at 12% 8%, ${rgb(c.pink)} 0%, ${fade(c.pink)} 46%)`,
            `radial-gradient(90% 90% at 88% -6%, ${rgb(c.lilac)} 0%, ${fade(c.lilac)} 42%)`,
            `radial-gradient(120% 120% at 96% 96%, ${rgb(c.peach)} 0%, ${fade(c.peach)} 46%)`,
            `radial-gradient(120% 120% at 4% 104%, ${rgb(c.blue)} 0%, ${fade(c.blue)} 48%)`,
            `linear-gradient(135deg, ${rgb(c.violet)} 0%, ${rgb(c.violetMid)} 60%, ${rgb(c.violetDeep)} 100%)`,
        ].join(", "),
    },
    {
        name: "diagonal-ribbon",
        css: `linear-gradient(118deg, ${rgb(c.violetDeep)} 0%, ${rgb(c.violetMid)} 14%, ${rgb(c.violet)} 28%, ${rgb(c.lilac)} 46%, ${rgb(c.pink)} 64%, ${rgb(c.peach)} 82%, ${rgb(c.blue)} 100%)`,
    },
    {
        name: "aurora-glow",
        css: [
            `radial-gradient(120% 100% at 50% -18%, ${rgb(c.lilac)} 0%, ${fade(c.lilac)} 55%)`,
            `radial-gradient(100% 90% at 92% 112%, ${rgb(c.pink)} 0%, ${fade(c.pink)} 52%)`,
            `radial-gradient(90% 90% at 8% 104%, ${rgb(c.blue)} 0%, ${fade(c.blue)} 48%)`,
            `linear-gradient(160deg, ${rgb(c.violet)} 0%, ${rgb(c.violetMid)} 55%, ${rgb(c.violetDeep)} 100%)`,
        ].join(", "),
    },
    {
        name: "soft-sweep",
        css: `linear-gradient(140deg, ${rgb(c.violetDeep)} 0%, ${rgb(c.violet)} 30%, ${rgb(c.lilac)} 56%, ${rgb(c.pink)} 80%, ${rgb(c.peach)} 100%)`,
    },
    {
        name: "horizon-glow",
        css: [
            `radial-gradient(130% 90% at 100% 100%, ${rgb(c.peach)} 0%, ${fade(c.peach)} 40%)`,
            `radial-gradient(120% 100% at 100% 100%, ${rgb(c.pink)} 0%, ${fade(c.pink)} 55%)`,
            `radial-gradient(110% 90% at 0% 0%, ${rgb(c.blue)} 0%, ${fade(c.blue)} 46%)`,
            `linear-gradient(120deg, ${rgb(c.violetMid)} 0%, ${rgb(c.violet)} 45%, ${rgb(c.lilac)} 100%)`,
        ].join(", "),
    },
    {
        name: "veil",
        css: [
            `radial-gradient(120% 100% at 8% 10%, ${rgb(c.blue)} 0%, ${fade(c.blue)} 44%)`,
            `radial-gradient(120% 110% at 100% 30%, ${rgb(c.pink)} 0%, ${fade(c.pink)} 50%)`,
            `radial-gradient(110% 100% at 55% 115%, ${rgb(c.peach)} 0%, ${fade(c.peach)} 48%)`,
            `linear-gradient(125deg, ${rgb(c.violet)} 0%, ${rgb(c.violetMid)} 55%, ${rgb(c.violetDeep)} 100%)`,
        ].join(", "),
    },
];
