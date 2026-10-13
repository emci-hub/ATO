import type { StoryDialogueLine, StoryLine, StoryNarratorLine } from './types';

export function narrator(text: string): StoryNarratorLine {
  return { kind: 'narrator', text };
}

export function dialogue(speaker: string, text: string): StoryDialogueLine {
  return { kind: 'dialogue', speaker, text };
}

export function lineText(line: StoryLine): string {
  return line.kind === 'dialogue' ? line.text : line.text;
}

export function lineWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function scriptWords(lines: readonly StoryLine[]): number {
  return lines.reduce((sum, line) => sum + lineWords(lineText(line)), 0);
}

export function flattenLines(lines: readonly StoryLine[]): string {
  return lines
    .map((line) => (line.kind === 'dialogue' ? `${line.speaker}: ${line.text}` : line.text))
    .join('\n');
}
