// TreeLayer.jsx
import { CompositeLayer } from '@deck.gl/core';
import { PathLayer } from '@deck.gl/layers';

export default class TreeLayer extends CompositeLayer {
  static layerName = 'TreeLayer';

  static defaultProps = {
    data: [],
    getPath: d => d.path,        // accessor for path coordinates
    getColor: d => [0, 0, 0, 255],
    getWidth: 2,
    pickable: true,
    parameters: {}
  };

  renderLayers() {
    const { data, getPath, getColor, getWidth, pickable, parameters } = this.props;

    return new PathLayer({
      id: `${this.props.id || 'tree'}-path-layer`,
      data,
      getPath,
      getColor,
      getWidth,
      pickable,
      parameters
    });
  }
}
