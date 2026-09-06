Football card skins
===================

Files
-----
index.html      showcase page, six cards
style.css       all card design CSS
card-shape.js   injects the silhouette <clipPath> (needed once per page)
assets/player.png  placeholder player cut-out

Integration
-----------
1. Link style.css and load card-shape.js (or paste the <svg><clipPath id="pitch-card-shape">
   block straight into your HTML).
2. Copy one card's markup:

   <div class="pitch-card card-gold">
     <div class="card-body"><div class="card-pattern"></div><div class="card-shine"></div></div>
     <div class="card-edge"></div>
     <div class="card-player"><img src="player.png" alt=""></div>
     <div class="card-meta"><div class="rating">92</div><div class="position">ST</div></div>
     <div class="card-name">Player Name</div>
     <div class="card-stats">
       <div class="stat"><span class="stat-value">98</span><span class="stat-label">PAC</span></div>
       ... SHO PAS DRI DEF PHY ...
     </div>
   </div>

Skins:  .card-gold .card-silver .card-black .card-purple .card-white .card-red

CSS variables (set on .pitch-card, or inline per card)
------------------------------------------------------
--card-width / --card-height    size; everything inside scales from --card-width
--player-width / --player-x / --player-y / --player-scale / --player-fit
--meta-top / --meta-left        rating + position block
--name-bottom                   name band (the player image area is derived from it)
--stats-bottom                  stat strip
--silhouette                    the clip-path reference
