/** Ownership (locus_of_control): Accountable (high) and Accepting (low). The low side stays private on share surfaces. */
import { idea, type InsightIdea } from './define';

export const LOCUS_OF_CONTROL_IDEAS: readonly InsightIdea[] = [
  idea("ftw_locus_of_control_h_01", ["locus_of_control:high"], {
    focus: [
      "Your answers suggest you look at the part of a problem you could steer.",
      "From your answers, you look at the part of a problem you could steer.",
      "The pattern in your answers is that you look at the part of a problem you could steer.",
    ],
    why: "The upside for you is a part that can change. The catch is a blame that lands only on you.",
    try: [
      "Next time you choose, name which part you could actually steer first.",
      "Before you decide, check what was outside your hands.",
    ],
    watch: [
      "Notice when you take the blame for a part you could not steer.",
      "Notice if the day really did do that part.",
    ],
  }),
  idea("ftw_locus_of_control_h_02", ["locus_of_control:high"], {
    focus: [
      "The catch in your answers is a blame that lands only on you.",
      "What this can cost you is a blame that lands only on you.",
      "A cost worth naming for you is a blame that lands only on you.",
    ],
    why: "The upside for you is a part that can change. The catch is a blame that lands only on you.",
    try: [
      "Next time you choose, name which part you could actually steer first.",
      "Before you decide, check what was outside your hands.",
    ],
    watch: [
      "Notice when you take the blame for a part you could not steer.",
      "Notice if the day really did do that part.",
    ],
  }),
  idea("ftw_locus_of_control_h_03", ["locus_of_control:high"], {
    focus: [
      "Someone else might notice that you look for the part you could steer instead of blaming the day.",
      "From the outside, you look for the part you could steer instead of blaming the day.",
      "Other people can see that you look for the part you could steer instead of blaming the day.",
    ],
    why: "The upside for you is a part that can change. The catch is a blame that lands only on you.",
    try: [
      "Next time you choose, name which part you could actually steer first.",
      "Before you decide, check what was outside your hands.",
    ],
    watch: [
      "Notice when you take the blame for a part you could not steer.",
      "Notice if the day really did do that part.",
    ],
  }),
  idea("ftw_locus_of_control_h_04", ["locus_of_control:high"], {
    focus: [
      "What you might miss is the part that was actually outside your hands.",
      "Your answers leave room to miss the part that was actually outside your hands.",
      "A thing you might skip is the part that was actually outside your hands.",
    ],
    why: "The upside for you is a part that can change. The catch is a blame that lands only on you.",
    try: [
      "Next time you choose, name which part you could actually steer first.",
      "Before you decide, check what was outside your hands.",
    ],
    watch: [
      "Notice when you take the blame for a part you could not steer.",
      "Notice if the day really did do that part.",
    ],
  }),
  idea("ftw_locus_of_control_h_05", ["locus_of_control:high"], {
    focus: [
      "The helpful side for you shows up when a steerable part is worth finding.",
      "Your answers also show a use when a steerable part is worth finding.",
      "There is a use for you when a steerable part is worth finding.",
    ],
    why: "The upside for you is a part that can change. The catch is a blame that lands only on you.",
    try: [
      "Next time you choose, name which part you could actually steer first.",
      "Before you decide, check what was outside your hands.",
    ],
    watch: [
      "Notice when you take the blame for a part you could not steer.",
      "Notice if the day really did do that part.",
    ],
  }),
  idea("ftw_locus_of_control_h_06", ["locus_of_control:high", "conscientiousness:high"], {
    focus: [
      "Your answers suggest two things at once: you look at your part, and you finish the plan.",
      "Both can be true for you in the same week: you look at your part, and you finish the plan.",
      "In the same week, you look at your part, and you finish the plan.",
    ],
    why: "The upside for you is a part that can change. The catch is a blame that lands only on you.",
    try: [
      "Next time you choose, name which part you could actually steer first.",
      "Before you decide, check what was outside your hands.",
    ],
    watch: [
      "Notice when you take the blame for a part you could not steer.",
      "Notice if the day really did do that part.",
    ],
  }),
  idea("ftw_locus_of_control_l_01", ["locus_of_control:low"], {
    focus: [
      "Your answers suggest you figure a bad outcome was bound to happen.",
      "From your answers, you figure a bad outcome was bound to happen.",
      "The pattern in your answers is that you figure a bad outcome was bound to happen.",
    ],
    why: "The upside for you is a cause outside the choice. The catch is a cause that ignores a real lever.",
    try: [
      "Next time you choose, name whether a lever is actually visible first.",
      "Before you decide, check what you could still change.",
    ],
    watch: [
      "Notice when you ignore a lever that was real.",
      "Notice if a part of it was yours to steer.",
    ],
  }),
  idea("ftw_locus_of_control_l_02", ["locus_of_control:low"], {
    focus: [
      "The catch in your answers is a cause that ignores a real lever.",
      "What this can cost you is a cause that ignores a real lever.",
      "A cost worth naming for you is a cause that ignores a real lever.",
    ],
    why: "The upside for you is a cause outside the choice. The catch is a cause that ignores a real lever.",
    try: [
      "Next time you choose, name whether a lever is actually visible first.",
      "Before you decide, check what you could still change.",
    ],
    watch: [
      "Notice when you ignore a lever that was real.",
      "Notice if a part of it was yours to steer.",
    ],
  }),
  idea("ftw_locus_of_control_l_03", ["locus_of_control:low"], {
    focus: [
      "Someone else might notice that you treat the outcome as bound to happen even when a lever is visible.",
      "From the outside, you treat the outcome as bound to happen even when a lever is visible.",
      "Other people can see that you treat the outcome as bound to happen even when a lever is visible.",
    ],
    why: "The upside for you is a cause outside the choice. The catch is a cause that ignores a real lever.",
    try: [
      "Next time you choose, name whether a lever is actually visible first.",
      "Before you decide, check what you could still change.",
    ],
    watch: [
      "Notice when you ignore a lever that was real.",
      "Notice if a part of it was yours to steer.",
    ],
  }),
  idea("ftw_locus_of_control_l_04", ["locus_of_control:low"], {
    focus: [
      "What you might miss is a lever you could have used.",
      "Your answers leave room to miss a lever you could have used.",
      "A thing you might skip is a lever you could have used.",
    ],
    why: "The upside for you is a cause outside the choice. The catch is a cause that ignores a real lever.",
    try: [
      "Next time you choose, name whether a lever is actually visible first.",
      "Before you decide, check what you could still change.",
    ],
    watch: [
      "Notice when you ignore a lever that was real.",
      "Notice if a part of it was yours to steer.",
    ],
  }),
  idea("ftw_locus_of_control_l_05", ["locus_of_control:low"], {
    focus: [
      "The helpful side for you shows up when some outcomes really are outside the choice.",
      "Your answers also show a use when some outcomes really are outside the choice.",
      "There is a use for you when some outcomes really are outside the choice.",
    ],
    why: "The upside for you is a cause outside the choice. The catch is a cause that ignores a real lever.",
    try: [
      "Next time you choose, name whether a lever is actually visible first.",
      "Before you decide, check what you could still change.",
    ],
    watch: [
      "Notice when you ignore a lever that was real.",
      "Notice if a part of it was yours to steer.",
    ],
  }),
  idea("ftw_locus_of_control_l_06", ["locus_of_control:low", "steadiness:high"], {
    focus: [
      "Your answers suggest two things at once: you blame the day, and you shake a bad day off.",
      "Both can be true for you in the same week: you blame the day, and you shake a bad day off.",
      "In the same week, you blame the day, and you shake a bad day off.",
    ],
    why: "The upside for you is a cause outside the choice. The catch is a cause that ignores a real lever.",
    try: [
      "Next time you choose, name whether a lever is actually visible first.",
      "Before you decide, check what you could still change.",
    ],
    watch: [
      "Notice when you ignore a lever that was real.",
      "Notice if a part of it was yours to steer.",
    ],
  })
];
