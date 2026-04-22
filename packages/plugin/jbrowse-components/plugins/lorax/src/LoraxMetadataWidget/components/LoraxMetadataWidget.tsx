import { useState } from 'react'

import SimpleField from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/SimpleField'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Divider,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { observer } from 'mobx-react'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

type ParsedSnapshot = {
  loraxSid?: string
  config?: Record<string, unknown>
}

function parseSnapshot(raw: unknown): ParsedSnapshot | null {
  if (raw === null || raw === undefined) {
    return null
  }
  if (typeof raw !== 'object') {
    return null
  }
  const obj = raw as Record<string, unknown>
  const loraxSid = typeof obj.loraxSid === 'string' ? obj.loraxSid : undefined
  const config = obj.config
  const configObj =
    config && typeof config === 'object' && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : undefined
  return { loraxSid, config: configObj }
}

function formatScalar(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map(v => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ')
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function formatIntervalsSummary(config: Record<string, unknown>): string | undefined {
  const iv = config.intervals
  if (!Array.isArray(iv) || iv.length === 0) {
    return undefined
  }
  const first = iv[0]
  const last = iv[iv.length - 1]
  if (Array.isArray(first) && first.length >= 2 && Array.isArray(last) && last.length >= 2) {
    return `${iv.length} window(s); first [${first[0]}, ${first[1]}]`
  }
  return `${iv.length} interval(s)`
}

function getMutationsList(config: Record<string, unknown>): Record<string, unknown>[] {
  const m = config.mutations
  if (!Array.isArray(m)) {
    return []
  }
  return m.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object')
}

function formatMutationRow(m: Record<string, unknown>): string {
  const derived = m.derived_state ?? m.derivedState
  const inherited = m.inherited_state ?? m.inheritedState
  const pos = m.position
  const left = inherited != null ? String(inherited) : '?'
  const right = derived != null ? String(derived) : '?'
  const posStr = pos != null ? ` (Pos: ${pos})` : ''
  return `${left} → ${right}${posStr}`
}

const useStyles = makeStyles()(theme => ({
  paper: {
    margin: theme.spacing(2),
    padding: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
  trackTitle: {
    marginBottom: theme.spacing(1),
  },
  tabPanel: {
    paddingTop: theme.spacing(2),
  },
  sectionHeader: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
    letterSpacing: 0.08 * 16,
  },
  pre: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(2),
    overflow: 'auto',
    maxHeight: '55vh',
    fontFamily: 'monospace',
    fontSize: theme.typography.body2.fontSize,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.action.hover,
    borderRadius: theme.shape.borderRadius,
  },
  accordionDetails: {
    padding: theme.spacing(1),
  },
}))

function TabPanel(props: { children: React.ReactNode; value: number; index: number }) {
  const { children, value, index } = props
  if (value !== index) {
    return null
  }
  return (
    <div role="tabpanel" id={`lorax-metadata-tabpanel-${index}`}>
      {children}
    </div>
  )
}

const LoraxMetadataWidget = observer(function LoraxMetadataWidget({
  model,
}: {
  model: IAnyStateTreeNode
}) {
  const { classes } = useStyles()
  const [tab, setTab] = useState(0)
  const trackLabel = (model.trackLabel as string) || 'Lorax'
  const parsed = parseSnapshot(model.snapshot as unknown)

  if (!parsed) {
    return (
      <Paper className={classes.paper} data-testid="lorax-metadata-widget-empty">
        <Typography variant="h6" className={classes.trackTitle}>
          {trackLabel}
        </Typography>
        <Typography color="text.secondary">
          No file metadata is available yet. Load completes after the track finishes reading the
          Lorax file; open this panel again to refresh.
        </Typography>
      </Paper>
    )
  }

  const { loraxSid, config = {} } = parsed

  const genomeLen = formatScalar(config.genome_length)
  const project = formatScalar(config.project)
  const sid = formatScalar(config.sid)
  const initialPos = formatScalar(config.initial_position)
  const intervalsSummary = formatIntervalsSummary(config)
  const mutations = getMutationsList(config)
  const metadataSchema = config.metadata_schema

  return (
    <Paper className={classes.paper} data-testid="lorax-metadata-widget">
      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        textColor="primary"
        indicatorColor="primary"
        variant="fullWidth"
        aria-label="Lorax metadata sections"
      >
        <Tab label="Details" id="lorax-metadata-tab-0" aria-controls="lorax-metadata-tabpanel-0" />
        <Tab label="Mutations" id="lorax-metadata-tab-1" aria-controls="lorax-metadata-tabpanel-1" />
        <Tab label="Metadata" id="lorax-metadata-tab-2" aria-controls="lorax-metadata-tabpanel-2" />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <div className={classes.tabPanel}>
          <Typography variant="overline" component="h2" className={classes.sectionHeader}>
            Tree / load details
          </Typography>
          <Divider sx={{ mb: 1 }} />
          <SimpleField name="Lorax session id" value={loraxSid ?? '—'} />
          {sid ? <SimpleField name="Config sid" value={sid} /> : null}
          {project ? <SimpleField name="Project" value={project} /> : null}
          {genomeLen ? <SimpleField name="Genome length" value={genomeLen} /> : null}
          {initialPos ? <SimpleField name="Initial position" value={initialPos} /> : null}
          {intervalsSummary ? <SimpleField name="Intervals" value={intervalsSummary} /> : null}
          <Accordion defaultExpanded={false} sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="button">Full config (JSON)</Typography>
            </AccordionSummary>
            <AccordionDetails className={classes.accordionDetails}>
              <Box className={classes.pre} component="pre" aria-label="Full Lorax config JSON">
                {JSON.stringify(config, null, 2)}
              </Box>
            </AccordionDetails>
          </Accordion>
        </div>
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <div className={classes.tabPanel}>
          {mutations.length === 0 ? (
            <Typography color="text.secondary">No mutations in this load payload.</Typography>
          ) : (
            <>
              <Typography variant="overline" component="h2" className={classes.sectionHeader}>
                Mutations ({mutations.length})
              </Typography>
              <Divider sx={{ mb: 1 }} />
              {mutations.map((m, i) => {
                const id = m.id != null ? String(m.id) : String(i)
                return (
                  <SimpleField
                    key={`mut-${id}-${i}`}
                    name={`Mut ${id}`}
                    value={formatMutationRow(m)}
                  />
                )
              })}
            </>
          )}
        </div>
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <div className={classes.tabPanel}>
          {metadataSchema !== undefined && metadataSchema !== null ? (
            <>
              <Typography variant="overline" component="h2" className={classes.sectionHeader}>
                Metadata schema
              </Typography>
              <Divider sx={{ mb: 1 }} />
              <Box className={classes.pre} component="pre" aria-label="Metadata schema JSON">
                {JSON.stringify(metadataSchema, null, 2)}
              </Box>
            </>
          ) : (
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              No metadata_schema field in this load payload.
            </Typography>
          )}
          <Accordion defaultExpanded={metadataSchema == null} sx={{ mt: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="button">Full snapshot</Typography>
            </AccordionSummary>
            <AccordionDetails className={classes.accordionDetails}>
              <Box className={classes.pre} component="pre" aria-label="Full Lorax load snapshot">
                {JSON.stringify(parsed, null, 2)}
              </Box>
            </AccordionDetails>
          </Accordion>
        </div>
      </TabPanel>
    </Paper>
  )
})

export default LoraxMetadataWidget
