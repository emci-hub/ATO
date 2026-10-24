/** Curiosity (openness): Adventurous (high) and Familiar (low). */
import { idea, type InsightIdea } from './define';

export const OPENNESS_IDEAS: readonly InsightIdea[] = [
  idea("ftw_openness_h_01", ["openness:high"], {
    focus: [
      "Your answers suggest you like trying new things, even when a favorite is right there.",
      "From your answers, you like trying new things, even when a favorite is right there.",
      "The pattern in your answers is that you like trying new things, even when a favorite is right there.",
    ],
    why: "The upside for you is variety. The catch is passing on something that would have been more fun.",
    try: [
      "Next time you choose, name the favorite you already like first.",
      "Before you decide, check whether you would miss that favorite.",
    ],
    watch: [
      "Notice when the new option wins just for being new.",
      "Notice if a skipped favorite was the one you wanted.",
    ],
  }),
  idea("ftw_openness_h_02", ["openness:high"], {
    focus: [
      "The catch in your answers is passing on something that would have been more fun.",
      "What this can cost you is passing on something that would have been more fun.",
      "A cost worth naming for you is passing on something that would have been more fun.",
    ],
    why: "The upside for you is variety. The catch is passing on something that would have been more fun.",
    try: [
      "Next time you choose, name the favorite you already like first.",
      "Before you decide, check whether you would miss that favorite.",
    ],
    watch: [
      "Notice when the new option wins just for being new.",
      "Notice if a skipped favorite was the one you wanted.",
    ],
  }),
  idea("ftw_openness_h_03", ["openness:high"], {
    focus: [
      "Someone else might notice that you reach for a new option even when a favorite is still there.",
      "From the outside, you reach for a new option even when a favorite is still there.",
      "Other people can see that you reach for a new option even when a favorite is still there.",
    ],
    why: "The upside for you is variety. The catch is passing on something that would have been more fun.",
    try: [
      "Next time you choose, name the favorite you already like first.",
      "Before you decide, check whether you would miss that favorite.",
    ],
    watch: [
      "Notice when the new option wins just for being new.",
      "Notice if a skipped favorite was the one you wanted.",
    ],
  }),
  idea("ftw_openness_h_04", ["openness:high"], {
    focus: [
      "What you might miss is a favorite you would have enjoyed.",
      "Your answers leave room to miss a favorite you would have enjoyed.",
      "A thing you might skip is a favorite you would have enjoyed.",
    ],
    why: "The upside for you is variety. The catch is passing on something that would have been more fun.",
    try: [
      "Next time you choose, name the favorite you already like first.",
      "Before you decide, check whether you would miss that favorite.",
    ],
    watch: [
      "Notice when the new option wins just for being new.",
      "Notice if a skipped favorite was the one you wanted.",
    ],
  }),
  idea("ftw_openness_h_05", ["openness:high"], {
    focus: [
      "The helpful side for you shows up when the new option is actually the better one.",
      "Your answers also show a use when the new option is actually the better one.",
      "There is a use for you when the new option is actually the better one.",
    ],
    why: "The upside for you is variety. The catch is passing on something that would have been more fun.",
    try: [
      "Next time you choose, name the favorite you already like first.",
      "Before you decide, check whether you would miss that favorite.",
    ],
    watch: [
      "Notice when the new option wins just for being new.",
      "Notice if a skipped favorite was the one you wanted.",
    ],
  }),
  idea("ftw_openness_h_06", ["openness:high", "extraversion:high"], {
    focus: [
      "Your answers suggest two things at once: you try new things, and you want people around.",
      "Both can be true for you in the same week: you try new things, and you want people around.",
      "In the same week, you try new things, and you want people around.",
    ],
    why: "The upside for you is variety. The catch is passing on something that would have been more fun.",
    try: [
      "Next time you choose, name the favorite you already like first.",
      "Before you decide, check whether you would miss that favorite.",
    ],
    watch: [
      "Notice when the new option wins just for being new.",
      "Notice if a skipped favorite was the one you wanted.",
    ],
  }),
  idea("ftw_openness_l_01", ["openness:low"], {
    focus: [
      "Your answers suggest you stick with something you already know you like.",
      "From your answers, you stick with something you already know you like.",
      "The pattern in your answers is that you stick with something you already know you like.",
    ],
    why: "The upside for you is knowing what already works. The catch is skipping a change that would have been better.",
    try: [
      "Next time you choose, name what you already like first.",
      "Before you decide, check whether the new option is actually better.",
    ],
    watch: [
      "Notice when you skip a change just for being new.",
      "Notice if the new option was the one you wanted.",
    ],
  }),
  idea("ftw_openness_l_02", ["openness:low"], {
    focus: [
      "The catch in your answers is skipping a change that would have been better.",
      "What this can cost you is skipping a change that would have been better.",
      "A cost worth naming for you is skipping a change that would have been better.",
    ],
    why: "The upside for you is knowing what already works. The catch is skipping a change that would have been better.",
    try: [
      "Next time you choose, name what you already like first.",
      "Before you decide, check whether the new option is actually better.",
    ],
    watch: [
      "Notice when you skip a change just for being new.",
      "Notice if the new option was the one you wanted.",
    ],
  }),
  idea("ftw_openness_l_03", ["openness:low"], {
    focus: [
      "Someone else might notice that you stay with a known favorite even when a new option waits.",
      "From the outside, you stay with a known favorite even when a new option waits.",
      "Other people can see that you stay with a known favorite even when a new option waits.",
    ],
    why: "The upside for you is knowing what already works. The catch is skipping a change that would have been better.",
    try: [
      "Next time you choose, name what you already like first.",
      "Before you decide, check whether the new option is actually better.",
    ],
    watch: [
      "Notice when you skip a change just for being new.",
      "Notice if the new option was the one you wanted.",
    ],
  }),
  idea("ftw_openness_l_04", ["openness:low"], {
    focus: [
      "What you might miss is a new option you would have liked.",
      "Your answers leave room to miss a new option you would have liked.",
      "A thing you might skip is a new option you would have liked.",
    ],
    why: "The upside for you is knowing what already works. The catch is skipping a change that would have been better.",
    try: [
      "Next time you choose, name what you already like first.",
      "Before you decide, check whether the new option is actually better.",
    ],
    watch: [
      "Notice when you skip a change just for being new.",
      "Notice if the new option was the one you wanted.",
    ],
  }),
  idea("ftw_openness_l_05", ["openness:low"], {
    focus: [
      "The helpful side for you shows up when the favorite still fits.",
      "Your answers also show a use when the favorite still fits.",
      "There is a use for you when the favorite still fits.",
    ],
    why: "The upside for you is knowing what already works. The catch is skipping a change that would have been better.",
    try: [
      "Next time you choose, name what you already like first.",
      "Before you decide, check whether the new option is actually better.",
    ],
    watch: [
      "Notice when you skip a change just for being new.",
      "Notice if the new option was the one you wanted.",
    ],
  }),
  idea("ftw_openness_l_06", ["openness:low", "conscientiousness:high"], {
    focus: [
      "Your answers suggest two things at once: you keep a known favorite, and you finish the plan.",
      "Both can be true for you in the same week: you keep a known favorite, and you finish the plan.",
      "In the same week, you keep a known favorite, and you finish the plan.",
    ],
    why: "The upside for you is knowing what already works. The catch is skipping a change that would have been better.",
    try: [
      "Next time you choose, name what you already like first.",
      "Before you decide, check whether the new option is actually better.",
    ],
    watch: [
      "Notice when you skip a change just for being new.",
      "Notice if the new option was the one you wanted.",
    ],
  })
];
