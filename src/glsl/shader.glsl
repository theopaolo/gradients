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
    // Adjust time multiplier (15.0) to change grain flicker speed
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233)) + time * 15.0) * 43758.5453);
}

// --- Main Shader Logic ---

void main() {

    // --- Setup ---
    vec2 uv = vUv;
    float slowTime = time * 0.35; // Adjusted slow time

    // --- Mouse Influence Parameters ---
    float mouseInfluence = 0.5; // How strongly the mouse affects origins (0.0 to 1.0)
    float autonomyFactor = 1.0 - mouseInfluence;


    // --- Multi-Origin Wave Pattern Calculation ---
    // Define original autonomous movements for origins
    vec2 autoOrigin1 = vec2(
        0.5 + cos(slowTime * 0.5) * 0.3,
        0.5 + sin(slowTime * 0.5) * 0.3
    );
    vec2 autoOrigin2 = vec2(
        0.5 + cos(slowTime * 0.7 + 2.0) * 0.4,
        0.5 + sin(slowTime * 0.3) * 0.2
    );
    vec2 autoOrigin3 = vec2(
        0.5 + cos(slowTime * -0.4 + 4.0) * 0.25,
        0.5 + sin(slowTime * 0.8 + 0.5) * 0.35
    );


    // Define 3 origins with unique movements
   // Origin 1: Direct influence but maintains some autonomy
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

    // Calculate individual wave patterns for each origin
    // Origin 1
    float wave1_o1 = sin(dist1 * 8.0 - slowTime) * 0.5 + 0.5;
    float wave2_o1 = sin((uv.x - origin1.x) * 18.0 + slowTime * 1.5) * 0.5 + 0.5;
    float wave3_o1 = sin((uv.y - origin1.y) * 12.5 - slowTime * 0.5) * 0.5 + 0.5;
    float finalWave_o1 = (wave1_o1 * 0.5 + wave2_o1 * 0.3 + wave3_o1 * 0.2);

    // Origin 2
    float wave1_o2 = sin(dist2 * 8.0 - slowTime * 0.8) * 0.5 + 0.5;
    float wave2_o2 = sin((uv.x - origin2.x) * 13.5 + slowTime * 0.7) * 0.5 + 0.5;
    float wave3_o2 = sin((uv.y - origin2.y) * 10.0 - slowTime * 1.2) * 0.5 + 0.5;
    float finalWave_o2 = (wave1_o2 * 0.5 + wave2_o2 * 0.3 + wave3_o2 * 0.2);

    // Origin 3
    float wave1_o3 = sin(dist3 * 10.0 + slowTime * 0.6) * 0.5 + 0.5;
    float wave2_o3 = sin((uv.x - origin3.x) * 5.0 - slowTime * 1.1) * 0.5 + 0.5;
    float wave3_o3 = sin((uv.y - origin3.y) * 7.0 + slowTime * 0.9) * 0.5 + 0.5;
    float finalWave_o3 = (wave1_o3 * 0.4 + wave2_o3 * 0.4 + wave3_o3 * 0.2);

    // --- Color Calculation based on Wave Patterns ---

    // Define base colors
    vec3 purple = rgb(90.0, 96.0, 211.0);
    vec3 lightBlue = rgb(226.0, 232.0, 255.0); // Slightly adjusted blue
    vec3 pink = rgb(220.0, 238.0, 248.0);       // Slightly adjusted pink

    // Create pairwise color mixes controlled by individual wave patterns
    vec3 mix1 = mix(purple, pink, finalWave_o1);       // Purple <-> Pink (controlled by Origin 1 wave)
    vec3 mix2 = mix(pink, lightBlue, finalWave_o2);    // Pink <-> LightBlue (controlled by Origin 2 wave)
    vec3 mix3 = mix(lightBlue, purple, finalWave_o3);  // LightBlue <-> Purple (controlled by Origin 3 wave)

    // Combine the pairwise mixes using nested interpolation, driven by waves
    // This creates complex blending across the colors.
    vec3 intermediateColor = mix(mix1, mix3, finalWave_o2); // Mix between (Purple/Pink) and (LightBlue/Purple) using Origin 2 wave
    vec3 colorBase = mix(intermediateColor, mix2, finalWave_o1); // Mix the result with (Pink/LightBlue) using Origin 1 wave


    // --- Grain Effect ---

    // Generate static and animated noise components based on UVs
    // Multiplying input UV by 10.0 increases static grain frequency
    float staticGrain = random(uv * 10.0) * 2.0 - 1.0; // Noise centered around 0
    // Adding time offset to UV creates animated grain
    float animatedGrain = random(uv + time * 0.01) * 2.0 - 1.0; // Noise centered around 0

    // Blend static and animated grain (0.3 means 30% animated, 70% static)
    float grain = mix(staticGrain, animatedGrain, 0.3);

    // Set grain intensity
    float grainIntensity = 0.015; // Adjust for more/less visible grain

    // Add grain to the base color
    vec3 noisyColor = colorBase + grain * grainIntensity;

    // Clamp final color to valid range [0.0, 1.0]
    vec3 finalColor = clamp(noisyColor, 0.0, 1.0);


    // --- Output ---
    gl_FragColor = vec4(finalColor, 1.0);

} // End of main()
`;

export default fragmentShader;