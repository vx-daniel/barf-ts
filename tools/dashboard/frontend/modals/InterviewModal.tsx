/**
 * Interview modal — interactive Q&A wizard for issues needing refinement.
 *
 * Controlled by {@link useUIStore.interviewTarget}; when non-null the dialog
 * opens. Questions are parsed from the `## Interview Questions` section of the
 * issue body. Previously saved partial answers from `## Interview Q&A (In
 * Progress)` are restored on open.
 *
 * Radio buttons are rendered when a question has options (plus an "Other" free-
 * text field). A plain textarea is rendered when a question has no options.
 * On final question submission calls {@link api.submitInterview}; a
 * `more_questions` response extends the question list for additional rounds.
 */
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { ActionButton } from '@dashboard/frontend/common/components/ActionButton'
import { useUIStore } from '@dashboard/frontend/store/useUIStore'
import * as api from '@dashboard/frontend/common/utils/api-client'

interface Question {
  question: string
  options?: string[]
}

interface QA {
  question: string
  answer: string
}

/**
 * Parses the `## Interview Questions` section from an issue body.
 *
 * @param body - Raw markdown body of the issue
 * @returns Structured question list with optional choice options; empty array if section absent
 */
function parseQuestionsFromBody(body: string): Question[] {
  const match = body.match(/## Interview Questions\n\n([\s\S]*?)(?=\n## |\s*$)/)
  if (!match) return []

  const result: Question[] = []
  const lines = match[1].split('\n')
  let current: Question | null = null

  for (const line of lines) {
    const qMatch = line.match(/^\d+\.\s+(.+)/)
    if (qMatch) {
      if (current) result.push(current)
      current = { question: qMatch[1] }
      continue
    }
    const optMatch = line.match(/^\s+-\s+(.+)/)
    if (optMatch && current) {
      if (!current.options) current.options = []
      current.options.push(optMatch[1])
    }
  }
  if (current) result.push(current)
  return result
}

/**
 * Parses saved partial answers from the `## Interview Q&A (In Progress)` section.
 *
 * @param body - Raw markdown body of the issue
 * @returns Previously saved question/answer pairs; empty array if section absent
 */
function parseSavedAnswers(body: string): QA[] {
  const match = body.match(
    /## Interview Q&A \(In Progress\)\n\n([\s\S]*?)(?=\n\n## |\s*$)/,
  )
  if (!match) return []

  const result: QA[] = []
  const lines = match[1].split('\n')
  let currentQ = ''

  for (const line of lines) {
    const qMatch = line.match(/^\d+\.\s+\*\*Q:\*\*\s+(.+)/)
    if (qMatch) {
      currentQ = qMatch[1]
      continue
    }
    const aMatch = line.match(/^\s+\*\*A:\*\*\s+(.+)/)
    if (aMatch && currentQ) {
      result.push({ question: currentQ, answer: aMatch[1] })
      currentQ = ''
    }
  }
  return result
}

/**
 * Interview wizard dialog driven by {@link useUIStore.interviewTarget}.
 *
 * Steps through parsed questions one at a time. Supports radio-button choice
 * questions (with free-text "Other") and open textarea questions. Submits all
 * collected answers on the final question and handles `more_questions` follow-
 * up rounds.
 *
 * @returns Always-mounted MUI Dialog; visibility driven by `open` prop.
 */
export function InterviewModal(): React.JSX.Element {
  const target = useUIStore((s) => s.interviewTarget)
  const endInterview = useUIStore((s) => s.endInterview)

  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<QA[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null)
  const [otherText, setOtherText] = useState('')
  const [textareaVal, setTextareaVal] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Track target identity to detect when a new interview opens
  const prevTargetRef = useRef<typeof target>(null)

  // Initialise/reset state synchronously when a new interview target arrives
  if (target !== prevTargetRef.current) {
    if (target) {
      const parsed = parseQuestionsFromBody(target.issue.body)
      const qs =
        parsed.length > 0
          ? parsed
          : [{ question: 'Please describe what you need in more detail.' }]
      const saved = parseSavedAnswers(target.issue.body)
      // React batches these during render — safe as synchronous inline updates
      questions.length !== qs.length && setQuestions(qs)
      answers.length !== saved.length && setAnswers(saved)
      currentIdx !== 0 && setCurrentIdx(0)
      error !== null && setError(null)
      submitting && setSubmitting(false)
      selectedOpt !== null && setSelectedOpt(null)
      otherText !== '' && setOtherText('')
      textareaVal !== '' && setTextareaVal('')
    }
    prevTargetRef.current = target
  }

  // Reset per-question input state when navigating between questions
  useEffect(() => {
    setSelectedOpt(null)
    setOtherText('')
    setTextareaVal('')
    setError(null)
  }, [])

  const isOpen = target !== null
  const issue = target?.issue
  const done = target?.done
  const q = questions[currentIdx]
  const isLast = currentIdx === questions.length - 1

  function getAnswer(): string {
    if (q?.options && q.options.length > 0) {
      if (selectedOpt === 'Other') return otherText.trim() || 'Other'
      return selectedOpt ?? ''
    }
    return textareaVal.trim()
  }

  function handleBack(): void {
    setCurrentIdx((i) => i - 1)
  }

  function handleCancel(): void {
    endInterview()
  }

  async function handleNext(): Promise<void> {
    if (!q || !issue || !done) return
    const answer = getAnswer()
    if (!answer) return

    const updated = [...answers]
    updated[currentIdx] = { question: q.question, answer }
    setAnswers(updated)

    if (!isLast) {
      setCurrentIdx((i) => i + 1)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const result = await api.submitInterview(issue.id, updated)
      if (result.status === 'complete') {
        endInterview()
        done()
      } else if (result.status === 'more_questions' && result.questions) {
        setQuestions(result.questions)
        setAnswers(updated)
        setCurrentIdx(0)
      }
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { backgroundColor: 'background.paper', maxWidth: 520 },
      }}
    >
      {issue && q && (
        <>
          <DialogTitle
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pb: 1,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Interview: #{issue.id}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Question {currentIdx + 1} of {questions.length}
            </Typography>
          </DialogTitle>

          <DialogContent
            sx={{ pt: 0.5, display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <Typography variant="body1" sx={{ lineHeight: 1.6 }}>
              {q.question}
            </Typography>

            {q.options && q.options.length > 0 ? (
              <Box>
                <RadioGroup
                  value={selectedOpt ?? ''}
                  onChange={(e) => setSelectedOpt(e.target.value)}
                >
                  {[...q.options, 'Other'].map((opt) => (
                    <FormControlLabel
                      key={opt}
                      value={opt}
                      control={<Radio size="small" />}
                      label={opt}
                      sx={{
                        mx: 0,
                        px: 1,
                        borderRadius: 1,
                        '&:hover': { backgroundColor: 'action.hover' },
                      }}
                    />
                  ))}
                </RadioGroup>
                {selectedOpt === 'Other' && (
                  <TextField
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    placeholder="Type your answer..."
                    size="small"
                    fullWidth
                    autoComplete="off"
                    sx={{ mt: 1 }}
                  />
                )}
              </Box>
            ) : (
              <TextField
                value={textareaVal}
                onChange={(e) => setTextareaVal(e.target.value)}
                placeholder="Type your answer..."
                size="small"
                fullWidth
                multiline
                rows={4}
                autoComplete="off"
              />
            )}

            {error && (
              <Typography variant="caption" sx={{ color: 'error.main' }}>
                {error}
              </Typography>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
            {currentIdx > 0 && (
              <Button variant="text" onClick={handleBack} disabled={submitting}>
                Back
              </Button>
            )}
            <Button
              variant="text"
              onClick={handleCancel}
              disabled={submitting}
              sx={{ mr: 'auto' }}
            >
              Cancel
            </Button>
            <ActionButton
              variant="contained"
              onClick={handleNext}
              loading={submitting}
              disabled={submitting || !getAnswer()}
            >
              {isLast ? 'Submit' : 'Next'}
            </ActionButton>
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}
