import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Box, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
  pre: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(2),
    overflow: 'auto',
    maxHeight: '70vh',
    fontFamily: 'monospace',
    fontSize: theme.typography.body2.fontSize,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    backgroundColor: theme.palette.action.hover,
    borderRadius: theme.shape.borderRadius,
  },
}))

const LoraxMetadataWidget = observer(function LoraxMetadataWidget({
  model,
}: {
  model: IAnyStateTreeNode
}) {
  const { classes } = useStyles()
  const trackLabel = (model.trackLabel as string) || 'Lorax'
  const snapshot = model.snapshot as unknown

  const body =
    snapshot === null || snapshot === undefined ? (
      <Typography color="text.secondary">
        No file metadata is available yet. Load completes after the track finishes
        reading the Lorax file; open this panel again to refresh.
      </Typography>
    ) : (
      <Box
        className={classes.pre}
        component="pre"
        aria-label="Lorax load metadata"
      >
        {JSON.stringify(snapshot, null, 2)}
      </Box>
    )

  return (
    <div className={classes.root}>
      <Typography variant="h6" gutterBottom>
        {trackLabel}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Lorax load result (config and session id). Use this while wiring richer
        metadata views.
      </Typography>
      {body}
    </div>
  )
})

export default LoraxMetadataWidget
