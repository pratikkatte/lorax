import { CompositeLayer } from '@deck.gl/core';
import { TextLayer } from '@deck.gl/layers';

// Pre-create a number formatter (much faster than toLocaleString)
const NUMBER_FORMAT_OPTIONS = { maximumFractionDigits: 0 };
const numberFormatter = new Intl.NumberFormat("en-US", NUMBER_FORMAT_OPTIONS);

/**
 * GenomeGridLayer - Renders coordinate labels for genome positions view
 */
export class GenomeGridLayer extends CompositeLayer {
  static layerName = 'GenomeGridLayer';
  static defaultProps = {
    data: [],
    y0: 0,
    y1: 2,
    labelOffset: 0.05,
    getColor: [100, 100, 100, 100],
    getTextColor: [60, 60, 60, 255],
    viewId: null,
    globalBpPerUnit: null,
    text_color: [0, 10, 0, 255],
  };

  renderLayers() {
    const { data, viewId, globalBpPerUnit, text_color } = this.props;

    if (!data?.length) return [];

    // Cache globalBpPerUnit for the accessor
    const bpPerUnit = globalBpPerUnit;

    return [
      new TextLayer({
        id: `${this.props.id}-labels`,
        data,
        getPosition: d => [d / bpPerUnit, 1],
        getText: d => numberFormatter.format(d),
        getColor: text_color,
        sizeUnits: 'pixels',
        getSize: 12,
        viewId,
        pickable: false,
        updateTriggers: {
          getPosition: [bpPerUnit],
          getText: [bpPerUnit],
        },
        zOffset: -1,
      })
    ];
  }
}
