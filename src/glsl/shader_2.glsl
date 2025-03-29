const fragmentShader = `
uniform float time;
uniform vec2 resolution;
varying vec2 vUv;

vec3 rgb(float r, float g, float b) {
    return vec3(r, g, b) / 255.0;
}

// Improved random function
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// Value noise function (smoother than pure random)
float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    // Four corners of a tile
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    // Smooth interpolation
    vec2 u = f * f * (3.0 - 2.0 * f);

    // Mix 4 corners
    return mix(a, b, u.x) +
           (c - a)* u.y * (1.0 - u.x) +
           (d - b) * u.x * u.y;
}

// Domain warping function - creates more organic shapes
vec2 warp(vec2 uv, float strength) {
    float n1 = noise(uv * 2.0 + time * 0.1);
    float n2 = noise(uv * 2.0 - time * 0.08 + vec2(5.2, 1.3));

    return uv + vec2(n1, n2) * strength;
}

void main() {
    vec2 uv = vUv;
    float slowTime = time * 0.1; // Slower movement

    // Apply multiple levels of domain warping for more complex forms
    vec2 warped1 = warp(uv, 0.5);
    vec2 warped2 = warp(warped1, 0.1);

    // Create more distinct, entangled shapes
    float shape1 = noise(warped1 * 2.5 + slowTime * vec2(0.3, 0.2));
    float shape2 = noise(warped2 * 2.0 - slowTime * vec2(0.2, 0.3));
    float shape3 = noise(warped1 * 5.5 + slowTime * vec2(0.1, -0.3));

    // Create more defined boundaries between colors
    // Using smoothstep to create sharper transitions
    float pattern1 = smoothstep(0.3, 0.7, shape1);
    float pattern2 = smoothstep(0.15, 0.65, shape2);
    float pattern3 = smoothstep(0.4, 0.6, shape3);

    // Pastel colors from your images
    vec3 pastelPink = rgb(255.0, 190.0, 190.0);
    vec3 pastelYellow = rgb(255.0, 240.0, 150.0);
    vec3 pastelBlue = rgb(180.0, 220.0, 240.0);
    vec3 white = rgb(255.0, 255.0, 255.0);

    // Create layered color mixing for more complex interactions
    vec3 colorA = mix(pastelPink, white, pattern1);
    vec3 colorB = mix(pastelYellow, white, pattern2);
    vec3 colorC = mix(pastelBlue, white, pattern3);

    // Layer the colors with custom blending
    vec3 finalColor = colorA;
    finalColor = mix(finalColor, colorB, pattern2 * 0.8);
    finalColor = mix(finalColor, colorC, pattern3 * 0.6);

    // Add subtle bright highlights where shapes intersect
    float highlight = pattern1 * pattern2 * pattern3;
    finalColor = mix(finalColor, white, highlight * 0.7);

    // Add subtle grain texture
    float grain = random(uv * 500.0) * 0.02 - 0.01;
    finalColor += grain;

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

export default fragmentShader;