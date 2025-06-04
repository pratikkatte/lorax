import { DebounceInput } from "react-debounce-input";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import { useState, useEffect } from "react";

function format(num) {
  if (!num && num !== 0) return "";
  return Number(num).toLocaleString();
}
function parse(str) {
  return Number(str.replace(/,/g, ""));
}

export default function EditableRange({ value, onChange }) {
  const [startStr, setStartStr] = useState(value[0].toString());
  const [endStr, setEndStr] = useState(value[1].toString());

  // Keep local state in sync with prop
  useEffect(() => { setStartStr(value[0].toString()); }, [value[0]]);
  useEffect(() => { setEndStr(value[1].toString()); }, [value[1]]);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        width: "30%",
        backgroundColor: "aliceblue",
        borderRadius: "4px",
        p: 0.2,
        border: "1.5px solid rgb(0,0,0)",
        padding: "4px 8px",
      }}
    >
      <DebounceInput
        element={TextField}
        minLength={1}
        debounceTimeout={1000} // 1 second debounce
        variant="standard"
        size="small"
        value={startStr}
        onChange={e => {
          const raw = e.target.value.replace(/[^\d,]/g, "");
          setStartStr(raw);
          // Only fire onChange (parent) if the input parses cleanly
          const num = parse(raw);
          if (!isNaN(num) && num !== value[0]) {
            // Format after change
            setStartStr(format(num));
            onChange([num, value[1]]);
          }
        }}
        inputProps={{ inputMode: "numeric", pattern: "[0-9,]*" }}
        sx={{
          width: "45%",
          '& .MuiInputBase-root': {
            backgroundColor: 'transparent',
            boxShadow: 'none',
            border: 'none',
            '&:before': { border: 'none' },
            '&:after': { border: 'none' },
            '&:hover:not(.Mui-disabled):before': { border: 'none' },
          },
          '& .MuiInputBase-input': {
            textAlign: "center",
            backgroundColor: 'transparent',
            border: 'none',
            boxShadow: 'none',
            fontSize: "1.1em",
            padding: '10px',
          }
        }}
      />

      <Typography sx={{ mx: 1, fontWeight: "bold", fontSize: "1.2em" }}> ... </Typography>

      <DebounceInput
        element={TextField}
        minLength={1}
        debounceTimeout={1000}
        variant="standard"
        size="small"
        value={endStr}
        onChange={e => {
          const raw = e.target.value.replace(/[^\d,]/g, "");
          setEndStr(raw);
          const num = parse(raw);
          if (!isNaN(num) && num !== value[1]) {
            setEndStr(format(num));
            onChange([value[0], num]);
          }
        }}
        inputProps={{ inputMode: "numeric", pattern: "[0-9,]*" }}
        sx={{
          width: "45%",
          '& .MuiInputBase-root': {
            backgroundColor: 'transparent',
            boxShadow: 'none',
            border: 'none',
            '&:before': { border: 'none' },
            '&:after': { border: 'none' },
            '&:hover:not(.Mui-disabled):before': { border: 'none' },
          },
          '& .MuiInputBase-input': {
            textAlign: "center",
            backgroundColor: 'transparent',
            border: 'none',
            boxShadow: 'none',
            fontSize: "1.1em",
            padding: '10px',
          }
        }}
      />
    </Box>
  );
}
