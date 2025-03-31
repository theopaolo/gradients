const fragmentShader = `
varying vec2 vUv;        // Input: UV coordinates from vertex shader (0.0 to 1.0)
uniform float time;      // Input: Time value from JavaScript (for animation)
uniform vec2 resolution; // Input: Canvas resolution
uniform vec2 mouse;

// --- Helper Functions ---

// Converts RGB values (0-255) to normalized vec3 (0.0-1.0)
vec3 rgb(float r, float g, float b) {
    return vec3(r, g, b) / 255.0;
}

// Pseudo-random noise function based on input coordinates 'st' and time
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233)) + time * 15.0) * 43758.5453);
}

// Smoothstep function to create smoother transitions
float smoothTransition(float value, float minThreshold, float maxThreshold) {
    return smoothstep(minThreshold, maxThreshold, value);
}

// --- Main Shader Logic ---

void main() {
    // --- Setup ---
    vec2 uv = vUv;
    float slowTime = time * 0.35; // Adjusted slow time

    // --- Mouse Influence Parameters ---
    float baseMouseInfluence = 0.3; // Base mouse influence
    float mouseInfluence = baseMouseInfluence;
    mouseInfluence = clamp(mouseInfluence, 0.0, 0.9);
    float autonomyFactor = 1.0 - mouseInfluence;

    // --- Multi-Origin Wave Pattern Calculation ---
    // Base radius values
    float radiusScale1 = 0.25;
    float radiusScale2 = 0.3;
    float radiusScale3 = 0.2;

    // Calculate origin positions for waves
    vec2 autoOrigin1 = vec2(
        0.5 + cos(time * 0.5) * radiusScale1,
        0.5 + sin(time * 0.5) * radiusScale1);

    vec2 autoOrigin2 = vec2(
        0.5 + cos(time * 0.7 + 2.0) * radiusScale2,
        0.5 + sin(time * 0.3) * radiusScale2);

    vec2 autoOrigin3 = vec2(
        0.5 + cos(time * -0.4 + 4.0) * radiusScale3,
        0.5 + sin(time * 0.8 + 0.5) * radiusScale3);

    // Define 3 origins with unique movements
    vec2 origin1 = mix(autoOrigin1, mouse, mouseInfluence);

    // Origin 2: Inverse relationship to mouse (moves away from mouse)
    vec2 inverseMousePos = vec2(1.0 - mouse.x, 1.0 - mouse.y);
    vec2 origin2 = mix(autoOrigin2, inverseMousePos, mouseInfluence);

    // Origin 3: Orbital relationship (moves perpendicular to mouse direction)
    vec2 orbitalMouse = vec2(mouse.y, 1.0 - mouse.x); // 90-degree rotation
    vec2 origin3 = mix(autoOrigin3, orbitalMouse, mouseInfluence);

    // Calculate distances to origins
    float dist1 = length(uv - origin1) * 2.0;
    float dist2 = length(uv - origin2) * 2.0;
    float dist3 = length(uv - origin3) * 2.0;

    // Base frequencies
    float freqMult1 = 7.0;
    float freqMult2 = 10.0;
    float freqMult3 = 6.0;

    // Origin 1 waves
    float wave1_o1 = sin(dist1 * freqMult1 - time) * 0.5 + 0.5;
    float wave2_o1 = sin((uv.x - origin1.x) * 18.0 + time * 1.5) * 0.5 + 0.5;
    float wave3_o1 = sin((uv.y - origin1.y) * 12.5 - time * 0.5) * 0.5 + 0.5;
    float finalWave_o1 = (wave1_o1 * 0.5 + wave2_o1 * 0.3 + wave3_o1 * 0.2);

    // Origin 2 waves
    float wave1_o2 = sin(dist2 * freqMult2 - time * 0.8) * 0.5 + 0.5;
    float wave2_o2 = sin((uv.x - origin2.x) * freqMult2 * 0.7 + time * 0.7) * 0.5 + 0.5;
    float wave3_o2 = sin((uv.y - origin2.y) * freqMult2 * 0.6 - time * 1.2) * 0.5 + 0.5;
    float finalWave_o2 = (wave1_o2 * 0.5 + wave2_o2 * 0.3 + wave3_o2 * 0.2);

    // Origin 3 waves
    float wave1_o3 = sin(dist3 * freqMult3 + time * 0.6) * 0.5 + 0.5;
    float wave2_o3 = sin((uv.x - origin3.x) * freqMult3 * 0.5 - time * 1.1) * 0.5 + 0.5;
    float wave3_o3 = sin((uv.y - origin3.y) * freqMult3 * 0.6 + time * 0.9) * 0.5 + 0.5;
    float finalWave_o3 = (wave1_o3 * 0.4 + wave2_o3 * 0.4 + wave3_o3 * 0.2);

    // --- Color Calculation based on Wave Patterns ---
    // Define base colors
    vec3 purple = rgb(90.0, 96.0, 211.0);
    vec3 lightBlue = rgb(226.0, 232.0, 255.0);
    vec3 pink = rgb(220.0, 238.0, 248.0);

    // Create pairwise color mixes controlled by individual wave patterns
    vec3 mix1 = mix(purple, pink, finalWave_o1);       // Purple <-> Pink
    vec3 mix2 = mix(pink, lightBlue, finalWave_o2);    // Pink <-> LightBlue
    vec3 mix3 = mix(lightBlue, purple, finalWave_o3);  // LightBlue <-> Purple

    // Combine the pairwise mixes using nested interpolation, driven by waves
    vec3 intermediateColor = mix(mix1, mix3, finalWave_o2); // Mix between (Purple/Pink) and (LightBlue/Purple)
    vec3 colorBase = mix(intermediateColor, mix2, finalWave_o1); // Mix the result with (Pink/LightBlue)

    // --- Grain Effect ---
    // Generate static and animated noise components based on UVs
    float staticGrain = random(uv * 10.0) * 2.0 - 1.0; // Noise centered around 0
    float animatedGrain = random(uv + time * 0.01) * 2.0 - 1.0; // Noise centered around 0

    // Grain parameters
    float grainRatio = 0.2;
    float grainIntensity = 0.01;

    float grain = mix(staticGrain, animatedGrain, grainRatio);

    // Add grain to the base color
    vec3 noisyColor = colorBase + grain * grainIntensity;

    // Clamp final color to valid range [0.0, 1.0]
    vec3 finalColor = clamp(noisyColor, 0.0, 1.0);

    // --- Output ---
    gl_FragColor = vec4(finalColor, 1.0);
} // End of main()
`;

export default fragmentShader;