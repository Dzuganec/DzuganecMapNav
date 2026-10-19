
const V='dz-v6',SHELL=V+'-shell',TILES=V+'-tiles';
const ASSETS=['./','./index.html','./manifest.json','./icon.svg','https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css','https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js'];
const TILE_HOSTS=['openfreemap.org','arcgisonline.com','fonts.googleapis.com','fonts.gstatic.com'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(SHELL).then(c=>Promise.all(ASSETS.map(a=>c.add(a).catch(()=>{})))));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>!x.startsWith(V)).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);if(!/^https?:$/.test(u.protocol))return;
  if(TILE_HOSTS.some(h=>u.host.endsWith(h))){
    e.respondWith(caches.open(TILES).then(async c=>{const hit=await c.match(r);
      const net=fetch(r).then(res=>{if(res.ok||res.type==='opaque')c.put(r,res.clone());return res}).catch(()=>hit||new Response('',{status:408}));
      return hit||net}));return}
  if(u.origin===location.origin||u.host==='unpkg.com'){
    e.respondWith(fetch(r).then(res=>{if(res.ok)caches.open(SHELL).then(c=>c.put(r,res.clone()));return res}).catch(()=>caches.match(r).then(h=>h||caches.match('./index.html'))))}
  // Nominatim / OSRM / Overpass: без кэша SW, приложение само хранит данные в IndexedDB
});
