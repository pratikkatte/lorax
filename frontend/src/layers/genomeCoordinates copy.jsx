import { useCallback, useMemo } from "react";

const BIN_STRIDE_PX = 1; // set to 2, 5, 10 if you want fewer bins

function makeBinsFullGenome({ genome_length, widthPx, stridePx = BIN_STRIDE_PX }) {
  const nBins = Math.max(1, Math.floor(widthPx / Math.max(1, stridePx)));
  const bpPerBin = genome_length / nBins;
  const out = [];
  for (let i = 0; i < nBins; i++) {
    const start = i * bpPerBin;
    const end = (i + 1) * bpPerBin;
    out.push({ start, end, i });
  }
  return out;
}
function makeFixedBins(genome_length, binBP = 100) {
    // 1) Edges
    const out = [];
    for (let i = 0, j = 0; i < genome_length; i += binBP, j++) {
        const start = i;
        const end = i + binBP;
        out.push({ start, end, i, sourcePosition: [j, 0], targetPosition: [j, 2] });
    }
    return out;
  }

const genomeCoordinates = ({
    viewportWidthPx,    
  genome_length,
  zoomLevel,   // assumed 0 here
  centerBp     // ignored at zoom 0 (we show whole genome)
}) => {
  
    const genomeGridLines = makeFixedBins(genome_length, 1000)

//   const scaleX = Math.pow(2, zoomLevel);

//   let windowSizeBp = Math.min(300, genome_length / scaleX);
//   let leftBp_new = Math.round(centerBp - windowSizeBp / 2);
//   let rightBp_new = Math.round(centerBp + windowSizeBp / 2);
//   if (leftBp_new < 0)        { leftBp_new = 0; rightBp_new = windowSizeBp; }
//   if (rightBp_new > genome_length)        { leftBp_new = genome_length - windowSizeBp; rightBp_new = genome_length; }
//   console.log("leftBp_new", leftBp_new, "rightBp_new", rightBp_new)
//   windowSizeBp = rightBp_new - leftBp_new;


//   const bpPerPixel_new = windowSizeBp / viewportWidthPx;
//   const pxPerBp_new    = 1 / bpPerPixel_new;

//   const BIN_STRIDE_PX = 1;

//   const nBins = Math.max(1, Math.floor(viewportWidthPx / Math.max(1, BIN_STRIDE_PX)));
//   const binBp = windowSizeBp / nBins;
//   const edges = new Array(nBins + 1);
//   const bins_new  = new Array(nBins);
//   for (let i = 0; i <= nBins; i++) {
//     edges[i] = leftBp_new + i * binBp;
//     if (i < nBins) bins_new[i] = { i, start: edges[i], end: edges[i + 1] };
//   }

//   console.log("bins_new", bins_new, "edges", edges)



  // At zoom 0: whole genome across viewport width → one bin per pixel column
//   const leftBp = 0;
//   const rightBp = genome_length;
//   const spanBp = Math.max(1, rightBp - leftBp);

//   // Equal bins across *pixels*
//   const bins = useMemo(
//     () => makeBinsFullGenome({ genome_length: spanBp, widthPx: viewportWidthPx }),
//     [spanBp, viewportWidthPx]
//   );

//   // Tick edges and normalized X for drawing in [0,1]
//   const tickEdges = [leftBp, ...bins.map(b => b.end)];
//   const genomeGridLines = tickEdges.map((bpEdge, j) => {

//     const xNorm = (bpEdge) / spanBp; // 0..1 across the full genome
//     const positionstatus =
//       j === 0 ? "start" :
//       j === tickEdges.length - 1 ? "end" : null;

//     return {
//       sourcePosition: [bpEdge, 0],
//       targetPosition: [bpEdge, 2],
//       genomicPosition: bpEdge,
//       positionstatus
//     };
//   });

//   // Helpful metadata if you want labels
//   const bpPerPixel = genome_length / Math.max(1, viewportWidthPx);

//   console.log("genomeGridLines", genomeGridLines)
  return {
    genomeGridLines,

  };
};

export default genomeCoordinates;
