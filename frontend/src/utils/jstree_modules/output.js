/* convert a tree to the New Hampshire string */
export function kn_write_nh(tree) {
  // calculate the depth of each node
  tree.node[tree.node.length - 1].depth = 0;
  for (var i = tree.node.length - 2; i >= 0; --i) {
    var p = tree.node[i];
    p.depth = p.parent.depth + 1;
  }
  // generate the string
  var str = "";
  var cur_depth = 0,
    is_first = 1;
  for (var i = 0; i < tree.node.length; ++i) {
    var p = tree.node[i];
    var n_bra = p.depth - cur_depth;
    if (n_bra > 0) {
      if (is_first) is_first = 0;
      else str += ",\n";
      for (var j = 0; j < n_bra; ++j) str += "(";
    } else if (n_bra < 0) str += "\n)";
    else str += ",\n";
    if (p.name) str += String(p.name);
    if (p.d >= 0.0) str += ":" + p.d;
    if (p.meta) str += p.meta;
    cur_depth = p.depth;
  }
  str += "\n";
  return str;
}

/* print the tree topology (for debugging only) */
export function kn_check_tree(tree) {
  document.write("<table border=1><tr><th>name<th>id<th>dist<th>x<th>y</tr>");
  for (var i = 0; i < tree.node.length; ++i) {
    var p = tree.node[i];
    document.write(
      "<tr>" +
        "<td>" +
        p.name +
        "<td>" +
        i +
        "<td>" +
        p.d +
        "<td>" +
        p.x +
        "<td>" +
        p.y +
        "</tr>"
    );
  }
  document.write("</table>");
}
