import {CompositeLayer} from '@deck.gl/core';
import {LineLayer, TextLayer} from '@deck.gl/layers';

    // INSERT_YOUR_CODE
    // Densify the data array by inserting additional points between each pair
function densifyData(data, y0, y1) {
    let densifiedData = [];
    if (Array.isArray(data) && data.length > 1) {
        for (let i = 0; i < data.length - 1; i++) {
        const d1 = data[i];
        const start = d1.start;
        const end = d1.end;

        const nbins = (end - start) >=5000 ? 10 : 5;
        
        densifiedData.push(d1);
        for (let j = 1; j <= nbins; j++) {
            const t = j / (nbins);
            
            const newData = {
                sourcePosition: [d1.sourcePosition[0] + (t), y0],
                targetPosition: [d1.targetPosition[0] + (j / (nbins)), y1],
            }
            densifiedData.push(newData);
        }
    }

        // densifiedData.push(data[data.length - 1]);
    } else {
        densifiedData = data;
    }
    return densifiedData;
    }

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
    viewId: null
  };

  

  renderLayers() {
    
    const {
      data, y0, y1, labelOffset,
      getColor, getTextColor, getText,
      modelMatrix, viewId, showLabels
    } = this.props;

    // Accessors that gracefully fall back to i-based positions if not provided
    const getX = d => (d.sourcePosition ? d.sourcePosition[0] : d.i);

    let densifiedData = densifyData(data, y0, y1);


      
    return [
      new LineLayer({
        id: `${this.props.id}-lines`,
        data: data,
        getSourcePosition: d => d.sourcePosition ?? [getX(d), y0],
        getTargetPosition: d => d.targetPosition ?? [getX(d), y1],
        getColor,
        // modelMatrix,
        viewId,
        pickable: false,
        updateTriggers: {
          getSourcePosition: [y0],
          getTargetPosition: [y1],
          getColor
        }
      }),
      showLabels &&
        new TextLayer({
          id: `${this.props.id}-labels`,
          data,
          getPosition: d => [getX(d), 1],
          getText,
          getColor: getTextColor,
          sizeUnits: 'pixels',
          getSize: 9,
          // billboard: true,
          // modelMatrix,
          viewId,
          pickable: false,
          background: false,
          updateTriggers: {
            getPosition: [y1, labelOffset],
            getText,
            getColor: getTextColor
          }
        })
    ].filter(Boolean);
  }
}
