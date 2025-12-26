import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { debounce } from "lodash";
import { OrthographicView } from "@deck.gl/core";
import { MyOrthographicController, setGlobalControllers, resetGlobalControllers } from "./modules/viewController";
import { INITIAL_VIEW_STATE, getPanStep, panLimit } from "./modules/viewStateUtils";


const useView = ({ config, valueRef, clickedGenomeInfo }) => {

  const { globalBpPerUnit, tsconfig, genomeLength } = config;

  const [zoomAxis, setZoomAxis] = useState("Y");
  const [panDirection, setPanDirection] = useState(null);
  const [xzoom, setXzoom] = useState(window.screen.width < 600 ? -1 : -3);
  const [yzoom, setYzoom] = useState(8);
  const xStopZoomRef = useRef(false);

  const [isRendered, setIsRendered] = useState(false);
  const [genomicValues, setGenomicValues] = useState(valueRef.current);
  
  // Track genomeLength changes properly (refs don't trigger re-renders)
  const [genomeLengthValue, setGenomeLengthValue] = useState(null);
  
  // Update genomeLengthValue when genomeLength.current changes
  useEffect(() => {
    if (genomeLength?.current && genomeLength.current !== genomeLengthValue) {
      setGenomeLengthValue(genomeLength.current);
    }
  }, [genomeLength?.current, genomeLengthValue]);

  // Compute initial state only once genomeLength and globalBpPerUnit are available
  const initialState = useMemo(() => {
    if (!genomeLengthValue || !globalBpPerUnit) return null;

    const initial_position = Math.floor((genomeLengthValue / globalBpPerUnit) / 2);

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
  }, [genomeLengthValue, globalBpPerUnit]);
  
  // Set initial zoom values when initialState is computed
  useEffect(() => {
    if (initialState) {
      setXzoom(INITIAL_VIEW_STATE['ortho'].zoom[0]);
      setYzoom(INITIAL_VIEW_STATE['ortho'].zoom[1]);
    }
  }, [initialState]);

  // Initialize viewState once from computed initialState
  const [viewState, setViewState] = useState(null);

  // Set global controllers for MyOrthographicController - only once on mount
  useEffect(() => {
    setGlobalControllers(setZoomAxis, setPanDirection);
    
    // Cleanup on unmount to prevent stale references
    return () => {
      resetGlobalControllers();
    };
  }, []); // Empty deps - setZoomAxis and setPanDirection are stable

  const [decksize, setDecksize] = useState(null);

  const updateValueRef = useCallback(() => {

    if (!viewState) return;
    // let treeSpacing = 1.03;
    let width = decksize.width;

    let tzoom = viewState['ortho'].zoom[0];
    const W_w = width / (Math.pow(2, tzoom));

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

    if (globalBpPerUnit && decksize && decksize.width) {

      let width = decksize.width;

      let [x0, x1] = [val[0] / globalBpPerUnit, val[1] / globalBpPerUnit];
      let spacing = 0;
      const Z = Math.log2(width / (x1 - x0))
      const target = ((x1 + spacing) + (x0 + spacing)) / 2;

      setXzoom(Z)


      setViewState((prev) => {
        if (!prev) return prev;
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
  }, [globalBpPerUnit, decksize])

  useEffect(() => {

    if (clickedGenomeInfo) {
      changeView([clickedGenomeInfo.s, clickedGenomeInfo.e])
    }
  }, [clickedGenomeInfo])


  const views = useMemo(() => {
    return [
      new OrthographicView({
        x: '5%',
        y: '6%',
        height: '80%',
        width: '95%',
        id: "ortho",
        controller: {
          type: MyOrthographicController,
          scrollZoom: { smooth: true, zoomAxis: zoomAxis },
          dragPan: true,
        },
        initialViewState: INITIAL_VIEW_STATE.ortho
      }),
      new OrthographicView({
        x: '5%',
        y: '4%',
        height: '2%',
        width: '95%',
        id: "genome-info",
        controller: false,
        initialViewState: INITIAL_VIEW_STATE['genome-info']
      }),
      new OrthographicView({
        x: '5%',
        y: '1%',
        height: '3%',
        width: '95%',
        id: "genome-positions",
        controller: false,
        initialViewState: INITIAL_VIEW_STATE['genome-positions']
      }),
      new OrthographicView({
        x: '2%',
        y: '6%',
        height: '80%',
        width: '3%',
        id: "tree-time",
        initialViewState: INITIAL_VIEW_STATE['tree-time']
      })
    ]
  }, [zoomAxis]); // zoomAxis is used in controller config

  const [mouseXY, setMouseXY] = useState(false);

  // Create debounced update function - stable reference
  const debouncedUpdateRef = useMemo(
    () => debounce((newValue) => {
      valueRef.current = newValue;
      setGenomicValues(newValue);
    }, 100),
    [] // valueRef is a ref, stable reference
  );
  
  // Cleanup debounce on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      debouncedUpdateRef.cancel();
    };
  }, [debouncedUpdateRef]);

  const lastAppliedConfigRef = useRef(null);

  // Effect to apply initial view from config (URL params)
  useEffect(() => {
    if (!tsconfig || !decksize?.width || !viewState) return;

    if (tsconfig !== lastAppliedConfigRef.current) {
      if (tsconfig.value) {
        changeView(tsconfig.value);
      }
      lastAppliedConfigRef.current = tsconfig;
    }
  }, [tsconfig, decksize?.width, changeView, viewState])

  // Effect to update refs when viewState changes (panning/zooming)
  useEffect(() => {
    if (!viewState) return;
    const newValue = updateValueRef();
    newValue && debouncedUpdateRef(newValue);
  }, [viewState, updateValueRef, debouncedUpdateRef])


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

  const handleViewStateChange = useCallback(({ viewState: newViewState, viewId, oldViewState }) => {
    if (!viewId || !newViewState) return;


    setViewState((prev) => {
      let zoom = [...oldViewState?.zoom];
      let target = [...oldViewState?.target] || [0, 0];
      let panStep = 0;
      if (panDirection === null) {
        if (zoomAxis === 'Y') {
          // zoom[1] = newViewState.zoom[1] <= maxZoom ? newViewState.zoom[1] : maxZoom;
          zoom[1] = newViewState.zoom[1];
          // target[1] = zoom[1] >= maxZoom ? oldViewState.target[1] : newViewState.target[1]; 
          target[1] = newViewState.target[1];
          zoom[0] = oldViewState.zoom[0];
          target[0] = oldViewState.target[0];
        }
        else if (zoomAxis == 'X') {
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
      } else if (panDirection === "L") {
        panStep = getPanStep({ zoomX: zoom[0], baseStep: 8, sensitivity: zoom[0] >= 8 || zoom[0] < 0 ? 0.9 : 0.7 })
        target[0] = target[0] - panStep;
      }

      else if (panDirection === "R") {
        panStep = getPanStep({ zoomX: zoom[0], baseStep: 8, sensitivity: zoom[0] >= 8 || zoom[0] < 0 ? 0.9 : 0.7 })
        target[0] = target[0] + panStep;
      }

      else {
        zoom = newViewState.zoom
        target = [newViewState.target[0], oldViewState.target[1]]
      }

      if (target[0] < 0) {
        target = [...oldViewState.target];
      }
      if (target[0] > genomeLength.current / globalBpPerUnit) {
        target = [...oldViewState.target];
      }

      if (target.length > 0 && oldViewState.target.length > 0) {
        target = panLimit(target, [...oldViewState.target], genomeLength.current, globalBpPerUnit);
      }

      // bound y-limit
      if (target[1] < 0 || target[1] > 1) {
        target[1] = oldViewState.target[1];
        zoom[1] = oldViewState.zoom[1];
      }
      // console.log("target", target, zoom);
      const W_w = newViewState.width / (Math.pow(2, zoom[0]));

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
      setYzoom(zoom[1])
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

  }, [zoomAxis, panDirection, globalBpPerUnit, genomeLength])

  const panInterval = useRef(null);

  const viewReset = useCallback(() => {
    setViewState(prev => (
      {
        ...prev,
        'ortho': {
          ...prev['ortho'],
          zoom: [prev['ortho'].zoom[0], INITIAL_VIEW_STATE['ortho'].zoom[1]],
          target: [prev['ortho'].target[0], INITIAL_VIEW_STATE['ortho'].target[1]]
        },
        'genome-positions': {
          ...prev['genome-positions'],
          zoom: [prev['genome-positions'].zoom[0], INITIAL_VIEW_STATE['genome-positions'].zoom[1]],
          target: [prev['genome-positions'].target[0], INITIAL_VIEW_STATE['genome-positions'].target[1]]
        },
        'tree-time': {
          ...prev['tree-time'],
          zoom: [prev['tree-time'].zoom[0], INITIAL_VIEW_STATE['tree-time'].zoom[1]],
          target: [prev['tree-time'].target[0], INITIAL_VIEW_STATE['tree-time'].target[1]]
        },
        'genome-info': {
          ...prev['genome-info'],
          zoom: [prev['genome-info'].zoom[0], INITIAL_VIEW_STATE['genome-info'].zoom[1]],

          target: [prev['genome-info'].target[0], INITIAL_VIEW_STATE['genome-info'].target[1]]
        }
      }
    ));

    setYzoom(INITIAL_VIEW_STATE['ortho'].zoom[1])

  }, []); // No deps needed - only uses setViewState and setYzoom which are stable

  const startPan = useCallback((direction) => {
    if (panInterval.current) return;
    const stepDir = direction === 'L' ? -1 : 1;
    panInterval.current = setInterval(() => {
      setViewState(prev => {
        const zoom = prev['ortho'].zoom[0];
        const panStep = getPanStep({ zoomX: zoom, baseStep: 8, sensitivity: zoom >= 8 || zoom < 0 ? 0.9 : 0.7 })
        const delta = panStep * stepDir;
        let new_target = [...prev['ortho'].target];
        new_target[0] += delta;
        new_target = panLimit(new_target, prev['ortho'].target, genomeLength.current, globalBpPerUnit);

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

  // Memoize output object - only include values that change
  // Note: React setState functions are stable and don't need to be in deps
  const output = useMemo(() => ({
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
    genomicValues,
    yzoom,
    setYzoom
  }), [
    viewState,
    views,
    zoomAxis,
    xzoom,
    mouseXY,
    handleViewStateChange,
    changeView,
    startPan,
    stopPan,
    decksize,
    viewReset,
    genomicValues,
    yzoom
  ]);

  return output;
};

export default useView;
