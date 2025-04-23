import React, { useState, useRef, useEffect } from 'react';
import { TextField, Slider, Box } from '@mui/material';
import { Rnd } from 'react-rnd';

export default function PositionSlider(props) {
  
    const POS_SHIFT = 1000
  
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const containerRef = useRef(null);
    const sliderRef = useRef(null)
    const containerWidth = useRef(null);
    const sliderWidth = useRef(null)
    const [resizing, isResizing] = useState(false)
  
    const [genomePosition, setGenomePosition] = useState({'start':0, 'end': 1000000})
    
    const { genome_position, value, setValue } = props

    useEffect(() => {
      if(containerRef.current){
        containerWidth.current = containerRef.current.getBoundingClientRect().width
      }
      if (sliderRef.current) {
        sliderWidth.current = sliderRef.current.resizableElement.current.offsetWidth
      }
    })
  
    const moveLeft = () => {
      setPosition(prev => ({ ...prev, x: prev.x - POS_SHIFT }));
    };
     const moveRight = () => {
      setPosition(prev => ({ ...prev, x: prev.x + POS_SHIFT }));
    };
  
    const handleResizeStop = (e, direction, ref, delta, position) => {
      if(direction=='left'){
        setPosition(prev => ({ ...prev, x: prev.x - delta.width}))
      }
      sliderWidth.current = ref.style.width
      isResizing(true)
    };
  
    const posToPixel = (pos) => {
        const ratio = (pos - genome_position.min) / (genome_position.max - genome_position.min);
        return ratio * (containerWidth.current - sliderWidth.current);
    }

    // console.log("posToPixel", posToPixel(value[0]), posToPixel(value[1]))

    const pixelToPos = (pixel) => {
      const ratio = pixel / containerWidth.current;
      return Math.round(genome_position.min + (ratio * (genome_position.max - genome_position.min)));
    };
    const calculate_start_end = () => {
      let start_position_value = pixelToPos(position.x)
      let end_position_value = pixelToPos(position.x+sliderWidth.current)
      return [start_position_value, end_position_value]
    }
  
    const onDrag = (e,d) => {
        setPosition({x: d.x, y:d.y});
    }
    useEffect(() => {
        const [start, end] = calculate_start_end();
        setGenomePosition({'start': start, 'end': end})
        setValue([start,end])
        isResizing(false)
    }, [position, resizing])
  
  
  
    return (
      <>
      <div>
        {value[0]}....{value[1]}
      </div>
      
        <div style={{  
          width: '100%',
          height: '8%', // Match the background height
          border: '1px',
          borderColor: 'black',
          display: 'flex',
          justifyContent: 'center'
        }}>
    
  <button 
        onClick={moveLeft}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 8px',
          fontSize: '16px',
          color: 'black'
        }}
      >
        ←
      </button>
        <div ref={containerRef} style={{
          // position: 'fixed',
          width: '70%',
          height: '100%',
          display: "flex",
          // position:'relative',
          backgroundColor: '#f0f0f0',
          borderRadius: '4px',
          alignContent: 'center',
        }}>      
        <Rnd
            // style={style}
            ref={sliderRef}
            position={position}
            default={{
              x: 0,
              y: 0,
            }}
            onDragStop={onDrag}
            onResizeStop={handleResizeStop}
            maxWidth='100%'
            enableResizing={{
              top: false,
              right: true,
              bottom: false,
              left: true,
              topRight: false,
              bottomRight: false,
              bottomLeft: false,
              topLeft: false
            }}
            dragAxis="x"
            bounds="parent"
            style={{
              zIndex: 2, // Ensure it's above the background
              overflow: 'hidden',
              position: 'relative',
  
            }}
            >
              <TextField
                variant="outlined"
                size="small"
                value={`${value[0].toLocaleString()} ... ${value[1].toLocaleString()}`}
                // value={`${genomePosition.start}..${genomePosition.end}`}
                sx={{
                  width: '2%',
                  height: '100%',
                  backgroundColor: 'white',
                  '& .MuiOutlinedInput-root': {
                    height: '100%',
                    borderRadius: '4px',
                    textAlign: 'center', // Center the text
                    '& input': {
                      textAlign: 'center', // Center the input text specifically
                      // padding: '0px 0', // Adjust vertical padding
                    }
                  }
                }}
              />
            </Rnd>

        </div>
        <button 
        onClick={moveRight}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 8px',
          fontSize: '16px',
          color: 'black'
        }}
      >
        →
      </button>
  
      </div>
      </>
    )  
}