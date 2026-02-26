/**
 * Interview modal Preact component — interactive Q&A for issues needing refinement.
 * Driven by the {@link interviewTarget} signal; when non-null the modal is visible.
 */

import * as api from '@dashboard/frontend/lib/api-client'
import { interviewTarget } from '@dashboard/frontend/lib/state'
import { useEffect, useState } from 'preact/hooks'

interface Question {
  question: string
  options?: string[]
}

/**
 * Parses the `## Interview Questions` section from an issue body into structured questions.
 *
 * @param body - Raw markdown body of the issue
 * @returns Parsed questions with optional radio options
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
 * Modal component that walks the user through interview questions for an issue.
 * Reads {@link interviewTarget} to determine visibility and target issue.
 */
export function InterviewModal(): preact.JSX.Element | null {
  const target = interviewTarget.value
  const [currentIdx, setCurrentIdx] = useState(0)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<
    Array<{ question: string; answer: string }>
  >([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null)
  const [otherText, setOtherText] = useState('')
  const [textareaVal, setTextareaVal] = useState('')

  // Reset state when a new interview opens
  useEffect(() => {
    if (!target) return
    const parsed = parseQuestionsFromBody(target.issue.body)
    const qs =
      parsed.length > 0
        ? parsed
        : [{ question: 'Please describe what you need in more detail.' }]
    setQuestions(qs)
    setAnswers([])
    setCurrentIdx(0)
    setError(null)
    setSubmitting(false)
    setSelectedOpt(null)
    setOtherText('')
    setTextareaVal('')
  }, [target])

  // Reset per-question input state when navigating between questions
  useEffect(() => {
    setSelectedOpt(null)
    setOtherText('')
    setTextareaVal('')
    setError(null)
  }, [currentIdx])

  if (!target) return null

  const { issue, done } = target
  const q = questions[currentIdx]
  if (!q) return null

  const isLast = currentIdx === questions.length - 1
  let nextLabel = isLast ? 'Submit' : 'Next'
  if (submitting) nextLabel = 'Evaluating...'

  function getAnswer(): string {
    if (q.options && q.options.length > 0) {
      if (selectedOpt === 'Other') return otherText.trim() || 'Other'
      return selectedOpt ?? ''
    }
    return textareaVal.trim()
  }

  function handleBack(): void {
    setCurrentIdx((i) => i - 1)
  }

  function handleCancel(): void {
    interviewTarget.value = null
  }

  async function handleNext(): Promise<void> {
    const answer = getAnswer()
    if (!answer) return

    const updated = [...answers]
    updated[currentIdx] = { question: q.question, answer }
    setAnswers(updated)

    if (!isLast) {
      setCurrentIdx((i) => i + 1)
      return
    }

    // Submit all answers
    setSubmitting(true)
    setError(null)

    try {
      const result = await api.submitInterview(issue.id, updated)
      if (result.status === 'complete') {
        interviewTarget.value = null
        done()
      } else if (result.status === 'more_questions' && result.questions) {
        setQuestions(result.questions)
        setAnswers([])
        setCurrentIdx(0)
      }
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" style={{ display: 'flex' }}>
      <div className="modal-card">
        <div className="interview-hdr">
          <h2>Interview: #{issue.id}</h2>
          <span className="interview-progress">
            Question {currentIdx + 1} of {questions.length}
          </span>
        </div>

        <p className="interview-q">{q.question}</p>

        {q.options && q.options.length > 0 ? (
          <div className="interview-opts">
            {[...q.options, 'Other'].map((opt) => (
              <label key={opt} className="interview-opt">
                <input
                  type="radio"
                  name="interview-answer"
                  value={opt}
                  checked={selectedOpt === opt}
                  onChange={() => setSelectedOpt(opt)}
                />
                <span>{opt}</span>
              </label>
            ))}
            <input
              type="text"
              className="interview-other-input"
              placeholder="Type your answer..."
              style={{ display: selectedOpt === 'Other' ? 'block' : 'none' }}
              value={otherText}
              onInput={(e) =>
                setOtherText((e.target as HTMLInputElement).value)
              }
            />
          </div>
        ) : (
          <textarea
            className="interview-textarea"
            rows={4}
            placeholder="Type your answer..."
            value={textareaVal}
            onInput={(e) =>
              setTextareaVal((e.target as HTMLTextAreaElement).value)
            }
          />
        )}

        <div className="interview-btns">
          {currentIdx > 0 && (
            <button type="button" className="mbtn" onClick={handleBack}>
              Back
            </button>
          )}
          <button type="button" className="mbtn" onClick={handleCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="mbtn primary"
            disabled={submitting}
            onClick={handleNext}
          >
            {nextLabel}
          </button>
        </div>

        {error && <div className="interview-err">{error}</div>}
      </div>
    </div>
  )
}
