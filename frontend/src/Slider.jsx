import React, { useState } from 'react';
import { Box, Slider, IconButton, TextField, Typography } from '@mui/material';
import { ArrowBack, ArrowForward, ZoomIn, ZoomOut } from '@mui/icons-material';

const GenomeBrowserUI = ({tree_min_max, val, setVal}) => {
  const [chromosome] = useState('chr20');
  const handleSliderChange = (event, newValue) => {
    setVal(newValue);
  };

  const handleShift = (direction) => {
    const shiftAmount = 250;
    const newStart = val[0] + (direction === 'left' ? -shiftAmount : shiftAmount);
    const newEnd = val[1] + (direction === 'left' ? -shiftAmount : shiftAmount);
    setVal([newStart, newEnd]);
  };

  return (
    <Box className="bg-white shadow-md p-2 rounded-md w-full">
      {/* Controls row */}
      <div className="flex items-center justify-center space-x-2">
        <IconButton onClick={() => handleShift('left')}>
          <ArrowBack />
        </IconButton>

        <TextField
          variant="outlined"
          size="small"
          value={`${chromosome}:${val[0].toLocaleString()}..${val[1].toLocaleString()}`}
          InputProps={{ readOnly: true }}
          sx={{ width: '300px', backgroundColor: 'white' }}
        />

        <IconButton onClick={() => handleShift('right')}>
          <ArrowForward />
        </IconButton>
      </div>

      {/* Slider */}
      {/* <Box sx={{ mt: 2, px: 2 }}>
        <Slider
          value={val}
          onChange={handleSliderChange}
          valueLabelDisplay="off"
          min={tree_min_max[0]}
          max={tree_min_max[1]}
          step={1}
        />
      </Box> */}
    </Box>
  );
};

export default GenomeBrowserUI;
