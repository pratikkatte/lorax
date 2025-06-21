import filtering from "taxonium_data_handling/filtering.js";
import { getNextstrainSubtreeJson } from "taxonium_data_handling/exporting.js";
import {
  processJsonl,
  generateConfig,
} from "taxonium_data_handling/importing.js";
import { cleanup } from "../utils/processNewick.js";
import { processNextstrain } from "../utils/processNextstrain.js";
import { ReadableWebToNodeStream } from "readable-web-to-node-stream";
import { parser } from "stream-json";
import { streamValues } from "stream-json/streamers/StreamValues";
import { kn_parse, kn_calxy,kn_expand_node, kn_global_calxy} from "../utils/jstree";
console.log("[Worker] Initialized");

// const WebSocket = require('ws');

// const PythonWebSocketClient = require('./PythonWebSocketClient');

// import PythonWebSocketClient from './PythonWebSocketClient.js';
// const pythonClient = new PythonWebSocketClient();
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
      // console.log("node", node)
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

      segments.push(...extractSquarePaths(child));
    });
  } else {
    segments.push({
      name: node.name,
      position: [node.x, node.y],
    })
  }
  if(node.mutations) {
    segments.push({ mutations: node.mutations,name: node.name, position:[node.x, node.y]})
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

export const queryNodes = async (data) => {
  console.log("Worker query Nodes");

  const received_data = JSON.parse(data);
  const nwk = received_data.nwk;
  const mutations = received_data.mutations;
  const times = received_data.global_times;
  const tree_index = received_data.tree_index;

  const processed_data = await processData(nwk, mutations, times, sendStatusMessage)
  const result = {
    paths: processed_data,
    genome_positions: received_data.genome_positions,
    tree_index: tree_index
  }
  console.log("result", result)
  return result

  //     console.log("query response", websocket_received_data)
  //     nwk = websocket_received_data.nwk;
  //     mutations = websocket_received_data.mutations
  //     times = websocket_received_data.global_times
  //     console.log("mutations", mutations)
  // })
  // // nwk = "((A:1,B:1):1,C:2);((A:3,B:3)AB:1,C:2);"
  // processedUploadedData = await processData(nwk, mutations, times, sendStatusMessage)
  // // if(nwk){
    
  // // }
    
  // result = {
  //   paths: processedUploadedData,
  //   genome_positions: websocket_received_data.genome_positions
    // nodes: filtering.getNodes(
    //   nodes,
    //   y_positions,
    //   min_y,
    //   max_y,
    //   min_x,
    //   max_x,
    //   boundsForQueries.xType
    // ),
  // };
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
  await waitForProcessedData();
  const config = {};
  var websocket_received_data;

  await pythonClient.sendRequest({
    action: 'config',
    // file: payload
    values:config
  }).then((response) => {
    websocket_received_data = JSON.parse(response.data);    
  })

  return websocket_received_data.config
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


function processNewick(nwk_str, mutations, globalMinTime, globalMaxTime, times) {
  let ladderize = true;
  // let globalMinTime = -324375.4523505669
  // let globalMaxTime = 0.0
  let start_time = times['end']
  // if (index > 0){
    
  //   start_time = -99228.96210396479
  // }else{
  //   start_time = globalMinTime
  // }
  
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

  function assignMutations(node){
    if (mutations && mutations.hasOwnProperty(node.name)) {
      node.mutations = mutations[node.name]
    }
    if(node.child.length > 0){ 
      node.child.forEach((child) => {
        assignMutations(child);
      })
    }
  }

  assignNumTips(tree.root);
  assignMutations(tree.root);

  const total_tips = tree.root.num_tips;

  if (ladderize) {
    sortWithNumTips(tree.root);
    tree.node = kn_expand_node(tree.root);
  }

  // kn_calxy(tree, true);
  kn_global_calxy(tree, true, globalMinTime, globalMaxTime, start_time)
  // sort on y:
  tree.node.sort((a, b) => a.y - b.y);
  cleanup(tree);

  return tree
}

export async function globalCleanup(allTrees) {
  const emptyList = []; // Define your default mutation list or placeholder

  // Step 1: Assign node_id and collect all x/y values
  let all_x = [];
  let all_y = [];

  for (const tree of allTrees) {
    tree.node.forEach((node, i) => {
      node.node_id = i;
      all_x.push(node.x);
      all_y.push(node.y);
    });
  }

  // Step 2: Compute global scale factors
  all_x.sort((a, b) => a - b);

  const ref_x = all_x.length > 0 ? all_x[Math.floor(all_x.length * 0.99)] : 1;
  const scale_x = 450 / ref_x;

  const min_y = all_y.reduce((min, y) => Math.min(min, y), Infinity);
  const max_y = all_y.reduce((max, y) => Math.max(max, y), -Infinity);
  const scale_y =  1;

  // Step 3: Normalize and flatten each tree safely
  for (let t = 0; t < allTrees.length; t++) {
    const tree = allTrees[t];
    const x_offset = t * 500; // Optional horizontal spacing between trees

    const originalNodes = tree.node; // Preserve reference to full objects

    tree.node = originalNodes.map((node) => {
      const node_name = node.name?.replace(/'/g, "") || "";

      const to_return = {
        name: node_name,
        parent_id: node.parent ? node.parent.node_id : node.node_id,
        x_dist: node.x * scale_x + x_offset,
        y: (node.y - min_y) * scale_y,
        mutations: emptyList,
        num_tips: node.num_tips,
        is_tip: node.child.length === 0,
        node_id: node.node_id,
      };

      if (node.meta) {
        parseNewickKeyValue(node.meta, to_return);
      }

      return to_return;
    });
  }
}

async function processData(data, mutations, times, sendStatusMessage){

  const trees = data
  .split(';')
  .filter(Boolean)
  .map((str, index) => {
    return processNewick(str, mutations[index], times['min_time'], times['max_time'], times['times'][index]);
  });

  // globalCleanup(trees)
  const paths = []
  trees.map((tree, i) => {
    // const extent = getYExtent(tree.root);
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
      var mutations = null
      var times = null
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
        mutations = websocket_received_data.mutations
        times = websocket_received_data.global_times
      });

      processedUploadedData = await processData(nwk, mutations,times, sendStatusMessage)
      
      if (processedUploadedData){
        sendStatusMessage({
          message: "file_uploaded",
        });
      }}
  } else {
    if (data.type === "query") {
      console.log("data query value", data)

      const result = await queryNodes(data.data);
      postMessage({ type: "query", data: result });
    }
    if (data.type === "search") {
      // const result = await search(data.search, data.bounds);
      // postMessage({ type: "search", data: result });
    }
    if (data.type === "config") {
      const result = await getConfig();
      postMessage({ type: "config", data: result });
    }

    if (data.type === "details") {
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
