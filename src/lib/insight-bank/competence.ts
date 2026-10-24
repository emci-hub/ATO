/** Confidence (competence): Assured (high) and Cautious (low). The low side stays private on share surfaces. */
import { idea, type InsightIdea } from './define';

export const COMPETENCE_IDEAS: readonly InsightIdea[] = [
  idea("ftw_competence_h_01", ["competence:high"], {
    focus: [
      "Your answers suggest you trust that a hard task can be handled.",
      "From your answers, you trust that a hard task can be handled.",
      "The pattern in your answers is that you trust that a hard task can be handled.",
    ],
    why: "The upside for you is a hard task that moves. The catch is a trust that skips a needed check.",
    try: [
      "Next time you choose, name whether the task still needs a check first.",
      "Before you decide, check what doubt is pointing at.",
    ],
    watch: [
      "Notice when you skip a check the task needed.",
      "Notice if the doubt was pointing at a real gap.",
    ],
  }),
  idea("ftw_competence_h_02", ["competence:high"], {
    focus: [
      "The catch in your answers is a trust that skips a needed check.",
      "What this can cost you is a trust that skips a needed check.",
      "A cost worth naming for you is a trust that skips a needed check.",
    ],
    why: "The upside for you is a hard task that moves. The catch is a trust that skips a needed check.",
    try: [
      "Next time you choose, name whether the task still needs a check first.",
      "Before you decide, check what doubt is pointing at.",
    ],
    watch: [
      "Notice when you skip a check the task needed.",
      "Notice if the doubt was pointing at a real gap.",
    ],
  }),
  idea("ftw_competence_h_03", ["competence:high"], {
    focus: [
      "Someone else might notice that you trust a hard task even when doubt is available.",
      "From the outside, you trust a hard task even when doubt is available.",
      "Other people can see that you trust a hard task even when doubt is available.",
    ],
    why: "The upside for you is a hard task that moves. The catch is a trust that skips a needed check.",
    try: [
      "Next time you choose, name whether the task still needs a check first.",
      "Before you decide, check what doubt is pointing at.",
    ],
    watch: [
      "Notice when you skip a check the task needed.",
      "Notice if the doubt was pointing at a real gap.",
    ],
  }),
  idea("ftw_competence_h_04", ["competence:high"], {
    focus: [
      "What you might miss is a check the trust skipped.",
      "Your answers leave room to miss a check the trust skipped.",
      "A thing you might skip is a check the trust skipped.",
    ],
    why: "The upside for you is a hard task that moves. The catch is a trust that skips a needed check.",
    try: [
      "Next time you choose, name whether the task still needs a check first.",
      "Before you decide, check what doubt is pointing at.",
    ],
    watch: [
      "Notice when you skip a check the task needed.",
      "Notice if the doubt was pointing at a real gap.",
    ],
  }),
  idea("ftw_competence_h_05", ["competence:high"], {
    focus: [
      "The helpful side for you shows up when trust lets the hard task move.",
      "Your answers also show a use when trust lets the hard task move.",
      "There is a use for you when trust lets the hard task move.",
    ],
    why: "The upside for you is a hard task that moves. The catch is a trust that skips a needed check.",
    try: [
      "Next time you choose, name whether the task still needs a check first.",
      "Before you decide, check what doubt is pointing at.",
    ],
    watch: [
      "Notice when you skip a check the task needed.",
      "Notice if the doubt was pointing at a real gap.",
    ],
  }),
  idea("ftw_competence_h_06", ["competence:high", "self_efficacy:high"], {
    focus: [
      "Your answers suggest two things at once: you trust the hard task, and you expect to finish.",
      "Both can be true for you in the same week: you trust the hard task, and you expect to finish.",
      "A week can hold both for you, so you trust the hard task, and you expect to finish.",
    ],
    why: "The upside for you is a hard task that moves. The catch is a trust that skips a needed check.",
    try: [
      "Next time you choose, name whether the task still needs a check first.",
      "Before you decide, check what doubt is pointing at.",
    ],
    watch: [
      "Notice when you skip a check the task needed.",
      "Notice if the doubt was pointing at a real gap.",
    ],
  }),
  idea("ftw_competence_l_01", ["competence:low"], {
    focus: [
      "Your answers suggest you doubt that a hard task can be pulled off.",
      "From your answers, you doubt that a hard task can be pulled off.",
      "The pattern in your answers is that you doubt that a hard task can be pulled off.",
    ],
    why: "The upside for you is an honest doubt. The catch is a doubt that stops the start.",
    try: [
      "Next time you choose, name the smallest start that still counts first.",
      "Before you decide, check whether the doubt is about the whole task.",
    ],
    watch: [
      "Notice when the doubt stops you before a start.",
      "Notice if a small start would have been enough.",
    ],
  }),
  idea("ftw_competence_l_02", ["competence:low"], {
    focus: [
      "The catch in your answers is a doubt that stops the start.",
      "What this can cost you is a doubt that stops the start.",
      "A cost worth naming for you is a doubt that stops the start.",
    ],
    why: "The upside for you is an honest doubt. The catch is a doubt that stops the start.",
    try: [
      "Next time you choose, name the smallest start that still counts first.",
      "Before you decide, check whether the doubt is about the whole task.",
    ],
    watch: [
      "Notice when the doubt stops you before a start.",
      "Notice if a small start would have been enough.",
    ],
  }),
  idea("ftw_competence_l_03", ["competence:low"], {
    focus: [
      "Someone else might notice that you doubt a hard task even when a small start is available.",
      "From the outside, you doubt a hard task even when a small start is available.",
      "Other people can see that you doubt a hard task even when a small start is available.",
    ],
    why: "The upside for you is an honest doubt. The catch is a doubt that stops the start.",
    try: [
      "Next time you choose, name the smallest start that still counts first.",
      "Before you decide, check whether the doubt is about the whole task.",
    ],
    watch: [
      "Notice when the doubt stops you before a start.",
      "Notice if a small start would have been enough.",
    ],
  }),
  idea("ftw_competence_l_04", ["competence:low"], {
    focus: [
      "What you might miss is the small start that was available.",
      "Your answers leave room to miss the small start that was available.",
      "A thing you might skip is the small start that was available.",
    ],
    why: "The upside for you is an honest doubt. The catch is a doubt that stops the start.",
    try: [
      "Next time you choose, name the smallest start that still counts first.",
      "Before you decide, check whether the doubt is about the whole task.",
    ],
    watch: [
      "Notice when the doubt stops you before a start.",
      "Notice if a small start would have been enough.",
    ],
  }),
  idea("ftw_competence_l_05", ["competence:low"], {
    focus: [
      "The helpful side for you shows up when an honest doubt can be useful.",
      "Your answers also show a use when an honest doubt can be useful.",
      "There is a use for you when an honest doubt can be useful.",
    ],
    why: "The upside for you is an honest doubt. The catch is a doubt that stops the start.",
    try: [
      "Next time you choose, name the smallest start that still counts first.",
      "Before you decide, check whether the doubt is about the whole task.",
    ],
    watch: [
      "Notice when the doubt stops you before a start.",
      "Notice if a small start would have been enough.",
    ],
  }),
  idea("ftw_competence_l_06", ["competence:low", "growth_mindset:high"], {
    focus: [
      "Your answers suggest two things at once: you doubt the hard task, and you look for the change.",
      "Both can be true for you in the same week: you doubt the hard task, and you look for the change.",
      "A week can hold both for you, so you doubt the hard task, and you look for the change.",
    ],
    why: "The upside for you is an honest doubt. The catch is a doubt that stops the start.",
    try: [
      "Next time you choose, name the smallest start that still counts first.",
      "Before you decide, check whether the doubt is about the whole task.",
    ],
    watch: [
      "Notice when the doubt stops you before a start.",
      "Notice if a small start would have been enough.",
    ],
  })
];
