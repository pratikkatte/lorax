import { useState, useMemo, useCallback, useEffect } from "react";
import {
  OrthographicView,
  OrthographicController,
  //OrthographicViewport,
} from "@deck.gl/core";
import useRegions from "./useRegions";

let globalSetZoomAxis = () => {};
let globalPanDirection = () => {};


const INITIAL_VIEW_STATE = {
  'genome_positions':{
    target: [2,1],
    zoom: [8,8],
    minZoom: 3,
    // padding: '5%',
  },
  'tree-time':{
    target: [0.5 ,0],
    zoom: [8,8],
    minZoom: 7,
    
  },
  'ortho': {
    target: [2,0],
    zoom: [8,8],
    minZoom: 3,
    
  }
}

// Main helper: returns the two indices (i0 for x0, i1 for x1)
function findClosestBinIndices(globalBins, x0, x1) {
  const xs = getXArray(globalBins);
  const i0 = nearestIndex(xs, x0);
  const i1 = nearestIndex(xs, x1);
  return { i0, i1 };
}

function nearestIndex(arr, x) {
  if (arr.length === 0) return -1;
  if (x <= arr[0]) return 0;
  if (x >= arr[arr.length - 1]) return arr.length - 1;

  const i = lowerBound(arr, x);
  // i is first >= x, so candidate neighbors are i-1 and i
  const prev = i - 1;
  return (x - arr[prev] <= arr[i] - x) ? prev : i;
}

// Extract the sorted x-array once
function getXArray(globalBins) {
  return globalBins.map(b => b.acc);
}

function lowerBound(arr, x) {
  let lo = 0, hi = arr.length - 1, ans = arr.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] >= x) { ans = mid; hi = mid - 1; } else { lo = mid + 1; }
  }
  return ans;
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
        globalPanDirection(null)
      }else{
        if(Math.abs(event.srcEvent.deltaY) === 0) {
          if(event.srcEvent.deltaX > 0) {
            globalPanDirection("R")
          } else {
            globalPanDirection("L")
          }
        } else {
          globalSetZoomAxis('Y')
          globalPanDirection(null)
        }
      }
    }
    super.handleEvent(event);
  }
}

const useView = ({config, settings, setSettings, genomeViewportCoords, setGenomeViewportCoords, viewportSize, setViewportSize, viewPortCoords, globalBins, setGenomicoodinates}) => {
  const [zoomAxis, setZoomAxis] = useState("Y");
  const [panDirection, setPanDirection] = useState(null);
  const [xzoom, setXzoom] = useState(window.screen.width < 600 ? -1 : 0);


  // const { getbounds } = useRegions({config, viewportSize});

  const [viewState, setViewState] = useState({
    // target: [0, 0, 0],
    // zoom: 6,
    'ortho': INITIAL_VIEW_STATE['ortho'],
    'genome-positions': INITIAL_VIEW_STATE['genome_positions'],
    'tree-time': INITIAL_VIEW_STATE['tree-time']
  });

  globalSetZoomAxis = setZoomAxis;
  globalPanDirection = setPanDirection;

  const maxZoom = 17;

  useEffect(() => {
    if (config && config.value && viewportSize) {
      // console.log("useView config and viewportsize", viewportSize, config.value) 
      // getbounds()
    }
    
  }, [viewportSize, config?.value])
  

  const views = useMemo(() => {
    return [
        new OrthographicView({
          x: settings.vertical_mode ? '10%' : '10%',
          y:settings.vertical_mode ? '1%' : '8%',
          height: '80%',
          width:'80%',
          id: "ortho",
          minZoom: [3,3],
          controller: {
            type: MyOrthographicController,
            scrollZoom: { smooth: true, zoomAxis: zoomAxis },
            dragPan:true,
            
          },

          initialViewState: INITIAL_VIEW_STATE.ortho
        }),
        new OrthographicView({
          x: settings.vertical_mode ? '5%' : '10%',
          y: settings.vertical_mode ? '5%' : '5%',
          height: settings.vertical_mode ? '90%' : '3%',
          width: settings.vertical_mode ? '5%' : '80%',
          id: "genome-positions",
          controller:false,
        }),
        new OrthographicView({
          x: settings.vertical_mode ? '10%' : '5%',
          y: settings.vertical_mode ? '80%' : '8%',
          height: settings.vertical_mode ? '9%' : '80%',
          width: settings.vertical_mode ? '80%' : '5%',
          id: "tree-time",
          controller:false,
        }),
      ]}, [
    viewState,
    zoomAxis,
    xzoom,
    settings,
    panDirection
  ]);

  const [mouseXY, setMouseXY] = useState(false);

  const [globalBinsIndexes, setGlobalBinsIndexes] = useState(null);

  useEffect(() => {
    if (!viewPortCoords || !globalBins) return;

    if (!globalBins === undefined || globalBins === null) return;
    var {x0, x1} = viewPortCoords['genome-positions']?.coordinates;
    var {i0, i1} = findClosestBinIndices(globalBins, x0, x1)

    setGlobalBinsIndexes([i0, i1])

    setGenomicoodinates([globalBins[i0].s, globalBins[i1].e])

  }, [viewState, globalBins])

  const setView = useCallback((targetView) => {

    setViewState((prev) => {
      return {
        ...prev,
        'ortho': {
          ...prev['ortho'],
          target: [targetView['ortho']['target'],prev['ortho']['target'][1]],
          zoom: [targetView['ortho']['zoom'],prev['ortho']['zoom'][1]]
        },
        'genome-positions': {
          ...prev['genome-positions'],
          target: [targetView['genome-positions']['target'],prev['genome-positions']['target'][1]],
          zoom: [targetView['genome-positions']['zoom'],prev['genome-positions']['zoom'][1]]
        }
      }
    })

  },[]);
  
  const handleViewStateChange = useCallback(({viewState:newViewState, viewId, oldViewState}) => {
    if (!viewId || !newViewState) return;
    
    setViewState((prev) => {
      let zoom = [...oldViewState.zoom];
      let target = [...oldViewState.target];

      let genome_position_view = prev['genome-positions'] || {};

      if(panDirection === null){
      if(zoomAxis==='Y'){
        zoom[1] = newViewState.zoom[1] <= maxZoom ? newViewState.zoom[1] : maxZoom; 
        target[1] = zoom[1] >= maxZoom ? oldViewState.target[1] : newViewState.target[1]; 
        zoom[0] = oldViewState.zoom[0];
        target[0] = oldViewState.target[0];
      }
      else if (zoomAxis=='X'){
        zoom[0] = newViewState.zoom[0] <= maxZoom ? newViewState.zoom[0] : maxZoom; 
        target[0] = zoom[0] >= maxZoom ? oldViewState.target[0] : newViewState.target[0]; 
        zoom[1] = oldViewState.zoom[1];
        target[1] = oldViewState.target[1];
      }

      } else if (panDirection === "L"){
        // Adjust pan step according to zoom level
        // The step size decreases as zoom increases (zoom[0] is log2 scale)
        var panStep = zoom[0]**2 / Math.pow(2, zoom[0]);
        // panStep = 0.2
        target[0] = target[0] - panStep;
      }

      else if (panDirection === "R"){
        var panStep = zoom[0]*2 / Math.pow(2, zoom[0]);
        // panStep = 0.2
        target[0] = target[0] + panStep
      }
      
      else {
        zoom = newViewState.zoom
        target = [newViewState.target[0], oldViewState.target[1]]
      }

      if (target[0] < 0){
        target = [...oldViewState.target];
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
          target: settings.vertical_mode ? [prev['genome-positions'].target?.[0] || 0, target[1]] : [target[0], prev['genome-positions'].target?.[1] || 0],
          zoom: settings.vertical_mode ? [prev['genome-positions'].zoom?.[0], zoom[1]] : [zoom[0], prev['genome-positions'].zoom?.[1]]  
        };
      }
      return newViewStates;
    });
    
  }, [zoomAxis, settings, panDirection])

  const output = useMemo(() => {
    return {
      viewState,
      setViewState,
      setView,
      views,
      zoomAxis,
      setZoomAxis,
      xzoom,
      setMouseXY,
      mouseXY,
      handleViewStateChange,
      globalBinsIndexes,
      setGlobalBinsIndexes
    };
  }, [
    viewState,
    setViewState,
    setView,
    views,
    zoomAxis,
    setZoomAxis,
    xzoom,
    setMouseXY,
    mouseXY,
    settings,
    panDirection,
   handleViewStateChange,
   globalBinsIndexes,
   setGlobalBinsIndexes
  ]);

  return output;
};

export default useView;
