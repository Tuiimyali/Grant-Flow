export type FunderPolicyLevel = 'prohibits' | 'restricts' | 'requires_disclosure'

export interface FunderPolicy {
  names: string[]
  level: FunderPolicyLevel
  message: string
}

const FUNDER_POLICIES: FunderPolicy[] = [
  {
    names: ['national institutes of health', 'nih'],
    level: 'prohibits',
    message:
      'NIH Policy: Applications substantially developed by AI are not considered original and may be rejected. Use AI drafts as a starting point only — substantially rewrite in your own voice before submitting.',
  },
  {
    names: ['national science foundation', 'nsf'],
    level: 'restricts',
    message:
      'NSF restricts AI use. Reviewers cannot upload proposals to AI tools. Disclose any AI involvement in your application development.',
  },
  {
    names: ['national endowment for the humanities', 'neh'],
    level: 'requires_disclosure',
    message:
      'NEH requires you to acknowledge all AI-generated text with footnotes or marginal notes in your application.',
  },
  {
    names: ['wenner-gren', 'wenner gren'],
    level: 'requires_disclosure',
    message:
      'Wenner-Gren requires confidential disclosure of generative AI use in a dedicated application section.',
  },
]

export function getFunderPolicy(funderName: string | null | undefined): FunderPolicy | null {
  if (!funderName) return null
  const lower = funderName.toLowerCase()
  return FUNDER_POLICIES.find((p) => p.names.some((n) => lower.includes(n))) ?? null
}
