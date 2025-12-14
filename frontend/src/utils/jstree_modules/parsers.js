// Private method
function kn_new_node() {
  return {
    parent: null,
    child: [],
    name: "",
    meta: "",
    d: -1.0,
    hl: false,
    hidden: false,
  };
}

// Private method
function kn_add_node(str, l, tree, x) {
  let i;
  var r,
    beg,
    end = 0,
    z;
  z = kn_new_node();
  for (
    i = l, beg = l;
    i < str.length && str.charAt(i) != "," && str.charAt(i) != ")";
    ++i
  ) {
    var c = str.charAt(i);
    if (c == "[") {
      var meta_beg = i;
      if (end == 0) end = i;
      do ++i;
      while (i < str.length && str.charAt(i) != "]");
      if (i == str.length) {
        tree.error |= 4;
        break;
      }
      z.meta = str.substr(meta_beg, i - meta_beg + 1);
    } else if (c == ":") {
      if (end == 0) end = i;
      for (var j = ++i; i < str.length; ++i) {
        var cc = str.charAt(i);
        if (
          (cc < "0" || cc > "9") &&
          cc != "e" &&
          cc != "E" &&
          cc != "+" &&
          cc != "-" &&
          cc != "."
        )
          break;
      }
      z.d = parseFloat(str.substr(j, i - j));
      --i;
    } else if (c < "!" && c > "~" && end == 0) end = i;
  }
  if (end == 0) end = i;
  if (end > beg) z.name = str.substr(beg, end - beg);
  tree.node.push(z);
  return i;
}

export function kn_parse(str) {
  var stack = new Array();
  var tree = new Object();
  tree.error = tree.n_tips = 0;
  tree.node = new Array();
  for (var l = 0; l < str.length; ) {
    while (l < str.length && (str.charAt(l) < "!" || str.charAt(l) > "~")) ++l;
    if (l == str.length) break;
    var c = str.charAt(l);
    if (c == ",") ++l;
    else if (c == "(") {
      stack.push(-1);
      ++l;
    } else if (c == ")") {
      let x, m, i;
      x = tree.node.length;
      for (i = stack.length - 1; i >= 0; --i) if (stack[i] < 0) break;
      if (i < 0) {
        tree.error |= 1;
        break;
      }
      m = stack.length - 1 - i;
      l = kn_add_node(str, l + 1, tree, m);
      for (i = stack.length - 1, m = m - 1; m >= 0; --m, --i) {
        tree.node[x].child[m] = tree.node[stack[i]];
        tree.node[stack[i]].parent = tree.node[x];
      }
      stack.length = i;
      stack.push(x);
    } else {
      ++tree.n_tips;
      stack.push(tree.node.length);
      l = kn_add_node(str, l, tree, 0);
    }
  }
  if (stack.length > 1) tree.error |= 2;
  tree.root = tree.node[tree.node.length - 1];
  return tree;
}

export function kn_parse_many(str) {
  const tree = {
    error: 0,
    n_tips: 0,
    node: []
  };
  
  // Remove newlines and trim
  str = str.replace(/[\r\n]+/g, "").trim();
  
  // Split by semicolon, but filter out empty strings
  const parts = str.split(';').filter(p => p.trim().length > 0);
  
  for (let part of parts) {
      const subTree = kn_parse(part);
      if (subTree.error) tree.error |= subTree.error;
      tree.n_tips += subTree.n_tips;
      
      // Concatenate nodes
      tree.node = tree.node.concat(subTree.node);
  }
  
  // Set root to the last node (convention)
  if (tree.node.length > 0) {
    tree.root = tree.node[tree.node.length - 1];
  }
  
  return tree;
}

function kn_parse_flat_list(str) {
  const tree = {
    error: 0,
    n_tips: 0,
    node: [],
  };

  const root = kn_new_node();
  tree.node.push(root);

  const names = str.split(";").filter(n => n.trim().length > 0);
  
  for (const name of names) {
    const leaf = kn_new_node();
    leaf.name = name;
    leaf.parent = root;
    root.child.push(leaf);
    tree.node.push(leaf);
    tree.n_tips++;
  }

  tree.root = root;
  return tree;
}

export function kn_parse_auto(str) {
  const cleaned = str.trim();
  if (cleaned.includes("(") || cleaned.includes(")")) {
    // return kn_parse(cleaned); // assume it's proper Newick
    return kn_parse_many(cleaned);
  } else {
    return kn_parse_flat_list(cleaned); // semicolon-separated list
  }
}

export { kn_new_node };
