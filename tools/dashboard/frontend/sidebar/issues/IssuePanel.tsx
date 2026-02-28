/**
 * Three-tab panel for the selected issue: rendered preview, raw editor, and frontmatter metadata.
 *
 * Each tab lazily mounts its sub-panel. The active tab index is local state so
 * switching tabs inside the issue panel does not bleed into the global UI store.
 */
import type React from 'react'
import { useState } from 'react'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import { IssuePreview } from '@dashboard/frontend/sidebar/issues/IssuePreview'
import { IssueEditor } from '@dashboard/frontend/sidebar/issues/IssueEditor'
import { IssueMetadata } from '@dashboard/frontend/sidebar/issues/IssueMetadata'
import { IssueSteps } from '@dashboard/frontend/sidebar/issues/IssueSteps'
import { IssueActions } from '@dashboard/frontend/sidebar/issues/IssueActions'
import { useIssueStore } from '@dashboard/frontend/store/useIssueStore'

type IssueTab = 'preview' | 'edit' | 'metadata'

/**
 * Root issue detail panel with tab navigation.
 *
 * @returns The tabbed issue panel, or null when no issue is selected.
 */
export function IssuePanel(): React.JSX.Element | null {
  const [activeTab, setActiveTab] = useState<IssueTab>('preview')
  const [dirty, setDirty] = useState(false)

  const selectedId = useIssueStore((s) => s.selectedId)
  const issues = useIssueStore((s) => s.issues)

  if (selectedId === null) return null

  const issue = issues.find((i) => i.id === selectedId) ?? null
  if (issue === null) return null

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Pipeline progress stepper */}
      <IssueSteps issue={issue} />

      {/* Sub-panel tabs */}
      <Tabs
        value={activeTab}
        onChange={(_e, v: IssueTab) => setActiveTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0, px: 1 }}
      >
        <Tab label="Preview" value="preview" />
        <Tab
          label={dirty ? 'Edit *' : 'Edit'}
          value="edit"
          sx={{ color: dirty ? 'warning.main' : undefined }}
        />
        <Tab label="Metadata" value="metadata" />
      </Tabs>

      {/* Sub-panel content */}
      <Box
        sx={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {activeTab === 'preview' && <IssuePreview issue={issue} />}
        {activeTab === 'edit' && (
          <IssueEditor issue={issue} onDirtyChange={setDirty} />
        )}
        {activeTab === 'metadata' && <IssueMetadata issue={issue} />}
      </Box>

      {/* Action buttons at bottom */}
      <IssueActions
        issue={issue}
        dirty={dirty}
        onSaved={() => setDirty(false)}
      />
    </Box>
  )
}
