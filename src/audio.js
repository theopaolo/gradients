import * as Tone from "tone";

// Create audio analyzers
const waveformAnalyzer = new Tone.Analyser("waveform", 1024);
const fftAnalyzer = new Tone.Analyser("fft", 1024);
// Create an object to store audio data that will be passed to the shader
export const audioData = {
    waveform: new Float32Array(1024),
    spectrum: new Float32Array(1024),
    volume: 0,
    bassEnergy: 0,
    midEnergy: 0,
    highEnergy: 0,
    // Add a transition state flag for smoother changes
    isTransitioning: false,
    transitionStart: 0
};

const delay = new Tone.FeedbackDelay({
    delayTime: "16n",
    feedback: 0.5,
    wet: 0.9
});

const reverb = new Tone.Reverb({
    decay: .5,
    wet: 0.5,
    roomSize: 0.5,
    preDelay: 0.5,
});

const room = new Tone.Freeverb({
    roomSize: 0.5,
    dampening: 100,
    width: 100,
    decay: 1.5,
    preDelay: 0.5,
});

// Connect effects chain
delay.connect(reverb);
reverb.connect(room);
room.toDestination();
room.connect(waveformAnalyzer);
room.connect(fftAnalyzer);

const autoPanner = new Tone.AutoPanner("4n").toDestination().start();

const synth = new Tone.PolySynth({
    oscillator: {
        type: "sine",
    },
    envelope: {
        attack: 0.1,
        decay: 0.2,
        sustain: 1,
        release: 0.5
    }
}).connect(delay).connect(autoPanner);

function playForDuration(durationInBars) {
    const startTime = Tone.Transport.seconds + 0.1;
    // Calculate when 3 bars will end
    const endTime = startTime + Tone.Time(durationInBars + "m").toSeconds();

    // Schedule note start
    Tone.Transport.schedule((time) => {
        synth.triggerAttack(["C3", "G3", "C4"], time);
    }, startTime);

    // Schedule note end
    Tone.Transport.schedule((time) => {
        synth.triggerRelease(["C3", "G3", "C4"], time);
    }, endTime);
}

function playChordWithDuration(chord, durationInBars) {
    Tone.Transport.scheduleOnce((time) => {
        synth.triggerAttackRelease(chord, durationInBars + "m", time);
    }, "+0.1");  // Start slightly in the future
}

let playButton = document.getElementById("play-button");
let isPlaying = false;
const TRANSITION_DURATION = 1.0; // Transition duration in seconds

// Function to immediately reset audio data to zero
function resetAudioData() {
    // Clear the waveform and spectrum data
    for (let i = 0; i < audioData.waveform.length; i++) {
        audioData.waveform[i] = 0;
    }
    for (let i = 0; i < audioData.spectrum.length; i++) {
        audioData.spectrum[i] = 0;
    }

    // Reset energy values
    audioData.volume = 0;
    audioData.bassEnergy = 0;
    audioData.midEnergy = 0;
    audioData.highEnergy = 0;
    audioData.isTransitioning = false;
}

// Function to start a smooth transition out
function startTransition() {
    audioData.isTransitioning = true;
    audioData.transitionStart = performance.now() / 1000.0; // Current time in seconds
}

// Function to update audio data for the shader
function updateAudioData() {
    const currentTime = performance.now() / 1000.0;

    if (isPlaying) {
        // Get waveform data
        audioData.waveform = waveformAnalyzer.getValue();

        // Get frequency spectrum data
        audioData.spectrum = fftAnalyzer.getValue();

        // Calculate volume (RMS of waveform)
        let sum = 0;
        for (let i = 0; i < audioData.waveform.length; i++) {
            sum += audioData.waveform[i] * audioData.waveform[i];
        }
        audioData.volume = Math.sqrt(sum / audioData.waveform.length);

        // Calculate energy in different frequency bands
        const bassRange = [0, 100]; // 0-100Hz (bass)
        const midRange = [100, 2000]; // 100-2000Hz (mids)
        const highRange = [2000, 20000]; // 2000-20000Hz (highs)

        let bassSum = 0, midSum = 0, highSum = 0;
        let bassCount = 0, midCount = 0, highCount = 0;

        // FFT data frequency resolution
        const nyquist = 22050; // Half of standard 44.1kHz sampling rate
        const frequencyBinSize = nyquist / audioData.spectrum.length;

        for (let i = 0; i < audioData.spectrum.length; i++) {
            const frequency = i * frequencyBinSize;
            const amplitude = Math.max(0, audioData.spectrum[i]); // Ensure positive value

            if (frequency >= bassRange[0] && frequency <= bassRange[1]) {
                bassSum += amplitude;
                bassCount++;
            } else if (frequency >= midRange[0] && frequency <= midRange[1]) {
                midSum += amplitude;
                midCount++;
            } else if (frequency >= highRange[0] && frequency <= highRange[1]) {
                highSum += amplitude;
                highCount++;
            }
        }

        // Normalize energy values (0-1 range)
        audioData.bassEnergy = bassCount > 0 ? Math.min(1, Math.max(0, bassSum / bassCount + 0.5)) : 0;
        audioData.midEnergy = midCount > 0 ? Math.min(1, Math.max(0, midSum / midCount + 0.5)) : 0;
        audioData.highEnergy = highCount > 0 ? Math.min(1, Math.max(0, highSum / highCount + 0.5)) : 0;

        // Reset transition state if active
        audioData.isTransitioning = false;
    } else if (audioData.isTransitioning) {
        // Calculate fade factor (0 to 1) based on time elapsed since transition started
        const elapsed = currentTime - audioData.transitionStart;
        const fadeProgress = Math.min(elapsed / TRANSITION_DURATION, 1.0);

        if (fadeProgress >= 1.0) {
            // Transition completed, reset everything
            resetAudioData();
        } else {
            // Apply fade out to all values
            const fadeOut = 1.0 - fadeProgress;
            audioData.volume *= fadeOut;
            audioData.bassEnergy *= fadeOut;
            audioData.midEnergy *= fadeOut;
            audioData.highEnergy *= fadeOut;

            // Also gradually fade the waveform for visualizations
            for (let i = 0; i < audioData.waveform.length; i++) {
                audioData.waveform[i] *= fadeOut;
            }

            for (let i = 0; i < audioData.spectrum.length; i++) {
                audioData.spectrum[i] *= fadeOut;
            }
        }
    }

    // Schedule next update
    requestAnimationFrame(updateAudioData);
}

// Start the audio data update loop
updateAudioData();

// Add a listener to detect when the 3m audio finishes
Tone.Transport.scheduleRepeat((time) => {
    // Check if we're at the 3m mark (in seconds)
    const currentTime = Tone.Transport.seconds;
    // 3 measures at default 120bpm = 6 seconds (each measure is 2s at 120bpm)
    if (currentTime >= 6 && isPlaying) {
        // Stop playing and reset
        isPlaying = false;
        Tone.Transport.stop();
        playButton.classList.remove("playing");
        playButton.innerText = "Play";
        // Start smooth transition instead of immediate reset
        startTransition();
    }
}, "0.1"); // Check every 0.1 seconds

playButton.addEventListener("mousedown", () => {
  isPlaying = !isPlaying;

  if (isPlaying) {
    Tone.start();
    Tone.Transport.start();
    // Reset transport time to ensure we start from beginning
    Tone.Transport.seconds = 0;

    Tone.Transport.scheduleOnce((time) => {
        synth.triggerAttackRelease(["C3", "G3", "C4"], "3m", time);
    }, "+0.1");

    playButton.classList.add("playing");
    playButton.innerText = "Pause";
  } else {
    Tone.Transport.stop();
    playButton.classList.remove("playing");
    playButton.innerText = "Play";
    // Start a smooth transition instead of immediately resetting
    startTransition();
  }
});
