import { CONSTRUCT_LABELS, EXAM_CONSTRUCTS, type Construct } from './types'

export const EXAM_START_HOUR = 17
export const EXAM_START_MINUTE = 30

export const PREFERRED_EXAM_GAMES: Record<Construct, string[]> = {
  rechnen: ['kopfrechnen', 'ueberschlag', 'einheiten'],
  logik: ['zahlenreihen', 'matrizen', 'figurenreihen'],
  sprache: ['wortanalogien', 'satzergaenzung', 'oberbegriffe'],
  wortfluss: ['wortfluss'],
  konzentration: ['d2', 'symbolzahl', 'zeichenvergleich'],
  gedaechtnis: ['zahlenspanne', 'nback'],
  text: ['textverstaendnis', 'schnelllesen'],
}

export interface ExamPart {
  construct: Construct
  label: string
  slug: string
}

export function buildExamParts(availableSlugs: readonly string[]): {
  parts: ExamPart[]
  missing: Construct[]
} {
  const available = new Set(availableSlugs)
  const parts: ExamPart[] = []
  const missing: Construct[] = []

  for (const construct of EXAM_CONSTRUCTS) {
    const slug = PREFERRED_EXAM_GAMES[construct].find((candidate) => available.has(candidate))
    if (slug) parts.push({ construct, label: CONSTRUCT_LABELS[construct], slug })
    else missing.push(construct)
  }

  return { parts, missing }
}

export function isRecommendedStartTime(hour: number, minute: number): boolean {
  return hour > EXAM_START_HOUR || (hour === EXAM_START_HOUR && minute >= EXAM_START_MINUTE)
}

export function startTimeNote(hour: number, minute: number): string {
  const clock = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  return isRecommendedStartTime(hour, minute)
    ? `Start um ${clock}, also zur Tageszeit der echten Prüfung.`
    : `Start um ${clock}. Die echte Prüfung beginnt um 17:30, ein Lauf am Abend ist aussagekräftiger.`
}
