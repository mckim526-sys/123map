// Map hover: entering the map fades every line; pointing at a person lights up that person,
// the people they are drawn connected to, and the lines between them.
(function () {
  const graph = document.getElementById('graph');
  if (!graph || !matchMedia('(hover: hover)').matches) return;
  let current = null;
  function clear() {
    graph.querySelectorAll('.hover-node,.hover-peer,.hover-peer-weak').forEach(el => el.classList.remove('hover-node', 'hover-peer', 'hover-peer-weak'));
    graph.querySelectorAll('.hover-edge').forEach(el => el.classList.remove('hover-edge'));
    graph.classList.remove('pointing');
    current = null;
  }
  function light(id) {
    if (id === current) return;
    clear(); current = id;
    graph.classList.add('pointing');
    // Same-trial lines (co-edge) are lit strongly; other relations stay thin and dashed.
    const strong = new Set(), weak = new Set();
    graph.querySelectorAll('#edges .edge').forEach(edge => {
      const {from, to} = edge.dataset;
      if (from !== id && to !== id) return;
      edge.classList.add('hover-edge');
      (edge.classList.contains('co-edge') ? strong : weak).add(from === id ? to : from);
    });
    graph.querySelectorAll('#nodes .node').forEach(node => {
      if (node.dataset.id === id) node.classList.add('hover-node');
      else if (strong.has(node.dataset.id)) node.classList.add('hover-peer');
      else if (weak.has(node.dataset.id)) node.classList.add('hover-peer-weak');
    });
  }
  graph.addEventListener('mouseenter', () => graph.classList.add('hovering'));
  graph.addEventListener('mouseleave', () => { graph.classList.remove('hovering'); clear(); });
  graph.addEventListener('mouseover', e => {
    const node = e.target.closest('#nodes .node');
    if (node) { light(node.dataset.id); return; }
    const edge = e.target.closest('#edges .edge');
    if (edge) { clear(); edge.classList.add('hover-edge'); graph.classList.add('pointing');
      graph.querySelectorAll('#nodes .node').forEach(n => { if (n.dataset.id === edge.dataset.from || n.dataset.id === edge.dataset.to) n.classList.add('hover-peer'); });
      return; }
    if (current) clear();
  });
})();
