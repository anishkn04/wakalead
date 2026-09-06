/* Injects the card silhouette <clipPath> once per document.
   The CSS refers to it as: --silhouette: url(#pitch-card-shape); */
(function () {
  if (document.getElementById('pitch-card-shape')) return;
  var NS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  var defs = document.createElementNS(NS, 'defs');
  var cp = document.createElementNS(NS, 'clipPath');
  cp.setAttribute('id', 'pitch-card-shape');
  cp.setAttribute('clipPathUnits', 'objectBoundingBox');
  var p = document.createElementNS(NS, 'path');
  p.setAttribute('d', 'M0.030,0.008 L0.970,0.008 C0.990,0.008 1,0.016 1,0.030 L1,0.800 C0.95,0.856 0.88,0.881 0.80,0.902 C0.68,0.928 0.58,0.946 0.50,1 C0.42,0.946 0.32,0.928 0.20,0.902 C0.12,0.881 0.05,0.856 0,0.800 L0,0.030 C0,0.016 0.010,0.008 0.030,0.008 Z');
  cp.appendChild(p);
  defs.appendChild(cp);
  svg.appendChild(defs);
  document.body.appendChild(svg);
})();
