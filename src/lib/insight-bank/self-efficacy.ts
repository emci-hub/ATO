/** Self-belief (self_efficacy): Bold (high) and Hesitant (low). The low side stays private on share surfaces. */
import { idea, type InsightIdea } from './define';

export const SELF_EFFICACY_IDEAS: readonly InsightIdea[] = [
  idea("ftw_self_efficacy_h_01", ["self_efficacy:high"], {
    focus: [
      "Your answers suggest you expect to finish a big task once it is started.",
      "From your answers, you expect to finish a big task once it is started.",
      "The pattern in your answers is that you expect to finish a big task once it is started.",
    ],
    why: "The upside for you is a start that continues. The catch is a start that ignores the size.",
    try: [
      "Next time you choose, name how big the task actually is first.",
      "Before you decide, check whether the start matches the size.",
    ],
    watch: [
      "Notice when you ignore the size and stall in the middle.",
      "Notice if the task was bigger than the start.",
    ],
  }),
  idea("ftw_self_efficacy_h_02", ["self_efficacy:high"], {
    focus: [
      "The catch in your answers is a start that ignores the size.",
      "What this can cost you is a start that ignores the size.",
      "A cost worth naming for you is a start that ignores the size.",
    ],
    why: "The upside for you is a start that continues. The catch is a start that ignores the size.",
    try: [
      "Next time you choose, name how big the task actually is first.",
      "Before you decide, check whether the start matches the size.",
    ],
    watch: [
      "Notice when you ignore the size and stall in the middle.",
      "Notice if the task was bigger than the start.",
    ],
  }),
  idea("ftw_self_efficacy_h_03", ["self_efficacy:high"], {
    focus: [
      "Someone else might notice that you start a big task and expect to finish it.",
      "From the outside, you start a big task and expect to finish it.",
      "Other people can see that you start a big task and expect to finish it.",
    ],
    why: "The upside for you is a start that continues. The catch is a start that ignores the size.",
    try: [
      "Next time you choose, name how big the task actually is first.",
      "Before you decide, check whether the start matches the size.",
    ],
    watch: [
      "Notice when you ignore the size and stall in the middle.",
      "Notice if the task was bigger than the start.",
    ],
  }),
  idea("ftw_self_efficacy_h_04", ["self_efficacy:high"], {
    focus: [
      "What you might miss is the size of the task.",
      "Your answers leave room to miss the size of the task.",
      "A thing you might skip is the size of the task.",
    ],
    why: "The upside for you is a start that continues. The catch is a start that ignores the size.",
    try: [
      "Next time you choose, name how big the task actually is first.",
      "Before you decide, check whether the start matches the size.",
    ],
    watch: [
      "Notice when you ignore the size and stall in the middle.",
      "Notice if the task was bigger than the start.",
    ],
  }),
  idea("ftw_self_efficacy_h_05", ["self_efficacy:high"], {
    focus: [
      "The helpful side for you shows up when expecting to finish can get the task going.",
      "Your answers also show a use when expecting to finish can get the task going.",
      "There is a use for you when expecting to finish can get the task going.",
    ],
    why: "The upside for you is a start that continues. The catch is a start that ignores the size.",
    try: [
      "Next time you choose, name how big the task actually is first.",
      "Before you decide, check whether the start matches the size.",
    ],
    watch: [
      "Notice when you ignore the size and stall in the middle.",
      "Notice if the task was bigger than the start.",
    ],
  }),
  idea("ftw_self_efficacy_h_06", ["self_efficacy:high", "openness:high"], {
    focus: [
      "Your answers suggest two things at once: you expect to finish, and you try new things.",
      "Both can be true for you in the same week: you expect to finish, and you try new things.",
      "A week can hold both for you, so you expect to finish, while you try new things.",
    ],
    why: "The upside for you is a start that continues. The catch is a start that ignores the size.",
    try: [
      "Next time you choose, name how big the task actually is first.",
      "Before you decide, check whether the start matches the size.",
    ],
    watch: [
      "Notice when you ignore the size and stall in the middle.",
      "Notice if the task was bigger than the start.",
    ],
  }),
  idea("ftw_self_efficacy_l_01", ["self_efficacy:low"], {
    focus: [
      "Your answers suggest you pause before trusting a big task can be finished.",
      "From your answers, you pause before trusting a big task can be finished.",
      "The pattern in your answers is that you pause before trusting a big task can be finished.",
    ],
    why: "The upside for you is a careful pause. The catch is a pause that never becomes a start.",
    try: [
      "Next time you choose, name the small version you could start first.",
      "Before you decide, check whether the pause is still useful.",
    ],
    watch: [
      "Notice when the pause never becomes a start.",
      "Notice if the small version would have been enough.",
    ],
  }),
  idea("ftw_self_efficacy_l_02", ["self_efficacy:low"], {
    focus: [
      "The catch in your answers is a pause that never becomes a start.",
      "What this can cost you is a pause that never becomes a start.",
      "A cost worth naming for you is a pause that never becomes a start.",
    ],
    why: "The upside for you is a careful pause. The catch is a pause that never becomes a start.",
    try: [
      "Next time you choose, name the small version you could start first.",
      "Before you decide, check whether the pause is still useful.",
    ],
    watch: [
      "Notice when the pause never becomes a start.",
      "Notice if the small version would have been enough.",
    ],
  }),
  idea("ftw_self_efficacy_l_03", ["self_efficacy:low"], {
    focus: [
      "Someone else might notice that you pause on a big task even when a small version is available.",
      "From the outside, you pause on a big task even when a small version is available.",
      "Other people can see that you pause on a big task even when a small version is available.",
    ],
    why: "The upside for you is a careful pause. The catch is a pause that never becomes a start.",
    try: [
      "Next time you choose, name the small version you could start first.",
      "Before you decide, check whether the pause is still useful.",
    ],
    watch: [
      "Notice when the pause never becomes a start.",
      "Notice if the small version would have been enough.",
    ],
  }),
  idea("ftw_self_efficacy_l_04", ["self_efficacy:low"], {
    focus: [
      "What you might miss is the small version that was available.",
      "Your answers leave room to miss the small version that was available.",
      "A thing you might skip is the small version that was available.",
    ],
    why: "The upside for you is a careful pause. The catch is a pause that never becomes a start.",
    try: [
      "Next time you choose, name the small version you could start first.",
      "Before you decide, check whether the pause is still useful.",
    ],
    watch: [
      "Notice when the pause never becomes a start.",
      "Notice if the small version would have been enough.",
    ],
  }),
  idea("ftw_self_efficacy_l_05", ["self_efficacy:low"], {
    focus: [
      "The helpful side for you shows up when a pause can be a careful read.",
      "Your answers also show a use when a pause can be a careful read.",
      "There is a use for you when a pause can be a careful read.",
    ],
    why: "The upside for you is a careful pause. The catch is a pause that never becomes a start.",
    try: [
      "Next time you choose, name the small version you could start first.",
      "Before you decide, check whether the pause is still useful.",
    ],
    watch: [
      "Notice when the pause never becomes a start.",
      "Notice if the small version would have been enough.",
    ],
  }),
  idea("ftw_self_efficacy_l_06", ["self_efficacy:low", "competence:low"], {
    focus: [
      "Your answers suggest two things at once: you pause on the big task, and you doubt the hard task.",
      "Both can be true for you in the same week: you pause on the big task, and you doubt the hard task.",
      "A week can hold both for you, so you pause on the big task, while you doubt the hard task.",
    ],
    why: "The upside for you is a careful pause. The catch is a pause that never becomes a start.",
    try: [
      "Next time you choose, name the small version you could start first.",
      "Before you decide, check whether the pause is still useful.",
    ],
    watch: [
      "Notice when the pause never becomes a start.",
      "Notice if the small version would have been enough.",
    ],
  })
];
