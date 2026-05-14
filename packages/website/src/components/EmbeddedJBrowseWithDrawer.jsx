import React, { Suspense, useMemo } from 'react';
import { readConfObject } from '@jbrowse/core/configuration';
import { LoadingEllipses, createJBrowseTheme } from '@jbrowse/core/ui';
import { EmbeddedViewContainer } from '@jbrowse/embedded-core';
import { getEnv } from '@jbrowse/mobx-state-tree';
import { ThemeProvider } from '@mui/material';
import { observer } from 'mobx-react';
import { LuX } from 'react-icons/lu';

function getDrawerWidth(session) {
  const width = Number(session?.drawerWidth);
  if (!Number.isFinite(width)) return 384;
  return Math.min(Math.max(width, 280), 560);
}

const EmbeddedJBrowseWithDrawer = observer(function EmbeddedJBrowseWithDrawer({
  viewState
}) {
  const { session } = viewState;
  const { view, visibleWidget } = session;
  const { pluginManager } = getEnv(session);
  const { ReactComponent: ViewComponent } = pluginManager.getViewType(view.type);
  const theme = createJBrowseTheme(
    readConfObject(viewState.config.configuration, 'theme')
  );

  const widgetConfig = useMemo(() => {
    if (!visibleWidget) return null;
    const widgetType = pluginManager.getWidgetType(visibleWidget.type);
    const WidgetComponent = pluginManager.evaluateExtensionPoint(
      'Core-replaceWidget',
      widgetType.ReactComponent,
      {
        session,
        model: visibleWidget
      }
    );
    return {
      WidgetComponent,
      HeadingComponent: widgetType.HeadingComponent,
      heading: widgetType.heading || visibleWidget.type,
      width: getDrawerWidth(session)
    };
  }, [pluginManager, session, visibleWidget]);

  return (
    <ThemeProvider theme={theme}>
      <div className="flex h-full min-h-0 min-w-0 bg-white">
        <div className="min-w-0 flex-1">
          <EmbeddedViewContainer view={view}>
            <Suspense fallback={<LoadingEllipses />}>
              <ViewComponent model={view} session={session} />
            </Suspense>
          </EmbeddedViewContainer>
        </div>

        {visibleWidget && widgetConfig ? (
          <aside
            data-testid="jbrowse-widget-drawer"
            className="flex h-full min-h-0 shrink-0 flex-col border-l border-slate-200 bg-white shadow-xl"
            style={{ width: widgetConfig.width }}
          >
            <header className="flex min-h-[52px] items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-4 text-white">
              <div className="min-w-0 truncate text-sm font-semibold">
                {widgetConfig.HeadingComponent ? (
                  <widgetConfig.HeadingComponent model={visibleWidget} />
                ) : (
                  widgetConfig.heading
                )}
              </div>
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-200 hover:bg-slate-800 hover:text-white"
                title="Close widget"
                aria-label="Close widget"
                onClick={() => {
                  if (typeof session.hideWidget === 'function') {
                    session.hideWidget(visibleWidget);
                  } else {
                    session.hideAllWidgets?.();
                  }
                }}
              >
                <LuX className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-3">
              <Suspense fallback={<LoadingEllipses />}>
                <widgetConfig.WidgetComponent
                  model={visibleWidget}
                  session={session}
                  overrideDimensions={{
                    height: window.innerHeight,
                    width: widgetConfig.width
                  }}
                />
              </Suspense>
            </div>
          </aside>
        ) : null}
      </div>
    </ThemeProvider>
  );
});

export default EmbeddedJBrowseWithDrawer;
