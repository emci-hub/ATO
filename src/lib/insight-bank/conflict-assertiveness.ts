/** Directness (conflict_assertiveness): Direct (high) and Quiet (low). */
import { idea, type InsightIdea } from './define';

export const CONFLICT_ASSERTIVENESS_IDEAS: readonly InsightIdea[] = [
  idea("ftw_conflict_assertiveness_h_01", ["conflict_assertiveness:high"], {
    focus: [
      "Your answers suggest you put a clear point on the table in a disagreement.",
      "From your answers, you put a clear point on the table in a disagreement.",
      "The pattern in your answers is that you put a clear point on the table in a disagreement.",
    ],
    why: "The upside for you is a point that gets said. The catch is a point that takes over the talk.",
    try: [
      "Next time you choose, name whether the point is taking over first.",
      "Before you decide, check what the other person still needs to say.",
    ],
    watch: [
      "Notice when your point takes over the whole talk.",
      "Notice if you missed the other person's point.",
    ],
  }),
  idea("ftw_conflict_assertiveness_h_02", ["conflict_assertiveness:high"], {
    focus: [
      "The catch in your answers is a point that takes over the talk.",
      "What this can cost you is a point that takes over the talk.",
      "A cost worth naming for you is a point that takes over the talk.",
    ],
    why: "The upside for you is a point that gets said. The catch is a point that takes over the talk.",
    try: [
      "Next time you choose, name whether the point is taking over first.",
      "Before you decide, check what the other person still needs to say.",
    ],
    watch: [
      "Notice when your point takes over the whole talk.",
      "Notice if you missed the other person's point.",
    ],
  }),
  idea("ftw_conflict_assertiveness_h_03", ["conflict_assertiveness:high"], {
    focus: [
      "Someone else might notice that you say the point when staying quiet would be easier.",
      "From the outside, you say the point when staying quiet would be easier.",
      "Other people can see that you say the point when staying quiet would be easier.",
    ],
    why: "The upside for you is a point that gets said. The catch is a point that takes over the talk.",
    try: [
      "Next time you choose, name whether the point is taking over first.",
      "Before you decide, check what the other person still needs to say.",
    ],
    watch: [
      "Notice when your point takes over the whole talk.",
      "Notice if you missed the other person's point.",
    ],
  }),
  idea("ftw_conflict_assertiveness_h_04", ["conflict_assertiveness:high"], {
    focus: [
      "What you might miss is the other person's point.",
      "Your answers leave room to miss the other person's point.",
      "A thing you might skip is the other person's point.",
    ],
    why: "The upside for you is a point that gets said. The catch is a point that takes over the talk.",
    try: [
      "Next time you choose, name whether the point is taking over first.",
      "Before you decide, check what the other person still needs to say.",
    ],
    watch: [
      "Notice when your point takes over the whole talk.",
      "Notice if you missed the other person's point.",
    ],
  }),
  idea("ftw_conflict_assertiveness_h_05", ["conflict_assertiveness:high"], {
    focus: [
      "The helpful side for you shows up when the point needs to be in the talk.",
      "Your answers also show a use when the point needs to be in the talk.",
      "There is a use for you when the point needs to be in the talk.",
    ],
    why: "The upside for you is a point that gets said. The catch is a point that takes over the talk.",
    try: [
      "Next time you choose, name whether the point is taking over first.",
      "Before you decide, check what the other person still needs to say.",
    ],
    watch: [
      "Notice when your point takes over the whole talk.",
      "Notice if you missed the other person's point.",
    ],
  }),
  idea("ftw_conflict_assertiveness_h_06", ["conflict_assertiveness:high", "conflict_cooperativeness:high"], {
    focus: [
      "Your answers suggest two things at once: you say your point, and you widen the plan.",
      "Both can be true for you in the same week: you say your point, and you widen the plan.",
      "A week can hold both for you, so you say your point, while you widen the plan.",
    ],
    why: "The upside for you is a point that gets said. The catch is a point that takes over the talk.",
    try: [
      "Next time you choose, name whether the point is taking over first.",
      "Before you decide, check what the other person still needs to say.",
    ],
    watch: [
      "Notice when your point takes over the whole talk.",
      "Notice if you missed the other person's point.",
    ],
  }),
  idea("ftw_conflict_assertiveness_l_01", ["conflict_assertiveness:low"], {
    focus: [
      "Your answers suggest you step back in a disagreement even when the point is ready.",
      "From your answers, you step back in a disagreement even when the point is ready.",
      "The pattern in your answers is that you step back in a disagreement even when the point is ready.",
    ],
    why: "The upside for you is a softer disagreement. The catch is a point that never gets said.",
    try: [
      "Next time you choose, name whether the point still needs saying first.",
      "Before you decide, check what you are not saying.",
    ],
    watch: [
      "Notice when the point never gets said.",
      "Notice if you wanted to say it and stepped back.",
    ],
  }),
  idea("ftw_conflict_assertiveness_l_02", ["conflict_assertiveness:low"], {
    focus: [
      "The catch in your answers is a point that never gets said.",
      "What this can cost you is a point that never gets said.",
      "A cost worth naming for you is a point that never gets said.",
    ],
    why: "The upside for you is a softer disagreement. The catch is a point that never gets said.",
    try: [
      "Next time you choose, name whether the point still needs saying first.",
      "Before you decide, check what you are not saying.",
    ],
    watch: [
      "Notice when the point never gets said.",
      "Notice if you wanted to say it and stepped back.",
    ],
  }),
  idea("ftw_conflict_assertiveness_l_03", ["conflict_assertiveness:low"], {
    focus: [
      "Someone else might notice that you step back while the point is ready to say.",
      "From the outside, you step back while the point is ready to say.",
      "Other people can see that you step back while the point is ready to say.",
    ],
    why: "The upside for you is a softer disagreement. The catch is a point that never gets said.",
    try: [
      "Next time you choose, name whether the point still needs saying first.",
      "Before you decide, check what you are not saying.",
    ],
    watch: [
      "Notice when the point never gets said.",
      "Notice if you wanted to say it and stepped back.",
    ],
  }),
  idea("ftw_conflict_assertiveness_l_04", ["conflict_assertiveness:low"], {
    focus: [
      "What you might miss is the point you meant to say.",
      "Your answers leave room to miss the point you meant to say.",
      "A thing you might skip is the point you meant to say.",
    ],
    why: "The upside for you is a softer disagreement. The catch is a point that never gets said.",
    try: [
      "Next time you choose, name whether the point still needs saying first.",
      "Before you decide, check what you are not saying.",
    ],
    watch: [
      "Notice when the point never gets said.",
      "Notice if you wanted to say it and stepped back.",
    ],
  }),
  idea("ftw_conflict_assertiveness_l_05", ["conflict_assertiveness:low"], {
    focus: [
      "The helpful side for you shows up when a softer step can keep the talk alive.",
      "Your answers also show a use when a softer step can keep the talk alive.",
      "There is a use for you when a softer step can keep the talk alive.",
    ],
    why: "The upside for you is a softer disagreement. The catch is a point that never gets said.",
    try: [
      "Next time you choose, name whether the point still needs saying first.",
      "Before you decide, check what you are not saying.",
    ],
    watch: [
      "Notice when the point never gets said.",
      "Notice if you wanted to say it and stepped back.",
    ],
  }),
  idea("ftw_conflict_assertiveness_l_06", ["conflict_assertiveness:low", "conflict_cooperativeness:high"], {
    focus: [
      "Your answers suggest two things at once: you step back, and you widen the plan.",
      "Both can be true for you in the same week: you step back, and you widen the plan.",
      "A week can hold both for you, so you step back, while you widen the plan.",
    ],
    why: "The upside for you is a softer disagreement. The catch is a point that never gets said.",
    try: [
      "Next time you choose, name whether the point still needs saying first.",
      "Before you decide, check what you are not saying.",
    ],
    watch: [
      "Notice when the point never gets said.",
      "Notice if you wanted to say it and stepped back.",
    ],
  })
];
