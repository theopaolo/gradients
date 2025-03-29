const fragmentShader = `
varying vec2 vUv; // Input: UV coordinates from vertex shader (usually 0.0 to 1.0)
uniform float time; // Input: Time value from JavaScript (for animation)
uniform vec2 resolution; // Input: Resolution of the canvas (useful for aspect ratio, etc.)

// --- Helper Functions ---

// Converts RGB values (0-255 range) to normalized vec3 (0.0-1.0 range)
vec3 rgb(float r, float g, float b) {
    return vec3(r, g, b) / 255.0;
}

// Fonction de bruit pseudo-aléatoire
float random(vec2 fragCoord) {
    // Utilise les coordonnées et le temps pour un bruit dynamique
    // Le * 15.0 sur time contrôle la vitesse du scintillement du grain
    float noise = fract(sin(dot(fragCoord.xy, vec2(12.9898, 78.233)) + time * 15.0) * 43758.5453);
    return noise;
}

// --- Main Shader Logic ---

void main() {

    // --- Setup & Base Variables ---
    vec2 uv = vUv; // Use the interpolated UV coordinates
    float slowTime = time * 0.35; // A slower time variable for some effects

    // --- Effect 1: Dual Moving Origin Wave Pattern ---
    // This is the primary visual pattern used for the final color.

    // Define two origins moving independently based on slowTime
    vec2 origin1 = vec2(
        0.5 + cos(slowTime * 0.5) * 0.3,
        0.5 + sin(slowTime * 0.5) * 0.3
    );
    vec2 origin2 = vec2(
        0.5 + cos(slowTime * 0.7 + 2.0) * 0.4,
        0.5 + sin(slowTime * 0.3) * 0.2
    );
    vec2 origin3 = vec2(
        0.5 + cos(slowTime * -0.4 + 4.0) * 0.25,
        0.5 + sin(slowTime * 0.8 + 0.5) * 0.35
    );

    // Calculate distances from the current UV to each origin
    float dist1 = length(uv - origin1) * 2.0; // Multiplier affects wave density
    float dist2 = length(uv - origin2) * 2.0;
    float dist3 = length(uv - origin3) * 2.0;

    // Calculate combined wave patterns for each origin
    float wave1_o1 = sin(dist1 * 8.0 - slowTime) * 0.5 + 0.5;                 // Radial wave
    float wave2_o1 = sin((uv.x - origin1.x) * 18.0 + slowTime * 1.5) * 0.5 + 0.5; // X-coord wave
    float wave3_o1 = sin((uv.y - origin1.y) * 12.5 - slowTime * 0.5) * 0.5 + 0.5; // Y-coord wave
    // Combine waves for origin 1 using weighted average
    float finalWave_o1 = (wave1_o1 * 0.5 + wave2_o1 * 0.3 + wave3_o1 * 0.2);

    // Calculate wave components for the second origin
    float wave1_o2 = sin(dist2 * 8.0 - slowTime * 0.8) * 0.5 + 0.5;         // Radial wave
    float wave2_o2 = sin((uv.x - origin2.x) * 13.5 + slowTime * 0.7) * 0.5 + 0.5; // X-coord wave
    float wave3_o2 = sin((uv.y - origin2.y) * 10.0 - slowTime * 1.2) * 0.5 + 0.5; // Y-coord wave
    // Combine waves for origin 2 using weighted average
    float finalWave_o2 = (wave1_o2 * 0.5 + wave2_o2 * 0.3 + wave3_o2 * 0.2);

    // Calculate wave components for the third origin
    float wave1_o3 = sin(dist3 * 10.0 + slowTime * 0.6) * 0.5 + 0.5; // Fréq/vitesse différente
    float wave2_o3 = sin((uv.x - origin3.x) * 5.0 - slowTime * 1.1) * 0.5 + 0.5;
    float wave3_o3 = sin((uv.y - origin3.y) * 7.0 + slowTime * 0.9) * 0.5 + 0.5;
    float finalWave_o3 = (wave1_o3 * 0.4 + wave2_o3 * 0.4 + wave3_o3 * 0.2); // Poids différents

    // Mix the patterns from the two origins dynamically
    // float mixFactor = sin(slowTime * 0.1) * 0.4 + 0.6; // Mix factor oscillates between 0.2 and 1.0
    // float finalPattern = mix(finalWave_o1, finalWave_o2, mixFactor); // This value drives the main color mix

      // *** COMBINER LES N EFFETS ***
    // Au lieu de 'mix', on additionne les contributions et on divise par N
    const float N = 3.0; // Nombre total d'origines actives ! Mettez à jour si vous en ajoutez/retirez.
    float combinedPattern = finalWave_o1 + finalWave_o2 + finalWave_o3; // Ajoutez + finalWave_o4...
    float finalPattern = combinedPattern / N; // Moyenne pour garder dans la plage ~0-1

    // --- Effect 2: Vignette ---
    // Darkens the edges of the screen slightly.
    vec2 centerDistUV = uv - 0.5; // Vector from center to current UV
    float vignetteTightness = 1.8; // How sharp the vignette edge is
    float vignetteRadius = 1.2;   // How far the vignette extends
    float vignette = smoothstep(0.0, 1.0, vignetteRadius - length(centerDistUV * vignetteTightness));

    // --- Final Color Calculation ---
    // Determine the color based on the vignette and the calculated wave pattern.
    vec3 purple = rgb(90.0, 96.0, 211.0);
    vec3 lightBlue = rgb(226.0, 232.0, 255.0);
    vec3 pink = rgb(245.0, 100.0, 140.0);

    //     // Color towards the edges (influenced by vignette)
    //     vec3 edgeColor = mix(purple, pink, vignette);
    //     // Color towards the center (influenced by the main pattern)
    //     vec3 centerColor = mix(purple, lightBlue, finalPattern);
    //      // Mélange des deux basé sur pattern
    //     vec3 colorBase = mix(edgeColor, centerColor, finalPattern);
    //     // Blend between edge and center colors based on the main pattern value
    //    vec3 finalColor = colorBase;

 // Créer 3 mélanges de couleurs différents, chacun piloté par une vague différente:
    // Mélange 1 : entre Purple et Pink, contrôlé par la vague de l'origine 1
    vec3 mix1 = mix(purple, pink, finalWave_o1);

    // Mélange 2 : entre Pink et LightBlue, contrôlé par la vague de l'origine 2
    vec3 mix2 = mix(pink, lightBlue, finalWave_o2);

    // Mélange 3 : entre LightBlue et Purple (on boucle), contrôlé par la vague de l'origine 3
    vec3 mix3 = mix(lightBlue, purple, finalWave_o3);

    // Combiner ces 3 mélanges pour obtenir la couleur finale.
    // Une moyenne simple donne une bonne répartition de l'influence des 3.
    vec3 intermediateColor = mix(mix1, mix3, finalWave_o2);
    vec3 finalColor = mix(intermediateColor, mix2, finalWave_o1);

    float staticGrain = random(uv * 10.0) * 2.0 - 1.0;

    // Création d'un grain animé (change avec le temps)
    float animatedGrain = random(uv + time * 0.01) * 2.0 - 1.0;

    // Mélange des deux types de grain
    float grain = mix(staticGrain, animatedGrain, 0.3);

    // Ajustement de l'intensité du grain
    float grainIntensity = 0.015; // Valeur entre 0.01 (subtil) et 0.1 (prononcé)

    // Application du grain à la couleur finale
    finalColor += grain * grainIntensity;

    // --- Output ---
    gl_FragColor = vec4(finalColor, 1.0); // Set the final pixel color


    // ==========================================================================
    // --- UNUSED CODE / PREVIOUS EXPERIMENTS (Kept for reference below main) ---
    // ==========================================================================

    /*
    // [Experiment] Simple Ripple Effect (based on original 'time' and origins)
    // This calculation is performed but finalRipple is not used in the final gl_FragColor.
    float ripple1 = sin(dist1 * 10.0 - time * 2.0) * 0.5 + 0.5;
    float ripple2 = sin(dist2 * 8.0 - time * 1.5) * 0.5 + 0.5;
    float finalRipple = mix(ripple1, ripple2, 0.5); // -> finalRipple is UNUSED
    // float ripple = sin(dist * 10.0 - time * 2.0) * 0.5 + 0.5; // Based on single 'dist'
    */

    /*
    // [Experiment] Single Moving Origin Calculations
    // Defines a different origin motion and calculates waves based on it.
    // The result finalWave is not used in the final gl_FragColor.
    float varyingSpeed = 0.3 + sin(time * 0.2) * 0.2; // Speed varies between 0.1 and 0.5
    float radius = 0.5; // Controls how far from center the origin moves

    // Simple circular motion with varying speed
    vec2 movingOrigin = vec2(
        0.5 + cos(time * varyingSpeed) * radius,
        0.5 + sin(time * varyingSpeed) * radius
    );
    // // Figure-8 (Lissajous) pattern alternative
    // float speed_lissajous = 0.2;
    // float radius_lissajous = 0.5;
    // vec2 movingOriginLissajous = vec2(
    //     0.5 + cos(time * speed_lissajous) * radius_lissajous,
    //     0.5 + sin(time * speed_lissajous * 2.0) * radius_lissajous * 0.5
    // );
    // // Wandering motion alternative (combining multiple waves)
    // vec2 movingOriginWander = vec2(
    //    0.5 + cos(time * speed) * radius + sin(time * speed * 2.7) * radius * 0.3,
    //    0.5 + sin(time * speed * 1.3) * radius + cos(time * speed * 3.1) * radius * 0.2
    // );

    // Calculate distance from the single moving origin
    vec2 fromOrigin = uv - movingOrigin; // Use the chosen movingOrigin here
    float dist = length(fromOrigin) * 2.0;

    // Calculate waves based on this single origin
    float wave1 = sin(dist * 10.0 - time * varyingSpeed) * 0.5 + 0.5;
    float wave2 = sin(uv.x * 15.0 - time * varyingSpeed) * 0.5 + 0.5;
    float wave3 = sin(uv.y * 8.0 - time) * 0.5 + 0.5;
    float finalWave = (wave1 + wave2 + wave3) / 3.0; // -> finalWave is UNUSED
    */

    /*
    // [Experiment] Simple horizontal wave (unused)
    float wave = sin(uv.x * 10.0 + time) * 0.5 + 0.5; // -> wave is UNUSED
    */

    /*
    // [Unused Variable] Original center calculation
    vec2 center = uv - 0.5; // -> center is UNUSED (replaced by centerDistUV for vignette)
    */

} // End of main()
`;

export default fragmentShader;