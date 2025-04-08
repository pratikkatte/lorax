import {
  kn_expand_node,
  // kn_reorder,
  //kn_reorder_num_tips,
  kn_parse,
  kn_calxy,
} from "./jstree";
import pako from "pako";
import axios from "axios";
import reduceMaxOrMin from "./reduceMaxOrMin";
import nexusToNewick from "../utils/nexusToNewick.js";
const emptyList = [];

async function do_fetch(url, sendStatusMessage, whatIsBeingDownloaded) {
  if (!sendStatusMessage) {
    sendStatusMessage = () => {};
  }
  // send progress on downloadProgress

  if (url.endsWith(".gz")) {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      onDownloadProgress: (progress) => {
        sendStatusMessage({
          message: "Downloading compressed " + whatIsBeingDownloaded,
          percentage: (progress.loaded / progress.total) * 100,
        });
      },
    });
    sendStatusMessage({
      message: "Decompressing compressed " + whatIsBeingDownloaded,
    });
    const inflated = pako.ungzip(response.data);
    const text = new TextDecoder("utf-8").decode(inflated);
    return text;
  } else {
    const response = await axios.get(url, {
      onDownloadProgress: (progress) => {
        sendStatusMessage({
          message: "Downloading " + whatIsBeingDownloaded,
          percentage: (progress.loaded / progress.total) * 100,
        });
      },
    });
    const text = response.data;
    //parse text:
    return text;
  }
}

function fetch_or_extract(file_obj, sendStatusMessage, whatIsBeingDownloaded) {
  if (file_obj.status === "url_supplied") {
    return do_fetch(
      file_obj.filename,
      sendStatusMessage,
      whatIsBeingDownloaded
    );
  } else if (file_obj.status === "loaded") {
    if (file_obj.filename.includes(".gz")) {
      const compressed_data = file_obj.data;
      sendStatusMessage({
        message: "Decompressing compressed " + whatIsBeingDownloaded,
      });
      const inflated = pako.ungzip(compressed_data);
      const text = new TextDecoder("utf-8").decode(inflated);
      return text;
    } else {
      // convert array buffer to string
      let text;
      // if type is not string, assume it is arraybuffer
      if (typeof file_obj.data === "string") {
        text = file_obj.data;
      } else {
        text = new TextDecoder("utf-8").decode(file_obj.data);
      }
      return text;
    }
  }
}

function parseNewickKeyValue(newickKVString, obj_to_set) {
  // Regular expression that matches key=value pairs, accounting for commas within {}
  const regex = /(&?\w+)=({[^}]*}|[^,]*)/g;

  const result = [];
  let match;

  // Use the RegExp.exec() method to find all matches in the string
  while ((match = regex.exec(newickKVString)) !== null) {
    // Remove the '&' character if it's present at the start of the key
    const key = match[1].startsWith("&") ? match[1].slice(1) : match[1];
    // Push the key-value pair to the result array
    obj_to_set["meta_" + key] = match[2];
  }
}

function cleanup(tree, tree_index, scale_min_y, scale_max_y, num_tips) {
  tree.node.forEach((node) => {
    node.node_id = num_tips
    num_tips++;
  });

  tree.node = tree.node.map((node, i) => {
    const to_return = {
      name: node.name.replace(/'/g, ""),
      parent_id: node.parent ? node.parent.node_id : node.node_id,
      x_dist: node.x,
      mutations: emptyList,
      y: node.y,
      num_tips: node.num_tips,
      is_tip: node.child.length === 0,
      node_id: node.node_id,
      tree: tree_index
    };

    // if node.meta is not empty, parse it.
    // We need to parse things of the form "&name=blabla,mutations={T694A:1.0,C29870A:1.0},Ns={1-3,4-17,18-20,21-26,686-693,22029-22033,28248-28253,28271-28271}"
    if (node.meta) {
      parseNewickKeyValue(node.meta, to_return);
    }
    return to_return;
  });

  const scale_y = scale_max_y;
  
  const all_xes = tree.node.map((node) => node.x_dist);
  all_xes.sort((a, b) => a - b);
  const ref_x_percentile = 0.99;
  const ref_x = all_xes[Math.floor(all_xes.length * ref_x_percentile)];

  const scale_x = 450 / ref_x;

  tree.node.forEach((node) => {
    node.x_dist = node.x_dist * scale_x;
    node.y = scale_min_y + node.y * (scale_max_y - scale_min_y)

  });
  return num_tips
}
// export async function processNewick(data, sendStatusMessage) {
//   let the_data;

//   the_data = await fetch_or_extract(data, sendStatusMessage, "tree");

//   console.log("data.filetype", data.filetype);
//   if (data.filetype == "nexus") {
//     const result = nexusToNewick(the_data);
//     the_data = result.newick;
//   }

//   sendStatusMessage({
//     message: "Parsing Newick file",
//   });

//   // if starts with a "[", then trim to after the first "]"
//   if (the_data[0] === "[") {
//     the_data = the_data.slice(the_data.indexOf("]") + 1);
//   }

//   // remove newlines from the string

//   the_data = the_data.replaceAll("\n", "");
//   the_data = the_data.replaceAll("\r", "");

//   const tree = kn_parse(the_data);
//   console.log("tree", tree);

//   function assignNumTips(node) {
//     if (node.child.length === 0) {
//       node.num_tips = 1;
//     } else {
//       node.num_tips = 0;
//       node.child.forEach((child) => {
//         node.num_tips += assignNumTips(child);
//       });
//     }

//     return node.num_tips;
//   }

//   function sortWithNumTips(node) {
//     node.child.sort((a, b) => {
//       return a.num_tips - b.num_tips;
//     });
//     node.child.forEach((child) => {
//       sortWithNumTips(child);
//     });
//   }
//   assignNumTips(tree.root);
//   const total_tips = tree.root.num_tips;

//   if (data.ladderize) {
//     sortWithNumTips(tree.root);
//     tree.node = kn_expand_node(tree.root);
//   }

//   sendStatusMessage({
//     message: "Laying out the tree",
//   });

//   kn_calxy(tree, data.useDistances === true);

//   sendStatusMessage({
//     message: "Sorting on Y",
//   });

//   // sort on y:
//   tree.node.sort((a, b) => a.y - b.y);

//   sendStatusMessage({
//     message: "Re-processing",
//   });

//   cleanup(tree);
//   console.log("tree", tree);

//   const overallMaxX = reduceMaxOrMin(tree.node, (x) => x.x_dist, "max");
//   const overallMinX = reduceMaxOrMin(tree.node, (x) => x.x_dist, "min");
//   const overallMaxY = reduceMaxOrMin(tree.node, (x) => x.y, "max");
//   const overallMinY = reduceMaxOrMin(tree.node, (x) => x.y, "min");
//   const y_positions = tree.node.map((x) => x.y);

//   const output = {
//     nodes: tree.node,
//     overallMaxX,
//     overallMaxY,
//     overallMinX,
//     overallMinY,
//     y_positions,
//     mutations: [],
//     node_to_mut: {},
//     rootMutations: [],
//     rootId: 0,
//     overwrite_config: { num_tips: total_tips, from_newick: true },
//   };

//   return output;
// }

export async function processMetadataFile(data, sendStatusMessage) {
  const logStatusToConsole = (message) => {

  };
  let the_data;

  the_data = await fetch_or_extract(data, logStatusToConsole, "metadata");

  const lines = the_data.split("\n");
  const output = new Map();
  let splitFunction;

  if (data.filetype == "meta_tsv") {
    splitFunction = (x) => x.split("\t");
  } else if (data.filetype == "meta_csv") {
    // remove any double quotes
    splitFunction = (x) => x.split(",").map((x) => x.replace(/"/g, ""));
  } else {
    sendStatusMessage({
      error: "Filetype was not set, please raise an issue on our GitHub page",
    });
    throw new Error(
      "Filetype was not set, please raise an issue on our GitHub page"
    );
  }

  let headers;

  lines.forEach((line, i) => {
    if (i % 10000 === 0) {
      sendStatusMessage({
        message: "Parsing metadata file",
        percentage: (i / lines.length) * 100,
      });

    }
    if (i === 0) {
      headers = splitFunction(line);
    } else {
      const values = splitFunction(line);

      let name;
      if (data.taxonColumn) {
        const taxon_column_index = headers.indexOf(data.taxonColumn);
        name = values[taxon_column_index];
      } else {
        name = values[0];
      }
      const as_obj = {};
      values.slice(1).forEach((value, j) => {
        as_obj["meta_" + headers[j + 1]] = value;
      });

      output.set(name, as_obj);
    }
  });
  sendStatusMessage({
    message: "Finalising",
  });

  return [output, headers];
}


function processNewick(data){
  let the_data;

  the_data = data

    // if starts with a "[", then trim to after the first "]"
  if (the_data[0] === "[") {
    the_data = the_data.slice(the_data.indexOf("]") + 1);
  }
  // remove newlines from the string

  the_data = the_data.replaceAll("\n", "");
  the_data = the_data.replaceAll("\r", "");

  const tree = kn_parse(the_data);


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

  if (data.ladderize) {
    sortWithNumTips(tree.root);
    tree.node = kn_expand_node(tree.root);
  }
  return [tree, total_tips]
}

function kn_calxy_multiple(trees, is_real) {
  let totalHeight = 0;
  let treeSpacing = 1.5; // Spacing factor between trees

  // Calculate Y-coordinates for each tree
  trees.forEach((tree, treeIndex) => {
    let scale = tree.n_tips - 1;
    let baseY = totalHeight; // Offset for this tree
    let j;
    for (let i = (j = 0); i < tree.node.length; ++i) {
      var p = tree.node[i];
      p.y =
        p.child.length && !p.hidden
          ? (p.child[0].y + p.child[p.child.length - 1].y) / 2.0 + baseY
          : j++ / scale + baseY;
      if (p.child.length == 0) p.miny = p.maxy = p.y;
      else {
        p.miny = p.child[0].miny + baseY;
        p.maxy = p.child[p.child.length - 1].maxy + baseY;
      }
    }
    totalHeight += treeSpacing; // Increase total height for next tree
  });

  // Calculate X-coordinates ensuring all trees fit within the same width
  let globalScale = 1.0;
  trees.forEach((tree) => {
    let scale;
    if (is_real) {
      var root = tree.node[tree.node.length - 1];
      scale = root.x = root.d >= 0.0 ? root.d : 0.0;
      for (let i = tree.node.length - 2; i >= 0; --i) {
        var p = tree.node[i];
        p.x = p.parent.x + (p.d >= 0.0 ? p.d : 0.0);
        if (p.x > scale) scale = p.x;
      }
      if (scale == 0.0) is_real = false;
    }
    if (!is_real) {
      scale = tree.node[tree.node.length - 1].x = 1.0;
      for (let i = tree.node.length - 2; i >= 0; --i) {
        var p = tree.node[i];
        p.x = p.parent.x + 1.0;
        if (p.x > scale) scale = p.x;
      }
      for (let i = 0; i < tree.node.length - 1; ++i)
        if (tree.node[i].child.length == 0) tree.node[i].x = scale;
    }
    globalScale = Math.max(globalScale, scale);
  });

  // // Rescale X-coordinates across all trees to normalize width
  // trees.forEach((tree) => {
  //   for (let i = 0; i < tree.node.length; ++i) {
  //     tree.node[i].x /= globalScale;
  //   }
  // });

  trees.forEach((tree) => {
    // tree.node.sort((a, b) => a.y - b.y);
    cleanup(tree)
  });

  return is_real;
}

function parseMultipleNewick(data) {
  let trees = [];
  let global_total_tips = 0
  let newickTrees = data.data.split(";").map(t => t.trim()).filter(t => t.length > 0); // Split trees by ";"

  for (let [index, newick] of newickTrees.entries()) {
    let [tree, total_tips] = processNewick(newick);
    global_total_tips += total_tips
    kn_calxy(tree, true)
    trees.push(tree);
}

  let all_nodes = []

  let number_tips = 0;

  trees.forEach((tree, treeIndex) => {
    tree.node.sort((a, b) => a.y - b.y);
    let space = 500
    let scale = 2000
    if (treeIndex>0){
      scale = scale+space
    }
    number_tips = cleanup(tree, treeIndex, treeIndex*(scale+space) ,++treeIndex*scale, number_tips)
  })
  const tree_positions = []

  trees.forEach((tree) => {
    const tree_y = tree.node.map((x) => x.y)
    tree_positions.push({
      y: Math.min(...tree_y),
      text: "0"
    })
    
    tree_positions.push({
      y: Math.max(...tree_y),
      text: "100"
    })
    all_nodes = all_nodes.concat(tree.node)
  })

  const overallMaxX = reduceMaxOrMin(all_nodes, (x) => x.x_dist, "max");
  const overallMinX = reduceMaxOrMin(all_nodes, (x) => x.x_dist, "min");
  const overallMaxY = reduceMaxOrMin(all_nodes, (x) => x.y, "max");
  const overallMinY = reduceMaxOrMin(all_nodes, (x) => x.y, "min");
  const y_positions = all_nodes.map((x) => x.y);

  const output = {
    nodes: all_nodes,
    overallMaxX,
    overallMaxY,
    overallMinX,
    overallMinY,
    y_positions,
    tree_positions,
    mutations: [],
    node_to_mut: {},
    rootMutations: [],
    rootId: 0,
    overwrite_config: { num_tips: global_total_tips, from_newick: true },
  };
  return output;
}

export async function processNewickAndMetadata(data, sendStatusMessage) {

  // const treePromise = processNewick(data, sendStatusMessage);
  const treePromise = parseMultipleNewick(data, sendStatusMessage)

  let tree, metadata_double;
  let metadata = new Map();
  let headers = [];
  const metadataInput = data.metadata;
  if (!metadataInput) {
    tree = await treePromise;
  } else {
    // Wait for both promises to resolve
    [tree, metadata_double] = await Promise.all([
      treePromise,
      processMetadataFile(metadataInput, sendStatusMessage),
    ]);
    [metadata, headers] = metadata_double;
  }

  const blanks = Object.fromEntries(
    headers.slice(1).map((x) => ["meta_" + x, ""])
  );

  const all_keys = new Set();
  tree.nodes.forEach((node) => {
    // get all the keys that start with "meta_"
    const meta_keys = Object.keys(node).filter((x) => x.startsWith("meta_"));
    // add them to the set
    meta_keys.forEach((key) => {
      all_keys.add(key);
    });
  });
  // update the blanks object to include all the keys
  all_keys.forEach((key) => {
    if (!blanks[key]) {
      blanks[key] = "";
    }
  });

  const blanksList = Object.entries(blanks);

  sendStatusMessage({
    message: "Assigning metadata to nodes",
  });
  tree.nodes.forEach((node) => {
    const this_metadata = metadata.get(node.name);
    // add blanks for any properties not currently set
    blanksList.forEach(([key, value]) => {
      if (!node[key]) {
        node[key] = value;
      }
    });

    if (this_metadata) {
      Object.assign(node, this_metadata);
    }
  });

  return tree;
}
