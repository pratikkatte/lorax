import { useCallback, useMemo, useState, useEffect } from "react";

const genomeCoordinates = ({
  viewState,
  config,
  viewportSize,
  setViewState
}) => {

    let viewportHeight = viewportSize ? viewportSize[1] : null;
    let viewportWidth = viewportSize ? viewportSize[0] : null;
    // if (genomeViewport) {
    //     viewportHeight = genomeViewport?.height;
    //     viewportWidth = genomeViewport?.width;
    //     console.log("genomeViewport", viewportWidth, viewportHeight)
    // }

    const [isViewSet, setIsViewSet] = useState(false);

    const [bpPerDecimal, setBpPerDecimal] = useState(100)

    const genome_length = config.intervals[config.intervals.length - 1][1]
    const start_value = config.value[0]
    const end_value = config.value[1]

    const zoom = viewState['genome-positions'].zoom;
    

    function alignedBinBP(L, desiredBinBP, mode = 'round') {
        if (L <= 0 || desiredBinBP <= 0) return desiredBinBP;
        const n =
          mode === 'ceil'
            ? Math.max(1, Math.ceil(L / desiredBinBP))
            : Math.max(1, Math.round(L / desiredBinBP));
        return L / n;
      }


    const makeFixedBins = useCallback((
      genome_length,
      start = 0,
      end = null,
      zoom = 8,
      baseZoom = 8,
      baseBinBP = 10000
    ) => {
      const bins = [];
      // const regionEnd = end ?? genome_length;


      const scale = Math.pow(2, baseZoom - Math.ceil(zoom));

      const desiredBinBP = baseBinBP * scale;

      // const L = Math.max(0, regionEnd - start);

    //   const binBP = alignedBinBP(L, desiredBinBP, "ceil");
      const binBP = desiredBinBP;

      const regionEnd = (end ?? genome_length)+binBP;
      // global index offset
      let i = Math.floor(start / binBP);

      for (let pos = start; pos <= regionEnd; pos += binBP, i++) {
        const binStart = pos;

        // const binEnd = Math.min(pos + binBP, regionEnd);
        const binEnd = pos + binBP;

        bins.push({
          start: binStart,
          end: binEnd,
          i, // global bin index
          sourcePosition: [i, 0],
          targetPosition: [i, 2]
        });
      }

      return {bins, binBP};
    }, config, [viewState['genome-positions'].zoom]);

    const {bins, binBP} = makeFixedBins(genome_length, start_value, end_value, viewState['genome-positions'].zoom[0], 8, 5000, viewportWidth, viewportHeight)

    useEffect(() => {

      setBpPerDecimal(binBP)

      // if (viewportWidth != null && viewportHeight != null && !isViewSet) {
      // const [minX, minY] = bins[0].sourcePosition;
      // const [maxX, maxY] = bins[bins.length - 1].targetPosition;

      // console.log("bounds",minX, maxX, minY, maxY, (maxX-minX), viewportWidth)

      // const target = [(maxX-minX)/2, (maxY-minY)/2]
      
      // const zoomm = viewportWidth != null ? Math.log2(viewportWidth / (maxX - minX)) : null;
      
      // setViewState((prev) => {
      //   if (prev['genome-positions'] && zoomm != null && target != null) {
      //     const genome_position_view = prev['genome-positions']
          
      //     if (genome_position_view.zoom !== zoomm && genome_position_view.target !== target) {    
      //       console.log("target", target, zoomm)
      //       setIsViewSet(true)

      //       // return {
      //       //           ...prev,
      //       //           ['genome-positions']: {
      //       //             ...genome_position_view,
      //       //             zoom: zoomm,
      //       //             target: target
      //       //           }
      //       //           }
      //       }
      //     }
      //     return prev
      //   })
      // }
    }, [binBP, viewState['genome-positions']], viewportSize, isViewSet)

  return {
    genomeGridLines: bins,
    bpPerDecimal
  };
}

export default genomeCoordinates;
