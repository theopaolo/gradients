const fragmentShader = `
varying vec2 vUv;
uniform float time;
uniform vec2 resolution;

// Time and animation controls
uniform float timeOfDay;
uniform float colorIntensity;
uniform float flowSpeed;


// Particle effects
uniform float particleCount;     // Amount of floating particles
uniform float particleSpeed;     // Particle movement speed
uniform float particleSize;      // Size of particles

// Color palette
uniform vec3 skyColor1;          // Primary sky color
uniform vec3 skyColor2;          // Secondary sky color

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


// Sky gradient with time of day variations
vec3 generateSkyGradient(vec2 uv) {
    // Simple vertical gradient
    float gradient = uv.y;

    // Add some gentle horizontal variation for interest
    float horizontalWave = sin(uv.x * 3.14159 + time * 0.1) * 0.1;
    gradient = clamp(gradient + horizontalWave, 0.0, 1.0);

    // Create time-based color variations
    // 0.0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset, 1.0 = midnight
    
    // Define colors for different times of day
    vec3 nightColor1 = vec3(0.1, 0.1, 0.3);     // Dark blue
    vec3 nightColor2 = vec3(0.2, 0.1, 0.4);     // Dark purple
    
    vec3 sunriseColor1 = vec3(1.0, 0.7, 0.4);   // Warm orange
    vec3 sunriseColor2 = vec3(1.0, 0.9, 0.7);   // Light peach
    
    vec3 dayColor1 = vec3(0.6, 0.8, 1.0);       // Sky blue
    vec3 dayColor2 = vec3(0.9, 0.95, 1.0);      // Light blue
    
    vec3 sunsetColor1 = vec3(1.0, 0.5, 0.3);    // Deep orange
    vec3 sunsetColor2 = vec3(0.8, 0.3, 0.5);    // Purple-pink
    
    // Interpolate between time periods
    vec3 currentSkyColor1, currentSkyColor2;
    
    if (timeOfDay < 0.125) {
        // Late night to early night
        float t = timeOfDay / 0.125;
        currentSkyColor1 = mix(nightColor1, nightColor1, t);
        currentSkyColor2 = mix(nightColor2, nightColor2, t);
    } else if (timeOfDay < 0.375) {
        // Night to sunrise
        float t = (timeOfDay - 0.125) / 0.25;
        currentSkyColor1 = mix(nightColor1, sunriseColor1, t);
        currentSkyColor2 = mix(nightColor2, sunriseColor2, t);
    } else if (timeOfDay < 0.625) {
        // Sunrise to day
        float t = (timeOfDay - 0.375) / 0.25;
        currentSkyColor1 = mix(sunriseColor1, dayColor1, t);
        currentSkyColor2 = mix(sunriseColor2, dayColor2, t);
    } else if (timeOfDay < 0.875) {
        // Day to sunset
        float t = (timeOfDay - 0.625) / 0.25;
        currentSkyColor1 = mix(dayColor1, sunsetColor1, t);
        currentSkyColor2 = mix(dayColor2, sunsetColor2, t);
    } else {
        // Sunset to night
        float t = (timeOfDay - 0.875) / 0.125;
        currentSkyColor1 = mix(sunsetColor1, nightColor1, t);
        currentSkyColor2 = mix(sunsetColor2, nightColor2, t);
    }

    // Blend with user-defined colors for customization
    currentSkyColor1 = mix(currentSkyColor1, skyColor1, 0.3);
    currentSkyColor2 = mix(currentSkyColor2, skyColor2, 0.3);

    // Mix the colors based on gradient
    return mix(currentSkyColor1, currentSkyColor2, gradient);
}


// Generate tiny shiny dust particles
float generateParticles(vec2 uv) {
    if (particleCount <= 0.0) return 0.0;

    float particles = 0.0;

    // Create multiple particle layers for depth
    for (int i = 0; i < 4; i++) {
        float layerOffset = float(i) * 0.25;
        
        // Much larger grid for sparser particles
        vec2 particleCoord = uv * (25.0 + layerOffset * 15.0) + time * particleSpeed * vec2(0.1, 0.3 + layerOffset * 0.2);

        // Grid-based particles with random variations
        vec2 gridCoord = floor(particleCoord);
        vec2 cellCoord = fract(particleCoord);

        // Random particle position within cell
        vec2 particlePos = vec2(
            random(gridCoord + vec2(layerOffset)),
            random(gridCoord + vec2(layerOffset + 0.1))
        );

        // Only show particle if random value is above threshold (makes them sparse)
        float showParticle = step(0.85, random(gridCoord + vec2(layerOffset + 0.2)));
        
        // Distance from particle center
        float dist = length(cellCoord - particlePos);

        // Create very small, sharp particles
        float particle = 1.0 - smoothstep(0.0, particleSize * 0.02, dist);
        
        // Make them more point-like with sharper falloff
        particle = pow(particle, 3.0);

        // Enhanced twinkle effect for shiny dust
        float twinkleSpeed = 3.0 + layerOffset * 2.0;
        float twinkle = sin(time * twinkleSpeed + random(gridCoord) * 6.28) * 0.3 + 0.7;
        twinkle *= sin(time * twinkleSpeed * 1.3 + random(gridCoord + vec2(1.0)) * 6.28) * 0.2 + 0.8;
        
        particle *= twinkle * showParticle;

        particles += particle * (1.0 - float(i) * 0.2); // Subtle layer fading
    }

    return particles * particleCount * 0.8; // Overall intensity adjustment
}


void main() {
    vec2 uv = vUv;

    // Generate sky gradient
    vec3 skyColor = generateSkyGradient(uv);

    // Simple organic blobs using existing noise
    vec2 blobUV = uv * 2.0 + time * 0.1;
    float blob1 = fbm(blobUV + vec2(0.3, 0.1));
    float blob2 = fbm(blobUV * 1.3 + vec2(0.7, 0.5) + time * 0.05);
    
    // Combine blobs with smooth falloff
    float organicShape = smoothstep(0.3, 0.8, blob1) * 0.4 + smoothstep(0.4, 0.7, blob2) * 0.3;
    
    // Time-adaptive organic colors for visibility
    vec3 blobColor1, blobColor2;
    
    if (timeOfDay < 0.125) {
        // Night - bright warm colors
        blobColor1 = vec3(0.9, 0.7, 1.0);    // Light purple
        blobColor2 = vec3(1.0, 0.8, 0.9);    // Soft pink
    } else if (timeOfDay < 0.375) {
        // Sunrise - complementary to warm sky
        blobColor1 = vec3(0.7, 0.5, 1.0);    // Purple
        blobColor2 = vec3(1.0, 0.7, 0.8);    // Rose
    } else if (timeOfDay < 0.625) {
        // Day - darker colors for contrast
        blobColor1 = vec3(1.0, 0.8, 0.6);    // Peach
        blobColor2 = vec3(1.0, 0.6, 0.7);    // Coral
    } else if (timeOfDay < 0.875) {
        // Sunset - rich deep colors
        blobColor1 = vec3(0.8, 0.4, 0.9);    // Deep purple
        blobColor2 = vec3(1.0, 0.5, 0.6);    // Deep rose
    } else {
        // Back to night
        blobColor1 = vec3(0.9, 0.7, 1.0);    
        blobColor2 = vec3(1.0, 0.8, 0.9);    
    }
    
    vec3 blobColor = mix(blobColor1, blobColor2, organicShape);
    
    // Blend with sky
    vec3 finalColor = mix(skyColor, blobColor, organicShape * 0.4);

    // Add floating particles
    float particles = generateParticles(uv);
    vec3 particleColor = vec3(1.0, 1.0, 0.9);
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