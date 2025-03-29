const fragmentShader = `
varying vec2 vUv;        // Input: UV coordinates from vertex shader (0.0 to 1.0)
uniform float time;      // Input: Time value from JavaScript (for animation)
uniform vec2 resolution; // Input: Canvas resolution
uniform vec2 mouse;

// Audio uniforms
uniform float audioVolume;  // Overall audio volume (0.0-1.0)
uniform float audioBass;    // Bass energy (0.0-1.0)
uniform float audioMid;     // Mid-range energy (0.0-1.0)
uniform float audioHigh;    // High-range energy (0.0-1.0)
uniform sampler2D waveform; // Waveform data texture

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

// Smoothstep function to create smoother transitions
float smoothTransition(float value, float minThreshold, float maxThreshold) {
    return smoothstep(minThreshold, maxThreshold, value);
}

// --- Main Shader Logic ---

void main() {
    // --- Setup ---
    vec2 uv = vUv;
    float slowTime = time * 0.35; // Adjusted slow time

    // Determine if audio is playing with a threshold and create a smooth transition
    bool isAudioPlaying = audioVolume > 0.01;
    float audioFactor = smoothstep(0.0, 0.1, audioVolume); // Smooth transition factor

    // Time modulation - blend between base and audio-reactive time
    float baseAnimTime = slowTime * 0.7; // Base animation speed
    float audioReactiveTime = slowTime * (1.0 + audioBass * 0.8); // Reduce bass impact
    float currentTime = mix(baseAnimTime, audioReactiveTime, audioFactor);

    // --- Mouse Influence Parameters ---
    // Blend mouse influence based on audio level
    float baseMouseInfluence = 0.3; // Base mouse influence
    float audioMouseInfluence = 0.5 + audioVolume * 0.3; // Reduced audio impact
    float mouseInfluence = mix(baseMouseInfluence, audioMouseInfluence, audioFactor);
    mouseInfluence = clamp(mouseInfluence, 0.0, 0.9);
    float autonomyFactor = 1.0 - mouseInfluence;

    // --- Multi-Origin Wave Pattern Calculation ---
    // Base radius values - increased to be closer to audio-reactive values
    float baseRadius1 = 0.25;
    float baseRadius2 = 0.3;
    float baseRadius3 = 0.2;

    // Audio-reactive radius values - reduced to be closer to base values
    float audioRadius1 = 0.3 * (1.0 + audioBass * 0.3);
    float audioRadius2 = 0.35 * (1.0 + audioMid * 0.4);
    float audioRadius3 = 0.25 * (1.0 + audioHigh * 0.3);

    // Blend radius scales based on audio factor
    float radiusScale1 = mix(baseRadius1, audioRadius1, audioFactor);
    float radiusScale2 = mix(baseRadius2, audioRadius2, audioFactor);
    float radiusScale3 = mix(baseRadius3, audioRadius3, audioFactor);

    // Calculate origin positions for waves
    vec2 autoOrigin1 = vec2(
        0.5 + cos(currentTime * 0.5) * radiusScale1,
        0.5 + sin(currentTime * 0.5) * radiusScale1);

    vec2 autoOrigin2 = vec2(
        0.5 + cos(currentTime * 0.7 + 2.0) * radiusScale2,
        0.5 + sin(currentTime * 0.3) * radiusScale2);

    vec2 autoOrigin3 = vec2(
        0.5 + cos(currentTime * -0.4 + 4.0) * radiusScale3,
        0.5 + sin(currentTime * 0.8 + 0.5) * radiusScale3);

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

    // Base frequencies - increased to be closer to audio values
    float baseFreq1 = 7.0;
    float baseFreq2 = 10.0;
    float baseFreq3 = 6.0;

    // Audio-reactive frequencies - reduced to be closer to base values
    float audioFreq1 = 8.0 * (1.0 + audioBass * 0.8);
    float audioFreq2 = 12.0 * (1.0 + audioMid * 0.7);
    float audioFreq3 = 8.0 * (1.0 + audioHigh * 0.6);

    // Blend frequencies based on audio factor
    float freqMult1 = mix(baseFreq1, audioFreq1, audioFactor);
    float freqMult2 = mix(baseFreq2, audioFreq2, audioFactor);
    float freqMult3 = mix(baseFreq3, audioFreq3, audioFactor);

    // Origin 1 waves
    float wave1_o1 = sin(dist1 * freqMult1 - currentTime) * 0.5 + 0.5;
    float wave2_o1 = sin((uv.x - origin1.x) * 18.0 + currentTime * 1.5) * 0.5 + 0.5;
    float wave3_o1 = sin((uv.y - origin1.y) * 12.5 - currentTime * 0.5) * 0.5 + 0.5;
    float finalWave_o1 = (wave1_o1 * 0.5 + wave2_o1 * 0.3 + wave3_o1 * 0.2);

    // Origin 2 waves
    float wave1_o2 = sin(dist2 * freqMult2 - currentTime * 0.8) * 0.5 + 0.5;
    float wave2_o2 = sin((uv.x - origin2.x) * freqMult2 * 0.7 + currentTime * 0.7) * 0.5 + 0.5;
    float wave3_o2 = sin((uv.y - origin2.y) * freqMult2 * 0.6 - currentTime * 1.2) * 0.5 + 0.5;
    float finalWave_o2 = (wave1_o2 * 0.5 + wave2_o2 * 0.3 + wave3_o2 * 0.2);

    // Origin 3 waves
    float wave1_o3 = sin(dist3 * freqMult3 + currentTime * 0.6) * 0.5 + 0.5;
    float wave2_o3 = sin((uv.x - origin3.x) * freqMult3 * 0.5 - currentTime * 1.1) * 0.5 + 0.5;
    float wave3_o3 = sin((uv.y - origin3.y) * freqMult3 * 0.6 + currentTime * 0.9) * 0.5 + 0.5;
    float finalWave_o3 = (wave1_o3 * 0.4 + wave2_o3 * 0.4 + wave3_o3 * 0.2);

    // --- Apply waveform texture as displacement, only when audio is present ---
    vec2 waveformUV = vUv;
    float waveformValue = 0.0;

    // Only apply displacement if there's meaningful audio
    if (audioFactor > 0.05) {
        // Add audio-reactive displacement to the UV coordinates
        float waveDisplacement = texture2D(waveform, vUv).r * audioVolume * 0.08; // Reduced from 0.1
        waveformUV += vec2(waveDisplacement, waveDisplacement);

        // Sample again with displaced UVs for more interesting effect
        waveformValue = texture2D(waveform, waveformUV).r;

        // Apply waveform as additional modulation to the waves - using audioFactor for smooth blend
        finalWave_o1 = mix(finalWave_o1, waveformValue, audioVolume * 0.3 * audioFactor);
        finalWave_o2 = mix(finalWave_o2, waveformValue, audioVolume * 0.2 * audioFactor);
        finalWave_o3 = mix(finalWave_o3, waveformValue, audioVolume * 0.4 * audioFactor);
    }

    // --- Color Calculation based on Wave Patterns ---
    // Define base colors
    vec3 purple = rgb(90.0, 96.0, 211.0);
    vec3 lightBlue = rgb(226.0, 232.0, 255.0);
    vec3 pink = rgb(220.0, 238.0, 248.0);

    // Apply audio-based color modulation - blend with audioFactor for smooth transition
    vec3 purpleAudio = purple + vec3(audioBass * 0.3, audioMid * 0.1, audioHigh * 0.4);
    vec3 lightBlueAudio = lightBlue + vec3(audioBass * 0.1, audioMid * 0.2, audioHigh * 0.3);
    vec3 pinkAudio = pink + vec3(audioBass * 0.2, audioMid * 0.3, audioHigh * 0.1);

    // Clamp colors to valid range
    purpleAudio = clamp(purpleAudio, 0.0, 1.0);
    lightBlueAudio = clamp(lightBlueAudio, 0.0, 1.0);
    pinkAudio = clamp(pinkAudio, 0.0, 1.0);

    // Blend colors based on audio factor
    vec3 finalPurple = mix(purple, purpleAudio, audioFactor);
    vec3 finalLightBlue = mix(lightBlue, lightBlueAudio, audioFactor);
    vec3 finalPink = mix(pink, pinkAudio, audioFactor);

    // Create pairwise color mixes controlled by individual wave patterns
    vec3 mix1 = mix(finalPurple, finalPink, finalWave_o1);       // Purple <-> Pink
    vec3 mix2 = mix(finalPink, finalLightBlue, finalWave_o2);    // Pink <-> LightBlue
    vec3 mix3 = mix(finalLightBlue, finalPurple, finalWave_o3);  // LightBlue <-> Purple

    // Combine the pairwise mixes using nested interpolation, driven by waves
    vec3 intermediateColor = mix(mix1, mix3, finalWave_o2); // Mix between (Purple/Pink) and (LightBlue/Purple)
    vec3 colorBase = mix(intermediateColor, mix2, finalWave_o1); // Mix the result with (Pink/LightBlue)

    // --- Grain Effect with Audio Reactivity ---
    // Generate static and animated noise components based on UVs
    float staticGrain = random(uv * 10.0) * 2.0 - 1.0; // Noise centered around 0
    float animatedGrain = random(uv + time * 0.01) * 2.0 - 1.0; // Noise centered around 0

    // Base grain parameters
    float baseGrainRatio = 0.2;
    float baseGrainIntensity = 0.01;

    // Audio-reactive grain parameters
    float audioGrainRatio = 0.3 + audioHigh * 0.3; // Reduced from 0.4
    float audioGrainIntensity = 0.015 + (audioVolume * audioHigh * 0.02); // Reduced from 0.03

    // Blend grain parameters based on audio factor
    float grainRatio = mix(baseGrainRatio, audioGrainRatio, audioFactor);
    float grainIntensity = mix(baseGrainIntensity, audioGrainIntensity, audioFactor);

    float grain = mix(staticGrain, animatedGrain, grainRatio);

    // Add grain to the base color
    vec3 noisyColor = colorBase + grain * grainIntensity;

    // --- Add audio waveform visualization at the bottom, only when audio is present ---
    float waveformHeight = 0.05; // Height of the waveform visualization
    if (vUv.y < waveformHeight && audioFactor > 0.05) {
        // Map horizontal position to waveform texture
        float waveIndex = vUv.x;
        // Sample the waveform
        float wave = texture2D(waveform, vec2(waveIndex, 0.0)).r;
        // Scale the waveform for visibility
        wave = wave * 0.5 + 0.5;
        // Create visual line only where the wave amplitude exceeds the current y position
        if (vUv.y / waveformHeight < wave) {
            // Mix in a bright color for the waveform
            vec3 waveColor = vec3(1.0, 1.0, 1.0);
            float waveBlend = smoothstep(0.0, 0.01, wave - vUv.y / waveformHeight);
            // Use audioFactor for a smooth fade in/out of waveform
            noisyColor = mix(noisyColor, waveColor, waveBlend * audioVolume * audioFactor);
        }
    }

    // Clamp final color to valid range [0.0, 1.0]
    vec3 finalColor = clamp(noisyColor, 0.0, 1.0);

    // --- Output ---
    gl_FragColor = vec4(finalColor, 1.0);
} // End of main()
`;

export default fragmentShader;