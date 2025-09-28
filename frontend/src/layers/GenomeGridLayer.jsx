import {CompositeLayer} from '@deck.gl/core';
import {LineLayer, TextLayer} from '@deck.gl/layers';
import memoizeOne from 'memoize-one';

export class GenomeGridLayer extends CompositeLayer {
  static defaultProps = {
    localCoordinates: [],
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

  renderLayers() {
    
    const {
      data, y0, y1,
      getColor, viewId, showLabels, globalBpPerUnit, localCoordinates
    } = this.props;

    if (!Object.keys(data).length) return [];



    return [
      new LineLayer({
      id: `${this.props.id}-lines`,
      data: Object.values(data).map(d => d.acc),
      getSourcePosition: d => {
        const pos = [d / globalBpPerUnit, y0];
        return pos;
      },
      getTargetPosition: d => [d /globalBpPerUnit, y1],
      getColor,
      viewId,
      pickable: false
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
          data: localCoordinates,
          getPosition: [globalBpPerUnit],
          getText: [localCoordinates]   
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
