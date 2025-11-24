/// app.js
import React, { useState,useEffect, useCallback, useRef, useMemo } from "react";
import DeckGL from "@deck.gl/react";
import {View} from '@deck.gl/core';

import useLayers from "./hooks/useLayers";
import { Oval } from 'react-loader-spinner';
import useRegions from "./hooks/useRegions";
import LoraxMessage from "./components/loraxMessage";


const LoadingSpinner = React.memo(() => (
  <div className="w-full h-full flex justify-center items-center">
    <Oval height="40" width="40" color="#666" ariaLabel="loading" secondaryColor="#666" />
  </div>
));

const StatusMessage = React.memo(({status, message}) => (
  <div className="w-full h-full flex justify-center items-center">
    <div className="text-sm text-gray-500">{message}</div>
  </div>
));

const ViewportOverlay = React.memo(({is_time}) => (
  <>
    {/* Outer border */}
    <div
      style={{
        position: 'absolute',
        top: '1%',
        left: '2%',
        height: '85%',
        width: '98%',
        zIndex: 1,
        pointerEvents: 'none',
        border: '2px solid #b5b5b5',
        borderRadius: '8px',
        boxShadow: '0 0 0 2px #f8f8f8, 0 2px 6px rgba(0,0,0,0.1)',
        backgroundColor: 'transparent',
      }}
    />

    {/* genome positions */}
    <div
      style={{
        position: 'absolute',
        top: '1%',
        left: '5%',
        height: '3%',
        width: '95%',
        zIndex: 10,
        pointerEvents: 'none',
        // border: '1px solid #d0d0d0',
        borderBottom: '1px solid #cccccc',
        borderTopLeftRadius: '6px',
        borderTopRightRadius: '6px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
    />

    {/* genome info */}
    <div
      style={{
        position: 'absolute',
        top: '4%',
        left: '5%',
        height: '2%',
        width: '95%',
        zIndex: 10,
        pointerEvents: 'none',
        // border: '1px solid #d0d0d0',
        borderBottom: '1px solid #d0d0d0',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
    />

    {/* tree time */}
    <div
      style={{
        position: 'absolute',
        top: '1%',
        left: '2%',
        height: '85%',
        width: '3%',
        zIndex: 10,
        pointerEvents: 'none',
        // border: '1px solid #d0d0d0',
        borderRight: '1px solid rgba(232, 226, 226, 0.96)',
        borderRadius: '6px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      {/* vertical label */}
      <div
        style={{
          display: 'flex',
          transform: 'rotate(-90deg)',
          whiteSpace: 'nowrap',
          fontSize: '12px',
          color: '#333',
          fontWeight: 500,
          letterSpacing: '2px',
        }}
      >
      {is_time ? "Coalescent time" : "No Time Data"}
      </div>
    </div>
  </>
));

const GenomeVisualization = React.memo(({ pointsArray }) => (
  <svg
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    }}
  >
    {pointsArray?.map((points, idx) => (
      <React.Fragment key={idx}>
        <polygon
          points={points.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="rgba(145, 194, 244, 0.18)"
          // stroke="rgba(0,0,0,0.3)"
        />
      </React.Fragment>
    ))}
  </svg>
));


function Deck({
  backend,
  view,
  deckRef,
  hoveredTreeIndex,
  setHoveredTreeIndex,
  config,
  valueRef,
  statusMessage,
  setStatusMessage,
  setClickedGenomeInfo
}) {

  const {tsconfig, globalBpPerUnit, populations, populationFilter} = config;
  const saveViewports = useRef({});
  const {views, xzoom, viewState, handleViewStateChange, setDecksize, yzoom, genomicValues} = view

  const [hoveredGenomeInfo, setHoveredGenomeInfo] = useState(null);

  const {queryDetails} = backend;

  const regions = useRegions({backend, valueRef, saveViewports: saveViewports.current, globalBpPerUnit, tsconfig, setStatusMessage, xzoom, yzoom, genomicValues});


  const onClickOrMouseMove = useCallback(
    (info, event) => {
      const isClick = event.type === "click";
      const isHover = !isClick;      
      if (
        info && isClick
      ) {
        if (info.layer.id.includes("main")) {
          const data = {treeIndex: info.layer?.props?.bin?.global_index, node: info.object?.name}
          queryDetails(data)
        }
        else if (info.layer.id.includes("genome-info")) {

          const {bins} = regions;
          console.log("clicked genome info", info.object, bins)
          setClickedGenomeInfo(info.object)

        }
      }
      if (isHover) {
        if(info.object) {

          if (info.layer.id.includes("main")) {

          const { srcEvent } = event;
            const x = srcEvent.clientX;
            const y = srcEvent.clientY;

            const sample_population_id = populations?.nodes_population[parseInt(info.object?.name)];
            const sample_population = populations?.populations[sample_population_id]
            const tree_index = info.layer?.props?.bin?.global_index
            if (tree_index) {
              setHoveredTreeIndex({tree_index: tree_index, path: info.object?.path, name: info.object?.name, center: [x, y], 'population':sample_population?.['population'], 'super_population':sample_population?.['super_population']})
            }
          }

          else if (info.layer.id.includes("genome-info")) {
            setHoveredGenomeInfo(info.object.global_index)
          }
          else{
            setHoveredGenomeInfo(null)
            setHoveredTreeIndex(null)
          }
        }
        else{
          setHoveredTreeIndex(null)
          setHoveredGenomeInfo(null)
        }
      }
    },[])
 
    const { layers, layerFilter } = useLayers({
      xzoom,
      tsconfig,
      deckRef,
      backend,
      regions,
      globalBpPerUnit,
      hoveredTreeIndex,
      setHoveredTreeIndex,
      populations,
      populationFilter,
      hoveredGenomeInfo,
    });


    const [dummy, setDummy] = useState(null);

  const getLayerPixelPositions = useCallback(
    (deckRef) => {
      if (!deckRef?.current?.deck) return;
      const deck = deckRef.current.deck;
      const pointsArray = [];
  
      const genomeVP = saveViewports.current?.["genome-positions"];
      const orthoVP = saveViewports.current?.["ortho"];
      
  
      // Quick bail-out if viewports missing
      if (!genomeVP || !orthoVP) return;
  
      const { bins } = regions;
      if (!(bins instanceof Map)) return;
  
      // Iterate directly over map entries — much faster than Object.values()

      for (const [key, b] of bins) {
        if (!b?.visible) continue;
       
        const modelMatrix = b.modelMatrix;
        const coords_s = [b.s / globalBpPerUnit, 0];
        const coords_e = [b.e / globalBpPerUnit, 0];
  
        const pixel_s = genomeVP.project(coords_s);
        const pixel_e = genomeVP.project(coords_e);
  
        // Modal matrix translation terms
        const [x0, y0] = orthoVP.project([modelMatrix[12], 0]);
        const [x1, y1] = orthoVP.project([
          modelMatrix[12] + modelMatrix[0],
          1,
        ]);

        // console.log("modelMatrix", modelMatrix, b.global_index);
  
        pointsArray.push([
          [x0, y1 * 0.1],
          [pixel_s[0], 0],
          [pixel_e[0], 0],
          [x1, y1 * 0.1],
          [x1, y1],
          [x0, y1],
        ]);
      }
  
      if (pointsArray.length > 0) {
        setDummy({ pointsArray });
      }
    },
    [deckRef, saveViewports, globalBpPerUnit, regions]
  );
  
useEffect(() => {
    getLayerPixelPositions(deckRef)
}, [regions, tsconfig, saveViewports.current])

  const handleAfterRender = useCallback(() => {

    
      const deck = deckRef?.current?.deck;
      if (!deck) return;

      const vpGenome = deck.getViewports().find(v => v.id === 'genome-positions');
      const vpOrtho = deck.getViewports().find(v => v.id === 'ortho');

      if (!vpGenome || !vpOrtho) return;
      saveViewports.current = {
        'ortho': vpOrtho,
        'genome-positions': vpGenome
      };
      }, [deckRef, tsconfig])

  return (
    <div className="w-full"> 
    <>
    <div className="w-full h-full flex justify-center items-center relative" 
    >
    <DeckGL
      ref={deckRef}
      onHover={onClickOrMouseMove}
      onClick={onClickOrMouseMove}
      pickingRadius={10}
      layers={layers}
      layerFilter={layerFilter}
      viewState={viewState}
      onViewStateChange={handleViewStateChange}
      views={views}
      onAfterRender={handleAfterRender}
      onResize={({width, height}) => {
        setDecksize({width, height});
      }}
    >
      <View id="ortho">
        {/* {no_data && <LoadingSpinner />} */}
      {dummy && dummy.pointsArray.length > 0 && (
              <GenomeVisualization pointsArray={dummy.pointsArray} />
            )}
            {statusMessage?.status === "loading" && <LoraxMessage status={statusMessage.status} message={statusMessage.message} />}

      {/* Tooltip on hoveredTreeIndex */}
      {hoveredTreeIndex && hoveredTreeIndex.tree_index && hoveredTreeIndex.center && typeof hoveredTreeIndex.center[0] === "number" && typeof hoveredTreeIndex.center[1] === "number" && (
        <div
          style={{
            position: 'fixed',
            left: hoveredTreeIndex.center[0] + 15,
            top: hoveredTreeIndex.center[1] - 15,
            zIndex: 9999,
            pointerEvents: 'none',
            backgroundColor: 'rgba(255,255,255,255)',
            boxShadow: '0 2px 8px 0 rgba(0,0,0,0.08)',
            borderRadius: 8,
            padding: "6px 12px",
            minWidth: 120,
            border: '1px solid #ddd',
            fontSize: '14px',
            color: '#1a2330',
            whiteSpace: 'nowrap',
          }}
        >
          {/* Display tree index and path */}
          <div>
            <b>Metadata:</b> 
            {hoveredTreeIndex.tree_index && 
            <span>
              <br />
              <b>Tree Index:</b> {hoveredTreeIndex.tree_index}</span>
            }

            {hoveredTreeIndex.name && 
            <span>
              <br />
              <b>Name:</b> {hoveredTreeIndex.name}
              </span>
            }

{hoveredTreeIndex.population && 
            <span>
              <br />
              <b>Population:</b> {hoveredTreeIndex.population}
              </span>
            }
            {hoveredTreeIndex.super_population && 
            <span>
              <br />
              <b>super_population:</b> {hoveredTreeIndex.super_population}
              </span>
            }
          </div>
        </div>
      )}

      </View>
      <View id="genome-positions">
      </View>
    </DeckGL>
    <ViewportOverlay is_time={tsconfig?.times?.length > 0 ? true : false}/>
    </div>
    </>
  
    </div>
  );
}

export default Deck;
