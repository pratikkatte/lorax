import { OrthographicController } from "@deck.gl/core";

let globalSetZoomAxis = () => {};
let globalPanDirection = () => {};

export const setGlobalControllers = (setZoomAxis, setPanDirection) => {
    globalSetZoomAxis = setZoomAxis;
    globalPanDirection = setPanDirection;
};

export class MyOrthographicController extends OrthographicController {
  
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
