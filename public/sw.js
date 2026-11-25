const CACHE='skladiste-shell-v2';
const SHELL=['/','/index.html','/manifest.webmanifest','/icon.svg'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api')||url.pathname.includes('/rpc'))return;
  if(request.mode==='navigate'||SHELL.includes(url.pathname)){
    event.respondWith(
      fetch(new Request(request,{cache:'no-store'}))
        .then(response=>{
          if(response.ok){
            const copy=response.clone();
            event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));
          }
          return response;
        })
        .catch(async()=>{
          return await caches.match(request)||await caches.match('/index.html')||Response.error();
        })
    );
  }
});
