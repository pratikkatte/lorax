
import { cleanup } from "../utils/processNewick.js";
import { kn_parse,kn_parse_auto, kn_calxy, kn_expand_node, kn_global_calxy} from "../utils/jstree";

console.log("[Worker] Initialized");

// const WebSocket = require('ws');

// const PythonWebSocketClient = require('./PythonWebSocketClient');

// import PythonWebSocketClient from './PythonWebSocketClient.js';
// const pythonClient = new PythonWebSocketClient();

postMessage({ data: "Worker starting" });

const the_cache = {};
let vertical_mode = true;

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

function extractSquarePaths(node, vertical_mode) {
  const segments = [];

  if (node.child.length>0) {
    node.child.forEach(child => {
      // Horizontal segment from parent to child x at parent y
      // Vertical drop to child's y
      segments.push({
        path: vertical_mode ? [[node.x, node.y], [node.x, child.y]] : [[node.y, node.x], [child.y, node.x]]
      });
      segments.push({
        path: vertical_mode ?[[node.x, child.y],[child.x, child.y]]: [[child.y, node.x],[child.y, child.x]]
      });
      segments.push(...extractSquarePaths(child, vertical_mode));
    });
  } else {
    segments.push({
      name: node.name,
      position: vertical_mode ? [node.x, node.y] : [node.y, node.x],
    })
  }
  if(node.mutations) {
    if(vertical_mode){
      segments.push({ mutations: node.mutations,name: node.name, position:[node.x, node.y]})
    }else{
      segments.push({ mutations: node.mutations,name: node.name, position:[node.y, node.x]})
    }
  } 
  return segments;
}


const sendStatusMessage = (status_obj) => {
  postMessage({
    type: "status",
    data: status_obj,
  });
};



export const queryNodes = async (data, vertical_mode) => {
  try {
    console.log("Worker query Nodes");

    const received_data = JSON.parse(data);
    const nwk = received_data.nwk;
    const mutations = received_data.mutations;
    const times = received_data.global_times;
    const tree_index = received_data.tree_index;

    const processed_data = await processData(nwk, mutations, times, sendStatusMessage, vertical_mode)
    const result = {
      paths: processed_data,
      genome_positions: received_data.genome_positions,
      tree_index: tree_index,
      times: times
    }
  
    return result;
  } catch (error) {
    console.log("error")
    // console.error("Error in queryNodes: ", error);
  }
};



function processNewick(nwk_str, mutations, globalMinTime, globalMaxTime, times) {
  let ladderize = true;
  let start_time = times['end']

  
  // const tree = kn_parse(nwk_str)
  const tree = kn_parse_auto(nwk_str)

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

async function processData(data, mutations, times, sendStatusMessage, vertical_mode){

  // const trees = data
  // .split(';')
  // .filter(Boolean)
  const trees = data
  .map((str, index) => {
    return processNewick(str, mutations[index], times['min_time'], times['max_time'], times['times'][index]);
  });

  const paths = []
  trees.map((tree, i) => {
    paths.push(extractSquarePaths(tree.root, vertical_mode))
  })
  return paths
}



onmessage = async (event) => {
  //Process uploaded data:
  console.log("Worker onmessage");
  const { data } = event;

  if (data.type === "upload")
  {
    console.log("upload value: TO IMPLEMENT")

  } else {
    if (data.type === "query") {
      console.log("data query value")
      const result = await queryNodes(data.data, data.vertical_mode);

      postMessage({ type: "query", data: result });
    }
    if (data.type === "search") {
      console.log("search : TO IMPLEMENT")
    }
    if (data.type === "config") {
      console.log("config value: TO IMPLEMENT")
    }

    if (data.type === "details") {
      console.log("data details value: TO IMPLEMENT")
    }

  }
};