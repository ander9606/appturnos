/**
 * AppTurnos — Pantallas principales (core app)
 * Pantallas:
 *   2.1 Dashboard      — Home: métricas del día + turnos próximos + acciones rápidas
 *   2.2 Mis Turnos     — Calendario semanal + lista de turnos
 *   2.3 Nómina         — Resumen mensual + lista empleados + estado nómina
 *   2.4 Equipo         — Lista empleados + filtros + acceso a perfil
 *
 * fileKey: x165H2a9jejueix7aPKeuF  (página 2 → Auth; estas van en página 2 con offset X)
 * NOTA: Ejecutar en la página "🔐 Auth" a partir de x=1320 (siguiendo las 3 pantallas auth)
 *       O crear una página nueva si hay slots disponibles.
 */

async function lf(fam,sty){try{await figma.loadFontAsync({family:fam,style:sty});}catch(e){}}
await Promise.all([lf("Inter","Regular"),lf("Inter","Medium"),lf("Inter","Semi Bold"),lf("Inter","Bold"),lf("Inter","Extra Bold")]);

function hex(h,a=1){return{r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255,a};}

// Ejecutar en la página Auth (ya tiene las 3 pantallas en x=0,430,860)
const page = figma.root.children.find(p=>p.name.includes("Auth"));
await figma.setCurrentPageAsync(page);

// ── helpers ────────────────────────────────────────────────────────────────
function txt(chars,size,style,color,opts={}){
  const t=figma.createText(); t.fontName={family:"Inter",style};
  t.fontSize=size; t.characters=String(chars);
  t.fills=[{type:"SOLID",color:hex(color)}];
  if(opts.align) t.textAlignHorizontal=opts.align;
  if(opts.lh)    t.lineHeight={unit:"PIXELS",value:opts.lh};
  if(opts.w){t.textAutoResize="HEIGHT";t.resize(opts.w,20);}
  if(opts.opacity!==undefined) t.opacity=opts.opacity;
  return t;
}
function vf(name,o={}){
  const f=figma.createFrame(); f.name=name; f.layoutMode="VERTICAL";
  f.primaryAxisSizingMode=o.fixH?"FIXED":"AUTO";
  f.counterAxisSizingMode=o.fixW?"FIXED":"AUTO";
  if(o.w) f.resize(o.w,o.h||100);
  f.itemSpacing=o.gap??0; f.paddingTop=o.pt??0; f.paddingBottom=o.pb??0;
  f.paddingLeft=o.pl??0; f.paddingRight=o.pr??0; f.cornerRadius=o.r??0;
  f.fills=o.bg?[{type:"SOLID",color:hex(o.bg),opacity:o.op??1}]:[];
  if(o.bd){f.strokes=[{type:"SOLID",color:hex(o.bd)}];f.strokeWeight=o.bw??1.5;}
  if(o.ah) f.primaryAxisAlignItems=o.ah;
  if(o.av) f.counterAxisAlignItems=o.av;
  if(o.sh) f.effects=[{type:"DROP_SHADOW",visible:true,blendMode:"NORMAL",
    color:{r:0,g:0,b:0,a:o.sha??0.08},offset:{x:0,y:4},radius:o.shr??16,spread:0}];
  return f;
}
function hf(name,o={}){
  const f=figma.createFrame(); f.name=name; f.layoutMode="HORIZONTAL";
  f.primaryAxisSizingMode=o.fixW?"FIXED":"AUTO";
  f.counterAxisSizingMode=o.fixH?"FIXED":"AUTO";
  if(o.w) f.resize(o.w,o.h||40);
  f.itemSpacing=o.gap??0; f.paddingTop=o.pt??0; f.paddingBottom=o.pb??0;
  f.paddingLeft=o.pl??0; f.paddingRight=o.pr??0; f.cornerRadius=o.r??0;
  f.fills=o.bg?[{type:"SOLID",color:hex(o.bg)}]:[];
  if(o.bd){f.strokes=[{type:"SOLID",color:hex(o.bd)}];f.strokeWeight=o.bw??1.5;}
  if(o.ah) f.primaryAxisAlignItems=o.ah;
  if(o.av) f.counterAxisAlignItems=o.av;
  if(o.sh) f.effects=[{type:"DROP_SHADOW",visible:true,blendMode:"NORMAL",
    color:{r:0,g:0,b:0,a:0.07},offset:{x:0,y:4},radius:12,spread:0}];
  return f;
}
function avatar(initials,bg,size=36,fs=13){
  const av=vf(`av-${initials}`,{bg,r:size/2,ah:"CENTER",av:"CENTER",fixH:true,fixW:true});
  av.resize(size,size);
  const t=txt(initials,fs,"Bold","#FFFFFF",{align:"CENTER"}); av.appendChild(t); return av;
}
function badge(label,bg,color,r=100){
  const b=hf(`badge-${label}`,{pt:4,pb:4,pl:10,pr:10,r,bg,ah:"CENTER",av:"CENTER"});
  b.appendChild(txt(label,11,"Semi Bold",color,{align:"CENTER"})); return b;
}
function statusBar(light=false){
  const bar=hf("SB",{fixW:true,fixH:true,pt:14,pl:24,pr:24,ah:"SPACE_BETWEEN",av:"CENTER"});
  bar.resize(390,44); bar.fills=[];
  bar.appendChild(txt("9:41",15,"Semi Bold",light?"#FFFFFF":"#0F172A"));
  const ic=hf("ic",{gap:5,av:"CENTER"}); ic.fills=[];
  ["▪▪▪","WiFi","100%"].forEach(s=>ic.appendChild(txt(s,9,"Regular",light?"#FFFFFF":"#0F172A")));
  bar.appendChild(ic); return bar;
}
function homeBar(){
  const w=hf("HB",{fixW:true,fixH:true,ah:"CENTER",av:"CENTER"});
  w.resize(390,34); w.fills=[];
  const b=figma.createFrame(); b.resize(134,5); b.cornerRadius=3;
  b.fills=[{type:"SOLID",color:hex("#0F172A",0.18)}]; w.appendChild(b); return w;
}
// Bottom tab bar
function tabBar(active="home"){
  const bar=hf("TabBar",{fixW:true,fixH:true,ah:"SPACE_BETWEEN",av:"CENTER",
    pt:8,pb:0,pl:20,pr:20,bg:"#FFFFFF",bd:"#E2E8F0",bw:1});
  bar.resize(390,60);
  bar.strokes=[{type:"SOLID",color:hex("#E2E8F0")}]; bar.strokeAlign="OUTSIDE";
  bar.effects=[{type:"DROP_SHADOW",visible:true,blendMode:"NORMAL",
    color:{r:0,g:0,b:0,a:0.06},offset:{x:0,y:-4},radius:12,spread:0}];
  const tabs=[
    {id:"home",  icon:"⊞", label:"Inicio"},
    {id:"shifts",icon:"📅",label:"Turnos"},
    {id:"payroll",icon:"💰",label:"Nómina"},
    {id:"team",  icon:"👥",label:"Equipo"},
    {id:"more",  icon:"⋯", label:"Más"},
  ];
  for(const tab of tabs){
    const col=vf(`tab-${tab.id}`,{gap:2,ah:"CENTER",av:"CENTER",pt:4,pb:4,pl:10,pr:10,r:12,
      bg:tab.id===active?"#FFEDD5":"transparent"});
    const ic=txt(tab.icon,20,"Regular",tab.id===active?"#FF5A3C":"#94A3B8",{align:"CENTER"});
    const lb=txt(tab.label,10,tab.id===active?"Semi Bold":"Regular",
      tab.id===active?"#FF5A3C":"#94A3B8",{align:"CENTER"});
    col.appendChild(ic); col.appendChild(lb); bar.appendChild(col);
  }
  return bar;
}
function makeScreen(name,x){
  const s=figma.createFrame(); s.name=name; s.resize(390,844); s.x=x; s.y=0;
  s.layoutMode="NONE"; s.clipsContent=true; s.cornerRadius=44;
  s.fills=[{type:"SOLID",color:hex("#F8FAFC")}];
  s.effects=[{type:"DROP_SHADOW",visible:true,blendMode:"NORMAL",
    color:{r:0,g:0,b:0,a:0.14},offset:{x:0,y:10},radius:48,spread:0}];
  return s;
}
function shiftRow(turno,hora,dept,colorDot,bg){
  const row=hf(`shift-${turno}`,{fixW:true,w:310,pt:14,pb:14,pl:16,pr:16,r:16,
    bg,gap:12,av:"CENTER",sh:true,sha:0.05,shr:12});
  const dot=figma.createEllipse(); dot.resize(8,8);
  dot.fills=[{type:"SOLID",color:hex(colorDot)}]; row.appendChild(dot);
  const info=vf("info",{gap:3}); info.fills=[];
  info.appendChild(txt(turno,14,"Semi Bold","#0F172A"));
  info.appendChild(txt(hora+" · "+dept,12,"Regular","#64748B"));
  row.appendChild(info);
  return row;
}

// ══════════════════════════════════════════════════════════════════════════
// 2.1 DASHBOARD
// ══════════════════════════════════════════════════════════════════════════
const dash=makeScreen("2.1 Dashboard",1320);

// Header gradient
const dashHdr=figma.createFrame(); dashHdr.resize(390,160); dashHdr.x=0; dashHdr.y=0;
dashHdr.fills=[{type:"GRADIENT_LINEAR",
  gradientStops:[{position:0,color:hex("#FF5A3C")},{position:1,color:hex("#FF8C42")}],
  gradientTransform:[[0,1,0],[-1,0,1]]}];
dash.appendChild(dashHdr);

const dashSB=statusBar(true); dashSB.x=0; dashSB.y=0; dashHdr.appendChild(dashSB);

// Top nav row
const dashNav=hf("nav",{fixW:true,w:390,pt:0,pb:0,pl:24,pr:24,ah:"SPACE_BETWEEN",av:"CENTER"});
dashNav.fills=[]; dashNav.resize(390,40); dashNav.x=0; dashNav.y=50;
const greetCol=vf("greet",{gap:2}); greetCol.fills=[];
greetCol.appendChild(txt("Buenos días 👋",13,"Regular","#FFFFFF",{opacity:0.85}));
greetCol.appendChild(txt("María García",18,"Bold","#FFFFFF"));
dashNav.appendChild(greetCol);
const notifBtn=vf("notif",{bg:"#FFFFFF",r:12,ah:"CENTER",av:"CENTER",fixH:true,fixW:true});
notifBtn.resize(40,40); notifBtn.fills=[{type:"SOLID",color:hex("#FFFFFF",0.2)}];
notifBtn.appendChild(txt("🔔",18,"Regular","#FFFFFF",{align:"CENTER"}));
dashNav.appendChild(notifBtn);
dashHdr.appendChild(dashNav);

// Scroll content
const dashScroll=figma.createFrame(); dashScroll.resize(390,630); dashScroll.x=0; dashScroll.y=148;
dashScroll.layoutMode="VERTICAL"; dashScroll.primaryAxisSizingMode="FIXED";
dashScroll.counterAxisSizingMode="FIXED"; dashScroll.paddingTop=24; dashScroll.paddingBottom=8;
dashScroll.paddingLeft=24; dashScroll.paddingRight=24; dashScroll.itemSpacing=20;
dashScroll.fills=[{type:"SOLID",color:hex("#F8FAFC")}];

// Stat cards row
const statRow=hf("stats",{fixW:true,w:342,gap:10,av:"CENTER"}); statRow.fills=[];
const statData=[
  {v:"3",l:"Turnos hoy",    c:"#FF5A3C",bg:"#FFEDD5"},
  {v:"12",l:"Empleados",    c:"#059669",bg:"#D1FAE5"},
  {v:"2",l:"Solicitudes",   c:"#F59E0B",bg:"#FEF3C7"},
];
for(const s of statData){
  const card=vf(`stat-${s.l}`,{bg:"#FFFFFF",r:18,pt:16,pb:16,pl:16,pr:16,gap:4,sh:true,fixW:true,w:104});
  card.counterAxisSizingMode="FIXED"; card.primaryAxisSizingMode="AUTO";
  const valTxt=txt(s.v,28,"Extra Bold",s.c); card.appendChild(valTxt);
  card.appendChild(txt(s.l,11,"Regular","#64748B",{w:72})); statRow.appendChild(card);
}
dashScroll.appendChild(statRow);

// Turno activo card
const activoCard=vf("turno-activo",{bg:"#FF5A3C",r:20,pt:20,pb:20,pl:20,pr:20,gap:12,fixW:true,w:342,sh:true,sha:0.18,shr:20});
activoCard.counterAxisSizingMode="FIXED"; activoCard.primaryAxisSizingMode="AUTO";
const activoTop=hf("top",{fixW:true,w:302,ah:"SPACE_BETWEEN",av:"CENTER"}); activoTop.fills=[];
activoTop.appendChild(txt("Turno Activo",12,"Semi Bold","#FFFFFF",{opacity:0.85}));
const liveBadge=hf("live",{pt:4,pb:4,pl:10,pr:10,r:100,gap:6,av:"CENTER"});
liveBadge.fills=[{type:"SOLID",color:hex("#FFFFFF",0.2)}];
const liveDot=figma.createEllipse(); liveDot.resize(6,6);
liveDot.fills=[{type:"SOLID",color:hex("#FFFFFF")}]; liveBadge.appendChild(liveDot);
liveBadge.appendChild(txt("En curso",11,"Semi Bold","#FFFFFF"));
activoTop.appendChild(liveBadge);
activoCard.appendChild(activoTop);
activoCard.appendChild(txt("Turno Mañana",22,"Bold","#FFFFFF"));
const activoSub=hf("sub",{gap:16,av:"CENTER"}); activoSub.fills=[];
activoSub.appendChild(txt("8:00 – 14:00",14,"Medium","#FFFFFF",{opacity:0.9}));
activoSub.appendChild(txt("Recepción",14,"Regular","#FFFFFF",{opacity:0.75}));
activoCard.appendChild(activoSub);
const progressWrap=figma.createFrame(); progressWrap.resize(302,4); progressWrap.cornerRadius=2;
progressWrap.fills=[{type:"SOLID",color:hex("#FFFFFF",0.3)}];
const progressFill=figma.createFrame(); progressFill.resize(180,4); progressFill.cornerRadius=2;
progressFill.fills=[{type:"SOLID",color:hex("#FFFFFF")}]; progressFill.x=0; progressFill.y=0;
progressWrap.appendChild(progressFill);
activoCard.appendChild(progressWrap);
activoCard.appendChild(txt("3h restantes · 59% completado",12,"Regular","#FFFFFF",{opacity:0.8}));
dashScroll.appendChild(activoCard);

// Próximos turnos
const proxLabel=hf("prox-lbl",{fixW:true,w:342,ah:"SPACE_BETWEEN",av:"CENTER"}); proxLabel.fills=[];
proxLabel.appendChild(txt("Próximos turnos",16,"Semi Bold","#0F172A"));
proxLabel.appendChild(txt("Ver todos →",13,"Medium","#FF5A3C"));
dashScroll.appendChild(proxLabel);

const shiftsList=vf("shifts",{gap:10,fixW:true,w:342}); shiftsList.fills=[];
shiftsList.appendChild(shiftRow("Turno Tarde","14:00 – 22:00","Almacén","#059669","#FFFFFF"));
shiftsList.appendChild(shiftRow("Turno Mañana","8:00 – 14:00","Recepción","#FF5A3C","#FFFFFF"));
dashScroll.appendChild(shiftsList);

// Acciones rápidas
const aqLabel=hf("aq-lbl",{fixW:true,w:342,ah:"SPACE_BETWEEN",av:"CENTER"}); aqLabel.fills=[];
aqLabel.appendChild(txt("Acciones rápidas",16,"Semi Bold","#0F172A")); dashScroll.appendChild(aqLabel);

const aqRow=hf("aq-row",{fixW:true,w:342,gap:10}); aqRow.fills=[];
const actions=[
  {icon:"➕",label:"Nuevo turno",  bg:"#FFEDD5",c:"#C2410C"},
  {icon:"📋",label:"Ver nómina",   bg:"#D1FAE5",c:"#065F46"},
  {icon:"👤",label:"Añadir emp.",  bg:"#DBEAFE",c:"#1E40AF"},
  {icon:"📊",label:"Reportes",     bg:"#F1F5F9",c:"#334155"},
];
for(const a of actions){
  const btn=vf(`aq-${a.label}`,{bg:"#FFFFFF",r:16,pt:16,pb:14,pl:12,pr:12,gap:8,
    ah:"CENTER",av:"CENTER",sh:true,sha:0.05,fixW:true,w:79});
  btn.counterAxisSizingMode="FIXED"; btn.primaryAxisSizingMode="AUTO";
  const iconWrap=vf("iw",{bg:a.bg,r:12,ah:"CENTER",av:"CENTER",fixH:true,fixW:true});
  iconWrap.resize(36,36);
  iconWrap.appendChild(txt(a.icon,18,"Regular","#0F172A",{align:"CENTER"}));
  btn.appendChild(iconWrap);
  btn.appendChild(txt(a.label,10,"Medium",a.c,{align:"CENTER",w:60}));
  aqRow.appendChild(btn);
}
dashScroll.appendChild(aqRow);
dash.appendChild(dashScroll);

// Tab bar
const dashTab=tabBar("home"); dashTab.x=0; dashTab.y=778; dash.appendChild(dashTab);
const dashHB=homeBar(); dashHB.x=0; dashHB.y=810; dash.appendChild(dashHB);
page.appendChild(dash);

// ══════════════════════════════════════════════════════════════════════════
// 2.2 MIS TURNOS
// ══════════════════════════════════════════════════════════════════════════
const turnosScreen=makeScreen("2.2 Mis Turnos",1750);

// Header
const tHdr=figma.createFrame(); tHdr.resize(390,100); tHdr.x=0; tHdr.y=0;
tHdr.fills=[{type:"SOLID",color:hex("#FFFFFF")}];
tHdr.effects=[{type:"DROP_SHADOW",visible:true,blendMode:"NORMAL",
  color:{r:0,g:0,b:0,a:0.05},offset:{x:0,y:4},radius:12,spread:0}];
turnosScreen.appendChild(tHdr);
const tSB=statusBar(); tSB.x=0; tSB.y=0; tHdr.appendChild(tSB);
const tNavRow=hf("tNav",{fixW:true,w:390,pt:0,pl:24,pr:24,ah:"SPACE_BETWEEN",av:"CENTER"});
tNavRow.fills=[]; tNavRow.resize(390,40); tNavRow.x=0; tNavRow.y=48;
tNavRow.appendChild(txt("Mis Turnos",20,"Bold","#0F172A"));
const addBtn=vf("add",{bg:"#FF5A3C",r:12,ah:"CENTER",av:"CENTER",fixH:true,fixW:true});
addBtn.resize(36,36);
addBtn.appendChild(txt("+",20,"Bold","#FFFFFF",{align:"CENTER"}));
tNavRow.appendChild(addBtn);
tHdr.appendChild(tNavRow);

// Week calendar strip
const weekStrip=hf("week",{fixW:true,w:390,pt:16,pb:16,pl:20,pr:20,gap:8,
  ah:"CENTER",av:"CENTER",bg:"#FFFFFF"}); weekStrip.resize(390,84);
const days=["L","M","X","J","V","S","D"];
const dates=["19","20","21","22","23","24","25"];
for(let i=0;i<7;i++){
  const dayCol=vf(`day-${i}`,{gap:6,ah:"CENTER",av:"CENTER",
    bg:i===2?"#FF5A3C":"transparent",r:14,pt:8,pb:8,pl:8,pr:8,fixW:true,w:44});
  dayCol.counterAxisSizingMode="FIXED"; dayCol.primaryAxisSizingMode="AUTO";
  dayCol.appendChild(txt(days[i],11,"Medium",i===2?"#FFFFFF":"#94A3B8",{align:"CENTER"}));
  dayCol.appendChild(txt(dates[i],16,"Bold",i===2?"#FFFFFF":(i===4||i===5?"#E2E8F0":"#0F172A"),{align:"CENTER"}));
  if(i<5){ // dot indicators for shifts
    const dotRow=hf(`dots-${i}`,{gap:3,ah:"CENTER"}); dotRow.fills=[];
    const n=i===0?2:i===1?1:i===2?1:i===3?2:1;
    for(let d=0;d<n;d++){
      const dd=figma.createEllipse(); dd.resize(5,5);
      dd.fills=[{type:"SOLID",color:hex(i===2?"#FFFFFF":"#FF5A3C",0.7)}]; dotRow.appendChild(dd);
    }
    dayCol.appendChild(dotRow);
  }
  weekStrip.appendChild(dayCol);
}
turnosScreen.appendChild(weekStrip);

// Tab selector
const tabSel=hf("tab-sel",{fixW:true,w:390,pt:12,pb:0,pl:24,pr:24,gap:24,
  bd:"#E2E8F0",bw:1}); tabSel.resize(390,48);
tabSel.fills=[{type:"SOLID",color:hex("#FFFFFF")}];
tabSel.strokes=[{type:"SOLID",color:hex("#E2E8F0")}]; tabSel.strokeAlign="OUTSIDE";
for(const [i,label] of ["Lista","Semana","Mes"].entries()){
  const tab=vf(`tseg-${label}`,{gap:0,ah:"CENTER",av:"CENTER",pb:12,pt:0});
  tab.fills=[];
  tab.appendChild(txt(label,14,i===0?"Semi Bold":"Regular",i===0?"#FF5A3C":"#64748B",{align:"CENTER"}));
  if(i===0){
    const underline=figma.createFrame(); underline.resize(40,2); underline.cornerRadius=1;
    underline.fills=[{type:"SOLID",color:hex("#FF5A3C")}]; tab.appendChild(underline);
  }
  tabSel.appendChild(tab);
}
turnosScreen.appendChild(tabSel);

// Shifts list
const turnosList=vf("t-list",{pt:16,pb:8,pl:24,pr:24,gap:12,fixW:true,w:390,bg:"#F8FAFC"});
turnosList.counterAxisSizingMode="FIXED"; turnosList.primaryAxisSizingMode="AUTO";
turnosList.x=0; turnosList.y=232;

const weekShifts=[
  {turno:"Turno Mañana", fecha:"Lun 19 May",hora:"8:00–14:00",dept:"Recepción",color:"#FF5A3C",badge:"Activo",badgeBg:"#D1FAE5",badgeC:"#065F46"},
  {turno:"Turno Tarde",  fecha:"Mar 20 May",hora:"14:00–22:00",dept:"Almacén",  color:"#059669",badge:"Activo",badgeBg:"#D1FAE5",badgeC:"#065F46"},
  {turno:"Turno Mañana", fecha:"Mié 21 May",hora:"8:00–14:00",dept:"Recepción",color:"#FF5A3C",badge:"Mañana",badgeBg:"#FFEDD5",badgeC:"#C2410C"},
  {turno:"Día libre",    fecha:"Jue 22 May",hora:"—",           dept:"",        color:"#E2E8F0",badge:"Libre",  badgeBg:"#F1F5F9",badgeC:"#64748B"},
  {turno:"Turno Tarde",  fecha:"Vie 23 May",hora:"14:00–22:00",dept:"Caja",     color:"#059669",badge:"Próximo",badgeBg:"#DBEAFE",badgeC:"#1E40AF"},
];
for(const s of weekShifts){
  const card=hf(`sc-${s.fecha}`,{fixW:true,w:342,pt:16,pb:16,pl:16,pr:16,r:18,
    bg:"#FFFFFF",gap:12,av:"CENTER",sh:true,sha:0.05});
  const accent=figma.createFrame(); accent.resize(4,44); accent.cornerRadius=2;
  accent.fills=[{type:"SOLID",color:hex(s.color)}]; card.appendChild(accent);
  const info=vf("info",{gap:4}); info.fills=[];
  info.appendChild(txt(s.turno,15,"Semi Bold","#0F172A"));
  const meta=hf("meta",{gap:8,av:"CENTER"}); meta.fills=[];
  meta.appendChild(txt(s.fecha,12,"Regular","#64748B"));
  if(s.hora!=="—") meta.appendChild(txt(s.hora,12,"Regular","#94A3B8"));
  if(s.dept) meta.appendChild(txt("· "+s.dept,12,"Regular","#94A3B8"));
  info.appendChild(meta); card.appendChild(info);
  // badge pushed to right
  const spacer=figma.createFrame(); spacer.layoutGrow=1; spacer.fills=[];
  spacer.resize(1,1); card.appendChild(spacer);
  card.appendChild(badge(s.badge,s.badgeBg,s.badgeC));
  turnosList.appendChild(card);
}
turnosScreen.appendChild(turnosList);

const tTab=tabBar("shifts"); tTab.x=0; tTab.y=778; turnosScreen.appendChild(tTab);
const tHB=homeBar(); tHB.x=0; tHB.y=810; turnosScreen.appendChild(tHB);
page.appendChild(turnosScreen);

// ══════════════════════════════════════════════════════════════════════════
// 2.3 NÓMINA
// ══════════════════════════════════════════════════════════════════════════
const nominaScreen=makeScreen("2.3 Nómina",2180);

const nHdr=figma.createFrame(); nHdr.resize(390,180); nHdr.x=0; nHdr.y=0;
nHdr.fills=[{type:"GRADIENT_LINEAR",
  gradientStops:[{position:0,color:hex("#059669")},{position:1,color:hex("#34D399")}],
  gradientTransform:[[0,1,0],[-1,0,1]]}];
nominaScreen.appendChild(nHdr);
const nSB=statusBar(true); nSB.x=0; nSB.y=0; nHdr.appendChild(nSB);
const nNavRow=hf("nNav",{fixW:true,w:390,pl:24,pr:24,ah:"SPACE_BETWEEN",av:"CENTER"});
nNavRow.fills=[]; nNavRow.resize(390,40); nNavRow.x=0; nNavRow.y=52;
nNavRow.appendChild(txt("Nómina",20,"Bold","#FFFFFF"));
const nPeriod=hf("period",{pt:6,pb:6,pl:12,pr:12,r:100,gap:6,av:"CENTER"});
nPeriod.fills=[{type:"SOLID",color:hex("#FFFFFF",0.2)}];
nPeriod.appendChild(txt("Mayo 2026",13,"Semi Bold","#FFFFFF"));
nPeriod.appendChild(txt("▾",11,"Regular","#FFFFFF"));
nNavRow.appendChild(nPeriod);
nHdr.appendChild(nNavRow);

// Total card on header
const totalCard=vf("total",{bg:"#FFFFFF",r:20,pt:20,pb:20,pl:24,pr:24,gap:4,
  sh:true,sha:0.12,shr:20,fixW:true,w:342});
totalCard.counterAxisSizingMode="FIXED"; totalCard.primaryAxisSizingMode="AUTO";
totalCard.x=24; totalCard.y=116;
totalCard.appendChild(txt("Total nómina bruta",12,"Medium","#64748B"));
totalCard.appendChild(txt("€ 24.350",32,"Extra Bold","#0F172A"));
const totalRow=hf("trow",{gap:20,av:"CENTER"}); totalRow.fills=[];
for(const s of [{v:"12",l:"Empleados"},{v:"€2.029",l:"Media"},{v:"215h",l:"Horas"}]){
  const sc=vf(`ns-${s.l}`,{gap:2,ah:"CENTER"}); sc.fills=[];
  sc.appendChild(txt(s.v,15,"Bold","#059669"));
  sc.appendChild(txt(s.l,11,"Regular","#64748B")); totalRow.appendChild(sc);
}
totalCard.appendChild(totalRow);
nominaScreen.appendChild(totalCard);

// Employee nomina list
const nList=vf("n-list",{pt:182,pb:8,pl:24,pr:24,gap:10,fixW:true,w:390,bg:"#F8FAFC"});
nList.counterAxisSizingMode="FIXED"; nList.primaryAxisSizingMode="FIXED";
nList.resize(390,598); nList.x=0; nList.y=148;

const nListHeader=hf("n-lh",{fixW:true,w:342,ah:"SPACE_BETWEEN",av:"CENTER"});
nListHeader.fills=[];
nListHeader.appendChild(txt("Empleados",15,"Semi Bold","#0F172A"));
nListHeader.appendChild(txt("Exportar PDF →",13,"Medium","#059669"));
nList.appendChild(nListHeader);

const employees=[
  {name:"María García",  role:"Recepción",    total:"€2.100",hrs:"160h",status:"Procesada",sb:"#D1FAE5",sc:"#065F46",av:"MG",ac:"#FF5A3C"},
  {name:"Juan Rodríguez",role:"Almacén",      total:"€1.980",hrs:"152h",status:"Procesada",sb:"#D1FAE5",sc:"#065F46",av:"JR",ac:"#3B82F6"},
  {name:"Laura Pérez",   role:"Caja",         total:"€1.890",hrs:"144h",status:"Revisión",  sb:"#FEF3C7",sc:"#92400E",av:"LP",ac:"#8B5CF6"},
  {name:"Carlos Soto",   role:"Logística",    total:"€2.200",hrs:"168h",status:"Procesada",sb:"#D1FAE5",sc:"#065F46",av:"CS",ac:"#059669"},
  {name:"Ana Martínez",  role:"RRHH",         total:"€2.450",hrs:"160h",status:"Borrador",  sb:"#F1F5F9",sc:"#64748B",av:"AM",ac:"#F59E0B"},
];
for(const e of employees){
  const row=hf(`er-${e.name}`,{fixW:true,w:342,pt:14,pb:14,pl:16,pr:16,r:16,
    bg:"#FFFFFF",gap:12,av:"CENTER",sh:true,sha:0.04});
  row.appendChild(avatar(e.av,e.ac,36,12));
  const info=vf("info",{gap:3}); info.fills=[];
  info.appendChild(txt(e.name,14,"Semi Bold","#0F172A"));
  info.appendChild(txt(e.role+" · "+e.hrs,12,"Regular","#64748B")); row.appendChild(info);
  const spacer=figma.createFrame(); spacer.resize(1,1); spacer.fills=[]; row.appendChild(spacer);
  const right=vf("right",{gap:4,ah:"MIN",av:"MAX"}); right.fills=[];
  right.appendChild(txt(e.total,15,"Bold","#0F172A",{align:"RIGHT"}));
  right.appendChild(badge(e.status,e.sb,e.sc)); row.appendChild(right);
  nList.appendChild(row);
}
nominaScreen.appendChild(nList);

const nTab=tabBar("payroll"); nTab.x=0; nTab.y=778; nominaScreen.appendChild(nTab);
const nHB=homeBar(); nHB.x=0; nHB.y=810; nominaScreen.appendChild(nHB);
page.appendChild(nominaScreen);

// ══════════════════════════════════════════════════════════════════════════
// 2.4 EQUIPO
// ══════════════════════════════════════════════════════════════════════════
const equipoScreen=makeScreen("2.4 Equipo",2610);

const eHdr=figma.createFrame(); eHdr.resize(390,108); eHdr.x=0; eHdr.y=0;
eHdr.fills=[{type:"SOLID",color:hex("#FFFFFF")}];
eHdr.effects=[{type:"DROP_SHADOW",visible:true,blendMode:"NORMAL",
  color:{r:0,g:0,b:0,a:0.05},offset:{x:0,y:4},radius:12,spread:0}];
equipoScreen.appendChild(eHdr);
const eSB=statusBar(); eSB.x=0; eSB.y=0; eHdr.appendChild(eSB);
const eNavRow=hf("eNav",{fixW:true,w:390,pl:24,pr:24,ah:"SPACE_BETWEEN",av:"CENTER"});
eNavRow.fills=[]; eNavRow.resize(390,40); eNavRow.x=0; eNavRow.y=52;
eNavRow.appendChild(txt("Equipo",20,"Bold","#0F172A"));
const addEmpBtn=hf("addE",{pt:8,pb:8,pl:14,pr:14,r:12,bg:"#FF5A3C",gap:6,av:"CENTER"});
addEmpBtn.appendChild(txt("+",16,"Bold","#FFFFFF"));
addEmpBtn.appendChild(txt("Añadir",13,"Semi Bold","#FFFFFF"));
eNavRow.appendChild(addEmpBtn);
eHdr.appendChild(eNavRow);

// Search bar
const searchBar=hf("search",{fixW:true,w:342,pt:12,pb:12,pl:14,pr:14,r:14,
  bg:"#F1F5F9",gap:10,av:"CENTER"});
searchBar.x=24; searchBar.y=116;
searchBar.appendChild(txt("🔍",16,"Regular","#94A3B8"));
searchBar.appendChild(txt("Buscar empleado…",15,"Regular","#94A3B8"));
equipoScreen.appendChild(searchBar);

// Filter chips
const filterRow=hf("filters",{gap:8,fixW:true,w:342}); filterRow.x=24; filterRow.y=160;
filterRow.fills=[];
for(const [i,f] of ["Todos","Activos","Vacaciones","Bajas"].entries()){
  const chip=hf(`f-${f}`,{pt:7,pb:7,pl:14,pr:14,r:100,
    bg:i===0?"#0F172A":"#FFFFFF",bd:i===0?"#0F172A":"#E2E8F0",bw:1.5});
  chip.appendChild(txt(f,12,"Semi Bold",i===0?"#FFFFFF":"#64748B"));
  filterRow.appendChild(chip);
}
equipoScreen.appendChild(filterRow);

// Team list
const teamList=vf("team-list",{pt:192,pb:8,pl:24,pr:24,gap:10,fixW:true,w:390,bg:"#F8FAFC"});
teamList.counterAxisSizingMode="FIXED"; teamList.primaryAxisSizingMode="FIXED";
teamList.resize(390,570); teamList.x=0; teamList.y=108;

const teamMembers=[
  {name:"María García",  role:"Recepcionista",dept:"Recepción",  status:"Activo",  sb:"#D1FAE5",sc:"#065F46",av:"MG",ac:"#FF5A3C",shifts:"3 turnos esta sem."},
  {name:"Juan Rodríguez",role:"Operario",      dept:"Almacén",   status:"Activo",  sb:"#D1FAE5",sc:"#065F46",av:"JR",ac:"#3B82F6",shifts:"5 turnos esta sem."},
  {name:"Laura Pérez",   role:"Cajera",        dept:"Caja",      status:"Vacaciones",sb:"#DBEAFE",sc:"#1E40AF",av:"LP",ac:"#8B5CF6",shifts:"Regresa 28 May"},
  {name:"Carlos Soto",   role:"Conductor",     dept:"Logística", status:"Activo",  sb:"#D1FAE5",sc:"#065F46",av:"CS",ac:"#059669",shifts:"2 turnos esta sem."},
  {name:"Ana Martínez",  role:"Responsable RRHH",dept:"RRHH",   status:"Activo",  sb:"#D1FAE5",sc:"#065F46",av:"AM",ac:"#F59E0B",shifts:"Admin"},
  {name:"Pedro Gómez",   role:"Auxiliar",      dept:"Recepción", status:"Baja",   sb:"#FEE2E2",sc:"#991B1B",av:"PG",ac:"#EF4444",shifts:"Baja médica"},
];
for(const m of teamMembers){
  const row=hf(`mr-${m.name}`,{fixW:true,w:342,pt:14,pb:14,pl:16,pr:16,r:18,
    bg:"#FFFFFF",gap:12,av:"CENTER",sh:true,sha:0.04});
  row.appendChild(avatar(m.av,m.ac,44,14));
  const info=vf("info",{gap:3}); info.fills=[];
  info.appendChild(txt(m.name,15,"Semi Bold","#0F172A"));
  info.appendChild(txt(m.role+" · "+m.dept,12,"Regular","#64748B"));
  info.appendChild(txt(m.shifts,11,"Regular","#94A3B8")); row.appendChild(info);
  const spacer=figma.createFrame(); spacer.resize(1,1); spacer.fills=[]; row.appendChild(spacer);
  const right=vf("right",{gap:6,ah:"MIN",av:"MAX"}); right.fills=[];
  right.appendChild(badge(m.status,m.sb,m.sc));
  right.appendChild(txt("›",18,"Regular","#CBD5E1")); row.appendChild(right);
  teamList.appendChild(row);
}
equipoScreen.appendChild(teamList);

const eTab=tabBar("team"); eTab.x=0; eTab.y=778; equipoScreen.appendChild(eTab);
const eHB=homeBar(); eHB.x=0; eHB.y=810; equipoScreen.appendChild(eHB);
page.appendChild(equipoScreen);

figma.viewport.scrollAndZoomIntoView([dash,turnosScreen,nominaScreen,equipoScreen]);
figma.notify("✅ Core screens listas — Dashboard · Turnos · Nómina · Equipo");
