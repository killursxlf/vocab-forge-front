
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),{spawn}=require('node:child_process');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const dist=path.resolve('dist');
const server=http.createServer((req,res)=>{let f=path.join(dist,decodeURIComponent(req.url.split('?')[0]));if(!fs.existsSync(f)||!fs.statSync(f).isFile())f=path.join(dist,'index.html');res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(f));});
const assert=require('node:assert/strict');
let answerStatus=500,logoutStatus=500,oauthResult='success',popupStorageFails=false,popupStorageReset=false,popupMessagesDrop=false;
let countStatus=200,countDelay=0,settingsStatus=200,wordPatchStatus=200;
let nextSetId=3;
const popupTargets=new Set();
let chrome,ws,profile,pageSession; let id=0,pending=new Map(),events=[],mode='ok',requests=[];
const columns=[{id:'example',key:'example',name:'Example'},{id:'phonetic',key:'phonetic',name:'Phonetic'}];
const cards=[1,2].map(id=>({id,original:'word'+id,translation:'answer'+id,status:'NEW',customFields:{example:'EXAMPLE-HINT',phonetic:'PHONETIC-HINT'}}));
let wordSets=[{id:1,title:'Test set',customColumns:columns},{id:2,title:'Other set',customColumns:columns}];
let trainingCards=cards;
const setWords=new Map([[1,cards.map(card=>({...card}))],[2,[]]]);
const hasSide=(word,key)=>{const value=key==='word'?word.original:word[key]??word.customFields?.[key];return value!==undefined&&value!==null&&value!=='';};
let settings={frontKey:'original',backKey:'translation',hintKey:'phonetic',selectedStatuses:['all'],selectedTables:['all'],userColumns:[{key:'original',name:'Original'},{key:'translation',name:'Translation'},...columns]};
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{sessionId??=/^(Target|Browser)\./.test(method)?undefined:pageSession;const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params,...(sessionId?{sessionId}:{})}));});
async function paused(p,sessionId){
 const u=new URL(p.request.url); if(u.origin===origin) return send('Fetch.continueRequest',{requestId:p.requestId},sessionId);
 if(u.hostname!=='localhost'||u.port!=='3000') return send('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'},sessionId);
 const route=u.pathname; requests.push({route,method:p.request.method,body:p.request.postData});
 if(route==='/auth/google'){
  mode=oauthResult==='success'?'ok':'anon';
  const attempt=u.searchParams.get('popupAttempt');
  const callback=attempt?`${origin}/auth/google/popup?attempt=${attempt}&complete=1`:origin+'/app';
  const body=oauthResult==='wait'?'Waiting for OAuth':`<script>location.replace(${JSON.stringify(callback)})</script>`;
  return send('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html'},{name:'Cross-Origin-Opener-Policy',value:'same-origin'}],body:Buffer.from(body).toString('base64')},sessionId);
 }
 if(mode==='hang'&&route==='/auth/profile')return;
 let data={},status=200;
 if(p.request.method==='OPTIONS')status=204;
 else if(route==='/auth/profile') {if(mode==='anon'){status=401;data={message:'Unauthorized'};}else data={userId:1,email:'test@example.com',name:'Test'};}
 else if(route==='/word-sets') {
  if(p.request.method==='POST'){data={id:nextSetId++,...JSON.parse(p.request.postData)};wordSets.unshift(data);setWords.set(data.id,[]);}
  else data=wordSets.slice(Number(u.searchParams.get('offset')||0),Number(u.searchParams.get('offset')||0)+Number(u.searchParams.get('limit')||100));
 }
 else if(route.startsWith('/word-sets/')) {
  const setId=Number(route.split('/')[2]);const set=wordSets.find(s=>s.id===setId);
  if(route.endsWith('/words')){data={id:1000+requests.length,...JSON.parse(p.request.postData)};setWords.get(setId).push(data);}
  else if(p.request.method==='DELETE'){wordSets=wordSets.filter(s=>s.id!==setId);setWords.delete(setId);data={};}
  else if(p.request.method==='PATCH'){Object.assign(set,JSON.parse(p.request.postData));data=set;}
  else {const words=(setWords.get(setId)||[]).filter(word=>(!u.searchParams.get('status')||word.status===u.searchParams.get('status'))&&(!u.searchParams.get('search')||(word.original+' '+word.translation).toLowerCase().includes(u.searchParams.get('search').toLowerCase())));const offset=Number(u.searchParams.get('offset')||0),limit=Number(u.searchParams.get('limit')||50);data={...set,words:words.slice(offset,offset+limit),hasMore:offset+limit<words.length,total:words.length};}
 }
 else if(/^\/words\/\d+$/.test(route)) {
  const wordId=Number(route.split('/')[2]);const words=[...setWords.values()].find(rows=>rows.some(word=>word.id===wordId));const word=words?.find(word=>word.id===wordId);
  if(p.request.method==='DELETE'){words.splice(words.indexOf(word),1);data={};}
  else {status=wordPatchStatus;if(status===200){const update=JSON.parse(p.request.postData);Object.assign(word,{...update,customFields:{...word.customFields,...update.customFields}});data=word;}else data={message:'Word save failed'};}
 }
 else if(route==='/card-settings/cards')data=trainingCards.filter(word=>hasSide(word,settings.frontKey)&&hasSide(word,settings.backKey)).slice(Number(u.searchParams.get('offset')||0),Number(u.searchParams.get('offset')||0)+Number(u.searchParams.get('limit')||100));
 else if(route==='/card-settings/count'){
  const filters=JSON.parse(p.request.postData);const selected=wordSets.filter(set=>filters.selectedTables.includes('all')||filters.selectedTables.includes(String(set.id)));
  const count=selected.flatMap(set=>setWords.get(set.id)||[]).filter(word=>(filters.selectedStatuses.includes('all')||filters.selectedStatuses.includes(word.status))&&hasSide(word,filters.frontKey)&&hasSide(word,filters.backKey)).length;
  status=countStatus;data=status===200?{data:{count}}:{message:'Count failed'};if(countDelay)await sleep(countDelay);
 }
 else if(route==='/card-settings') {if(p.request.method==='PUT'){status=settingsStatus;if(status===200)settings={...settings,...JSON.parse(p.request.postData)};}data=status===200?{data:settings}:{message:'Settings save failed'};}
 else if(route==='/auth/logout'){status=logoutStatus;data={message:'Logout failed'};}
 else if(route==='/users/me')data={id:1,email:'test@example.com',name:'Test',createdAt:'2025-01-01'};
 else if(route.endsWith('/answer')){status=answerStatus;data={message:'Save failed'};}
 await send('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:origin},{name:'Access-Control-Allow-Credentials',value:'true'},{name:'Access-Control-Allow-Headers',value:'content-type'},{name:'Access-Control-Allow-Methods',value:'GET,POST,PUT,PATCH,DELETE,OPTIONS'}],body:Buffer.from(status===204?'':JSON.stringify(data)).toString('base64')},sessionId);
}
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
let origin;
async function navigate(route){await send('Page.navigate',{url:origin+route});await sleep(900);}
async function click(selector){
 let point;
 for(let attempt=0;attempt<40;attempt++){
  point=await evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e)return null;e.scrollIntoView({block:"center"});const r=e.getBoundingClientRect();const point={x:r.x+r.width/2,y:r.y+r.height/2};const hit=document.elementFromPoint(point.x,point.y);return {...point,covered:!e.contains(hit),hit:hit?.outerHTML.slice(0,250)}})()');
  if(point&&!point.covered)break;
  await sleep(50);
 }
 if(!point||point.covered)throw Error('Unavailable target: '+selector+' '+JSON.stringify(point));
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});await sleep(150);
}

(async()=>{try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
 profile=fs.mkdtempSync(path.join(os.tmpdir(),'vocab-check-chrome-'));
 const executable=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'google-chrome');
 chrome=spawn(executable,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let port;for(let i=0;i<100;i++){await sleep(100);const f=path.join(profile,'DevToolsActivePort');if(fs.existsSync(f)){port=fs.readFileSync(f,'utf8').split('\n')[0];break;}}
 if(!port)throw Error('Chrome did not start; set CHROME_PATH to its executable');
 const targets=await (await fetch('http://127.0.0.1:'+port+'/json')).json();
 const version=await (await fetch('http://127.0.0.1:'+port+'/json/version')).json();
 const mainTarget=targets.find(x=>x.type==='page').id;
 ws=new WebSocket(version.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}else if(m.method==='Fetch.requestPaused'){paused(m.params,m.sessionId).catch(e=>{if(!e.message.includes('Invalid InterceptionId')){events.push({interceptError:e.message});console.error('INTERCEPT',e.message);}});}else if(m.method==='Runtime.exceptionThrown')events.push(m.params.exceptionDetails);else if(m.method==='Target.attachedToTarget'){
  if(m.params.targetInfo.targetId===mainTarget)return;
  popupTargets.add(m.params.targetInfo.targetId);
  (async()=>{await send('Runtime.enable',{},m.params.sessionId);await send('Page.enable',{},m.params.sessionId);let source='';if(popupStorageFails)source+="Storage.prototype.setItem=function(){throw Error('Storage blocked')};";if(popupStorageReset)source+="const nativeGet=Storage.prototype.getItem;Storage.prototype.getItem=function(k){return k==='lexitable:google-popup'?null:nativeGet.call(this,k)};";if(popupMessagesDrop)source+='BroadcastChannel.prototype.postMessage=function(){};';if(source)await send('Page.addScriptToEvaluateOnNewDocument',{source},m.params.sessionId);await send('Fetch.enable',{patterns:[{urlPattern:'*'}]},m.params.sessionId);await send('Runtime.runIfWaitingForDebugger',{},m.params.sessionId);})().catch(e=>console.error('POPUP',e.message));
 }};
 pageSession=(await send('Target.attachToTarget',{targetId:mainTarget,flatten:true})).sessionId;
 await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true,filter:[{type:'page',exclude:false}]});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.setItem('i18nextLng','en');"});
 const text=()=>evaluate("document.body.innerText");
 const queue=()=>evaluate("Object.keys(localStorage).filter(k=>k.startsWith('lexitable:answers:1:')).map(k=>JSON.parse(localStorage.getItem(k)))");
 const button=label=>evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent.includes("+JSON.stringify(label)+")).click()");
 const fill=async(selector,value)=>{await evaluate('(()=>{const input=document.querySelector('+JSON.stringify(selector)+');if(!input)throw Error("missing input");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,'+JSON.stringify(value)+');input.dispatchEvent(new Event("input",{bubbles:true}))})()');await sleep(80);};
 const escape=async()=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await sleep(200);};
 const waitFor=async(expression,message)=>{for(let i=0;i<60;i++){if(await evaluate(expression))return;await sleep(100);}throw Error(message);};
 const clickButton=async label=>{await evaluate('[...document.querySelectorAll("button")].find(e=>e.innerText.trim()==='+JSON.stringify(label)+').setAttribute("data-ui-click","true")');await click('[data-ui-click=true]');await evaluate('document.querySelector("[data-ui-click=true]")?.removeAttribute("data-ui-click")');};
 await navigate('/train?front=original&back=translation&hint=phonetic');
 assert.equal(requests.filter(r=>r.route==='/auth/profile'&&r.method==='GET').length,1);
 await click('button[aria-label*="hint"]');
 assert.match(await text(),/PHONETIC-HINT/);
 assert.doesNotMatch(await text(),/EXAMPLE-HINT/);
 await evaluate("document.querySelector('div[role=button]').focus()");
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 assert.match(await text(),/answer[12]/);
 await evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent.includes('I know')).click();[...document.querySelectorAll('button')].find(e=>e.textContent.includes('I know')).click()");
 await sleep(350);
 assert.match(await text(),/Card 2 \/ 2/);
 assert.match(await text(),/Sending failed/);
 const first=(await queue())[0];assert.equal((await queue()).length,1);assert.equal(first.knows,true);
 await evaluate("window.__storageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('lexitable:answers:'))throw Error('quota');return window.__storageSet.call(this,k,v)}");
 await button('I know');await sleep(100);
 assert.match(await text(),/Card 2 \/ 2/);assert.equal((await queue()).length,1);
 assert.match(await text(),/Could not save the answer on this device/);
 await evaluate("Storage.prototype.setItem=window.__storageSet");
 console.log('PASS: selected hint, keyboard flip, rapid double click, durable save on HTTP 500');
 await navigate('/train?front=original&back=translation&hint=none');
 assert.equal((await queue())[0].id,first.id);
 const area=await evaluate("(()=>{const r=document.querySelector('div[role=button]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...area,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:area.x-120,y:area.y,button:'left',buttons:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:area.x-120,y:area.y,button:'left',clickCount:1});
 await sleep(350);
 assert.match(await text(),/Card 2 \/ 2/);
 assert.doesNotMatch(await evaluate("document.querySelector('div[role=button]').innerText"),/answer[12]/);
 assert.equal((await queue())[1].knows,true);
 answerStatus=200;
 await button('Send again');await sleep(450);
 assert.equal((await queue()).length,0);
 assert.ok(requests.filter(r=>r.route.endsWith('/answer')&&r.method==='POST').map(r=>JSON.parse(r.body).answerId).filter(id=>id===first.id).length>=2);
 console.log('PASS: queue survives reload, left swipe means know, next card remains unflipped, retry uses original ID');
 const beforeOffline=requests.filter(r=>r.route.endsWith('/answer')&&r.method==='POST').length;
 await evaluate("Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false})");
 const nextArea=await evaluate("(()=>{const r=document.querySelector('div[role=button]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...nextArea,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:nextArea.x+120,y:nextArea.y,button:'left',buttons:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:nextArea.x+120,y:nextArea.y,button:'left',clickCount:1});
 await sleep(250);assert.equal((await queue())[0].knows,false);assert.match(await text(),/Results/);
 assert.equal(requests.filter(r=>r.route.endsWith('/answer')&&r.method==='POST').length,beforeOffline);
 await evaluate("Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});window.dispatchEvent(new Event('online'))");
 await sleep(450);assert.equal((await queue()).length,0);
 console.log('PASS: storage failure keeps the card, right swipe means don’t know, offline answers sync on reconnection');
 await send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
 await navigate('/app');await click('button[role=combobox]');await click('[role=option]');await sleep(350);
 const widths=await evaluate("({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})");
 assert.ok(widths.scroll<=widths.client+1,JSON.stringify(widths));
 await click('button[role=switch]');
 assert.equal(await evaluate("document.querySelector('button[role=switch]').getAttribute('aria-checked')"),'true');
 await send('Emulation.clearDeviceMetricsOverride');
 await button('Add word');
 await evaluate("(()=>{const e=document.querySelector('input[placeholder=\"Enter word\"]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,'durable draft');e.dispatchEvent(new Event('input',{bubbles:true}))})()");
 await sleep(100);
 await navigate('/app');await click('button[role=combobox]');await click('[role=option]');await sleep(350);
 await evaluate("document.querySelector('button[role=switch]').click()");await sleep(100);
 assert.equal(await evaluate("document.querySelector('input[placeholder=\"Enter word\"]').value"),'durable draft');
 console.log('PASS: mobile table fits viewport, unsaved draft survives reload');
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await navigate('/cards');const before=requests.length;
 const openSide = async index => {
   await evaluate("document.querySelectorAll('button[role=combobox]')["+index+"].focus()");
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
   await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
   await sleep(200);
 };
 await openSide(0);await click('[role=option][data-state=unchecked]');
 await evaluate("document.querySelectorAll('button[role=combobox]')[1].setAttribute('data-check','back')");
 await openSide(1);await click('[role=option][data-state=unchecked]');
 await sleep(1300);
 const puts=requests.slice(before).filter(r=>r.method==='PUT');
 assert.equal(puts.length,1);assert.equal(JSON.parse(puts[0].body).frontKey,'translation');assert.equal(JSON.parse(puts[0].body).backKey,'original');
 console.log('PASS: quick settings changes produce one consistent save');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await evaluate("document.cookie='sidebar:state=true; path=/';localStorage.setItem('theme','dark')");
 await navigate('/app?set=1');
 const bounds=()=>evaluate('(()=>{const main=document.querySelector("main").getBoundingClientRect();const side=document.querySelector("[data-sidebar=sidebar]").getBoundingClientRect();return {mainLeft:main.left,sideRight:side.right,sideWidth:side.width,scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}})()');
 let layout=await bounds();assert.ok(Math.abs(layout.sideWidth-256)<=1);assert.ok(layout.mainLeft>=layout.sideRight,JSON.stringify(layout));
 const screenshotDir=fs.mkdtempSync(path.join(os.tmpdir(),'lexitable-ui-'));
 const screenshot=async name=>fs.writeFileSync(path.join(screenshotDir,name+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await screenshot('desktop-editor-dark');
 await click('[data-sidebar=trigger]');await sleep(250);layout=await bounds();assert.ok(Math.abs(layout.sideWidth-48)<=1);assert.ok(layout.mainLeft>=layout.sideRight,JSON.stringify(layout));
 await navigate('/cards');layout=await bounds();assert.ok(Math.abs(layout.sideWidth-48)<=1);assert.ok(layout.mainLeft>=layout.sideRight,JSON.stringify(layout));
 await click('button[aria-label="Toggle theme"]');assert.equal(await evaluate('document.documentElement.classList.contains("dark")'),false);
 await screenshot('desktop-cards-light');
 console.log('PASS: expanded and collapsed sidebar reserves its width, state survives navigation, light/dark controls remain visible');

 wordSets=[];setWords.clear();settings={...settings,frontKey:'original',backKey:'translation',hintKey:null,selectedTables:['all'],selectedStatuses:['all']};
 await navigate('/cards');assert.match(await text(),/No word sets yet/);assert.equal(await evaluate('document.querySelectorAll("button[role=combobox]").length'),0);
 await navigate('/app');assert.equal(await evaluate('document.querySelector("#editor-set").disabled'),true);assert.match(await text(),/Create your first word set/);
 assert.equal(await evaluate('document.querySelector("button[type=submit]").disabled'),true);
 await fill('#new-set-title','First words');await click('button[type=submit]');
 await waitFor('location.search.includes("set=3") && !!document.querySelector("button[role=switch]")','Created set must be selected');
 await clickButton('Add word');await fill('input[placeholder="Enter word"]','hello');await fill('input[placeholder="Enter translation"]','привет');
 await fill('input[aria-label="Example"]','Greeting');
 await click('button[aria-label="Save word"]');await waitFor(`!document.querySelector('input[placeholder="Enter word"]')`,'Saved draft must be removed');
 assert.equal(setWords.get(3).length,1);
 await clickButton('Rename set');await fill('input[aria-label="Word set"]','Renamed words');await clickButton('Save');
 await waitFor(`document.body.innerText.includes('Renamed words') && !document.querySelector('input[aria-label="Word set"]')`,'Rename must update the set title');
 await click('button[aria-label="Delete column"]');await clickButton('Delete');
 await waitFor(`!document.querySelector('button[aria-label="Delete column"]')`,'Deleted column must disappear');
 assert.equal(setWords.get(3)[0].customFields.example,'Greeting');
 await click('button[aria-label="Delete word"]');await clickButton('Cancel');assert.equal(setWords.get(3).length,1);
 await click('button[aria-label="Delete word"]');await clickButton('Delete');await waitFor('document.body.innerText.includes("Empty for now")','Deleted word must update the table');assert.equal(setWords.get(3).length,0);
 await clickButton('Delete set');assert.match(await text(),/all its words/);await clickButton('Cancel');assert.equal(wordSets.length,1);
 await clickButton('Delete set');await clickButton('Delete');await waitFor('document.body.innerText.includes("Create your first word set")','Deleted set must return to onboarding');assert.equal(wordSets.length,0);
 console.log('PASS: empty account has no empty dropdowns; create/add/save/rename/delete and cancellation form a complete workflow');

 wordSets=Array.from({length:205},(_,i)=>({id:i+1,title:'Set '+(i+1),customColumns:columns}));
 trainingCards=Array.from({length:205},(_,i)=>({id:i+1,original:'word'+(i+1),translation:'answer'+(i+1),status:i?'LEARNING':'NEW',customFields:{example:'Example '+(i+1),phonetic:'Phonetic '+(i+1)}}));
 setWords.clear();wordSets.forEach(set=>setWords.set(set.id,set.id===1?trainingCards.map(c=>({...c})):[]));
 settings={...settings,frontKey:'original',backKey:'translation',hintKey:null,selectedTables:['all'],selectedStatuses:['all']};
 await navigate('/app?set=1');await click('#editor-set');assert.equal(await evaluate('document.querySelectorAll("[role=option]").length'),205);
 await escape();
 assert.match(await text(),/Loaded 50 of 205/);await clickButton('Show more (155 left)');await waitFor('document.body.innerText.includes("Loaded 100 of 205")','Table must load its next page');
 assert.equal(await evaluate('document.querySelector("thead th").innerText.includes("205")'),true);
 await fill('input[aria-label="Search by words and translations…"]','word205');await waitFor('document.body.innerText.includes("Loaded 1 of 1")','Search must include words beyond the loaded page');assert.match(await text(),/word205/);
 await click('button[aria-label="Clear search"]');await sleep(450);await click('button[role=switch]');
 wordPatchStatus=500;await fill('tbody tr:first-child input','unsaved edit');await evaluate('document.querySelector("tbody tr:first-child input").focus();document.querySelector("tbody tr:first-child input").blur()');
 await waitFor('!!document.querySelector("input[aria-invalid=true]")','Failed cell must be marked');assert.equal(await evaluate('document.querySelector("tbody tr:first-child input").value'),'unsaved edit');
 wordPatchStatus=200;await evaluate('document.querySelector("tbody tr:first-child input").focus();document.querySelector("tbody tr:first-child input").blur()');
 await waitFor('!document.querySelector("input[aria-invalid=true]")','Failed cell must retry');assert.equal(setWords.get(1)[0].original,'unsaved edit');
 console.log('PASS: all 205 sets are selectable; table totals, pagination and search agree; failed edits retain text and can be retried');

 await navigate('/cards');await waitFor('document.querySelector("[data-card-count]")?.innerText==="205"','Count must include all matching words');
 await click('#practice-sets');assert.equal(await evaluate('document.querySelector("#table-1").disabled'),false);await click('#table-2');
 await escape();
 assert.match(await text(),/Select up to 100 individual sets/);await navigate('/cards');
 countDelay=1100;await click('#practice-statuses');await click('#status_NEW');
 assert.match(await evaluate('document.querySelector("[data-card-count]").innerText'),/Counting/);
 assert.equal(await evaluate('[...document.querySelectorAll("button")].find(e=>e.innerText==="Start practice").disabled'),true);
 await click('#status_LEARNING');countDelay=0;
 await escape();
 await waitFor('document.querySelector("[data-card-count]")?.innerText==="0"','Latest filters must win');await sleep(1400);assert.equal(await evaluate('document.querySelector("[data-card-count]").innerText'),'0');assert.match(await text(),/No words match/);
 settings={...settings,selectedStatuses:['all']};countStatus=500;await navigate('/cards');await waitFor('document.body.innerText.includes("Could not count matching words")','Count failure must be explained');
 assert.equal(await evaluate('document.querySelector("[data-card-count]").innerText'),'—');countStatus=200;await clickButton('Try again');await waitFor('document.querySelector("[data-card-count]")?.innerText==="205"','Retry must restore the count');
 settingsStatus=500;await openSide(2);await click('[role=option][data-state=unchecked]');
 await waitFor('document.body.innerText.includes("Settings save failed")','Save error must remain visible');assert.equal(await evaluate('[...document.querySelectorAll("button")].find(e=>e.innerText==="Start practice").disabled'),true);
 settingsStatus=200;await clickButton('Try again');await waitFor('document.body.innerText.includes("Saved automatically")','Settings retry must succeed');
 console.log('PASS: counts hide stale values, latest filters win, zero matches are explained, count/settings failures have working retries');

 wordSets=[{id:1,title:'Main set',customColumns:columns},{id:2,title:'Without phonetic',customColumns:[columns[0]]}];settings={...settings,hintKey:'phonetic',selectedTables:['1'],frontKey:'original',backKey:'translation'};
 await navigate('/cards');assert.match(await evaluate('document.querySelector("#hintKey").innerText'),/Phonetic/);
 await click('#practice-sets');await click('#table-2');await escape();
 assert.match(await evaluate('document.querySelector("#hintKey").innerText'),/No hint/);
 await openSide(2);assert.doesNotMatch(await evaluate('[...document.querySelectorAll("[role=option]")].map(e=>e.innerText).join(",")'),/Phonetic/);
 await escape();await sleep(900);
 settings={...settings,frontKey:'translation',backKey:'original',hintKey:null,selectedStatuses:['all']};await navigate('/train');assert.match(await text(),/Card 1 \/ 205/);assert.match(await evaluate('document.querySelector("div[role=button]").innerText'),/answer\d+/);
 console.log('PASS: custom fields follow sets immediately; direct practice uses saved sides and loads all 205 cards');

 trainingCards=[{...cards[0],customFields:{example:''}},{...cards[1],customFields:{example:'Usable answer'}}];setWords.set(1,trainingCards);settings={...settings,frontKey:'original',backKey:'example',hintKey:'none',selectedTables:['1']};
 await navigate('/cards');await waitFor('document.querySelector("[data-card-count]")?.innerText==="1"','Empty selected sides must not count');
 await clickButton('Start practice');await waitFor('document.body.innerText.includes("Card 1 / 1")','Training must match the usable count');
 await navigate('/cards');await click('#practice-statuses');await click('#status_all');await escape();await waitFor('document.body.innerText.includes("Saved automatically")','Empty selection must be saved');
 assert.deepEqual(settings.selectedStatuses,[]);assert.equal(await evaluate('document.querySelector("[data-card-count]").innerText'),'0');assert.match(await text(),/Select at least one word status/);
 settings={...settings,frontKey:'translation',backKey:'original',selectedStatuses:['all'],selectedTables:['all']};
 console.log('PASS: unusable card sides are excluded from count and deck, optional hints do not exclude cards, empty selection saves as zero');

 await send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});await navigate('/app?set=1');
 const mobileWidth=await evaluate('({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})');assert.ok(mobileWidth.scroll<=mobileWidth.client+1,JSON.stringify(mobileWidth));
 await screenshot('mobile-editor');await click('[data-sidebar=trigger]');assert.ok(await evaluate('!!document.querySelector("[data-mobile=true]")'));
 await click('[data-mobile=true] a[href="/cards"]');await waitFor('location.pathname==="/cards" && !document.querySelector("[data-mobile=true]")','Navigation must close the mobile drawer');
 await screenshot('mobile-cards');await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 console.log('PASS: mobile pages fit the viewport, drawer opens and closes on navigation');console.log('UI screenshots: '+screenshotDir);
 wordSets=[{id:1,title:'Test set',customColumns:columns},{id:2,title:'Other set',customColumns:columns}];trainingCards=cards;setWords.clear();setWords.set(1,cards.map(card=>({...card})));setWords.set(2,[]);settings={...settings,frontKey:'original',backKey:'translation',hintKey:'phonetic',selectedStatuses:['all'],selectedTables:['all']};
 await navigate('/profile');await button('Sign out');await sleep(200);
 assert.equal(await evaluate("location.pathname"),'/profile');assert.match(await text(),/Logout failed/);
 console.log('PASS: failed logout retains the current session');
 mode='hang';await navigate('/');
 assert.ok(await evaluate("document.getElementById('root').childElementCount")>0);
 assert.match(await text(),/Learn words/);
 console.log('PASS: public page renders when session request hangs');
 mode='anon';await navigate('/register');
 await click('button[aria-label="Sign up with Google"]');await sleep(1800);
 assert.equal(await evaluate('location.pathname'),'/app');
 await waitFor('document.body.innerText.includes("Table builder")','The original tab must render the app after Google sign-in');
 const openTargets=await (await fetch('http://127.0.0.1:'+port+'/json')).json();
 assert.ok(!openTargets.some(target=>popupTargets.has(target.id)),'OAuth popup must close after returning to the frontend');
 assert.doesNotMatch(await text(),/Google sign-in window was closed/);
 console.log('PASS: COOP-isolated OAuth popup closes and redirects the original registration tab');
 mode='anon';await navigate('/register');popupStorageReset=true;popupMessagesDrop=true;
 await click('button[aria-label="Sign up with Google"]');await sleep(2800);
 assert.equal(await evaluate('location.pathname'),'/app','Server session polling must recover a lost popup notification');
 const isolatedTargets=(await send('Target.getTargets')).targetInfos;
 assert.ok(!isolatedTargets.some(target=>popupTargets.has(target.targetId)),'Explicit callback must close the popup without session storage');
 popupStorageReset=false;popupMessagesDrop=false;
 console.log('PASS: missing popup session storage and dropped messages still close the popup and authenticate the original tab');
 mode='anon';oauthResult='reject';await navigate('/login');
 await click('button[aria-label="Continue with Google"]');await sleep(1800);
 assert.equal(await evaluate('location.pathname'),'/login');assert.match(await text(),/Google sign-in failed/);
 console.log('PASS: popup success signal does not authenticate without a valid server session');
 mode='anon';oauthResult='wait';await navigate('/login');
 await evaluate('window.__nativeOpen=window.open;window.open=function(...args){return window.__oauthPopup=window.__nativeOpen.apply(this,args)}');
 await click('button[aria-label="Continue with Google"]');await sleep(800);
 assert.equal(await evaluate('window.__oauthPopup.closed'),true,'COOP must actually sever the WindowProxy');
 assert.doesNotMatch(await text(),/Google sign-in window was closed/);
 assert.doesNotMatch(await text(),/Cancel Google sign-in/);
 await evaluate('history.pushState({},"","/");window.dispatchEvent(new PopStateEvent("popstate"))');await sleep(200);
 assert.match(await text(),/Learn words/);
 const canceledPopup=(await send('Target.getTargets')).targetInfos.find(t=>popupTargets.has(t.targetId)&&new URL(t.url).pathname==='/auth/google');
 assert.ok(canceledPopup);
 const canceledSession=(await send('Target.attachToTarget',{targetId:canceledPopup.targetId,flatten:true})).sessionId;
 mode='ok';await send('Page.navigate',{url:origin+'/app'},canceledSession);await sleep(800);
 assert.equal(await evaluate('location.pathname'),'/','Leaving the login page must ignore a late success signal');
 console.log('PASS: no Google cancel button is shown; leaving the login page ignores late popup completion');
 mode='anon';
 await navigate('/login');
 await evaluate('window.__nativeTimeout=window.setTimeout;window.setTimeout=function(fn,delay,...args){return window.__nativeTimeout(fn,delay===600000?100:delay,...args)}');
 await click('button[aria-label="Continue with Google"]');await sleep(500);
 assert.match(await text(),/Google sign-in timed out/);
 assert.equal(await evaluate('document.querySelector(\'button[aria-label="Continue with Google"]\').disabled'),false);
 console.log('PASS: OAuth timeout releases the login form');
 await navigate('/login');
 popupStorageFails=true;oauthResult='success';
 await click('button[aria-label="Continue with Google"]');await sleep(1800);
 assert.equal(await evaluate('location.pathname'),'/app');
 popupStorageFails=false;
 console.log('PASS: OAuth can finish when popup storage writes are blocked');
 mode='anon';await navigate('/login');
 oauthResult='success';await evaluate('window.open=()=>null');
 await click('button[aria-label="Continue with Google"]');await sleep(1000);
 assert.equal(await evaluate('location.pathname'),'/app');
 console.log('PASS: blocked popup falls back to signing in within the original tab');
 assert.equal(events.length,0,JSON.stringify(events));
 console.log('Browser regression checks passed');
 }catch(e){console.error(e.stack);console.error('Browser state:',await evaluate('({path:location.pathname,text:document.body.innerText.slice(0,4000)})').catch(()=>null));console.error('Recent request routes:',requests.slice(-10).map(r=>r.route));console.error('Page targets:',(await send('Target.getTargets').catch(()=>({targetInfos:[]}))).targetInfos.filter(t=>t.type==='page').map(t=>({id:t.targetId,path:new URL(t.url).pathname,attached:t.attached,canAccessOpener:t.canAccessOpener})));process.exitCode=1;}finally{
 if(ws&&ws.readyState===1){await send('Browser.close').catch(()=>{});ws.close();}
 if(chrome)chrome.kill();server.close();setTimeout(()=>process.exit(process.exitCode||0),300);
 }})();
