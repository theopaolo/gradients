import { animate, spring, stagger } from "motion"

document.addEventListener('DOMContentLoaded', () => {
  const smoothWebSpans = document.querySelectorAll(".smooth-web span");
  const introP = document.querySelector(".p-container p");

  const sequence = [
    [smoothWebSpans,
      { transform: "translateY(0px)", opacity: 1 },
      { duration: 1.5, type: spring, bounce: 0.4, delay: stagger(0.1) }
    ],
    [introP,
      { transform: "translateY(0px)", opacity: 1 },
      { duration: 1.5, type: spring, bounce: 0.1, at: .5 }
    ]
  ];

  setTimeout(() => {
    animate(sequence);
  }, 200);
});
