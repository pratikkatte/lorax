import { useState, useMemo, useCallback, useEffect } from "react";
import {
  OrthographicView,
  OrthographicController,
  //OrthographicViewport,
} from "@deck.gl/core";

let globalSetZoomAxis = () => {};
let globalPanDirection = () => {};


const INITIAL_VIEW_STATE = {
  'genome_positions':{
    target: [2,1],
    zoom: [6,6],
    minZoom: 1,
  },
  'tree-time':{
    target: [0.5 ,0],
    zoom: [8,8],
    minZoom: 7,
  },
  'ortho': {
    target: [2,0],
    zoom: [6,6],
    minZoom: 1,
  }
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

  const useView = ({ config, viewPortCoords, hoverDetails, valueRef}) => {

  const {globalBins, globalBpPerUnit} = config;
  const [zoomAxis, setZoomAxis] = useState("Y");
  const [panDirection, setPanDirection] = useState(null);
  const [xzoom, setXzoom] = useState(window.screen.width < 600 ? -1 : 0);

const { hoveredInfo, setHoveredInfo } = hoverDetails;

  const [viewState, setViewState] = useState({
    'ortho': INITIAL_VIEW_STATE['ortho'],
    'genome-positions': INITIAL_VIEW_STATE['genome_positions'],
    'tree-time': INITIAL_VIEW_STATE['tree-time']
  });

  globalSetZoomAxis = setZoomAxis;
  globalPanDirection = setPanDirection;

  const maxZoom = 17;

  const views = useMemo(() => {
    return [
        new OrthographicView({
          x: '10%',
          y: '8%',
          height: '80%',
          width:'80%',
          id: "ortho",
          controller: {
            type: MyOrthographicController,
            scrollZoom: { smooth: true, zoomAxis: zoomAxis },
            dragPan:true,
          },
          initialViewState: INITIAL_VIEW_STATE.ortho
        }),
        new OrthographicView({
          x: '10%',
          y: '5%',
          height: '3%',
          width: '80%',
          id: "genome-positions",
          controller:false,
          initialViewState: INITIAL_VIEW_STATE['genome-positions']
        }),
        new OrthographicView({
          x: '5%',
          y: '8%',
          height: '80%',
          width: '5%',
          id: "tree-time",
          controller:false,
        }),
      ]}, [
    viewState,
    zoomAxis,
    xzoom,
    panDirection
  ]);

  const [mouseXY, setMouseXY] = useState(false);

  const [globalBinsIndexes, setGlobalBinsIndexes] = useState(null);

  useEffect(() => {
    if (!viewPortCoords || !globalBins) return;
    if (!globalBins == undefined || globalBins == null || !globalBpPerUnit) return;
    
    var {x0, x1} = viewPortCoords['genome-positions']?.coordinates;
    
    if (globalBpPerUnit) {
      const newValue = [Math.round(x0*globalBpPerUnit) > 0 ? Math.round(x0*globalBpPerUnit) : 0, Math.round(x1*globalBpPerUnit)>0 ? Math.round(x1*globalBpPerUnit) : 0]
      valueRef.current = newValue
    }
  }, [viewState, globalBins, globalBpPerUnit])

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
      let panStep = 0;

      if(panDirection === null) {
        if(zoomAxis==='Y'){
          zoom[1] = newViewState.zoom[1] <= maxZoom ? newViewState.zoom[1] : maxZoom; 
          target[1] = zoom[1] >= maxZoom ? oldViewState.target[1] : newViewState.target[1]; 
          zoom[0] = oldViewState.zoom[0];
          target[0] = oldViewState.target[0];
        }
        else if (zoomAxis=='X') {
          zoom[0] = newViewState.zoom[0] <= maxZoom ? newViewState.zoom[0] : maxZoom; 
          target[0] = zoom[0] >= maxZoom ? oldViewState.target[0] : newViewState.target[0]; 
          zoom[1] = oldViewState.zoom[1];
          target[1] = oldViewState.target[1];
        }
      } else if (panDirection === "L"){
        // Adjust pan step according to zoom level
        // The step size decreases as zoom increases (zoom[0] is log2 scale)
        panStep = zoom[0] / Math.pow(2, zoom[0]);
        target[0] = target[0] - panStep;
      }

      else if (panDirection === "R"){
        
         panStep = zoom[0] / Math.pow(2, zoom[0]);
         target[0] = target[0] + panStep;
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
          target,
          padding: '1%'
        }
      };

      setXzoom(zoom[0])

      if (prev['genome-positions']) {
        newViewStates['genome-positions'] = {
          ...prev['genome-positions'],
            target: [target[0], prev['genome-positions'].target?.[1] || 0],
          zoom: [zoom[0], prev['genome-positions'].zoom?.[1]]  
        };
      }
      return newViewStates;
    });
    
  }, [zoomAxis, panDirection, hoveredInfo])


  const moveLeftView = useCallback((val) => {
    setViewState((prev) => {
      return {
        ...prev,
        ['ortho']: {
          ...prev['ortho'],
          'target': [prev['ortho'].target[0]- (100/globalBpPerUnit), prev['ortho'].target[1]],
        },
        ['genome-positions']: {
          ...prev['genome-positions'],
          'target': [prev['genome-positions'].target[0]-(100/globalBpPerUnit), prev['genome-positions'].target[1]],
        }
      }
    })
  })

  const moveRightView = useCallback((val) => {
    setViewState((prev) => {
      return {
        ...prev,
      ['ortho']: {
        ...prev['ortho'],
        'target': [prev['ortho'].target[0]+ (100/globalBpPerUnit), prev['ortho'].target[1]],
      },
      ['genome-positions']: {
        ...prev['genome-positions'],
        'target': [prev['genome-positions'].target[0]+ (100/globalBpPerUnit), prev['genome-positions'].target[1]],
      }
    }
  })
  }, [valueRef, globalBpPerUnit])
  
  const changeView = useCallback((val) => {

    let [x0, x1] = [val[0]/globalBpPerUnit, val[1]/globalBpPerUnit];
    const Z = Math.log2((viewPortCoords['ortho']['viewport'].width * globalBpPerUnit) / (val[1] - val[0]))

    setViewState((prev) => {
      return {
        ...prev,
        ['ortho']: {
          ...prev['ortho'],
          'target': [Math.abs(x1)-Math.abs(x0)/2, prev['ortho'].target[1]],
          'zoom': [Z>=1 ? Z : 1, prev['ortho'].zoom[1]],
        },
        ['genome-positions']: {
          ...prev['genome-positions'],
          'target': [Math.abs(x1)-Math.abs(x0)/2, prev['genome-positions'].target[1]],
          'zoom': [Z>=1 ? Z : 1, prev['genome-positions'].zoom[1]],
        }
      }
    })

  }, [valueRef, globalBpPerUnit])

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
      setGlobalBinsIndexes,
      moveLeftView,
      moveRightView,
      changeView
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
    panDirection,
   handleViewStateChange,
   globalBinsIndexes,
   setGlobalBinsIndexes,
   moveLeftView,
   moveRightView,
   changeView
  ]);

  return output;
};

export default useView;
