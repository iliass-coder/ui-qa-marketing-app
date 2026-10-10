// SteadySignal complete product-design prototype.
// Native editable Figma layers, six linked desktop screens, and no network calls.
const C={
  rail:'#26383E',railActive:'#354B50',paper:'#F5F2EA',white:'#FFFEFB',ink:'#29383E',
  muted:'#78857F',soft:'#AAB7B1',line:'#E6DDCF',coral:'#CE654D',coralLight:'#F7EAE4',
  green:'#4D795F',greenLight:'#E7EEE5',amber:'#A87538',amberLight:'#F5EBDD',
  blue:'#56717B',blueLight:'#EAF0F1',sage:'#B8C8B7',
};
const FONT={family:'Inter',style:'Regular'},MED={family:'Inter',style:'Medium'},SEMI={family:'Inter',style:'Semi Bold'},BOLD={family:'Inter',style:'Bold'},SERIF={family:'Georgia',style:'Bold'};
const W=1440,H=1024,GAP=84,frames={},routes=[];
function rgb(h){const s=h.slice(1);return{r:parseInt(s.slice(0,2),16)/255,g:parseInt(s.slice(2,4),16)/255,b:parseInt(s.slice(4,6),16)/255};}
function fills(c){return[{type:'SOLID',color:rgb(c)}];}
function rect(p,x,y,w,h,c,r=0,stroke=null){const n=figma.createRectangle();n.x=x;n.y=y;n.resize(w,h);n.fills=fills(c);if(r)n.cornerRadius=r;if(stroke)n.strokes=fills(stroke);p.appendChild(n);return n;}
function dot(p,x,y,d,c){const n=figma.createEllipse();n.x=x;n.y=y;n.resize(d,d);n.fills=fills(c);p.appendChild(n);return n;}
function box(p,x,y,w,h,c,r=0,stroke=null){const n=figma.createFrame();n.x=x;n.y=y;n.resize(w,h);n.fills=fills(c);n.cornerRadius=r;n.clipsContent=false;if(stroke)n.strokes=fills(stroke);p.appendChild(n);return n;}
function txt(p,s,x,y,w,h,size=12,color=C.ink,weight='Regular',serif=false){const n=figma.createText();n.fontName=serif?SERIF:weight==='Bold'?BOLD:weight==='Semi Bold'?SEMI:weight==='Medium'?MED:FONT;n.fontSize=size;n.fills=fills(color);n.characters=s;n.x=x;n.y=y;n.resize(w,h);p.appendChild(n);return n;}
function rule(p,x,y,w,c=C.line){rect(p,x,y,w,1,c);}
function chip(p,label,x,y,w,bg,fg,size=8){const n=box(p,x,y,w,25,bg,13);txt(n,label,10,6,w-20,14,size,fg,'Medium');return n;}
function button(p,label,x,y,w,primary=false){const n=box(p,x,y,w,38,primary?C.coral:C.white,8,primary?null:C.line);txt(n,label,13,11,w-26,16,10,primary?C.white:C.ink,'Medium');return n;}
function card(p,x,y,w,h){return box(p,x,y,w,h,C.white,11,C.line);}
function link(n,to){routes.push({node:n,to});}
function heading(f,k,title,sub){txt(f,k.toUpperCase(),280,92,760,14,8,C.coral,'Medium');txt(f,title,280,115,900,46,34,C.ink,'Bold',true);txt(f,sub,280,164,950,23,12,C.muted,'Regular');}
function metric(f,x,w,k,v,sub,color=C.ink){const c=card(f,x,218,w,108);txt(c,v,18,15,w-36,33,24,color,'Bold',true);txt(c,k,18,51,w-36,17,10,C.ink,'Medium');txt(c,sub,18,77,w-36,14,8,C.muted,'Regular');}

function shell(name,index,active){
  const f=figma.createFrame();f.name=`SteadySignal / ${name}`;f.resize(W,H);f.x=index*(W+GAP);f.y=0;f.fills=fills(C.paper);f.clipsContent=true;figma.currentPage.appendChild(f);frames[name]=f;
  rect(f,0,0,236,H,C.rail);
  // Wordmark and signal mark, drawn from simple native shapes.
  txt(f,'S',25,17,36,41,34,'#F6F1E8','Bold',true);dot(f,26,48,6,C.coral);txt(f,'steady signal',69,27,145,23,16,C.white,'Medium');txt(f,'CAMPAIGN ASSURANCE',69,51,145,13,7,'#BBC7C1','Medium');
  txt(f,'WORKSPACE',25,94,168,14,8,'#ADB9B3','Medium');
  const nav=[['Overview','Overview','◫'],['Campaigns','Campaigns','↗'],['Site watch','Site watch','○'],['Settings','Settings','⚙']];
  nav.forEach((v,i)=>{const activeRow=v[1]===active;const row=box(f,14,122+i*46,212,37,activeRow?C.railActive:C.rail,8);if(activeRow)rect(row,0,10,3,17,C.coral,2);txt(row,v[2],12,9,18,18,12,activeRow?'#DFE6DE':C.soft,'Medium');txt(row,v[0],39,10,156,17,10,activeRow?C.white:'#BCC7C1','Medium');if(!activeRow)link(row,v[1]);});
  rule(f,25,321,188,'#AAB7B1');txt(f,'CONNECTED ACCOUNT',25,341,175,13,8,'#ADB9B3','Medium');dot(f,27,376,8,C.green);txt(f,'Meta Ads',44,371,145,17,10,C.white,'Medium');txt(f,'Northstar US account',44,390,155,15,8,'#AAB7B1','Regular');
  const help=box(f,18,944,200,61,C.railActive,9);txt(help,'Need a hand?',12,10,178,15,9,C.white,'Medium');txt(help,'Help centre  ·  Send feedback',12,32,178,13,7,'#C0CBC5','Regular');
  rect(f,236,0,W-236,64,C.white);txt(f,'Northstar Studio   /',271,24,130,17,9,C.muted,'Regular');txt(f,name,401,24,210,17,9,C.muted,'Regular');chip(f,'●  Meta Ads connected',1125,16,246,C.greenLight,C.green,8);
  return f;
}

function overview(){
  const f=shell('Overview',0,'Overview');heading(f,'Monday overview','A steady read on your campaigns.','Catch mismatches before launch. Keep an eye on the pages already live.');
  const primary=button(f,'Review 3 campaigns',1107,116,186,true);link(primary,'Campaigns');
  metric(f,280,324,'Campaigns running','12','Across 2 ad accounts');metric(f,620,324,'Need a closer look','3','Two prices · one tracking link',C.coral);metric(f,960,324,'Pages monitored','9 / 10','Checked every 30 minutes',C.green);
  txt(f,'Before the next dollar goes out',280,364,600,31,22,C.ink,'Bold',true);txt(f,'Campaigns waiting for a quick QA pass',280,395,560,17,9,C.muted,'Regular');chip(f,'3 TO REVIEW',1156,372,112,C.amberLight,C.amber,8);
  const list=card(f,280,429,690,388),watch=card(f,994,429,298,388);
  txt(list,'Autumn collection · Alba',18,18,390,19,11,C.ink,'Medium');txt(list,'Meta · Prospecting · 2 ads',18,43,300,15,8,C.muted,'Regular');dot(list,19,75,7,C.coral);txt(list,'Price differs: $79 in ad / $89 on page',34,72,410,16,8,C.coral,'Medium');const finding=button(list,'Review finding',514,56,145,true);link(finding,'QA report');rule(list,18,130,654);
  txt(list,'Retargeting · Core range',18,148,390,19,11,C.ink,'Medium');txt(list,'Meta · Retargeting · 3 ads',18,174,300,15,8,C.muted,'Regular');dot(list,19,207,7,C.blue);txt(list,'Ready for a prelaunch pass',34,203,330,16,8,C.muted,'Regular');const run=button(list,'Run QA',514,175,145,false);link(run,'QA report');rule(list,18,248,654);
  txt(list,'Holiday early access',18,267,390,19,11,C.ink,'Medium');txt(list,'Meta · Prospecting · 1 ad',18,293,300,15,8,C.muted,'Regular');dot(list,19,326,7,C.green);txt(list,'Last checked 24 minutes ago',34,322,330,16,8,C.muted,'Regular');const report=button(list,'View report',514,293,145,false);link(report,'QA report');
  txt(watch,'Site watch',19,17,225,28,21,C.ink,'Bold',true);txt(watch,'AUTOMATIC CHECKS · EVERY 30 MIN',19,49,240,13,7,C.green,'Medium');rule(watch,19,75,260);
  [['atelier-alba.com','All clear','9:30 AM',C.green],['shop.northline.co','Page responded slowly','9:00 AM',C.amber],['northline.co/sale','All clear','9:00 AM',C.green]].forEach((s,i)=>{const y=96+i*77;dot(watch,20,y+6,8,s[3]);txt(watch,s[0],37,y,215,17,9,C.ink,'Medium');txt(watch,s[1],37,y+23,178,16,8,s[3],'Regular');txt(watch,s[2],211,y+23,58,16,7,C.muted,'Regular');if(i<2)rule(watch,36,y+57,233);});
  const open=button(watch,'Open site watch',19,333,260,false);link(open,'Site watch');txt(f,'Checks use the campaign and page data available to your connected account.',280,849,740,18,8,C.muted,'Regular');
}

function campaigns(){
  const f=shell('Campaigns',1,'Campaigns');heading(f,'Campaign assurance','Campaigns to review.','Check the offer, destination, and tracking before budget goes live.');const sync=button(f,'Sync Meta Ads',1164,116,128,false);
  metric(f,280,324,'Needs attention','3','Two offer mismatches · one tracking link',C.coral);metric(f,620,324,'Ready for QA','4','Draft or scheduled campaigns');metric(f,960,324,'Currently running','12','Across 2 ad accounts',C.green);
  txt(f,'Campaign queue',280,364,500,31,22,C.ink,'Bold',true);txt(f,'Review upcoming launches and monitor campaigns already live.',280,395,600,17,9,C.muted,'Regular');
  const tabs=[['All campaigns',280,92,true],['Before launch',383,100,false],['Live',493,56,false]];tabs.forEach(t=>{const p=box(f,t[1],416,t[2],30,t[3]?C.rail:C.white,15,t[3]?null:C.line);txt(p,t[0],10,8,t[2]-20,15,8,t[3]?C.white:C.muted,'Medium');});
  const table=card(f,280,461,1012,399);rect(table,0,0,1012,42,'#F8F5EF',11);[['CAMPAIGN',18,290],['TYPE',365,120],['LAUNCH',520,110],['CHECK',672,150],['',865,120]].forEach(h=>txt(table,h[0],h[1],14,h[2],14,8,C.muted,'Medium'));
  const rows=[['Autumn collection · Alba','Prospecting · 2 ads','Oct 14','Price differs','Review',C.coral,C.coralLight],['Retargeting · Core range','Retargeting · 3 ads','Oct 16','Not checked','Run QA',C.blue,C.blueLight],['Holiday early access','Prospecting · 1 ad','Oct 21','Passed','Report',C.green,C.greenLight],['October remarketing','Retargeting · 4 ads','Live','Monitoring','Report',C.green,C.greenLight]];
  rows.forEach((r,i)=>{const y=42+i*88;rule(table,18,y+87,976);const icon=box(table,18,y+20,30,30,i===0?C.coralLight:'#E9EEE7',8);txt(icon,r[0][0],9,7,13,15,10,i===0?C.coral:C.green,'Semi Bold');txt(table,r[0],60,y+19,290,17,10,C.ink,'Medium');txt(table,'Meta Ads · Northstar US',60,y+42,280,14,8,C.muted,'Regular');txt(table,r[1],365,y+31,145,16,9,C.ink,'Regular');txt(table,r[2],520,y+31,120,16,9,C.ink,'Regular');chip(table,r[3],672,y+25,r[3]==='Price differs'?105:95,r[3]==='Price differs'?C.coralLight:r[6],r[6],7);const b=button(table,r[4],863,y+24,126,r[4]==='Review');link(b,'QA report');});
  txt(f,'A check compares the Meta ad with the page customers land on. Re-run QA after any edit.',280,881,850,18,8,C.muted,'Regular');
}

function qa(){
  const f=shell('QA report',2,'Campaigns');heading(f,'Campaign QA · Autumn collection · Alba','The advertised price does not match the page.','The ad says $79. The product page currently shows $89.');const back=button(f,'←  Campaigns',1164,116,128,false);link(back,'Campaigns');chip(f,'REVIEW BEFORE LAUNCH',280,204,165,C.coralLight,C.coral,8);
  const ad=card(f,280,246,484,298),page=card(f,788,246,504,298);
  txt(ad,'THE AD',19,17,180,14,8,C.muted,'Medium');chip(ad,'META · PROSPECTING',337,13,132,C.blueLight,C.blue,7);box(ad,19,47,446,137,'#F2E8DD',8);box(ad,34,61,104,109,'#D9C8AF',5);txt(ad,'ALBA',49,100,80,22,17,C.ink,'Bold',true);txt(ad,'SUMMER LINEN',158,68,250,14,8,C.coral,'Medium');txt(ad,'A lighter layer\nfor warmer days.',158,90,276,50,20,C.ink,'Bold',true);txt(ad,'Only $79 today',158,146,235,19,11,C.green,'Semi Bold');txt(ad,'PRIMARY TEXT',19,201,150,14,8,C.muted,'Medium');txt(ad,'Meet Alba linen: breathable, soft, and made for long summer evenings.',19,221,438,38,9,C.ink,'Regular');
  txt(page,'LIVE LANDING PAGE',19,17,240,14,8,C.muted,'Medium');chip(page,'atelier-alba.com',361,13,108,C.greenLight,C.green,7);box(page,19,47,466,137,'#F7F5EF',8);rect(page,19,47,466,21,'#ECEAE3',7);dot(page,29,55,5,'#D78B77');dot(page,40,55,5,'#D5B46B');dot(page,51,55,5,'#8DB097');txt(page,'atelier-alba.com/products/alba',78,52,280,14,7,C.muted,'Regular');box(page,32,80,172,94,'#E8E1D5',5);rect(page,52,92,64,68,'#D2C4AE',5);rect(page,124,99,60,5,'#CFC4B5',2);rect(page,124,113,48,5,'#D9D0C3',2);rect(page,124,127,54,5,'#D9D0C3',2);txt(page,'ALBA LINEN SHIRT',222,90,235,16,9,C.ink,'Semi Bold');txt(page,'$89',222,112,130,23,17,C.ink,'Bold',true);txt(page,'Natural linen · Sand',222,139,220,16,8,C.muted,'Regular');txt(page,'PAGE PRICE',19,201,150,14,8,C.muted,'Medium');txt(page,'$89',19,220,62,24,16,C.coral,'Bold',true);txt(page,'$10 higher than the price in the ad',89,225,330,18,9,C.coral,'Medium');
  const result=card(f,280,568,1012,244);txt(result,'What we checked',19,17,270,22,15,C.ink,'Bold',true);txt(result,'The evidence behind this finding',19,43,400,16,9,C.muted,'Regular');rule(result,19,72,974);
  const checks=[['✓','Page is reachable','atelier-alba.com · 200 OK · 342 ms',C.green,C.greenLight],['✓','Product matches','Alba linen shirt found on landing page',C.green,C.greenLight],['!','Price differs','Ad $79  ·  Page $89  ·  Difference $10',C.coral,C.coralLight],['✓','Tracking link present','Campaign and source parameters detected',C.green,C.greenLight]];
  checks.forEach((r,i)=>{const x=19+i*245;if(i)rect(result,x-11,91,1,89,C.line);dot(result,x,96,18,r[4]);txt(result,r[0],x+5,98,10,13,8,r[3],'Bold');txt(result,r[1],x+26,96,200,16,9,C.ink,'Semi Bold');txt(result,r[2],x+26,119,205,45,8,C.muted,'Regular');});
  txt(result,'Suggested fix',19,185,120,14,8,C.coral,'Semi Bold');txt(result,'Update the Meta ad price or correct the product page before publishing.',124,183,560,18,9,C.ink,'Regular');const rerun=button(result,'Run QA again',823,181,151,true);link(rerun,'Campaigns');
}

function siteWatch(){
  const f=shell('Site watch',3,'Site watch');heading(f,'Automatic checks · every 30 minutes','Your pages, checked around the clock.','Catch downtime and slow responses before customers have to tell you.');const check=button(f,'Check all pages now',1122,116,170,true);
  metric(f,280,324,'Pages monitored','9 / 10','One destination needs attention',C.green);metric(f,620,324,'Availability','99.96%','Past 30 days',C.green);metric(f,960,324,'Slow response','1','shop.northline.co',C.amber);
  const banner=card(f,280,350,1012,76);dot(banner,20,25,9,C.green);txt(banner,'All monitored pages are responding',42,18,500,19,11,C.ink,'Semi Bold');txt(banner,'Last sweep 9:30 AM  ·  Next sweep 10:00 AM',42,43,500,16,8,C.muted,'Regular');chip(banner,'MONITORING ON',850,24,135,C.greenLight,C.green,8);
  txt(f,'Your monitored pages',280,455,500,29,20,C.ink,'Bold',true);txt(f,'Campaign destinations and storefront pages',280,486,580,17,9,C.muted,'Regular');
  const list=card(f,280,516,620,364),incident=card(f,924,516,368,364);
  const urls=[['atelier-alba.com','Homepage','All clear','218 ms',C.green],['shop.northline.co','Storefront','Responded slowly','1.8 s',C.amber],['northline.co/sale','Sale page','All clear','260 ms',C.green],['atelier-alba.com/summer','Campaign landing page','All clear','304 ms',C.green]];
  urls.forEach((r,i)=>{const y=17+i*82;if(i)rule(list,18,y,584);dot(list,20,y+20,8,r[4]);txt(list,r[0],38,y+10,260,17,10,C.ink,'Medium');txt(list,r[1],38,y+34,250,15,8,C.muted,'Regular');chip(list,r[2],367,y+17,r[2]==='All clear'?84:123,r[2]==='All clear'?C.greenLight:C.amberLight,r[4],7);txt(list,r[3],515,y+23,76,16,8,C.muted,'Regular');});
  txt(incident,'One recent slowdown',18,18,280,23,14,C.ink,'Bold',true);chip(incident,'RESOLVED',248,17,98,C.greenLight,C.green,7);txt(incident,'shop.northline.co',18,65,260,18,10,C.ink,'Medium');txt(incident,'Response time exceeded your usual range.',18,91,320,30,8,C.amber,'Regular');rule(incident,18,136,332);
  [['9:00 AM','Slow response detected'],['9:02 AM','Page returned successfully'],['9:30 AM','Back to normal range']].forEach((r,i)=>{const y=157+i*54;dot(incident,20,y+3,7,i?C.green:C.amber);txt(incident,r[0],37,y,76,14,8,C.muted,'Medium');txt(incident,r[1],37,y+19,300,16,8,C.ink,'Regular');});
  const manage=button(incident,'Monitoring settings',18,316,332,false);link(manage,'Settings');
}

function settings(){
  const f=shell('Settings',4,'Settings');heading(f,'Workspace preferences','Keep your checks useful.','Choose the accounts, pages, and alerts that matter to your team.');
  const account=card(f,280,218,1012,176);txt(account,'Ad account',20,19,240,23,15,C.ink,'Bold',true);txt(account,'Campaign data used for prelaunch and live QA.',20,47,500,17,9,C.muted,'Regular');rule(account,20,78,972);const meta=box(account,20,97,38,38,'#EAF0F1',9);txt(meta,'M',11,9,17,18,13,C.blue,'Bold');txt(account,'Meta Ads · Northstar US',73,99,360,17,10,C.ink,'Semi Bold');txt(account,'Connected and syncing',73,121,360,16,8,C.green,'Regular');chip(account,'CONNECTED',859,102,112,C.greenLight,C.green,7);const disconnect=button(account,'Reconnect',857,141,116,false);
  const monitoring=card(f,280,417,492,300);txt(monitoring,'Site monitoring',19,18,250,23,15,C.ink,'Bold',true);txt(monitoring,'A steady check on your key destinations.',19,46,400,17,9,C.muted,'Regular');rule(monitoring,19,76,454);txt(monitoring,'Check interval',19,96,200,16,9,C.ink,'Medium');const interval=box(monitoring,19,121,454,39,C.white,7,C.line);txt(interval,'Every 30 minutes',13,11,330,17,9,C.ink,'Medium');txt(interval,'▾',423,11,18,17,10,C.muted,'Medium');txt(monitoring,'Monitored pages',19,181,200,16,9,C.ink,'Medium');txt(monitoring,'9 active destinations',19,204,210,16,8,C.muted,'Regular');const pages=button(monitoring,'Manage pages',19,238,144,false);
  const alerts=card(f,794,417,498,300);txt(alerts,'Notifications',19,18,250,23,15,C.ink,'Bold',true);txt(alerts,'Send a note when something needs attention.',19,46,420,17,9,C.muted,'Regular');rule(alerts,19,76,460);
  [['Campaign QA findings','When an ad and page disagree',true],['Site unavailable','When a page stops responding',true],['Slow page response','When a page is unusually slow',false]].forEach((r,i)=>{const y=95+i*58;txt(alerts,r[0],19,y,290,16,9,C.ink,'Medium');txt(alerts,r[1],19,y+20,325,14,8,C.muted,'Regular');const sw=box(alerts,421,y+4,40,22,r[2]?C.green:C.line,12);dot(sw,r[2]?22:4,3,16,C.white);});
  const save=button(f,'Save preferences',1123,750,169,true);
  txt(f,'Your access tokens stay with Meta. SteadySignal only reads the campaign data needed to run these checks.',280,819,960,32,8,C.muted,'Regular');
}

function connect(){
  const f=figma.createFrame();f.name='SteadySignal / Connect account';f.resize(W,H);f.x=5*(W+GAP);f.y=0;f.fills=fills(C.paper);f.clipsContent=true;figma.currentPage.appendChild(f);frames['Connect account']=f;
  rect(f,0,0,W,67,C.white);txt(f,'S',42,15,36,41,34,C.rail,'Bold',true);dot(f,43,47,6,C.coral);txt(f,'steady signal',87,26,145,23,16,C.ink,'Medium');txt(f,'CAMPAIGN ASSURANCE',87,50,145,13,7,C.muted,'Medium');chip(f,'SETUP · 1 OF 2',1135,20,157,C.greenLight,C.green,8);
  const panel=card(f,392,150,656,700);txt(panel,'WELCOME TO STEADY SIGNAL',44,48,565,14,8,C.coral,'Semi Bold');txt(panel,'Start with the campaigns\nyou already run.',44,83,570,91,30,C.ink,'Bold',true);txt(panel,'Connect Meta Ads to review campaigns before launch and keep an eye on the pages that are live.',44,191,545,46,11,C.muted,'Regular');
  const steps=[['01','Connect an ad account','Choose the Meta account with your campaigns.'],['02','Add the pages you care about','We will check availability every 30 minutes.'],['03','Review your first QA pass','See mismatches with the ad and page side by side.']];
  steps.forEach((s,i)=>{const y=277+i*82;const n=box(panel,44,y,31,31,i===0?C.rail:C.greenLight,16);txt(n,s[0],7,9,18,13,8,i===0?C.white:C.green,'Medium');txt(panel,s[1],91,y,480,18,10,C.ink,'Semi Bold');txt(panel,s[2],91,y+23,490,17,8,C.muted,'Regular');});
  const start=button(panel,'Connect Meta Ads',44,545,568,true);link(start,'Overview');txt(panel,'You can disconnect at any time in Settings.',44,599,480,16,8,C.muted,'Regular');
  txt(f,'No campaign changes are made from SteadySignal.',500,888,440,16,8,C.muted,'Regular');
}

async function main(){try{
  await Promise.all([figma.loadFontAsync(FONT),figma.loadFontAsync(MED),figma.loadFontAsync(SEMI),figma.loadFontAsync(BOLD),figma.loadFontAsync(SERIF)]);
  figma.currentPage.name='SteadySignal · Product design';
  overview();campaigns();qa();siteWatch();settings();connect();
  const target={Overview:frames.Overview,Campaigns:frames.Campaigns,'QA report':frames['QA report'],'Site watch':frames['Site watch'],Settings:frames.Settings};
  await Promise.all(routes.map(r=>r.node.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',destinationId:target[r.to].id,navigation:'NAVIGATE',transition:null}]}])));
  figma.currentPage.selection=[frames.Overview];figma.viewport.scrollAndZoomIntoView([frames.Overview]);
  figma.closePlugin('Complete SteadySignal prototype created — six linked screens.');
}catch(e){figma.closePlugin(`SteadySignal design could not finish: ${e&&e.message?e.message:e}`);}}
main();
