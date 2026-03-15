import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  PageNumber,
  NumberFormat,
  AlignmentType,
  Footer,
  Header,
  convertInchesToTwip,
  TableOfContents,
  StyleLevel,
  PageBreak,
  LineRuleType,
} from 'docx'
import { saveAs } from 'file-saver'
import type { GrantSection } from '@/lib/types/database.types'

export interface ExportDraftOptions {
  grantName: string
  funder: string | null
  deadline: string | null
  orgName: string
  sections: GrantSection[]
  contents: Record<string, string>  // sectionTitle → draft text
}

function formatDeadlineForDoc(deadline: string | null): string {
  if (!deadline) return ''
  try {
    return new Date(deadline).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch {
    return deadline
  }
}

function todayFormatted(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

/** Split a plain-text blob into Paragraph objects, collapsing consecutive blank lines. */
function textToParagraphs(text: string): Paragraph[] {
  const lines = text.split('\n')
  const paragraphs: Paragraph[] = []
  let prevBlank = false
  for (const raw of lines) {
    const line = raw.trim()
    const isBlank = line === ''
    if (isBlank && prevBlank) continue  // skip consecutive blanks
    prevBlank = isBlank
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: line, size: 24 })],
        spacing: { after: 120, line: 360, lineRule: LineRuleType.AUTO },
      }),
    )
  }
  return paragraphs
}

export async function exportDraftAsDocx(opts: ExportDraftOptions): Promise<void> {
  const { grantName, funder, deadline, orgName, sections, contents } = opts

  const activeSections = sections.filter(s => contents[s.title]?.trim())

  // ── Title page ───────────────────────────────────────────────
  const titlePage: Paragraph[] = [
    new Paragraph({ children: [], spacing: { after: 2880 } }),  // ~2in top margin
    new Paragraph({
      children: [new TextRun({ text: grantName, bold: true, size: 48, color: '1e293b' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
    funder ? new Paragraph({
      children: [new TextRun({ text: funder, size: 28, color: '475569' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }) : null,
    new Paragraph({
      children: [new TextRun({ text: orgName, size: 24, color: '475569' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    deadline ? new Paragraph({
      children: [new TextRun({ text: `Deadline: ${formatDeadlineForDoc(deadline)}`, size: 24, color: '64748b' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }) : null,
    new Paragraph({
      children: [new TextRun({ text: `Prepared: ${todayFormatted()}`, size: 24, color: '94a3b8' })],
      alignment: AlignmentType.CENTER,
    }),
    // Page break after title page
    new Paragraph({ children: [new PageBreak()] }),
  ].filter(Boolean) as Paragraph[]

  // ── Table of contents ────────────────────────────────────────
  const tocSection: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: 'Table of Contents', bold: true, size: 32, color: '1e293b' })],
      spacing: { after: 240 },
    }),
    new TableOfContents('Table of Contents', {
      hyperlink: true,
      headingStyleRange: '1-2',
    }) as unknown as Paragraph,
    new Paragraph({ children: [new PageBreak()] }),
  ]

  // ── Section chapters ─────────────────────────────────────────
  const sectionPages: Paragraph[] = []
  for (let i = 0; i < activeSections.length; i++) {
    const section = activeSections[i]
    const content = contents[section.title]!.trim()

    // Section heading
    sectionPages.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
      }),
    )

    // Page limit note
    if (section.page_limit) {
      sectionPages.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Page limit: ${section.page_limit} page${section.page_limit > 1 ? 's' : ''} (approximately ${section.page_limit * 250} words)`,
              italics: true,
              size: 20,
              color: '64748b',
            }),
          ],
          spacing: { after: 200 },
        }),
      )
    }

    // Body text
    sectionPages.push(...textToParagraphs(content))

    // Page break between sections (not after last)
    if (i < activeSections.length - 1) {
      sectionPages.push(new Paragraph({ children: [new PageBreak()] }))
    }
  }

  // ── Assemble document ────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 24, color: '1e293b' },
          paragraph: {
            spacing: { line: 360, lineRule: LineRuleType.AUTO },
          },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          run: { bold: true, size: 32, color: '1e293b', font: 'Calibri' },
          paragraph: { spacing: { before: 480, after: 120 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top:    convertInchesToTwip(1),
              right:  convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left:   convertInchesToTwip(1),
            },
          },
          titlePage: true,
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [new TextRun({ text: grantName, size: 18, color: '94a3b8' })],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
          first: new Header({ children: [] }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ children: ['Page ', PageNumber.CURRENT], size: 18, color: '94a3b8' }),
                  new TextRun({ children: [' of ', PageNumber.TOTAL_PAGES], size: 18, color: '94a3b8' }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
          first: new Footer({ children: [] }),
        },
        children: [
          ...titlePage,
          ...tocSection,
          ...sectionPages,
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const filename = `${grantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-application.docx`
  saveAs(blob, filename)
}
