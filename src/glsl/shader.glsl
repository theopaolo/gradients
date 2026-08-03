const fragmentShader = `
#define MAX_COLORS 8
#define WAVE_COLORS 4
#define TAU 6.28318530718

varying vec2 vUv;            // 0-1 across the viewport

uniform float time;
uniform vec2 resolution;
uniform vec2 mouse;
uniform float mouseInfluence; // 0.0 when mouse interactivity is off

// --- Palette ---------------------------------------------------------------
// All four arrays are always sent full length; colorCount says how many slots
// carry real data. GLSL ES 1.0 forbids indexing a uniform array with a value
// the compiler cannot fold, so every read below happens inside a loop with
// constant bounds (a loop index counts as a constant-index-expression).
//
// Colors arrive already in OKLab — see color.js. They are uniform constants, so
// converting them here would mean redoing the same eight conversions for every
// pixel of every frame.
uniform vec3 colors[MAX_COLORS];
uniform vec2 positions[MAX_COLORS]; // blob centre in uv space, mesh mode
uniform float radii[MAX_COLORS];    // blob radius, mesh mode
uniform float stops[MAX_COLORS];    // ramp position 0-1, ramp modes
uniform int colorCount;

// Wave mode reads four slots in a fixed cycle regardless of how many colors
// exist, so the wrap is resolved on the CPU and arrives pre-expanded.
uniform vec3 waveColors[WAVE_COLORS];

// --- Mode switches ---------------------------------------------------------
// The MODE_* values are injected from the MODES array in constants.js.
uniform int mode;
uniform bool grainEnabled;

// --- Shape -----------------------------------------------------------------
uniform vec2 origin;        // ramp centre in uv space
uniform float angle;        // ramp direction, radians
uniform float spread;       // how far the ramp stretches before it clamps
uniform float softness;     // 0 linear ramp -> 1 fully eased ramp
uniform float blobSharpness;// mesh mode falloff tightness

// --- Texture ---------------------------------------------------------------
uniform float warpAmount;
uniform float warpScale;
uniform float grainAmount;

// --- Motion ----------------------------------------------------------------
uniform float speed;
uniform float frequency;
uniform float intensity;
uniform float orbitRadius;

// ---------------------------------------------------------------------------
// Color spaces
// ---------------------------------------------------------------------------

vec3 linearToSrgb(vec3 c) {
    c = max(c, 0.0);
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 oklabToLinear(vec3 lab) {
    vec3 lms = vec3(
        lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z,
        lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z,
        lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z
    );
    lms = lms * lms * lms;
    return vec3(
        dot(lms, vec3( 4.0767416621, -3.3077115913,  0.2309699292)),
        dot(lms, vec3(-1.2684380046,  2.6097574011, -0.3413193965)),
        dot(lms, vec3(-0.0041960863, -0.7034186147,  1.7076147010))
    );
}

// The one conversion that genuinely varies per pixel: the blended result on its
// way back out to the framebuffer.
vec3 fromBlend(vec3 lab) {
    return linearToSrgb(oklabToLinear(lab));
}

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
        mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}

float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
        sum += amp * valueNoise(p);
        p *= 2.03;
        amp *= 0.5;
    }
    return sum;
}

// ---------------------------------------------------------------------------
// Palette lookups
// ---------------------------------------------------------------------------

// 0 keeps segment edges crisp and linear, 1 eases them into each other.
float shapeBlend(float f) {
    return mix(f, f * f * (3.0 - 2.0 * f), clamp(softness, 0.0, 1.0));
}

// Walks the stops in order. Each segment fully overrides the running color once
// t passes it, so after the last iteration the running color is the right one:
// below the first stop nothing ever mixes in, above the last everything has.
vec3 sampleRamp(float t, bool cyclic) {
    t = clamp(t, 0.0, 1.0);

    // A conic sweep has to close back onto its first color or the seam at 0
    // degrees is a hard edge. It reserves the last slice of the circle for that
    // return trip and squeezes the palette itself into what is left.
    float reserve = cyclic ? 1.0 / float(colorCount) : 0.0;
    float lookup = t / max(1.0 - reserve, 0.0001);

    vec3 col = colors[0];

    for (int i = 0; i < MAX_COLORS - 1; i++) {
        if (i + 1 >= colorCount) break;
        float from = stops[i];
        float to = stops[i + 1];
        float f = clamp((lookup - from) / max(to - from, 0.0001), 0.0, 1.0);
        col = mix(col, colors[i + 1], shapeBlend(f));
    }

    if (cyclic) {
        float f = clamp((t - (1.0 - reserve)) / max(reserve, 0.0001), 0.0, 1.0);
        col = mix(col, colors[0], shapeBlend(f));
    }

    return col;
}

// Gaussian-weighted average of every blob. Weights are normalised, so the blobs
// overlap into genuine mixtures instead of stacking, and nowhere is left empty.
vec3 sampleMesh(vec2 uv, vec2 aspect, float t) {
    vec3 acc = vec3(0.0);
    float total = 0.0;

    for (int i = 0; i < MAX_COLORS; i++) {
        if (i >= colorCount) break;

        float fi = float(i);
        vec2 center = positions[i];

        // Slow individual drift keeps the mix alive when nothing is touched
        center += vec2(cos(t * 0.5 + fi * 1.7), sin(t * 0.4 + fi * 2.3)) * orbitRadius * 0.06;

        // Alternate blobs lean towards the pointer and away from it, which pulls
        // the mixture apart rather than dragging it around as one lump. It stays
        // a bounded offset so a blob never strays far from its own handle.
        float direction = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
        center += (mouse - 0.5) * mouseInfluence * direction * 0.6;

        float d = length((uv - center) * aspect) / max(radii[i], 0.02);
        float w = exp(-d * d * blobSharpness) + 0.0002;

        acc += colors[i] * w;
        total += w;
    }

    return acc / max(total, 0.0001);
}

// ---------------------------------------------------------------------------
// Wave mode — the original multi-origin pattern, unchanged
// ---------------------------------------------------------------------------

float wave(float phase) {
    return clamp(0.5 + sin(phase) * 0.5 * intensity, 0.0, 1.0);
}

vec3 sampleWaves(vec2 uv, float t) {
    float influence = clamp(mouseInfluence, 0.0, 0.9);

    float radiusScale1 = 0.25 * orbitRadius;
    float radiusScale2 = 0.3 * orbitRadius;
    float radiusScale3 = 0.2 * orbitRadius;

    vec2 autoOrigin1 = vec2(
        0.5 + cos(t * 0.5) * radiusScale1,
        0.5 + sin(t * 0.5) * radiusScale1);

    vec2 autoOrigin2 = vec2(
        0.5 + cos(t * 0.7 + 2.0) * radiusScale2,
        0.5 + sin(t * 0.3) * radiusScale2);

    vec2 autoOrigin3 = vec2(
        0.5 + cos(t * -0.4 + 4.0) * radiusScale3,
        0.5 + sin(t * 0.8 + 0.5) * radiusScale3);

    vec2 origin1 = mix(autoOrigin1, mouse, influence);
    vec2 origin2 = mix(autoOrigin2, vec2(1.0 - mouse.x, 1.0 - mouse.y), influence);
    vec2 origin3 = mix(autoOrigin3, vec2(mouse.y, 1.0 - mouse.x), influence);

    float dist1 = length(uv - origin1) * 2.0;
    float dist2 = length(uv - origin2) * 2.0;
    float dist3 = length(uv - origin3) * 2.0;

    float freqMult1 = 7.0 * frequency;
    float freqMult2 = 10.0 * frequency;
    float freqMult3 = 6.0 * frequency;

    float wave1_o1 = wave(dist1 * freqMult1 - t);
    float wave2_o1 = wave((uv.x - origin1.x) * 18.0 * frequency + t * 1.5);
    float wave3_o1 = wave((uv.y - origin1.y) * 12.5 * frequency - t * 0.5);
    float finalWave_o1 = (wave1_o1 * 0.5 + wave2_o1 * 0.3 + wave3_o1 * 0.2);

    float wave1_o2 = wave(dist2 * freqMult2 - t * 0.8);
    float wave2_o2 = wave((uv.x - origin2.x) * freqMult2 * 0.7 + t * 0.7);
    float wave3_o2 = wave((uv.y - origin2.y) * freqMult2 * 0.6 - t * 1.2);
    float finalWave_o2 = (wave1_o2 * 0.5 + wave2_o2 * 0.3 + wave3_o2 * 0.2);

    float wave1_o3 = wave(dist3 * freqMult3 + t * 0.6);
    float wave2_o3 = wave((uv.x - origin3.x) * freqMult3 * 0.5 - t * 1.1);
    float wave3_o3 = wave((uv.y - origin3.y) * freqMult3 * 0.6 + t * 0.9);
    float finalWave_o3 = (wave1_o3 * 0.4 + wave2_o3 * 0.4 + wave3_o3 * 0.2);

    vec3 mix1 = mix(waveColors[0], waveColors[1], finalWave_o1);
    vec3 mix2 = mix(waveColors[1], waveColors[2], finalWave_o2);
    vec3 mix3 = mix(waveColors[2], waveColors[3], finalWave_o3);
    vec3 mix4 = mix(waveColors[3], waveColors[0], finalWave_o1);

    vec3 evenPairs = mix(mix1, mix3, finalWave_o2);
    vec3 oddPairs = mix(mix2, mix4, finalWave_o3);
    return mix(evenPairs, oddPairs, finalWave_o1);
}

// ---------------------------------------------------------------------------

void main() {
    vec2 uv = vUv;
    float t = time * speed;
    float aspectRatio = resolution.x / max(resolution.y, 1.0);

    // Distances are measured in a square space so circles stay circular and
    // squares stay square on any viewport
    vec2 aspect = vec2(aspectRatio, 1.0);

    // Domain warp: bending the coordinates before the gradient is evaluated is
    // what turns a clean ramp into something organic
    if (warpAmount > 0.0) {
        vec2 wp = uv * max(warpScale, 0.01) + t * 0.05;
        vec2 offset = vec2(
            fbm(wp),
            fbm(wp + vec2(37.2, 11.7))
        ) - 0.5;
        uv += offset * warpAmount;
    }

    vec3 blended;

    if (mode == MODE_MESH) {
        blended = sampleMesh(uv, aspect, t);
    } else if (mode == MODE_WAVES) {
        blended = sampleWaves(uv, t);
    } else {
        // Ramp modes share one signed field, remapped to 0-1 for the lookup
        vec2 p = (uv - origin) * aspect;

        float ca = cos(-angle);
        float sa = sin(-angle);
        vec2 rp = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);

        // spread is normalised so 1.0 always means "the last color lands on the
        // edge of the viewport". A linear ramp spans its own rotated bounding
        // box; the closed shapes grow until they touch the nearest edge. Either
        // way the endpoint handle in handles.js sits exactly on that contour.
        vec2 halfSize = aspect * 0.5;
        float fit = mode == MODE_LINEAR
            ? abs(cos(angle)) * halfSize.x + abs(sin(angle)) * halfSize.y
            : min(halfSize.x, halfSize.y);

        float scale = max(spread, 0.01) * max(fit, 0.01);
        float ramp;
        bool cyclic = false;

        if (mode == MODE_LINEAR) {
            ramp = rp.x / scale * 0.5 + 0.5;
        } else if (mode == MODE_RADIAL) {
            ramp = length(rp) / scale;
        } else if (mode == MODE_SQUARE) {
            ramp = max(abs(rp.x), abs(rp.y)) / scale;
        } else if (mode == MODE_DIAMOND) {
            ramp = (abs(rp.x) + abs(rp.y)) / scale;
        } else {
            // Conic wraps the full circle, so it has no distance to scale and
            // ignores the scale above entirely — the panel hides spread for it.
            ramp = fract(atan(rp.y, rp.x) / TAU + 1.0);
            cyclic = true;
        }

        blended = sampleRamp(ramp, cyclic);
    }

    vec3 color = fromBlend(blended);

    // --- Texture ---
    // Fine film grain, half static and half crawling. Both this and the dither
    // below are sized in the canvas's own pixels, which are CSS pixels: see the
    // note on setPixelRatio in gradient.js.
    if (grainEnabled) {
        float staticGrain = hash21(uv * resolution * 0.5) * 2.0 - 1.0;
        float animated = hash21(uv * resolution * 0.5 + fract(t) * 91.7) * 2.0 - 1.0;
        color += mix(staticGrain, animated, 0.6) * grainAmount;
    }

    // Always-on sub-LSB dither. Costs nothing visually and breaks up the
    // banding an 8-bit framebuffer would otherwise show across a wide ramp.
    color += (hash21(gl_FragCoord.xy) - 0.5) / 255.0;

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

export default fragmentShader;
