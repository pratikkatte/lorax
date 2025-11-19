import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { debounce } from "lodash";
import {
  OrthographicView,
  OrthographicController,
} from "@deck.gl/core";

let globalSetZoomAxis = () => {};
let globalPanDirection = () => {};

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

const INITIAL_VIEW_STATE = {
  'genome-positions':{
    target: [0,1],
    zoom: [-3,8],
    // minZoom: 1,
  },
  'genome-info':{
    target: [0,1],
    zoom: [-3,8],
    // minZoom: 1,
  },
  'tree-time':{
    target: [0.5 ,0],
    zoom: [0,8],
    // minZoom: 1,
  },
  'ortho': {
    target: [0,0],
    zoom: [-3,8],
    // minZoom: 1,
  }
}

  const useView = ({ config, valueRef, clickedGenomeInfo}) => {

    
  const {globalBpPerUnit, tsconfig, genomeLength} = config;

  const [zoomAxis, setZoomAxis] = useState("Y");
  const [panDirection, setPanDirection] = useState(null);
  const [xzoom, setXzoom] = useState(window.screen.width < 600 ? -1 : -3);
  const xStopZoomRef = useRef(false);

  const [isRendered, setIsRendered] = useState(false);
  const [genomicValues, setGenomicValues] = useState(valueRef.current);

// Compute initial state only once genomeLength and globalBpPerUnit are available
const initialState = useMemo(() => {
  if (!genomeLength.current || !globalBpPerUnit) return null;

  const initial_position = Math.floor((genomeLength.current / globalBpPerUnit) / 2);

  return {
    'ortho': {
      ...INITIAL_VIEW_STATE['ortho'],
      target: [initial_position, 0],
    },
    'genome-positions': {
      ...INITIAL_VIEW_STATE['genome-positions'],
      target: [initial_position, 1],
    },
    'genome-info': {
      ...INITIAL_VIEW_STATE['genome-info'],
      target: [initial_position, 1],
    },
    'tree-time': INITIAL_VIEW_STATE['tree-time'],
  };
}, [genomeLength.current, globalBpPerUnit]);



// Initialize viewState once from computed initialState
const [viewState, setViewState] = useState(null);

  globalSetZoomAxis = setZoomAxis;
  globalPanDirection = setPanDirection;

  const maxZoom = 17;

  const [decksize, setDecksize] = useState(null);

  const updateValueRef = useCallback(() => {

    if (!viewState) return;
        // let treeSpacing = 1.03;
    let width = decksize.width;

    let tzoom = viewState['ortho'].zoom[0];
    const W_w = width/ (Math.pow(2, tzoom));

    let x0 = viewState['genome-positions'].target[0] - (W_w / 2);
    let x1 = viewState['genome-positions'].target[0] + (W_w / 2);
  
    if (globalBpPerUnit) {
      const newValue = [
        Math.max(0, Math.round((x0) * globalBpPerUnit)),
        Math.max(0, Math.round((x1) * globalBpPerUnit))
      ];
      if (newValue[0] <= 0 && (newValue[1] > genomeLength.current)) {
        xStopZoomRef.current = true;
      } else {
        xStopZoomRef.current = false;
      }       
      return newValue;
    }
  }, [globalBpPerUnit, viewState, tsconfig]);

  const changeView = useCallback((val) => {
  
    if (!val) return;
    
    if (globalBpPerUnit && decksize.width) {

      let width = decksize.width;
      
      let [x0, x1] = [val[0]/globalBpPerUnit, val[1]/globalBpPerUnit];
      let spacing = 0;
      const Z = Math.log2(width / (x1 - x0))
      const target = ((x1+spacing)+(x0+spacing))/2;

      setXzoom(Z)
      setViewState((prev) => {      
        return {
          ...prev,
          ['ortho']: {
            ...prev['ortho'],
           'target': [target, prev['ortho'].target[1]],
            'zoom': [Z, prev['ortho'].zoom[1]],
          },
          ['genome-positions']: {
            ...prev['genome-positions'],
            'target': [target, prev['genome-positions'].target[1]],
            'zoom': [Z, prev['genome-positions'].zoom[1]],
          },
          ['genome-info']: {
            ...prev['genome-info'],
            'target': [target, prev['genome-info'].target[1]],
            'zoom': [Z, prev['genome-info'].zoom[1]],
          },
        }
      })
      
    }
  }, [globalBpPerUnit, viewState, decksize])

  useEffect(() => {

    if (clickedGenomeInfo) {
    console.log("clickedGenomeInfo useView", clickedGenomeInfo)

    changeView([clickedGenomeInfo.s, clickedGenomeInfo.e])
    }
  }, [clickedGenomeInfo])


  const views = useMemo(() => {
    return [
        new OrthographicView({
          x: '5%',
          y: '6%',
          height: '80%',
          width:'95%',
          id: "ortho",
          controller: {
            type: MyOrthographicController,
            scrollZoom: { smooth: true, zoomAxis: zoomAxis },
            dragPan:true,
          },
          initialViewState: INITIAL_VIEW_STATE.ortho
        }),
        new OrthographicView({
          x: '5%',
          y: '4%',
          height: '2%',
          width: '95%',
          id: "genome-info",
          controller:false,
          initialViewState: INITIAL_VIEW_STATE['genome-info']
        }),
        new OrthographicView({
          x: '5%',
          y: '1%',
          height: '3%',
          width: '95%',
          id: "genome-positions",
          controller:false,
          initialViewState: INITIAL_VIEW_STATE['genome-positions']
        }),
        new OrthographicView({
          x: '2%',
          y: '6%',
          height: '80%',
          width: '3%',
          id: "tree-time",
          // controller:false,
          initialViewState: INITIAL_VIEW_STATE['tree-time']
        }),
      ]}, [tsconfig]);

  const [mouseXY, setMouseXY] = useState(false);

  const debouncedUpdateRef = useMemo(
    () => debounce((newValue) => {
        valueRef.current = newValue;
        setGenomicValues(newValue);
      }, 
      100 // Adjust this delay (in milliseconds) to control frequency
    ),
    []
  );
  
  useEffect(() => {
    if (!tsconfig) return;

    if (tsconfig?.value && !valueRef.current){
      changeView(tsconfig.value);
    }else{
      const newValue = updateValueRef();
      newValue && debouncedUpdateRef(newValue);
    }
  }, [viewState, tsconfig])


  useEffect(() => {
    if (!decksize) return;

    if (isRendered) return;
    setViewState(prev => {
      return {
        ...prev,
        ...initialState
    };
  });
  setIsRendered(true); 
  }, [decksize])

  function getPanStep({zoomX, baseStep = 8, sensitivity = 0.5}) {

    if (zoomX < 0) {
      // 2. Increase baseStep by the magnitude of the negative zoomX
      // e.g., if zoomX is -4, the multiplier is 4+1 = 5
      baseStep = baseStep * (Math.abs(zoomX)/2 + 1);
    }

    return baseStep / Math.pow(2, zoomX * sensitivity);
  }
  
  const panLimit = useCallback((target, oldTarget) => {
    if (target[0] < 0){
      return oldTarget;
    }
    if (target[0] > genomeLength.current/globalBpPerUnit){
      return oldTarget;
    }
    return target;
  }, [genomeLength, globalBpPerUnit]);



  const handleViewStateChange = useCallback(({viewState:newViewState, viewId, oldViewState}) => {
    if (!viewId || !newViewState) return;

    
    setViewState((prev) => {
      let zoom = [...oldViewState.zoom];
      let target = [...oldViewState.target];
      let panStep = 0;
      if(panDirection === null) { 
        if(zoomAxis==='Y'){
          // zoom[1] = newViewState.zoom[1] <= maxZoom ? newViewState.zoom[1] : maxZoom;
          zoom[1] = newViewState.zoom[1];
          // target[1] = zoom[1] >= maxZoom ? oldViewState.target[1] : newViewState.target[1]; 
          target[1] = newViewState.target[1];
          zoom[0] = oldViewState.zoom[0];
          target[0] = oldViewState.target[0];
        }
        else if (zoomAxis=='X') {
          if (xStopZoomRef.current) {
            zoom[0] = oldViewState.zoom[0];
          } else {
          // zoom[0] = newViewState.zoom[0] <= maxZoom ? newViewState.zoom[0] : maxZoom; 
          zoom[0] = newViewState.zoom[0];
        }
        // target[0] = zoom[0] >= maxZoom ? oldViewState.target[0] : newViewState.target[0]; 
        target[0] = newViewState.target[0];
          zoom[1] = oldViewState.zoom[1];
          target[1] = oldViewState.target[1];
        }
      } else if (panDirection === "L"){
        panStep = getPanStep({zoomX: zoom[0], baseStep: 8, sensitivity: zoom[0] >= 8 || zoom[0] < 0 ? 0.9 : 0.7})
        target[0] = target[0] - panStep;
      }

      else if (panDirection === "R"){
        panStep = getPanStep({zoomX: zoom[0], baseStep: 8, sensitivity: zoom[0] >= 8 || zoom[0] < 0 ? 0.9 : 0.7})
         target[0] = target[0] + panStep;
      }
      
      else {
        zoom = newViewState.zoom
        target = [newViewState.target[0], oldViewState.target[1]]
      }

      if (target[0] < 0){
        target = [...oldViewState.target];
      }
      if (target[0] > genomeLength.current/globalBpPerUnit){
        target = [...oldViewState.target];
      }

      if (target.length > 0 && oldViewState.target.length > 0) {
        target = panLimit(target,[...oldViewState.target]);
      }
      const W_w = newViewState.width/ (Math.pow(2, zoom[0]));

      let x0 = target[0] - W_w / 2;
      let x1 = target[0] + W_w / 2;
      let xstop = false;
      if (globalBpPerUnit) {
        const newValue = [
          Math.max(0, Math.round((x0) * globalBpPerUnit)),
          Math.max(0, Math.round((x1) * globalBpPerUnit))
        ];
        if (newValue[0] <= 0 && (newValue[1] > genomeLength.current)) {
          xstop = true;
        }
      }
      if (xstop) {
        zoom[0] = oldViewState.zoom[0];
      } 

      const newViewStates = {
        ...prev,
        [viewId]: {
          ...prev[viewId],
          zoom,
          target,
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
      if (prev['genome-info']) {
        newViewStates['genome-info'] = {
          ...prev['genome-info'],
          target: [target[0], prev['genome-info'].target?.[1] || 0],
          zoom: [zoom[0], prev['genome-info'].zoom?.[1]]  
        };
      }
      if (prev['tree-time']) {
        newViewStates['tree-time'] = {
          ...prev['tree-time'],
          target: [prev['tree-time'].target?.[0], target[1]],
          zoom: [prev['tree-time'].zoom?.[1], zoom[1]]  
        };
      }

      return newViewStates;
    });
    
  }, [zoomAxis, panDirection, tsconfig, xStopZoomRef, decksize, genomicValues])

  const panInterval = useRef(null);

  const viewReset = useCallback(() => {
    setViewState(prev => (
      {
      ...prev,
      'ortho': {
        ...prev['ortho'],
        zoom: INITIAL_VIEW_STATE['ortho'].zoom,
        target: [prev['ortho'].target[0], INITIAL_VIEW_STATE['ortho'].target[1]]
      },
      'genome-positions': {
        ...prev['genome-positions'],
        zoom: INITIAL_VIEW_STATE['genome-positions'].zoom,
        target: [prev['genome-positions'].target[0], INITIAL_VIEW_STATE['genome-positions'].target[1]]
      },
      'tree-time': {
        ...prev['tree-time'],
        zoom: INITIAL_VIEW_STATE['tree-time'].zoom,
        target: [prev['tree-time'].target[0], INITIAL_VIEW_STATE['tree-time'].target[1]]
      },
      'genome-info': {
        ...prev['genome-info'],
        zoom: INITIAL_VIEW_STATE['genome-info'].zoom,
        target: [prev['genome-info'].target[0], INITIAL_VIEW_STATE['genome-info'].target[1]]
      }
    }
  ));
  }, [viewState]);
  



const startPan = useCallback((direction) => {
  if (panInterval.current) return;
  const stepDir = direction === 'L' ? -1 : 1;
  panInterval.current = setInterval(() => {
    setViewState(prev => {
      const zoom = prev['ortho'].zoom[0];
      const panStep = getPanStep({zoomX: zoom, baseStep: 8, sensitivity: zoom >= 8 || zoom < 0 ? 0.9 : 0.7})
      const delta = panStep * stepDir;
      let new_target = [...prev['ortho'].target];
      new_target[0] += delta;
      new_target = panLimit(new_target, prev['ortho'].target);
      
      return {
        ...prev,
        ['ortho']: { ...prev['ortho'], target: new_target },
        ['genome-positions']: {
          ...prev['genome-positions'],
          target: [new_target[0], prev['genome-positions'].target[1]],
        },
        ['genome-info']: {
          ...prev['genome-info'],
          target: [new_target[0], prev['genome-info'].target[1]],
        },
      };
    });
  }, 16); // ~60 FPS
}, []);

const stopPan = useCallback(() => {
  clearInterval(panInterval.current);
  panInterval.current = null;
}, []);

  const output = useMemo(() => {
    return {
      viewState,
      setViewState,
      views,
      zoomAxis,
      setZoomAxis,
      xzoom,
      setMouseXY,
      mouseXY,
      handleViewStateChange,
      changeView,
      startPan,
      stopPan,
      decksize,
      setDecksize,
      viewReset,
      genomicValues
    };
  }, [
    viewState,
    setViewState,
    views,
    zoomAxis,
    setZoomAxis,
    xzoom,
    setMouseXY,
    mouseXY,
    panDirection,
   handleViewStateChange,
   changeView,
   startPan,
   stopPan,
   decksize,
   setDecksize,
   viewReset,
   genomicValues
  ]);

  return output;
};

export default useView;
