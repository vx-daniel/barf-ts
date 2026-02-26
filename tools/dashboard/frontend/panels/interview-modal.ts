/**
 * Interview modal — interactive Q&A for issues needing refinement.
 * Shows questions from triage, collects answers, submits to Claude for evaluation.
 */
import * as api from '@dashboard/frontend/lib/api-client'
import { el, getEl } from '@dashboard/frontend/lib/dom'
import type { Issue } from '@dashboard/frontend/lib/types'

interface Question {
  question: string
  options?: string[]
}

let currentIssue: Issue | null = null
let questions: Question[] = []
let answers: Array<{ question: string; answer: string }> = []
let currentIdx = 0
let onComplete: (() => void) | null = null


function getOverlay(): HTMLElement {
  return getEl('interview-ov')
}

function getModal(): HTMLElement {
  return getEl('interview-modal')
}

/**
 * Opens the interview modal for an issue that requires further refinement.
 * Parses the `## Interview Questions` section from the issue body to drive the Q&A flow.
 *
 * @param issue - The issue to interview; its body is parsed for structured questions
 * @param done - Callback invoked after successful submission and Claude evaluation
 */
export function openInterview(issue: Issue, done: () => void): void {
  currentIssue = issue
  onComplete = done
  answers = []
  currentIdx = 0

  // Parse questions from issue body
  questions = parseQuestionsFromBody(issue.body)
  if (questions.length === 0) {
    questions = [{ question: 'Please describe what you need in more detail.' }]
  }

  getOverlay().style.display = 'flex'
  renderQuestion()
}

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

function renderQuestion(): void {
  const modal = getModal()
  modal.textContent = ''

  const q = questions[currentIdx]

  // Header
  const hdr = el('div', 'interview-hdr')
  const title = el('h2')
  title.textContent = `Interview: #${currentIssue?.id ?? ''}`
  hdr.appendChild(title)
  const progress = el('span', 'interview-progress')
  progress.textContent = `Question ${currentIdx + 1} of ${questions.length}`
  hdr.appendChild(progress)
  modal.appendChild(hdr)

  // Question text
  const qText = el('p', 'interview-q')
  qText.textContent = q.question
  modal.appendChild(qText)

  // Answer area
  let getAnswer: () => string

  if (q.options && q.options.length > 0) {
    const optGroup = el('div', 'interview-opts')
    let selected: string | null = null
    const otherInput = el('input', 'interview-other-input') as HTMLInputElement
    otherInput.type = 'text'
    otherInput.placeholder = 'Type your answer...'
    otherInput.style.display = 'none'

    for (const opt of [...q.options, 'Other']) {
      const label = el('label', 'interview-opt')
      const radio = document.createElement('input')
      radio.type = 'radio'
      radio.name = 'interview-answer'
      radio.value = opt
      radio.addEventListener('change', () => {
        selected = opt
        otherInput.style.display = opt === 'Other' ? 'block' : 'none'
      })
      label.appendChild(radio)
      const span = el('span')
      span.textContent = opt
      label.appendChild(span)
      optGroup.appendChild(label)
    }
    optGroup.appendChild(otherInput)
    modal.appendChild(optGroup)

    getAnswer = (): string => {
      if (selected === 'Other') return otherInput.value.trim() || 'Other'
      return selected ?? ''
    }
  } else {
    const textarea = el('textarea', 'interview-textarea') as HTMLTextAreaElement
    textarea.rows = 4
    textarea.placeholder = 'Type your answer...'
    modal.appendChild(textarea)
    getAnswer = (): string => textarea.value.trim()
  }

  // Buttons
  const btnRow = el('div', 'interview-btns')

  if (currentIdx > 0) {
    const backBtn = el('button', 'mbtn') as HTMLButtonElement
    backBtn.textContent = 'Back'
    backBtn.addEventListener('click', () => {
      currentIdx--
      renderQuestion()
    })
    btnRow.appendChild(backBtn)
  }

  const cancelBtn = el('button', 'mbtn') as HTMLButtonElement
  cancelBtn.textContent = 'Cancel'
  cancelBtn.addEventListener('click', closeModal)
  btnRow.appendChild(cancelBtn)

  const isLast = currentIdx === questions.length - 1
  const nextBtn = el('button', 'mbtn primary') as HTMLButtonElement
  nextBtn.textContent = isLast ? 'Submit' : 'Next'
  nextBtn.addEventListener('click', async () => {
    const answer = getAnswer()
    if (!answer) return

    answers[currentIdx] = { question: q.question, answer }

    if (!isLast) {
      currentIdx++
      renderQuestion()
      return
    }

    // Submit all answers
    nextBtn.disabled = true
    nextBtn.textContent = 'Evaluating...'

    try {
      if (!currentIssue) return
      const result = await api.submitInterview(currentIssue.id, answers)
      if (result.status === 'complete') {
        closeModal()
        onComplete?.()
      } else if (result.status === 'more_questions' && result.questions) {
        // Claude wants more — continue in same modal
        questions = result.questions
        answers = []
        currentIdx = 0
        renderQuestion()
      }
    } catch (e) {
      nextBtn.disabled = false
      nextBtn.textContent = 'Submit'
      const errEl = el('div', 'interview-err')
      errEl.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`
      modal.appendChild(errEl)
    }
  })
  btnRow.appendChild(nextBtn)

  modal.appendChild(btnRow)
}

function closeModal(): void {
  getOverlay().style.display = 'none'
  currentIssue = null
  questions = []
  answers = []
  currentIdx = 0
}
