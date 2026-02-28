/**
 * Prompt template panel — list, select, edit, and preview prompt templates.
 */
import type React from 'react'
import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import { EmptyState } from '@dashboard/frontend/common/components/EmptyState'
import { PromptEditor } from '@dashboard/frontend/sidebar/prompts/PromptEditor'
import { PromptPreview } from '@dashboard/frontend/sidebar/prompts/PromptPreview'
import * as api from '@dashboard/frontend/common/utils/api-client'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'

export function PromptPanel(): React.JSX.Element {
  const [prompts, setPrompts] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [tab, setTab] = useState<'preview' | 'edit'>('preview')

  useEffect(() => {
    void api
      .fetchPrompts()
      .then(setPrompts)
      .catch(() => setPrompts([]))
  }, [])

  useEffect(() => {
    if (!selected) return
    void api
      .fetchPromptContent(selected)
      .then(setContent)
      .catch(() => setContent(''))
  }, [selected])

  if (prompts.length === 0) {
    return (
      <EmptyState
        icon={'\u{1F4DD}'}
        message="No prompt templates found"
        submessage="Set promptDir in .barfrc"
      />
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Prompt list */}
        <Box
          sx={{
            width: 180,
            borderRight: 1,
            borderColor: 'divider',
            overflow: 'auto',
            flexShrink: 0,
          }}
        >
          <List dense disablePadding>
            {prompts.map((name) => (
              <ListItemButton
                key={name}
                selected={selected === name}
                onClick={() => setSelected(name)}
                sx={{ py: 0.5 }}
              >
                <ListItemText
                  primary={name.replace(/^PROMPT_/, '').replace(/\.md$/, '')}
                  primaryTypographyProps={{
                    variant: 'caption',
                    fontFamily: 'monospace',
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>

        {/* Content area */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          {selected ? (
            <>
              <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}>
                <Tabs
                  value={tab}
                  onChange={(_, v) => setTab(v as 'preview' | 'edit')}
                >
                  <Tab label="Preview" value="preview" />
                  <Tab label="Edit" value="edit" />
                </Tabs>
              </Box>
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                {tab === 'preview' ? (
                  <PromptPreview content={content} />
                ) : (
                  <PromptEditor
                    name={selected}
                    content={content}
                    onSaved={(newContent) => setContent(newContent)}
                  />
                )}
              </Box>
            </>
          ) : (
            <Box sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Select a prompt template
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}
