import * as Tone from "tone";

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
    wet: 0.5,
    roomSize: 0.5,
    preDelay: 0.5,
})

const room = new Tone.Freeverb({
    roomSize: 0.5,
    dampening: 100,
    width: 100,
    decay: 1.5,
    preDelay: 0.5,
})

// Connect effects chain
delay.connect(reverb);
reverb.connect(room);
room.toDestination();
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
    const startTime = Tone.getTransport.seconds + 0.1;
    // Calculate when 3 bars will end
    const endTime = startTime + Tone.Time(durationInBars + "m").toSeconds();

    // Schedule note start
    Tone.getTransport.schedule((time) => {
        synth.triggerAttack(["C3", "G3", "C4"], time);
    }, startTime);

    // Schedule note end
    Tone.getTransport.schedule((time) => {
        synth.triggerRelease(["C3", "G3", "C4"], time);
    }, endTime);
}

function playChordWithDuration(chord, durationInBars) {
    Tone.getTransport.scheduleOnce((time) => {
        synth.triggerAttackRelease(chord, durationInBars + "m", time);
    }, "+0.1");  // Start slightly in the future
}

let playButton = document.getElementById("play-button");
let isPlaying = false;


playButton.addEventListener("mousedown", () => {
  isPlaying = !isPlaying;

  if (isPlaying) {
    Tone.start();
    Tone.getTransport().start();

    Tone.getTransport().scheduleOnce((time) => {
        synth.triggerAttackRelease(["C3", "G3", "C4"], "3m", time);
    }, "+0.1");

    playButton.classList.add("playing");
    playButton.innerText = "Pause";
  } else {
    Tone.getTransport().stop();
    playButton.classList.remove("playing");
    playButton.innerText = "Play";
  }
});
