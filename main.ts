// Make the AI Judge Laugh: Office Jokes — entry program.
//
// REQUIREMENTS, restated in my own words:
//   The program writes exactly ONE joke about office life to /output/entry.txt:
//   a single line, 1 to 199 characters, UTF-8, not only white space. The house
//   judge (an AI model) compares jokes pairwise on, in priority order:
//     1. a genuine one-line joke about office life (not a slogan, caption or
//        stray observation);
//     2. a real turn or surprise at the end, landing somewhere unexpected;
//     3. recognition: the truth of the office (meeting, printer, reply-all,
//        calendar), so the laugh comes with a wince;
//     4. tight wording, every word earning its place;
//     5. freshness: not the obvious Monday-morning or photocopier line.
//   Top 10 share $5. Blind rounds: 3 rounds; entry counts from the round it is
//   submitted before. There is NO local scorer in this kit — the scorer and
//   reference data stay on the server, which grades every entry — so no
//   grade-local percentage exists to chase; the scores below are my own
//   internal rubric, used only to pick the best candidate deterministically,
//   and verification is end-to-end instead (never invent a score).
//
// APPROACH (chosen over a single hard-coded joke, and over a generative /
// template joke, which would be non-deterministic and unverifiable):
//   a pool of hand-written candidate jokes, each scored by hand against the
//   judge's five criteria in the judge's own priority order (joke 25, turn 30,
//   recognition 20, tightness 15, freshness 10 = 100). The program validates
//   every candidate against the gate, scores them, and writes the best one.
//   Ties go to the smaller text, then to the earliest candidate.
//
// EDGE CASES handled up front:
//   - Gate is 1-199 CHARACTERS: all candidates are ASCII-only, so characters
//     equal bytes and the size tie-break is predictable.
//   - No trailing newline: the file holds exactly the joke, so the character
//     count the gate sees is the joke itself.
//   - Single line: no candidate contains a newline; validated before scoring.
//   - Original text only: every candidate was written for this bounty, so the
//     entry can never be byte-identical to a house fixed text.
//   - Freshness: no Monday-morning or photocopier/printer-jam line in the pool.
//   - Deterministic: no network, no environment, no randomness; the same run
//     always writes the same bytes (verified by running twice and comparing
//     sha256).
//
// Run: node main.ts   (Node 22.18+; the grader runs Node 22.23.4)

import { mkdirSync, writeFileSync } from "node:fs";

const OUT_PATH = "/output/entry.txt";
const MAX_CHARS = 199;

// ---------------------------------------------------------------------------
// Candidate jokes. Each was written for this bounty and checked by hand first:
// single sentence, ASCII only, no internal newline, a real setup + punchline
// turn at the end, about office life. Scores are my editorial judgment against
// the judge's brief, criterion by criterion (joke/turn/recognition/tightness/
// freshness), with the reason noted so the ranking can be argued with.
// ---------------------------------------------------------------------------
type Candidate = {
  text: string;
  joke: number; // /25 — genuine one-line office joke, not slogan/observation
  turn: number; // /30 — real surprise at the end
  recognition: number; // /20 — office truth, laugh with a wince
  tightness: number; // /15 — every word earning its place
  freshness: number; // /10 — not the obvious Monday/photocopier line
  why: string;
};

const CANDIDATES: Candidate[] = [
  {
    text: "I told my manager I'm drowning in work, so he sent me a calendar invite titled 'Swimming Lessons.'",
    joke: 25, turn: 29, recognition: 19, tightness: 15, freshness: 9,
    why: "Setup is a universal office truth (drowning in work); the punchline is a concrete, visual surprise — a calendar invite as the 'help' — landing in the final clause. Manager + calendar invite are both named recognition topics.",
  },
  {
    text: "I hit reply-all to ask everyone to stop replying all, and twelve people replied all to agree with me.",
    joke: 25, turn: 28, recognition: 20, tightness: 14, freshness: 8,
    why: "The irony loop is the joke: asking people to stop replying-all triggers more reply-alls. Reply-all is named in the brief; the turn lands at the end, but it takes a beat to parse.",
  },
  {
    text: "I put 'as discussed' in an email about something we never discussed, and by Friday it was company policy.",
    joke: 24, turn: 27, recognition: 19, tightness: 14, freshness: 8,
    why: "'As discussed' is office-speak everyone recognises; the twist — a lie becoming policy by Friday — lands at the end and stings.",
  },
  {
    text: "Our company values say 'people first,' so they laid off the people first.",
    joke: 24, turn: 28, recognition: 17, tightness: 15, freshness: 8,
    why: "Very tight, and the turn is sharp enough to wince at. Loses a little on recognition: company-values hypocrisy is real, but layoffs as the punchline may read darker than funny to some.",
  },
  {
    text: "I asked HR for a mental health day and they sent me a link to a webinar called 'Resilience in the Workplace.'",
    joke: 24, turn: 27, recognition: 19, tightness: 13, freshness: 8,
    why: "Strong office truth (wellness theatre) and the punchline is the help offered being the opposite of help. Slightly longer than ideal.",
  },
  {
    text: "My performance review says I 'thrive under pressure,' which is corporate for 'we never staffed the team.'",
    joke: 24, turn: 25, recognition: 18, tightness: 14, freshness: 8,
    why: "A translation joke: corporate praise decoded into the truth. The turn is a decoding, slightly less surprising than an image.",
  },
  {
    text: "I asked for a raise and got a pizza party instead, which is how I learned my salary is paid in pepperoni.",
    joke: 24, turn: 26, recognition: 18, tightness: 14, freshness: 6,
    why: "Good turn and tight, but the pizza-party-instead-of-a-raise bit is a well-worn office meme, so freshness drops.",
  },
  {
    text: "Our 'quick sync' lasted two hours, and the only thing we synced was our mutual regret.",
    joke: 23, turn: 24, recognition: 17, tightness: 15, freshness: 8,
    why: "Very tight and punchy, but the punchline ('mutual regret') is a mood rather than a surprise image, so the turn scores lower.",
  },
  {
    text: "I start every email with 'per my last email,' which is office for 'I already told you, please read it.'",
    joke: 23, turn: 24, recognition: 19, tightness: 14, freshness: 7,
    why: "High recognition ('per my last email' is pure office), but the turn is a translation, and the phrase is a familiar one.",
  },
  {
    text: "Our meeting about having too many meetings ran 40 minutes over, so we scheduled a follow-up to discuss it.",
    joke: 23, turn: 22, recognition: 18, tightness: 14, freshness: 5,
    why: "The meeting-about-meetings structure is the most told office joke there is; the follow-up twist is predictable, so freshness and turn both drop.",
  },
  {
    text: "My out-of-office reply says I'm unreachable, which is the most honest thing I've written at work all year.",
    joke: 22, turn: 22, recognition: 17, tightness: 14, freshness: 8,
    why: "More wry observation than joke: the turn is a judgment, not a surprise. Honest, but it leans on the setup rather than landing somewhere new.",
  },
  {
    text: "The meeting invite said 'optional,' so everyone came, because optional is just mandatory with extra steps.",
    joke: 23, turn: 23, recognition: 18, tightness: 14, freshness: 7,
    why: "Solid recognition ('optional' meetings), but the punchline explains the joke rather than surprising with it.",
  },
  {
    text: "I spent an hour writing a two-line email because 'just circling back' needs the right tone of threat.",
    joke: 23, turn: 25, recognition: 18, tightness: 13, freshness: 8,
    why: "Good turn ('tone of threat') and real recognition, but the setup runs long for the payoff.",
  },
  {
    text: "I marked all 4,000 unread emails as read and called it progress, because reading them was never the plan.",
    joke: 22, turn: 21, recognition: 17, tightness: 13, freshness: 7,
    why: "The inbox-zero dodge is relatable, but the punchline is a shrug; the turn is the weakest in the pool.",
  },
  // --- Iteration 2: two challengers written to try to beat the leader. Both
  // score below it, which confirms the pick rather than changing it. ---
  {
    text: "My calendar blocked focus time, so my manager booked a meeting called 'Focus Time Sync.'",
    joke: 24, turn: 27, recognition: 19, tightness: 15, freshness: 9,
    why: "A meeting called 'Focus Time Sync' is a sharp irony and very tight, but the turn is a label, not an image, so it lands just short of the leader.",
  },
  {
    text: "I CC'd my manager to look important, and now he CC's me to look busy, and neither of us has read the email.",
    joke: 24, turn: 26, recognition: 19, tightness: 13, freshness: 8,
    why: "CC culture is real office truth and the ending ('neither of us has read the email') is a good turn, but the setup runs long for the payoff.",
  },
];

// ---------------------------------------------------------------------------
// Gate validation (mirrors the sealed scorer): UTF-8 text of 1 to 199
// characters, not only white space, single line.
// ---------------------------------------------------------------------------
function gateCheck(text: string): string | null {
  const chars = [...text];
  if (chars.length < 1 || chars.length > MAX_CHARS) {
    return `length ${chars.length} outside 1-${MAX_CHARS}`;
  }
  if (text.trim().length === 0) return "only white space";
  if (text.includes("\n") || text.includes("\r")) return "not a single line";
  if (/[^\x00-\x7F]/.test(text)) return "not ASCII (bytes would differ from chars)";
  return null;
}

function total(c: Candidate): number {
  return c.joke + c.turn + c.recognition + c.tightness + c.freshness;
}

function main(): void {
  const scored = CANDIDATES.map((c) => {
    const err = gateCheck(c.text);
    return { c, err, score: err ? -1 : total(c) };
  });

  for (const s of scored) {
    const len = [...s.c.text].length;
    if (s.err) {
      console.log(`  REJECTED (${s.err})  ${len}ch :: ${s.c.text}`);
    } else {
      console.log(
        `${s.score}/100  ${len}ch  joke=${s.c.joke} turn=${s.c.turn} recognition=${s.c.recognition} tightness=${s.c.tightness} freshness=${s.c.freshness}  :: ${s.c.text}`,
      );
    }
  }

  const valid = scored.filter((s) => !s.err);
  if (valid.length === 0) throw new Error("no valid candidate");

  // Best score wins; ties go to the smaller text, then to the earliest.
  valid.sort(
    (a, b) =>
      b.score - a.score ||
      [...a.c.text].length - [...b.c.text].length ||
      CANDIDATES.indexOf(a.c) - CANDIDATES.indexOf(b.c),
  );
  const best = valid[0];

  mkdirSync("/output", { recursive: true });
  writeFileSync(OUT_PATH, best.c.text, "utf8");
  console.log(
    `\nWrote ${[...best.c.text].length} characters to ${OUT_PATH} (score ${best.score}/100)`,
  );
  console.log(`Why: ${best.c.why}`);
}

main();
