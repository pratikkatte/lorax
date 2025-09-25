import {CompositeLayer} from '@deck.gl/core';
import {LineLayer, TextLayer} from '@deck.gl/layers';
import memoizeOne from 'memoize-one';

export class GenomeGridLayer extends CompositeLayer {
  static defaultProps = {
    data: [],
    y0: 0,
    y1: 2,
    labelOffset: 0.05,             // offset above the line (in view coords)
    getColor: [100, 100, 100, 100],
    getTextColor: [60, 60, 60, 255],
    getText: d => `${d.start}`,     // label content
    showLabels: true,
    modelMatrix: null,
    viewId: null,
    globalBins: [],
    backend: null,
    globalBpPerUnit: null,
    xzoom: null
  };

  initializeState() {
    this._localBins = [];
    this._lastStart = null;
    this._lastEnd = null;
  }

niceStep(step) {
    // round step to a "nice" number (1, 2, or 5 × 10^n)
    const exp = Math.floor(Math.log10(step));
    const base = Math.pow(10, exp);
    const multiples = [1, 2, 5, 10];
  
    let nice = multiples[0] * base;
    for (let m of multiples) {
      if (step <= m * base) {
        nice = m * base;
        break;
      }
    }
    return nice;
  }
  
  getLocalCoordinates(lo, hi) {
    const range = hi - lo;
    const divisions = range > 1000 ? 5 : 10;
  
    const rawStep = range / divisions;
    const stepSize = this.niceStep(rawStep);  // round to nice step
  
    // Align the first tick at the nearest multiple of stepSize >= lo
    const start = Math.ceil(lo / stepSize) * stepSize;
    const end   = Math.floor(hi / stepSize) * stepSize;
  
    let coordinates = [];
    for (let x = start; x <= end; x += stepSize) {
      coordinates.push({ x, y: 0, text: x });
    }
  
    return coordinates;
  }
  


  getLocalData(data, globalBins) {
    if (!Array.isArray(data) || data.length < 2) {
      return [];
    }
    if (!globalBins || globalBins.length === 0) {
      return [];
    }
  
    const start = data[0];
    const end = data[1];
    if (typeof start !== "number" || typeof end !== "number") {
      console.warn("GenomeGridLayer: data is not [start, end]", data);
      return [];
    }

    const buffer = 0.5;
    const bufferStart = Math.max(0, start - (start* buffer));
    const bufferEnd = Math.min(globalBins.length - 1, end + (end* buffer));
  
    // First time or empty cache → slice directly
    if (this._lastStart == null || this._lastEnd == null) {
    
      this._localBins = globalBins.slice(start, end + 1);
      // if (start == 0) {
      //   this._localBins.unshift({s: 0, e: 0, acc: 0});
      // }
      // if (end == globalBins.length - 1) {
      //   this._localBins.push({s: globalBins[globalBins.length - 1].e, e: globalBins[globalBins.length - 1].e, acc: globalBins[globalBins.length - 1].acc});
      // }
    } else {
      const prevStart = this._lastStart;
      const prevEnd = this._lastEnd;
  
      if (bufferEnd < prevStart || bufferStart > prevEnd) {
        // no overlap, reset
        this._localBins = globalBins.slice(start, end + 1);
      } else {
        // adjust left
        if (bufferStart > prevStart) {
          this._localBins.splice(0, bufferStart - prevStart);
        } else if (bufferStart < prevStart) {
          this._localBins.unshift(...globalBins.slice(bufferStart, prevStart));
        }
  
        // adjust right
        if (bufferEnd > prevEnd) {
          this._localBins.push(...globalBins.slice(prevEnd + 1, bufferEnd + 1));
        } else if (bufferEnd < prevEnd) {
          this._localBins.splice(this._localBins.length - (prevEnd - bufferEnd), prevEnd - bufferEnd);
        }
      }
    }
  
    this._lastStart = bufferStart;
    this._lastEnd = bufferEnd;

    return this._localBins;
  }
  

  renderLayers() {
    
    const {
      data, y0, y1, labelOffset,
      getColor, getTextColor, getText,
      modelMatrix, viewId, showLabels, globalBins, globalBpPerUnit, value, xzoom
    } = this.props;


    const localBins = this.getLocalData(data, globalBins); // precomputed once

    
    const localCoordinates = this.getLocalCoordinates(value[0], value[1]);
    console.log("localCoordinates", localCoordinates)

    if (!localBins.length) return [];

    return [
      new LineLayer({
      id: `${this.props.id}-lines`,
      data: localBins,
      getSourcePosition: d => [d.acc/globalBpPerUnit, y0],
      getTargetPosition: d => [d.acc/globalBpPerUnit, y1],
      getColor,
      viewId,
      pickable: false,
      updateTriggers: {
        getSourcePosition: [y0],
        getTargetPosition: [y1],
        data,
        globalBins,
        localBins
      }
    }),
    showLabels &&
      new TextLayer({
        id: `${this.props.id}-labels`,
        data: localCoordinates,
        getPosition: d => [d.x/globalBpPerUnit, 1],
        getText: d => d.text.toLocaleString("en-US", { maximumFractionDigits: 0 }),
        getColor: [0,10,0,255],
        sizeUnits: 'pixels',
        getSize: 12,
        viewId,
        pickable: false,
        updateTriggers: {
          data: [localCoordinates]
        }
      })
    ].filter(Boolean);
    // return [
    //   new LineLayer({
    //     id: `${this.props.id}-lines`,
    //     data: data ? data.flatMap(d => {
    //       if (d.visibility) {
    //         const globalBin = globalBins[d.global_index];
    //         return [{
    //           ...globalBin,
    //           start: globalBin.s,
    //           end: globalBin.e,
    //           sourcePosition: [globalBin?.acc, y0],
    //           targetPosition: [globalBin?.acc, y1]
    //         }];
    //       } else {
    //         // If d.trees_index is an array of indices to globalBins, return a line for each skip
    //         if (d.trees_index && d.trees_index.length > 0) {

    //           return d.trees_index.map(idx => {
    //             const globalBin = globalBins[idx];
    //             return {
    //               ...globalBin,
    //               start: globalBin?.s,
    //               end: globalBin?.e,
    //               sourcePosition: [globalBin?.acc, y0],
    //               targetPosition: [globalBin?.acc, y1]
    //             };
    //           });
    //         }
    //         else {
    //         }
    //       }
    //     }) : [],
    //     getSourcePosition: d => d.sourcePosition ?? [getX(d), y0],
    //     getTargetPosition: d => d.targetPosition ?? [getX(d), y1],
    //     getColor,
    //     // modelMatrix,
    //     viewId,
    //     pickable: false,
    //     updateTriggers: {
    //       getSourcePosition: [y0],
    //       getTargetPosition: [y1],
    //       getColor,
    //       data,
    //       globalBins
    //     }
    //   }),
    //   showLabels &&
    //     new TextLayer({
    //       id: `${this.props.id}-labels`,
    //       data,
    //       getPosition: d => [getX(d), 1],
    //       getText,
    //       getColor: getTextColor,
    //       sizeUnits: 'pixels',
    //       getSize: 9,
    //       // billboard: true,
    //       // modelMatrix,
    //       viewId,
    //       pickable: false,
    //       background: false,
    //       updateTriggers: {
    //         getPosition: [y1, labelOffset],
    //         getText,
    //         getColor: getTextColor,
    //         data,
    //         globalBins
    //       }
    //     })
    // ].filter(Boolean);
  }
}
