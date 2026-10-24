/** Sociability (extraversion): Outgoing (high) and Reserved (low). */
import { idea, type InsightIdea } from './define';

export const EXTRAVERSION_IDEAS: readonly InsightIdea[] = [
  idea("ftw_extraversion_h_01", ["extraversion:high"], {
    focus: [
      "Your answers suggest you look for time with other people.",
      "From your answers, you look for time with other people.",
      "The pattern in your answers is that you look for time with other people.",
    ],
    why: "The upside for you is company. The catch is a week with no time left to come back.",
    try: [
      "Next time you choose, name whether the week still has time to yourself first.",
      "Before you decide, check whether you want the plan or just the company.",
    ],
    watch: [
      "Notice when the week fills up and you have no time left.",
      "Notice if you wanted the quiet evening instead.",
    ],
  }),
  idea("ftw_extraversion_h_02", ["extraversion:high"], {
    focus: [
      "The catch in your answers is a week with no time left to come back.",
      "What this can cost you is a week with no time left to come back.",
      "A cost worth naming for you is a week with no time left to come back.",
    ],
    why: "The upside for you is company. The catch is a week with no time left to come back.",
    try: [
      "Next time you choose, name whether the week still has time to yourself first.",
      "Before you decide, check whether you want the plan or just the company.",
    ],
    watch: [
      "Notice when the week fills up and you have no time left.",
      "Notice if you wanted the quiet evening instead.",
    ],
  }),
  idea("ftw_extraversion_h_03", ["extraversion:high"], {
    focus: [
      "Someone else might notice that you pick time with other people over a quiet evening.",
      "From the outside, you pick time with other people over a quiet evening.",
      "Other people can see that you pick time with other people over a quiet evening.",
    ],
    why: "The upside for you is company. The catch is a week with no time left to come back.",
    try: [
      "Next time you choose, name whether the week still has time to yourself first.",
      "Before you decide, check whether you want the plan or just the company.",
    ],
    watch: [
      "Notice when the week fills up and you have no time left.",
      "Notice if you wanted the quiet evening instead.",
    ],
  }),
  idea("ftw_extraversion_h_04", ["extraversion:high"], {
    focus: [
      "What you might miss is time to yourself after a full week.",
      "Your answers leave room to miss time to yourself after a full week.",
      "A thing you might skip is time to yourself after a full week.",
    ],
    why: "The upside for you is company. The catch is a week with no time left to come back.",
    try: [
      "Next time you choose, name whether the week still has time to yourself first.",
      "Before you decide, check whether you want the plan or just the company.",
    ],
    watch: [
      "Notice when the week fills up and you have no time left.",
      "Notice if you wanted the quiet evening instead.",
    ],
  }),
  idea("ftw_extraversion_h_05", ["extraversion:high"], {
    focus: [
      "The helpful side for you shows up when company is what the day needs.",
      "Your answers also show a use when company is what the day needs.",
      "There is a use for you when company is what the day needs.",
    ],
    why: "The upside for you is company. The catch is a week with no time left to come back.",
    try: [
      "Next time you choose, name whether the week still has time to yourself first.",
      "Before you decide, check whether you want the plan or just the company.",
    ],
    watch: [
      "Notice when the week fills up and you have no time left.",
      "Notice if you wanted the quiet evening instead.",
    ],
  }),
  idea("ftw_extraversion_h_06", ["extraversion:high", "playfulness:high"], {
    focus: [
      "Your answers suggest two things at once: you want people around, and you turn it into play.",
      "Both can be true for you in the same week: you want people around, and you turn it into play.",
      "In the same week, you want people around, and you turn it into play.",
    ],
    why: "The upside for you is company. The catch is a week with no time left to come back.",
    try: [
      "Next time you choose, name whether the week still has time to yourself first.",
      "Before you decide, check whether you want the plan or just the company.",
    ],
    watch: [
      "Notice when the week fills up and you have no time left.",
      "Notice if you wanted the quiet evening instead.",
    ],
  }),
  idea("ftw_extraversion_l_01", ["extraversion:low"], {
    focus: [
      "You recharge with time to yourself.",
      "From your answers, you recharge with time to yourself.",
      "The pattern in your answers is that you recharge with time to yourself.",
    ],
    why: "The upside for you is time to come back. The catch is a next plan that feels like too much.",
    try: [
      "Next time you choose, name one block that is just yours first.",
      "Before you decide, check whether the next plan leaves you time to yourself.",
    ],
    watch: [
      "Notice when the next plan feels like too much.",
      "Notice if you skipped a plan you would have liked.",
    ],
  }),
  idea("ftw_extraversion_l_02", ["extraversion:low"], {
    focus: [
      "You recharge with time to yourself, and the next plan can feel like too much.",
      "What this can cost you is a next plan that feels like too much.",
      "A cost worth naming for you is a next plan that feels like too much.",
    ],
    why: "The upside for you is time to come back. The catch is a next plan that feels like too much.",
    try: [
      "Next time you choose, name one block that is just yours first.",
      "Before you decide, check whether the next plan leaves you time to yourself.",
    ],
    watch: [
      "Notice when the next plan feels like too much.",
      "Notice if you skipped a plan you would have liked.",
    ],
  }),
  idea("ftw_extraversion_l_03", ["extraversion:low"], {
    focus: [
      "You recharge with time to yourself after time around other people.",
      "From the outside, you recharge with time to yourself after time with other people.",
      "Other people can see that you recharge with time to yourself after time with other people.",
    ],
    why: "The upside for you is time to come back. The catch is a next plan that feels like too much.",
    try: [
      "Next time you choose, name one block that is just yours first.",
      "Before you decide, check whether the next plan leaves you time to yourself.",
    ],
    watch: [
      "Notice when the next plan feels like too much.",
      "Notice if you skipped a plan you would have liked.",
    ],
  }),
  idea("ftw_extraversion_l_04", ["extraversion:low"], {
    focus: [
      "You recharge with time to yourself, so a plan you like can still wait.",
      "Your answers leave room to miss a plan you would have enjoyed.",
      "A thing you might skip is a plan you would have enjoyed.",
    ],
    why: "The upside for you is time to come back. The catch is a next plan that feels like too much.",
    try: [
      "Next time you choose, name one block that is just yours first.",
      "Before you decide, check whether the next plan leaves you time to yourself.",
    ],
    watch: [
      "Notice when the next plan feels like too much.",
      "Notice if you skipped a plan you would have liked.",
    ],
  }),
  idea("ftw_extraversion_l_05", ["extraversion:low"], {
    focus: [
      "You recharge with time to yourself before you add another plan.",
      "Your answers also show a use when you need time to yourself before the next plan.",
      "There is a use for you when you need time to yourself before the next plan.",
    ],
    why: "The upside for you is time to come back. The catch is a next plan that feels like too much.",
    try: [
      "Next time you choose, name one block that is just yours first.",
      "Before you decide, check whether the next plan leaves you time to yourself.",
    ],
    watch: [
      "Notice when the next plan feels like too much.",
      "Notice if you skipped a plan you would have liked.",
    ],
  }),
  idea("ftw_extraversion_l_06", ["extraversion:low", "relatedness:high"], {
    focus: [
      "You recharge with time to yourself, and you need a real tie.",
      "Both can be true for you in the same week: you recharge with time to yourself, and you need a real tie.",
      "In the same week, you recharge with time to yourself, and you need a real tie.",
    ],
    why: "The upside for you is time to come back. The catch is a next plan that feels like too much.",
    try: [
      "Next time you choose, name one block that is just yours first.",
      "Before you decide, check whether the next plan leaves you time to yourself.",
    ],
    watch: [
      "Notice when the next plan feels like too much.",
      "Notice if you skipped a plan you would have liked.",
    ],
  })
];
