import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import './App.css'
import Taxonium from './Taxonium.jsx'
import TreeSequenceUploader from './components/TreeSequenceUploader'

function App() {

    const [file, setFile] = useState(null);

    const [fileUpload, setFileUpload] = useState(false)
    const handleUploadSuccess = (result) => {
        if(result.status == 201){
          // setFileUpload(true)
        }
      };

      const handleUploadError = (error) => {
        console.error('Upload error:', error);
      };
      
  return (
    <>
    {!file ? <TreeSequenceUploader
      onUploadSuccess={handleUploadSuccess}
      onUploadError={handleUploadError}
      setFile={setFile}
      file={file}
    /> : 
      <Taxonium uploadFile={file}/>

    }
    </>
  )
}

export default App



// import React, { useState , useMemo} from 'react';
// import DeckGL from '@deck.gl/react';
// import { View, OrthographicView, OrthographicController} from '@deck.gl/core';
// import { LineLayer, TextLayer, ScatterplotLayer } from '@deck.gl/layers';

// const INITIAL_VIEW_STATE = {
//   target: [0, 0, 0],
//   zoom: 0,
//   minZoom: -5,
//   maxZoom: 4
// };

// export default function App() {
//   const [viewStates, setViewStates] = useState({
//     main: INITIAL_VIEW_STATE,
//     ruler: INITIAL_VIEW_STATE,
//     xaxis: INITIAL_VIEW_STATE
//   });

//   const handleViewStateChange = ({ viewId, viewState }) => {
//     console.log("view", viewId, viewState)
//     if (viewId === 'ruler') {
//       setViewStates(prev => ({
//         main: {
//           ...viewState,
//           target: [0, viewState.target[1], 0], // Keep X position locked
//         },
//         ruler: {
//           ...prev.ruler,
//           target: [0, viewState.target[1], 0], // Sync Y position
//           zoom: viewState.zoom
//         }
//       }));
//     }
//   };

//   const getdata = () => {
//     return Array.from({ length: 100 }, () => ({
//       position: [Math.random() * 100 - 50, Math.random() * 300 - 150]
//     }))
//   }
//   const daaata = useMemo(() => getdata(), []);
  
//   // Convert 1 Deck.gl unit = 1 cm; simulate physical 15 cm ruler
//   const zoom = viewStates.main.zoom;
//   const worldUnitsPerPixel = 1 / Math.pow(2, zoom);  // units per screen pixel
//   const rulerHeightPx = 400; // height of ruler panel in pixels
//   const cmPerTick = 1;       // 1cm per tick
//   const spacing = cmPerTick / worldUnitsPerPixel; // spacing in pixels based on zoom
//   const numTicks = Math.floor(rulerHeightPx / spacing);


//   const tickData = Array.from({ length: numTicks }, (_, i) => {
//     const y = i * cmPerTick - (numTicks * cmPerTick) / 2;
//     return {
//       source: [0, y],
//       target: [5, y],
//       position: [8, y],
//       text: `${y.toFixed(1)} cm`
//     };
//   });

//   const zoomX = viewStates.main.zoom;
//   const worldUnitsPerPixelX = 1 / Math.pow(2, zoomX);
//   const axisWidthPx = 800;
//   const cmPerTickX = 1;
//   const spacingX = cmPerTickX / worldUnitsPerPixelX;
//   const numTicksX = Math.floor(axisWidthPx / spacingX);
  
//   const xTickData = Array.from({ length: numTicksX }, (_, i) => {
//     const x = i * cmPerTickX - (numTicksX * cmPerTickX) / 2;
//     return {
//       source: [x, 0],
//       target: [x, -5],           // downward tick
//       position: [x, -10],        // text just below
//       text: `${x.toFixed(1)} cm`
//     };
//   });

//   const layers = [
//     new LineLayer({
//       id: 'ruler-line',
//       data: tickData,
//       getSourcePosition: d => d.source,
//       getTargetPosition: d => d.target,
//       getColor: [0, 0, 180],
//       getWidth: 2,
//       viewId: 'ruler'
//     }),
//     new TextLayer({
//       id: 'ruler-labels',
//       data: tickData,
//       getPosition: d => d.position,
//       getText: d => d.text,
//       getSize: 14,
//       getColor: [0, 255, 0],
//       sizeUnits: 'pixels',
//       getTextAnchor: 'start',
//       getAlignmentBaseline: 'center',
//       viewId: 'ruler'
//     }),
//     new LineLayer({
//       id: 'xaxis-line',
//       data: xTickData,
//       getSourcePosition: d => d.source,
//       getTargetPosition: d => d.target,
//       getColor: [200, 200, 0],
//       getWidth: 2,
//       viewId: 'xaxis'
//     }),
//     new TextLayer({
//       id: 'xaxis-labels',
//       data: xTickData,
//       getPosition: d => d.position,
//       getText: d => d.text,
//       getSize: 12,
//       getColor: [255, 255, 255],
//       sizeUnits: 'pixels',
//       getTextAnchor: 'middle',
//       getAlignmentBaseline: 'top',
//       viewId: 'xaxis'
//     }),

//     new ScatterplotLayer({
//       id: 'scatter',
//       data: daaata,
//       getPosition: d => d.position,
//       getFillColor: [100, 200, 255],
//       getRadius: 5,
//       viewId: 'main'
//     })
//   ];

//   const layerFilter = ({ layer, viewport }) => {
//     const isRuler = viewport.id === 'ruler';
//     const isMain = viewport.id === 'main';
//     const isXaxis = viewport.id === 'xaxis';
  
//     return (
//       (isRuler && layer.id.startsWith('ruler')) ||
//       (isXaxis && layer.id.startsWith('xaxis')) ||
//       (isMain && layer.id === 'scatter')
//     );
//   };

//   return (
//     <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
//       <DeckGL
//         layers={layers}
//         layerFilter={layerFilter}
//         views={[
//           new OrthographicView({
//             id: 'ruler',
//             x: 50, // in pixels
//             y: 50,  // in pixels
//             width: 100,
//             height: 400,
//             // controller: true,
//             // zoomAxis:'Y',
//             initialViewState: {
//               target: [0, 0, 0],
//               zoom: 0
//             },
//             controller: {
//               type: OrthographicController,
//               scrollZoom: { smooth: true, zoomAxis: 'Y' },
//               // zoomAxis: 'Y'
//             }
//           }),
//           new OrthographicView({ id: 'main', x: 80, width: '100%' }),
//           new OrthographicView({
//             id: 'xaxis',
//             x: 80,              // leave space for vertical ruler
//             y: 500,               // bottom of canvas
//             height: 80,         // height of x-axis view
//             width: 800,         // or '100%' if you're controlling layout with CSS
//             initialViewState: {
//               target: [0, 0, 0], // center on x = 0
//               zoom: 0
//             },
//             controller: {
//               type: OrthographicController,
//               scrollZoom: { smooth: true, zoomAxis: 'X' },
//               // dragPan: true,
//               // panX: true,
//               // panY: false
//             }
//           })
//         ]}
//         viewState={viewStates}
//         onViewStateChange={({ viewId, viewState }) => {
//           if (viewId === 'ruler') {
//             setViewStates(prev => ({
//               ...prev,
//               ruler: viewState
//             }));
//           } else if (viewId === 'xaxis') {
//             setViewStates(prev => ({
//               ...prev,
//               xaxis: viewState
//             }));
//           }
//         }}
//       >
//         <View id="xaxis">
//           <div style={{
//             // position: 'absolute',
//             // bottom: 0,
//           // height: '80px',
//           // left: 80,
//           // right: 0,
//           borderTop: '2px solid red',
//           // zIndex: 10
//           }} />
//         </View>
//         <View id="ruler">
//           <div style={{
//             // position: 'absolute',
//             bottom: 0,
//             // height: '80px',
//             left: 80,
//             right: 0,
//             borderTop: '2px solid red',
//             zIndex: 10
//           }} 
//           />
//         </View>
//         {/* Optional DOM overlay for the ruler */}
//       </DeckGL>
//     </div>
//   );
// }
