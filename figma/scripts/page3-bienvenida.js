/**
 * AppTurnos — Página 3: Onboarding / Bienvenida
 * Pantallas:
 *   1.5a Bienvenida · Slide 1  — CTA principal + Ya tengo cuenta
 *   1.5b Bienvenida · Slide 2  — Gestión de Turnos
 *   1.5c Bienvenida · Slide 3  — Nómina Automática
 *   1.6  Configuración inicial  — Paso 1/3 (nombre negocio + sector)
 *
 * fileKey: x165H2a9jejueix7aPKeuF
 */

async function lf(fam,sty){try{await figma.loadFontAsync({family:fam,style:sty});}catch(e){}}
await Promise.all([lf("Inter","Regular"),lf("Inter","Medium"),lf("Inter","Semi Bold"),lf("Inter","Bold"),lf("Inter","Extra Bold")]);

function hex(h,a=1){return{r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255,a};}

const page = figma.root.children.find(p=>p.name.includes("Bienvenida"));
await figma.setCurrentPageAsync(page);
for(const n of [...page.children]) n.remove();

function txt(chars,size,style,color,opts={}){
  const t=figma.createText();
  t.fontName={family:"Inter",style};
  t.fontSize=size; t.characters=chars;
  t.fills=[{type:"SOLID",color:hex(color)}];
  if(opts.align) t.textAlignHorizontal=opts.align;
  if(opts.lh)    t.lineHeight={unit:"PIXELS",value:opts.lh};
  if(opts.w){t.textAutoResize="HEIGHT";t.resize(opts.w,20);}
  if(opts.opacity!==undefined) t.opacity=opts.opacity;
  return t;
}

function vf(name,o={}){
  const f=figma.createFrame(); f.name=name;
  f.layoutMode="VERTICAL";
  f.primaryAxisSizingMode=o.fixH?"FIXED":"AUTO";
  f.counterAxisSizingMode=o.fixW?"FIXED":"AUTO";
  if(o.w) f.resize(o.w,o.h||100);
  f.itemSpacing=o.gap??0; f.paddingTop=o.pt??0; f.paddingBottom=o.pb??0;
  f.paddingLeft=o.pl??0; f.paddingRight=o.pr??0; f.cornerRadius=o.r??0;
  f.fills=o.bg?[{type:"SOLID",color:hex(o.bg),opacity:o.op??1}]:[];
  if(o.bd){f.strokes=[{type:"SOLID",color:hex(o.bd)}];f.strokeWeight=o.bw??1.5;}
  if(o.ah) f.primaryAxisAlignItems=o.ah;
  if(o.av) f.counterAxisAlignItems=o.av;
  if(o.clip) f.clipsContent=true;
  if(o.sh) f.effects=[{type:"DROP_SHADOW",visible:true,blendMode:"NORMAL",color:{r:0,g:0,b:0,a:0.08},offset:{x:0,y:4},radius:16,spread:0}];
  return f;
}

function hf(name,o={}){
  const f=figma.createFrame(); f.name=name;
  f.layoutMode="HORIZONTAL";
  f.primaryAxisSizingMode=o.fixW?"FIXED":"AUTO";
  f.counterAxisSizingMode=o.fixH?"FIXED":"AUTO";
  if(o.w) f.resize(o.w,o.h||40);
  f.itemSpacing=o.gap??0; f.paddingTop=o.pt??0; f.paddingBottom=o.pb??0;
  f.paddingLeft=o.pl??0; f.paddingRight=o.pr??0; f.cornerRadius=o.r??0;
  f.fills=o.bg?[{type:"SOLID",color:hex(o.bg)}]:[];
  if(o.bd){f.strokes=[{type:"SOLID",color:hex(o.bd)}];f.strokeWeight=o.bw??1.5;}
  if(o.ah) f.primaryAxisAlignItems=o.ah;
  if(o.av) f.counterAxisAlignItems=o.av;
  return f;
}

function btn(label,o={}){
  const b=hf(label,{fixW:true,w:o.w??310,pt:15,pb:15,pl:20,pr:20,r:14,
    bg:o.ghost?null:(o.sec?"#FFEDD5":"#FF5A3C"),ah:"CENTER",av:"CENTER"});
  if(o.ghost){b.strokes=[{type:"SOLID",color:hex("#FF5A3C")}];b.strokeWeight=1.5;}
  b.appendChild(txt(label,16,"Semi Bold",o.ghost?"#FF5A3C":(o.sec?"#C2410C":"#FFFFFF"),{align:"CENTER"}));
  return b;
}

function homeBar(){
  const w=hf("HomeBar",{fixW:true,fixH:true,ah:"CENTER",av:"CENTER"});
  w.resize(390,34); w.fills=[];
  const b=figma.createFrame(); b.resize(134,5); b.cornerRadius=3;
  b.fills=[{type:"SOLID",color:hex("#0F172A",0.18)}]; w.appendChild(b);
  return w;
}

function statusBar(light=false){
  const bar=hf("StatusBar",{fixW:true,fixH:true,pt:14,pl:24,pr:24,ah:"SPACE_BETWEEN",av:"CENTER"});
  bar.resize(390,44); bar.fills=[];
  bar.appendChild(txt("9:41",15,"Semi Bold",light?"#FFFFFF":"#0F172A"));
  const icons=hf("icons",{gap:5,av:"CENTER"}); icons.fills=[];
  icons.appendChild(txt("▪▪▪",9,"Regular",light?"#FFFFFF":"#0F172A"));
  icons.appendChild(txt("WiFi",9,"Regular",light?"#FFFFFF":"#0F172A"));
  icons.appendChild(txt("100%",9,"Regular",light?"#FFFFFF":"#0F172A"));
  bar.appendChild(icons);
  return bar;
}

function makeScreen(name,x){
  const s=figma.createFrame(); s.name=name;
  s.resize(390,844); s.x=x; s.y=0;
  s.layoutMode="NONE"; s.clipsContent=true; s.cornerRadius=44;
  s.fills=[{type:"SOLID",color:hex("#FFFFFF")}];
  s.effects=[{type:"DROP_SHADOW",visible:true,blendMode:"NORMAL",
    color:{r:0,g:0,b:0,a:0.14},offset:{x:0,y:10},radius:48,spread:0}];
  return s;
}

function dots(active,total=3){
  const row=hf("dots",{gap:6,av:"CENTER"}); row.fills=[];
  for(let i=0;i<total;i++){
    const d=figma.createEllipse();
    d.resize(i===active?24:8, 8);
    d.fills=[{type:"SOLID",color:hex(i===active?"#FF5A3C":"#E2E8F0")}];
    row.appendChild(d);
  }
  return row;
}

function featureCard(emoji,title,desc,tint="#FFEDD5"){
  const card=vf(title,{bg:"#FFFFFF",r:20,pt:20,pb:20,pl:20,pr:20,gap:12,sh:true,fixW:true,w:310});
  card.counterAxisSizingMode="FIXED"; card.primaryAxisSizingMode="AUTO";
  const iconWrap=vf("icon",{bg:tint,r:14,ah:"CENTER",av:"CENTER",fixH:true,fixW:true});
  iconWrap.resize(48,48);
  iconWrap.appendChild(txt(emoji,22,"Regular","#0F172A",{align:"CENTER"}));
  card.appendChild(iconWrap);
  card.appendChild(txt(title,16,"Semi Bold","#0F172A"));
  card.appendChild(txt(desc,13,"Regular","#64748B",{lh:20,w:270}));
  return card;
}

// ══════════════════════════════════════════════════════════════════════════
// SLIDE 1 — Bienvenida
// ══════════════════════════════════════════════════════════════════════════
const s1=makeScreen("1.5a Bienvenida · Slide 1",0);

const bg1=figma.createFrame(); bg1.resize(390,500); bg1.x=0; bg1.y=0;
bg1.fills=[{type:"GRADIENT_LINEAR",
  gradientStops:[{position:0,color:hex("#FF5A3C",1)},{position:0.6,color:hex("#FF8C42",1)},{position:1,color:hex("#FFEDD5",1)}],
  gradientTransform:[[0,1,0],[-1,0,1]]
}];
s1.appendChild(bg1);

const sb1=statusBar(true); sb1.x=0; sb1.y=0; bg1.appendChild(sb1);

const skip1=hf("skip",{pt:8,pb:8,pl:14,pr:14,r:100}); skip1.fills=[];
skip1.appendChild(txt("Omitir",13,"Medium","#FFFFFF",{opacity:0.8}));
skip1.x=322; skip1.y=52; bg1.appendChild(skip1);

// Illustration: abstract calendar
const illus1=figma.createFrame(); illus1.resize(200,200);
illus1.x=95; illus1.y=90; illus1.cornerRadius=100;
illus1.fills=[{type:"SOLID",color:hex("#FFFFFF",0.18)}];
s1.appendChild(illus1);

const cal=vf("cal",{bg:"#FFFFFF",r:20,pt:14,pb:14,pl:14,pr:14,gap:8,fixW:true,w:140});
cal.counterAxisSizingMode="FIXED"; cal.primaryAxisSizingMode="AUTO";
const calH=hf("calH",{fixW:true,w:112,ah:"SPACE_BETWEEN",av:"CENTER"}); calH.fills=[];
calH.appendChild(txt("Mayo 2026",11,"Semi Bold","#0F172A"));
calH.appendChild(txt("◀ ▶",9,"Regular","#94A3B8"));
cal.appendChild(calH);
for(let row=0;row<3;row++){
  const gr=hf(`row${row}`,{fixW:true,w:112,gap:4,ah:"SPACE_BETWEEN"}); gr.fills=[];
  for(let col=0;col<7;col++){
    const day=vf(`d${row*7+col}`,{r:5,ah:"CENTER",av:"CENTER",
      bg:row===1&&col===2?"#FF5A3C":"transparent",fixH:true,fixW:true});
    day.resize(14,14);
    const n=row*7+col+1;
    if(n<=21){
      const dt=txt(String(n),8,"Regular",row===1&&col===2?"#FFFFFF":"#0F172A",{align:"CENTER"});
      day.appendChild(dt);
    }
    gr.appendChild(day);
  }
  cal.appendChild(gr);
}
cal.x=125; cal.y=115;
s1.appendChild(cal);

const card1=figma.createFrame(); card1.resize(390,420); card1.x=0; card1.y=420;
card1.cornerRadius=36; card1.layoutMode="VERTICAL";
card1.primaryAxisSizingMode="FIXED"; card1.counterAxisSizingMode="FIXED";
card1.paddingTop=40; card1.paddingBottom=0; card1.paddingLeft=40; card1.paddingRight=40;
card1.itemSpacing=18; card1.fills=[{type:"SOLID",color:hex("#FFFFFF")}];

card1.appendChild(dots(0,3));
card1.appendChild(txt("Bienvenido a\nAppTurnos 👋",32,"Extra Bold","#0F172A",{lh:42,w:310}));
card1.appendChild(txt("La plataforma todo-en-uno para gestionar\nturnos, nómina y equipo desde tu móvil.",15,"Regular","#64748B",{lh:24,w:310}));

const sp1=figma.createFrame(); sp1.resize(310,4); sp1.fills=[]; card1.appendChild(sp1);
card1.appendChild(btn("Comenzar →"));
card1.appendChild(btn("Ya tengo cuenta",{sec:true}));
card1.appendChild(homeBar());
s1.appendChild(card1);
page.appendChild(s1);

// ══════════════════════════════════════════════════════════════════════════
// SLIDE 2 — Gestión de Turnos
// ══════════════════════════════════════════════════════════════════════════
const s2=makeScreen("1.5b Bienvenida · Slide 2",430);

const bg2=figma.createFrame(); bg2.resize(390,460); bg2.x=0; bg2.y=0;
bg2.fills=[{type:"SOLID",color:hex("#F8FAFC")}]; s2.appendChild(bg2);

const sb2=statusBar(false); sb2.x=0; sb2.y=0; bg2.appendChild(sb2);
const skip2=hf("skip",{pt:8,pb:8,pl:14,pr:14,r:100}); skip2.fills=[];
skip2.appendChild(txt("Omitir",13,"Medium","#94A3B8")); skip2.x=322; skip2.y=52; bg2.appendChild(skip2);

const fc2=featureCard("📅","Gestión de Turnos","Crea y asigna turnos en segundos. Tu equipo ve su horario en tiempo real.");
fc2.x=40; fc2.y=100; s2.appendChild(fc2);

const shiftRow=hf("shifts",{gap:10}); shiftRow.fills=[];
for(const sh of [
  {l:"Mañana",t:"8–14h",c:"#FF5A3C",bg:"#FFEDD5"},
  {l:"Tarde", t:"14–22h",c:"#059669",bg:"#D1FAE5"},
  {l:"Noche", t:"22–6h", c:"#3B82F6",bg:"#DBEAFE"},
]){
  const sc=vf(sh.l,{bg:sh.bg,r:14,pt:12,pb:12,pl:12,pr:12,gap:4,fixW:true,w:92});
  sc.counterAxisSizingMode="FIXED"; sc.primaryAxisSizingMode="AUTO";
  const dot=figma.createEllipse(); dot.resize(8,8);
  dot.fills=[{type:"SOLID",color:hex(sh.c)}]; sc.appendChild(dot);
  sc.appendChild(txt(sh.l,12,"Semi Bold","#0F172A"));
  sc.appendChild(txt(sh.t,11,"Regular","#64748B"));
  shiftRow.appendChild(sc);
}
shiftRow.x=40; shiftRow.y=340; s2.appendChild(shiftRow);

const card2=figma.createFrame(); card2.resize(390,384); card2.x=0; card2.y=460;
card2.cornerRadius=36; card2.layoutMode="VERTICAL";
card2.primaryAxisSizingMode="FIXED"; card2.counterAxisSizingMode="FIXED";
card2.paddingTop=36; card2.paddingBottom=0; card2.paddingLeft=40; card2.paddingRight=40;
card2.itemSpacing=16; card2.fills=[{type:"SOLID",color:hex("#FFFFFF")}];

card2.appendChild(dots(1,3));
card2.appendChild(txt("Turnos sin\ncomplicaciones 📅",28,"Extra Bold","#0F172A",{lh:36,w:310}));
card2.appendChild(txt("Planifica semanas enteras en minutos.\nTu equipo siempre sabe cuándo trabaja.",14,"Regular","#64748B",{lh:22,w:310}));

const sp2=figma.createFrame(); sp2.resize(310,4); sp2.fills=[]; card2.appendChild(sp2);

const nav2=hf("nav",{fixW:true,w:310,gap:10}); nav2.fills=[];
nav2.appendChild(btn("← Atrás",{ghost:true,w:148}));
nav2.appendChild(btn("Siguiente →",{w:148}));
card2.appendChild(nav2);
card2.appendChild(homeBar());
s2.appendChild(card2);
page.appendChild(s2);

// ══════════════════════════════════════════════════════════════════════════
// SLIDE 3 — Nómina Automática
// ══════════════════════════════════════════════════════════════════════════
const s3=makeScreen("1.5c Bienvenida · Slide 3",860);

const bg3=figma.createFrame(); bg3.resize(390,460); bg3.x=0; bg3.y=0;
bg3.fills=[{type:"SOLID",color:hex("#F0FDF4")}]; s3.appendChild(bg3);

const sb3=statusBar(false); sb3.x=0; sb3.y=0; bg3.appendChild(sb3);
const skip3=hf("skip",{pt:8,pb:8,pl:14,pr:14,r:100}); skip3.fills=[];
skip3.appendChild(txt("Omitir",13,"Medium","#94A3B8")); skip3.x=322; skip3.y=52; bg3.appendChild(skip3);

const fc3=featureCard("💰","Nómina Automática","Calcula salarios, horas extra y deducciones. Exporta en PDF con un toque.","#D1FAE5");
fc3.x=40; fc3.y=100; s3.appendChild(fc3);

const statsRow=hf("stats",{gap:10}); statsRow.fills=[];
for(const s of [
  {v:"12",l:"Empleados",c:"#059669",bg:"#D1FAE5"},
  {v:"€8.4k",l:"Nómina mes",c:"#059669",bg:"#D1FAE5"},
  {v:"0",l:"Errores",c:"#10B981",bg:"#D1FAE5"},
]){
  const sc=vf(s.l,{bg:s.bg,r:14,pt:14,pb:14,pl:12,pr:12,gap:2,fixW:true,w:92});
  sc.counterAxisSizingMode="FIXED"; sc.primaryAxisSizingMode="AUTO";
  sc.appendChild(txt(s.v,20,"Bold",s.c));
  sc.appendChild(txt(s.l,11,"Regular","#065F46"));
  statsRow.appendChild(sc);
}
statsRow.x=40; statsRow.y=340; s3.appendChild(statsRow);

const card3=figma.createFrame(); card3.resize(390,384); card3.x=0; card3.y=460;
card3.cornerRadius=36; card3.layoutMode="VERTICAL";
card3.primaryAxisSizingMode="FIXED"; card3.counterAxisSizingMode="FIXED";
card3.paddingTop=36; card3.paddingBottom=0; card3.paddingLeft=40; card3.paddingRight=40;
card3.itemSpacing=16; card3.fills=[{type:"SOLID",color:hex("#FFFFFF")}];

card3.appendChild(dots(2,3));
card3.appendChild(txt("Nómina en\nautomático 💰",28,"Extra Bold","#0F172A",{lh:36,w:310}));
card3.appendChild(txt("Genera nóminas precisas al instante.\nCero errores, cero estrés al final del mes.",14,"Regular","#64748B",{lh:22,w:310}));

const sp3=figma.createFrame(); sp3.resize(310,4); sp3.fills=[]; card3.appendChild(sp3);

const nav3=hf("nav",{fixW:true,w:310,gap:10}); nav3.fills=[];
nav3.appendChild(btn("← Atrás",{ghost:true,w:148}));
nav3.appendChild(btn("¡Empezar ya! →",{w:148}));
card3.appendChild(nav3);
card3.appendChild(homeBar());
s3.appendChild(card3);
page.appendChild(s3);

// ══════════════════════════════════════════════════════════════════════════
// PANTALLA 4 — Configuración inicial (Paso 1/3)
// ══════════════════════════════════════════════════════════════════════════
const s4=makeScreen("1.6 Configuración inicial",1290);
s4.fills=[{type:"SOLID",color:hex("#F8FAFC")}];

const header4=figma.createFrame(); header4.resize(390,120); header4.x=0; header4.y=0;
header4.layoutMode="VERTICAL"; header4.primaryAxisSizingMode="FIXED"; header4.counterAxisSizingMode="FIXED";
header4.paddingTop=0; header4.paddingBottom=20; header4.paddingLeft=40; header4.paddingRight=40;
header4.itemSpacing=12; header4.fills=[{type:"SOLID",color:hex("#FFFFFF")}];
header4.effects=[{type:"DROP_SHADOW",visible:true,blendMode:"NORMAL",color:{r:0,g:0,b:0,a:0.04},offset:{x:0,y:4},radius:12,spread:0}];

const sb4=statusBar(); sb4.x=0; sb4.y=0; header4.appendChild(sb4);

// Progress bar
const progWrap=hf("prog",{fixW:true,w:310,gap:0}); progWrap.fills=[];
const progBg=figma.createFrame(); progBg.resize(310,4); progBg.cornerRadius=2;
progBg.fills=[{type:"SOLID",color:hex("#E2E8F0")}];
const progFill=figma.createFrame(); progFill.resize(104,4); progFill.cornerRadius=2;
progFill.fills=[{type:"SOLID",color:hex("#FF5A3C")}];
progFill.x=0; progFill.y=0;
progBg.appendChild(progFill);
progWrap.appendChild(progBg);
header4.appendChild(progWrap);
header4.appendChild(txt("Paso 1 de 3 · Cuéntanos sobre tu negocio",12,"Medium","#64748B"));
s4.appendChild(header4);

function inputF(label,ph,o={}){
  const wrap=vf(label,{gap:6,fixW:true,w:310});
  wrap.appendChild(txt(label,13,"Medium","#334155"));
  const field=hf("field",{fixW:true,w:310,pt:14,pb:14,pl:14,pr:14,r:14,
    bg:"#FFFFFF",bd:o.focus?"#FF5A3C":"#E2E8F0",bw:1.5});
  field.appendChild(txt(ph,15,"Regular",o.val?"#0F172A":"#94A3B8"));
  wrap.appendChild(field);
  return wrap;
}

const form4=figma.createFrame(); form4.resize(390,1); form4.x=0; form4.y=128;
form4.layoutMode="VERTICAL"; form4.primaryAxisSizingMode="AUTO"; form4.counterAxisSizingMode="FIXED";
form4.paddingTop=28; form4.paddingBottom=48; form4.paddingLeft=40; form4.paddingRight=40;
form4.itemSpacing=20; form4.fills=[{type:"SOLID",color:hex("#F8FAFC")}];

form4.appendChild(txt("¿Cómo se llama\ntu negocio?",26,"Bold","#0F172A",{lh:36,w:310}));
form4.appendChild(inputF("Nombre del negocio","Ej: Clínica San José",{focus:true}));

// Sector selector label
form4.appendChild(txt("Sector / Industria",13,"Medium","#334155"));

const sectorGrid=hf("sectors",{gap:8,fixW:true,w:310}); sectorGrid.fills=[];
for(const s of ["Salud","Hostelería","Comercio","Educación"]){
  const chip=hf(s,{pt:9,pb:9,pl:14,pr:14,r:100,
    bg:s==="Salud"?"#FFEDD5":"#FFFFFF",
    bd:s==="Salud"?"#FF5A3C":"#E2E8F0",bw:s==="Salud"?2:1.5});
  chip.appendChild(txt(s,13,"Medium",s==="Salud"?"#C2410C":"#64748B"));
  sectorGrid.appendChild(chip);
}
form4.appendChild(sectorGrid);

form4.appendChild(inputF("Número de empleados","Selecciona…"));

const sp4=figma.createFrame(); sp4.resize(310,4); sp4.fills=[]; form4.appendChild(sp4);
form4.appendChild(btn("Continuar →"));
form4.appendChild(txt("Puedes cambiar esto más tarde en Ajustes",12,"Regular","#94A3B8",{align:"CENTER",w:310}));

s4.appendChild(form4);
const hb4=homeBar(); hb4.x=0; hb4.y=810; s4.appendChild(hb4);
page.appendChild(s4);

figma.viewport.scrollAndZoomIntoView([s1,s2,s3,s4]);
figma.notify("✅ Onboarding: 3 slides Bienvenida + Configuración inicial listos");
