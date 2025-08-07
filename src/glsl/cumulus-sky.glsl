const fragmentShader = `
varying vec2 vUv;
uniform float time;
uniform vec2 resolution;
uniform vec2 mouse;

// Cloud controls
uniform float cloudSize;
uniform float cloudCoverage;
uniform float cloudSharpness;
uniform float cloudHeight;
uniform float cloudThickness;
uniform float cloudSpeed;
uniform float cloudDetail;

// Sky colors
uniform vec3 skyColorTop;
uniform vec3 skyColorHorizon;
uniform float skyGradientPower;

// Cloud colors
uniform vec3 cloudColorBright;
uniform vec3 cloudColorShadow;
uniform vec3 cloudColorCore;
uniform float cloudContrast;

// Lighting
uniform float sunIntensity;
uniform vec2 sunPosition;

// Fragment controls
uniform float fragmentCount;
uniform float fragmentSpread;
uniform float fragmentVariation;
uniform float fragmentSeedOffset;

// --- Noise Functions ---
vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
    const float K1 = 0.366025404;
    const float K2 = 0.211324865;

    vec2 i = floor(p + (p.x + p.y) * K1);
    vec2 a = p - i + (i.x + i.y) * K2;
    vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec2 b = a - o + K2;
    vec2 c = a - 1.0 + 2.0 * K2;

    vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
    vec3 n = h * h * h * h * vec3(dot(a, hash(i + 0.0)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));

    return dot(n, vec3(70.0));
}

float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}

// Generate individual cloud "blobs" at specific positions
float generateCloudBlob(vec2 uv, vec2 center, float size, float intensity, float seed) {
    vec2 offset = uv - center;

    // Animate the cloud position slightly
    vec2 drift = vec2(sin(time * 0.1 + seed), cos(time * 0.07 + seed * 1.3)) * 0.02 * cloudSpeed;
    offset -= drift;

    float distance = length(offset);

    // Base cloud shape - starts circular but gets distorted
    float baseCloud = 1.0 - smoothstep(0.0, size, distance);

    if (baseCloud <= 0.0) return 0.0;

    // Add multiple layers of noise for realistic cloud texture
    vec2 noiseCoord = center + offset * 2.0 + time * cloudSpeed * 0.05;

    // Large-scale cloud shape distortion
    float noise1 = fbm(noiseCoord * 3.0 + seed * 10.0, 3) * 0.4;

    // Medium-scale cloud billowing
    float noise2 = fbm(noiseCoord * 8.0 + seed * 15.0, 4) * 0.25;

    // Fine-scale cloud detail
    float noise3 = fbm(noiseCoord * 16.0 + seed * 20.0, 3) * 0.15 * cloudDetail;

    // Combine noise layers
    float totalNoise = noise1 + noise2 + noise3;

    // Apply noise to cloud shape
    float cloudDensity = baseCloud + totalNoise;

    // Apply coverage and sharpness
    cloudDensity = cloudDensity - (1.0 - intensity);
    cloudDensity = pow(max(cloudDensity, 0.0), cloudSharpness);

    // Create 3D-like effect by making bottom more dense
    float verticalGradient = smoothstep(center.y - size * 0.5, center.y + size * 0.3, uv.y);
    cloudDensity *= mix(1.2, 0.6, verticalGradient);

    return clamp(cloudDensity, 0.0, 1.0);
}

// Generate sky gradient
vec3 generateSky(vec2 uv) {
    float skyGradient = pow(uv.y, skyGradientPower);
    vec3 sky = mix(skyColorHorizon, skyColorTop, skyGradient);

    // Add subtle horizontal variation
    float horizontalVar = sin(uv.x * 6.28318) * 0.02;
    sky += horizontalVar;

    return sky;
}

// Calculate cloud lighting
vec3 calculateCloudLighting(float cloudDensity, vec2 uv, vec2 cloudCenter) {
    if (cloudDensity <= 0.0) return vec3(0.0);

    // Distance from sun affects lighting
    vec2 sunDir = normalize(sunPosition - cloudCenter);
    float sunDistance = length(sunPosition - cloudCenter);
    float sunInfluence = exp(-sunDistance * 1.5) * sunIntensity;

    // Height-based lighting (top of clouds are brighter)
    float heightFactor = smoothstep(cloudCenter.y - 0.1, cloudCenter.y + 0.1, uv.y);

    // Create realistic cloud shading
    vec3 cloudColor;

    if (cloudDensity < 0.2) {
        // Wispy edges - very bright
        cloudColor = mix(cloudColorBright, cloudColorCore, cloudDensity * 5.0);
    } else if (cloudDensity < 0.6) {
        // Main cloud body
        cloudColor = mix(cloudColorBright, cloudColorShadow, (cloudDensity - 0.2) * 2.5);
    } else {
        // Dense core
        cloudColor = mix(cloudColorShadow, cloudColorCore, (cloudDensity - 0.6) * 2.5);
    }

    // Apply sun and height lighting
    float lightingFactor = mix(0.7, 1.3, sunInfluence * heightFactor);
    cloudColor *= lightingFactor;

    // Apply contrast
    cloudColor = (cloudColor - 0.5) * cloudContrast + 0.5;

    return clamp(cloudColor, 0.0, 1.0);
}

void main() {
    vec2 uv = vUv;

    // Generate sky
    vec3 skyColor = generateSky(uv);

    // Define multiple cloud centers (like particle emitters)
    // These positions and properties create distinct cumulus clouds
    vec2 cloudCenters[8];
    float cloudSizes[8];
    float cloudIntensities[8];
    float cloudSeeds[8];

    // Generate cloud fragments dynamically based on controls
    int maxClouds = int(clamp(fragmentCount, 1.0, 8.0));

    // Base cloud positions with procedural variation
    vec2 basePositions[8];
    basePositions[0] = vec2(0.25, 0.45);
    basePositions[1] = vec2(0.55, 0.5);
    basePositions[2] = vec2(0.8, 0.4);
    basePositions[3] = vec2(0.1, 0.6);
    basePositions[4] = vec2(0.9, 0.65);
    basePositions[5] = vec2(0.4, 0.35);
    basePositions[6] = vec2(0.7, 0.6);
    basePositions[7] = vec2(0.15, 0.35);

    for (int i = 0; i < 8; i++) {
        if (i >= maxClouds) {
            cloudSizes[i] = 0.0;
            cloudIntensities[i] = 0.0;
            continue;
        }

        float seedBase = float(i) + fragmentSeedOffset;
        cloudSeeds[i] = seedBase;

        // Apply procedural variation to positions
        vec2 noiseOffset = vec2(
            noise(vec2(seedBase * 13.7, time * 0.01)) * fragmentSpread,
            noise(vec2(seedBase * 17.3, time * 0.01)) * fragmentSpread * 0.3
        );

        cloudCenters[i] = basePositions[i] + vec2(noiseOffset.x * 0.3, cloudHeight + noiseOffset.y * 0.1);

        // Vary cloud sizes with fragmentVariation
        float sizeBase = mix(0.08, 0.2, float(i) / 7.0);
        float sizeVariation = noise(vec2(seedBase * 11.1, time * 0.005)) * fragmentVariation;
        cloudSizes[i] = (sizeBase + sizeVariation * 0.1) * cloudSize;

        // Vary cloud intensities
        float intensityBase = mix(0.5, 1.5, sin(float(i) * 0.7) * 0.5 + 0.5);
        float intensityVariation = noise(vec2(seedBase * 19.4, time * 0.003)) * fragmentVariation;
        cloudIntensities[i] = (intensityBase + intensityVariation * 0.5) * cloudCoverage;
    }

    // Generate and combine all clouds
    float totalCloudMask = 0.0;
    vec3 totalCloudColor = vec3(0.0);

    for (int i = 0; i < 8; i++) {
        float cloudMask = generateCloudBlob(uv, cloudCenters[i], cloudSizes[i], cloudIntensities[i], cloudSeeds[i]);

        if (cloudMask > 0.0) {
            vec3 cloudColor = calculateCloudLighting(cloudMask, uv, cloudCenters[i]);

            // Blend clouds additively for realistic overlap
            totalCloudColor += cloudColor * cloudMask;
            totalCloudMask = max(totalCloudMask, cloudMask);
        }
    }

    // Normalize cloud color
    if (totalCloudMask > 0.0) {
        totalCloudColor /= max(totalCloudMask, 0.1);
    }

    // Blend sky and clouds
    vec3 finalColor = mix(skyColor, totalCloudColor, totalCloudMask);

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

export default fragmentShader;