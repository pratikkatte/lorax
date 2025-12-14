/* Calculate the coordinate of each node */
export function kn_calxy(tree, is_real) {
  var i, j, scale;
  // calculate y
  scale = tree.n_tips - 1;
  for (let i = (j = 0); i < tree.node.length; ++i) {
    var p = tree.node[i];
    p.y =
      p.child.length && !p.hidden
        ? (p.child[0].y + p.child[p.child.length - 1].y) / 2.0
        : j++ / scale;
    if (p.child.length == 0) p.miny = p.maxy = p.y;
    else
      (p.miny = p.child[0].miny), (p.maxy = p.child[p.child.length - 1].maxy);
  }
  // calculate x
  if (is_real) {
    // use branch length
    var root = tree.node[tree.node.length - 1];
    scale = root.x = root.d >= 0.0 ? root.d : 0.0;
    for (let i = tree.node.length - 2; i >= 0; --i) {
      var p = tree.node[i];
      if (p.parent) {
        p.x = p.parent.x + (p.d >= 0.0 ? p.d : 0.0);
      } else {
        p.x = (p.d >= 0.0 ? p.d : 0.0);
      }
      if (p.x > scale) scale = p.x;
    }
    if (scale == 0.0) is_real = false;
  }
  if (!is_real) {
    // no branch length
    scale = tree.node[tree.node.length - 1].x = 1.0;
    for (let i = tree.node.length - 2; i >= 0; --i) {
      var p = tree.node[i];
      if (p.parent) {
        p.x = p.parent.x + 1.0;
      } else {
        p.x = 1.0;
      }
      if (p.x > scale) scale = p.x;
    }
    for (let i = 0; i < tree.node.length - 1; ++i)
      if (tree.node[i].child.length == 0) tree.node[i].x = scale;
  }
  // rescale x
  for (let i = 0; i < tree.node.length; ++i) tree.node[i].x /= scale;
  return is_real;
}

export function kn_global_calxy(tree, globalMinTime = null, globalMaxTime = null, startTime = 0) {
  let i, j, scale;

  let is_real = true;

  // --------- Y COORDINATES ---------
  scale = tree.n_tips - 1;
  for (i = j = 0; i < tree.node.length; ++i) {
    const p = tree.node[i];
    p.y = (p.child.length && !p.hidden)
      ? (p.child[0].y + p.child[p.child.length - 1].y) / 2.0
      : j++ / scale;

    if (p.child.length === 0) {
      p.miny = p.maxy = p.y;
    } else {
      p.miny = p.child[0].miny;
      p.maxy = p.child[p.child.length - 1].maxy;
    }
  }

  // --------- X COORDINATES (Time) ---------
  if (is_real) {
    const root = tree.node[tree.node.length - 1];
    scale = root.x = root.d >= 0.0 ? root.d : 0.0;

    for (i = tree.node.length - 2; i >= 0; --i) {
      const p = tree.node[i];
      if (p.parent) {
        p.x = p.parent.x + (p.d >= 0.0 ? p.d : 0.0);
      } else {
        p.x = (p.d >= 0.0 ? p.d : 0.0);
      }
      if (p.x > scale) scale = p.x;
    }

    if (scale === 0.0) is_real = false;

    // if (!startTime) startTime = -1*(scale-1);
  }

  if (!is_real) {
    
    scale = tree.node[tree.node.length - 1].x = 1.0;

    for (i = tree.node.length - 2; i >= 0; --i) {
      const p = tree.node[i];
      if (p.parent) {
        p.x = p.parent.x + 1.0;
      } else {
        p.x = 1.0;
      }
      if (p.x > scale) scale = p.x;
    }

    for (i = 0; i < tree.node.length - 1; ++i) {
      if (tree.node[i].child.length === 0) {
        tree.node[i].x = scale;
      }
    }
    // startTime = -1*(scale-1);
  }


  const applyGlobalNormalization = globalMinTime !== null && globalMaxTime !== null;
  const range = applyGlobalNormalization ? (globalMaxTime - globalMinTime || 1) : 1;

  // console.log("scale", scale, applyGlobalNormalization);

  for (i = 0; i < tree.node.length; ++i) {
    let x = tree.node[i].x + startTime;
    if (applyGlobalNormalization) {
      x = (x - globalMinTime) / range;
    }

    tree.node[i].x = Math.min(x, 1); // clipping it not to prevent overflow. But FIX IT later. 
    // tree.node[i].x = x;
  }

  return is_real; // return the number of nodes
}

export function kn_get_node(tree, conf, x, y) {
  if (conf.is_circular) {
    for (var i = 0; i < tree.node.length; ++i) {
      var p = tree.node[i];
      var tmp_x = Math.floor(
        conf.width / 2 +
          p.x * conf.real_r * Math.cos(p.y * conf.full_arc) +
          0.999
      );
      var tmp_y = Math.floor(
        conf.height / 2 +
          p.x * conf.real_r * Math.sin(p.y * conf.full_arc) +
          0.999
      );
      var tmp_l = 2;
      if (
        x >= tmp_x - tmp_l &&
        x <= tmp_x + tmp_l &&
        y >= tmp_y - tmp_l &&
        y <= tmp_y + tmp_l
      )
        return i;
    }
  } else {
    for (var i = 0; i < tree.node.length; ++i) {
      var tmp_x = tree.node[i].x * conf.real_x + conf.shift_x;
      var tmp_y = tree.node[i].y * conf.real_y + conf.shift_y;
      var tmp_l = conf.box_width * 0.6;
      if (
        x >= tmp_x - tmp_l &&
        x <= tmp_x + tmp_l &&
        y >= tmp_y - tmp_l &&
        y <= tmp_y + tmp_l
      )
        return i;
    }
  }
  return tree.node.length;
}
