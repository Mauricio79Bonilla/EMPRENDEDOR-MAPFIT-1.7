import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, query, where, limit, getDocs, arrayUnion, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC0JKLRPv9O6-ks7bvEqjJkkz86FGk9lko",
  authDomain: "mi-paina-web.firebaseapp.com",
  projectId: "mi-paina-web",
  storageBucket: "mi-paina-web.firebasestorage.app",
  messagingSenderId: "450612910890",
  appId: "1:450612910890:web:8a373a3e4b40872e825c53"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ---------------- Insignias ---------------- */
export const INSIGNIAS = {
  bienvenida: { emoji: "🚀", titulo: "Primer paso", desc: "Entraste a MAPFIT por primera vez." },
  registro: { emoji: "📝", titulo: "Primer registro", desc: "Ingresaste tu correo y tus datos." },
  ficha: { emoji: "🩺", titulo: "Primera ficha", desc: "Guardaste tu ficha de salud." },
  mensaje: { emoji: "💬", titulo: "Primer llamado", desc: "Nos enviaste tu primer mensaje." },
  constante: { emoji: "🔥", titulo: "Constante", desc: "Volviste a MAPFIT en otro día." }
};
const ORDEN = Object.keys(INSIGNIAS);

/* ---------------- Sesión anónima (una sola por navegador) ---------------- */
let promesaSesion = null;
export function sesion() {
  if (!promesaSesion) {
    promesaSesion = new Promise((resolve, reject) => {
      const stop = onAuthStateChanged(auth, async (u) => {
        stop();
        if (u) return resolve(u);
        try {
          const cred = await signInAnonymously(auth);
          resolve(cred.user);
        } catch (e) {
          promesaSesion = null;
          reject(e);
        }
      });
    });
  }
  return promesaSesion;
}

function hoyLocal() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/* ---------------- Base de datos ---------------- */
async function leerPerfil(uid) {
  const snap = await getDoc(doc(db, "perfiles", uid));
  return snap.exists() ? snap.data() : null;
}

export async function otorgar(id, extra) {
  extra = extra || {};
  if (!INSIGNIAS[id]) return false;
  try {
    const u = await sesion();
    const ref = doc(db, "perfiles", u.uid);
    const actual = await leerPerfil(u.uid);
    const ya = !!(actual && Array.isArray(actual.insignias) && actual.insignias.includes(id));
    if (ya && Object.keys(extra).length === 0) return false;

    const datos = Object.assign({}, extra, { actualizado: serverTimestamp() });
    if (!actual) datos.creado = serverTimestamp();
    if (!ya) datos.insignias = arrayUnion(id);
    await setDoc(ref, datos, { merge: true });

    if (!ya) mostrarToast(INSIGNIAS[id]);
    return !ya;
  } catch (e) {
    console.error("Insignias:", e);
    return false;
  }
}

export async function iniciarPerfil() {
  try {
    const u = await sesion();
    const actual = await leerPerfil(u.uid);
    const dias = actual && Array.isArray(actual.dias) ? actual.dias : [];
    const hoy = hoyLocal();
    const nuevoDia = !dias.includes(hoy);

    await otorgar("bienvenida", nuevoDia ? { dias: arrayUnion(hoy) } : {});
    const total = dias.length + (nuevoDia ? 1 : 0);
    if (total >= 2) await otorgar("constante");
  } catch (e) {
    console.error("Perfil:", e);
  }
}

async function cargarTodo() {
  const u = await sesion();
  const resultados = await Promise.all([
    leerPerfil(u.uid),
    getDocs(query(collection(db, "fichas"), where("uid", "==", u.uid), limit(20)))
  ]);
  let ficha = null;
  let mejor = -1;
  resultados[1].forEach((d) => {
    const x = d.data();
    const t = x.fecha && x.fecha.seconds ? x.fecha.seconds : 0;
    if (t > mejor) { mejor = t; ficha = x; }
  });
  return { perfil: resultados[0] || {}, ficha: ficha };
}

/* ---------------- Interfaz ---------------- */
const CSS = `
html.pf-open,html.pf-open body{overflow:hidden}
.pf-overlay{position:fixed;inset:0;z-index:15000;display:flex;justify-content:flex-end;background:rgba(1,7,32,.72);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:pfFade .25s ease both}
.pf-overlay[hidden]{display:none}
.pf-panel{position:relative;width:min(520px,100%);height:100%;display:flex;flex-direction:column;color:#fff;text-align:left;background:radial-gradient(420px circle at 100% 0%,rgba(52,211,153,.14),transparent 62%),linear-gradient(165deg,#0A2152 0%,#041637 55%,#010720 100%);border-left:2px solid rgba(219,226,234,.45);box-shadow:-20px 0 60px rgba(0,0,0,.55);animation:pfSlide .3s cubic-bezier(.2,.8,.2,1) both}
.pf-head{display:flex;align-items:center;gap:14px;padding:max(18px,env(safe-area-inset-top)) 18px 16px;border-bottom:1.5px solid rgba(219,226,234,.25);background:linear-gradient(180deg,rgba(26,77,148,.55),rgba(4,22,55,.2))}
.pf-avatar{flex:none;width:58px;height:58px;border-radius:50%;display:grid;place-items:center;font-size:1.6rem;font-weight:900;color:#fff;background:linear-gradient(135deg,#F97316,#F25C19);box-shadow:0 0 0 3px rgba(226,232,240,.7),0 0 0 8px rgba(52,211,153,.16)}
.pf-quien{flex:1;min-width:0}
.pf-quien h2{margin:0;font-size:1.3rem;line-height:1.2;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pf-quien p{margin:2px 0 0;font-size:.92rem;color:rgba(255,255,255,.75);text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pf-x{flex:none;width:44px;height:44px;border-radius:50%;border:1.5px solid rgba(219,226,234,.55);background:rgba(255,255,255,.08);color:#fff;font:inherit;font-size:1.1rem;font-weight:800;cursor:pointer;-webkit-tap-highlight-color:transparent}
.pf-x:hover,.pf-x:focus-visible{border-color:#34D399;box-shadow:0 0 16px rgba(52,211,153,.5);outline:none}
.pf-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:18px 18px max(24px,env(safe-area-inset-bottom))}
.pf-sec{margin:0 0 22px}
.pf-sec h3{margin:0 0 10px;font-size:1.05rem;letter-spacing:.02em;text-align:left;color:#A9D3C5}
.pf-barra{height:10px;border-radius:10px;background:rgba(255,255,255,.12);overflow:hidden}
.pf-barra span{display:block;height:100%;border-radius:10px;background:linear-gradient(90deg,#F97316,#f4f7fb,#34D399);transition:width .6s ease}
.pf-nota{margin:8px 0 0;font-size:.92rem;color:rgba(255,255,255,.8);text-align:left}
.pf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.pf-ins{padding:14px 12px;border-radius:18px;text-align:center;border:1.5px solid rgba(219,226,234,.3);background:rgba(255,255,255,.06)}
.pf-ins .e{font-size:2rem;line-height:1;display:block;margin-bottom:6px}
.pf-ins b{display:block;font-size:.98rem;line-height:1.25}
.pf-ins small{display:block;margin-top:4px;font-size:.8rem;line-height:1.35;color:rgba(255,255,255,.75)}
.pf-ins.on{border-color:#34D399;background:linear-gradient(160deg,rgba(52,211,153,.18),rgba(255,255,255,.05));box-shadow:0 0 22px rgba(52,211,153,.25)}
.pf-ins.off{opacity:.55}
.pf-ins.off .e{filter:grayscale(1)}
.pf-ins .ok{margin-top:6px;font-size:.78rem;font-weight:800;color:#34D399}
.pf-dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:8px 14px}
.pf-dl dt{font-weight:800;font-size:.9rem;color:#ffd2b0;text-align:left}
.pf-dl dd{margin:0;font-size:.98rem;text-align:left;overflow-wrap:anywhere}
.pf-btn{display:inline-block;margin-top:12px;padding:12px 22px;border-radius:999px;border:2px solid transparent;font:inherit;font-weight:800;color:#fff;text-decoration:none;cursor:pointer;background:linear-gradient(135deg,#F97316,#F25C19) padding-box,linear-gradient(135deg,#fff,#9aa7b5 50%,#fff) border-box}
.pf-btn:hover,.pf-btn:focus-visible{filter:brightness(1.1);box-shadow:0 0 28px rgba(249,115,22,.6);outline:none}
.pf-vacio{padding:16px;border-radius:16px;background:rgba(255,255,255,.06);border:1.5px dashed rgba(219,226,234,.35);font-size:.95rem;text-align:left}
.pf-error{padding:14px;border-radius:14px;background:rgba(192,57,43,.25);border:1.5px solid #FF8A80;font-size:.95rem;text-align:left}
.pf-toast{position:fixed;left:50%;bottom:max(24px,env(safe-area-inset-bottom));z-index:30000;display:flex;align-items:center;gap:12px;max-width:min(92vw,420px);padding:14px 20px;border-radius:18px;color:#fff;font:700 .98rem/1.3 sans-serif;text-align:left;background:linear-gradient(135deg,#0F766E,#0A2152);border:2px solid #34D399;box-shadow:0 14px 40px rgba(0,0,0,.5),0 0 30px rgba(52,211,153,.4);transform:translate(-50%,30px);opacity:0;pointer-events:none;transition:transform .35s cubic-bezier(.2,.9,.3,1.3),opacity .3s}
.pf-toast.show{transform:translate(-50%,0);opacity:1}
.pf-toast .e{font-size:1.8rem;line-height:1}
@keyframes pfFade{from{opacity:0}to{opacity:1}}
@keyframes pfSlide{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}
@media (max-width:560px){.pf-panel{border-left:0}.pf-grid{gap:8px}}
@media (prefers-reduced-motion:reduce){.pf-overlay,.pf-panel{animation:none}.pf-toast{transition:none}}
`;

function el(tag, cls, texto) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (texto != null) n.textContent = texto;
  return n;
}

let overlay = null;
let cuerpo = null;
let avatar = null;
let titulo = null;
let correoEl = null;
let abridor = null;
let toastEl = null;
let toastTimer = null;

function construir() {
  if (overlay) return;
  const st = document.createElement("style");
  st.textContent = CSS;
  document.head.appendChild(st);

  overlay = el("div", "pf-overlay");
  overlay.hidden = true;
  const panel = el("aside", "pf-panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "pfTitulo");

  const head = el("header", "pf-head");
  avatar = el("div", "pf-avatar", "?");
  const quien = el("div", "pf-quien");
  titulo = el("h2", null, "Mi perfil");
  titulo.id = "pfTitulo";
  correoEl = el("p", null, "");
  quien.appendChild(titulo);
  quien.appendChild(correoEl);
  const cerrar = el("button", "pf-x", "✕");
  cerrar.type = "button";
  cerrar.setAttribute("aria-label", "Cerrar perfil");
  cerrar.addEventListener("click", cerrarPerfil);
  head.appendChild(avatar);
  head.appendChild(quien);
  head.appendChild(cerrar);

  cuerpo = el("div", "pf-body");
  panel.appendChild(head);
  panel.appendChild(cuerpo);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrarPerfil(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) cerrarPerfil(); });

  toastEl = el("div", "pf-toast");
  toastEl.setAttribute("role", "status");
  toastEl.setAttribute("aria-live", "polite");
  document.body.appendChild(toastEl);
}

function mostrarToast(ins) {
  construir();
  toastEl.textContent = "";
  toastEl.appendChild(el("span", "e", ins.emoji));
  const t = el("span", null, "");
  t.appendChild(document.createTextNode("¡Nueva insignia!"));
  t.appendChild(document.createElement("br"));
  t.appendChild(el("span", null, ins.titulo));
  toastEl.appendChild(t);
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 4500);
}

function fila(dl, k, v) {
  if (v == null || v === "") return;
  dl.appendChild(el("dt", null, k));
  dl.appendChild(el("dd", null, String(v)));
}

function pintar(perfil, ficha) {
  cuerpo.textContent = "";
  const nombre = [perfil.nombre, perfil.apellido].filter(Boolean).join(" ");
  titulo.textContent = nombre || "Mi perfil";
  correoEl.textContent = perfil.correo || "Aún sin registrar";
  avatar.textContent = (nombre || perfil.correo || "?").trim().charAt(0).toUpperCase() || "?";

  const mias = Array.isArray(perfil.insignias) ? perfil.insignias : [];
  const cuantas = ORDEN.filter((k) => mias.includes(k)).length;

  const s1 = el("section", "pf-sec");
  s1.appendChild(el("h3", null, "Tu progreso"));
  const barra = el("div", "pf-barra");
  const relleno = document.createElement("span");
  relleno.style.width = Math.round((cuantas / ORDEN.length) * 100) + "%";
  barra.appendChild(relleno);
  s1.appendChild(barra);
  s1.appendChild(el("p", "pf-nota", cuantas + " de " + ORDEN.length + " insignias conseguidas"));
  cuerpo.appendChild(s1);

  const s2 = el("section", "pf-sec");
  s2.appendChild(el("h3", null, "Insignias"));
  const grid = el("div", "pf-grid");
  ORDEN.forEach((k) => {
    const d = INSIGNIAS[k];
    const on = mias.includes(k);
    const c = el("div", "pf-ins " + (on ? "on" : "off"));
    c.appendChild(el("span", "e", d.emoji));
    c.appendChild(el("b", null, d.titulo));
    c.appendChild(el("small", null, d.desc));
    c.appendChild(el("div", "ok", on ? "✓ Conseguida" : "Bloqueada"));
    grid.appendChild(c);
  });
  s2.appendChild(grid);
  cuerpo.appendChild(s2);

  const s3 = el("section", "pf-sec");
  s3.appendChild(el("h3", null, "Mis datos"));
  if (perfil.correo || nombre) {
    const dl = el("dl", "pf-dl");
    fila(dl, "Nombre", nombre);
    fila(dl, "Correo", perfil.correo);
    if (perfil.creado && perfil.creado.toDate) {
      fila(dl, "Miembro desde", perfil.creado.toDate().toLocaleDateString("es-SV", { year: "numeric", month: "long", day: "numeric" }));
    }
    s3.appendChild(dl);
  } else {
    s3.appendChild(el("div", "pf-vacio", "Todavía no te has registrado. Regístrate para guardar tu nombre y tu correo en tu perfil."));
    const b = el("button", "pf-btn", "Registrarme");
    b.type = "button";
    b.addEventListener("click", () => {
      try { sessionStorage.removeItem("mapfitRegistrado"); } catch (e) {}
      location.href = "mapfit.html";
    });
    s3.appendChild(b);
  }
  cuerpo.appendChild(s3);

  const s4 = el("section", "pf-sec");
  s4.appendChild(el("h3", null, "Mi ficha de salud"));
  if (ficha) {
    const dl = el("dl", "pf-dl");
    const alturaM = Number(ficha.altura) / 100;
    const imc = ficha.peso && alturaM ? (Number(ficha.peso) / (alturaM * alturaM)).toFixed(1) : "";
    fila(dl, "Nombre", ficha.nombre);
    fila(dl, "Edad", ficha.edad ? ficha.edad + " años" : "");
    fila(dl, "Peso", ficha.peso ? ficha.peso + " kg" : "");
    fila(dl, "Estatura", ficha.altura ? ficha.altura + " cm" : "");
    fila(dl, "IMC estimado", imc);
    fila(dl, "Condición", ficha.condicion);
    fila(dl, "Actividad", ficha.actividad);
    fila(dl, "Objetivo", ficha.objetivo);
    fila(dl, "Plan", ficha.plan ? ficha.plan + (ficha.ciclo ? " (" + ficha.ciclo + ")" : "") : "");
    fila(dl, "Notas", ficha.notas);
    s4.appendChild(dl);
    const a = el("a", "pf-btn", "Actualizar mi ficha");
    a.href = "ficha.html";
    s4.appendChild(a);
  } else {
    s4.appendChild(el("div", "pf-vacio", "Aún no has guardado una ficha de salud."));
    const a = el("a", "pf-btn", "Llenar mi ficha");
    a.href = "ficha.html";
    s4.appendChild(a);
  }
  cuerpo.appendChild(s4);
}

export async function abrirPerfil() {
  construir();
  abridor = document.activeElement;
  overlay.hidden = false;
  document.documentElement.classList.add("pf-open");
  cuerpo.textContent = "";
  cuerpo.appendChild(el("p", "pf-nota", "Cargando tu perfil..."));
  overlay.querySelector(".pf-x").focus();
  try {
    const r = await cargarTodo();
    pintar(r.perfil, r.ficha);
  } catch (e) {
    console.error("Perfil:", e);
    cuerpo.textContent = "";
    cuerpo.appendChild(el("div", "pf-error", "No se pudo cargar tu perfil. Revisa tu conexión e inténtalo de nuevo."));
  }
}

export function cerrarPerfil() {
  if (!overlay) return;
  overlay.hidden = true;
  document.documentElement.classList.remove("pf-open");
  if (abridor && abridor.focus) abridor.focus();
}

document.addEventListener("click", (e) => {
  const a = e.target.closest && e.target.closest("[data-abrir-perfil]");
  if (!a) return;
  e.preventDefault();
  abrirPerfil();
});
if (location.hash === "#perfil") abrirPerfil();
