/** Independence (autonomy): Self-directed (high) and Guided (low). */
import { idea, type InsightIdea } from './define';

export const AUTONOMY_IDEAS: readonly InsightIdea[] = [
  idea("ftw_autonomy_h_01", ["autonomy:high"], {
    focus: [
      "Your answers suggest you want to do a task in a way you chose.",
      "From your answers, you want to do a task in a way you chose.",
      "The pattern in your answers is that you want to do a task in a way you chose.",
    ],
    why: "The upside for you is a way that fits. The catch is a way that ignores a good set path.",
    try: [
      "Next time you choose, name whether the set path is actually good first.",
      "Before you decide, check what your way is costing.",
    ],
    watch: [
      "Notice when you ignore a set path that would have worked.",
      "Notice if the set path was the better way.",
    ],
  }),
  idea("ftw_autonomy_h_02", ["autonomy:high"], {
    focus: [
      "The catch in your answers is a way that ignores a good set path.",
      "What this can cost you is a way that ignores a good set path.",
      "A cost worth naming for you is a way that ignores a good set path.",
    ],
    why: "The upside for you is a way that fits. The catch is a way that ignores a good set path.",
    try: [
      "Next time you choose, name whether the set path is actually good first.",
      "Before you decide, check what your way is costing.",
    ],
    watch: [
      "Notice when you ignore a set path that would have worked.",
      "Notice if the set path was the better way.",
    ],
  }),
  idea("ftw_autonomy_h_03", ["autonomy:high"], {
    focus: [
      "Someone else might notice that you pick your own way even when a set path is available.",
      "From the outside, you pick your own way even when a set path is available.",
      "Other people can see that you pick your own way even when a set path is available.",
    ],
    why: "The upside for you is a way that fits. The catch is a way that ignores a good set path.",
    try: [
      "Next time you choose, name whether the set path is actually good first.",
      "Before you decide, check what your way is costing.",
    ],
    watch: [
      "Notice when you ignore a set path that would have worked.",
      "Notice if the set path was the better way.",
    ],
  }),
  idea("ftw_autonomy_h_04", ["autonomy:high"], {
    focus: [
      "What you might miss is a set path that would have worked.",
      "Your answers leave room to miss a set path that would have worked.",
      "A thing you might skip is a set path that would have worked.",
    ],
    why: "The upside for you is a way that fits. The catch is a way that ignores a good set path.",
    try: [
      "Next time you choose, name whether the set path is actually good first.",
      "Before you decide, check what your way is costing.",
    ],
    watch: [
      "Notice when you ignore a set path that would have worked.",
      "Notice if the set path was the better way.",
    ],
  }),
  idea("ftw_autonomy_h_05", ["autonomy:high"], {
    focus: [
      "The helpful side for you shows up when a self-chosen way can fit better.",
      "Your answers also show a use when a self-chosen way can fit better.",
      "There is a use for you when a self-chosen way can fit better.",
    ],
    why: "The upside for you is a way that fits. The catch is a way that ignores a good set path.",
    try: [
      "Next time you choose, name whether the set path is actually good first.",
      "Before you decide, check what your way is costing.",
    ],
    watch: [
      "Notice when you ignore a set path that would have worked.",
      "Notice if the set path was the better way.",
    ],
  }),
  idea("ftw_autonomy_h_06", ["autonomy:high", "relatedness:low"], {
    focus: [
      "Your answers suggest two things at once: you choose the way, and you can skip the tie.",
      "Both can be true for you in the same week: you choose the way, and you can skip the tie.",
      "A week can hold both for you, so you choose the way, and you can skip the tie.",
    ],
    why: "The upside for you is a way that fits. The catch is a way that ignores a good set path.",
    try: [
      "Next time you choose, name whether the set path is actually good first.",
      "Before you decide, check what your way is costing.",
    ],
    watch: [
      "Notice when you ignore a set path that would have worked.",
      "Notice if the set path was the better way.",
    ],
  }),
  idea("ftw_autonomy_l_01", ["autonomy:low"], {
    focus: [
      "Your answers suggest you follow a path that is already set.",
      "From your answers, you follow a path that is already set.",
      "The pattern in your answers is that you follow a path that is already set.",
    ],
    why: "The upside for you is a path that works. The catch is a path that was never questioned.",
    try: [
      "Next time you choose, name whether you actually agree with the path first.",
      "Before you decide, check what you would change if you could.",
    ],
    watch: [
      "Notice when you follow a path you do not agree with.",
      "Notice if your own way was the one you wanted.",
    ],
  }),
  idea("ftw_autonomy_l_02", ["autonomy:low"], {
    focus: [
      "The catch in your answers is a path that was never questioned.",
      "What this can cost you is a path that was never questioned.",
      "A cost worth naming for you is a path that was never questioned.",
    ],
    why: "The upside for you is a path that works. The catch is a path that was never questioned.",
    try: [
      "Next time you choose, name whether you actually agree with the path first.",
      "Before you decide, check what you would change if you could.",
    ],
    watch: [
      "Notice when you follow a path you do not agree with.",
      "Notice if your own way was the one you wanted.",
    ],
  }),
  idea("ftw_autonomy_l_03", ["autonomy:low"], {
    focus: [
      "Someone else might notice that you take the set path even when your own way is available.",
      "From the outside, you take the set path even when your own way is available.",
      "Other people can see that you take the set path even when your own way is available.",
    ],
    why: "The upside for you is a path that works. The catch is a path that was never questioned.",
    try: [
      "Next time you choose, name whether you actually agree with the path first.",
      "Before you decide, check what you would change if you could.",
    ],
    watch: [
      "Notice when you follow a path you do not agree with.",
      "Notice if your own way was the one you wanted.",
    ],
  }),
  idea("ftw_autonomy_l_04", ["autonomy:low"], {
    focus: [
      "What you might miss is a way you would have chosen.",
      "Your answers leave room to miss a way you would have chosen.",
      "A thing you might skip is a way you would have chosen.",
    ],
    why: "The upside for you is a path that works. The catch is a path that was never questioned.",
    try: [
      "Next time you choose, name whether you actually agree with the path first.",
      "Before you decide, check what you would change if you could.",
    ],
    watch: [
      "Notice when you follow a path you do not agree with.",
      "Notice if your own way was the one you wanted.",
    ],
  }),
  idea("ftw_autonomy_l_05", ["autonomy:low"], {
    focus: [
      "The helpful side for you shows up when a set path can be the right one.",
      "Your answers also show a use when a set path can be the right one.",
      "There is a use for you when a set path can be the right one.",
    ],
    why: "The upside for you is a path that works. The catch is a path that was never questioned.",
    try: [
      "Next time you choose, name whether you actually agree with the path first.",
      "Before you decide, check what you would change if you could.",
    ],
    watch: [
      "Notice when you follow a path you do not agree with.",
      "Notice if your own way was the one you wanted.",
    ],
  }),
  idea("ftw_autonomy_l_06", ["autonomy:low", "relatedness:high"], {
    focus: [
      "Your answers suggest two things at once: you take the set path, and you need a real tie.",
      "Both can be true for you in the same week: you take the set path, and you need a real tie.",
      "A week can hold both for you, so you take the set path, and you need a real tie.",
    ],
    why: "The upside for you is a path that works. The catch is a path that was never questioned.",
    try: [
      "Next time you choose, name whether you actually agree with the path first.",
      "Before you decide, check what you would change if you could.",
    ],
    watch: [
      "Notice when you follow a path you do not agree with.",
      "Notice if your own way was the one you wanted.",
    ],
  })
];
