import {CompositeLayer} from '@deck.gl/core';
import {LineLayer, TextLayer} from '@deck.gl/layers';
import {DataFilterExtension} from '@deck.gl/extensions';


export class GenomeInfoLayer extends CompositeLayer {
  static defaultProps = {
    data: [],
    y0: 0,
    y1: 2,
    labelOffset: 0.05,             // offset above the line (in view coords)
    getColor: [100, 100, 100, 100],
    getTextColor: [60, 60, 60, 255],
    getText: d => `${d.start}`,     // label content
    showLabels: true,
    viewId: null,
    backend: null,
    globalBpPerUnit: null,
    xzoom: null,
    filterRange: null,
  };

  renderLayers() {
    
    const {
      data, y0, y1,
      getColor, viewId, showLabels, globalBpPerUnit, filterRange
    } = this.props;
    
    if (!Object.keys(data).length) return [];

    return [
      new LineLayer({
      id: `${this.props.id}-lines`,
      // data: Object.values(data).map(d => d.s),
      data: data,
      getSourcePosition: d => [d.position / globalBpPerUnit, y0],
      // getSourcePosition: d => {
        
      //   const pos = [d / globalBpPerUnit, y0];
      //   return pos;
      // },
      getTargetPosition: d => [d.position /globalBpPerUnit, y1],
      getColor,
      viewId,
      pickable: false,
      getFilterValue: d => d.position,
      filterRange,
      extensions: [new DataFilterExtension({filterSize: 1})],
      zOffset: -1,
    }),
  ].filter(Boolean);  }
}
