/**
 * Interview modal Preact component — interactive Q&A for issues needing refinement.
 * Driven by the {@link interviewTarget} signal; when non-null the modal is visible.
 */

import { ActionButton } from '@dashboard/frontend/components/ActionButton'
import * as api from '@dashboard/frontend/lib/api-client'
import { interviewTarget } from '@dashboard/frontend/lib/state'
import { createPortal } from 'preact/compat'
import { useEffect, useRef, useState } from 'preact/hooks'

interface Question {
  question: string
  options?: string[]
}

interface QA {
  question: string
  answer: string
}

/**
 * Parses saved partial answers from the `## Interview Q&A (In Progress)` section.
 *
 * @param body - Raw markdown body of the issue
 * @returns Previously saved question/answer pairs, empty if none
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
export function InterviewModal(): preact.JSX.Element {
  const target = interviewTarget.value
  const [currentIdx, setCurrentIdx] = useState(0)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<QA[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null)
  const [otherText, setOtherText] = useState('')
  const [textareaVal, setTextareaVal] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const prevTargetRef = useRef(target)

  // Reset state when a new interview opens (synchronous via ref comparison)
  if (target && target !== prevTargetRef.current) {
    const parsed = parseQuestionsFromBody(target.issue.body)
    const qs =
      parsed.length > 0
        ? parsed
        : [{ question: 'Please describe what you need in more detail.' }]
    // Restore any previously saved partial answers
    const saved = parseSavedAnswers(target.issue.body)
    setQuestions(qs)
    setAnswers(saved)
    setCurrentIdx(0)
    setError(null)
    setSubmitting(false)
    setSelectedOpt(null)
    setOtherText('')
    setTextareaVal('')
  }
  prevTargetRef.current = target

  // Reset per-question input state when navigating between questions
  useEffect(() => {
    setSelectedOpt(null)
    setOtherText('')
    setTextareaVal('')
    setError(null)
  }, [currentIdx])

  // Sync dialog open state with signal
  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    if (target && !dlg.open) dlg.showModal()
    if (!target && dlg.open) dlg.close()
  }, [target, questions])

  const issue = target?.issue
  const done = target?.done
  const q = questions[currentIdx]

  const isLast = currentIdx === questions.length - 1
  let _nextLabel = isLast ? 'Submit' : 'Next'
  if (submitting) _nextLabel = 'Evaluating...'

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
    interviewTarget.value = null
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
        setAnswers(updated)
        setCurrentIdx(0)
      }
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <dialog ref={dialogRef} className="modal" onClose={handleCancel}>
      {issue && q && (
        <div className="modal-box bg-base-200 border border-neutral w-[min(32rem,90vw)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold m-0">Interview: #{issue.id}</h2>
            <span className="text-sm text-base-content/60">
              Question {currentIdx + 1} of {questions.length}
            </span>
          </div>

          <p className="text-md mb-4 leading-relaxed">{q.question}</p>

          {q.options && q.options.length > 0 ? (
            <div className="flex flex-col gap-sm mb-4">
              {[...q.options, 'Other'].map((opt) => (
                <label
                  key={opt}
                  className="flex items-center gap-md text-base cursor-pointer px-md py-sm rounded-default hover:bg-base-300"
                >
                  <input
                    type="radio"
                    name="interview-answer"
                    className="radio radio-primary radio-sm"
                    value={opt}
                    checked={selectedOpt === opt}
                    onChange={() => setSelectedOpt(opt)}
                  />
                  <span>{opt}</span>
                </label>
              ))}
              <input
                type="text"
                className="input input-bordered w-full mt-sm bg-base-100"
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
              className="textarea textarea-bordered w-full mb-4 bg-base-100"
              rows={4}
              placeholder="Type your answer..."
              value={textareaVal}
              onInput={(e) =>
                setTextareaVal((e.target as HTMLTextAreaElement).value)
              }
            />
          )}

          <div className="modal-action">
            {currentIdx > 0 && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleBack}
              >
                Back
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <ActionButton
              className="btn btn-primary"
              label={isLast ? 'Submit' : 'Next'}
              loadingLabel="Evaluating..."
              loading="loading-spinner"
              disabled={submitting}
              onClick={handleNext}
            />
          </div>

          {error && <div className="text-error text-sm mt-md">{error}</div>}
        </div>
      )}
      <form method="dialog" className="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>,
    document.body,
  )
}
