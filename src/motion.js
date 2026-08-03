import { animate, spring, stagger } from "motion";
import { TITLE_SELECTOR, PARAGRAPH_SELECTOR } from "./constants.js";

const TITLE_LINE_SELECTOR = `${TITLE_SELECTOR} span`;

const INTRO_DELAY = 500;

const from = {
  opacity: [0, 1],
  transform: ["translateY(100px)", "translateY(0px)"],
};

let introTimer;

// Elements are queried on every run so the intro still works after the config
// panel rebuilds the title lines.
const introElements = () => [
  ...document.querySelectorAll(TITLE_LINE_SELECTOR),
  document.querySelector(PARAGRAPH_SELECTOR),
];

function runIntro() {
  const smoothWebSpans = document.querySelectorAll(TITLE_LINE_SELECTOR);
  const introP = document.querySelector(PARAGRAPH_SELECTOR);

  // The start value has to be an explicit keyframe rather than a style reset:
  // Motion animates from its own cached value for each element, which writing
  // to element.style does not update. Without it a replay runs from 1 to 1.
  const sequence = [
    [
      smoothWebSpans,
      from,
      { duration: 1.5, type: spring, bounce: 0.4, delay: stagger(0.2) },
    ],
    [introP, from, { duration: 1.5, type: spring, bounce: 0.1, at: 0.6 }],
  ];

  const controls = animate(sequence);

  // Motion drops back to each element's own style for a frame as the sequence
  // finishes. Parking them at the end state now — the animation is already
  // driving the visible value from its keyframes — keeps that frame from
  // flashing the hidden state set before the delay.
  introElements().forEach((element) => {
    element.style.opacity = "1";
    element.style.transform = "translateY(0px)";
  });

  return controls;
}

// Owns the delay so a replay matches the page load exactly. The text is hidden
// up front because on load the CSS start state covers the wait — without this a
// replay would sit visible for the delay, then snap to hidden as it starts.
export function playIntro() {
  clearTimeout(introTimer);

  introElements().forEach((element) => {
    element.style.opacity = "0";
    element.style.transform = "translateY(100px)";
  });

  introTimer = setTimeout(runIntro, INTRO_DELAY);
}

document.addEventListener("DOMContentLoaded", playIntro);
