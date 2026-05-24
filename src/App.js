import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, addDoc, onSnapshot,
  doc, setDoc, getDoc, query, orderBy
} from "firebase/firestore";
import {
  getAuth, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "firebase/auth";

// ─── Firebase ─────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FB_API_KEY,
  authDomain:        process.env.REACT_APP_FB_AUTH_DOMAIN,
  projectId:         process.env.REACT_APP_FB_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FB_STORAGE_BUCKET,
  messagingSenderId: String(process.env.REACT_APP_FB_MESSAGING_ID),
  appId:             process.env.REACT_APP_FB_APP_ID,
};
let fbApp, db, auth;
try {
  fbApp = initializeApp(firebaseConfig);
  db    = getFirestore(fbApp);
  auth  = getAuth(fbApp);
} catch(e) { console.error("Firebase init failed:", e.message); }

// ─── Gemini AI ────────────────────────────────────────────────────────────────
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.REACT_APP_AI_KEY}`;
async function ai(messages, system, json = false) {
  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.8, maxOutputTokens: 1024 },
      }),
    });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!json) return text;
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch(e) {
    console.error("AI error:", e);
    return json ? null : "Aiya, my brain lagged 😅";
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CATS = [
  { label:"🍔 Food", value:"Food" }, { label:"🚗 Transport", value:"Transport" },
  { label:"🛍️ Shopping", value:"Shopping" }, { label:"🎮 Entertainment", value:"Entertainment" },
  { label:"🏠 Bills", value:"Bills" }, { label:"💊 Health", value:"Health" },
  { label:"📦 Other", value:"Other" },
];
const CAT_ICON  = { Food:"🍔", Transport:"🚗", Shopping:"🛍️", Entertainment:"🎮", Bills:"🏠", Health:"💊", Other:"📦" };
const CAT_COLOR = { Food:"#f87171", Transport:"#60a5fa", Shopping:"#f472b6", Entertainment:"#a78bfa", Bills:"#fb923c", Health:"#34d399", Other:"#94a3b8" };

const PET_STATES = {
  healthy:  { label:"Thriving",  face:"( ᵔ ᴥ ᵔ )", accent:"#16a34a", al:"#4ade80", dim:"rgba(74,222,128,0.12)",  glow:"0 0 48px rgba(74,222,128,0.2)",  bar:"#4ade80" },
  neutral:  { label:"Okay",      face:"( - ᴥ - )", accent:"#d97706", al:"#fbbf24", dim:"rgba(251,191,36,0.12)",  glow:"0 0 48px rgba(251,191,36,0.18)", bar:"#fbbf24" },
  stressed: { label:"Stressed",  face:"( ó ᴥ ò )", accent:"#ea580c", al:"#fb923c", dim:"rgba(251,146,60,0.12)",  glow:"0 0 48px rgba(251,146,60,0.18)", bar:"#fb923c" },
  critical: { label:"Critical!", face:"( x ᴥ x )", accent:"#dc2626", al:"#f87171", dim:"rgba(248,113,113,0.12)", glow:"0 0 48px rgba(248,113,113,0.25)",bar:"#f87171" },
};
const EVOLUTIONS = [
  { level:1, name:"Mochi",        emoji:"🐱", title:"Baby Saver",     xp:0    },
  { level:2, name:"Mochi+",       emoji:"🐱", title:"Wallet Watcher", xp:100  },
  { level:3, name:"Mochi Pro",    emoji:"🐈", title:"Budget Buddy",   xp:300  },
  { level:4, name:"Mochi Elite",  emoji:"🐈‍⬛",title:"Money Master",   xp:600  },
  { level:5, name:"Mochi Legend", emoji:"🦁", title:"Finance Legend", xp:1000 },
];
const ACHIEVEMENTS = [
  { id:"first_log",    icon:"💸", title:"First Spend",      desc:"Log your first expense",        check:s=>s.expenses>=1 },
  { id:"first_save",   icon:"🐷", title:"First Save",       desc:"Log your first saving",          check:s=>s.savings>=1 },
  { id:"streak_3",     icon:"🔥", title:"3-Day Streak",     desc:"3 days in a row",               check:s=>s.streak>=3 },
  { id:"streak_7",     icon:"⚡", title:"Week Warrior",     desc:"7 days in a row",               check:s=>s.streak>=7 },
  { id:"saver_100",    icon:"💰", title:"Century Saver",    desc:"Save at least RM100",           check:s=>s.savings>=100 },
  { id:"saver_500",    icon:"🤑", title:"High Roller",      desc:"Save at least RM500",           check:s=>s.savings>=500 },
  { id:"scam_shield",  icon:"🛡️", title:"Scam Spotter",     desc:"Detect your first scam",        check:s=>s.scams>=1 },
  { id:"quiz_ace",     icon:"🎓", title:"Quiz Ace",         desc:"Score 100% on scam quiz",       check:s=>s.quizPerfect>=1 },
  { id:"level_3",      icon:"🐈", title:"Evolved!",         desc:"Reach level 3",                 check:s=>s.level>=3 },
  { id:"level_5",      icon:"🦁", title:"Legendary!",       desc:"Reach max level",               check:s=>s.level>=5 },
  { id:"goal_done",    icon:"🎯", title:"Goal Getter",      desc:"Complete a saving goal",        check:s=>s.goalsCompleted>=1 },
  { id:"no_spend",     icon:"🧊", title:"No-Spend Day",     desc:"Zero spending day check-in",    check:s=>s.noSpendDays>=1 },
  { id:"coach_user",   icon:"🤖", title:"AI Student",       desc:"Ask the coach a question",      check:s=>s.coachAsked>=1 },
  { id:"challenge_5",  icon:"🎮", title:"Quest Master",     desc:"Complete 5 daily challenges",   check:s=>s.challenges>=5 },
  { id:"budget_set",   icon:"📊", title:"Budget Boss",      desc:"Set spending budgets",          check:s=>s.budgetSet>=1 },
];
const CHALLENGE_POOL = [
  { text:"Spend below RM20 today", xp:30, icon:"💸" },
  { text:"No food delivery today", xp:30, icon:"🍔" },
  { text:"Save at least RM10 today", xp:35, icon:"🐷" },
  { text:"Log all your expenses today", xp:20, icon:"📋" },
  { text:"No online shopping today", xp:25, icon:"🛍️" },
  { text:"Spend RM0 on entertainment", xp:25, icon:"🎮" },
  { text:"Review your spending history", xp:15, icon:"📊" },
  { text:"Check in before noon", xp:40, icon:"⏰" },
];
const QUIZ_QUESTIONS = [
  { id:1, msg:"Tahniah! Anda terpilih menerima hadiah RM5,000 dari Maybank. Klik link ini untuk menuntut: http://maybank-reward.xyz/claim", label:"SCAM", reason:"Fake bank reward with suspicious URL — real banks never send prize links via WhatsApp." },
  { id:2, msg:"Your CIMB account has been temporarily locked. Please verify your details at: https://www.cimb.com.my/secure-login", label:"SAFE", reason:"This is a real CIMB domain. Legitimate banks do send account lock notices — always verify the URL carefully." },
  { id:3, msg:"Hi, I'm offering a part-time job that pays RM300/day just liking posts on Shopee. No experience needed. WhatsApp me: 019-XXXXXXX", label:"SCAM", reason:"Classic job scam — no legitimate job pays RM300/day for liking posts." },
  { id:4, msg:"LHDN: Your tax refund of RM1,200 is ready. Visit mytax.hasil.gov.my to claim it. Ref: TX-2025-XXXX", label:"SAFE", reason:"This references the real LHDN domain. Tax refund notices from LHDN are legitimate — always go to the official site." },
  { id:5, msg:"URGENT: Your TNG eWallet has been compromised! Send your PIN to 60123456789 to secure your account immediately!", label:"SCAM", reason:"No legitimate company ever asks for your PIN. Urgency is a classic scam tactic." },
];
const NAV = [
  { id:"home",      icon:"💸", label:"Spend"   },
  { id:"save",      icon:"🐷", label:"Save"    },
  { id:"goals",     icon:"🎯", label:"Goals"   },
  { id:"analyze",   icon:"📊", label:"Analyze" },
  { id:"coach",     icon:"🤖", label:"Coach"   },
  { id:"shield",    icon:"🛡️", label:"Shield"  },
  { id:"quests",    icon:"🎮", label:"Quests"  },
  { id:"history",   icon:"📋", label:"History" },
  { id:"profile",   icon:"⭐", label:"Profile" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const petState  = s => s>=70?"healthy":s>=45?"neutral":s>=20?"stressed":"critical";
const calcScore = (exp, sav, risk) => Math.round(Math.min(100, Math.max(0, Math.max(0, 50 - exp/10) + Math.min(30, sav*0.6) + (20 - risk*0.2))));
const getLevel  = xp => { for(let i=EVOLUTIONS.length-1;i>=0;i--) if(xp>=EVOLUTIONS[i].xp) return EVOLUTIONS[i]; return EVOLUTIONS[0]; };
const nextLevel = xp => { const c=getLevel(xp); return EVOLUTIONS.find(e=>e.level===c.level+1)||null; };
const xpPct     = xp => { const c=getLevel(xp), n=nextLevel(xp); if(!n)return 100; return Math.round(((xp-c.xp)/(n.xp-c.xp))*100); };
const todayKey  = () => new Date().toISOString().slice(0,10);
const rm        = n => `RM${(n||0).toFixed(2)}`;

function useBreakpoint() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => { const h = () => setW(window.innerWidth); window.addEventListener("resize",h); return()=>window.removeEventListener("resize",h); }, []);
  return { isMobile: w<768, isTablet: w>=768&&w<1024, isDesktop: w>=1024 };
}
const getTheme = dark => dark
  ? { bg:"#0d0c13", sb:"#13111c", card:"#1a1726", cardHov:"#1f1c2e", inp:"#100e19", border:"rgba(255,255,255,0.07)", text:"#ede9f8", sub:"#9994b0", muted:"#5c5870" }
  : { bg:"#f4f2fb", sb:"#ffffff", card:"#ffffff", cardHov:"#f9f8ff", inp:"#f4f2fb", border:"rgba(0,0,0,0.08)", text:"#1a1628", sub:"#6b6480", muted:"#9994b0" };

// ─── SVG Charts ───────────────────────────────────────────────────────────────
function DonutChart({ segs, size=140 }) {
  const tot = segs.reduce((s,g)=>s+g.v,0)||1;
  let cum = 0; const cx=size/2, cy=size/2, r=size*.38, ri=size*.24;
  return (
    <svg width={size} height={size}>
      {segs.map((seg,i)=>{
        const sa=(cum/tot)*2*Math.PI-Math.PI/2; cum+=seg.v; const ea=(cum/tot)*2*Math.PI-Math.PI/2, la=seg.v/tot>0.5?1:0;
        return <path key={i} d={`M${cx+ri*Math.cos(sa)},${cy+ri*Math.sin(sa)}L${cx+r*Math.cos(sa)},${cy+r*Math.sin(sa)}A${r},${r},0,${la},1,${cx+r*Math.cos(ea)},${cy+r*Math.sin(ea)}L${cx+ri*Math.cos(ea)},${cy+ri*Math.sin(ea)}A${ri},${ri},0,${la},0,${cx+ri*Math.cos(sa)},${cy+ri*Math.sin(sa)}Z`} fill={seg.c} opacity={0.9}><title>{seg.l}: {rm(seg.v)}</title></path>;
      })}
      <text x={cx} y={cy+2} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#9994b0" fontWeight={600}>{segs.length} cats</text>
    </svg>
  );
}
function BarChart({ data, color, height=100 }) {
  const max = Math.max(...data.map(d=>d.v), 1);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:4,height}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <div style={{width:"100%",height:height-18,display:"flex",alignItems:"flex-end",borderRadius:"6px 6px 0 0",overflow:"hidden",background:`${color}15`}}>
            <div style={{width:"100%",height:`${(d.v/max)*100}%`,background:color,borderRadius:"4px 4px 0 0",transition:"height 0.8s ease",minHeight:d.v>0?3:0}}/>
          </div>
          <div style={{fontSize:9,color:"#5c5870",textAlign:"center"}}>{d.l}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div style={{position:"fixed",top:16,right:16,zIndex:9999,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
      {toasts.map(t=>(
        <div key={t.id} style={{background:t.type==="xp"?"#5b21b6":t.type==="ach"?"#92400e":t.type==="warn"?"#991b1b":"#1f1c2e",color:"#fff",padding:"10px 16px",borderRadius:14,fontSize:13,fontWeight:600,boxShadow:"0 8px 32px rgba(0,0,0,0.4)",animation:"slideIn 0.35s ease",display:"flex",alignItems:"center",gap:10,maxWidth:280}}>
          <span style={{fontSize:20}}>{t.icon}</span>
          <div><div style={{fontSize:10,opacity:0.75,textTransform:"uppercase",letterSpacing:1}}>{t.label}</div><div>{t.msg}</div></div>
        </div>
      ))}
    </div>
  );
}

// ─── AUTH SCREEN ──────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode]       = useState("login"); // login | signup
  const [email, setEmail]     = useState("");
  const [password, setPass]   = useState("");
  const [name, setName]       = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [dark] = useState(false);

  async function handleSubmit() {
    if (!email || !password) { setError("Please fill in all fields"); return; }
    if (mode === "signup" && !name) { setError("Please enter your name"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true); setError("");
    try {
      if (mode === "login") {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        onAuth(cred.user);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", cred.user.uid), { displayName: name, email, createdAt: new Date().toISOString(), savings:0, scamRisk:0, totalXP:0, streak:0, achievements:[], goals:[] }, { merge:true });
        onAuth(cred.user);
      }
    } catch(e) {
      const msg = e.code === "auth/user-not-found" ? "Account not found" : e.code === "auth/wrong-password" ? "Wrong password" : e.code === "auth/email-already-in-use" ? "Email already registered" : e.code === "auth/invalid-email" ? "Invalid email address" : e.message;
      setError(msg);
    } finally { setLoading(false); }
  }

  const inp = { width:"100%", padding:"13px 16px", fontSize:14, background:"#1a1726", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, color:"#ede9f8", boxSizing:"border-box", outline:"none" };
  return (
    <div style={{minHeight:"100vh",background:"#0d0c13",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <div style={{width:"100%",maxWidth:400}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{fontSize:64,marginBottom:8,animation:"petFloat 3s ease-in-out infinite",display:"inline-block"}}>🐱</div>
          <div style={{fontSize:28,fontWeight:900,color:"#4ade80",letterSpacing:3,textTransform:"uppercase"}}>PocketPet</div>
          <div style={{fontSize:13,color:"#5c5870",marginTop:4}}>Your AI financial companion 🐾</div>
        </div>
        {/* Card */}
        <div style={{background:"#13111c",border:"1px solid rgba(255,255,255,0.07)",borderRadius:24,padding:"32px 28px"}}>
          {/* Tabs */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",background:"#0d0c13",borderRadius:12,padding:4,marginBottom:28,gap:4}}>
            {["login","signup"].map(m=>(
              <button key={m} onClick={()=>{setMode(m);setError("");}} style={{padding:"10px",fontSize:14,fontWeight:mode===m?700:400,background:mode===m?"#1a1726":"transparent",color:mode===m?"#4ade80":"#5c5870",border:"none",borderRadius:10,cursor:"pointer",textTransform:"capitalize",transition:"all 0.2s"}}>
                {m === "login" ? "🔑 Login" : "✨ Sign Up"}
              </button>
            ))}
          </div>
          {/* Fields */}
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {mode==="signup"&&<input placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} style={inp}/>}
            <input type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} style={inp}/>
            <input type="password" placeholder="Password" value={password} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} style={inp}/>
            {error&&<div style={{color:"#f87171",fontSize:12,background:"rgba(248,113,113,0.08)",padding:"8px 12px",borderRadius:8,border:"1px solid rgba(248,113,113,0.2)"}}>{error}</div>}
            <button onClick={handleSubmit} disabled={loading} style={{width:"100%",padding:"14px",fontSize:15,fontWeight:700,background:"#4ade80",color:"#0d0c13",border:"none",borderRadius:13,cursor:"pointer",marginTop:4,opacity:loading?0.7:1}}>
              {loading?"Loading...":(mode==="login"?"🔑 Login":"🐾 Create Account")}
            </button>
          </div>
          <div style={{textAlign:"center",marginTop:16,fontSize:12,color:"#5c5870"}}>
            {mode==="login"?"Don't have an account?":"Already have an account?"}{" "}
            <span onClick={()=>{setMode(mode==="login"?"signup":"login");setError("");}} style={{color:"#4ade80",cursor:"pointer",fontWeight:600}}>
              {mode==="login"?"Sign up":"Login"}
            </span>
          </div>
        </div>
        <div style={{textAlign:"center",marginTop:20,fontSize:11,color:"#3a3748"}}>Protected by Firebase Authentication 🔒</div>
      </div>
      <style>{`@keyframes petFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`}</style>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function PocketPet() {
  const bp = useBreakpoint();
  const [user, setUser]     = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Listen to Firebase auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthLoading(false); });
    return unsub;
  }, []);

  if (authLoading) return (
    <div style={{minHeight:"100vh",background:"#0d0c13",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:56,animation:"petFloat 1.5s ease-in-out infinite",display:"inline-block"}}>🐱</div>
        <div style={{color:"#4ade80",marginTop:12,fontSize:14,letterSpacing:2}}>LOADING...</div>
      </div>
      <style>{`@keyframes petFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`}</style>
    </div>
  );
  if (!user) return <AuthScreen onAuth={setUser}/>;
  return <AppContent user={user} bp={bp} onLogout={()=>signOut(auth).then(()=>setUser(null))}/>;
}

// ─── APP CONTENT (authenticated) ─────────────────────────────────────────────
function AppContent({ user, bp, onLogout }) {
  const [dark, setDark] = useState(false);
  const [tab,  setTab]  = useState("home");
  const T = getTheme(dark);

  // Data state
  const [expenses, setExpenses] = useState([]);
  const [savings,  setSavings]  = useState(0);
  const [scamRisk, setScamRisk] = useState(0);
  const [totalXP,  setTotalXP]  = useState(0);
  const [streak,   setStreak]   = useState(0);
  const [lastCI,   setLastCI]   = useState(null);
  const [achList,  setAchList]  = useState([]);
  const [goals,    setGoals]    = useState([]);
  const [budgets,  setBudgets]  = useState({ Food:200, Transport:100, Shopping:150, Entertainment:80, Bills:300, Health:100, Other:80 });
  const [checkedIn, setCheckedIn] = useState(false);
  const [noSpendDays, setNoSpendDays] = useState(0);
  const [scams, setScams]       = useState(0);
  const [goalsCompleted, setGoalsCompleted] = useState(0);
  const [challenges, setChallenges] = useState(0);
  const [coachAsked, setCoachAsked] = useState(0);
  const [quizPerfect, setQuizPerfect] = useState(0);
  const [budgetSetCount, setBudgetSetCount] = useState(0);
  const [levelUpAnim, setLevelUpAnim] = useState(false);
  const [bounce, setBounce] = useState(false);
  const [petMsg, setPetMsg] = useState("Heyy~ I'm Mochi 🐾 Welcome back! Let's keep those finances healthy!");
  const [loading, setLoading] = useState(false);
  const [cloudStatus, setCloudStatus] = useState("connected");
  const [toasts, setToasts] = useState([]);

  // Forms
  const [expAmt, setExpAmt] = useState(""); const [expCat, setExpCat] = useState("Food"); const [expNote, setExpNote] = useState("");
  const [savAmt, setSavAmt] = useState("");
  const [goalName, setGoalName] = useState(""); const [goalTarget, setGoalTarget] = useState(""); const [goalContrib, setGoalContrib] = useState({});
  const [scamText, setScamText] = useState(""); const [scamResult, setScamResult] = useState(null); const [scamLoading, setScamLoading] = useState(false);
  const [linkText, setLinkText] = useState(""); const [linkResult, setLinkResult] = useState(null); const [linkLoading, setLinkLoading] = useState(false);
  const [coachMsgs, setCoachMsgs] = useState([{ role:"assistant", content:"Hey! I'm your AI financial coach 🤖 Ask me anything about budgeting, saving, or money habits!" }]);
  const [coachInput, setCoachInput] = useState(""); const [coachLoading, setCoachLoading] = useState(false);
  const coachEnd = useRef(null);
  const [aiTip, setAiTip] = useState(""); const [tipLoading, setTipLoading] = useState(false);
  const [storyText, setStoryText] = useState(""); const [storyLoading, setStoryLoading] = useState(false);
  const [aiHabit, setAiHabit] = useState(""); const [habitLoading, setHabitLoading] = useState(false);
  const [budgetReco, setBudgetReco] = useState(""); const [recoLoading, setRecoLoading] = useState(false);
  const [challengeDone, setChallengeDone] = useState(false);
  const [todayChallenge] = useState(() => { const idx=Math.abs(todayKey().split("-").reduce((a,b)=>a+ +b,0))%CHALLENGE_POOL.length; return CHALLENGE_POOL[idx]; });
  const [quizActive, setQuizActive] = useState(false);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizAnswered, setQuizAnswered] = useState(null);
  const [quizDone, setQuizDone] = useState(false);
  const [editBudget, setEditBudget] = useState(false);
  const [tempBudgets, setTempBudgets] = useState({});
  const bounceTimer = useRef(null);
  const UID = user.uid;

  // ─── Derived ───────────────────────────────────────────────────────────────
  const totalSpend = useMemo(()=>expenses.reduce((s,e)=>s+e.amount,0),[expenses]);
  const score      = calcScore(totalSpend, savings, scamRisk);
  const state      = petState(score);
  const pet        = PET_STATES[state];
  const acc        = dark ? pet.al : pet.accent;
  const curLv      = getLevel(totalXP);
  const nxtLv      = nextLevel(totalXP);
  const xpP        = xpPct(totalXP);
  const todaySpend = useMemo(()=>expenses.filter(e=>e.date===todayKey()).reduce((s,e)=>s+e.amount,0),[expenses]);
  const catBreak   = useMemo(()=>{ const a={}; expenses.forEach(e=>{ a[e.category]=(a[e.category]||0)+e.amount; }); return Object.entries(a).sort((a,b)=>b[1]-a[1]); },[expenses]);
  const weekData   = useMemo(()=>["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((l,i)=>{ const d=new Date(); d.setDate(d.getDate()-((d.getDay()||7)-1)+i); return { l, v:expenses.filter(e=>e.date===d.toISOString().slice(0,10)).reduce((s,e)=>s+e.amount,0) }; }),[expenses]);
  const donutSegs  = useMemo(()=>catBreak.map(([c,v])=>({ l:c, v, c:CAT_COLOR[c]||"#94a3b8" })),[catBreak]);
  const budgetAlerts = useMemo(()=>Object.entries(budgets).filter(([cat,lim])=>{ const sp=expenses.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0); return sp>lim*0.8; }).map(([cat,lim])=>{ const sp=expenses.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0); return{cat,sp,lim,pct:Math.round((sp/lim)*100)}; }),[expenses,budgets]);

  // ─── Firebase load ─────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!db||!UID) return;
    getDoc(doc(db,"users",UID)).then(snap=>{
      if(snap.exists()){
        const d=snap.data();
        setSavings(d.savings||0); setScamRisk(d.scamRisk||0); setTotalXP(d.totalXP||0);
        setStreak(d.streak||0); setLastCI(d.lastCI||null); setAchList(d.achievements||[]);
        setGoals(d.goals||[]); setGoalsCompleted(d.goalsCompleted||0); setNoSpendDays(d.noSpendDays||0);
        setScams(d.scams||0); setChallenges(d.challenges||0); setCoachAsked(d.coachAsked||0);
        setQuizPerfect(d.quizPerfect||0); setBudgetSetCount(d.budgetSetCount||0);
        if(d.budgets) setBudgets(d.budgets);
        if(d.lastCI===todayKey()) setCheckedIn(true);
        if(d.lastChallengeDate===todayKey()) setChallengeDone(true);
      }
    }).catch(e=>{ console.error("Load error:",e.code); setCloudStatus("error"); });
    const q=query(collection(db,"users",UID,"expenses"),orderBy("createdAt","desc"));
    return onSnapshot(q, snap=>{ setExpenses(snap.docs.map(d=>({id:d.id,...d.data()}))); setCloudStatus("connected"); }, e=>{ console.error("Snapshot:",e.code); setCloudStatus("error"); });
  },[UID]);

  const save = useCallback(async(u)=>{ if(!db) return; setCloudStatus("saving"); try{ await setDoc(doc(db,"users",UID),u,{merge:true}); setCloudStatus("connected"); } catch(e){ console.error("Save:",e.code); setCloudStatus("error"); } },[UID]);

  // ─── Toast ─────────────────────────────────────────────────────────────────
  const toast = useCallback((icon,label,msg,type="info")=>{
    const id=Date.now()+Math.random(); setToasts(p=>[...p,{id,icon,label,msg,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),3500);
  },[]);

  // ─── XP ────────────────────────────────────────────────────────────────────
  const giveXP = useCallback((amount, reason)=>{
    setTotalXP(prev=>{ const before=getLevel(prev), next=prev+amount, after=getLevel(next); if(after.level>before.level){ setLevelUpAnim(true); setTimeout(()=>setLevelUpAnim(false),2000); toast("🎉","LEVEL UP!",`Mochi evolved to ${after.name}!`,"ach"); } toast("⭐","XP EARNED",`+${amount} XP — ${reason}`,"xp"); return next; });
  },[toast]);

  // ─── Achievements ──────────────────────────────────────────────────────────
  const checkAch = useCallback((st)=>{
    ACHIEVEMENTS.forEach(a=>{ if(!st.achList.includes(a.id)&&a.check(st)){ setAchList(p=>{ if(p.includes(a.id))return p; setTimeout(()=>{ toast(a.icon,"ACHIEVEMENT!",a.title,"ach"); giveXP(50,`Badge: ${a.title}`); },0); return [...p,a.id]; }); } });
  },[toast,giveXP]);

  function triggerBounce(){ setBounce(true); clearTimeout(bounceTimer.current); bounceTimer.current=setTimeout(()=>setBounce(false),700); }

  async function feedback(ctx){ setLoading(true); try{ const m=await ai([{role:"user",content:ctx}],"You are Mochi, a cute Gen Z AI financial pet. React in 1-2 sentences. Playful, caring, emoji. Malaysian Gen Z tone. Use RM."); if(m){ setPetMsg(m); triggerBounce(); } } catch(e){ setPetMsg("Aiya, brain lagged 😅"); } finally{ setLoading(false); } }

  // ─── Handlers ──────────────────────────────────────────────────────────────
  async function checkIn(){
    if(checkedIn) return;
    const today=todayKey(), yest=new Date(Date.now()-86400000).toISOString().slice(0,10);
    const ns=lastCI===yest?streak+1:1, nn=noSpendDays+(todaySpend===0?1:0);
    setStreak(ns); setCheckedIn(true); setLastCI(today); setNoSpendDays(nn);
    giveXP(10+Math.min(ns*5,50),`${ns}-day streak`);
    if(ns%7===0) toast("🔥","STREAK MILESTONE!",`${ns} days on fire!`,"ach");
    await save({streak:ns,lastCI:today,noSpendDays:nn});
    checkAch({expenses:expenses.length,savings,streak:ns,scams,level:curLv.level,goalsCompleted,noSpendDays:nn,totalXP,achList,challenges,coachAsked,quizPerfect,budgetSet:budgetSetCount});
    await feedback(`User checked in! ${ns}-day streak. Spent RM${todaySpend.toFixed(0)} today.`);
  }

  async function addExpense(){
    const amt=parseFloat(expAmt); 
    if(!amt||amt<=0) return;
    
    setCloudStatus("saving");
    try{ 
      await addDoc(collection(db,"users",UID,"expenses"),{
        amount:amt,
        category:expCat,
        note:expNote || "",  // Ensure note is always a string
        createdAt:new Date(),
        date:todayKey()
      }); 
      setCloudStatus("connected");
    } catch(e){ 
      console.error("Add expense error:", e);
      setCloudStatus("error"); 
    }
    
    const catSp=expenses.filter(e=>e.category===expCat).reduce((s,e)=>s+e.amount,0)+amt, 
          lim=budgets[expCat]||999;
    if(catSp>lim) toast("⚠️","BUDGET EXCEEDED!",`${CAT_ICON[expCat]} ${expCat} over by RM${(catSp-lim).toFixed(0)}`,"warn");
    else if(catSp>lim*0.8) toast("⚠️","BUDGET WARNING",`${expCat} at ${Math.round((catSp/lim)*100)}% of limit`,"warn");
    
    setExpAmt(""); 
    setExpNote("");  // ← FIXED: Set to empty string, not undefined
    giveXP(5,"Expense logged");
    const nx=totalXP+5;
    checkAch({expenses:expenses.length+1,savings,streak,scams,level:getLevel(nx).level,goalsCompleted,noSpendDays,totalXP:nx,achList,challenges,coachAsked,quizPerfect,budgetSet:budgetSetCount});
    await save({totalXP:nx});
    await feedback(`User spent RM${amt} on ${expCat}${expNote?` (${expNote})`:""}. Total: RM${(totalSpend+amt).toFixed(0)}.`);
  }

  async function addSavings(){
    const amt=parseFloat(savAmt); if(!amt||amt<=0) return;
    const ns=savings+amt; setSavings(ns); setSavAmt("");
    const nx=totalXP+15; giveXP(15,"Savings logged");
    checkAch({expenses:expenses.length,savings:ns,streak,scams,level:getLevel(nx).level,goalsCompleted,noSpendDays,totalXP:nx,achList,challenges,coachAsked,quizPerfect,budgetSet:budgetSetCount});
    await save({savings:ns,totalXP:nx});
    await feedback(`User saved RM${amt}! Total saved: RM${ns}. Celebrate!`);
  }

  async function doCheckScam(){
    if(!scamText.trim()) return; setScamLoading(true); setScamResult(null);
    try{
      const result=await ai([{role:"user",content:`Analyze for scam: "${scamText}"`}],`Scam detection AI. ONLY valid JSON, no markdown: {"probability":<0-100>,"level":"Low|Medium|High","reason":"one sentence","flags":["flag1"],"scamType":"Job Scam|Bank Scam|Phishing|Lottery|Other"}`,true);
      const r=result||{probability:0,level:"Unknown",reason:"Could not analyze.",flags:[],scamType:"Other"};
      setScamResult(r);
      if(r.probability>30){
        const ns=scams+1, nx=totalXP+20; setScams(ns); giveXP(20,"Scam detected & avoided");
        const nr=Math.min(100,scamRisk+r.probability*0.3); setScamRisk(nr);
        if(r.probability>60) toast("🚨","SCAM ALERT!",`${r.probability}% probability!`,"warn");
        checkAch({expenses:expenses.length,savings,streak,scams:ns,level:getLevel(nx).level,goalsCompleted,noSpendDays,totalXP:nx,achList,challenges,coachAsked,quizPerfect,budgetSet:budgetSetCount});
        await save({scamRisk:nr,scams:ns,totalXP:nx});
        await feedback(`Scam detected at ${r.probability}%! Warn user!`);
      }
    } finally{ setScamLoading(false); }
  }

  async function doCheckLink(){
    if(!linkText.trim()) return; setLinkLoading(true); setLinkResult(null);
    try{
      const r=await ai([{role:"user",content:`Analyze URL safety: "${linkText}"`}],`Link safety AI. ONLY valid JSON: {"risk":<0-100>,"level":"Safe|Suspicious|Dangerous","reason":"one sentence","flags":["flag"],"category":"Phishing|Malware|Fake Banking|Safe|Other"}`,true);
      setLinkResult(r||{risk:0,level:"Unknown",reason:"Could not analyze.",flags:[],category:"Other"});
      if(r&&r.risk>40) toast("⚠️","DANGEROUS LINK!",`${r.risk}% risk — do not click!`,"warn");
    } finally{ setLinkLoading(false); }
  }

  async function sendCoach(){
    if(!coachInput.trim()||coachLoading) return;
    const um={role:"user",content:coachInput}; const hist=[...coachMsgs,um];
    setCoachMsgs(hist); setCoachInput(""); setCoachLoading(true);
    try{
      const reply=await ai(hist,`You are a warm Malaysian Gen Z financial coach. User: Lv${curLv.level}, ${streak}-day streak, spent RM${totalSpend.toFixed(0)}, saved RM${savings.toFixed(0)}. Give 2-3 sentence practical advice in English. Use RM.`);
      setCoachMsgs(p=>[...p,{role:"assistant",content:reply||"Try saving RM10 daily to build a healthy habit! 💪"}]);
      setTimeout(()=>coachEnd.current?.scrollIntoView({behavior:"smooth"}),100);
      const nq=coachAsked+1, nx=totalXP+10; setCoachAsked(nq); giveXP(10,"Asked coach");
      checkAch({expenses:expenses.length,savings,streak,scams,level:curLv.level,goalsCompleted,noSpendDays,totalXP:nx,achList,challenges,coachAsked:nq,quizPerfect,budgetSet:budgetSetCount});
      await save({coachAsked:nq,totalXP:nx});
    } finally{ setCoachLoading(false); }
  }

  function answerQuiz(ans){
    const q=QUIZ_QUESTIONS[quizIdx], correct=q.label===ans;
    setQuizAnswered({ans,correct,reason:q.reason});
    if(correct) setQuizScore(p=>p+1);
  }
  async function nextQuiz(){
    if(quizIdx>=QUIZ_QUESTIONS.length-1){
      setQuizDone(true);
      const perfect=quizScore+(quizAnswered?.correct?1:0)===QUIZ_QUESTIONS.length;
      const xpEarned=perfect?100:50; giveXP(xpEarned,perfect?"Perfect quiz score!":"Quiz completed");
      if(perfect){ toast("🎓","PERFECT SCORE!","100% on scam quiz!","ach"); const nqp=quizPerfect+1; setQuizPerfect(nqp); await save({quizPerfect:nqp,totalXP:totalXP+xpEarned}); checkAch({expenses:expenses.length,savings,streak,scams,level:curLv.level,goalsCompleted,noSpendDays,totalXP:totalXP+xpEarned,achList,challenges,coachAsked,quizPerfect:nqp,budgetSet:budgetSetCount}); }
      else await save({totalXP:totalXP+xpEarned});
    } else { setQuizIdx(p=>p+1); setQuizAnswered(null); }
  }
  function startQuiz(){ setQuizActive(true); setQuizIdx(0); setQuizScore(0); setQuizAnswered(null); setQuizDone(false); }

  async function completeChallenge(){
    if(challengeDone) return;
    setChallengeDone(true); const nc=challenges+1; setChallenges(nc);
    giveXP(todayChallenge.xp,`Challenge: ${todayChallenge.text}`);
    toast(todayChallenge.icon,"QUEST DONE!",`+${todayChallenge.xp} XP!`,"ach");
    checkAch({expenses:expenses.length,savings,streak,scams,level:curLv.level,goalsCompleted,noSpendDays,totalXP:totalXP+todayChallenge.xp,achList,challenges:nc,coachAsked,quizPerfect,budgetSet:budgetSetCount});
    await save({challenges:nc,lastChallengeDate:todayKey(),totalXP:totalXP+todayChallenge.xp});
    await feedback(`User completed quest: "${todayChallenge.text}". Celebrate!`);
  }

  async function addGoal(){
    const t=parseFloat(goalTarget); if(!goalName.trim()||!t) return;
    const g={id:Date.now().toString(),name:goalName,target:t,saved:0,createdAt:new Date().toISOString()};
    const ng=[...goals,g]; setGoals(ng); setGoalName(""); setGoalTarget("");
    await save({goals:ng}); toast("🎯","GOAL SET!",`"${goalName}" — RM${t.toFixed(0)}`,"xp");
  }

  async function contributeGoal(gid){
    const amt=parseFloat(goalContrib[gid]); if(!amt) return;
    const ng=goals.map(g=>g.id!==gid?g:{...g,saved:Math.min(g.saved+amt,g.target)});
    setGoals(ng); setGoalContrib(p=>({...p,[gid]:""}));
    const goal=goals.find(g=>g.id===gid), done=(goal?.saved||0)+amt>=(goal?.target||999);
    if(done){ const nc=goalsCompleted+1; setGoalsCompleted(nc); giveXP(100,`Goal: ${goal?.name}`); toast("🎯","GOAL COMPLETE!",`"${goal?.name}" achieved!`,"ach"); checkAch({expenses:expenses.length,savings,streak,scams,level:curLv.level,goalsCompleted:nc,noSpendDays,totalXP:totalXP+100,achList,challenges,coachAsked,quizPerfect,budgetSet:budgetSetCount}); await save({goals:ng,goalsCompleted:nc,totalXP:totalXP+100}); }
    else{ giveXP(10,"Goal contribution"); await save({goals:ng,totalXP:totalXP+10}); }
  }

  async function saveBudgets(){
    await save({budgets:tempBudgets,budgetSetCount:budgetSetCount+1}); setBudgets(tempBudgets); setBudgetSetCount(p=>p+1); setEditBudget(false);
    toast("💰","BUDGETS SAVED","Limits updated ✅","xp");
    checkAch({expenses:expenses.length,savings,streak,scams,level:curLv.level,goalsCompleted,noSpendDays,totalXP,achList,challenges,coachAsked,quizPerfect,budgetSet:budgetSetCount+1});
  }

  async function genTips(){ setTipLoading(true); setAiTip(""); try{ const t=await ai([{role:"user",content:`Lv${curLv.level}, ${streak}d streak, spent RM${totalSpend.toFixed(0)}, saved RM${savings.toFixed(0)}, risk ${Math.round(scamRisk)}%. Top: ${catBreak.slice(0,3).map(([c,a])=>`${c} RM${a.toFixed(0)}`).join(", ")||"none"}. Give 3 actionable tips.`}],"Malaysian financial coach. Practical, Gen Z, bullet points, under 120 words. Use RM."); setAiTip(t); } finally{ setTipLoading(false); } }
  async function genStory(){ setStoryLoading(true); setStoryText(""); try{ const t=await ai([{role:"user",content:`Write a 3-sentence financial story for today. User spent RM${todaySpend.toFixed(0)}, saved RM${savings.toFixed(0)} total, ${streak}-day streak, score ${score}/100. Top category: ${catBreak[0]?catBreak[0][0]:"none"}. Make it emotional and encouraging.`}],"You are Mochi the financial pet. Write a short emotional daily story about the user. Warm, Gen Z, 2-3 sentences. Use RM."); setStoryText(t); } finally{ setStoryLoading(false); } }
  async function genHabit(){ setHabitLoading(true); setAiHabit(""); try{ const t=await ai([{role:"user",content:`Analyze spending habits. Expenses by category: ${catBreak.map(([c,a])=>`${c}: RM${a.toFixed(0)}`).join(", ")||"none"}. Total: RM${totalSpend.toFixed(0)}. Savings: RM${savings.toFixed(0)}. Streak: ${streak}. Identify 2 bad habits and give 1 savings opportunity with specific RM amounts.`}],"Malaysian financial analyst. Specific habit insights, 2-3 sentences. Use RM amounts. Gen Z tone."); setAiHabit(t); } finally{ setHabitLoading(false); } }
  async function genBudgetReco(){ setRecoLoading(true); setBudgetReco(""); try{ const t=await ai([{role:"user",content:`User income estimate based on spending RM${totalSpend.toFixed(0)}/month. Savings RM${savings.toFixed(0)}. Suggest monthly budget for: ${Object.keys(budgets).join(", ")}. Format as: Category: RMxxx`}],"Malaysian financial planner. Suggest realistic monthly budgets in RM. Format each as 'Category: RMxxx'. One per line. Brief."); setBudgetReco(t); } finally{ setRecoLoading(false); } }

  // ─── Styles ────────────────────────────────────────────────────────────────
  const card = { background:T.card, border:`1px solid ${T.border}`, borderRadius:18, padding:"20px 22px", marginBottom:14 };
  const inp  = { width:"100%", padding:"12px 14px", fontSize:14, background:T.inp, border:`1px solid ${T.border}`, borderRadius:12, color:T.text, boxSizing:"border-box", outline:"none" };
  const btn  = (bg=acc, tc=dark?"#0d0c13":"#fff") => ({ width:"100%", padding:"12px", fontSize:14, fontWeight:700, background:bg, color:tc, border:"none", borderRadius:12, cursor:"pointer" });
  const smBtn= (bg=acc, tc=dark?"#0d0c13":"#fff") => ({ padding:"8px 16px", fontSize:13, fontWeight:600, background:bg, color:tc, border:"none", borderRadius:10, cursor:"pointer" });

  // ─── Risk color helper ─────────────────────────────────────────────────────
  const rc = p => p>60?"#f87171":p>30?"#fbbf24":"#4ade80";

  // ─── Cloud pill ────────────────────────────────────────────────────────────
  const cpill = { connected:{bg:"rgba(74,222,128,0.1)",c:"#4ade80",b:"rgba(74,222,128,0.25)",l:"☁ Synced"}, saving:{bg:"rgba(251,191,36,0.1)",c:"#fbbf24",b:"rgba(251,191,36,0.25)",l:"☁ Saving…"}, error:{bg:"rgba(248,113,113,0.1)",c:"#f87171",b:"rgba(248,113,113,0.25)",l:"☁ Offline"} }[cloudStatus]||{};

  // ─── Pet section ───────────────────────────────────────────────────────────
  const PetSection = ({ compact=false }) => (
    <div style={{...card,boxShadow:pet.glow,border:`1px solid ${acc}22`,textAlign:"center",padding:compact?"14px 16px":"20px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          <span style={{fontSize:9,fontWeight:700,color:acc,background:pet.dim,padding:"2px 8px",borderRadius:20,textTransform:"uppercase",letterSpacing:1}}>Lv.{curLv.level}</span>
          {streak>0&&<span style={{fontSize:9,fontWeight:700,color:"#fb923c",background:"rgba(251,146,60,0.12)",padding:"2px 8px",borderRadius:20}}>🔥{streak}d</span>}
        </div>
        <span style={{fontSize:9,padding:"3px 10px",borderRadius:20,fontWeight:700,background:cpill.bg,color:cpill.c,border:`1px solid ${cpill.b}`,letterSpacing:1,textTransform:"uppercase"}}>{cpill.l}</span>
      </div>
      <div style={{fontSize:compact?56:68,lineHeight:1,display:"inline-block",animation:levelUpAnim?"levelUp 2s ease":bounce?"petBounce 0.7s ease":"petFloat 3s ease-in-out infinite"}}>{curLv.emoji}</div>
      <div style={{fontFamily:"monospace",fontSize:13,color:acc,margin:"4px 0 2px"}}>{pet.face}</div>
      <div style={{fontSize:11,color:dark?"#a78bfa":"#7c3aed",fontWeight:600,marginBottom:6}}>{curLv.name} · {curLv.title}</div>
      <div style={{display:"inline-block",background:pet.dim,color:acc,border:`1px solid ${acc}33`,fontSize:9,fontWeight:700,padding:"2px 10px",borderRadius:20,marginBottom:10,letterSpacing:1.5,textTransform:"uppercase"}}>{pet.label}</div>
      <div style={{marginBottom:6}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.muted,marginBottom:3}}><span>Health</span><span style={{color:acc,fontWeight:700}}>{score}/100</span></div>
        <div style={{height:5,background:dark?"#1f1c2e":"#e8e4f5",borderRadius:10,overflow:"hidden"}}><div style={{height:"100%",width:`${score}%`,background:pet.bar,borderRadius:10,transition:"width 0.8s ease"}}/></div>
      </div>
      <div style={{marginBottom:compact?0:10}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.muted,marginBottom:3}}><span>XP {nxtLv?`→Lv.${nxtLv.level}`:""}</span><span style={{color:dark?"#a78bfa":"#7c3aed",fontWeight:700}}>{totalXP}xp</span></div>
        <div style={{height:5,background:dark?"#1f1c2e":"#e8e4f5",borderRadius:10,overflow:"hidden"}}><div style={{height:"100%",width:`${xpP}%`,background:dark?"#a78bfa":"#7c3aed",borderRadius:10,transition:"width 0.8s ease"}}/></div>
      </div>
      {!compact&&<div style={{background:T.inp,border:`1px solid ${acc}15`,borderRadius:11,padding:"10px 12px",fontSize:12,color:loading?T.muted:T.text,textAlign:"left",minHeight:40,lineHeight:1.6}}>{loading?"✨ Mochi thinking...":petMsg}</div>}
    </div>
  );

  // ─── Tabs ──────────────────────────────────────────────────────────────────
  const renderTab = () => {
    // SPEND
    if(tab==="home") return (
      <div style={{display:"grid",gridTemplateColumns:bp.isDesktop?"1fr 1fr":"1fr",gap:14}}>
        {/* Check-in banner */}
        <div style={{...card,gridColumn:bp.isDesktop?"span 2":"span 1",background:dark?(checkedIn?"rgba(74,222,128,0.05)":"rgba(124,58,237,0.08)"):"rgba(124,58,237,0.04)",border:`1px solid ${checkedIn?"#4ade8030":"#a78bfa30"}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
            <div><div style={{fontSize:15,fontWeight:700,color:T.text}}>Daily Check-In {checkedIn?"✅":""}</div><div style={{fontSize:12,color:T.muted,marginTop:2}}>{checkedIn?`${streak}-day streak! Keep going 🔥`:"Check in to earn XP and maintain your streak"}</div></div>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:900,color:"#fb923c"}}>{streak}</div><div style={{fontSize:9,color:T.muted,textTransform:"uppercase",letterSpacing:1}}>streak</div></div>
              {!checkedIn&&<button onClick={checkIn} style={{...smBtn(dark?"#a78bfa":"#7c3aed","#fff"),padding:"10px 20px"}}>✅ Check In</button>}
            </div>
          </div>
          <div style={{display:"flex",gap:3,marginTop:12}}>
            {Array.from({length:7}).map((_,i)=><div key={i} style={{flex:1,height:7,borderRadius:6,background:i<Math.min(streak,7)?"#fb923c":dark?"#1f1c2e":"#e8e4f5",transition:"background 0.3s"}}/>)}
          </div>
        </div>
        {/* Budget alerts */}
        {budgetAlerts.length>0&&(
          <div style={{...card,gridColumn:bp.isDesktop?"span 2":"span 1",background:"rgba(248,113,113,0.05)",border:"1px solid rgba(248,113,113,0.2)",padding:"14px 18px"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#f87171",marginBottom:8}}>⚠️ Budget Alerts</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {budgetAlerts.map(a=><div key={a.cat} style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:10,padding:"6px 12px",fontSize:12,color:T.text}}>{CAT_ICON[a.cat]} {a.cat}: <strong style={{color:"#f87171"}}>{a.pct}%</strong> of RM{a.lim}</div>)}
            </div>
          </div>
        )}
        {/* Log expense */}
        <div style={card}>
          <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:3}}>Log Expense 💸</div>
          <div style={{fontSize:11,color:T.muted,marginBottom:14}}>What did you spend on today?</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <input type="number" placeholder="Amount (RM)" value={expAmt} onChange={e=>setExpAmt(e.target.value)} style={inp}/>
            <select value={expCat} onChange={e=>setExpCat(e.target.value)} style={{...inp,cursor:"pointer"}}>{CATS.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select>
          </div>
          <input placeholder="Note (optional)" value={expNote||""} onChange={e=>setExpNote(e.target.value)} style={{...inp,marginBottom:12}}/>
          <button onClick={addExpense} style={btn()} disabled={loading}>{loading?"⏳ Reacting...":"➕ Log Expense (+5 XP)"}</button>
        </div>
        {/* Budget overview */}
        <div style={{...card,background:dark?"rgba(124,58,237,0.05)":"rgba(124,58,237,0.03)",border:`1px solid ${dark?"#a78bfa18":"#7c3aed10"}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:15,fontWeight:700,color:T.text}}>💰 Monthly Budgets</div>
            <button onClick={()=>{setEditBudget(true);setTempBudgets({...budgets});}} style={{...smBtn(dark?"#1f1c2e":"#f4f2fb",T.sub),border:`1px solid ${T.border}`}}>Edit</button>
          </div>
          {editBudget?(
            <div>
              {Object.entries(tempBudgets).map(([cat,lim])=>(
                <div key={cat} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{fontSize:16}}>{CAT_ICON[cat]}</span>
                  <span style={{flex:1,fontSize:12,color:T.text}}>{cat}</span>
                  <input type="number" value={lim} onChange={e=>setTempBudgets(p=>({...p,[cat]:parseFloat(e.target.value)||0}))} style={{...inp,width:90,padding:"6px 10px"}}/>
                </div>
              ))}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                <button onClick={saveBudgets} style={btn("#4ade80","#0d0c13")}>Save</button>
                <button onClick={()=>setEditBudget(false)} style={btn(dark?"#1f1c2e":"#e0ddf0",T.text)}>Cancel</button>
              </div>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {Object.entries(budgets).map(([cat,lim])=>{ const sp=expenses.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0); const pct=Math.min(100,Math.round((sp/lim)*100)); const c=pct>80?"#f87171":pct>60?"#fbbf24":acc; return (
                <div key={cat}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.sub,marginBottom:3}}><span>{CAT_ICON[cat]} {cat}</span><span style={{color:pct>80?"#f87171":T.text}}>{rm(sp)} / {rm(lim)}</span></div>
                  <div style={{height:4,background:dark?"#1f1c2e":"#e8e4f5",borderRadius:10,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:c,borderRadius:10,transition:"width 0.6s ease"}}/></div>
                </div>
              ); })}
            </div>
          )}
        </div>
      </div>
    );

    // SAVE
    if(tab==="save") return (
      <div style={{display:"grid",gridTemplateColumns:bp.isDesktop?"1fr 1fr":"1fr",gap:14}}>
        <div style={card}>
          <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:3}}>Log Savings 🐷</div>
          <div style={{fontSize:11,color:T.muted,marginBottom:14}}>Tell Mochi what you saved</div>
          <input type="number" placeholder="Amount saved (RM)" value={savAmt} onChange={e=>setSavAmt(e.target.value)} style={{...inp,marginBottom:12}}/>
          <button onClick={addSavings} style={btn("#4ade80","#0d0c13")} disabled={loading}>{loading?"⏳ Celebrating...":"💰 Add Savings (+15 XP)"}</button>
        </div>
        <div style={{...card,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:6,background:"rgba(74,222,128,0.05)",border:"1px solid rgba(74,222,128,0.18)"}}>
          <div style={{fontSize:11,color:T.muted,textTransform:"uppercase",letterSpacing:1}}>Total Saved ☁ Synced</div>
          <div style={{fontSize:48,fontWeight:900,color:"#4ade80"}}>{rm(savings)}</div>
          <div style={{fontSize:11,color:T.muted}}>Keep it up! 🌟</div>
        </div>
      </div>
    );

    // GOALS
    if(tab==="goals") return (
      <div>
        <div style={card}>
          <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:3}}>Add Saving Goal 🎯</div>
          <div style={{fontSize:11,color:T.muted,marginBottom:14}}>Set a target and track progress</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <input placeholder="Goal name" value={goalName} onChange={e=>setGoalName(e.target.value)} style={inp}/>
            <input type="number" placeholder="Target (RM)" value={goalTarget} onChange={e=>setGoalTarget(e.target.value)} style={inp}/>
          </div>
          <button onClick={addGoal} style={btn()}>🎯 Add Goal</button>
        </div>
        {goals.length===0&&<div style={{...card,textAlign:"center",padding:"40px 20px"}}><div style={{fontSize:40,marginBottom:10}}>🎯</div><div style={{color:T.muted,fontSize:13}}>No goals yet — set one above!</div></div>}
        {goals.map(g=>{ const pct=Math.round((g.saved/g.target)*100); const done=g.saved>=g.target; return (
          <div key={g.id} style={{...card,background:done?"rgba(74,222,128,0.06)":"auto",border:done?"1px solid rgba(74,222,128,0.2)":`1px solid ${T.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div><div style={{fontSize:14,fontWeight:700,color:T.text}}>{done?"🎉 ":""}{g.name}</div><div style={{fontSize:11,color:T.muted}}>Target: {rm(g.target)}</div></div>
              <div style={{fontSize:22,fontWeight:900,color:done?"#4ade80":acc}}>{pct}%</div>
            </div>
            <div style={{height:7,background:dark?"#1f1c2e":"#e8e4f5",borderRadius:10,overflow:"hidden",marginBottom:10}}>
              <div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:done?"#4ade80":acc,borderRadius:10,transition:"width 0.8s ease"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.muted,marginBottom:done?0:12}}><span>Saved: {rm(g.saved)}</span><span>Left: {rm(Math.max(0,g.target-g.saved))}</span></div>
            {!done&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8}}>
                <input type="number" placeholder="Add RM" value={goalContrib[g.id]||""} onChange={e=>setGoalContrib(p=>({...p,[g.id]:e.target.value}))} style={{...inp,padding:"8px 12px"}}/>
                <button onClick={()=>contributeGoal(g.id)} style={smBtn()}>Add</button>
              </div>
            )}
          </div>
        ); })}
      </div>
    );

    // ANALYZE
    if(tab==="analyze") return (
      <div>
        {/* Health score dashboard */}
        <div style={{display:"grid",gridTemplateColumns:bp.isDesktop?"repeat(4,1fr)":"repeat(2,1fr)",gap:10,marginBottom:14}}>
          {[{l:"Health Score",v:`${score}/100`,c:acc,icon:"❤️"},{l:"Scam Risk",v:`${Math.round(scamRisk)}%`,c:rc(scamRisk),icon:"🛡️"},{l:"Total Spent",v:rm(totalSpend),c:totalSpend>500?"#f87171":T.text,icon:"💸"},{l:"Savings Rate",v:totalSpend>0?`${Math.round((savings/(savings+totalSpend))*100)}%`:"N/A",c:"#4ade80",icon:"📈"}].map(s=>(
            <div key={s.l} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 12px",textAlign:"center"}}>
              <div style={{fontSize:20,marginBottom:4}}>{s.icon}</div>
              <div style={{fontSize:18,fontWeight:800,color:s.c}}>{s.v}</div>
              <div style={{fontSize:10,color:T.muted,marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>
        {/* Charts */}
        <div style={{display:"grid",gridTemplateColumns:bp.isDesktop?"1fr 1fr":"1fr",gap:14,marginBottom:14}}>
          {/* Donut */}
          <div style={card}>
            <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:14}}>🍩 Spending by Category</div>
            {donutSegs.length===0?<div style={{textAlign:"center",color:T.muted,padding:"20px 0"}}>No data yet</div>:(
              <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
                <DonutChart segs={donutSegs} size={130}/>
                <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
                  {catBreak.slice(0,5).map(([cat,amt])=>(
                    <div key={cat} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:"50%",background:CAT_COLOR[cat]||"#94a3b8"}}/><span style={{fontSize:11,color:T.text}}>{cat}</span></div>
                      <span style={{fontSize:11,fontWeight:700,color:T.text}}>{rm(amt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Weekly bar */}
          <div style={card}>
            <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:14}}>📅 This Week's Spending</div>
            <BarChart data={weekData} color={acc} height={110}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.muted,marginTop:8}}>
              <span>Total: {rm(weekData.reduce((s,d)=>s+d.v,0))}</span>
              <span>Avg/day: {rm(weekData.filter(d=>d.v>0).reduce((s,d)=>s+d.v,0)/Math.max(weekData.filter(d=>d.v>0).length,1))}</span>
            </div>
          </div>
        </div>
        {/* Budget vs actual */}
        <div style={{...card,marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:14}}>📊 Budget vs Actual</div>
          {Object.entries(budgets).map(([cat,lim])=>{ const sp=expenses.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0); const pct=Math.min(100,Math.round((sp/lim)*100)); const c=pct>80?"#f87171":pct>60?"#fbbf24":"#4ade80"; return (
            <div key={cat} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.sub,marginBottom:4}}>
                <span>{CAT_ICON[cat]} {cat}</span>
                <span style={{color:pct>80?"#f87171":T.text,fontWeight:600}}>{rm(sp)} / {rm(lim)} ({pct}%)</span>
              </div>
              <div style={{height:6,background:dark?"#1f1c2e":"#e8e4f5",borderRadius:10,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pct}%`,background:c,borderRadius:10,transition:"width 0.6s ease"}}/>
              </div>
            </div>
          ); })}
        </div>
        {/* AI Insights row */}
        <div style={{display:"grid",gridTemplateColumns:bp.isDesktop?"repeat(3,1fr)":"1fr",gap:14}}>
          {/* Habit detection */}
          <div style={{...card,background:dark?"rgba(167,139,250,0.05)":"rgba(124,58,237,0.03)",border:`1px solid ${dark?"#a78bfa18":"#7c3aed10"}`}}>
            <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:8}}>🧠 AI Habit Analysis</div>
            <div style={{fontSize:11,color:T.muted,marginBottom:12}}>Detects your spending patterns</div>
            <button onClick={genHabit} style={btn(dark?"#a78bfa":"#7c3aed","#fff")} disabled={habitLoading}>{habitLoading?"🤔 Analyzing...":"🔍 Analyze Habits"}</button>
            {aiHabit&&<div style={{marginTop:12,fontSize:12,color:T.text,lineHeight:1.7,padding:"10px 12px",background:T.inp,borderRadius:10}}>{aiHabit}</div>}
          </div>
          {/* Financial story */}
          <div style={{...card,background:dark?"rgba(74,222,128,0.04)":"rgba(22,163,74,0.03)",border:`1px solid ${dark?"#4ade8018":"#16a34a10"}`}}>
            <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:8}}>📖 Daily Story</div>
            <div style={{fontSize:11,color:T.muted,marginBottom:12}}>Mochi narrates your financial day</div>
            <button onClick={genStory} style={btn("#4ade80","#0d0c13")} disabled={storyLoading}>{storyLoading?"✍️ Writing...":"📖 Generate Story"}</button>
            {storyText&&<div style={{marginTop:12,fontSize:12,color:T.text,lineHeight:1.8,padding:"10px 12px",background:T.inp,borderRadius:10,fontStyle:"italic"}}>"{storyText}"</div>}
          </div>
          {/* Budget recommendation */}
          <div style={{...card,background:dark?"rgba(251,191,36,0.04)":"rgba(217,119,6,0.03)",border:`1px solid ${dark?"#fbbf2418":"#d9770610"}`}}>
            <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:8}}>💡 Smart Budget Plan</div>
            <div style={{fontSize:11,color:T.muted,marginBottom:12}}>AI suggests your ideal budget</div>
            <button onClick={genBudgetReco} style={btn("#fbbf24","#0d0c13")} disabled={recoLoading}>{recoLoading?"🤔 Planning...":"✨ Generate Budget"}</button>
            {budgetReco&&<div style={{marginTop:12,fontSize:12,color:T.text,lineHeight:1.8,padding:"10px 12px",background:T.inp,borderRadius:10,whiteSpace:"pre-wrap"}}>{budgetReco}</div>}
          </div>
        </div>
      </div>
    );

    // COACH
    if(tab==="coach") return (
      <div style={{...card,display:"flex",flexDirection:"column",height:"calc(100vh - 200px)",minHeight:400}}>
        <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:4}}>🤖 AI Financial Coach</div>
        <div style={{fontSize:11,color:T.muted,marginBottom:14}}>Ask anything about money, saving, budgeting, or investing</div>
        {/* Quick prompts */}
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
          {["Can I afford a RM500 gadget?","How to save RM1000 in 3 months?","Am I spending too much on food?","Tips for emergency fund?"].map(q=>(
            <button key={q} onClick={()=>setCoachInput(q)} style={{...smBtn(T.cardHov,T.sub),border:`1px solid ${T.border}`,fontSize:11}}>{q}</button>
          ))}
        </div>
        {/* Chat messages */}
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,paddingRight:4}}>
          {coachMsgs.map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
              <div style={{maxWidth:"82%",padding:"10px 14px",borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",background:m.role==="user"?acc:T.cardHov,color:m.role==="user"?(dark?"#0d0c13":"#fff"):T.text,fontSize:13,lineHeight:1.6,border:m.role==="assistant"?`1px solid ${T.border}`:"none"}}>
                {m.role==="assistant"&&<div style={{fontSize:10,color:T.muted,marginBottom:4}}>🤖 Mochi Coach</div>}
                {m.content}
              </div>
            </div>
          ))}
          {coachLoading&&<div style={{display:"flex",justifyContent:"flex-start"}}><div style={{padding:"10px 14px",borderRadius:"16px 16px 16px 4px",background:T.cardHov,border:`1px solid ${T.border}`,fontSize:13,color:T.muted}}>✨ Thinking...</div></div>}
          <div ref={coachEnd}/>
        </div>
        {/* Input */}
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginTop:12}}>
          <input placeholder="Ask your coach anything..." value={coachInput} onChange={e=>setCoachInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendCoach()} style={{...inp,padding:"11px 14px"}}/>
          <button onClick={sendCoach} disabled={coachLoading||!coachInput.trim()} style={{...smBtn(acc,dark?"#0d0c13":"#fff"),padding:"11px 18px",opacity:coachLoading||!coachInput.trim()?0.5:1}}>Send</button>
        </div>
      </div>
    );

    // SHIELD
    if(tab==="shield") return (
      <div>
        {/* Scam checker */}
        <div style={card}>
          <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:3}}>🛡️ Scam Message Detector</div>
          <div style={{fontSize:11,color:T.muted,marginBottom:14}}>Paste a suspicious SMS, WhatsApp, or email</div>
          <textarea placeholder="Paste suspicious message here..." value={scamText} onChange={e=>setScamText(e.target.value)} rows={4} style={{...inp,resize:"vertical",marginBottom:12,lineHeight:1.6}}/>
          <button onClick={doCheckScam} style={btn("#f87171","#fff")} disabled={scamLoading}>{scamLoading?"🔍 Analyzing...":"🔍 Check for Scam"}</button>
        </div>
        {scamResult&&(
          <div style={{...card,background:`${rc(scamResult.probability)}08`,border:`1px solid ${rc(scamResult.probability)}28`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:14,fontWeight:700,color:T.text}}>Analysis Result</div>
              <span style={{fontSize:10,fontWeight:700,padding:"4px 12px",borderRadius:20,background:`${rc(scamResult.probability)}18`,color:rc(scamResult.probability),border:`1px solid ${rc(scamResult.probability)}33`,textTransform:"uppercase",letterSpacing:1}}>{scamResult.level} Risk</span>
            </div>
            <div style={{textAlign:"center",marginBottom:14}}><div style={{fontSize:48,fontWeight:900,color:rc(scamResult.probability)}}>{scamResult.probability}%</div><div style={{fontSize:11,color:T.muted}}>scam probability</div></div>
            <div style={{height:8,background:dark?"#1f1c2e":"#e8e4f5",borderRadius:10,overflow:"hidden",marginBottom:12}}><div style={{height:"100%",width:`${scamResult.probability}%`,background:rc(scamResult.probability),borderRadius:10,transition:"width 0.8s ease"}}/></div>
            <div style={{fontSize:12,color:T.text,lineHeight:1.7,marginBottom:scamResult.flags?.length?"10px":"0"}}>{scamResult.reason}</div>
            {scamResult.flags?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6}}>{scamResult.flags.map((f,i)=><span key={i} style={{fontSize:11,padding:"2px 8px",background:T.cardHov,borderRadius:20,color:T.sub}}>⚑ {f}</span>)}</div>}
          </div>
        )}
        {/* Link checker */}
        <div style={card}>
          <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:3}}>🔗 Link Safety Scanner</div>
          <div style={{fontSize:11,color:T.muted,marginBottom:14}}>Check if a URL is safe before clicking</div>
          <input placeholder="Paste URL here (e.g. http://...)" value={linkText} onChange={e=>setLinkText(e.target.value)} style={{...inp,marginBottom:12}}/>
          <button onClick={doCheckLink} style={btn("#fb923c","#fff")} disabled={linkLoading}>{linkLoading?"🔍 Scanning...":"🔗 Scan Link"}</button>
        </div>
        {linkResult&&(
          <div style={{...card,background:`${rc(linkResult.risk)}08`,border:`1px solid ${rc(linkResult.risk)}28`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:14,fontWeight:700,color:T.text}}>Link Safety Result</div>
              <span style={{fontSize:10,fontWeight:700,padding:"4px 12px",borderRadius:20,background:`${rc(linkResult.risk)}18`,color:rc(linkResult.risk),border:`1px solid ${rc(linkResult.risk)}33`,textTransform:"uppercase",letterSpacing:1}}>{linkResult.level}</span>
            </div>
            <div style={{textAlign:"center",marginBottom:10}}><div style={{fontSize:40,fontWeight:900,color:rc(linkResult.risk)}}>{linkResult.risk}%</div><div style={{fontSize:11,color:T.muted}}>risk score</div></div>
            <div style={{fontSize:12,color:T.text,lineHeight:1.7}}>{linkResult.reason}</div>
          </div>
        )}
        {/* Scam quiz */}
        <div style={{...card,background:dark?"rgba(251,191,36,0.05)":"rgba(217,119,6,0.03)",border:`1px solid ${dark?"#fbbf2418":"#d9770610"}`}}>
          <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:3}}>🎓 Scam Awareness Quiz</div>
          <div style={{fontSize:11,color:T.muted,marginBottom:14}}>Can you spot a scam? Test your skills and earn XP!</div>
          {!quizActive&&!quizDone&&<button onClick={startQuiz} style={btn("#fbbf24","#0d0c13")}>🎮 Start Quiz (+50–100 XP)</button>}
          {quizActive&&!quizDone&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.muted,marginBottom:10}}>
                <span>Question {quizIdx+1}/{QUIZ_QUESTIONS.length}</span>
                <span style={{color:"#4ade80"}}>Score: {quizScore}</span>
              </div>
              <div style={{background:T.cardHov,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px",fontSize:13,color:T.text,lineHeight:1.7,marginBottom:14,fontStyle:"italic"}}>"{QUIZ_QUESTIONS[quizIdx].msg}"</div>
              {!quizAnswered?(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <button onClick={()=>answerQuiz("SCAM")} style={btn("#f87171","#fff")}>🚨 SCAM</button>
                  <button onClick={()=>answerQuiz("SAFE")} style={btn("#4ade80","#0d0c13")}>✅ SAFE</button>
                </div>
              ):(
                <div>
                  <div style={{background:quizAnswered.correct?"rgba(74,222,128,0.1)":"rgba(248,113,113,0.1)",border:`1px solid ${quizAnswered.correct?"rgba(74,222,128,0.3)":"rgba(248,113,113,0.3)"}`,borderRadius:12,padding:"12px 14px",marginBottom:10}}>
                    <div style={{fontSize:14,fontWeight:700,color:quizAnswered.correct?"#4ade80":"#f87171",marginBottom:4}}>{quizAnswered.correct?"✅ Correct!":"❌ Incorrect"} — This is {QUIZ_QUESTIONS[quizIdx].label}</div>
                    <div style={{fontSize:12,color:T.text,lineHeight:1.6}}>{quizAnswered.reason}</div>
                  </div>
                  <button onClick={nextQuiz} style={btn(acc,dark?"#0d0c13":"#fff")}>{quizIdx>=QUIZ_QUESTIONS.length-1?"🏁 Finish Quiz":"➡️ Next Question"}</button>
                </div>
              )}
            </div>
          )}
          {quizDone&&(
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:8}}>{quizScore===QUIZ_QUESTIONS.length?"🏆":quizScore>=3?"🎉":"💪"}</div>
              <div style={{fontSize:22,fontWeight:800,color:acc,marginBottom:4}}>{quizScore}/{QUIZ_QUESTIONS.length} correct</div>
              <div style={{fontSize:13,color:T.muted,marginBottom:14}}>{quizScore===QUIZ_QUESTIONS.length?"Perfect score! You're a scam detection pro 🎓":"Good effort! Keep practicing to spot more scams"}</div>
              <button onClick={startQuiz} style={btn(acc,dark?"#0d0c13":"#fff")}>🔄 Try Again</button>
            </div>
          )}
        </div>
      </div>
    );

    // QUESTS
    if(tab==="quests") return (
      <div>
        <div style={{...card,background:dark?"rgba(251,146,60,0.06)":"rgba(234,88,12,0.04)",border:`1px solid ${dark?"#fb923c22":"#ea580c15"}`}}>
          <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:3}}>⚡ Today's Quest</div>
          <div style={{fontSize:11,color:T.muted,marginBottom:14}}>Complete daily quests to earn XP and evolve Mochi!</div>
          <div style={{display:"flex",alignItems:"center",gap:14,padding:"16px",background:T.cardHov,borderRadius:14,border:`1px solid ${T.border}`,marginBottom:14}}>
            <div style={{fontSize:36}}>{todayChallenge.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,color:T.text}}>{todayChallenge.text}</div>
              <div style={{fontSize:12,color:"#fb923c",fontWeight:600,marginTop:3}}>+{todayChallenge.xp} XP reward</div>
            </div>
            {challengeDone&&<span style={{fontSize:24}}>✅</span>}
          </div>
          {challengeDone?(
            <div style={{textAlign:"center",padding:"10px",background:"rgba(74,222,128,0.08)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:12,fontSize:13,color:"#4ade80",fontWeight:600}}>Quest completed today! Come back tomorrow 🌟</div>
          ):(
            <button onClick={completeChallenge} style={btn("#fb923c","#fff")}>✅ Mark as Complete (+{todayChallenge.xp} XP)</button>
          )}
        </div>
        {/* Challenge history */}
        <div style={card}>
          <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:14}}>📊 Your Progress</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
            {[{l:"Quests Done",v:challenges,c:"#fb923c",icon:"🎮"},{l:"XP from Quests",v:`${challenges*todayChallenge.xp}+`,c:dark?"#a78bfa":"#7c3aed",icon:"⭐"},{l:"Current Streak",v:`${streak}d`,c:"#4ade80",icon:"🔥"}].map(s=>(
              <div key={s.l} style={{background:T.cardHov,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 10px",textAlign:"center"}}>
                <div style={{fontSize:20,marginBottom:4}}>{s.icon}</div>
                <div style={{fontSize:18,fontWeight:800,color:s.c}}>{s.v}</div>
                <div style={{fontSize:10,color:T.muted,marginTop:2}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Upcoming quests preview */}
        <div style={card}>
          <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:14}}>📅 Challenge Pool</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {CHALLENGE_POOL.map((c,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:T.cardHov,borderRadius:12,border:`1px solid ${T.border}`,opacity:c.text===todayChallenge.text?1:0.5}}>
                <span style={{fontSize:18}}>{c.icon}</span>
                <span style={{flex:1,fontSize:12,color:T.text}}>{c.text}</span>
                <span style={{fontSize:11,color:"#fb923c",fontWeight:600}}>+{c.xp}xp</span>
                {c.text===todayChallenge.text&&<span style={{fontSize:10,color:acc,fontWeight:700,textTransform:"uppercase"}}>Today</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );

    // HISTORY
    if(tab==="history") return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div><div style={{fontSize:15,fontWeight:700,color:T.text}}>Transaction History</div><div style={{fontSize:11,color:T.muted}}>{expenses.length} records · cloud synced ☁</div></div>
          <div style={{fontSize:18,fontWeight:900,color:"#f87171"}}>{rm(totalSpend)}</div>
        </div>
        {expenses.length===0?(
          <div style={{...card,textAlign:"center",padding:"50px 20px"}}><div style={{fontSize:42,marginBottom:10}}>📭</div><div style={{color:T.muted,fontSize:13}}>No expenses yet</div></div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:bp.isDesktop?"repeat(2,1fr)":"1fr",gap:10}}>
            {expenses.map(e=>(
              <div key={e.id} style={{...card,padding:"13px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:0}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:40,height:40,borderRadius:12,background:T.cardHov,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{CAT_ICON[e.category]||"📦"}</div>
                  <div><div style={{fontSize:13,fontWeight:600,color:T.text}}>{e.category}</div><div style={{fontSize:11,color:T.muted}}>{e.note||"—"}</div><div style={{fontSize:10,color:T.muted}}>{e.date}</div></div>
                </div>
                <div style={{fontSize:15,fontWeight:800,color:"#f87171"}}>{rm(e.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    // PROFILE
    if(tab==="profile") return (
      <div>
        {/* User info */}
        <div style={{...card,background:dark?"rgba(124,58,237,0.06)":"rgba(124,58,237,0.04)",border:`1px solid ${dark?"#a78bfa22":"#7c3aed15"}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:52,height:52,borderRadius:16,background:dark?"#a78bfa":"#7c3aed",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{curLv.emoji}</div>
              <div>
                <div style={{fontSize:16,fontWeight:700,color:T.text}}>{user.displayName||user.email?.split("@")[0]||"Trainer"}</div>
                <div style={{fontSize:11,color:T.muted}}>{user.email}</div>
                <div style={{fontSize:11,color:dark?"#a78bfa":"#7c3aed",fontWeight:600}}>{curLv.name} · {curLv.title}</div>
              </div>
            </div>
            <button onClick={onLogout} style={{...smBtn(dark?"#1f1c2e":"#f4f2fb",T.sub),border:`1px solid ${T.border}`}}>🚪 Logout</button>
          </div>
        </div>
        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
          {[{l:"Total XP",v:totalXP,c:dark?"#a78bfa":"#7c3aed",icon:"⭐"},{l:"Achievements",v:`${achList.length}/${ACHIEVEMENTS.length}`,c:"#fbbf24",icon:"🏅"},{l:"Scams Blocked",v:scams,c:"#4ade80",icon:"🛡️"}].map(s=>(
            <div key={s.l} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 10px",textAlign:"center"}}>
              <div style={{fontSize:20,marginBottom:4}}>{s.icon}</div>
              <div style={{fontSize:18,fontWeight:800,color:s.c}}>{s.v}</div>
              <div style={{fontSize:10,color:T.muted,marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>
        {/* AI tips */}
        <div style={card}>
          <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:3}}>💡 AI Financial Tips</div>
          <div style={{fontSize:11,color:T.muted,marginBottom:12}}>Personalised advice based on your spending</div>
          <button onClick={genTips} style={btn(acc,dark?"#0d0c13":"#fff")} disabled={tipLoading}>{tipLoading?"🤔 Generating...":"✨ Get My Tips"}</button>
          {aiTip&&<div style={{marginTop:12,fontSize:12,color:T.text,lineHeight:1.9,whiteSpace:"pre-wrap",padding:"10px 12px",background:T.inp,borderRadius:10}}>{aiTip}</div>}
        </div>
        {/* Achievements */}
        <div style={card}>
          <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:14}}>🏅 Achievements ({achList.length}/{ACHIEVEMENTS.length})</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
            {ACHIEVEMENTS.map(a=>{ const earned=achList.includes(a.id); return (
              <div key={a.id} style={{padding:"12px",background:earned?pet.dim:T.cardHov,border:`1px solid ${earned?acc+"33":T.border}`,borderRadius:14,textAlign:"center",opacity:earned?1:0.4,transition:"all 0.3s"}}>
                <div style={{fontSize:24,marginBottom:4}}>{a.icon}</div>
                <div style={{fontSize:11,fontWeight:700,color:earned?acc:T.text}}>{a.title}</div>
                <div style={{fontSize:9,color:T.muted,marginTop:2}}>{a.desc}</div>
              </div>
            ); })}
          </div>
        </div>
        {/* Business model — impresses judges */}
        <div style={{...card,background:dark?"rgba(74,222,128,0.04)":"rgba(22,163,74,0.03)",border:"1px solid rgba(74,222,128,0.15)"}}>
          <div style={{fontSize:14,fontWeight:700,color:"#4ade80",marginBottom:14}}>📈 Business Model</div>
          <div style={{display:"grid",gridTemplateColumns:bp.isDesktop?"repeat(3,1fr)":"1fr",gap:10}}>
            {[{icon:"💎",title:"Freemium",desc:"Core features free. Premium: RM4.99/month for advanced AI coaching and unlimited goals"},{icon:"🏦",title:"Bank Partnerships",desc:"Revenue sharing with banks (CIMB, Maybank) for referrals and co-branded financial products"},{icon:"📊",title:"Data Insights",desc:"Anonymized spending data analytics sold to fintech & retail companies for market research"}].map(b=>(
              <div key={b.title} style={{background:T.cardHov,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px"}}>
                <div style={{fontSize:24,marginBottom:6}}>{b.icon}</div>
                <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:4}}>{b.title}</div>
                <div style={{fontSize:11,color:T.muted,lineHeight:1.6}}>{b.desc}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:14,padding:"12px 14px",background:T.inp,borderRadius:12,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,textAlign:"center"}}>
            {[{l:"Target Users",v:"Malaysian Gen Z"},{ l:"Market Size", v:"RM 2.8B fintech"},{l:"Revenue Y1",v:"RM 150K est."}].map(s=>(
              <div key={s.l}><div style={{fontSize:13,fontWeight:700,color:acc}}>{s.v}</div><div style={{fontSize:10,color:T.muted,marginTop:2}}>{s.l}</div></div>
            ))}
          </div>
        </div>
      </div>
    );
    return null;
  };

  // ─── Page header ───────────────────────────────────────────────────────────
  const curNav = NAV.find(n=>n.id===tab);
  const PageHeader = () => (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,paddingBottom:18,borderBottom:`1px solid ${T.border}`}}>
      <div><div style={{fontSize:22,fontWeight:800,color:T.text}}>{curNav?.icon} {curNav?.label}</div></div>
      <button onClick={()=>setDark(d=>!d)} style={{background:dark?"#1f1c2e":"#ede9f8",border:`1px solid ${T.border}`,borderRadius:20,padding:"6px 14px",cursor:"pointer",fontSize:12,color:T.sub,fontWeight:600}}>{dark?"☀️ Light":"🌙 Dark"}</button>
    </div>
  );

  const statRow = (
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
      {[{l:"Spent",v:rm(totalSpend),c:totalSpend>150?"#f87171":T.text},{l:"Saved",v:rm(savings),c:"#4ade80"},{l:"Streak",v:`${streak}d 🔥`,c:"#fb923c"}].map(s=>(
        <div key={s.l} style={{background:T.cardHov,border:`1px solid ${T.border}`,borderRadius:14,padding:"12px 8px",textAlign:"center"}}>
          <div style={{fontSize:9,color:T.muted,marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>{s.l}</div>
          <div style={{fontSize:14,fontWeight:800,color:s.c}}>{s.v}</div>
        </div>
      ))}
    </div>
  );

  const sideNav = (
    <nav style={{display:"flex",flexDirection:"column",gap:2,marginTop:4}}>
      {NAV.map(n=>(
        <button key={n.id} onClick={()=>setTab(n.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:12,cursor:"pointer",textAlign:"left",background:tab===n.id?pet.dim:"transparent",border:`1px solid ${tab===n.id?acc+"22":"transparent"}`,color:tab===n.id?acc:T.sub,fontWeight:tab===n.id?700:400,fontSize:13,transition:"all 0.18s"}}>
          <span style={{fontSize:16}}>{n.icon}</span><span>{n.label}</span>
        </button>
      ))}
    </nav>
  );

  const bottomNav = (
    <nav style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:dark?"rgba(19,17,28,0.97)":"rgba(255,255,255,0.97)",backdropFilter:"blur(16px)",borderTop:`1px solid ${T.border}`,display:"flex",padding:"6px 0 env(safe-area-inset-bottom,10px)",overflowX:"auto"}}>
      {NAV.map(n=>(
        <button key={n.id} onClick={()=>setTab(n.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",cursor:"pointer",padding:"5px 4px",minWidth:0}}>
          <span style={{fontSize:16,opacity:tab===n.id?1:0.3,transition:"all 0.2s",transform:tab===n.id?"scale(1.2)":"scale(1)"}}>{n.icon}</span>
          <span style={{fontSize:7,color:tab===n.id?acc:T.muted,fontWeight:tab===n.id?700:400,whiteSpace:"nowrap"}}>{n.label}</span>
        </button>
      ))}
    </nav>
  );

  const styles = { minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'Segoe UI',system-ui,sans-serif", transition:"background 0.3s" };

  // Desktop
  if(bp.isDesktop) return (
    <div style={{...styles,display:"grid",gridTemplateColumns:"270px 1fr"}}>
      <aside style={{background:T.sb,borderRight:`1px solid ${T.border}`,padding:"20px 16px",display:"flex",flexDirection:"column",gap:12,position:"sticky",top:0,height:"100vh",overflowY:"auto",boxSizing:"border-box"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div><div style={{fontSize:18,fontWeight:900,color:acc,letterSpacing:2,textTransform:"uppercase"}}>PocketPet</div><div style={{fontSize:10,color:T.muted}}>AI money companion 🐾</div></div>
          {/* <button onClick={()=>setDark(d=>!d)} style={{background:dark?"#1f1c2e":"#ede9f8",border:`1px solid ${T.border}`,borderRadius:20,padding:"5px 11px",cursor:"pointer",fontSize:11,color:T.sub}}>{dark?"☀️":"🌙"}</button> */}
        </div>
        <PetSection compact/>
        {statRow}
        {sideNav}
      </aside>
      <main style={{padding:"30px 36px",overflowY:"auto",boxSizing:"border-box"}}>
        <PageHeader/><div style={{maxWidth:1200}}>{renderTab()}</div>
      </main>
      <Toast toasts={toasts}/>
      <GlobalCSS dark={dark} T={T}/>
    </div>
  );

  // Tablet
  if(bp.isTablet) return (
    <div style={{...styles,display:"grid",gridTemplateColumns:"230px 1fr"}}>
      <aside style={{background:T.sb,borderRight:`1px solid ${T.border}`,padding:"16px 14px",display:"flex",flexDirection:"column",gap:10,position:"sticky",top:0,height:"100vh",overflowY:"auto",boxSizing:"border-box"}}>
        <div style={{fontSize:15,fontWeight:900,color:acc,letterSpacing:2,textTransform:"uppercase"}}>PocketPet</div>
        <PetSection compact/>
        {statRow}
        {sideNav}
      </aside>
      <main style={{padding:"20px 20px 100px",overflowY:"auto",boxSizing:"border-box"}}>
        {renderTab()}{bottomNav}
      </main>
      <Toast toasts={toasts}/>
      <GlobalCSS dark={dark} T={T}/>
    </div>
  );

  // Mobile
  return (
    <div style={styles}>
      <div style={{padding:"0 14px 90px",maxWidth:480,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 0 12px"}}>
          <div><div style={{fontSize:17,fontWeight:900,color:acc,letterSpacing:2,textTransform:"uppercase"}}>PocketPet</div><div style={{fontSize:10,color:T.muted}}>AI money companion 🐾</div></div>
          {/* <button onClick={()=>setDark(d=>!d)} style={{background:dark?"#1f1c2e":"#ede9f8",border:`1px solid ${T.border}`,borderRadius:20,padding:"5px 11px",cursor:"pointer",fontSize:11,color:T.sub}}>{dark?"☀️":"🌙"}</button> */}
        </div>
        <PetSection/>{statRow}{renderTab()}
      </div>
      {bottomNav}
      <Toast toasts={toasts}/>
      <GlobalCSS dark={dark} T={T}/>
    </div>
  );
}

function GlobalCSS({ dark, T }) {
  return <style>{`
    *{box-sizing:border-box}body{margin:0}
    @keyframes petBounce{0%,100%{transform:translateY(0) rotate(0)}20%{transform:translateY(-18px) rotate(-4deg)}55%{transform:translateY(-8px) rotate(3deg)}}
    @keyframes petFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    @keyframes levelUp{0%{transform:scale(1)}20%{transform:scale(1.5) rotate(-12deg)}50%{transform:scale(1.3) rotate(8deg)}80%{transform:scale(1.1)}100%{transform:scale(1)}}
    @keyframes slideIn{from{transform:translateX(120px);opacity:0}to{transform:translateX(0);opacity:1}}
    input::placeholder,textarea::placeholder{color:${T.muted}}
    input:focus,textarea:focus,select:focus{border-color:#7c6fc4!important;outline:none}
    button:active{opacity:0.82;transform:scale(0.97)}
    select option{background:${T.inp};color:${T.text}}
    ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${dark?"#2a2535":"#d0cce8"};border-radius:4px}
  `}</style>;
}