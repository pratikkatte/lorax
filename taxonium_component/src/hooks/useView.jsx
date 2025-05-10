import { useState, useMemo, useCallback, useEffect } from "react";
import {
  OrthographicView,
  OrthographicController,
  //OrthographicViewport,
} from "@deck.gl/core";

let globalSetZoomAxis = () => {};

const defaultViewState = {
  zoom: -2,
  target:[0.5, 0.5],
  pitch: 0,
  bearing: 0,
};

const INITIAL_VIEW_STATE = {
  target: [0, 0],
  zoom: [6,6]
}

class MyOrthographicController extends OrthographicController {
  
  handleEvent(event) {

    if (event.pointerType === "touch") {
      if (event.type === "pinchmove") {
        if (
          this.scrollZoom &&
          this.scrollZoom.zoomAxis &&
          this.scrollZoom.zoomAxis === "X"
        ) {
          return false;
        }
      }
    }
    if (event.type === 'panmove') {
      globalSetZoomAxis('all')
    }
    if (event.type === "wheel") {
      const controlKey = event.srcEvent.ctrlKey 
      if (controlKey){
        globalSetZoomAxis('X')
      }else{
        globalSetZoomAxis('Y')
      }
    }
    super.handleEvent(event);
  }
}

const useView = ({
  settings,
  deckSize,
  deckRef,
  jbrowseRef,
  mouseDownIsMinimap,
}) => {
  const [zoomAxis, setZoomAxis] = useState("Y");

  const [xzoom, setXzoom] = useState(window.screen.width < 600 ? -1 : 0);
  
  globalSetZoomAxis = setZoomAxis;

  const [viewState, setViewState] = useState({
    // target: [0, 0, 0],
    // zoom: 6,
    'ortho': INITIAL_VIEW_STATE,
    'genome-positions': INITIAL_VIEW_STATE 
  });

  const baseViewState = useMemo(() => {
    return {
      ...viewState,
      "genome-positions": { zoom: 0, target: [0, 0] },
      "ortho": { zoom: 0, target: [0, 0] },
    };
  }, [viewState]);

  const views = useMemo(() => {
    return [
        new OrthographicView({
          x: '11.01%',
          y:'1%',
          height: '90%',
          width: '88.99%',
          id: "ortho",
          controller: {
            // type: OrthographicController,
            type: MyOrthographicController,
            scrollZoom: { smooth: true, zoomAxis: zoomAxis },
            panX: false,
            panY: false,
            dragPan:true,
          },
          initialViewState: INITIAL_VIEW_STATE
        }),
        new OrthographicView({
          x:'1%',
          y:'1%',
          height: '90%',
          width:'9%',
          id: "genome-positions",
          controller:false,
        }),
      ]}, [
    viewState,
    zoomAxis,
    xzoom,
  ]);

  const [mouseXY, setMouseXY] = useState(false);
  
  const handleViewStateChange = useCallback(({viewState:newViewState, viewId, oldViewState, basicTarget, overrideZoomAxis}) => {
    if (!viewId || !newViewState) return;
    setViewState((prev) => {
      let zoom = [...oldViewState.zoom];
      let target = [...oldViewState.target];

      let genome_position_view = prev['genome-positions'] || {};
      if(zoomAxis==='Y'){
        zoom[1] = newViewState.zoom[1]; 
        target[1] = newViewState.target[1]; 

        zoom[0] = oldViewState.zoom[0];
        target[0] = oldViewState.target[0];
      }
      else if (zoomAxis=='X'){
        zoom[0] = newViewState.zoom[0]; 
        target[0] = newViewState.target[0]; 

        zoom[1] = oldViewState.zoom[1];
        target[1] = oldViewState.target[1];
      }
      else{
        
        zoom = newViewState.zoom
        target = newViewState.target
      }

      const newViewStates = {
        ...prev,
        [viewId]: {
          ...prev[viewId],
          zoom,
          target
        }
      };

      if (prev['genome-positions']) {
        newViewStates['genome-positions'] = {
          ...prev['genome-positions'],
          target: [prev['genome-positions'].target?.[0] || 0, target[1]],
          zoom: [prev['genome-positions'].zoom?.[0], zoom[1]]  
        };
      }

      return newViewStates;
    });
    
  }, [zoomAxis])

  // const onViewStateChange = useCallback(
  //   ({
  //     viewState: newViewState,
  //     interactionState,
  //     viewId,
  //     oldViewState,
  //     basicTarget,
  //     overrideZoomAxis,
  //     specialMinimap,
  //   }) => {
  //     if (!deckSize) {
  //       console.log("decksize", deckSize)

  //       return;
  //     }

  //     const localZoomAxis = overrideZoomAxis || zoomAxis;

  //     // // check oldViewState has a initial_xzoom property or set it to initial_xzoom
  //     // if (viewId === "minimap") {
  //     //   return;
  //     // }

  //     //const temp_viewport = new OrthographicViewport(viewS
  //     const oldScaleY = 2 ** oldViewState.zoom;
  //     const newScaleY = 2 ** newViewState.zoom;
  //     // eslint-disable-line no-unused-vars

  //     if (mouseDownIsMinimap && !specialMinimap && oldScaleY === newScaleY) {
  //       return;
  //     }

  //     let newScaleX = 2 ** xzoom;
  //     if (basicTarget) {
  //       newViewState.target[0] =
  //         (newViewState.target[0] / newScaleY) * newScaleX;
  //     } else {
  //       if (oldScaleY !== newScaleY) {
  //         if (localZoomAxis === "Y") {
  //           newViewState.target[0] =
  //             (oldViewState.target[0] / newScaleY) * oldScaleY;
  //         } else {
  //           const difference = newViewState.zoom - oldViewState.zoom;

  //           setXzoom((old) => old + difference);

  //           newScaleX = 2 ** (xzoom + difference);

  //           newViewState.zoom = oldViewState.zoom;
  //           newViewState.target[0] =
  //             (oldViewState.target[0] / oldScaleY) * newScaleY;
  //         }
  //       }
  //     }

  //     newViewState.target = [...newViewState.target];

  //     newViewState.real_height = deckSize.height / newScaleY;
  //     newViewState.real_width = deckSize.width / newScaleX;

  //     newViewState.real_target = [...newViewState.target];
  //     newViewState.real_target[0] =
  //       (newViewState.real_target[0] * newScaleY) / newScaleX;

  //     const nw = [
  //       newViewState.real_target[0] - newViewState.real_width / 2,
  //       newViewState.real_target[1] - newViewState.real_height / 2,
  //     ];
  //     const se = [
  //       newViewState.real_target[0] + newViewState.real_width / 2,
  //       newViewState.real_target[1] + newViewState.real_height / 2,
  //     ];

  //     newViewState.min_x = nw[0];
  //     newViewState.max_x = se[0];
  //     newViewState.min_y = nw[1];
  //     newViewState.max_y = se[1];

  //     // newViewState["minimap"] = { zoom: -3, target: [250, 1000] };

  //     // if (jbrowseRef.current) {
  //     //   const yBound = jbrowseRef.current.children[0].children[0].clientHeight;
  //     //   const xBound =
  //     //     jbrowseRef.current.children[0].children[0].offsetParent.offsetParent
  //     //       .offsetLeft;
  //     //   if (
  //     //     (mouseXY[0] > xBound && mouseXY[1] < yBound) ||
  //     //     mouseXY[0] < 0 ||
  //     //     mouseXY[1] < 0
  //     //   ) {
  //     //     if (!basicTarget && viewId) {
  //     //       return;
  //     //     }
  //     //   }
  //     // }

  //     // // Treenome view state
  //     // if (viewId === "main" || viewId === "main-overlay" || !viewId) {
  //     //   newViewState["browser-main"] = {
  //     //     ...viewState["browser-main"],
  //     //     zoom: newViewState.zoom,
  //     //     target: [viewState["browser-main"].target[0], newViewState.target[1]],
  //     //   };
  //     // }

  //     setViewState(newViewState);
  //     return newViewState;
  //   },
  //   [zoomAxis, xzoom, deckSize, viewState, jbrowseRef, mouseXY]
  // );

  // const zoomIncrement = useCallback(
  //   (increment, overrideZoomAxis) => {
  //     const newViewState = { ...viewState };
  //     newViewState.zoom += increment;

  //     onViewStateChange({
  //       viewState: newViewState,
  //       interactionState: "isZooming",
  //       oldViewState: viewState,
  //       overrideZoomAxis,
  //     });
  //   },
  //   [viewState, onViewStateChange]
  // );

  // const zoomReset = useCallback(() => {
  //   const newViewState = { ...defaultViewState };
  //   setXzoom(0);
  //   setViewState(newViewState);
  //   onViewStateChange({
  //     viewState: newViewState,
  //     interactionState: "isZooming",
  //     oldViewState: newViewState,
  //   });
  // }, [viewState, onViewStateChange]);

  const output = useMemo(() => {
    return {
      viewState,
      setViewState,
      // onViewStateChange,
      views,
      zoomAxis,
      setZoomAxis,
      // modelMatrix,
      // zoomIncrement,
      xzoom,
      // mouseXY,
      // setMouseXY,
      // baseViewState,
      // zoomReset,
      setMouseXY,
      mouseXY,
      handleViewStateChange
    };
  }, [
    viewState,
    setViewState,
    // onViewStateChange,
    views,
    zoomAxis,
    setZoomAxis,
    // modelMatrix,
    // zoomIncrement,
    xzoom,
    // mouseXY,
    // setMouseXY,
    // baseViewState,
    // zoomReset,
    setMouseXY,
    mouseXY,
   handleViewStateChange
  ]);

  return output;
};

export default useView;
