import filtering from "taxonium_data_handling/filtering.js";
import { getNextstrainSubtreeJson } from "taxonium_data_handling/exporting.js";
import {
  processJsonl,
  generateConfig,
} from "taxonium_data_handling/importing.js";
import { processNewickAndMetadata, cleanup } from "../utils/processNewick.js";
import { processNextstrain } from "../utils/processNextstrain.js";
import { ReadableWebToNodeStream } from "readable-web-to-node-stream";
import { parser } from "stream-json";
import { streamValues } from "stream-json/streamers/StreamValues";
import { kn_parse, kn_calxy } from "../jstree";

// const WebSocket = require('ws');

// const PythonWebSocketClient = require('./PythonWebSocketClient');

import PythonWebSocketClient from './PythonWebSocketClient.js';
const pythonClient = new PythonWebSocketClient();

postMessage({ data: "Worker starting" });

const the_cache = {};

function getYExtent(node) {
  const ys = [];

  function collectY(n) {
    ys.push(n.y);
    if (n.child) n.child.forEach(collectY);
  }

  collectY(node);
  return {
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function extractSquarePaths(node) {
  const segments = [];

  if (node.child.length>0) {
    node.child.forEach(child => {
      // Horizontal segment from parent to child x at parent y

      // Vertical drop to child's y
      segments.push({
        path: [
          [node.x, node.y],
          [node.x, child.y]
        ],
      });

      segments.push({
        path: [
          [node.x, child.y],
          [child.x, child.y]
        ]
      });

      // Recurse into children
      segments.push(...extractSquarePaths(child));
    });
  } else {
    segments.push({
      position: [node.x, node.y],
    })
  }

  return segments;
}

const cache_helper = {
  retrieve_from_cache: (key) => the_cache[key],
  store_in_cache: (key, value) => {
    the_cache[key] = value;

    // Total size of the lists in the cache
    let total_size = 0;
    for (const key in the_cache) {
      total_size += the_cache[key].length;
    }
    // If the cache is too big, remove a random item
    if (total_size > 100e6) {
      const keys = Object.keys(the_cache);
      const random_key = keys[Math.floor(Math.random() * keys.length)];
      delete the_cache[random_key];
    }
  },
};

let processedUploadedData;

const sendStatusMessage = (status_obj) => {
  postMessage({
    type: "status",
    data: status_obj,
  });
};

const waitForProcessedData = async () => {
  // check if processedUploadedData is defined, if not wait until it is
  if (processedUploadedData === undefined) {
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (processedUploadedData !== undefined) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }
};

export const queryNodes = async (boundsForQueries, values) => {
  console.log("Worker query Nodes");
  await waitForProcessedData();
  let result;
  var websocket_received_data;
  console.log("in webworker, querynode", values);
  var nwk = null
  await pythonClient.sendRequest({
    action: 'query_trees',
    // file: payload
    values:values
  }).then((response) => {
    sendStatusMessage({
      "status": response.status,
    })    
    websocket_received_data = JSON.parse(response.data);
      console.log("query response", websocket_received_data)
      nwk = websocket_received_data.nwk;
      // nwk = response.nwk;

  })
  processedUploadedData = await processData(nwk, sendStatusMessage)
  // if(nwk){
    
  // }
    
  result = {
    paths: processedUploadedData,
    genome_positions: websocket_received_data.genome_positions
    // nodes: filtering.getNodes(
    //   nodes,
    //   y_positions,
    //   min_y,
    //   max_y,
    //   min_x,
    //   max_x,
    //   boundsForQueries.xType
    // ),
  };
  return result;
};

const search = async (search, bounds) => {

  await waitForProcessedData();

  const {
    nodes,
    // eslint-disable-next-line no-unused-vars
    overallMaxX,
    overallMaxY,
    // eslint-disable-next-line no-unused-vars
    overallMinX,
    overallMinY,
    y_positions,
    node_to_mut,
    mutations,
  } = processedUploadedData;
  const spec = JSON.parse(search);

  const min_y = bounds && bounds.min_y ? bounds.min_y : overallMinY;
  const max_y = bounds && bounds.max_y ? bounds.max_y : overallMaxY;
  const min_x = bounds && bounds.min_x ? bounds.min_x : overallMinX;
  const max_x = bounds && bounds.max_x ? bounds.max_x : overallMaxX;
  const xType = bounds && bounds.xType ? bounds.xType : "x_dist";

  const result = filtering.singleSearch({
    data: nodes,
    spec,
    min_y,
    max_y,
    min_x,
    max_x,
    y_positions,
    mutations,
    node_to_mut,
    xType: xType,
    cache_helper,
  });

  console.log("got search result", result);
  result.key = spec.key;
  return result;
};

const getConfig = async () => {
  console.log("Worker getConfig");
  await waitForProcessedData();
  const config = {};
  generateConfig(config, processedUploadedData);

  config.mutations = processedUploadedData.mutations;

  console.log("overwrite with", processedUploadedData.overwrite_config);

  const merged_config = {
    ...config,
    ...processedUploadedData.overwrite_config,
  };

  //console.log("config is ", config);

  return merged_config;
};

const getDetails = async (node_id) => {
  console.log("Worker getDetails");
  await waitForProcessedData();
  const { nodes } = processedUploadedData;
  const node = nodes[node_id];
  console.log("node is ", node);
  const details = { ...node };
  details.mutations = processedUploadedData.node_to_mut[node_id]
    ? processedUploadedData.node_to_mut[node_id].map(
        (x) => processedUploadedData.mutations[x]
      )
    : [];

  return details;
};


function processNewick(nwk_str) {
  
  const tree = kn_parse(nwk_str)

  function assignNumTips(node) {
    if (node.child.length === 0) {
      node.num_tips = 1;
    } else {
      node.num_tips = 0;
      node.child.forEach((child) => {
        node.num_tips += assignNumTips(child);
      });
    }
    return node.num_tips;
  }

  function sortWithNumTips(node) {
    node.child.sort((a, b) => {
      return a.num_tips - b.num_tips;
    });
    node.child.forEach((child) => {
      sortWithNumTips(child);
    });
  }

  assignNumTips(tree.root);
  const total_tips = tree.root.num_tips;

  // if (data.ladderize) {
  //   sortWithNumTips(tree.root);
  //   tree.node = kn_expand_node(tree.root);
  // }

  kn_calxy(tree, true);

  // sort on y:
  tree.node.sort((a, b) => a.y - b.y);

  cleanup(tree);

  return tree
}
async function processData(data, sendStatusMessage){

  const trees = data
  .split(';')
  .filter(Boolean)
  .map(str => processNewick(str));

  const paths = []

  trees.map((tree, i) => {
    console.log("layouttree", tree, i)
    
    const extent = getYExtent(tree.root);
    console.log("extent", extent, i)
    paths.push(extractSquarePaths(tree.root))
  })
  return paths

}
const getList = async (node_id, att) => {
  console.log("Worker getList");
  await waitForProcessedData();
  const { nodes } = processedUploadedData;
  const atts = filtering.getTipAtts(nodes, node_id, att);
  return atts;
};

onmessage = async (event) => {
  //Process uploaded data:
  console.log("Worker onmessage");
  const { data } = event;

  if (data.type === "upload")
  {
    console.log("inside local worker") 
    const {file} = data.data;

    if (file instanceof File){
      const arrayBuffer = await file.arrayBuffer();
      //Now you can send it via WebSocket

    
    const payload = {
      filename: file.name,
      size: file.size,
      type: "fileUpload",
      // content: new Uint8Array(arrayBuffer),
      content: arrayBuffer
      }
      var websocket_data = {}
      var nwk = null
    
      console.log("sending data to pythonclient")

      sendStatusMessage({
        "status": "uploading_file",
      })
      await pythonClient.sendRequest({
        action: 'load_file',
        file: payload
      }).then((response) => {
        sendStatusMessage({
          "status": response.status,
        })
        const websocket_received_data = JSON.parse(response.data);
        console.log("response", websocket_received_data)
        nwk = websocket_received_data.nwk;
        // nwk = "((A:1,B:1)AB:1,C:2);((A:3,B:3)AB:1,C:2);"
      });
        
      processedUploadedData = await processData(nwk, sendStatusMessage)
      
      // console.log("processedUploadedData", processedUploadedData)
      sendStatusMessage({
        message: "process_completed",
      });
      // console.log("asdas", processedUploadedData)
      }

    console.log("processedUploadedData created");
  } else {
    if (data.type === "query") {
      console.log("Worker query");
      const result = await queryNodes(data.bounds, data.value);
      postMessage({ type: "query", data: result });
    }
    if (data.type === "search") {
      console.log("Worker search");
      // const result = await search(data.search, data.bounds);
      // postMessage({ type: "search", data: result });
    }
    if (data.type === "config") {
      console.log("Worker config");
      // const result = await getConfig();
      // postMessage({ type: "config", data: result });
    }
    if (data.type === "details") {
      console.log("Worker details");
      // const result = await getDetails(data.node_id);
      // postMessage({ type: "details", data: result });
    }
    if (data.type === "list") {
      // const result = await getList(data.node_id, data.key);
      // postMessage({ type: "list", data: result });
    }
    if (data.type === "nextstrain") {
      // const result = await getNextstrainSubtreeJson(
      //   data.node_id,
      //   processedUploadedData.nodes,
      //   data.config,
      //   processedUploadedData.mutations
      // );
      // postMessage({ type: "nextstrain", data: result });
    }
  }
};
