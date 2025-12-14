import { kn_new_node } from "./parsers.js";

/* Expand the tree into an array in the finishing order */
export function kn_expand_node(root) {
  var node, stack;
  node = new Array();
  stack = new Array();
  stack.push({ p: root, i: 0 });
  for (;;) {
    while (
      stack[stack.length - 1].i != stack[stack.length - 1].p.child.length &&
      !stack[stack.length - 1].p.hidden
    ) {
      var q = stack[stack.length - 1];
      stack.push({ p: q.p.child[q.i], i: 0 });
    }
    node.push(stack.pop().p);
    if (stack.length > 0) ++stack[stack.length - 1].i;
    else break;
  }
  return node;
}

/* Count the number of leaves */
export function kn_count_tips(tree) {
  tree.n_tips = 0;
  for (var i = 0; i < tree.node.length; ++i)
    if (tree.node[i].child.length == 0 || tree.node[i].hidden) ++tree.n_tips;
  return tree.n_tips;
}

/* Highlight: set node.hl for leaves matching "pattern" */
export function kn_search_leaf(tree, pattern) {
  var re = null;
  if (pattern != null && pattern != "") {
    re = new RegExp(pattern, "i");
    if (re == null) alert("Wrong regular expression: '" + pattern + "'");
  }
  for (var i = 0; i < tree.node.length; ++i) {
    var p = tree.node[i];
    if (p.child.length == 0)
      p.hl = re != null && re.test(p.name) ? true : false;
  }
}

/* Remove: delete a node and all its descendants */
export function kn_remove_node(tree, node) {
  var root = tree.node[tree.node.length - 1];
  if (node == root) return;

  var z = kn_new_node();
  z.child.push(root);
  root.parent = z;

  var p = node.parent,
    i;
  if (p.child.length == 2) {
    // then p will be removed
    var q,
      r = p.parent;
    i = p.child[0] == node ? 0 : 1;
    q = p.child[1 - i]; // the other child
    q.d += p.d;
    q.parent = r;
    for (let i = 0; i < r.child.length; ++i) if (r.child[i] == p) break;
    r.child[i] = q;
    p.parent = null;
  } else {
    var j, k;
    for (let i = 0; i < p.child.length; ++i) if (p.child[i] == node) break;
    for (j = k = 0; j < p.child.length; ++j) {
      p.node[k] = p.node[j];
      if (j != i) ++k;
    }
    --p.child.length;
  }

  root = z.child[0];
  root.parent = null;
  return root;
}

/* Move: prune the subtree descending from p and regragh it to the edge between q and its parent */
export function kn_move_node(tree, p, q) {
  var root = tree.node[tree.node.length - 1];
  if (p == root) return null; // p cannot be root
  for (var r = q; r.parent; r = r.parent) if (r == p) return null; // p is an ancestor of q. We cannot move in this case.

  root = kn_remove_node(tree, p);

  var z = kn_new_node(); // a fake root
  z.child.push(root);
  root.parent = z;

  var i,
    r = q.parent;
  for (let i = 0; i < r.child.length; ++i) if (r.child[i] == q) break;
  var s = kn_new_node(); // a new node
  s.parent = r;
  r.child[i] = s;
  if (q.d >= 0.0) {
    s.d = q.d / 2.0;
    q.d /= 2.0;
  }
  s.child.push(p);
  p.parent = s;
  s.child.push(q);
  q.parent = s;

  root = z.child[0];
  root.parent = null;
  return root;
}

/* Reroot: put the root in the middle of node and its parent */
export function kn_reroot(root, node, dist) {
  var i, d, tmp;
  var p, q, r, s, new_root;
  if (node == root) return root;
  if (dist < 0.0 || dist > node.d) dist = node.d / 2.0;
  tmp = node.d;

  /* p: the central multi-parent node
   * q: the new parent, previous a child of p
   * r: old parent
   * i: previous position of q in p
   * d: previous distance p->d
   */
  q = new_root = kn_new_node();
  q.child[0] = node;
  q.child[0].d = dist;
  p = node.parent;
  q.child[0].parent = q;
  for (let i = 0; i < p.child.length; ++i) if (p.child[i] == node) break;
  q.child[1] = p;
  d = p.d;
  p.d = tmp - dist;
  r = p.parent;
  p.parent = q;
  while (r != null) {
    s = r.parent; /* store r's parent */
    p.child[i] = r; /* change r to p's child */
    for (let i = 0; i < r.child.length; ++i /* update i */)
      if (r.child[i] == p) break;
    r.parent = p; /* update r's parent */
    tmp = r.d;
    r.d = d;
    d = tmp; /* swap r->d and d, i.e. update r->d */
    q = p;
    p = r;
    r = s; /* update p, q and r */
  }
  /* now p is the root node */
  if (p.child.length == 2) {
    /* remove p and link the other child of p to q */
    r = p.child[1 - i]; /* get the other child */
    for (let i = 0; i < q.child.length; ++i /* the position of p in q */)
      if (q.child[i] == p) break;
    r.d += p.d;
    r.parent = q;
    q.child[i] = r; /* link r to q */
  } else {
    /* remove one child in p */
    var j, k;
    for (j = k = 0; j < p.child.length; ++j) {
      p.child[k] = p.child[j];
      if (j != i) ++k;
    }
    --p.child.length;
  }
  return new_root;
}

export function kn_multifurcate(p) {
  var i, par, idx, tmp, old_length;
  if (p.child.length == 0 || !p.parent) return;
  par = p.parent;
  for (let i = 0; i < par.child.length; ++i) if (par.child[i] == p) break;
  idx = i;
  tmp = par.child.length - idx - 1;
  old_length = par.child.length;
  par.child.length += p.child.length - 1;
  for (let i = 0; i < tmp; ++i)
    par.child[par.child.length - 1 - i] = par.child[old_length - 1 - i];
  for (let i = 0; i < p.child.length; ++i) {
    p.child[i].parent = par;
    if (p.child[i].d >= 0 && p.d >= 0) p.child[i].d += p.d;
    par.child[i + idx] = p.child[i];
  }
}

export function kn_reorder(root) {
  const sort_leaf = function (a, b) {
    if (a.depth < b.depth) return 1;
    if (a.depth > b.depth) return -1;
    return String(a.name) < String(b.name)
      ? -1
      : String(a.name) > String(b.name)
      ? 1
      : 0;
  };
  const sort_weight = function (a, b) {
    return a.weight / a.n_tips - b.weight / b.n_tips;
  };

  var x = new Array();
  var i,
    node = kn_expand_node(root);
  // get depth
  node[node.length - 1].depth = 0;
  for (let i = node.length - 2; i >= 0; --i) {
    var q = node[i];
    q.depth = q.parent.depth + 1;
    if (q.child.length == 0) x.push(q);
  }
  // set weight for leaves
  x.sort(sort_leaf);
  for (let i = 0; i < x.length; ++i) (x[i].weight = i), (x[i].n_tips = 1);
  // set weight for internal nodes
  for (let i = 0; i < node.length; ++i) {
    var q = node[i];
    if (q.child.length) {
      // internal
      var j,
        n = 0,
        w = 0;
      for (j = 0; j < q.child.length; ++j) {
        n += q.child[j].n_tips;
        w += q.child[j].weight;
      }
      q.n_tips = n;
      q.weight = w;
    }
  }
  // swap children
  for (let i = 0; i < node.length; ++i)
    if (node[i].child.length >= 2) node[i].child.sort(sort_weight);
}

export function kn_reorder_num_tips(root) {
  const sort_leaf = function (a, b) {
    return a.num_tips - b.num_tips;
  };

  const sort_weight = function (a, b) {
    return a.num_tips - b.num_tips;
  };

  var x = new Array();
  var i,
    node = kn_expand_node(root);
  // get depth
  node[node.length - 1].depth = 0;
  for (let i = node.length - 2; i >= 0; --i) {
    var q = node[i];
    q.depth = q.parent.depth + 1;
    if (q.child.length == 0) x.push(q);
  }
  // set weight for leaves
  x.sort(sort_leaf);
  for (let i = 0; i < x.length; ++i) (x[i].weight = i), (x[i].n_tips = 1);
  // set weight for internal nodes
  for (let i = 0; i < node.length; ++i) {
    var q = node[i];
    if (q.child.length) {
      // internal
      var j,
        n = 0,
        w = 0;
      for (j = 0; j < q.child.length; ++j) {
        n += q.child[j].n_tips;
        w += q.child[j].weight;
      }
      q.n_tips = n;
      q.weight = w;
    }
  }
  // swap children
  for (let i = 0; i < node.length; ++i)
    if (node[i].child.length >= 2) node[i].child.sort(sort_weight);
}
