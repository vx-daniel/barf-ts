/**
 * Action toolbar rendered at the bottom of the issue panel.
 *
 * Provides:
 * - Save button — visible only when the editor has unsaved changes
 * - Run command buttons — state-specific commands from {@link CMD_ACTIONS}
 * - Stop button — when this issue is the currently running issue
 * - Delete button — opens a {@link ConfirmDialog} before calling the store
 */
import type React from 'react'
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import SaveIcon from '@mui/icons-material/Save'
import StopIcon from '@mui/icons-material/Stop'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import { ActionButton } from '@dashboard/frontend/common/components/ActionButton'
import { ConfirmDialog } from '@dashboard/frontend/common/components/ConfirmDialog'
import {
  CMD_ACTIONS,
  CMD_COLORS,
} from '@dashboard/frontend/common/utils/constants'
import { useIssueStore } from '@dashboard/frontend/store/useIssueStore'
import * as api from '@dashboard/frontend/common/utils/api-client'
import { readEditorContent } from '@dashboard/frontend/sidebar/issues/IssueEditor'
import type { Issue } from '@/types/schema/issue-schema'
import type { IssueState } from '@/types/schema/issue-schema'
import { theme } from '@dashboard/frontend/theme'

interface IssueActionsProps {
  /** The issue this toolbar acts on. */
  issue: Issue
  /** Whether the editor has unsaved changes. */
  dirty: boolean
  /** Called after a successful save so the parent can reset dirty state. */
  onSaved: () => void
}

/**
 * Bottom action toolbar for an issue.
 *
 * @param issue - The issue being acted upon.
 * @param dirty - Whether the editor has unsaved changes.
 * @param onSaved - Callback invoked after a successful save.
 * @returns The rendered toolbar.
 */
export function IssueActions({
  issue,
  dirty,
  onSaved,
}: IssueActionsProps): React.JSX.Element {
  const [deleteOpen, setDeleteOpen] = useState(false)

  const runningId = useIssueStore((s) => s.runningId)
  const runCommand = useIssueStore((s) => s.runCommand)
  const stopAndReset = useIssueStore((s) => s.stopAndReset)
  const deleteIssue = useIssueStore((s) => s.deleteIssue)
  const updateIssueInList = useIssueStore((s) => s.updateIssueInList)

  const isRunning = runningId === issue.id
  const commands = CMD_ACTIONS[issue.state as IssueState] ?? []

  const handleSave = async (): Promise<void> => {
    const body = readEditorContent(issue.id)
    if (body === null) return
    const updated = await api.updateIssue(issue.id, { body })
    updateIssueInList(issue.id, { body: updated.body })
    onSaved()
  }

  const handleDelete = async (): Promise<void> => {
    setDeleteOpen(false)
    await deleteIssue(issue.id)
  }

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 0.75,
          px: 1.5,
          py: 1,
          borderTop: 1,
          borderColor: 'divider',
          flexShrink: 0,
          alignItems: 'center',
        }}
      >
        {/* Save button — only when dirty */}
        {dirty && (
          <ActionButton
            size="small"
            variant="contained"
            color="primary"
            startIcon={<SaveIcon sx={{ fontSize: '0.875rem !important' }} />}
            onClick={handleSave}
          >
            Save
          </ActionButton>
        )}

        {/* Stop button — only when this issue is running */}
        {isRunning && (
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<StopIcon sx={{ fontSize: '0.875rem !important' }} />}
            onClick={stopAndReset}
          >
            Stop
          </Button>
        )}

        {/* State-specific run command buttons */}
        {!isRunning &&
          commands.map((cmd) => (
            <Tooltip
              key={cmd}
              title={`Run ${cmd} on #${issue.id}`}
              placement="top"
            >
              <Button
                size="small"
                variant="outlined"
                onClick={() => runCommand(issue.id, cmd)}
                sx={{
                  borderColor: CMD_COLORS[cmd] ?? 'primary.main',
                  color: CMD_COLORS[cmd] ?? 'primary.main',
                  '&:hover': {
                    borderColor: CMD_COLORS[cmd] ?? 'primary.main',
                    backgroundColor: `${CMD_COLORS[cmd] ?? theme.palette.primary.main}18`,
                  },
                }}
              >
                {cmd}
              </Button>
            </Tooltip>
          ))}

        {/* Spacer to push delete to the right */}
        <Box sx={{ flex: 1 }} />

        {/* Delete button */}
        <Tooltip title="Delete issue" placement="top">
          <Button
            size="small"
            variant="text"
            color="error"
            startIcon={<DeleteIcon sx={{ fontSize: '0.875rem !important' }} />}
            onClick={() => setDeleteOpen(true)}
            sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
          >
            Delete
          </Button>
        </Tooltip>
      </Box>

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete #${issue.id}?`}
        message={`"${issue.title}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
        destructive
      />
    </>
  )
}
