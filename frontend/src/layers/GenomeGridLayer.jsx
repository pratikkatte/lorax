import {CompositeLayer} from '@deck.gl/core';
import {TextLayer} from '@deck.gl/layers';


export class GenomeGridLayer extends CompositeLayer {
  static defaultProps = {
    data: [],
    y0: 0,
    y1: 2,
    labelOffset: 0.05,             // offset above the line (in view coords)
    getColor: [100, 100, 100, 100],
    getTextColor: [60, 60, 60, 255],
    getText: d => `${d.start}`,     // label content
    viewId: null,
    globalBpPerUnit: null,
  };

  renderLayers() {
    
    const {
      data, viewId, globalBpPerUnit, localCoordinates
    } = this.props;

    if (!Object.keys(data).length) return [];

    return [
      new TextLayer({
        id: `${this.props.id}-labels`,
        data: data,
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
        },
        zOffset: -1,
      })
    ].filter(Boolean);
  }
}
