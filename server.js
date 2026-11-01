// Mahjong Online: server tanpa dependensi (Node >=18). Server memegang semua kartu agar adil.
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000,FAST=!!process.env.MJ_FAST,D=ms=>FAST?5:ms,rooms={};
const cnt=h=>{const c=Array(34).fill(0);h.forEach(k=>{if(k<34)c[k]++});return c};
function sets(c,i,m){while(i<34&&!c[i])i++;if(i>=34)return true;
 if(m!=1&&c[i]>=3){c[i]-=3;const r=sets(c,i,m);c[i]+=3;if(r)return true}
 if(m!=2&&i<27&&i%9<7&&c[i+1]&&c[i+2]){c[i]--;c[i+1]--;c[i+2]--;const r=sets(c,i,m);c[i]++;c[i+1]++;c[i+2]++;if(r)return true}
 return false}
function wins(h,m=0,ok=()=>true){if(h.length%3!=2)return false;const c=cnt(h);
 for(let i=0;i<34;i++)if(c[i]>=2&&ok(i)){c[i]-=2;const r=sets(c,0,m);c[i]+=2;if(r)return true}return false}
function best(h){const c=cnt(h);let b=h[0],bs=1e9;
 h.forEach(k=>{let s=c[k]*4+Math.random()*.5;if(k<27){const n=k%9;if(n>0)s+=c[k-1]*2;if(n<8)s+=c[k+1]*2;if(n>1)s+=c[k-2];if(n<7)s+=c[k+2]}if(s<bs){bs=s;b=k}});return b}
// Poin: fan -> 2^fan (maks 2^8). Menang dari buangan: pembuang bayar 2x poin. Ambil sendiri: tiap lawan bayar 1x.
function fans(g,s,self,dealer){const h=g.h[s],M=g.m[s],f=[],wd=(s-dealer+4)%4;
 const all=[...h,...M.flatMap(m=>m.k.slice(0,3))],c=cnt(all);
 if(g.f[s].length)f.push(['Bunga ×'+g.f[s].length,g.f[s].length]);
 if(self)f.push(['Ambil sendiri',1]);
 if(M.every(m=>!m.open))f.push(['Tangan tertutup',1]);
 for(let k=31;k<34;k++)if(c[k]>=3)f.push(['Set naga',1]);
 if(c[27]>=3)f.push(['Angin putaran (Timur)',1]);
 if(c[27+wd]>=3)f.push(['Angin kursi',1]);
 const su=new Set(all.filter(k=>k<27).map(k=>k/9|0)),hon=all.some(k=>k>=27);
 if(su.size==1)f.push(hon?['Satu jenis + honor',3]:['Satu jenis murni',6]);
 else if(su.size==0)f.push(['Semua honor',6]);
 if(M.every(m=>m.t!='chi')&&wins(h,2))f.push(['Semua triplet',3]);
 if(M.every(m=>m.t=='chi')&&wins(h,1,i=>i<27))f.push(['Semua sekuen',1]);
 if(g.kd)f.push(['Menang setelah kong',1]);
 return f}
function drawTile(g,s,back){for(;;){const k=back?g.wall.shift():g.wall.pop();if(k===undefined)return -1;if(k>=34)g.f[s].push(k);else return k}}
function selfOpts(g,s){const h=g.h[s],c=cnt(h),kg=[];c.forEach((n,k)=>{if(n==4)kg.push(k)});
 g.m[s].forEach(m=>{if(m.t=='pong'&&c[m.k[0]]>0)kg.push(m.k[0])});return{hu:wins(h),kong:kg}}
function claimOpts(g,s){const k=g.last,h=g.h[s],c=cnt(h),o={chi:[]};
 o.hu=wins([...h,k]);o.pong=c[k]>=2;o.kong=c[k]>=3;
 if(s==(g.from+1)%4&&k<27){const n=k%9,has=x=>c[x]>0;
  if(n>=2&&has(k-2)&&has(k-1))o.chi.push([k-2,k-1]);if(n>=1&&n<=7&&has(k-1)&&has(k+1))o.chi.push([k-1,k+1]);if(n<=6&&has(k+1)&&has(k+2))o.chi.push([k+1,k+2])}
 o.any=o.hu||o.pong||o.chi.length>0;return o}
const log=(r,t)=>{r.log.push(t);if(r.log.length>30)r.log.shift()};
const nm=r=>s=>r.players[s].name;
function newGame(r){r.players.forEach((p,i)=>{if(!r.players[i])r.players[i]={bot:true,name:'Bot '+['Timur','Selatan','Barat','Utara'][i]}});
 const w=[];for(let k=0;k<42;k++)for(let j=0;j<(k<34?4:1);j++)w.push(k);
 for(let i=w.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[w[i],w[j]]=[w[j],w[i]]}
 const g=r.g={wall:w,h:[[],[],[],[]],m:[[],[],[],[]],f:[[],[],[],[]],d:[[],[],[],[]],turn:r.dealer,ph:'disc',last:-1,from:0,n:0,resp:{},opt:{}};
 for(let s=0;s<4;s++){for(let i=0;i<13;i++)g.h[s].push(drawTile(g,s,false));}
 for(let s=0;s<4;s++)g.h[s].sort((a,b)=>a-b);
 log(r,'Ronde baru. Dealer: '+r.players[r.dealer].name);turnDraw(r,false)}
function turnDraw(r,back){const g=r.g,s=g.turn,k=drawTile(g,s,back);if(k<0)return endGame(r,null);
 g.h[s].push(k);g.h[s].sort((a,b)=>a-b);g.ph='disc';g.kd=back;arm(r)}
function arm(r){const g=r.g,n=++g.n;clearTimeout(r.tm);r.t0=Date.now();
 if(g.ph=='disc'){const s=g.turn,p=r.players[s];g.dl=p.bot?0:Date.now()+45000;
  r.tm=setTimeout(()=>{if(r.g!==g||g.n!==n)return;if(p.bot&&selfOpts(g,s).hu)return endGame(r,{s,self:true});doDiscard(r,s,best(g.h[s]))},p.bot?D(900):45000)}
 else if(g.ph=='claim'){g.dl=Date.now()+20000;r.tm=setTimeout(()=>{if(r.g===g&&g.n===n)resolve(r)},20000)}
 broadcast(r)}
function doDiscard(r,s,k){const g=r.g;if(g.ph!='disc'||g.turn!=s||!g.h[s].includes(k))return;
 g.h[s].splice(g.h[s].indexOf(k),1);g.d[s].push(k);g.last=k;g.from=s;g.kd=false;g.resp={};g.opt={};
 for(let t=0;t<4;t++){if(t==s)continue;const o=claimOpts(g,t);if(!o.any)continue;
  if(r.players[t].bot){if(o.hu)g.resp[t]={type:'hu'}}else{g.opt[t]=o;g.resp[t]=null}}
 if(Object.values(g.resp).every(v=>v))return resolve(r);
 g.ph='claim';arm(r)}
function resolve(r){const g=r.g,f=g.from,t=g.last,R=g.resp||{},order=[1,2,3].map(i=>(f+i)%4),get=ty=>order.find(s=>R[s]&&R[s].type==ty);
 let s=get('hu');if(s!=null)return endGame(r,{s,self:false});
 const take=(s,a)=>a.forEach(x=>g.h[s].splice(g.h[s].indexOf(x),1));
 s=get('kong')??get('pong');
 if(s!=null){const kg=R[s].type=='kong';take(s,kg?[t,t,t]:[t,t]);g.d[f].pop();
  g.m[s].push({t:kg?'kong':'pong',k:Array(kg?4:3).fill(t),open:true});g.turn=s;log(r,r.players[s].name+(kg?' KONG ':' PONG ')+'!');
  if(kg)return turnDraw(r,true);g.ph='disc';g.kd=false;return arm(r)}
 s=get('chi');
 if(s!=null){const o=g.opt[s].chi[R[s].i];take(s,o);g.d[f].pop();g.m[s].push({t:'chi',k:[...o,t].sort((a,b)=>a-b),open:true});g.turn=s;g.ph='disc';g.kd=false;log(r,r.players[s].name+' CHI');return arm(r)}
 g.turn=(f+1)%4;turnDraw(r,false)}
function endGame(r,w){const g=r.g;clearTimeout(r.tm);g.ph='end';g.n++;let res={draw:true};
 if(w){const s=w.s;if(!w.self){g.h[s].push(g.last);g.d[g.from].pop();g.h[s].sort((a,b)=>a-b)}
  const fl=fans(g,s,w.self,r.dealer),fan=fl.reduce((a,x)=>a+x[1],0),pts=2**Math.min(fan,8),pay=[0,0,0,0];
  if(w.self){for(let i=0;i<4;i++)if(i!=s){pay[i]-=pts;pay[s]+=pts}}else{pay[g.from]-=pts*2;pay[s]+=pts*2}
  pay.forEach((x,i)=>r.scores[i]+=x);res={s,self:w.self,from:w.self?-1:g.from,fl,fan,pts,pay};
  if(s!=r.dealer)r.dealer=(r.dealer+1)%4;log(r,r.players[s].name+' menang! '+fan+' fan')}
 else log(r,'Seri, ubin habis.');
 res.hands=g.h;res.m=g.m;g.res=res;broadcast(r)}
function act(r,s,a){const g=r.g;if(!g||g.ph=='end')return;
 if(g.ph=='disc'&&g.turn==s){const o=selfOpts(g,s);
  if(a.type=='discard')return doDiscard(r,s,a.k);
  if(a.type=='hu'&&o.hu)return endGame(r,{s,self:true});
  if(a.type=='kong'&&o.kong.includes(a.k)){const h=g.h[s],c=cnt(h)[a.k];
   if(c==4){for(let i=0;i<4;i++)h.splice(h.indexOf(a.k),1);g.m[s].push({t:'kong',k:Array(4).fill(a.k),open:false})}
   else{h.splice(h.indexOf(a.k),1);const m=g.m[s].find(m=>m.t=='pong'&&m.k[0]==a.k);m.t='kong';m.k.push(a.k)}
   log(r,r.players[s].name+' KONG');return turnDraw(r,true)}}
 if(g.ph=='claim'&&g.resp[s]===null){const o=g.opt[s];let ok=a.type=='pass'||(a.type=='hu'&&o.hu)||(a.type=='pong'&&o.pong)||(a.type=='kong'&&o.kong)||(a.type=='chi'&&o.chi[a.i]);
  if(!ok)return;g.resp[s]=a.type=='pass'?{type:'pass'}:{type:a.type,i:a.i};
  if(Object.values(g.resp).every(v=>v))resolve(r)}}
function view(r,seat){const g=r.g,v={code:r.code,you:seat,players:r.players.map(p=>p&&{name:p.name,bot:!!p.bot}),scores:r.scores,dealer:r.dealer,started:!!g,log:r.log.slice(-4)};
 if(!g)return v;
 Object.assign(v,{ph:g.ph,turn:g.turn,wall:g.wall.length,hand:seat>=0?g.h[seat]:[],n:g.h.map(h=>h.length),m:g.m,f:g.f,d:g.d,last:g.last,from:g.from,dl:g.dl,res:g.res,now:Date.now()});
 if(g.ph=='claim'&&g.resp[seat]===null)v.opt=g.opt[seat];
 if(g.ph=='disc'&&g.turn==seat)v.self=selfOpts(g,seat);return v}
function broadcast(r){r.t0=Date.now();r.cl.forEach((set,seat)=>{const d='data: '+JSON.stringify(view(r,seat))+'\n\n';set.forEach(res=>res.write(d))})}
const J=(res,o,c=200)=>{res.writeHead(c,{'content-type':'application/json'});res.end(JSON.stringify(o))};
const body=req=>new Promise(ok=>{let b='';req.on('data',d=>{b+=d;if(b.length>1e5)req.destroy()});req.on('end',()=>{try{ok(JSON.parse(b||'{}'))}catch(e){ok({})}})});
const seatOf=(r,pid)=>r.players.findIndex(p=>p&&p.pid===pid);
http.createServer(async(req,res)=>{const u=new URL(req.url,'http://x'),p=u.pathname;
 if(p=='/api/events'){const r=rooms[u.searchParams.get('room')],s=r?seatOf(r,u.searchParams.get('pid')):-1;if(s<0)return J(res,{err:'Sesi tidak valid'},403);
  res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive','x-accel-buffering':'no'});
  if(!r.cl[s])r.cl[s]=new Set();r.cl[s].add(res);res.write('data: '+JSON.stringify(view(r,s))+'\n\n');req.on('close',()=>r.cl[s].delete(res));return}
 if(p=='/api/state'){const r=rooms[u.searchParams.get('room')],s=r?seatOf(r,u.searchParams.get('pid')):-1;return s<0?J(res,{err:'x'},403):J(res,view(r,s))}
 if(req.method=='POST'&&p.startsWith('/api/')){const b=await body(req),name=String(b.name||'Pemain').slice(0,14);
  if(p=='/api/create'){let c;do{c=Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random()*24|0]).join('')}while(rooms[c]);
   const pid=crypto.randomBytes(12).toString('hex');rooms[c]={code:c,players:[{pid,name},null,null,null],scores:[500,500,500,500],dealer:0,g:null,log:[],cl:[],t0:Date.now()};return J(res,{room:c,pid})}
  const r=rooms[String(b.room||'').toUpperCase()];if(!r)return J(res,{err:'Meja tidak ditemukan'});
  if(p=='/api/join'){let s=seatOf(r,b.pid);if(s>=0)return J(res,{room:r.code,pid:b.pid});
   if(r.g)return J(res,{err:'Permainan sudah dimulai'});s=r.players.findIndex(x=>!x);if(s<0)return J(res,{err:'Meja penuh'});
   const pid=crypto.randomBytes(12).toString('hex');r.players[s]={pid,name};broadcast(r);return J(res,{room:r.code,pid})}
  const s=seatOf(r,b.pid);if(s<0)return J(res,{err:'Sesi tidak valid'},403);
  if(p=='/api/start'){if(s!=0||(r.g&&r.g.ph!='end'))return J(res,{err:'Hanya pembuat meja yang bisa memulai'});newGame(r);return J(res,{ok:1})}
  if(p=='/api/act'){act(r,s,b);return J(res,{ok:1})}
  return J(res,{err:'?'},404)}
 const f=path.join(__dirname,'public',p=='/'?'index.html':path.normalize(p).replace(/^(\.\.[\/\\])+/,''));
 fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('404')}res.writeHead(200,{'content-type':f.endsWith('.html')?'text/html; charset=utf-8':'text/plain'});res.end(d)})
}).listen(PORT,()=>console.log('Mahjong di http://localhost:'+PORT));
setInterval(()=>{const n=Date.now();for(const c in rooms){const r=rooms[c];if(n-r.t0>6*3600e3){clearTimeout(r.tm);delete rooms[c]}else r.cl.forEach(s=>s.forEach(x=>x.write(': ping\n\n')))}},20000);
module.exports={wins,fans};
