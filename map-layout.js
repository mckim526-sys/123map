// Deterministic agency views: preserve every person and draw only recorded relations.
function agencyMapLayout(people, rootId, related) {
  const root = people.find(p => p.id === rootId) || people[0];
  if (!root) return { positions: [], edges: [] };
  const ordered = [root, ...people.filter(p => p !== root)];
  const nodes = ordered.map((p, i) => {
    const angle = (i - 1) * 2.39996323;
    const radius = Math.sqrt(i / Math.max(1, ordered.length - 1));
    return { p, x: i ? 450 + 360 * radius * Math.cos(angle) : 450,
      y: i ? 292 + 235 * radius * Math.sin(angle) : 292, degree: 0 };
  });
  const links = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    if (related(nodes[i].p, nodes[j].p)) {
      links.push([i, j]); nodes[i].degree++; nodes[j].degree++;
    }
  }
  // Repulsion protects labels; springs keep each recorded case group together.
  for (let step = 0; step < 420; step++) {
    const force = nodes.map(n => ({ x: (450 - n.x) * .006, y: (292 - n.y) * .006 }));
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      let dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      if (!dx && !dy) dx = 1;
      const repulsion = Math.min(15, 1900 / (distance * distance));
      const fx = dx / distance * repulsion, fy = dy / distance * repulsion;
      force[i].x -= fx; force[i].y -= fy; force[j].x += fx; force[j].y += fy;
    }
    for (const [i, j] of links) {
      const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const ideal = (i === 0 || j === 0) ? 145 : 95;
      const pull = (distance - ideal) * .014;
      force[i].x += dx / distance * pull; force[i].y += dy / distance * pull;
      force[j].x -= dx / distance * pull; force[j].y -= dy / distance * pull;
    }
    nodes.forEach((n, i) => {
      if (!i) return;
      n.x = Math.max(50, Math.min(850, n.x + Math.max(-5, Math.min(5, force[i].x))));
      n.y = Math.max(50, Math.min(550, n.y + Math.max(-5, Math.min(5, force[i].y))));
    });
  }
  const scaleX = 400 / Math.max(1, ...nodes.map(n => Math.abs(n.x - 450)));
  const scaleY = 245 / Math.max(1, ...nodes.map(n => Math.abs(n.y - 292)));
  const positions = nodes.map((n, i) => ({ p: n.p, x: 50 + (n.x - 450) * scaleX / 9, y: 47 + (n.y - 292) * scaleY / 6.2, major: !i || n.degree >= 3 }));
  // A minimum spanning forest retains indirect links without a tangle of duplicate lines.
  const parent = nodes.map((_, i) => i);
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  links.sort(([a, b], [c, d]) => Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y) - Math.hypot(nodes[c].x - nodes[d].x, nodes[c].y - nodes[d].y));
  const edges = [];
  for (const [a, b] of links) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) { parent[ra] = rb; edges.push([positions[a], positions[b]]); }
  }
  return { positions, edges };
}

// Place the entire dot + name rectangle, not just the point. Units are rendered pixels.
function separateMapLabels(positions, rootId, width, height, bounds) {
  const padding = 8, gap = 7;
  const nodes = positions.map((v, i) => ({ v, i, x: v.x * width / 100, y: v.y * height / 100, box: bounds[i] }));
  const clamp = n => {
    n.x = Math.max(padding - n.box.left, Math.min(width - padding - n.box.right, n.x));
    n.y = Math.max(padding - n.box.top, Math.min(height - padding - n.box.bottom, n.y));
  };
  const overlaps = (a, b) => a.x + a.box.right + gap > b.x + b.box.left && b.x + b.box.right + gap > a.x + a.box.left && a.y + a.box.bottom + gap > b.y + b.box.top && b.y + b.box.bottom + gap > a.y + a.box.top;
  const placed = [];
  // Keep the central person and larger hubs stable; move only conflicting labels as needed.
  const order = [...nodes].sort((a, b) => Number(b.v.p.id === rootId) - Number(a.v.p.id === rootId) || Number(b.v.major) - Number(a.v.major) || a.i - b.i);
  for (const node of order) {
    clamp(node);
    if (placed.some(p => overlaps(node, p))) {
      const original = { x: node.x, y: node.y };
      let best = null, bestDistance = Infinity;
      // An exhaustive small pixel grid gives a deterministic nearest free location.
      for (let y = padding - node.box.top; y <= height - padding - node.box.bottom; y += 8) {
        for (let x = padding - node.box.left; x <= width - padding - node.box.right; x += 8) {
          const distance = (x - original.x) ** 2 + (y - original.y) ** 2;
          if (distance >= bestDistance) continue;
          const candidate = { x, y, box: node.box };
          if (!placed.some(p => overlaps(candidate, p))) { best = candidate; bestDistance = distance; }
        }
      }
      if (best) { node.x = best.x; node.y = best.y; }
    }
    placed.push(node);
    node.v.x = node.x / width * 100; node.v.y = node.y / height * 100;
  }
}
