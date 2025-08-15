import { useState, useMemo, useCallback, useEffect } from "react";
import {
  OrthographicView,
  OrthographicController,
  //OrthographicViewport,
} from "@deck.gl/core";

let globalSetZoomAxis = () => {};


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

const useView = ({settings, setSettings}) => {
  const [zoomAxis, setZoomAxis] = useState("Y");

  const maxZoom = 17;

  useEffect(() => {
    console.log("settings updated", settings,settings.vertical_mode)
  }, [settings])

  const INITIAL_VIEW_STATE = {
    'genome_positions':{
      target:settings.vertical_mode ?  [1,2]:[3,1],
      zoom: [8,8],
      minZoom: 7,
    },
    'tree-time':{
      target:settings.vertical_mode? [0,0.5]:[0.5 ,0],
      zoom: [8,8],
      minZoom: 7,
      
    },
    'ortho': {
      target:settings.vertical_mode? [0,2]:[3,0],
      zoom: [8,8],
      minZoom: 7,
      
    }
  }

  const [xzoom, setXzoom] = useState(window.screen.width < 600 ? -1 : 0);
  
  globalSetZoomAxis = setZoomAxis;

  const [viewState, setViewState] = useState({
    // target: [0, 0, 0],
    // zoom: 6,
    'ortho': INITIAL_VIEW_STATE['ortho'],
    'genome-positions': INITIAL_VIEW_STATE['genome_positions'],
    'tree-time': INITIAL_VIEW_STATE['tree-time']
  });
  
  useEffect(() => {
    setViewState({
      'ortho': INITIAL_VIEW_STATE['ortho'],
    'genome-positions': INITIAL_VIEW_STATE['genome_positions'],
    'tree-time': INITIAL_VIEW_STATE['tree-time']
    })
  }, [settings])

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
    settings
  ]);

  const [mouseXY, setMouseXY] = useState(false);
  
  const handleViewStateChange = useCallback(({viewState:newViewState, viewId, oldViewState, basicTarget, overrideZoomAxis}) => {
    if (!viewId || !newViewState) return;

    setViewState((prev) => {
      let zoom = [...oldViewState.zoom];
      let target = [...oldViewState.target];

      let genome_position_view = prev['genome-positions'] || {};
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

      else {
        zoom = newViewState.zoom
        target = [newViewState.target[0], oldViewState.target[1]]
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

      if (prev['tree-time']) {
        newViewStates['tree-time'] = {
          ...prev['tree-time'],
          // target: [target[0], prev['tree-time'].target?.[1] || 0],
          target: settings.vertical_mode? [target[0], prev['tree-time'].target?.[1] || 0]: [prev['tree-time'].target?.[0] || 0, target[1]],
          // zoom: [zoom[0], prev['tree-time'].zoom?.[1], ]  
          zoom: settings.vertical_mode ? [zoom[0], prev['tree-time'].zoom?.[1]] : [prev['tree-time'].zoom?.[0], zoom[1]]
        }
      }

      return newViewStates;
    });
    
  }, [zoomAxis, settings])

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
      handleViewStateChange
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
    settings,
   handleViewStateChange
  ]);

  return output;
};

export default useView;
