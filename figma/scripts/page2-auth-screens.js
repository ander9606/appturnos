/**
 * AppTurnos — Página 2: Auth Screens
 * Pantallas: 1.2 Login · 1.3 Activar cuenta · 1.4 Registro libre
 *
 * Decisiones de diseño:
 *  - Google OAuth es la CTA principal (botón prominente arriba del fold)
 *  - Email/password queda como alternativa secundaria debajo de un divider "o con correo"
 *  - La misma jerarquía aplica en Login Y en Registro libre
 *  - Activar cuenta usa código de 6 cajas (flujo de invitación)
 *
 * Para ejecutar: pegar en Figma → Plugin → Run Code
 * fileKey: x165H2a9jejueix7aPKeuF
 */

async function lf(fam, sty) { try { await figma.loadFontAsync({family:fam,style:sty}); } catch(e){} }
await Promise.all([lf("Inter","Regular"),lf("Inter","Medium"),lf("Inter","Semi Bold"),lf("Inter","Bold"),lf("Inter","Extra Bold")]);

function hex(h,a=1){return{r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255,a};}

const page = figma.root.children.find(p=>p.name.includes("Auth"));
await figma.setCurrentPageAsync(page);
for(const n of [...page.children]) n.remove();

// ── helpers ────────────────────────────────────────────────────────────────
function txt(chars,size,style,color,opts={}){
  const t=figma.createText();
  t.fontName={family:"Inter",style};
  t.fontSize=size; t.characters=chars;
  t.fills=[{type:"SOLID",color:hex(color)}];
  if(opts.align) t.textAlignHorizontal=opts.align;
  if(opts.lh)    t.lineHeight={unit:"PIXELS",value:opts.lh};
  if(opts.ls)    t.letterSpacing={unit:"PERCENT",value:opts.ls};
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
  if(o.sh) f.effects=[{type:"DROP_SHADOW",visible:true,blendMode:"NORMAL",color:{r:0,g:0,b:0,a:0.10},offset:{x:0,y:6},radius:24,spread:0}];
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

function input(label,ph,o={}){
  const wrap=vf(label,{gap:6,fixW:true,w:o.w??310});
  wrap.appendChild(txt(label,13,"Medium",o.dis?"#94A3B8":"#334155"));
  const field=hf("field",{fixW:true,w:o.w??310,pt:13,pb:13,pl:14,pr:14,r:12,
    bg:o.dis?"#F8FAFC":(o.err?"#FEF2F2":"#FFFFFF"),
    bd:o.err?"#EF4444":(o.focus?"#FF5A3C":"#E2E8F0"),bw:1.5});
  field.appendChild(txt(ph,15,"Regular",o.dis?"#CBD5E1":(o.val?"#0F172A":"#94A3B8")));
  wrap.appendChild(field);
  if(o.err&&o.em) wrap.appendChild(txt(o.em,12,"Regular","#EF4444"));
  if(o.hint)      wrap.appendChild(txt(o.hint,12,"Regular","#64748B"));
  return wrap;
}

function primaryBtn(label,o={}){
  const b=hf(label,{fixW:true,w:o.w??310,pt:15,pb:15,pl:20,pr:20,r:14,
    bg:o.sec?"#FFEDD5":"#FF5A3C",ah:"CENTER",av:"CENTER"});
  b.appendChild(txt(label,16,"Semi Bold",o.sec?"#C2410C":"#FFFFFF",{align:"CENTER"}));
  return b;
}

function googleBtn(w=310){
  const b=hf("Continuar con Google",{fixW:true,w,pt:14,pb:14,pl:16,pr:16,r:14,
    bg:"#FFFFFF",bd:"#E2E8F0",bw:1.5,gap:10,ah:"CENTER",av:"CENTER"});
  b.effects=[{type:"DROP_SHADOW",visible:true,blendMode:"NORMAL",
    color:{r:0,g:0,b:0,a:0.07},offset:{x:0,y:2},radius:8,spread:0}];
  const g=figma.createFrame(); g.resize(20,20); g.cornerRadius=10;
  g.fills=[{type:"SOLID",color:hex("#EA4335")}];
  b.appendChild(g);
  b.appendChild(txt("Continuar con Google",15,"Semi Bold","#334155"));
  return b;
}

function divRow(label,w=310){
  const row=hf("div-row",{gap:10,av:"CENTER",fixW:true,w}); row.fills=[];
  const l=figma.createFrame(); l.resize((w-60)/2,1); l.fills=[{type:"SOLID",color:hex("#E2E8F0")}]; row.appendChild(l);
  row.appendChild(txt(label,12,"Regular","#94A3B8",{align:"CENTER"}));
  const r=figma.createFrame(); r.resize((w-60)/2,1); r.fills=[{type:"SOLID",color:hex("#E2E8F0")}]; row.appendChild(r);
  return row;
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

function homeBar(){
  const w=hf("HomeBar",{fixW:true,fixH:true,ah:"CENTER",av:"CENTER"});
  w.resize(390,34); w.fills=[];
  const b=figma.createFrame(); b.resize(134,5); b.cornerRadius=3;
  b.fills=[{type:"SOLID",color:hex("#0F172A",0.18)}]; w.appendChild(b);
  return w;
}

function makeScreen(name,x){
  const s=figma.createFrame(); s.name=name;
  s.resize(390,844); s.x=x; s.y=0;
  s.layoutMode="NONE"; s.clipsContent=true; s.cornerRadius=44;
  s.fills=[{type:"SOLID",color:hex("#F8FAFC")}];
  s.effects=[{type:"DROP_SHADOW",visible:true,blendMode:"NORMAL",
    color:{r:0,g:0,b:0,a:0.14},offset:{x:0,y:10},radius:48,spread:0}];
  return s;
}

// ══════════════════════════════════════════════════════════════════════════
//  S1 — LOGIN  (Google primero)
// ══════════════════════════════════════════════════════════════════════════
const s1=makeScreen("1.2 Login",0);

const gh=figma.createFrame(); gh.resize(390,200); gh.x=0; gh.y=0;
gh.fills=[{type:"GRADIENT_LINEAR",
  gradientStops:[{position:0,color:hex("#FF5A3C",1)},{position:1,color:hex("#FF8C42",1)}],
  gradientTransform:[[0,1,0],[-1,0,1]]
}];
s1.appendChild(gh);

const sb1=statusBar(true); sb1.x=0; sb1.y=0; gh.appendChild(sb1);

const lg1=hf("logo",{gap:10,av:"CENTER"}); lg1.fills=[];
const ic1=vf("icon",{r:12,ah:"CENTER",av:"CENTER"}); ic1.resize(44,44);
ic1.fills=[{type:"SOLID",color:hex("#FFFFFF",0.22)}];
const dot1=figma.createEllipse(); dot1.resize(16,16);
dot1.fills=[{type:"SOLID",color:hex("#FFFFFF")}]; ic1.appendChild(dot1);
lg1.appendChild(ic1); lg1.appendChild(txt("AppTurnos",24,"Bold","#FFFFFF"));
lg1.x=40; lg1.y=58; gh.appendChild(lg1);
const tg1=txt("Turnos · Nómina · Equipo",13,"Regular","#FFFFFF",{opacity:0.8});
tg1.x=40; tg1.y=108; gh.appendChild(tg1);

const c1=vf("card",{bg:"#FFFFFF",r:28,pt:32,pb:36,pl:40,pr:40,gap:18,sh:true,fixW:true,w:390});
c1.counterAxisSizingMode="FIXED"; c1.primaryAxisSizingMode="AUTO"; c1.x=0; c1.y=180;
c1.appendChild(txt("Bienvenido de vuelta",22,"Bold","#0F172A"));

// ★ Google — CTA principal
c1.appendChild(googleBtn(310));
c1.appendChild(divRow("o con correo electrónico"));

c1.appendChild(input("Correo electrónico","tu@empresa.com",{focus:true}));
c1.appendChild(input("Contraseña","••••••••",{val:true}));

const fr=hf("forgot",{fixW:true,w:310,ah:"MAX"}); fr.fills=[];
fr.appendChild(txt("¿Olvidaste tu contraseña?",13,"Medium","#FF5A3C"));
c1.appendChild(fr);

c1.appendChild(primaryBtn("Iniciar sesión"));

const rl1=hf("reg",{fixW:true,w:310,gap:4,ah:"CENTER",av:"CENTER"}); rl1.fills=[];
rl1.appendChild(txt("¿No tienes cuenta?",13,"Regular","#64748B"));
rl1.appendChild(txt("Regístrate",13,"Semi Bold","#FF5A3C"));
c1.appendChild(rl1);

s1.appendChild(c1);
const hb1=homeBar(); hb1.x=0; hb1.y=810; s1.appendChild(hb1);
page.appendChild(s1);

// ══════════════════════════════════════════════════════════════════════════
//  S2 — ACTIVAR CUENTA  (código de invitación)
// ══════════════════════════════════════════════════════════════════════════
const s2=makeScreen("1.3 Activar cuenta",430);
s2.layoutMode="NONE";

const top2=figma.createFrame(); top2.resize(390,140); top2.x=0; top2.y=0;
top2.fills=[{type:"SOLID",color:hex("#FFEDD5")}]; s2.appendChild(top2);
const sb2=statusBar(false); sb2.x=0; sb2.y=0; top2.appendChild(sb2);
const nav2=hf("nav",{gap:8,av:"CENTER"}); nav2.fills=[];
nav2.appendChild(txt("← Volver",14,"Medium","#C2410C"));
nav2.x=24; nav2.y=58; top2.appendChild(nav2);

const ic2=vf("icon-circle",{r:999,ah:"CENTER",av:"CENTER",bg:"#FF5A3C"});
ic2.resize(72,72); ic2.x=159; ic2.y=76;
const d2=figma.createEllipse(); d2.resize(28,28);
d2.fills=[{type:"SOLID",color:hex("#FFFFFF")}]; ic2.appendChild(d2);
s2.appendChild(ic2);

const c2=vf("card2",{bg:"#FFFFFF",r:28,pt:32,pb:36,pl:40,pr:40,gap:18,fixW:true,w:390});
c2.counterAxisSizingMode="FIXED"; c2.primaryAxisSizingMode="AUTO"; c2.x=0; c2.y=136;
c2.appendChild(txt("Activar tu cuenta",24,"Bold","#0F172A"));
c2.appendChild(txt("Ingresa el código de invitación que\nrecibiste por correo electrónico.",14,"Regular","#64748B",{lh:22,w:310}));

// 6-box code
const cr=hf("code-boxes",{gap:8,fixW:true,w:310,ah:"CENTER"}); cr.fills=[];
for(let i=0;i<6;i++){
  const b=vf(`b${i}`,{bg:i<3?"#FFFFFF":"#F8FAFC",bd:i===3?"#FF5A3C":"#E2E8F0",bw:2,r:12,ah:"CENTER",av:"CENTER",fixH:true,fixW:true});
  b.resize(44,56);
  const ch=txt(i<3?"▪":"",20,"Bold",i<3?"#0F172A":"#FF5A3C"); ch.textAlignHorizontal="CENTER";
  b.appendChild(ch); cr.appendChild(b);
}
c2.appendChild(cr);

c2.appendChild(input("Tu nombre completo","María García"));
c2.appendChild(input("Nueva contraseña","••••••••",{val:true}));
c2.appendChild(input("Confirmar contraseña","••••••••",{val:true}));
c2.appendChild(primaryBtn("Activar cuenta"));

const ll2=hf("ll2",{fixW:true,w:310,gap:4,ah:"CENTER",av:"CENTER"}); ll2.fills=[];
ll2.appendChild(txt("¿Ya tienes cuenta?",13,"Regular","#64748B"));
ll2.appendChild(txt("Inicia sesión",13,"Semi Bold","#FF5A3C"));
c2.appendChild(ll2);
s2.appendChild(c2);
const hb2=homeBar(); hb2.x=0; hb2.y=810; s2.appendChild(hb2);
page.appendChild(s2);

// ══════════════════════════════════════════════════════════════════════════
//  S3 — REGISTRO LIBRE  (Google primero)
// ══════════════════════════════════════════════════════════════════════════
const s3=makeScreen("1.4 Registro libre",860);
s3.layoutMode="NONE";

const top3=figma.createFrame(); top3.resize(390,104); top3.x=0; top3.y=0;
top3.fills=[{type:"SOLID",color:hex("#F8FAFC")}]; s3.appendChild(top3);
const sb3=statusBar(); sb3.x=0; sb3.y=0; top3.appendChild(sb3);
const nav3=hf("nav",{gap:8,av:"CENTER"}); nav3.fills=[];
nav3.appendChild(txt("← Volver al login",14,"Medium","#FF5A3C"));
nav3.x=24; nav3.y=58; top3.appendChild(nav3);

const sc3=vf("scroll",{bg:"#F8FAFC",pt:8,pb:48,pl:40,pr:40,gap:14,fixW:true,w:390});
sc3.counterAxisSizingMode="FIXED"; sc3.primaryAxisSizingMode="AUTO"; sc3.x=0; sc3.y=104;

const tb3=vf("title",{gap:4}); tb3.fills=[];
tb3.appendChild(txt("Crear cuenta",26,"Bold","#0F172A"));
tb3.appendChild(txt("Empieza gratis · Sin tarjeta de crédito",13,"Regular","#64748B"));
sc3.appendChild(tb3);

// ★ Google — CTA principal
sc3.appendChild(googleBtn(310));
sc3.appendChild(divRow("o regístrate con correo"));

// Plan selector
const pr3=hf("plans",{fixW:true,w:310,gap:10}); pr3.fills=[];
for(const p of [{n:"Free",s:"Hasta 5 empleados",sel:true},{n:"Pro",s:"Ilimitado · 12€/mes",sel:false}]){
  const pl=vf(p.n,{bg:p.sel?"#FFEDD5":"#FFFFFF",bd:p.sel?"#FF5A3C":"#E2E8F0",bw:p.sel?2:1.5,r:14,pt:12,pb:12,pl:12,pr:12,gap:3,fixW:true,w:150});
  pl.counterAxisSizingMode="FIXED"; pl.primaryAxisSizingMode="AUTO";
  pl.appendChild(txt(p.n,15,"Bold",p.sel?"#C2410C":"#0F172A"));
  pl.appendChild(txt(p.s,11,"Regular",p.sel?"#C2410C":"#64748B"));
  pr3.appendChild(pl);
}
sc3.appendChild(pr3);

const nr=hf("name-row",{fixW:true,w:310,gap:10}); nr.fills=[];
nr.appendChild(input("Nombre","María",{w:150}));
nr.appendChild(input("Apellido","García",{w:150}));
sc3.appendChild(nr);

sc3.appendChild(input("Correo electrónico","maria@empresa.com"));
sc3.appendChild(input("Empresa / Negocio","Clínica San José",{val:true,focus:true}));
sc3.appendChild(input("Contraseña","••••••••",{val:true}));

const tr3=hf("terms",{fixW:true,w:310,gap:10,av:"CENTER"}); tr3.fills=[];
const chk=figma.createFrame(); chk.resize(18,18); chk.cornerRadius=5;
chk.fills=[{type:"SOLID",color:hex("#FF5A3C")}]; tr3.appendChild(chk);
tr3.appendChild(txt("Acepto los Términos de uso y Política de privacidad",12,"Regular","#334155",{w:278}));
sc3.appendChild(tr3);

sc3.appendChild(primaryBtn("Crear mi cuenta gratis"));

const ll3=hf("ll3",{fixW:true,w:310,gap:4,ah:"CENTER",av:"CENTER"}); ll3.fills=[];
ll3.appendChild(txt("¿Ya tienes cuenta?",13,"Regular","#64748B"));
ll3.appendChild(txt("Inicia sesión",13,"Semi Bold","#FF5A3C"));
sc3.appendChild(ll3);
s3.appendChild(sc3);

const hb3=homeBar(); hb3.x=0; hb3.y=810; s3.appendChild(hb3);
page.appendChild(s3);

figma.viewport.scrollAndZoomIntoView([s1,s2,s3]);
figma.notify("✅ Auth screens con Google como CTA principal — 3 pantallas listas");
