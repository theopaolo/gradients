const fragmentShader = `
varying vec2 vUv;
uniform float time;
uniform vec2 resolution;

// Time and animation controls
uniform float timeOfDay;
uniform float colorIntensity;
uniform float flowSpeed;

// Whimsical cloud controls (for background)
uniform float cloudCoverage;     // Amount of background clouds
uniform float cloudFluffiness;   // How fluffy/soft the clouds are
uniform float cloudScale;        // Size of clouds
uniform float cloudSpeed;        // Speed of cloud movement
uniform float cloudDensity;      // Opacity of clouds

// Volumetric cloud controls
uniform float volumetricCloudSize;    // Size of the main volumetric cloud
uniform float volumetricCloudDensity; // Density of the volumetric cloud
uniform float cloudHeight;           // Height of the cloud center
uniform float cloudDepth;            // Depth/thickness of the cloud
uniform float erosionStrength;       // Envelope erosion strength
uniform float lightingIntensity;     // Lighting strength
uniform float scatteringStrength;    // Light scattering strength

// Particle effects
uniform float particleCount;     // Amount of floating particles
uniform float particleSpeed;     // Particle movement speed
uniform float particleSize;      // Size of particles

// Cute color palette
uniform vec3 skyColor1;          // Primary sky color
uniform vec3 skyColor2;          // Secondary sky color
uniform vec3 cloudColorLight;    // Bright parts of clouds
uniform vec3 cloudColorDark;     // Shadow parts of clouds
uniform vec3 cloudColorEdge;     // Cloud edges/highlights

// --- Simple Helper Functions ---
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// 3D noise functions for volumetric clouds
float random3D(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.543))) * 43758.5453);
}

float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);

    vec3 u = f * f * (3.0 - 2.0 * f);

    float n000 = random3D(i + vec3(0.0, 0.0, 0.0));
    float n001 = random3D(i + vec3(0.0, 0.0, 1.0));
    float n010 = random3D(i + vec3(0.0, 1.0, 0.0));
    float n011 = random3D(i + vec3(0.0, 1.0, 1.0));
    float n100 = random3D(i + vec3(1.0, 0.0, 0.0));
    float n101 = random3D(i + vec3(1.0, 0.0, 1.0));
    float n110 = random3D(i + vec3(1.0, 1.0, 0.0));
    float n111 = random3D(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, u.x);
    float nx01 = mix(n001, n101, u.x);
    float nx10 = mix(n010, n110, u.x);
    float nx11 = mix(n011, n111, u.x);

    float nxy0 = mix(nx00, nx10, u.y);
    float nxy1 = mix(nx01, nx11, u.y);

    return mix(nxy0, nxy1, u.z);
}

// Worley noise (cellular noise)
float worley3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);

    float minDist = 1.0;

    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            for (int z = -1; z <= 1; z++) {
                vec3 neighbor = vec3(float(x), float(y), float(z));
                vec3 point = vec3(
                    random3D(i + neighbor + vec3(0.1)),
                    random3D(i + neighbor + vec3(0.2)),
                    random3D(i + neighbor + vec3(0.3))
                );
                vec3 diff = neighbor + point - f;
                float dist = length(diff);
                minDist = min(minDist, dist);
            }
        }
    }

    return minDist;
}

// Perlin-Worley hybrid noise
float perlinWorley3D(vec3 p) {
    float perlin = noise3D(p);
    float worley = worley3D(p);

    // Blend based on Perlin noise value
    float blend = smoothstep(0.0, 1.0, perlin);
    return mix(worley, 1.0 - worley, blend);
}

// 3D FBM using Perlin-Worley
float fbm3D(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 4; i++) {
        value += amplitude * perlinWorley3D(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }

    return value;
}

// Simple sky gradient
vec3 generateSkyGradient(vec2 uv) {
    // Simple vertical gradient
    float gradient = uv.y;

    // Add some gentle horizontal variation for interest
    float horizontalWave = sin(uv.x * 3.14159 + time * 0.1) * 0.1;
    gradient = clamp(gradient + horizontalWave, 0.0, 1.0);

    // Mix the two sky colors
    return mix(skyColor1, skyColor2, gradient);
}

// Generate fluffy clouds
float generateFluffyClouds(vec2 uv) {
    // Moving cloud coordinates
    vec2 cloudCoord = uv * cloudScale + time * cloudSpeed * flowSpeed * vec2(0.3, 0.1);

    // Create multiple layers of soft noise for fluffiness
    float cloud1 = fbm(cloudCoord);
    float cloud2 = fbm(cloudCoord * 2.1 + vec2(0.5, 0.3)) * 0.5;
    float cloud3 = fbm(cloudCoord * 4.3 + vec2(1.1, 0.7)) * 0.25;

    // Combine clouds with fluffiness
    float combinedClouds = cloud1 + cloud2 + cloud3;

    // Make them fluffy with smooth transitions
    combinedClouds = smoothstep(-cloudFluffiness, cloudFluffiness, combinedClouds);

    // Apply coverage
    combinedClouds *= cloudCoverage;

    return clamp(combinedClouds, 0.0, 1.0);
}

// Generate cute floating particles
float generateParticles(vec2 uv) {
    if (particleCount <= 0.0) return 0.0;

    float particles = 0.0;

    // Create multiple particle layers
    for (int i = 0; i < 3; i++) {
        float layerOffset = float(i) * 0.3;
        vec2 particleCoord = uv * (10.0 + layerOffset * 5.0) + time * particleSpeed * vec2(0.2, 0.5 + layerOffset);

        // Grid-based particles with random variations
        vec2 gridCoord = floor(particleCoord);
        vec2 cellCoord = fract(particleCoord);

        // Random particle position within cell
        vec2 particlePos = vec2(
            random(gridCoord + vec2(layerOffset)),
            random(gridCoord + vec2(layerOffset + 0.1))
        );

        // Distance from particle center
        float dist = length(cellCoord - particlePos);

        // Create soft circular particles
        float particle = 1.0 - smoothstep(0.0, particleSize * 0.1, dist);

        // Add some twinkle effect
        float twinkle = sin(time * 2.0 + random(gridCoord) * 6.28) * 0.5 + 0.5;
        particle *= twinkle;

        particles += particle * (1.0 - float(i) * 0.3); // Fade each layer
    }

    return particles * particleCount;
}

// Envelope generation for volumetric cloud
float generateCloudEnvelope(vec3 pos, vec3 cloudCenter) {
    // Distance from cloud center
    vec3 diff = pos - cloudCenter;

    // More organic cloud shape - not a perfect ellipsoid
    vec2 horizontalDist = vec2(diff.x, diff.z) / volumetricCloudSize;
    float horizontalFactor = length(horizontalDist);

    // Vertical falloff with different curve
    float verticalFactor = abs(diff.y) / cloudDepth;

    // Combine with different powers for more natural shape
    float envelope = 1.0 - smoothstep(0.3, 1.0, horizontalFactor);
    envelope *= 1.0 - smoothstep(0.0, 0.8, verticalFactor);

    // Add some asymmetry to break the perfect circular shape
    float asymmetry = 1.0 + 0.3 * sin(atan(diff.z, diff.x) * 3.0 + time * 0.1);
    envelope *= asymmetry;

    return clamp(envelope, 0.0, 1.0);
}

// Volumetric cloud density with erosion
float sampleCloudDensity(vec3 pos) {
    vec3 cloudCenter = vec3(0.5, cloudHeight, 0.5); // Center of screen, at specified height

    // Generate base envelope
    float envelope = generateCloudEnvelope(pos, cloudCenter);
    if (envelope <= 0.01) return 0.0;

    // Multiple scales of 3D noise for more complex structure
    vec3 noisePos = pos * 2.0 + time * 0.05 * vec3(0.1, 0.05, 0.1) * flowSpeed;

    // Large scale cloud structure
    float largeNoise = fbm3D(noisePos * 0.5) * 0.8;

    // Medium scale bumps and billows
    float mediumNoise = fbm3D(noisePos * 1.5) * 0.4;

    // Small scale detail
    float detailNoise = fbm3D(noisePos * 4.0) * 0.2;

    // Combine all scales
    float density = largeNoise + mediumNoise + detailNoise;

    // Make it more cloudy by adjusting the range
    density = (density + 1.0) * 0.5; // Normalize to 0-1
    density = smoothstep(0.2, 0.8, density); // Create more defined cloud edges

    // Apply envelope with softer blending
    density *= envelope;

    // Envelope erosion - create wispy edges
    float erosion = fbm3D(pos * 3.0 + time * 0.03) * erosionStrength;
    float erodedEnvelope = envelope - erosion * 0.5;
    erodedEnvelope = smoothstep(0.1, 0.7, erodedEnvelope);

    // Apply erosion for wispy edges
    density *= erodedEnvelope;

    // Scale by density parameter
    density *= volumetricCloudDensity;

    return clamp(density, 0.0, 1.0);
}

// Anisotropic phase function for light scattering
float phaseFunction(float cosTheta, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * 3.14159 * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
}

// Multi-scattering approximation
float multiScattering(float density, float cosTheta) {
    // Simple multi-scattering approximation
    float ms = 0.3 + 0.7 * exp(-density * 2.0);
    return ms * phaseFunction(cosTheta, 0.3);
}

// Ray marching with adaptive sampling
vec4 rayMarchVolumetricCloud(vec3 rayOrigin, vec3 rayDirection, float maxDistance) {
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5)); // Light direction

    float stepSize = maxDistance / 32.0; // Base step size
    float transmittance = 1.0;
    vec3 scatteredLight = vec3(0.0);

    for (int i = 0; i < 32; i++) {
        float t = float(i) * stepSize;
        if (t > maxDistance) break;

        vec3 samplePos = rayOrigin + rayDirection * t;

        // Sample cloud density
        float density = sampleCloudDensity(samplePos);
        if (density <= 0.0) continue;

        // Adaptive sampling - smaller steps in denser areas
        float adaptiveStep = stepSize * (1.0 - density * 0.5);

        // Light attenuation through cloud
        float lightTransmittance = exp(-density * lightingIntensity * adaptiveStep);

        // Phase function
        float cosTheta = dot(rayDirection, lightDir);
        float phase = multiScattering(density, cosTheta);

        // In-scattering
        vec3 lightColor = mix(vec3(1.0, 0.95, 0.8), vec3(0.8, 0.9, 1.0), 0.3);
        vec3 scattering = lightColor * density * phase * scatteringStrength * transmittance;
        scatteredLight += scattering * adaptiveStep;

        // Update transmittance
        transmittance *= exp(-density * adaptiveStep * 2.0);

        // Early exit if transmittance is very low
        if (transmittance < 0.01) break;
    }

    return vec4(scatteredLight, 1.0 - transmittance);
}

void main() {
    vec2 uv = vUv;

    // Generate whimsical sky gradient
    vec3 skyColor = generateSkyGradient(uv);

    // Generate fluffy background clouds
    float backgroundClouds = generateFluffyClouds(uv);

    // Create soft background cloud colors
    vec3 backgroundCloudColor = mix(cloudColorDark, cloudColorLight, 0.8);

    // Add some gentle edge highlights to background clouds
    float cloudEdge = smoothstep(0.2, 0.6, backgroundClouds) - smoothstep(0.6, 0.9, backgroundClouds);
    backgroundCloudColor = mix(backgroundCloudColor, cloudColorEdge, cloudEdge * 0.3);

    // Blend background clouds with sky
    vec3 sceneColor = mix(skyColor, backgroundCloudColor, backgroundClouds * cloudDensity * 0.3);

        // Ray marching for volumetric cloud
    // Set up camera looking at the cloud from below
    vec2 screenPos = (uv * 2.0 - 1.0); // Convert to -1,1 range

    // Camera positioned below the cloud, looking up at an angle
    vec3 rayOrigin = vec3(screenPos.x * 0.3, 0.0, screenPos.y * 0.3 + 1.0);

    // Ray direction pointing toward the cloud center with perspective
    vec3 cloudCenter = vec3(0.5, cloudHeight, 0.5);
    vec3 rayDirection = normalize(cloudCenter - rayOrigin + vec3(screenPos.x * 0.2, 0.0, screenPos.y * 0.2));

    // Ray march the volumetric cloud
    vec4 volumetricResult = rayMarchVolumetricCloud(rayOrigin, rayDirection, 3.0);

    // Composite volumetric cloud on top of scene
    vec3 finalColor = mix(sceneColor, volumetricResult.rgb, volumetricResult.a);

    // Add magical floating particles
    float particles = generateParticles(uv);
    vec3 particleColor = vec3(1.0, 1.0, 0.9); // Warm white particles
    finalColor = mix(finalColor, particleColor, particles * 0.6);

    // Apply color intensity for overall vibrancy
    finalColor = mix(vec3(0.5), finalColor, colorIntensity);

    // Add a subtle warm glow
    float glow = 1.0 + 0.1 * sin(time * 0.5);
    finalColor *= glow;

    gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
}
`;

export default fragmentShader;