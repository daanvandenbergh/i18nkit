/**
 * An opt-in set of inline-SVG country flags for {@link LanguagePicker}, so the common case needs no
 * `renderFlag` boilerplate: pass the shipped {@link localeFlag} helper and every locale that maps to
 * a known flag draws one.
 *
 * Inline SVG (not emoji flags) because emoji flags render as bare letters on Windows/Chrome. Every
 * flag is drawn in the same flat, rounded "chip" style - a uniform 4:3 rounded rectangle with a
 * hairline border for edge definition on light surfaces - so a picker of mixed languages reads as
 * one clean, consistent set.
 *
 * Flags are keyed by ISO 3166-1 region code, and a locale string is resolved to a region by
 * {@link resolveFlagRegion}: an explicit region subtag wins (`pt-BR` -> Brazil), otherwise the
 * language's conventional region is used (`pt` -> Portugal, `en` -> United Kingdom). A locale with
 * no known flag renders nothing, so the picker falls back to its label - never a broken image.
 */
import { useId } from "react";
import type { ReactElement, ReactNode } from "react";

/**
 * A flag's drawing recipe, resolved by {@link Flag}. Most flags are pure geometry expressed as
 * data (bands or a Nordic cross) so they need no bespoke component; the few with emblems ship a
 * `custom` renderer. Exactly one key is present.
 */
type FlagSpec =
    | { readonly h: readonly string[] }
    | { readonly v: readonly string[] }
    | { readonly hw: ReadonlyArray<readonly [color: string, weight: number]> }
    | { readonly nordic: { readonly field: string; readonly cross: string; readonly inner?: string } }
    | { readonly custom: (props: { size: number }) => ReactElement };

/** Border stroke shared by every chip, for edge definition on light surfaces. */
const CHIP_BORDER = "rgba(11, 27, 54, 0.14)";

/**
 * The shared chip frame: a 60x45 `viewBox`, rounded corners that clip the content, and a hairline
 * border. Every flag renders its content inside this so they all share one shape.
 *
 * @param props.size - the rendered width in px (height is 3/4 of it).
 * @param props.children - the flag's inner SVG content, clipped to the rounded rectangle.
 * @returns the framed flag SVG.
 */
function FlagChip({ size, children }: { size: number; children: ReactNode }): ReactElement {
    const uid = useId();
    const clip = `i18nkit-flag-${uid}`;
    return (
        <svg
            width={size}
            height={(size * 3) / 4}
            viewBox="0 0 60 45"
            role="img"
            aria-hidden
            focusable={false}
            style={{ display: "block" }}
        >
            <clipPath id={clip}>
                <rect width={60} height={45} rx={7} />
            </clipPath>
            <g clipPath={`url(#${clip})`}>{children}</g>
            <rect
                x={0.6}
                y={0.6}
                width={58.8}
                height={43.8}
                rx={6.4}
                fill="none"
                stroke={CHIP_BORDER}
                strokeWidth={1.2}
            />
        </svg>
    );
}

/** Unit five-point star path (outer radius 1, pointing up); scaled/positioned via {@link Star}. */
const STAR_PATH =
    "M0,-1 L0.2245,-0.309 L0.9511,-0.309 L0.3633,0.118 L0.5878,0.809 " +
    "L0,0.382 L-0.5878,0.809 L-0.3633,0.118 L-0.9511,-0.309 L-0.2245,-0.309 Z";

/**
 * A filled five-point star.
 *
 * @param props.cx - centre x in `viewBox` units.
 * @param props.cy - centre y in `viewBox` units.
 * @param props.r - outer radius in `viewBox` units.
 * @param props.fill - fill colour.
 * @param props.rotate - clockwise rotation in degrees (default 0, a point facing up).
 * @returns the star path element.
 */
function Star({
    cx,
    cy,
    r,
    fill,
    rotate = 0,
}: {
    cx: number;
    cy: number;
    r: number;
    fill: string;
    rotate?: number;
}): ReactElement {
    return <path d={STAR_PATH} fill={fill} transform={`translate(${cx} ${cy}) rotate(${rotate}) scale(${r})`} />;
}

/**
 * Equal horizontal bands, top to bottom. Bands overlap by a hair to avoid anti-alias seams.
 *
 * @param colors - the band colours, top-first.
 * @returns the band rects.
 */
function horizontalBands(colors: readonly string[]): ReactElement {
    const h = 45 / colors.length;
    return (
        <>
            {colors.map((color, i) => (
                <rect key={i} y={i * h} width={60} height={h + 0.3} fill={color} />
            ))}
        </>
    );
}

/**
 * Equal vertical bands, hoist (left) to fly (right). Bands overlap by a hair to avoid seams.
 *
 * @param colors - the band colours, hoist-first.
 * @returns the band rects.
 */
function verticalBands(colors: readonly string[]): ReactElement {
    const w = 60 / colors.length;
    return (
        <>
            {colors.map((color, i) => (
                <rect key={i} x={i * w} width={w + 0.3} height={45} fill={color} />
            ))}
        </>
    );
}

/**
 * Weighted horizontal bands, top to bottom - for flags whose stripes are unequal (e.g. Spain's
 * 1:2:1, Thailand's 1:1:2:1:1).
 *
 * @param bands - `[color, weight]` pairs, top-first; weights are relative.
 * @returns the band rects.
 */
function weightedHorizontalBands(bands: ReadonlyArray<readonly [string, number]>): ReactElement {
    const total = bands.reduce((sum, [, weight]) => sum + weight, 0);
    let y = 0;
    return (
        <>
            {bands.map(([color, weight], i) => {
                const h = (weight / total) * 45;
                const rect = <rect key={i} y={y} width={60} height={h + 0.3} fill={color} />;
                y += h;
                return rect;
            })}
        </>
    );
}

/**
 * A Nordic (off-centre) cross: a full field with a cross whose vertical bar sits left of centre.
 * When `inner` is given the cross is drawn twice - a wide `cross`-coloured border under a narrow
 * `inner` bar - for the bordered crosses (Norway, Iceland).
 *
 * @param field - the field (background) colour.
 * @param cross - the cross colour (the border colour when `inner` is set).
 * @param inner - optional inner-bar colour for a bordered cross.
 * @returns the field and cross rects.
 */
function nordicCross(field: string, cross: string, inner?: string): ReactElement {
    return (
        <>
            <rect width={60} height={45} fill={field} />
            {inner !== undefined ? (
                <>
                    <rect x={12} width={12} height={45} fill={cross} />
                    <rect y={16.5} width={60} height={12} fill={cross} />
                    <rect x={15} width={6} height={45} fill={inner} />
                    <rect y={19.5} width={60} height={6} fill={inner} />
                </>
            ) : (
                <>
                    <rect x={14} width={8} height={45} fill={cross} />
                    <rect y={18.5} width={60} height={8} fill={cross} />
                </>
            )}
        </>
    );
}

/** The United Kingdom (Union Jack): a blue field, white then counterchanged-red saltire, and cross. */
function UnitedKingdom({ size }: { size: number }): ReactElement {
    const uid = useId();
    const counter = `i18nkit-uk-${uid}`;
    return (
        <FlagChip size={size}>
            <rect width={60} height={45} fill="#012169" />
            <clipPath id={counter}>
                <path d="M30,22.5 h30 v22.5 z v22.5 h-30 z h-30 v-22.5 z v-22.5 h30 z" />
            </clipPath>
            <path d="M0,0 L60,45 M60,0 L0,45" stroke="#fff" strokeWidth={9} />
            <path d="M0,0 L60,45 M60,0 L0,45" clipPath={`url(#${counter})`} stroke="#C8102E" strokeWidth={4} />
            <path d="M30,0 v45 M0,22.5 h60" stroke="#fff" strokeWidth={15} />
            <path d="M30,0 v45 M0,22.5 h60" stroke="#C8102E" strokeWidth={9} />
        </FlagChip>
    );
}

/** The United States: 13 red/white stripes and a blue canton. ponytail: neat star grid, not the exact 50. */
function UnitedStates({ size }: { size: number }): ReactElement {
    const stripeH = 45 / 13;
    const cantonH = stripeH * 7;
    const rows = [4, 8, 12, 16, 20];
    return (
        <FlagChip size={size}>
            <rect width={60} height={45} fill="#B22234" />
            {Array.from({ length: 6 }, (_, i) => (
                <rect key={i} y={stripeH * (2 * i + 1)} width={60} height={stripeH + 0.3} fill="#fff" />
            ))}
            <rect width={24} height={cantonH} fill="#3C3B6E" />
            {rows.flatMap((y, r) => {
                const cols = r % 2 === 0 ? [2.4, 7.2, 12, 16.8, 21.6] : [4.8, 9.6, 14.4, 19.2];
                return cols.map((x, c) => <Star key={`${r}-${c}`} cx={x} cy={y} r={1.3} fill="#fff" />);
            })}
        </FlagChip>
    );
}

/** Spain: red/yellow/red horizontal bands in a 1:2:1 ratio. ponytail: coat of arms omitted. */
function Spain({ size }: { size: number }): ReactElement {
    return <FlagChip size={size}>{weightedHorizontalBands([["#AA151B", 1], ["#F1BF00", 2], ["#AA151B", 1]])}</FlagChip>;
}

/** Portugal: green/red vertical split with a simplified armillary-and-shield emblem. ponytail: emblem simplified. */
function Portugal({ size }: { size: number }): ReactElement {
    return (
        <FlagChip size={size}>
            <rect width={24} height={45} fill="#046A38" />
            <rect x={24} width={36} height={45} fill="#DA020E" />
            <circle cx={24} cy={22.5} r={6} fill="none" stroke="#FFE800" strokeWidth={1.4} />
            <circle cx={24} cy={22.5} r={3.4} fill="#fff" />
            <rect x={22.3} y={19.6} width={3.4} height={5.8} rx={0.6} fill="#DA020E" />
        </FlagChip>
    );
}

/** Czechia: white over red with a blue triangle from the hoist. */
function Czechia({ size }: { size: number }): ReactElement {
    return (
        <FlagChip size={size}>
            <rect width={60} height={22.5} fill="#fff" />
            <rect y={22.5} width={60} height={22.5} fill="#D7141A" />
            <path d="M0,0 L30,22.5 L0,45 Z" fill="#11457E" />
        </FlagChip>
    );
}

/** Greece: nine blue/white stripes with a blue canton bearing a white cross. */
function Greece({ size }: { size: number }): ReactElement {
    const stripe = 45 / 9;
    return (
        <FlagChip size={size}>
            <rect width={60} height={45} fill="#0D5EAF" />
            {Array.from({ length: 4 }, (_, i) => (
                <rect key={i} y={stripe * (2 * i + 1)} width={60} height={stripe + 0.3} fill="#fff" />
            ))}
            <rect width={stripe * 5} height={stripe * 5} fill="#0D5EAF" />
            <rect x={stripe * 2} width={stripe} height={stripe * 5} fill="#fff" />
            <rect y={stripe * 2} width={stripe * 5} height={stripe} fill="#fff" />
        </FlagChip>
    );
}

/** Switzerland: a bold white cross on red. ponytail: square flag drawn on the shared 4:3 chip. */
function Switzerland({ size }: { size: number }): ReactElement {
    return (
        <FlagChip size={size}>
            <rect width={60} height={45} fill="#D52B1E" />
            <rect x={26} y={10.5} width={8} height={24} fill="#fff" />
            <rect x={18} y={18.5} width={24} height={8} fill="#fff" />
        </FlagChip>
    );
}

/** Japan: a red disc centred on white. */
function Japan({ size }: { size: number }): ReactElement {
    return (
        <FlagChip size={size}>
            <rect width={60} height={45} fill="#fff" />
            <circle cx={30} cy={22.5} r={9} fill="#BC002D" />
        </FlagChip>
    );
}

/** China: one large and four small yellow stars in the canton of a red field. */
function China({ size }: { size: number }): ReactElement {
    return (
        <FlagChip size={size}>
            <rect width={60} height={45} fill="#DE2910" />
            <Star cx={10} cy={9.5} r={5.5} fill="#FFDE00" />
            <Star cx={19.5} cy={4} r={1.9} fill="#FFDE00" rotate={20} />
            <Star cx={23} cy={8.5} r={1.9} fill="#FFDE00" rotate={45} />
            <Star cx={23} cy={14} r={1.9} fill="#FFDE00" rotate={70} />
            <Star cx={19.5} cy={18} r={1.9} fill="#FFDE00" rotate={20} />
        </FlagChip>
    );
}

/** Vietnam: a large yellow star centred on red. */
function Vietnam({ size }: { size: number }): ReactElement {
    return (
        <FlagChip size={size}>
            <rect width={60} height={45} fill="#DA251D" />
            <Star cx={30} cy={22.5} r={12} fill="#FFFF00" />
        </FlagChip>
    );
}

/** Turkey: a white crescent and star on red. */
function Turkey({ size }: { size: number }): ReactElement {
    return (
        <FlagChip size={size}>
            <rect width={60} height={45} fill="#E30A17" />
            <circle cx={22} cy={22.5} r={10} fill="#fff" />
            <circle cx={25.5} cy={22.5} r={8} fill="#E30A17" />
            <Star cx={37} cy={22.5} r={4.6} fill="#fff" rotate={-18} />
        </FlagChip>
    );
}

/** South Korea: the red/blue taegeuk with four black trigrams. ponytail: trigram bars drawn solid. */
function SouthKorea({ size }: { size: number }): ReactElement {
    /** Three short parallel black bars (a simplified trigram) at a corner, angled toward centre. */
    function Bars({ x, y, angle }: { x: number; y: number; angle: number }): ReactElement {
        return (
            <g transform={`translate(${x} ${y}) rotate(${angle})`} fill="#000">
                <rect x={-4.5} y={-2.7} width={9} height={1.3} />
                <rect x={-4.5} y={-0.65} width={9} height={1.3} />
                <rect x={-4.5} y={1.4} width={9} height={1.3} />
            </g>
        );
    }
    return (
        <FlagChip size={size}>
            <rect width={60} height={45} fill="#fff" />
            <circle cx={30} cy={22.5} r={9} fill="#003478" />
            <path
                d="M30,13.5 A9,9 0 0,1 30,31.5 A4.5,4.5 0 0,1 30,22.5 A4.5,4.5 0 0,0 30,13.5 Z"
                fill="#C60C30"
            />
            <Bars x={12} y={10} angle={-34} />
            <Bars x={48} y={10} angle={34} />
            <Bars x={12} y={35} angle={34} />
            <Bars x={48} y={35} angle={-34} />
        </FlagChip>
    );
}

/** India: saffron/white/green bands with a navy Ashoka chakra. */
function India({ size }: { size: number }): ReactElement {
    return (
        <FlagChip size={size}>
            {horizontalBands(["#FF9933", "#fff", "#138808"])}
            <g stroke="#000080" strokeWidth={0.5}>
                {Array.from({ length: 12 }, (_, k) => (
                    <line key={k} x1={30} y1={22.5} x2={30} y2={18.1} transform={`rotate(${k * 30} 30 22.5)`} />
                ))}
            </g>
            <circle cx={30} cy={22.5} r={4.4} fill="none" stroke="#000080" strokeWidth={1} />
            <circle cx={30} cy={22.5} r={0.9} fill="#000080" />
        </FlagChip>
    );
}

/** Israel: two blue stripes and a Star of David on white. */
function Israel({ size }: { size: number }): ReactElement {
    return (
        <FlagChip size={size}>
            <rect width={60} height={45} fill="#fff" />
            <rect y={9} width={60} height={4.2} fill="#0038B8" />
            <rect y={31.8} width={60} height={4.2} fill="#0038B8" />
            <path d="M30,16 L37.5,29 L22.5,29 Z" fill="none" stroke="#0038B8" strokeWidth={1.3} />
            <path d="M30,29 L37.5,16 L22.5,16 Z" fill="none" stroke="#0038B8" strokeWidth={1.3} />
        </FlagChip>
    );
}

/** Brazil: a yellow rhombus and blue disc on green. ponytail: constellation and banner omitted. */
function Brazil({ size }: { size: number }): ReactElement {
    return (
        <FlagChip size={size}>
            <rect width={60} height={45} fill="#009C3B" />
            <path d="M30,6 L54,22.5 L30,39 L6,22.5 Z" fill="#FFDF00" />
            <circle cx={30} cy={22.5} r={8.5} fill="#002776" />
        </FlagChip>
    );
}

/**
 * Every known flag, keyed by lowercase ISO 3166-1 region code. Simple flags are data (bands or a
 * Nordic cross); emblem flags carry a `custom` renderer. Add a region here and, if bare language
 * codes should reach it, an entry in {@link DEFAULT_REGION_BY_LANGUAGE}.
 */
const FLAG_BY_REGION: Record<string, FlagSpec> = {
    gb: { custom: UnitedKingdom },
    us: { custom: UnitedStates },
    nl: { h: ["#AE1C28", "#fff", "#21468B"] },
    de: { h: ["#000000", "#DD0000", "#FFCE00"] },
    ru: { h: ["#fff", "#0039A6", "#D52B1E"] },
    hu: { h: ["#CD2A3E", "#fff", "#436F4D"] },
    bg: { h: ["#fff", "#00966E", "#D62612"] },
    at: { h: ["#ED2939", "#fff", "#ED2939"] },
    lt: { h: ["#FDB913", "#006A44", "#C1272D"] },
    ee: { h: ["#0072CE", "#000000", "#fff"] },
    pl: { h: ["#fff", "#DC143C"] },
    ua: { h: ["#0057B7", "#FFD700"] },
    id: { h: ["#FF0000", "#fff"] },
    lv: { hw: [["#9E3039", 2], ["#fff", 1], ["#9E3039", 2]] },
    es: { custom: Spain },
    th: { hw: [["#A51931", 1], ["#F4F5F8", 1], ["#2D2A4A", 2], ["#F4F5F8", 1], ["#A51931", 1]] },
    fr: { v: ["#002395", "#fff", "#ED2939"] },
    it: { v: ["#008C45", "#F4F5F0", "#CD212A"] },
    ie: { v: ["#169B62", "#fff", "#FF883E"] },
    be: { v: ["#000000", "#FDDA24", "#EF3340"] },
    ro: { v: ["#002B7F", "#FCD116", "#CE1126"] },
    se: { nordic: { field: "#006AA7", cross: "#FECC00" } },
    dk: { nordic: { field: "#C8102E", cross: "#fff" } },
    fi: { nordic: { field: "#fff", cross: "#003580" } },
    no: { nordic: { field: "#EF2B2D", cross: "#fff", inner: "#002868" } },
    is: { nordic: { field: "#02529C", cross: "#fff", inner: "#DC1E35" } },
    pt: { custom: Portugal },
    cz: { custom: Czechia },
    gr: { custom: Greece },
    ch: { custom: Switzerland },
    jp: { custom: Japan },
    cn: { custom: China },
    vn: { custom: Vietnam },
    tr: { custom: Turkey },
    kr: { custom: SouthKorea },
    in: { custom: India },
    il: { custom: Israel },
    br: { custom: Brazil },
};

/**
 * The conventional flag region for a bare language subtag (no region in the locale), so `de` shows
 * Germany, `en` the United Kingdom, `pt` Portugal. A region subtag in the locale always overrides
 * this (see {@link resolveFlagRegion}).
 */
const DEFAULT_REGION_BY_LANGUAGE: Record<string, string> = {
    en: "gb",
    nl: "nl",
    de: "de",
    ru: "ru",
    hu: "hu",
    bg: "bg",
    lt: "lt",
    et: "ee",
    pl: "pl",
    uk: "ua",
    id: "id",
    lv: "lv",
    es: "es",
    th: "th",
    fr: "fr",
    it: "it",
    ga: "ie",
    ro: "ro",
    sv: "se",
    da: "dk",
    fi: "fi",
    nb: "no",
    nn: "no",
    no: "no",
    is: "is",
    pt: "pt",
    cs: "cz",
    el: "gr",
    ja: "jp",
    zh: "cn",
    vi: "vn",
    tr: "tr",
    ko: "kr",
    hi: "in",
    he: "il",
};

/**
 * Resolve a locale string to a known flag region, or `undefined` when none matches.
 *
 * A region subtag present in the locale wins when we have that flag (`pt-BR` -> `br`, `de-CH` ->
 * `ch`); a region we do not ship a flag for is ignored and resolution falls back to the language's
 * conventional region (`es-MX` -> `es`, `en-CA` -> `gb`). Script subtags (`zh-Hans`) are skipped.
 *
 * @param locale - a BCP-47-ish locale code (`-` or `_` separated, any case).
 * @returns the lowercase region code of a known flag, or `undefined`.
 */
function resolveFlagRegion(locale: string): string | undefined {
    const parts = locale.toLowerCase().split(/[-_]/);
    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (part && part.length === 2 && /^[a-z]{2}$/.test(part) && part in FLAG_BY_REGION) {
            return part;
        }
    }
    const region = DEFAULT_REGION_BY_LANGUAGE[parts[0] ?? ""];
    return region !== undefined && region in FLAG_BY_REGION ? region : undefined;
}

/** Render one band/nordic {@link FlagSpec} inside a chip. Custom specs are handled by {@link flagNode}. */
function BandFlag({ spec, size }: { spec: FlagSpec; size: number }): ReactElement {
    let content: ReactElement;
    if ("h" in spec) {
        content = horizontalBands(spec.h);
    } else if ("v" in spec) {
        content = verticalBands(spec.v);
    } else if ("hw" in spec) {
        content = weightedHorizontalBands(spec.hw);
    } else if ("nordic" in spec) {
        content = nordicCross(spec.nordic.field, spec.nordic.cross, spec.nordic.inner);
    } else {
        // Custom specs never reach here; flagNode dispatches them.
        content = <></>;
    }
    return <FlagChip size={size}>{content}</FlagChip>;
}

/**
 * The flag element for a locale, or `null` when no known flag matches (so callers render nothing).
 *
 * @param code - the locale code to resolve.
 * @param size - the rendered width in px.
 * @returns the flag element, or `null`.
 */
function flagNode(code: string, size: number): ReactElement | null {
    const region = resolveFlagRegion(code);
    if (region === undefined) {
        return null;
    }
    const spec = FLAG_BY_REGION[region];
    if (spec === undefined) {
        return null;
    }
    if ("custom" in spec) {
        const Custom = spec.custom;
        return <Custom size={size} />;
    }
    return <BandFlag spec={spec} size={size} />;
}

/**
 * The flag for a locale, drawn as a flat rounded chip - or nothing when no known flag matches.
 *
 * @param props.code - the locale code (e.g. `"en"`, `"pt-BR"`, `"de-CH"`).
 * @param props.size - the rendered width in px (default 20; height is 3/4 of it).
 * @returns the flag SVG, or `null` for an unknown locale.
 */
export function Flag({ code, size = 20 }: { code: string; size?: number }): ReactElement | null {
    return flagNode(code, size);
}

/**
 * A ready-made `renderFlag` for {@link LanguagePicker}: `<LanguagePicker renderFlag={localeFlag} />`.
 * Returns the built-in flag for the locale, or `null` for locales without one (the picker then
 * shows just the label).
 *
 * @param locale - the locale code to draw a flag for.
 * @returns the flag node, or `null`.
 */
export function localeFlag(locale: string): ReactNode {
    return flagNode(locale, 20);
}
