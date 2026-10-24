/** Compromise (conflict_cooperativeness): Giving (high) and Steadfast (low). */
import { idea, type InsightIdea } from './define';

export const CONFLICT_COOPERATIVENESS_IDEAS: readonly InsightIdea[] = [
  idea("ftw_conflict_cooperativeness_h_01", ["conflict_cooperativeness:high"], {
    focus: [
      "Your answers suggest you look for an option the other person can live with.",
      "From your answers, you look for an option the other person can live with.",
      "The pattern in your answers is that you look for an option the other person can live with.",
    ],
    why: "The upside for you is a plan both people can use. The catch is a plan that gives away too much.",
    try: [
      "Next time you choose, name what you still need from the plan first.",
      "Before you decide, check whether the wider plan gives away too much.",
    ],
    watch: [
      "Notice when you give away the part you needed.",
      "Notice if the wider plan was not one you could keep.",
    ],
  }),
  idea("ftw_conflict_cooperativeness_h_02", ["conflict_cooperativeness:high"], {
    focus: [
      "The catch in your answers is a plan that gives away too much.",
      "What this can cost you is a plan that gives away too much.",
      "A cost worth naming for you is a plan that gives away too much.",
    ],
    why: "The upside for you is a plan both people can use. The catch is a plan that gives away too much.",
    try: [
      "Next time you choose, name what you still need from the plan first.",
      "Before you decide, check whether the wider plan gives away too much.",
    ],
    watch: [
      "Notice when you give away the part you needed.",
      "Notice if the wider plan was not one you could keep.",
    ],
  }),
  idea("ftw_conflict_cooperativeness_h_03", ["conflict_cooperativeness:high"], {
    focus: [
      "Someone else might notice that you widen the plan so the other person can live with it.",
      "From the outside, you widen the plan so the other person can live with it.",
      "Other people can see that you widen the plan so the other person can live with it.",
    ],
    why: "The upside for you is a plan both people can use. The catch is a plan that gives away too much.",
    try: [
      "Next time you choose, name what you still need from the plan first.",
      "Before you decide, check whether the wider plan gives away too much.",
    ],
    watch: [
      "Notice when you give away the part you needed.",
      "Notice if the wider plan was not one you could keep.",
    ],
  }),
  idea("ftw_conflict_cooperativeness_h_04", ["conflict_cooperativeness:high"], {
    focus: [
      "What you might miss is the part you needed to keep.",
      "Your answers leave room to miss the part you needed to keep.",
      "A thing you might skip is the part you needed to keep.",
    ],
    why: "The upside for you is a plan both people can use. The catch is a plan that gives away too much.",
    try: [
      "Next time you choose, name what you still need from the plan first.",
      "Before you decide, check whether the wider plan gives away too much.",
    ],
    watch: [
      "Notice when you give away the part you needed.",
      "Notice if the wider plan was not one you could keep.",
    ],
  }),
  idea("ftw_conflict_cooperativeness_h_05", ["conflict_cooperativeness:high"], {
    focus: [
      "The helpful side for you shows up when a plan both people can use is worth finding.",
      "Your answers also show a use when a plan both people can use is worth finding.",
      "There is a use for you when a plan both people can use is worth finding.",
    ],
    why: "The upside for you is a plan both people can use. The catch is a plan that gives away too much.",
    try: [
      "Next time you choose, name what you still need from the plan first.",
      "Before you decide, check whether the wider plan gives away too much.",
    ],
    watch: [
      "Notice when you give away the part you needed.",
      "Notice if the wider plan was not one you could keep.",
    ],
  }),
  idea("ftw_conflict_cooperativeness_h_06", ["conflict_cooperativeness:high", "agreeableness:high"], {
    focus: [
      "Your answers suggest two things at once: you widen the plan, and you go along.",
      "Both can be true for you in the same week: you widen the plan, and you go along.",
      "A week can hold both for you, so you widen the plan, while you go along.",
    ],
    why: "The upside for you is a plan both people can use. The catch is a plan that gives away too much.",
    try: [
      "Next time you choose, name what you still need from the plan first.",
      "Before you decide, check whether the wider plan gives away too much.",
    ],
    watch: [
      "Notice when you give away the part you needed.",
      "Notice if the wider plan was not one you could keep.",
    ],
  }),
  idea("ftw_conflict_cooperativeness_l_01", ["conflict_cooperativeness:low"], {
    focus: [
      "Your answers suggest you protect a chosen outcome in a disagreement.",
      "From your answers, you protect a chosen outcome in a disagreement.",
      "The pattern in your answers is that you protect a chosen outcome in a disagreement.",
    ],
    why: "The upside for you is a protected outcome. The catch is an outcome that leaves the other person out.",
    try: [
      "Next time you choose, name what the other person cannot live with first.",
      "Before you decide, check whether the outcome leaves them out.",
    ],
    watch: [
      "Notice when the outcome leaves the other person out.",
      "Notice if a wider plan would have worked.",
    ],
  }),
  idea("ftw_conflict_cooperativeness_l_02", ["conflict_cooperativeness:low"], {
    focus: [
      "The catch in your answers is an outcome that leaves the other person out.",
      "What this can cost you is an outcome that leaves the other person out.",
      "A cost worth naming for you is an outcome that leaves the other person out.",
    ],
    why: "The upside for you is a protected outcome. The catch is an outcome that leaves the other person out.",
    try: [
      "Next time you choose, name what the other person cannot live with first.",
      "Before you decide, check whether the outcome leaves them out.",
    ],
    watch: [
      "Notice when the outcome leaves the other person out.",
      "Notice if a wider plan would have worked.",
    ],
  }),
  idea("ftw_conflict_cooperativeness_l_03", ["conflict_cooperativeness:low"], {
    focus: [
      "Someone else might notice that you hold the outcome even when a wider plan is available.",
      "From the outside, you hold the outcome even when a wider plan is available.",
      "Other people can see that you hold the outcome even when a wider plan is available.",
    ],
    why: "The upside for you is a protected outcome. The catch is an outcome that leaves the other person out.",
    try: [
      "Next time you choose, name what the other person cannot live with first.",
      "Before you decide, check whether the outcome leaves them out.",
    ],
    watch: [
      "Notice when the outcome leaves the other person out.",
      "Notice if a wider plan would have worked.",
    ],
  }),
  idea("ftw_conflict_cooperativeness_l_04", ["conflict_cooperativeness:low"], {
    focus: [
      "What you might miss is a wider plan the other person could live with.",
      "Your answers leave room to miss a wider plan the other person could live with.",
      "A thing you might skip is a wider plan the other person could live with.",
    ],
    why: "The upside for you is a protected outcome. The catch is an outcome that leaves the other person out.",
    try: [
      "Next time you choose, name what the other person cannot live with first.",
      "Before you decide, check whether the outcome leaves them out.",
    ],
    watch: [
      "Notice when the outcome leaves the other person out.",
      "Notice if a wider plan would have worked.",
    ],
  }),
  idea("ftw_conflict_cooperativeness_l_05", ["conflict_cooperativeness:low"], {
    focus: [
      "The helpful side for you shows up when the outcome matters.",
      "Your answers also show a use when the outcome matters.",
      "There is a use for you when the outcome matters.",
    ],
    why: "The upside for you is a protected outcome. The catch is an outcome that leaves the other person out.",
    try: [
      "Next time you choose, name what the other person cannot live with first.",
      "Before you decide, check whether the outcome leaves them out.",
    ],
    watch: [
      "Notice when the outcome leaves the other person out.",
      "Notice if a wider plan would have worked.",
    ],
  }),
  idea("ftw_conflict_cooperativeness_l_06", ["conflict_cooperativeness:low", "conflict_assertiveness:high"], {
    focus: [
      "Your answers suggest two things at once: you protect the outcome, and you say your point.",
      "Both can be true for you in the same week: you protect the outcome, and you say your point.",
      "A week can hold both for you, so you protect the outcome, while you say your point.",
    ],
    why: "The upside for you is a protected outcome. The catch is an outcome that leaves the other person out.",
    try: [
      "Next time you choose, name what the other person cannot live with first.",
      "Before you decide, check whether the outcome leaves them out.",
    ],
    watch: [
      "Notice when the outcome leaves the other person out.",
      "Notice if a wider plan would have worked.",
    ],
  })
];
