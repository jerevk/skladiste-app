
const send=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const uid=()=>crypto.randomUUID();
const timestamp=()=>new Date().toISOString();
const randomHex=(n=16)=>Array.from(crypto.getRandomValues(new Uint8Array(n))).map(x=>x.toString(16).padStart(2,"0")).join("");
async function hashText(s){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(s)));return Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,"0")).join("")}
async function pinHash(pin,salt){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(String(pin)),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:new TextEncoder().encode(salt),iterations:100000,hash:"SHA-256"},key,256);return Array.from(new Uint8Array(bits)).map(x=>x.toString(16).padStart(2,"0")).join("")}
const bad=(msg,code=400)=>{const e=new Error(msg);e.status=code;throw e};
const text=(s,max=200)=>String(s??"").trim().slice(0,max);
const qty=(v,allowZero=false)=>{const n=Number(String(v??"").replace(",","."));if(!Number.isFinite(n)||n<0||(!allowZero&&n===0)||n>10000000)bad("Neispravna količina.");return Math.round(n*1000)/1000};
const modes=["pivo","pica","zesta","toplo","fridge"];
async function userFromToken(db,token){if(!token)bad("Sesija je istekla. Prijavi se ponovno.",401);const h=await hashText(token);const s=await db.prepare("SELECT u.id,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1").bind(h,Date.now()).first();if(!s)bad("Sesija je istekla. Prijavi se ponovno.",401);return s}
async function admin(db,token){const u=await userFromToken(db,token);if(u.role!=="ADMIN")bad("Samo administrator može mijenjati ove postavke.",403);return u}
async function allItems(db,category){const sql="SELECT id,category,group_name,name,qty,min_qty,price,capacity,linked_item_id,version FROM items WHERE active=1"+(category?" AND category=?":"")+" ORDER BY category,group_name,name";return (await db.prepare(sql).bind(...(category?[category]:[])).all()).results}
async function atomicMutations(db,changes,actor,note,kind){const queries=[];for(const c of changes){const after=Math.round((c.before+c.delta)*1000)/1000;if(after<0)bad(c.name+": nema dovoljno na skladištu.");if(c.capacity!==null&&c.capacity!==undefined&&after>c.capacity)bad(c.name+": količina prelazi kapacitet.");queries.push(db.prepare("UPDATE items SET qty=?,version=version+1 WHERE id=? AND version=? AND active=1").bind(after,c.id,c.version));queries.push(db.prepare("INSERT INTO guard_checks(ok) SELECT changes()"));queries.push(db.prepare("INSERT INTO movements(id,item_id,movement_type,delta,before_qty,after_qty,actor_id,note) VALUES(?,?,?,?,?,?,?,?)").bind(uid(),c.id,kind,c.delta,c.before,after,actor.id,note))}queries.push(db.prepare("DELETE FROM guard_checks"));try{await db.batch(queries)}catch(e){bad("Zalihe su se promijenile tijekom unosa. Osvježi podatke i pokušaj ponovno.",409)}}
async function getEntries(db,entries){if(!Array.isArray(entries)||!entries.length||entries.length>250)bad("Odaberi između 1 i 250 artikala.");const ids=entries.map(e=>text(e.key,100));if(new Set(ids).size!==ids.length)bad("Artikl se ne može unijeti dvaput.");const found=await Promise.all(ids.map(id=>db.prepare("SELECT * FROM items WHERE id=? AND active=1").bind(id).first()));if(found.some(x=>!x))bad("Jedan od artikala više nije aktivan.");return found}

const auditNames={appLogin:"Prijava",appLogout:"Odjava",appSaveCount:"Inventura / rupe",appSaveIncoming:"Primka robe",appCreateSupply:"Novi popis za donos",appSaveSupplyList:"Uređivanje donosa",appFinishSupply:"Završen donos",appCreateSnapshot:"Kopija stanja",appAdminEditUser:"Uređen konobar",appAdminAddUser:"Dodan konobar",appAdminDeleteUser:"Uklonjen konobar",appAdminAddItem:"Dodan artikl",appAdminRenameItem:"Uređen artikl",appAdminSetFridgeCapacity:"Kapacitet frižidera",appAdminSetItemPrice:"Promjena cijene",appAdminSetMinimum:"Promjena minimuma",appAdminDeleteItem:"Uklonjen artikl"};
async function auditDetail(db,method,args,result){
 if(["appSaveCount","appSaveIncoming"].includes(method)){
  const entries=method==="appSaveCount"?args[2]:args[1];
  const labels=await Promise.all((Array.isArray(entries)?entries:[]).map(async e=>{
   const it=await db.prepare("SELECT name,group_name FROM items WHERE id=?").bind(text(e.key,100)).first();
   return(it?.name||"Artikl")+" = "+text(e.value,30);
  }));
  return(method==="appSaveCount"?(args[1]==="fridge"?"Rupe: ":"Inventura "+text(args[1])+": "):"Primka: ")+labels.join("; ");
 }
 if(["appCreateSupply","appFinishSupply","appSaveSupplyList"].includes(method))return "Popis "+text(result?.listId||args[1],100)+" · "+(result?.saved||result?.updated||args[2]?.length||0)+" stavki"+(result?.reset?" · poništene potvrde":"");
 if(method==="appAdminAddUser")return "Ime: "+text(args[1],80);
 if(method==="appAdminEditUser")return "Korisnik: "+text(args[1])+" · novo ime: "+text(args[2],80)+(args[3]?" · promjena PIN-a":"");
 if(method==="appAdminAddItem")return text(args[1]?.item)+" / "+text(args[1]?.group);
 if(method==="appAdminRenameItem")return text(args[3])+" / "+text(args[2])+" ("+text(args[1])+")";
 if(["appAdminSetFridgeCapacity","appAdminSetItemPrice","appAdminSetMinimum"].includes(method))return "Artikl "+text(args[1])+" · nova vrijednost "+text(args[2]);
 if(method==="appAdminDeleteItem"||method==="appAdminDeleteUser")return "ID "+text(args[1]);
 return method==="appLogin"?"Uspješna prijava":method==="appLogout"?"Odjava":text(method);
}
async function recordAudit(db,actor,method,args,result,device){
 if(!auditNames[method])return;
 const description=await auditDetail(db,method,args,result);
 await db.prepare("INSERT INTO audit_events(id,user_id,actor_name,action,description,device_id,device_label) VALUES(?,?,?,?,?,?,?)")
 .bind(uid(),actor?.id||null,actor?.name||"Nepoznato",auditNames[method],text(description,900),text(device?.id,100),text(device?.label,90)).run();
}


const reversibleMethods=new Set(["appSaveCount","appSaveIncoming","appCreateSupply","appSaveSupplyList","appFinishSupply","appAdminSetFridgeCapacity","appAdminSetItemPrice","appAdminSetMinimum","appAdminRenameItem","appAdminDeleteItem"]);
async function stateForUndo(db,method,args,result){
 const ids=[];
 let requestId=null;
 if(method==="appSaveCount")for(const e of Array.isArray(args[2])?args[2]:[])ids.push(text(e.key,100));
 if(method==="appSaveIncoming"||method==="appCreateSupply")for(const e of Array.isArray(args[1])?args[1]:[])ids.push(text(e.key,100));
 if(method.startsWith("appAdmin"))ids.push(text(args[1],100));
 if(["appSaveSupplyList","appFinishSupply","appCreateSupply"].includes(method)){
  requestId=method==="appCreateSupply"?result?.listId:text(args[1],100);
  if(requestId){
   const request=await db.prepare("SELECT * FROM supply_requests WHERE id=?").bind(requestId).first();
   const lines=(await db.prepare("SELECT * FROM supply_lines WHERE request_id=? ORDER BY id").bind(requestId).all()).results;
   for(const line of lines)ids.push(line.item_id);
   const unique=[...new Set(ids.filter(Boolean))];
   const items=await Promise.all(unique.map(id=>db.prepare("SELECT * FROM items WHERE id=?").bind(id).first()));
   return{items:items.filter(Boolean),request,lines};
  }
 }
 const unique=[...new Set(ids.filter(Boolean))];
 const items=await Promise.all(unique.map(id=>db.prepare("SELECT * FROM items WHERE id=?").bind(id).first()));
 return{items:items.filter(Boolean),request:null,lines:[]};
}
const recordUndoFields=["qty","capacity","price","min_qty","group_name","name","active"];
function sameUndoValue(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function itemChanged(a,b){return recordUndoFields.some(k=>!sameUndoValue(a?.[k],b?.[k]))}
async function revertLastAudit(db,actor,pin,device){
 const secret=String(pin??"");
 if(!secret)bad("Upiši administratorski PIN.");
 const adminRow=await db.prepare("SELECT * FROM users WHERE id=? AND role='ADMIN' AND active=1").bind(actor.id).first();
 if(!adminRow)bad("Nedopuštena radnja.",403);
 if(adminRow.locked_until>Date.now())bad("Previše pogrešnih pokušaja. Pokušaj kasnije.",429);
 const verified=await pinHash(secret,adminRow.pin_salt);
 if(verified!==adminRow.pin_hash){
  const attempts=adminRow.failed_attempts+1;
  await db.prepare("UPDATE users SET failed_attempts=?,locked_until=? WHERE id=?").bind(attempts,attempts>=5?Date.now()+15*60*1000:0,actor.id).run();
  bad("Pogrešan administratorski PIN.",403);
 }
 await db.prepare("UPDATE users SET failed_attempts=0,locked_until=0 WHERE id=?").bind(actor.id).run();
 // Undo applies only to the latest changed operation, not an arbitrary older record.
 const last=await db.prepare("SELECT a.id,a.action,a.description,u.before_json,u.after_json,u.undone_at FROM audit_events a LEFT JOIN audit_undo u ON u.audit_id=a.id WHERE a.action NOT IN ('Prijava','Odjava','Poništena radnja') ORDER BY a.rowid DESC LIMIT 1").first();
 if(!last||!last.before_json||last.undone_at)bad("Posljednja promjena nema sigurne podatke za poništavanje.");
 const before=JSON.parse(last.before_json),after=JSON.parse(last.after_json);
 const prior=new Map(before.items.map(i=>[i.id,i]));
 const expected=new Map(after.items.map(i=>[i.id,i]));
 const current=await Promise.all(after.items.map(i=>db.prepare("SELECT * FROM items WHERE id=?").bind(i.id).first()));
 if(current.some((it,i)=>!it||it.version!==after.items[i].version||recordUndoFields.some(k=>!sameUndoValue(it[k],after.items[i][k]))))bad("U međuvremenu je promijenjeno stanje artikla. Poništavanje nije sigurno.",409);
 const requestId=after.request?.id||before.request?.id;
 if(requestId){
  const nowReq=await db.prepare("SELECT * FROM supply_requests WHERE id=?").bind(requestId).first();
  const nowLines=(await db.prepare("SELECT * FROM supply_lines WHERE request_id=? ORDER BY id").bind(requestId).all()).results;
  if(!sameUndoValue(nowReq,after.request)||!sameUndoValue(nowLines,after.lines))bad("Popis je u međuvremenu promijenjen. Poništavanje nije sigurno.",409);
 }
 const q=[];
 for(const afterIt of after.items){
  const old=prior.get(afterIt.id);
  if(!old)bad("Nije moguće poništiti nastanak nepoznatog artikla.",409);
  if(!itemChanged(old,afterIt))continue;
  q.push(db.prepare("UPDATE items SET qty=?,capacity=?,price=?,min_qty=?,group_name=?,name=?,active=?,version=version+1 WHERE id=? AND version=?")
   .bind(old.qty,old.capacity,old.price,old.min_qty,old.group_name,old.name,old.active,old.id,afterIt.version));
  q.push(db.prepare("INSERT INTO guard_checks(ok) SELECT changes()"));
  if(old.qty!==afterIt.qty)q.push(db.prepare("INSERT INTO movements(id,item_id,movement_type,delta,before_qty,after_qty,actor_id,note) VALUES(?,?,?,?,?,?,?,?)")
   .bind(uid(),old.id,"PONISTAVANJE",Math.round((old.qty-afterIt.qty)*1000)/1000,afterIt.qty,old.qty,actor.id,"Poništen log "+last.id));
 }
 if(requestId){
  if(!before.request){
   q.push(db.prepare("DELETE FROM supply_lines WHERE request_id=?").bind(requestId));
   q.push(db.prepare("DELETE FROM supply_requests WHERE id=? AND status=?").bind(requestId,after.request.status));
   q.push(db.prepare("INSERT INTO guard_checks(ok) SELECT changes()"));
  }else{
   const oldReq=before.request;
   q.push(db.prepare("UPDATE supply_requests SET status=?,confirmed_by=?,confirmed_at=?,note=? WHERE id=? AND status=?").bind(oldReq.status,oldReq.confirmed_by,oldReq.confirmed_at,oldReq.note,requestId,after.request.status));
   q.push(db.prepare("INSERT INTO guard_checks(ok) SELECT changes()"));
   const priorLines=new Map(before.lines.map(l=>[l.id,l]));
   for(const l of after.lines){
    const old=priorLines.get(l.id);if(!old)bad("Popis nema potpunu povijest.",409);
    q.push(db.prepare("UPDATE supply_lines SET qty=?,decision=?,stock_before=?,stock_after=? WHERE id=? AND qty=? AND decision=?").bind(old.qty,old.decision,old.stock_before,old.stock_after,l.id,l.qty,l.decision));
    q.push(db.prepare("INSERT INTO guard_checks(ok) SELECT changes()"));
   }
  }
 }
 q.push(db.prepare("UPDATE audit_undo SET undone_at=CURRENT_TIMESTAMP,undone_by=? WHERE audit_id=? AND undone_at IS NULL").bind(actor.id,last.id));
 q.push(db.prepare("INSERT INTO guard_checks(ok) SELECT changes()"));
 q.push(db.prepare("INSERT INTO audit_events(id,user_id,actor_name,action,description,device_id,device_label) VALUES(?,?,?,?,?,?,?)").bind(uid(),actor.id,actor.name,"Poništena radnja","Poništen log "+last.id+" · "+last.action+" · "+text(last.description,380),text(device?.id,100),text(device?.label,90)));
 q.push(db.prepare("DELETE FROM guard_checks"));
 try{await db.batch(q)}catch{bad("Poništavanje nije uspjelo zbog promjene podataka. Osvježi dnevnik.",409)}
 return{ok:true,action:last.action};
}

async function handle(db,method,args,env){
 if(method==="appPublicConfig"){const r=await db.prepare("SELECT id,name FROM users WHERE active=1 ORDER BY name").all();return{users:r.results,appName:"Skladište"}}
 if(method==="appSetup"){const [secret,name,pin]=args;if(!env.SETUP_KEY||text(secret,400)!==env.SETUP_KEY)bad("Neispravan ključ za početno postavljanje.",403);if(!/^[0-9]{6,12}$/.test(String(pin)))bad("Administratorski PIN mora imati 6 do 12 znamenki.");const count=await db.prepare("SELECT count(*) AS n FROM users").first();if(count.n)bad("Početna administracija već postoji.");const salt=randomHex();await db.prepare("INSERT INTO users(id,name,role,pin_salt,pin_hash) VALUES(?,?,?,?,?)").bind(uid(),text(name,80)||"Administrator","ADMIN",salt,await pinHash(pin,salt)).run();return{ok:true}}
 if(method==="appLogin"){const [id,pin]=args;const u=await db.prepare("SELECT * FROM users WHERE id=? AND active=1").bind(text(id,100)).first();if(!u)bad("Neispravan korisnik ili PIN.",401);if(u.locked_until>Date.now())bad("Previše pokušaja. Pokušaj ponovno za nekoliko minuta.",429);const h=await pinHash(pin,u.pin_salt);if(h!==u.pin_hash){const attempts=u.failed_attempts+1;await db.prepare("UPDATE users SET failed_attempts=?,locked_until=? WHERE id=?").bind(attempts,attempts>=5?Date.now()+15*60*1000:0,u.id).run();bad("Neispravan korisnik ili PIN.",401)}await db.prepare("UPDATE users SET failed_attempts=0,locked_until=0 WHERE id=?").bind(u.id).run();const token=randomHex(32);await db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(await hashText(token),u.id,Date.now()+(args[2]===false?6*3600*1000:30*24*3600*1000)).run();return{token,waiter:{id:u.id,name:u.name,role:u.role}}}
 if(method==="appLogout"){await db.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await hashText(args[0])).run();return true}
 const token=args[0],u=await userFromToken(db,token);
 const waiterAllowed=new Set(["appBootstrap","appGetCatalog","appGetCount","appSaveCount","appSaveIncoming","appCreateSupply","appRecentSupply","appGetSupplyList","appGetSupplyAudit","appSaveSupplyList","appFinishSupply","appRecentIncoming"]);
 if(u.role!=="ADMIN"&&!waiterAllowed.has(method))bad("Ova funkcija dostupna je samo administratoru.",403);
 if(u.role!=="ADMIN"&&(method==="appGetCount"||method==="appSaveCount")&&text(args[1])!=="fridge")bad("Konobar može uređivati samo rupe u frižideru.",403);
 if(method==="appGetAudit"){
 await admin(db,token);
 const limit=Math.min(300,Math.max(1,Number(args[1])||150));
 return(await db.prepare("SELECT a.id,a.actor_name AS actor,a.action,a.description,a.device_label AS device,a.created_at AS createdAt,CASE WHEN u.audit_id IS NOT NULL THEN 1 ELSE 0 END AS reversible,CASE WHEN u.undone_at IS NOT NULL THEN 1 ELSE 0 END AS undone FROM audit_events a LEFT JOIN audit_undo u ON u.audit_id=a.id ORDER BY a.rowid DESC LIMIT ?").bind(limit).all()).results;
 }
 if(method==="appUndoLastAudit"){await admin(db,token);return revertLastAudit(db,u,args[1],env.__requestDevice||{});}
 if(method==="appBootstrap")return{waiter:{id:u.id,name:u.name,role:u.role},spreadsheet:"Cloudflare D1"};
 if(method==="appGetCatalog"){const items=await allItems(db);return{sections:modes.filter(m=>m!=="fridge").map(category=>({key:category,title:({pivo:"Pivo",pica:"Pića",zesta:"Žesta",toplo:"Topli napitci"})[category],items:items.filter(i=>i.category===category).map(i=>({key:i.id,mode:i.category,section_name:i.category,group_name:i.group_name,item_name:i.name,current_qty:i.qty,unit_price:i.price,min_qty:i.min_qty}))})),updatedAt:timestamp()}}
 if(method==="appGetCount"){const category=text(args[1]);if(!modes.includes(category))bad("Nepoznata kategorija.");const items=await allItems(db,category);return{sheetName:category,updatedAt:timestamp(),rows:items.map(i=>({item_location_id:i.id,group_name:i.group_name,item_name:i.name,count_mode:category==="fridge"?"holes":"quantity",full_capacity:category==="fridge"?i.capacity:null,current_qty:category==="fridge"?Math.max(0,(i.capacity||0)-i.qty):i.qty,unit_price:i.price}))}}
 if(method==="appSaveCount"){const category=text(args[1]),entries=args[2],note=text(args[3],250);if(!modes.includes(category))bad("Nepoznata kategorija.");const items=await getEntries(db,entries);const changes=items.map((it,i)=>{if(it.category!==category)bad("Artikl nije u ovoj kategoriji.");const v=qty(entries[i].value,true);const wanted=category==="fridge"?(it.capacity??0)-v:v;if(wanted<0)bad("Broj praznih mjesta prelazi kapacitet.");return{id:it.id,name:it.name,before:it.qty,delta:Math.round((wanted-it.qty)*1000)/1000,version:it.version,capacity:it.capacity}});await atomicMutations(db,changes,u,note,"INVENTURA");return{saved:changes.length,timestamp:timestamp()}}
 if(method==="appSaveIncoming"){const entries=args[1],note=text(args[2],250),items=await getEntries(db,entries);const changes=items.map((it,i)=>{if(it.category==="fridge")bad("Primka robe unosi se u skladišne kategorije.");return{id:it.id,name:it.name,before:it.qty,delta:qty(entries[i].value),version:it.version,capacity:it.capacity}});await atomicMutations(db,changes,u,note,"PRIMKA");return{saved:changes.length,timestamp:timestamp()}}

 if(method==="appCreateSupply"){
  const entries=args[1],note=text(args[2],250),items=await getEntries(db,entries),id=uid();
  const queries=[db.prepare("INSERT INTO supply_requests(id,created_by,note) VALUES(?,?,?)").bind(id,u.id,note)];
  items.forEach((it,i)=>{const amount=qty(entries[i].value);if(it.category==="fridge")bad("Donos se bira iz skladišta.");queries.push(db.prepare("INSERT INTO supply_lines(id,request_id,item_id,qty,stock_before) VALUES(?,?,?,?,?)").bind(uid(),id,it.id,amount,it.qty))});
  await db.batch(queries);return{listId:id,saved:items.length,status:"CEKA"};
 }
 if(method==="appRecentSupply"){
  return(await db.prepare("SELECT r.id AS listId,r.created_at AS createdAt,r.confirmed_at AS confirmedAt,r.status,u.name AS waiter,(SELECT count(*) FROM supply_lines l WHERE l.request_id=r.id) AS itemCount FROM supply_requests r JOIN users u ON u.id=r.created_by WHERE r.created_by=? OR ?='ADMIN' ORDER BY r.created_at DESC LIMIT 60").bind(u.id,u.role).all()).results;
 }
 if(method==="appGetSupplyList"){
  const id=text(args[1]);
  const r=await db.prepare("SELECT r.*,creator.name AS waiter,editor.name AS confirmedByName FROM supply_requests r JOIN users creator ON creator.id=r.created_by LEFT JOIN users editor ON editor.id=r.confirmed_by WHERE r.id=? AND (r.created_by=? OR ?='ADMIN')").bind(id,u.id,u.role).first();
  if(!r)bad("Popis nije pronađen.",404);
  const lines=await db.prepare("SELECT l.id AS lineId,l.item_id AS key,l.qty,l.decision,l.stock_before AS stock,l.stock_after AS stockAfter,i.name AS item,i.group_name AS 'group',i.category AS section FROM supply_lines l JOIN items i ON i.id=l.item_id WHERE l.request_id=? ORDER BY i.category,i.group_name,i.name").bind(id).all();
  return{listId:r.id,status:r.status,createdAt:r.created_at,completedAt:r.confirmed_at,waiter:r.waiter,confirmedBy:r.confirmedByName,note:r.note,items:lines.results};
 }
 if(method==="appGetSupplyAudit"){
  const id=text(args[1]);
  const allowed=await db.prepare("SELECT id FROM supply_requests WHERE id=? AND (created_by=? OR ?='ADMIN')").bind(id,u.id,u.role).first();
  if(!allowed)bad("Popis nije pronađen.",404);
  const results=await db.prepare("SELECT m.created_at AS createdAt,m.movement_type AS type,m.delta,m.before_qty AS beforeQty,m.after_qty AS afterQty,m.note,u.name AS actor,i.name AS item FROM movements m JOIN users u ON u.id=m.actor_id JOIN items i ON i.id=m.item_id WHERE m.note LIKE ? AND m.movement_type IN ('DONOS','ISPRAVAK_DONOSA') ORDER BY m.created_at DESC LIMIT 150").bind("Popis "+id+"%").all();
  return results.results;
 }
 if(method==="appSaveSupplyList"||method==="appFinishSupply"){
  const id=text(args[1]),input=args[2],r=await db.prepare("SELECT * FROM supply_requests WHERE id=? AND (created_by=? OR ?='ADMIN')").bind(id,u.id,u.role).first();
  if(!r)bad("Popis nije pronađen.",404);
  if(!["CEKA","ZAVRSENO"].includes(r.status))bad("Nepoznat status popisa.");
  const final=method==="appFinishSupply";
  if(final&&r.status!=="CEKA")bad("Popis je već dovršen.");
  if(!Array.isArray(input)||!input.length||input.length>250)bad("Popis nema ispravne stavke.");
  const lines=(await db.prepare("SELECT l.*,i.name,i.qty AS stock,i.version,i.active FROM supply_lines l JOIN items i ON i.id=l.item_id WHERE l.request_id=? ORDER BY l.id").bind(id).all()).results;
  if(lines.length!==input.length||lines.length===0)bad("Popis nije potpun.");
  const byId=new Map(lines.map(l=>[l.item_id,l]));const seen=new Set();const updated=[];
  for(const d of input){
   const key=text(d.key,100),l=byId.get(key);if(!l||seen.has(key))bad("Artikli popisa nisu ispravni.");seen.add(key);
   if(!l.active)bad(l.name+": artikl nije aktivan.");
   const amount=qty(d.value??d.qty),oldQty=qty(l.qty);
   if(d.originalQty!==undefined&&Math.abs(qty(d.originalQty)-oldQty)>0.0001)bad("Popis je promijenjen na drugom uređaju. Osvježi.",409);
   if(d.originalDecision!==undefined&&text(d.originalDecision)!==text(l.decision))bad("Potvrde su promijenjene. Osvježi popis.",409);
   const decision=text(d.decision,20);
   if(decision&&!["DONESENO","NEMA"].includes(decision))bad("Nepoznata odluka.");
   updated.push({l,amount,decision});
  }
  const isChanging=updated.some(x=>x.amount!==x.l.qty);
  if(r.status==="CEKA"&&!final){
   // Svaka promjena kolicine na cekajucem popisu ponistava potvrde svih stavki.
   const reset=isChanging;
   const q=updated.flatMap(x=>[db.prepare("UPDATE supply_lines SET qty=?,decision=? WHERE id=? AND qty=? AND decision=?").bind(x.amount,reset?"":x.decision,x.l.id,x.l.qty,x.l.decision),db.prepare("INSERT INTO guard_checks(ok) SELECT changes()")]);
   q.push(db.prepare("DELETE FROM guard_checks"));
   try{await db.batch(q)}catch{bad("Popis se u međuvremenu promijenio. Osvježi.",409)}
   return{listId:id,status:"CEKA",reset,updated:updated.length};
  }
  if((final||r.status==="ZAVRSENO")&&updated.some(x=>!["DONESENO","NEMA"].includes(x.decision)))bad("Svaku stavku treba označiti Doneseno ili Nema.");
  // Kod dovrsene liste korigiraj samo razliku starog i novog stvarno uzetog.
  const changes=updated.map(x=>{const oldTaken=r.status==="ZAVRSENO"&&x.l.decision==="DONESENO"?x.l.qty:0;
   const newTaken=x.decision==="DONESENO"?x.amount:0;const delta=Math.round((oldTaken-newTaken)*1000)/1000;
   const after=Math.round((x.l.stock+delta)*1000)/1000;
   if(after<0)bad(x.l.name+": nema dovoljno robe za promjenu.");
   return{...x,delta,after,oldTaken,newTaken};
  });
  const q=[];
  for(const c of changes){
   if(c.delta!==0){
    q.push(db.prepare("UPDATE items SET qty=?,version=version+1 WHERE id=? AND version=? AND active=1").bind(c.after,c.l.item_id,c.l.version));
    q.push(db.prepare("INSERT INTO guard_checks(ok) SELECT changes()"));
    q.push(db.prepare("INSERT INTO movements(id,item_id,movement_type,delta,before_qty,after_qty,actor_id,note) VALUES(?,?,?,?,?,?,?,?)").bind(uid(),c.l.item_id,r.status==="CEKA"?"DONOS":"ISPRAVAK_DONOSA",c.delta,c.l.stock,c.after,u.id,"Popis "+id+" · "+(r.status==="CEKA"?"potvrda":"naknadna izmjena")));
   }
   if(c.delta===0&&r.status==="ZAVRSENO"&&(c.amount!==c.l.qty||c.decision!==c.l.decision))q.push(db.prepare("INSERT INTO movements(id,item_id,movement_type,delta,before_qty,after_qty,actor_id,note) VALUES(?,?,?,?,?,?,?,?)").bind(uid(),c.l.item_id,"ISPRAVAK_DONOSA",0,c.l.stock,c.l.stock,u.id,"Popis "+id+" · uređena stavka bez promjene stanja"));
   q.push(db.prepare("UPDATE supply_lines SET qty=?,decision=?,stock_after=? WHERE id=? AND qty=? AND decision=?").bind(c.amount,c.decision,c.after,c.l.id,c.l.qty,c.l.decision));
   q.push(db.prepare("INSERT INTO guard_checks(ok) SELECT changes()"));
  }
  if(r.status==="CEKA")q.push(db.prepare("UPDATE supply_requests SET status='ZAVRSENO',confirmed_by=?,confirmed_at=CURRENT_TIMESTAMP WHERE id=? AND status='CEKA'").bind(u.id,id));
  else q.push(db.prepare("UPDATE supply_requests SET note=note WHERE id=? AND status='ZAVRSENO'").bind(id));
  q.push(db.prepare("INSERT INTO guard_checks(ok) SELECT changes()"));
  q.push(db.prepare("DELETE FROM guard_checks"));
  try{await db.batch(q)}catch{bad("Zalihe ili popis su se promijenili. Osvježi i pokušaj ponovno.",409)}
  return{listId:id,status:"ZAVRSENO",corrected:r.status==="ZAVRSENO"};
 }
 if(method==="appGetTotalState"){
 const items=await allItems(db);
 // U odgovoru je ukupna kolicina hladnjaka vec stvarno stanje (kapacitet minus rupe).
 // Dodatne informacije omogucuju razlikovanje skladisnih i hladnjackih artikala.
 const mapped=items.map(i=>({key:i.id,mode:i.category,group_name:i.group_name,item_name:i.name,current_qty:i.qty,unit_price:i.price,linked_item_id:i.linked_item_id,full_capacity:i.capacity,holes:i.category==="fridge"?Math.max(0,(i.capacity||0)-i.qty):null}));
 return{title:"Ukupno stanje",items:mapped,values:[["Kategorija","Grupa","Artikl","Količina","Cijena"],...mapped.map(i=>[i.mode,i.group_name,i.item_name,i.current_qty,i.unit_price])],copyValues:mapped.map(i=>i.current_qty)};
 }
 if(method==="appGetBackups"){const items=await allItems(db);const last=await db.prepare("SELECT * FROM snapshots ORDER BY created_at DESC LIMIT 1").first();let comparison=null;if(last){const rows=(await db.prepare("SELECT item_id,qty FROM snapshot_lines WHERE snapshot_id=?").bind(last.id).all()).results;const prev=new Map(rows.map(r=>[r.item_id,r.qty]));comparison={date:last.created_at,sections:modes.map(m=>({key:m,title:m,items:items.filter(it=>it.category===m).map(it=>({key:it.id,group_name:it.group_name,item_name:it.name,previous_qty:prev.get(it.id)??null,current_qty:it.qty,diff:prev.has(it.id)?it.qty-prev.get(it.id):null}))}))}}return{backups:last?[{date:last.created_at}]:[],comparison}}
 if(method==="appCreateSnapshot"){await admin(db,token);const items=await allItems(db),id=uid();await db.batch([db.prepare("INSERT INTO snapshots(id,created_by) VALUES(?,?)").bind(id,u.id),...items.map(it=>db.prepare("INSERT INTO snapshot_lines(snapshot_id,item_id,qty) VALUES(?,?,?)").bind(id,it.id,it.qty))]);return{ok:true}}
 if(method==="appRecentIncoming"){return(await db.prepare("SELECT m.created_at AS createdAt,m.movement_type AS type,i.name AS item,m.delta AS qty FROM movements m JOIN items i ON i.id=m.item_id WHERE m.actor_id=? AND m.movement_type='PRIMKA' ORDER BY m.created_at DESC LIMIT 30").bind(u.id).all()).results}
 if(method==="appAdminGetData"){await admin(db,token);const users=(await db.prepare("SELECT id,name,role,active FROM users ORDER BY name").all()).results;const items=await allItems(db);return{admin:{id:u.id,name:u.name},users:users.map(x=>({...x,active:!!x.active})),items:items.map(it=>({key:it.id,type:it.category==="fridge"?"FRIDGE":"STOCK",mode:it.category,group:it.group_name,item:it.name,price:it.price,capacity:it.capacity,minQty:it.min_qty}))}}
 if(method==="appAdminEditUser"){await admin(db,token);const userId=text(args[1]),name=text(args[2],80),pin=String(args[3]??"");if(!name)bad("Upiši ime konobara.");const target=await db.prepare("SELECT id,role FROM users WHERE id=? AND active=1").bind(userId).first();if(!target||target.role!=="KONOBAR")bad("Konobar nije pronađen.");if(pin&& !/^[0-9]{4,8}$/.test(pin))bad("PIN mora imati 4 do 8 znamenki.");if(pin){const salt=randomHex();await db.batch([db.prepare("UPDATE users SET name=?,pin_salt=?,pin_hash=?,failed_attempts=0,locked_until=0 WHERE id=?").bind(name,salt,await pinHash(pin,salt),userId),db.prepare("DELETE FROM sessions WHERE user_id=?").bind(userId)])}else await db.prepare("UPDATE users SET name=? WHERE id=?").bind(name,userId).run();return handle(db,"appAdminGetData",[token],env)}
 if(method==="appAdminAddUser"){await admin(db,token);const name=text(args[1],80),pin=String(args[2]);if(!name||!/^[0-9]{4,8}$/.test(pin))bad("Upiši ime i PIN od 4 do 8 znamenki.");const salt=randomHex();await db.prepare("INSERT INTO users(id,name,role,pin_salt,pin_hash) VALUES(?,?,?,?,?)").bind(uid(),name,"KONOBAR",salt,await pinHash(pin,salt)).run();return handle(db,"appAdminGetData",[token],env)}
 if(method==="appAdminDeleteUser"){await admin(db,token);const id=text(args[1]);if(id===u.id)bad("Ne možeš ukloniti sebe.");await db.batch([db.prepare("UPDATE users SET active=0 WHERE id=? AND role<>'ADMIN'").bind(id),db.prepare("DELETE FROM sessions WHERE user_id=?").bind(id)]);return handle(db,"appAdminGetData",[token],env)}
 if(method==="appAdminAddItem"){await admin(db,token);const p=args[1]||{},category=text(p.mode),group=text(p.group,90),name=text(p.item,100),price=qty(p.price??0,true);if(!modes.includes(category)||!group||!name)bad("Odaberi kategoriju, grupu i naziv.");const capacity=category==="fridge"?qty(p.capacity):null;const canonicalGroup=category==="pivo"&&group.toLocaleLowerCase("hr")==="pivo"?"Veliko pivo":category==="toplo"&&group.toLocaleLowerCase("hr")==="kapucino"?"Cappuccino":group;await db.prepare("INSERT INTO items(id,category,group_name,name,capacity,qty,price) VALUES(?,?,?,?,?,?,?)").bind(uid(),category,canonicalGroup,name,capacity,category==="fridge"?capacity:0,price).run();return handle(db,"appAdminGetData",[token],env)}
 if(method==="appAdminRenameItem"){await admin(db,token);const key=text(args[1]),group=text(args[2],90),name=text(args[3],100);if(!group||!name)bad("Upiši grupu i naziv artikla.");const r=await db.prepare("UPDATE items SET group_name=?,name=?,version=version+1 WHERE id=? AND active=1").bind(group,name,key).run();if(!r.meta?.changes)bad("Artikl nije pronađen.");return handle(db,"appAdminGetData",[token],env)}
 if(method==="appAdminSetFridgeCapacity"){await admin(db,token);const key=text(args[1]),capacity=qty(args[2]);if(!Number.isInteger(capacity))bad("Puni frižider mora imati cijeli broj mjesta.");const it=await db.prepare("SELECT id,name,qty,capacity,version FROM items WHERE id=? AND category='fridge' AND active=1").bind(key).first();if(!it)bad("Artikl frižidera nije pronađen.");const holes=Math.max(0,Number(it.capacity||0)-Number(it.qty||0));if(capacity<holes)bad("Novi kapacitet ne može biti manji od trenutno evidentiranih rupa ("+holes+").");const wanted=Math.round((capacity-holes)*1000)/1000;const r=await db.prepare("UPDATE items SET capacity=?,qty=?,version=version+1 WHERE id=? AND version=?").bind(capacity,wanted,key,it.version).run();if(!r.meta?.changes)bad("Podaci su se promijenili. Osvježi postavke.",409);return handle(db,"appAdminGetData",[token],env)}
 if(method==="appAdminSetItemPrice"){await admin(db,token);const key=text(args[1]),price=qty(args[2],true);const r=await db.prepare("UPDATE items SET price=?,version=version+1 WHERE id=? AND category<>'fridge' AND active=1").bind(price,key).run();if(!r.meta?.changes)bad("Artikl nije pronađen.");return handle(db,"appAdminGetData",[token],env)}
 if(method==="appAdminSetMinimum"){await admin(db,token);const key=text(args[1]),minimum=qty(args[2],true);const r=await db.prepare("UPDATE items SET min_qty=?,version=version+1 WHERE id=? AND category<>'fridge' AND active=1").bind(minimum,key).run();if(!r.meta?.changes)bad("Artikl nije pronađen.");return handle(db,"appAdminGetData",[token],env)}
 if(method==="appAdminDeleteItem"){await admin(db,token);await db.prepare("UPDATE items SET active=0 WHERE id=?").bind(text(args[1])).run();return handle(db,"appAdminGetData",[token],env)}
 bad("Nepoznata radnja.",404)
}
export default {async fetch(request,env){try{const url=new URL(request.url);if(url.pathname==="/api/health")return send({ok:true,storage:"Cloudflare D1"});if(url.pathname.startsWith("/api/")){if(request.method!=="POST")return send({error:"POST required"},405);if(!env.DB)return send({error:"D1 baza nije povezana."},503);if(Number(request.headers.get("content-length")||0)>100000)return send({error:"Prevelik zahtjev."},413);const body=await request.json();const method=url.pathname.slice(5),args=Array.isArray(body.args)?body.args:[];
const device={id:text(body.device?.id,100),label:text(body.device?.label,90)};
const actorBefore=method==="appLogout"?await userFromToken(env.DB,args[0]):null;
const reversible=reversibleMethods.has(method);
const before=reversible?await stateForUndo(env.DB,method,args):null;
const result=await handle(env.DB,method,args,{...env,__requestDevice:device});
if(auditNames[method]){
 try{const actor=method==="appLogin"?await userFromToken(env.DB,result.token):actorBefore||await userFromToken(env.DB,args[0]);
 if(reversible){
  const after=await stateForUndo(env.DB,method,args,result);
  const auditId=uid(),detail=await auditDetail(env.DB,method,args,result);
  await env.DB.batch([
   env.DB.prepare("INSERT INTO audit_events(id,user_id,actor_name,action,description,device_id,device_label) VALUES(?,?,?,?,?,?,?)").bind(auditId,actor.id,actor.name,auditNames[method],text(detail,900),device.id,device.label),
   env.DB.prepare("INSERT INTO audit_undo(audit_id,before_json,after_json) VALUES(?,?,?)").bind(auditId,JSON.stringify(before),JSON.stringify(after))
  ]);
 }else await recordAudit(env.DB,actor,method,args,result,device)}catch(e){console.error("Neuspješan upis loga",e)}
}
return send(result)}return env.ASSETS.fetch(request)}catch(e){return send({error:e.message||"Došlo je do pogreške."},e.status||500)}}};
