import { within, userEvent } from "@storybook/testing-library";
import { useState } from "react";
import Taxonium from "../Taxonium";

const WithState = (args) => {
  const [state, setState] = useState({});
  const updateQuery = (newState) => {
    setState({ ...state, ...newState });
  };
  return (
    <div style={{ width: "100%", height: "500px" }}>
      <Taxonium
        {...args}
        query={state}
        updateQuery={updateQuery}
        backendUrl={"http://localhost:8080"}
      />
    </div>
  );
};

export default {
  title: "Example/Page2",
  component: WithState,
};

export const WithBackend = {
  args: {
    backendUrl: "http://localhost:8080/",
  },

  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/react/configure/story-layout
    layout: "padded",
  },
};
