
window.CUSTOM_LIMITS_ONLY = true;

window.CUSTOM_DRAWN_LIMITS_ONLY=true;

document.querySelectorAll('.nav button').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
  });
});

const wrap = document.querySelector('.table-wrap');
const cueImg = document.querySelector('.cue-real');
const cueHolder = document.querySelector('.cue-holder');
const aimLine = document.querySelector('.aim-line');
const aimDot = document.querySelector('.aim-dot');
const impactLine = document.querySelector('#impactLine');
const statusEl = document.querySelector('.game-status');
const playBtn = document.querySelector('#playBtn');
const resetBtn = document.querySelector('.reset-game');
const undoShotBtn = document.querySelector('#undoShotBtn');
const placeCueBtn = document.querySelector('#placeCueBtn');
const powerBar = document.querySelector('.powerbar');
const powerFill = document.querySelector('#powerFill');
const powerValue = document.querySelector('#powerValue');
const ballEls = [...document.querySelectorAll('.ball')];
const ballLayer = document.querySelector('.ball-layer');

let power = .65;
let aiming = true;
let moving = false;
let lastTime = 0;
let pointer = {x:0,y:0};
let shotAngle = 0;
let whiteGuideActive = false;
let firstShotTarget = null;
let firstShotExitNX = 0;
let firstShotExitNY = 0;
let firstShotSpeed = 0;
let firstTargetGuideActive = false;
let wrongContactPreviewBall = null;
function clearWrongContactPreview(){
  wrongContactPreviewBall=null;
  aimDot.classList.remove('warning-contact');
}
function previewWrongContact(ball){
  clearWrongContactPreview();
  if(!ball || ball===balls[0] || ball.pocketed) return;
  wrongContactPreviewBall=ball;
  // La bola rival permanece siempre visible. Solo ocultamos temporalmente
  // la línea blanca de salida/impacto mientras se apunta al contacto incorrecto.
  impactLine.style.display='none';
  const q=px(ball);
  const size=Math.max(34,(ball.el?.getBoundingClientRect().width||36)+10);
  aimDot.classList.add('warning-contact');
  aimDot.style.display='block';
  aimDot.style.width=size+'px';
  aimDot.style.height=size+'px';
  aimDot.style.left=q.x+'px';
  aimDot.style.top=q.y+'px';
}
let physicsDebugEnabled=false;
let lastBandDebug=null;
const physicsDebugBtn=document.querySelector('#physicsDebugBtn');
const physicsDebugPanel=document.querySelector('#physicsDebugPanel');
const physicsDebugText=document.querySelector('#physicsDebugText');
const physicsDebugCanvas=document.querySelector('#physicsDebugCanvas');
const physicsDebugCtx=physicsDebugCanvas.getContext('2d');
function resizePhysicsDebug(){ const d=dimensions(); const r=window.devicePixelRatio||1; physicsDebugCanvas.width=Math.round(d.w*r); physicsDebugCanvas.height=Math.round(d.h*r); physicsDebugCtx.setTransform(r,0,0,r,0,0); }
function drawPhysicsDebug(){
  if(!physicsDebugEnabled)return; const d=dimensions(); resizePhysicsDebug(); physicsDebugCtx.clearRect(0,0,d.w,d.h); if(!lastBandDebug)return;
  const q=lastBandDebug; const scale=Math.min(d.w,d.h)*.13;
  physicsDebugCtx.lineWidth=3; physicsDebugCtx.setLineDash([8,5]);
  physicsDebugCtx.strokeStyle='#00e5ff'; physicsDebugCtx.beginPath(); physicsDebugCtx.moveTo(q.x-q.inx*scale,q.y-q.iny*scale); physicsDebugCtx.lineTo(q.x,q.y); physicsDebugCtx.stroke();
  physicsDebugCtx.strokeStyle='#ff3b3b'; physicsDebugCtx.beginPath(); physicsDebugCtx.moveTo(q.x,q.y); physicsDebugCtx.lineTo(q.x+q.outx*scale,q.y+q.outy*scale); physicsDebugCtx.stroke();
  physicsDebugCtx.setLineDash([]); physicsDebugCtx.fillStyle='#fff'; physicsDebugCtx.beginPath(); physicsDebugCtx.arc(q.x,q.y,5,0,Math.PI*2); physicsDebugCtx.fill();
}
physicsDebugBtn.style.display='block'; physicsDebugBtn.addEventListener('click',()=>{physicsDebugEnabled=!physicsDebugEnabled; physicsDebugBtn.classList.toggle('active',physicsDebugEnabled); physicsDebugPanel.style.display=physicsDebugEnabled?'block':'none'; physicsDebugCanvas.style.display=physicsDebugEnabled?'block':'none'; drawPhysicsDebug();});
window.addEventListener('resize',drawPhysicsDebug);


const balls = [];
const radiusRatio = .01925; // visual/game radius relative to table width
const friction = 0.9905;
let whitePhysicsSettings = JSON.parse(localStorage.getItem('whitePhysicsSettings_v1') || 'null') || {maxRollTime:30, normalFriction:0.9955, finalStartSpeed:60, finalBrakeTime:2.0, stopSpeed:7};
const MAX_ROLL_TIME = 30.0;
const wallBounce = 0.72;
const whiteWallBounce = 0.82;
const ballBounce = 0.82;
const sleepSpeed = 5.0;
const collisionSlop = 0.35;
const DEFAULT_LIMITS={left:.0345,right:.9655,top:.0927,bottom:.9073};
const DEFAULT_POCKETS=[[.035,.050],[.502,.048],[.961,.052],[.035,.943],[.502,.943],[.962,.943]];
let editableLimits=JSON.parse(localStorage.getItem('billiardsLimits_1390x766')||'null') || {...DEFAULT_LIMITS};
let editablePockets=JSON.parse(localStorage.getItem('billiardsPockets_1390x766')||'null') || DEFAULT_POCKETS.map(p=>p.slice());
let editablePocketRadius=parseFloat(localStorage.getItem('billiardsPocketRadius_1390x766'));
let customLimitSegments=JSON.parse(localStorage.getItem('billiardsCustomLimitSegments_1390x766')||localStorage.getItem('billiardsCustomLimitSegments')||'null') || [];
// Los puntos dibujados antiguos pueden estar guardados en píxeles. Convertirlos una sola vez al sistema normalizado de la mesa 1385x766.
customLimitSegments=customLimitSegments.map(seg=>{
  if(!Array.isArray(seg)||seg.length<2) return seg;
  return seg.slice(0,2).map(pt=>{
    if(!Array.isArray(pt)||pt.length<2) return pt;
    let x=Number(pt[0]), y=Number(pt[1]);
    if(Number.isFinite(x)&&Number.isFinite(y) && (Math.abs(x)>1 || Math.abs(y)>1)){ x/=1385; y/=766; }
    return [x,y];
  });
});
if(customLimitSegments.length) localStorage.setItem('billiardsCustomLimitSegments_1390x766',JSON.stringify(customLimitSegments));
let customDrawMode=false;
let customDrawStart=null;
if(!Number.isFinite(editablePocketRadius)) editablePocketRadius=.030;
const pocketRadiusRatio = .030;
const pocketAnimDuration = 520;
const pocketingBalls = new Set();
let lastShotSnapshot = null;
let placingCue = false;
let whitePlacementAvailable = false;
let pendingWhiteRespawn = null;
let shotHadCueCollision = false;
let shotCueHitTargets = new Set();
let shotPocketedObjectBalls = new Set();
let shotHadCueCushionContact = false;
let shotHadAnyCushionContact = false;
let shotHadObjectCushionContact = false;
let shotObjectCushionBalls = new Set();
let shotRuleRespawnPending = false;
let shotStartWhitePosition = null;
let pendingWhiteRespawnReason = null;
let breakShotCompleted=false;
let groupsAssigned=false;
let currentShotIsBreak=false;
let shotFirstPocketedColor=null;
let shotWhitePocketed=false;
let shotWrongFirstContact=false;
let shotFirstCueContactColor=null;
  clearWrongContactPreview();
let totalShotsTaken=0;

// Estado de fin de partida. Se activa SOLO cuando la bola negra real (8)
// entra en una tronera y el resultado se presenta cuando todas las bolas
// terminan de moverse.
let gameOverPending=false;
let gameOverWinner=0;
let gameOverBlackPocketed=false;
let shotOwnRemainingAtStart=0;

function getActivePlayerSafe(){
  return (typeof window.__getActiveTurnPlayer==='function') ? window.__getActiveTurnPlayer() : (window.__lastShotPlayer || 1);
}

function calculateOwnRemaining(player){
  const groups=window.__playerBallGroups;
  if(!groups) return 0;
  const ownColor=player===1?groups.player1:groups.player2;
  if(ownColor!=='red' && ownColor!=='yellow') return 0;
  let count=0;
  for(const b of balls){
    if(b!==balls[0] && !b.pocketed && b.color===ownColor) count++;
  }
  return count;
}

function showGameOverMenu(){
  if(!gameOverPending || gameOverWinner<1) return;
  const overlay=document.getElementById('gameOverOverlay');
  const winnerEl=document.getElementById('gameOverWinner');
  if(!overlay || !winnerEl) return;
  winnerEl.textContent=`JUGADOR ${gameOverWinner} GANA`;
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden','false');
  document.body.style.cursor='default';
}

function finishGameAfterBallsStop(){
  if(!gameOverPending || !gameOverBlackPocketed) return false;
  const stillMoving=balls.some(b=>!b.pocketed && !b.sleeping && Math.hypot(b.vx,b.vy)>0.1);
  if(stillMoving || pocketingBalls.size>0) return false;
  moving=false; aiming=false; placingCue=false; whitePlacementAvailable=false;
  pointerHeld=false; placementHeld=false;
  if(placeCueBtn) placeCueBtn.classList.remove('active');
  if(aimLine) aimLine.style.display='none';
  if(aimDot) aimDot.style.display='none';
  if(impactLine) impactLine.style.display='none';
  const ac=document.querySelector('#aimCue'); if(ac) ac.style.visibility='hidden';
  if(typeof window.__pauseTurnTimer==='function') window.__pauseTurnTimer();
  if(typeof window.__cancelTurnTimerForGameOver==='function') window.__cancelTurnTimerForGameOver();
  showGameOverMenu();
  return true;
}


function makeBall(el, x, y, type='object', number=null){
  // Efectos ópticos sutiles: el PNG conserva su aspecto realista y, cuando
  // la bola rueda, un brillo especular y una estela luminosa siguen su dirección.
  const shine=document.createElement('div');
  shine.className='ball-motion-shine';
  const ring=document.createElement('div');
  ring.className='ball-roll-ring';
  const streak=document.createElement('div');
  streak.className='ball-motion-streak';
  ballLayer.appendChild(streak);
  ballLayer.appendChild(shine);
  ballLayer.appendChild(ring);
  const src=String(el.getAttribute('src')||'');
  const color=src.includes('bola_roja')?'red':(src.includes('bola_amarilla')?'yellow':(src.includes('bola_negra')?'black':'white'));
  const b={el,x,y,vx:0,vy:0,type,number:(color==='black'?8:number),color,pocketed:false,sleeping:false,shine,streak,ring,rollAngle:0};
  balls.push(b);
  return b;
}

function setupBalls(){
  gameOverPending=false; gameOverWinner=0; gameOverBlackPocketed=false; shotOwnRemainingAtStart=0;
  const overlay=document.getElementById('gameOverOverlay'); if(overlay){overlay.classList.remove('show'); overlay.setAttribute('aria-hidden','true');}
  balls.length=0;
  breakShotCompleted=false;
  groupsAssigned=false;
  currentShotIsBreak=false;
  shotFirstPocketedColor=null;
  window.__playerBallGroups=null;
  totalShotsTaken=0;
  if(typeof hideScoreboardGroups==='function') hideScoreboardGroups();
  pendingWhiteRespawn=null;
  pendingWhiteRespawnReason=null;
  whitePlacementAvailable=false;
  shotStartWhitePosition=null;
  shotRuleRespawnPending=false;
  shotStartWhitePosition=null;
  pendingWhiteRespawnReason=null;
  shotHadCueCollision=false;
  shotCueHitTargets.clear();
  shotPocketedObjectBalls.clear();
  // Cada tiro tiene su propia primera bola embocada. Esto evita que una bola
  // del saque pueda contaminar la elección de grupos del tiro siguiente.
  shotFirstPocketedColor=null;
  shotWhitePocketed=false;
  shotWrongFirstContact=false;
  shotFirstCueContactColor=null;
  shotHadCueCushionContact=false;
  shotHadAnyCushionContact=false;
  shotHadObjectCushionContact=false;
  shotObjectCushionBalls.clear();
  // Bola blanca: posición calibrada según la referencia visual del usuario.
  ballEls.forEach(e=>e.style.display='');
  const {w,h}=dimensions();
  // Colocación de rack por geometría real: cada centro queda exactamente a
  // un diámetro de la bola vecina. Así se tocan entre sí sin montarse.
  const diameter=ballRadius()*2;
  // Un ajuste mínimo para que el rack quede un poco más compacto,
  // manteniendo la formación triangular y evitando un solapamiento visible.
  const rackTight=0.94;
  const rowStepX=(Math.sqrt(3)/2)*diameter*rackTight;
  const rowStepY=diameter*rackTight;
  const baseX=.728*w;
  const baseY=.5000*h;
  const positions=[[.2681*w,.505*h,'cue',0]];
  let n=1;
  for(let row=0;row<5;row++){
    const count=row+1;
    const x=baseX+row*rowStepX;
    const firstY=baseY-((count-1)*rowStepY/2);
    for(let j=0;j<count;j++) {
      positions.push([x,firstY+j*rowStepY,'object',n++]);
    }
  }
  positions.forEach((p,i)=>makeBall(ballEls[i],p[0]/w,p[1]/h,p[2],p[3]));
  render();
}

function dimensions(){
  return {w:wrap.clientWidth,h:wrap.clientHeight};
}

function ballRadius(){
  const sample = ballEls.find(e => getComputedStyle(e).display !== 'none');
  const actual = sample ? sample.getBoundingClientRect().width / 2 : 0;
  return actual > 0 ? actual : Math.max(13, dimensions().w*radiusRatio);
}

// Las nuevas bolas están recortadas al contorno de la esfera, sin márgenes
// transparentes. Por eso el radio físico coincide con el radio visual.
function collisionBallRadius(){
  return ballRadius();
}

function tableBounds(){
  const {w,h}=dimensions();
  // Exact inner edge of the blue table playing area / cushion contact line.
  // The guide circle is inset by its radius so its circumference touches this edge.
  return {left:editableLimits.left*w,right:editableLimits.right*w,top:editableLimits.top*h,bottom:editableLimits.bottom*h};
}

function px(b){
  const {w,h}=dimensions();
  return {x:b.x*w,y:b.y*h};
}

function setBallPos(b){
  const {w,h}=dimensions();
  const left=(b.x*100)+'%';
  const top=(b.y*100)+'%';
  b.el.style.left=left;
  b.el.style.top=top;
  b.el.style.transform='translate(-50%,-50%)';

  // Brillo de movimiento: cuanto mayor es la velocidad, más marcado es el
  // destello y más visible la pequeña estela. La dirección del brillo se
  // desplaza en sentido contrario al movimiento para dar sensación de rodadura.
  if(b.shine && b.streak && b.ring){
    const speed=Math.hypot(b.vx,b.vy);
    const maxSpeed=1100;
    const q=Math.max(0,Math.min(1,speed/maxSpeed));
    b.rollAngle += speed * 0.0009;
    if(q>0.035 && !b.pocketed){
      const ang=Math.atan2(b.vy,b.vx);
      const backX=-Math.cos(ang), backY=-Math.sin(ang);
      const offset=2+q*7;
      const sx=50+Math.cos(b.rollAngle)*18+backX*offset, sy=50+Math.sin(b.rollAngle)*18+backY*offset;
      b.shine.style.left=left; b.shine.style.top=top;
      b.shine.style.opacity=String(.28+q*.70);
      b.shine.style.transform=`translate(-50%,-50%) rotate(${b.rollAngle}rad) scale(${1+q*.06})`;
      b.shine.style.background=`radial-gradient(circle at ${sx}% ${sy}%,rgba(255,255,255,.92) 0 5%,rgba(255,255,255,.48) 7%,rgba(255,255,255,.12) 19%,transparent 43%)`;
      b.streak.style.left=(b.x*100)+'%'; b.streak.style.top=(b.y*100)+'%';
      b.streak.style.opacity=String(q*.42);
      b.streak.style.transform=`translate(-50%,-50%) rotate(${ang}rad) scaleX(${1.0+q*2.4})`;
      b.ring.style.left=left; b.ring.style.top=top;
      b.ring.style.opacity=String(.10+q*.58);
      b.ring.style.transform=`translate(-50%,-50%) rotate(${b.rollAngle*1.7 + ang*.35}rad) scale(${.94+q*.04})`;
      b.ring.style.filter=`blur(${.22+q*.15}px)`;
      const shadowX=(b.x*100)+backX*(2+q*3.5), shadowY=(b.y*100)+backY*(2+q*2.0);
    }else{
      b.shine.style.opacity='0';
      b.streak.style.opacity='0';
      b.ring.style.opacity='0';
    }
  }
}

function setCuePlacementFromPointer(){
  const cue=balls[0];
  if(!cue || moving || !placingCue) return;
  const {w,h}=dimensions();
  const r=ballRadius();
  const B=tableBounds();
  const minX=B.left+r, maxX=B.right-r, minY=B.top+r, maxY=B.bottom-r;
  let x=Math.max(minX,Math.min(maxX,pointer.x));
  let y=Math.max(minY,Math.min(maxY,pointer.y));
  // No permitir que la blanca quede dentro de otra bola.
  for(let i=1;i<balls.length;i++){
    const b=balls[i]; if(b.pocketed) continue;
    const q=px(b); const br=(b.el.getBoundingClientRect().width||r*2)/2;
    const dx=x-q.x,dy=y-q.y,d=Math.hypot(dx,dy),minD=r+br+1;
    if(d<minD){
      const nx=d>0?dx/d:1, ny=d>0?dy/d:0;
      x=q.x+nx*minD; y=q.y+ny*minD;
      x=Math.max(minX,Math.min(maxX,x)); y=Math.max(minY,Math.min(maxY,y));
    }
  }
  // Respetar TODOS los límites dibujados, conservando el lado de la mesa
  // donde estaba la blanca cuando empezó el arrastre. Esto evita que pueda
  // cruzar la banda izquierda o la inferior aunque el puntero esté fuera.
  if(customLimitSegments.length){
    if(!placementSideSigns || placementSideSigns.length!==customLimitSegments.length) capturePlacementSides(cue);
    const limitGap=Math.max(0.35,r*1.02);
    for(let pass=0; pass<3; pass++){
      let changed=false;
      customLimitSegments.forEach((seg,idx)=>{
        if(!Array.isArray(seg)||seg.length<2) return;
        const ax=seg[0][0]*w, ay=seg[0][1]*h;
        const bx=seg[1][0]*w, by=seg[1][1]*h;
        const sx=bx-ax, sy=by-ay, len=Math.hypot(sx,sy);
        if(len<1e-6) return;
        const tx=sx/len, ty=sy/len;
        const nx=-ty, ny=tx;
        const qx=x-ax, qy=y-ay;
        const along=qx*tx+qy*ty;
        // El límite dibujado solo actúa dentro de su propio tramo.
        // Cerca de la abertura de una tronera, el tramo no debe enganchar
        // la blanca durante la recolocación: la zona de entrada de la tronera
        // es una abertura, no una pared.
        if(along < 0 || along > len) return;
        const pocketOpening = Math.max(pRForPhysics(w), r*1.15);
        for(const [pcx,pcy] of pocketPoints(w,h)){
          const dd=Math.hypot(x-pcx,y-pcy);
          if(dd < pocketOpening + r*0.35) return;
        }
        const side=(placementSideSigns&&placementSideSigns[idx])||1;
        const signed=qx*nx+qy*ny;
        if(signed*side < limitGap){
          x += nx*(limitGap-signed*side)*side;
          y += ny*(limitGap-signed*side)*side;
          changed=true;
        }
      });
      x=Math.max(minX,Math.min(maxX,x));
      y=Math.max(minY,Math.min(maxY,y));
      if(!changed) break;
    }
  }
  cue.x=x/w; cue.y=y/h; cue.vx=cue.vy=0; cue.sleeping=true; cue.pocketed=false;
  cue.el.style.transition='none';
  cue.el.style.display=''; cue.el.style.opacity=''; cue.el.style.zIndex='';
  render();
}

function drawDebugLimits(){
  const svg=document.getElementById('debugLimits');
  if(!svg) return;
  const {w,h}=dimensions();
  const B=tableBounds();
  const r=ballRadius();
  const captureR=pRForPhysics(w);
  const pockets=pocketPoints(w,h);
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  svg.innerHTML='';
  const ns='http://www.w3.org/2000/svg';
  // Límites dibujados manualmente, segmento por segmento.
  customLimitSegments.forEach((seg,i)=>{
    const line=document.createElementNS(ns,'line');
    line.setAttribute('class','custom-limit-line');
    line.setAttribute('x1',seg[0][0]*w); line.setAttribute('y1',seg[0][1]*h);
    line.setAttribute('x2',seg[1][0]*w); line.setAttribute('y2',seg[1][1]*h);
    svg.appendChild(line);
    if(i===0){
      const st=document.createElementNS(ns,'circle'); st.setAttribute('class','custom-limit-start');
      st.setAttribute('cx',seg[0][0]*w); st.setAttribute('cy',seg[0][1]*h); st.setAttribute('r',5); svg.appendChild(st);
    }
    const pt=document.createElementNS(ns,'circle'); pt.setAttribute('class','custom-limit-point');
    pt.setAttribute('cx',seg[1][0]*w); pt.setAttribute('cy',seg[1][1]*h); pt.setAttribute('r',8);
    pt.dataset.type='customEnd'; pt.dataset.index=i; svg.appendChild(pt);
    if(i>0){
      const st2=document.createElementNS(ns,'circle'); st2.setAttribute('class','custom-limit-start');
      st2.setAttribute('cx',seg[0][0]*w); st2.setAttribute('cy',seg[0][1]*h); st2.setAttribute('r',8);
      st2.dataset.type='customStart'; st2.dataset.index=i; svg.appendChild(st2);
    }
  });
  if(customDrawStart){
    const st=document.createElementNS(ns,'circle'); st.setAttribute('class','custom-limit-start');
    st.setAttribute('cx',customDrawStart[0]*w); st.setAttribute('cy',customDrawStart[1]*h); st.setAttribute('r',6); svg.appendChild(st);
  }
  pockets.forEach(([x,y],i)=>{
    const c=document.createElementNS(ns,'circle');
    c.setAttribute('class','pocket-capture'); c.setAttribute('cx',x); c.setAttribute('cy',y); c.setAttribute('r',captureR); svg.appendChild(c);
    const m=document.createElementNS(ns,'circle'); m.setAttribute('class','center-mark'); m.setAttribute('cx',x); m.setAttribute('cy',y); m.setAttribute('r',3); svg.appendChild(m);
    const t=document.createElementNS(ns,'text');
    t.setAttribute('x',x+captureR+8); t.setAttribute('y',y+4); t.textContent=`TRONERA ${i+1}`; svg.appendChild(t);
    const hnd=document.createElementNS(ns,'circle'); hnd.setAttribute('class','limit-handle-pocket'); hnd.setAttribute('cx',x); hnd.setAttribute('cy',y); hnd.setAttribute('r',6); hnd.dataset.type='pocket'; hnd.dataset.index=i; svg.appendChild(hnd);
  });
  syncLimitInputs();
}

function syncLimitInputs(){
  const q=id=>document.getElementById(id); if(!q('limLeft')) return;
  q('limLeft').value=(editableLimits.left*100).toFixed(1); q('limRight').value=(editableLimits.right*100).toFixed(1);
  q('limTop').value=(editableLimits.top*100).toFixed(1); q('limBottom').value=(editableLimits.bottom*100).toFixed(1);
  q('pocketRadiusEdit').value=(editablePocketRadius*100).toFixed(1);
  const i=Math.max(1,Math.min(6,parseInt(q('pocketIndex').value||1,10)))-1; q('pocketX').value=(editablePockets[i][0]*100).toFixed(1); q('pocketY').value=(editablePockets[i][1]*100).toFixed(1);
}
function persistLimits(){ localStorage.setItem('billiardsLimits_1390x766',JSON.stringify(editableLimits)); localStorage.setItem('billiardsPockets_1390x766',JSON.stringify(editablePockets)); localStorage.setItem('billiardsPocketRadius_1390x766',editablePocketRadius); localStorage.setItem('billiardsCustomLimitSegments_1390x766',JSON.stringify(customLimitSegments)); }
function installLimitEditor(){
  const svg=document.getElementById('debugLimits'), wrapEl=document.querySelector('.table-wrap'); if(!svg||!wrapEl) return;
  document.body.classList.add('limit-editor-active'); syncLimitInputs();
  const drawBtn=document.getElementById('drawLimitsBtn'), drawStatus=document.getElementById('drawStatus');
  const finishBtn=document.getElementById('finishDrawBtn'), clearBtn=document.getElementById('clearDrawBtn');
  function updateDrawUI(){
    if(drawBtn){ drawBtn.classList.toggle('active',customDrawMode); drawBtn.textContent=customDrawMode?'✏️ DIBUJANDO…':'✏️ DIBUJAR LÍMITES'; }
    if(drawStatus){
      drawStatus.classList.toggle('active',customDrawMode);
      drawStatus.textContent=customDrawMode
        ? (customDrawStart ? 'Haz clic para crear el siguiente punto. Cada clic cambia la dirección desde el punto anterior.' : 'Haz clic en la mesa para colocar el primer punto.')
        : 'Dibujo apagado. Actívalo y haz clic en la mesa para colocar puntos.';
    }
  }
  if(drawBtn) drawBtn.onclick=()=>{customDrawMode=!customDrawMode; if(!customDrawMode) customDrawStart=null; updateDrawUI(); drawDebugLimits();};
  if(finishBtn) finishBtn.onclick=()=>{customDrawStart=null; updateDrawUI(); drawDebugLimits();};
  if(clearBtn) clearBtn.onclick=()=>{customLimitSegments=[]; customDrawStart=null; persistLimits(); updateDrawUI(); drawDebugLimits();};
  updateDrawUI();
  document.getElementById('editTableBtn').onclick=()=>{document.getElementById('tableControls').style.display='block';document.getElementById('pocketControls').style.display='none';document.getElementById('editTableBtn').classList.add('active');document.getElementById('editPocketsBtn').classList.remove('active');};
  document.getElementById('editPocketsBtn').onclick=()=>{document.getElementById('tableControls').style.display='none';document.getElementById('pocketControls').style.display='block';document.getElementById('editPocketsBtn').classList.add('active');document.getElementById('editTableBtn').classList.remove('active');syncLimitInputs();};
  ['limLeft','limRight','limTop','limBottom'].forEach(id=>document.getElementById(id).onchange=()=>{editableLimits.left=+document.getElementById('limLeft').value/100;editableLimits.right=+document.getElementById('limRight').value/100;editableLimits.top=+document.getElementById('limTop').value/100;editableLimits.bottom=+document.getElementById('limBottom').value/100;drawDebugLimits();});
  document.getElementById('pocketRadiusEdit').onchange=()=>{editablePocketRadius=+document.getElementById('pocketRadiusEdit').value/100;drawDebugLimits();};
  document.getElementById('pocketIndex').onchange=syncLimitInputs;
  ['pocketX','pocketY'].forEach(id=>document.getElementById(id).onchange=()=>{const i=+document.getElementById('pocketIndex').value-1;editablePockets[i][0]=+document.getElementById('pocketX').value/100;editablePockets[i][1]=+document.getElementById('pocketY').value/100;drawDebugLimits();});
  document.getElementById('saveLimits').onclick=()=>{persistLimits();syncLimitInputs();};
  document.getElementById('resetLimits').onclick=()=>{editableLimits={...DEFAULT_LIMITS};editablePockets=DEFAULT_POCKETS.map(p=>p.slice());editablePocketRadius=.030;customLimitSegments=[];customDrawStart=null;persistLimits();syncLimitInputs();updateDrawUI();drawDebugLimits();};
  let drag=null;
  svg.addEventListener('pointerdown',e=>{
    const t=e.target;
    if(customDrawMode && !t.classList.contains('limit-handle') && !t.classList.contains('limit-handle-pocket')){
      const r=svg.getBoundingClientRect();
      const x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
      const y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
      if(customDrawStart) customLimitSegments.push([customDrawStart,[x,y]]);
      customDrawStart=[x,y];
      persistLimits(); updateDrawUI(); drawDebugLimits();
      e.preventDefault(); e.stopPropagation(); return;
    }
    if(!t.classList.contains('limit-handle')&&!t.classList.contains('limit-handle-pocket')
       &&!t.classList.contains('custom-limit-start')&&!t.classList.contains('custom-limit-point')) return;
    drag={type:t.dataset.type,index:+t.dataset.index}; svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove',e=>{ if(customDrawMode || !drag) return; const r=svg.getBoundingClientRect(),x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height)); if(drag.type==='left') editableLimits.left=x; if(drag.type==='right') editableLimits.right=x; if(drag.type==='top') editableLimits.top=y; if(drag.type==='bottom') editableLimits.bottom=y; if(drag.type==='pocket'){editablePockets[drag.index]=[x,y];document.getElementById('pocketIndex').value=drag.index+1;} syncLimitInputs(); drawDebugLimits(); });
  svg.addEventListener('pointerup',()=>{if(drag){persistLimits();} drag=null;}); svg.addEventListener('pointercancel',()=>drag=null);
}function render(){
  balls.forEach(b=>{ if(!b.pocketed) setBallPos(b); });
  drawDebugLimits();
  // Do not continuously recalculate the aiming line.
  // It is updated only during pointer/finger movement while held.
}

function updateAim(forcedAngle=null){
  if(!aiming || moving) {
    clearWrongContactPreview();
    aimLine.style.display='none'; aimDot.style.display='none'; impactLine.style.display='none'; return;
  }
  const cue=balls[0];
  if(!cue || cue.pocketed) return;
  const c=px(cue);
  const dx=pointer.x-c.x, dy=pointer.y-c.y;
  const len=Math.hypot(dx,dy)||1;
  if(typeof forcedAngle === 'number' && Number.isFinite(forcedAngle)){
    shotAngle=forcedAngle;
    lastAimAngle=forcedAngle;
  } else {
    shotAngle=Math.atan2(dy,dx);
    lastAimAngle=shotAngle;
  }
  aimInitialized=true;

  const ux=Math.cos(shotAngle), uy=Math.sin(shotAngle);
  const B=tableBounds();
  const dotSize=aimDot.getBoundingClientRect().width || 36;
  const r=dotSize/2;

  // Encuentra la PRIMERA bola que intercepta el rayo de la blanca usando
  // únicamente la geometría real de las dos esferas. No usamos offsets
  // visuales ni márgenes del PNG.
  let firstTarget=null;
  let firstHit=Infinity;
  for(let i=1;i<balls.length;i++){
    const b=balls[i];
    if(b.pocketed) continue;
    const q=px(b);
    const vx=q.x-c.x, vy=q.y-c.y;
    const along=vx*ux+vy*uy;
    if(along<=0) continue;
    const targetRadius=(b.el.getBoundingClientRect().width || (ballRadius()*2))/2;
    const sumR=ballRadius()+targetRadius;
    const perp=vx*uy-vy*ux;
    const d=Math.abs(perp);
    if(d>sumR) continue;
    const inside=Math.sqrt(Math.max(0,sumR*sumR-d*d));
    const hit=along-inside;
    if(hit>0 && hit<firstHit){ firstHit=hit; firstTarget=b; }
  }

  // Línea de apuntado: blanca -> primera banda dibujada o primera bola real.
  // La banda SÍ puede detener la guía principal (círculo blanco), pero
  // NUNCA debe convertirse en un contacto con una bola. Si una bola está
  // detrás de la banda, se descarta como objetivo de impacto.
  // La guía de la blanca se detiene en el primer contacto con
  // LOS LÍMITES DIBUJADOS por el usuario. No usa DEFAULT_LIMITS.
  const wallCandidates=[];
  const guideDims=dimensions();
  const gw=guideDims.w, gh=guideDims.h;

  for(const seg of customLimitSegments){
    if(!Array.isArray(seg)||seg.length<2) continue;

    const ax=seg[0][0]*gw, ay=seg[0][1]*gh;
    const bx=seg[1][0]*gw, by=seg[1][1]*gh;
    const sx=bx-ax, sy=by-ay;
    const segLen=Math.hypot(sx,sy);
    if(segLen<0.001) continue;

    const tx=sx/segLen, ty=sy/segLen;
    const nx=-ty, ny=tx;
    const denom=ux*nx+uy*ny;
    if(Math.abs(denom)<1e-8) continue;

    const base=(c.x-ax)*nx+(c.y-ay)*ny;

    // La blanca toca la banda cuando su centro está a un radio r
    // de la línea dibujada. Probamos ambos lados y nos quedamos
    // con el primer contacto que esté en el segmento.
    const sides=[r,-r];
    for(const targetSide of sides){
      const t=(targetSide-base)/denom;
      if(t<=0 || !Number.isFinite(t)) continue;

      const hx=c.x+ux*t, hy=c.y+uy*t;
      const along=(hx-ax)*tx+(hy-ay)*ty;
      if(along < -r || along > segLen+r) continue;

      wallCandidates.push(t);
    }
  }

  const positiveWalls=wallCandidates.filter(t=>Number.isFinite(t)&&t>0);
  const firstWallHit=positiveWalls.length ? Math.min(...positiveWalls) : Infinity;

  // Si la banda está antes que la bola, la bola NO es un objetivo válido
  // para la línea de salida. El círculo blanco, sin embargo, permanece en
  // el punto donde termina la guía, que puede ser la propia banda.
  if(firstTarget && firstHit >= firstWallHit){
    firstTarget=null;
    firstHit=Infinity;
  }

  // Aviso visual previo al golpe.
  // 1) ANTES de elegir grupos, la NEGRA siempre es incorrecta para ambos jugadores.
  // 2) Después de elegir grupos, la NEGRA sigue siendo incorrecta mientras el
  //    jugador aún tenga bolas de su color; además, todas las bolas del rival
  //    son incorrectas.
  let previewWrong=false;
  if(firstTarget && typeof window.__getActiveTurnPlayer==='function'){
    const shooter=window.__getActiveTurnPlayer();
    const groups=window.__playerBallGroups;
    const targetColor=firstTarget.color;
    if(targetColor==='black'){
      let blackIsWrong=true;
      if(groupsAssigned && groups){
        const ownColor=(shooter===1 ? groups.player1 : groups.player2);
        const ownRemaining=balls.some(b=>b!==balls[0] && !b.pocketed && b.color===ownColor);
        blackIsWrong=ownRemaining;
      }
      if(blackIsWrong){ previewWrong=true; previewWrongContact(firstTarget); }
    }else if(groupsAssigned && groups && (targetColor==='red'||targetColor==='yellow')){
      const ownColor=(shooter===1 ? groups.player1 : groups.player2);
      if(targetColor!==ownColor){ previewWrong=true; previewWrongContact(firstTarget); }
    }
  }
  if(!previewWrong) clearWrongContactPreview();
  // Si es una bola rival, mantenemos visible la guía blanca que sale de la
  // bola blanca para mostrar claramente hacia dónde se está apuntando.
  // Solo ocultamos la guía blanca de salida de la bola incorrecta.
  if(previewWrong){
    aimLine.style.display='block';
    impactLine.style.display='none';
  }

  const candidates=[...positiveWalls];
  if(firstTarget) candidates.push(firstHit);

  const {w:guideW,h:guideH}=dimensions();
  // LAS TRONERAS NO SON BANDAS NI LÍMITES:
  // la guía de la blanca puede apuntar directamente a una tronera y no debe
  // detenerse en el borde de su círculo de detección. La detección física de
  // entrada a tronera sigue intacta y se ejecuta durante el movimiento.
  const positive=candidates.filter(t=>t>0);
  const rawGuideLen=positive.length ? Math.min(...positive) : 0;
  // Guía roja más corta: conserva la dirección de apuntado sin extenderse demasiado.
  const maxGuideLen=dimensions().w*0.98;
  const guideLen=Math.min(rawGuideLen,maxGuideLen);
  const endX=c.x+ux*guideLen, endY=c.y+uy*guideLen;

  // La guía que sale de la blanca SIEMPRE permanece visible, incluso cuando
  // el primer contacto sería una bola incorrecta. En ese caso ocultamos solo
  // la guía de salida de la bola rival (impactLine).
  aimLine.style.display='block';
  aimLine.style.left=c.x+'px';
  aimLine.style.top=c.y+'px';
  aimLine.style.width=guideLen+'px';
  aimLine.style.transformOrigin='0 50%';
  aimLine.style.transform=`translateY(-50%) rotate(${shotAngle}rad)`;

  aimDot.style.display='block';
  aimDot.style.width=dotSize+'px';
  aimDot.style.height=dotSize+'px';
  aimDot.style.left=endX+'px';
  aimDot.style.top=endY+'px';

  // TRAYECTORIA REAL DE SALIDA:
  // Para dos bolas iguales, con la bola objetivo inicialmente quieta y sin
  // efecto lateral, su velocidad después del impacto va exactamente por la
  // normal de contacto. Esa normal es la línea entre los centros EN EL
  // INSTANTE DEL IMPACTO. Calculamos el punto de contacto exacto para que la
  // línea no dependa de cómo esté recortado el PNG.
  if(firstTarget){
    const t=px(firstTarget);
    const targetRadius=(firstTarget.el.getBoundingClientRect().width || (ballRadius()*2))/2;
    const cueRadius=ballRadius();
    const collisionDistance=cueRadius+targetRadius;

    // FÍSICA REAL DEL IMPACTO: la bola objetivo no sale simplemente en la
    // dirección del vector actual blanca->objetivo. Primero calculamos el
    // punto exacto donde la trayectoria de la blanca toca la circunferencia
    // de la bola objetivo. En ese instante, la línea que une ambos centros es
    // la normal del choque; para bolas iguales y objetivo inicialmente quieto,
    // esa normal es exactamente la dirección de salida de la bola golpeada.
    const vx=t.x-c.x, vy=t.y-c.y;
    const alongTarget=vx*ux+vy*uy;
    const perpSigned=vx*uy-vy*ux;
    const perpAbs=Math.abs(perpSigned);
    let nx=0, ny=0;
    if(perpAbs <= collisionDistance && alongTarget > 0){
      const inside=Math.sqrt(Math.max(0,collisionDistance*collisionDistance-perpSigned*perpSigned));
      const hitDistance=alongTarget-inside;
      const hitX=c.x+ux*hitDistance;
      const hitY=c.y+uy*hitDistance;
      nx=(t.x-hitX)/collisionDistance;
      ny=(t.y-hitY)/collisionDistance;
    } else {
      // Respaldo para evitar una línea errática si no hay intersección válida.
      const d=Math.hypot(vx,vy)||1;
      nx=vx/d; ny=vy/d;
    }

    // La línea nace en la superficie de la bola objetivo y sigue su dirección
    // física de salida.
    const lineStart=targetRadius+1;
    const lineLen=58; // Guía de salida muy corta desde la bola golpeada.
    const sx=t.x+nx*lineStart;
    const sy=t.y+ny*lineStart;

    if(previewWrong){
      impactLine.style.display='none';
    }else{
      impactLine.style.display='block';
      impactLine.style.left=sx+'px';
      impactLine.style.top=sy+'px';
      impactLine.style.width=lineLen+'px';
      impactLine.style.transformOrigin='0 50%';
      impactLine.style.transform=`translateY(-50%) rotate(${Math.atan2(ny,nx)}rad)`;
    }
  } else {
    impactLine.style.display='none';
  }
}

let pointerHeld = false;
let placementHeld = false;
let placementPointerId = null;
// Lado permitido de cada límite dibujado mientras se recoloca la blanca.
// Se fija al comenzar el arrastre para impedir que la blanca atraviese
// cualquier segmento personalizado, incluidos los de izquierda y abajo.
let placementSideSigns = null;

function capturePlacementSides(cue){
  if(!cue || !customLimitSegments.length) { placementSideSigns = null; return; }
  const p=px(cue);
  placementSideSigns=customLimitSegments.map(seg=>{
    if(!Array.isArray(seg)||seg.length<2) return 1;
    const ax=seg[0][0]*dimensions().w, ay=seg[0][1]*dimensions().h;
    const bx=seg[1][0]*dimensions().w, by=seg[1][1]*dimensions().h;
    const sx=bx-ax, sy=by-ay, len=Math.hypot(sx,sy);
    if(len<1e-6) return 1;
    const nx=-sy/len, ny=sx/len;
    const d=(p.x-ax)*nx+(p.y-ay)*ny;
    return d<0 ? -1 : 1;
  });
}

function setWhitePlacementVisuals(active){
  // Durante la recolocación, el apuntado/guía no participa ni bloquea el arrastre.
  if(active){ aiming=false; pointerHeld=false; }
  const aimCueEl=document.querySelector('#aimCue');
  if(cueBallEl){ cueBallEl.classList.toggle('placement-active', !!active && !whitePocketing); }
  if(active || whitePocketing){
    aimLine.style.display='none';
    aimDot.style.display='none';
    impactLine.style.display='none';
    if(aimCueEl) aimCueEl.style.visibility='hidden';
  }else{
    if(aimCueEl) aimCueEl.style.visibility='visible';
    if(!moving && !placingCue){ updateAim(); }
  }
}

function updatePointerPosition(e){
  const r=wrap.getBoundingClientRect();
  pointer.x=e.clientX-r.left;
  pointer.y=e.clientY-r.top;
}

// La blanca tiene su propio receptor de arrastre durante la recolocación.
// Esto evita que el contenedor interprete el clic sobre la blanca como un clic
// normal de apuntado y garantiza que el arrastre empiece directamente sobre ella.
const cueBallEl = document.querySelector('.ball-cue');
if(cueBallEl){
  cueBallEl.addEventListener('pointerdown',e=>{
    if(whitePocketing || moving || (e.pointerType==='mouse' && e.button!==0)) return;
    const cue=balls[0];
    if(!cue || cue.pocketed) return;
    // Mientras la recolocación siga disponible (es decir, todavía no se ha
    // ejecutado un nuevo tiro), tocar directamente la blanca vuelve a activar
    // el modo de movimiento aunque se haya soltado previamente.
    if(!placingCue && whitePlacementAvailable){
      placingCue=true;
      placeCueBtn.classList.add('active');
    }
    if(!placingCue) return;
    updatePointerPosition(e);
    placementHeld=true;
    placementPointerId=e.pointerId;
    capturePlacementSides(cue);
    try{ cueBallEl.setPointerCapture?.(e.pointerId); }catch(_){}
    try{ wrap.setPointerCapture?.(e.pointerId); }catch(_){}
    setWhitePlacementVisuals(true);
    e.stopPropagation();
    e.preventDefault();
  }, {passive:false});
}

wrap.addEventListener('pointerdown',e=>{
  // Mouse: only left click. Touch: always accepted.
  if(moving || (e.pointerType === 'mouse' && e.button !== 0)) return;
  updatePointerPosition(e);

  if(placingCue){
    if(whitePocketing) return;
    // En modo de recolocación, SOLO un clic directamente sobre la blanca
    // permite agarrarla y moverla. Un clic en cualquier otro punto de la mesa
    // NO mueve la blanca: la deja estática y cambia inmediatamente al modo tiro.
    const cue=balls[0];
    const cuePx=cue ? px(cue) : null;
    const hitR=(ballRadius()*1.35);
    const overCue=cuePx && Math.hypot(pointer.x-cuePx.x,pointer.y-cuePx.y) <= hitR;
    if(overCue){
      placementHeld = true;
      placementPointerId = e.pointerId;
      capturePlacementSides(cue);
      wrap.setPointerCapture?.(e.pointerId);
      setWhitePlacementVisuals(true);
      // El clic inicial sobre la blanca NO la mueve.
      // La posición empieza a cambiar únicamente cuando el puntero se arrastra.
      e.preventDefault();
      return;
    }
    // Clic fuera de la blanca: termina el modo de colocación y empieza a apuntar,
    // sin cambiar la posición de la blanca.
    placingCue=false;
    aiming=true;
    placementHeld=false;
    placementPointerId=null;
    placeCueBtn.classList.remove('active');
    setWhitePlacementVisuals(false);
    pointerHeld=true;
    wrap.setPointerCapture?.(e.pointerId);
    updateAim();
    lastAimAngle=shotAngle;
    e.preventDefault();
    return;
  }

  pointerHeld = true;
  wrap.setPointerCapture?.(e.pointerId);
  updatePointerPosition(e);
  updateAim();
  lastAimAngle=shotAngle;
  e.preventDefault();
});

wrap.addEventListener('pointermove',e=>{
  if(moving) return;
  if(placingCue){
    if(!placementHeld || e.pointerId!==placementPointerId) return;
    updatePointerPosition(e);
    setCuePlacementFromPointer();
    e.preventDefault();
    return;
  }
  // El apuntado SOLO se actualiza mientras el clic está presionado.
  // Mover el mouse sin mantener el botón no debe cambiar la dirección.
  if(!pointerHeld) return;
  updatePointerPosition(e);
  updateAim();
  e.preventDefault();
});

function releaseAim(e){
  if(placingCue && placementHeld && e.pointerId===placementPointerId){
    placementHeld=false;
    try{ cueBallEl.releasePointerCapture?.(e.pointerId); }catch(_){}
    try{ wrap.releasePointerCapture?.(e.pointerId); }catch(_){}
    placementPointerId=null;
    placementSideSigns=null;
    aiming=true;
    // La blanca queda dormida y fija exactamente en el último punto válido.
    const cue=balls[0];
    if(cue){ cue.vx=0; cue.vy=0; cue.sleeping=true; setCuePlacementFromPointer(); }
    setWhitePlacementVisuals(false);
    // Importante: soltar la blanca NO termina el modo de recolocación.
    // Sigue disponible para volver a agarrarla cuantas veces sea necesario
    // hasta que se ejecute un tiro.
    placingCue=true;
    whitePlacementAvailable=true;
    statusEl.textContent='BLANCA COLOCADA • PUEDES VOLVER A AGARRARLA ANTES DE TIRAR';
    updateAim();
    e.preventDefault();
    return;
  }
  if(!pointerHeld) return;
  pointerHeld = false;
  // Freeze the last aimed direction. Pulling the cue must never alter it.
  if(Number.isFinite(shotAngle)) lastAimAngle=shotAngle;
  // Deliberately do NOT recalculate or hide the aim line.
  // It stays exactly where the user left it.
  try{ wrap.releasePointerCapture?.(e.pointerId); }catch(_){}
  statusEl.textContent='DIRECCIÓN FIJADA • PULSA JUGAR PARA TIRAR';
  e.preventDefault();
}

wrap.addEventListener('pointerup', releaseAim);
wrap.addEventListener('pointercancel', releaseAim);
wrap.addEventListener('pointerleave',()=>{});

// La fuerza se carga con el taco: presionar el taco y bajarlo.
let charging = false;
let chargeStartY = 0;
let chargeStartX = 0;
let chargePointerId = null;
const maxPull = 260;

function setPower(v){
  power=Math.max(0,Math.min(1,Number(v)||0));
  powerFill.style.height=(power*100)+'%';
  powerValue.textContent=Math.round(power*100)+'%';
}

cueImg.addEventListener('pointerdown',e=>{
  if(moving || !balls[0] || balls[0].pocketed) return;
  charging=true;
  chargePointerId=e.pointerId;
  chargeStartY=e.clientY;
  chargeStartX=e.clientX;
  cueImg.classList.add('charging');
  cueImg.setPointerCapture?.(e.pointerId);
  setPower(0);
  statusEl.textContent='FUERZA: 0% • BAJA EL TACO';
  e.preventDefault();
  e.stopPropagation();
});

cueImg.addEventListener('pointermove',e=>{
  if(!charging || e.pointerId!==chargePointerId) return;
  // Downward movement = more force. Small horizontal movement is ignored.
  const pull=Math.max(0,e.clientY-chargeStartY);
  setPower(pull/maxPull);
  statusEl.textContent='FUERZA: '+Math.round(power*100)+'%';
  e.preventDefault();
  e.stopPropagation();
});

function releaseCue(e){
  if(!charging || e.pointerId!==chargePointerId) return;
  charging=false;
  cueImg.classList.remove('charging');
  try{cueImg.releasePointerCapture?.(e.pointerId)}catch(_){}
  // A tiny pull is treated as a cancelled charge; otherwise shoot.
  if(power>=0.03){
    shoot();
  }else{
    statusEl.textContent='MANTÉN PRESIONADO EL TACO Y BÁJALO PARA CARGAR FUERZA';
  }
  e.preventDefault();
  e.stopPropagation();
}
cueImg.addEventListener('pointerup',releaseCue);
cueImg.addEventListener('pointercancel',releaseCue);

// Respaldo robusto: al usar pointer capture, algunos navegadores entregan
// el soltar fuera del elemento. En ese caso el taco debe disparar igualmente.
function releaseCueGlobal(e){
  if(!charging) return;
  if(chargePointerId!==null && e.pointerId!==undefined && e.pointerId!==chargePointerId) return;
  releaseCue(e);
}
document.addEventListener('pointerup',releaseCueGlobal, true);
document.addEventListener('pointercancel',releaseCueGlobal, true);
document.addEventListener('mouseup',e=>{ if(charging) releaseCue({pointerId:chargePointerId,clientX:e.clientX,clientY:e.clientY,preventDefault:()=>{},stopPropagation:()=>{}}); }, true);
document.addEventListener('touchend',e=>{ if(charging) releaseCue({pointerId:chargePointerId,clientX:e.changedTouches?.[0]?.clientX||chargeStartX,clientY:e.changedTouches?.[0]?.clientY||chargeStartY,preventDefault:()=>{},stopPropagation:()=>{}}); }, true);

playBtn.addEventListener('click',()=>{
  if(power<=0) setPower(.35);
  shoot();
});

function captureShotSnapshot(){
  return {
    aimAngle: (typeof lastAimAngle==='number' && Number.isFinite(lastAimAngle)) ? lastAimAngle : shotAngle,
    shotAngle: (typeof shotAngle==='number' && Number.isFinite(shotAngle)) ? shotAngle : 0,
    power,
    balls: balls.map(b=>({
    x:b.x,y:b.y,vx:b.vx,vy:b.vy,
    pocketed:b.pocketed,sleeping:b.sleeping,
    display:b.el.style.display,opacity:b.el.style.opacity,
    transform:b.el.style.transform,zIndex:b.el.style.zIndex
  }))
  };
}

function restoreLastShot(){
  if(!lastShotSnapshot || !balls.length) return;

  moving=false;
  whiteGuideActive=false;
  aiming=true;
  pointerHeld=false;
  physicsAccumulator=0;
  pocketingBalls.clear();
  window.__breakBurstDone=false;

  balls.forEach((b,i)=>{
    const snap=lastShotSnapshot.balls[i];
    if(!snap) return;
    b.x=snap.x; b.y=snap.y;
    b.vx=snap.vx; b.vy=snap.vy;
    b.pocketed=snap.pocketed;
    b.sleeping=snap.sleeping;
    b.el.style.display=snap.display || '';
    b.el.style.opacity=snap.opacity || '';
    b.el.style.transform=snap.transform || 'translate(-50%,-50%)';
    b.el.style.zIndex=snap.zIndex || '';
  });

  // Recuperar EXACTAMENTE el ángulo que estaba seleccionado antes del tiro.
  shotAngle=lastShotSnapshot.shotAngle;
  lastAimAngle=lastShotSnapshot.aimAngle;
  setPower(lastShotSnapshot.power);
  render();
  // Redibujar la guía usando el ángulo guardado, sin depender de la posición
  // actual del cursor. Así REBOBINAR devuelve la misma puntería del último tiro.
  updateAim(lastShotSnapshot.aimAngle);
  aimLine.style.display='block';
  aimDot.style.display='none';
  impactLine.style.display='none';
  statusEl.textContent='ÚLTIMO TIRO REBOBINADO • MISMA PUNTERÍA RESTAURADA';
  undoShotBtn.disabled=true;
}

placeCueBtn.addEventListener('click',()=>{
  if(moving || !balls[0]) return;
  placingCue=!placingCue;
  placeCueBtn.classList.toggle('active',placingCue);
  if(placingCue){
    whitePlacementAvailable=true;
    pointerHeld=false; placementHeld=false; placementPointerId=null; placementSideSigns=null;
    setWhitePlacementVisuals(true);
    statusEl.textContent='COLOCAR BLANCA • MANTÉN CLIC Y MUEVE, SUELTA PARA FIJAR';
  }else{
    whitePlacementAvailable=false;
    setWhitePlacementVisuals(false);
    statusEl.textContent='MANTÉN PRESIONADO EL TACO Y BÁJALO PARA CARGAR FUERZA';
    updateAim();
  }
});

undoShotBtn.addEventListener('click',restoreLastShot);

// Controles del menú de FIN DE LA PARTIDA.
const gameOverReplayBtn=document.getElementById('gameOverReplay');
const gameOverExitBtn=document.getElementById('gameOverExit');
if(gameOverReplayBtn){
  gameOverReplayBtn.addEventListener('click',()=>{
    const overlay=document.getElementById('gameOverOverlay');
    if(overlay){overlay.classList.remove('show'); overlay.setAttribute('aria-hidden','true');}
    gameOverPending=false; gameOverBlackPocketed=false; gameOverWinner=0;
    resetBtn.click();
    if(typeof window.__resetTurnTimerForNewGame==='function') window.__resetTurnTimerForNewGame();
  });
}
if(gameOverExitBtn){
  gameOverExitBtn.addEventListener('click',()=>{
    try{
      if(window.history.length>1){ window.history.back(); return; }
    }catch(_){}
    // Fallback para abrir el archivo directamente sin historial.
    const overlay=document.getElementById('gameOverOverlay');
    if(overlay){overlay.classList.remove('show'); overlay.setAttribute('aria-hidden','true');}
    gameOverPending=false; gameOverBlackPocketed=false; gameOverWinner=0;
    resetBtn.click();
  });
}

resetBtn.addEventListener('click',()=>{
  placingCue=false; whitePlacementAvailable=false; placeCueBtn.classList.remove('active');
  moving=false; whiteGuideActive=false; aiming=true; pointerHeld=false; window.__breakBurstDone=false; clearWrongContactPreview();
  pocketingBalls.clear();
  ballEls.forEach(el=>{el.style.opacity='';el.style.transform='';el.style.zIndex='';});
  setupBalls();
  lastShotSnapshot=null;
  undoShotBtn.disabled=true;
  aimLine.style.display='none'; aimDot.style.display='none'; impactLine.style.display='none';
  statusEl.textContent='MANTÉN PRESIONADO Y ARRASTRA PARA APUNTAR';
});

function shoot(){
  placingCue=false;
  whitePlacementAvailable=false;
  placementHeld=false; placementPointerId=null; placementSideSigns=null;
  if(typeof window.resetWhiteEffectAfterShot==='function') window.resetWhiteEffectAfterShot();
  placingCue=false; placeCueBtn.classList.remove('active');
  if(typeof moving!=='undefined' && moving) return false;
  if(typeof balls==='undefined' || !balls[0]) return false;
  // Al lanzar el tiro, el cronómetro del turno queda PAUSADO ANTES de iniciar
  // cualquier movimiento físico. Así el tiempo queda congelado exactamente
  // en el instante del golpe y no consume milisegundos durante el vuelo.
  window.__turnTimerShotActive=true;
  if(typeof window.__pauseTurnTimer==='function') window.__pauseTurnTimer();

  const white=balls[0];
  if(white.pocketed) return false;

  // El primer tiro de la partida es el SAQUE.
  // El saque nunca asigna colores; la asignación se hace con la primera
  // bola roja/amarilla embocada en un tiro posterior al saque.
  currentShotIsBreak = (totalShotsTaken===0);
  window.__lastShotPlayer = (typeof window.__getActiveTurnPlayer==='function') ? window.__getActiveTurnPlayer() : 1;
  window.__getLastShotPlayer = ()=>window.__lastShotPlayer;
  // La cantidad de bolas propias se congela AL COMENZAR este tiro.
  // Es la que decide si la 8 legal da la victoria o si es pérdida.
  shotOwnRemainingAtStart=calculateOwnRemaining(window.__lastShotPlayer);
  totalShotsTaken++;

  // Direction is the direction last fixed by the aiming line.
  const angle=(typeof lastAimAngle==='number' && Number.isFinite(lastAimAngle))
    ? lastAimAngle
    : ((typeof shotAngle==='number' && Number.isFinite(shotAngle)) ? shotAngle : 0);

  const p=Math.max(0,Math.min(1,Number(power)||0));
  // Guardamos la fuerza del tiro para que la regla de detención frontal
  // solo exista cuando el golpe fue realmente a FUERZA MÁXIMA.
  window.__shotPowerAtStrike=p;
  shotHadCueCollision=false;
  shotCueHitTargets.clear();
  shotPocketedObjectBalls.clear();
  // Cada tiro debe evaluar únicamente las bolas que caen en ESTE tiro.
  // Nunca arrastrar el color de un tiro anterior, especialmente entre
  // el saque y el primer tiro posterior al saque.
  shotFirstPocketedColor=null;
  shotWhitePocketed=false;
  shotWrongFirstContact=false;
  shotFirstCueContactColor=null;
  shotHadCueCushionContact=false;
  shotHadAnyCushionContact=false;
  shotHadObjectCushionContact=false;
  shotObjectCushionBalls.clear();
  shotRuleRespawnPending=false;
  pendingWhiteRespawnReason=null;
  shotStartWhitePosition={x:white.x,y:white.y};
  // Keep the normal ball physics/friction unchanged; only the cue strike
  // is made substantially stronger at high power.
  const speed=120+(p*6000);
  // Guardamos la dirección física de salida de la PRIMERA bola objetivo antes
  // de mover nada. Esta dirección depende solo de la geometría del impacto,
  // nunca de la fuerza. La fuerza únicamente cambiará la magnitud de la velocidad.
  firstShotTarget=null; firstShotExitNX=0; firstShotExitNY=0; firstShotSpeed=speed; firstTargetGuideActive=false;
  const cueStart=px(white);
  const ux0=Math.cos(angle), uy0=Math.sin(angle);
  let firstHit0=Infinity;
  const cueR0=ballRadius();
  for(let i=1;i<balls.length;i++){
    const tb=balls[i]; if(tb.pocketed) continue;
    const tq=px(tb); const tr=(tb.el.getBoundingClientRect().width || cueR0*2)/2;
    const vx=tq.x-cueStart.x, vy=tq.y-cueStart.y;
    const along=vx*ux0+vy*uy0; if(along<=0) continue;
    const perp=vx*uy0-vy*ux0; const sumR=cueR0+tr;
    if(Math.abs(perp)>sumR) continue;
    const inside=Math.sqrt(Math.max(0,sumR*sumR-perp*perp));
    const hit=along-inside; if(hit<=0 || hit>=firstHit0) continue;
    const hitX=cueStart.x+ux0*hit, hitY=cueStart.y+uy0*hit;
    const nx=(tq.x-hitX)/sumR, ny=(tq.y-hitY)/sumR;
    const nl=Math.hypot(nx,ny)||1;
    firstHit0=hit; firstShotTarget=tb; firstShotExitNX=nx/nl; firstShotExitNY=ny/nl; firstTargetGuideActive=true;
  }
  // Fuerza máxima: 100% permite recorridos extremos y múltiples rebotes en bandas.

  // Guardamos el estado EXACTO inmediatamente antes del último tiro.
  // Así REBOBINAR puede devolver todas las bolas a su posición anterior,
  // incluyendo bolas que hayan entrado en una tronera.
  lastShotSnapshot=captureShotSnapshot();
  undoShotBtn.disabled=false;

  white.pocketed=false;
  if(white.el) white.el.style.display='';
  white.sleeping=false;
  white.vx=Math.cos(angle)*speed;
  white.vy=Math.sin(angle)*speed;
  whiteGuideActive=true;

  if(typeof window!=='undefined') window.__breakBurstDone=false;
  moving=true;
  shotElapsed=0;
  aiming=false;
  pointerHeld=false;

  if(typeof aimLine!=='undefined') aimLine.style.display='none';
  if(typeof aimDot!=='undefined') aimDot.style.display='none';
  if(typeof impactLine!=='undefined') impactLine.style.display='none';
  if(typeof statusEl!=='undefined') statusEl.textContent='TIRO EN CURSO...';

  return true;
}


function pocketPoints(w,h){ return editablePockets.map(([x,y])=>[x*w,y*h]); }
function pRForPhysics(w){ return editablePocketRadius*w; }

// REGLA PRIORITARIA DE TRONERA:
// Una bola queda embocada cuando MÁS DEL 50% de su superficie circular
// (área visible de la bola en planta) está dentro de la abertura de la tronera.
// Ya NO es necesario que entre el 100% de la bola.
//
// Para que la regla sea geométricamente correcta, calculamos el solapamiento
// entre el círculo de la bola y el círculo de la tronera y buscamos la distancia
// entre centros en la que el solapamiento alcanza exactamente el 50%.
// La bola se captura cuando supera ese punto. También se comprueba el tramo
// recorrido entre dos subpasos para que una bola rápida no pueda saltarse la captura.

const pocketHalfCaptureCache = new Map();

function circleOverlapArea(d,r,R){
  if(d >= r+R) return 0;
  if(d <= Math.abs(R-r)) return Math.PI*Math.min(r,R)**2;
  const a=Math.acos(Math.max(-1,Math.min(1,(d*d+r*r-R*R)/(2*d*r))));
  const b=Math.acos(Math.max(-1,Math.min(1,(d*d+R*R-r*r)/(2*d*R))));
  const term=Math.max(0,(-d+r+R)*(d+r-R)*(d-r+R)*(d+r+R));
  return r*r*a + R*R*b - 0.5*Math.sqrt(term);
}

function pocketCaptureRadius(w){
  const r=ballRadius();
  const R=pRForPhysics(w);
  if(r<=0 || R<=0) return 0;

  // Si la tronera es demasiado pequeña para contener la mitad de la bola,
  // no existe una posición que cumpla la regla del 50%.
  const maxOverlap=Math.PI*Math.min(r,R)**2;
  const halfBall=Math.PI*r*r*0.5;
  if(maxOverlap < halfBall) return 0;

  const key=Math.round((R/r)*100000)/100000;
  let d50=pocketHalfCaptureCache.get(key);
  if(d50==null){
    let lo=Math.max(0,Math.abs(R-r)), hi=R+r;
    for(let i=0;i<28;i++){
      const mid=(lo+hi)/2;
      if(circleOverlapArea(mid,r,R) > halfBall) lo=mid;
      else hi=mid;
    }
    d50=(lo+hi)/2;
    pocketHalfCaptureCache.set(key,d50);
  }
  return d50;
}

function pocketCheck(b, previousPx=null){
  if(!b || b.pocketed) return false;
  const {w,h}=dimensions();
  const captureR=pocketCaptureRadius(w);
  if(captureR<=0) return false;

  const now=px(b);
  let best=null;
  let bestD=Infinity;

  for(const [pcx,pcy] of pocketPoints(w,h)){
    let hitX=now.x, hitY=now.y;
    let d=Math.hypot(now.x-pcx, now.y-pcy);

    // Detección continua: si la bola recorrió un segmento que atraviesa la
    // zona de captura, tomamos el punto exacto más cercano a la tronera.
    if(previousPx){
      const sx=now.x-previousPx.x, sy=now.y-previousPx.y;
      const len2=sx*sx+sy*sy;
      if(len2>0.000001){
        const t=Math.max(0,Math.min(1,((pcx-previousPx.x)*sx+(pcy-previousPx.y)*sy)/len2));
        const qx=previousPx.x+t*sx, qy=previousPx.y+t*sy;
        d=Math.hypot(qx-pcx,qy-pcy);
        hitX=qx; hitY=qy;
      }
    }

    if(d<=captureR && d<bestD){
      bestD=d;
      best={x:hitX,y:hitY,cx:pcx,cy:pcy};
    }
  }

  if(!best) return false;
  pocketBall(b,best);
  return true;
}

let whitePocketing = false;

function pocketBall(b, pocket){
  if(!b || b.pocketed || pocketingBalls.has(b)) return;
  if(b===balls[0]){
    shotWhitePocketed = true;
    whitePocketing = true;
    placingCue = false;
    placementHeld = false;
    placementPointerId = null;
    pointerHeld = false;
    placeCueBtn.classList.remove('active');
    aimLine.style.display='none';
    aimDot.style.display='none';
    impactLine.style.display='none';
    const ac=document.querySelector('#aimCue');
    if(ac) ac.style.display='none';
  }

  const {w,h}=dimensions();
  const start=px(b);
  // Guardamos la velocidad exacta con la que la bola llega a la tronera.
  // La animación de entrada usará esa misma velocidad, sin aumentar ni
  // disminuir artificialmente la fuerza del tiro.
  const entrySpeed=Math.hypot(b.vx,b.vy);
  b.x=start.x/w;
  b.y=start.y/h;
  b.vx=0; b.vy=0; b.sleeping=true;
  b.pocketed=true;
  // La bola negra REAL es la única que puede terminar la partida.
  // No mostramos el menú todavía: primero dejamos terminar toda la física.
  if(b!==balls[0] && b.color==='black' && b.number===8){
    gameOverBlackPocketed=true;
    gameOverPending=true;
    const shooter=(typeof window.__lastShotPlayer==='number' && window.__lastShotPlayer) ? window.__lastShotPlayer : getActivePlayerSafe();
    gameOverWinner = shotOwnRemainingAtStart===0 ? shooter : (shooter===1?2:1);
  }
  if(b!==balls[0] && b.number!==8){
    shotPocketedObjectBalls.add(b);
    if((b.color==='red'||b.color==='yellow') && !shotFirstPocketedColor) shotFirstPocketedColor=b.color;
    if(typeof updateScoreboardRemaining==='function') updateScoreboardRemaining();
  }
  pocketingBalls.add(b);

  const el=b.el;
  const startW=el.getBoundingClientRect().width || ballRadius(w)*2;
  const startH=el.getBoundingClientRect().height || startW;
  const startLeft=start.x;
  const startTop=start.y;
  // La bola continúa ligeramente más allá del centro de la tronera para que
  // se perciba que realmente cae hacia dentro, sin cambiar su tamaño.
  const dx=pocket.cx-start.x, dy=pocket.cy-start.y;
  const dist=Math.hypot(dx,dy)||1;
  const endLeft=pocket.cx+(dx/dist)*Math.min(startW*.38,14);
  const endTop=pocket.cy+(dy/dist)*Math.min(startH*.38,14);
  // La distancia visual de entrada se recorre a la misma velocidad de la bola.
  // Si la velocidad es muy baja, usamos un mínimo para evitar una animación
  // excesivamente larga. El movimiento es lineal para no introducir aceleración
  // o frenado artificial durante la caída.
  const entryDistance=Math.hypot(endLeft-startLeft,endTop-startTop);
  const effectiveSpeed=Math.max(entrySpeed,40);
  const pocketAnimDuration=Math.max(80, Math.min(900, (entryDistance/effectiveSpeed)*1000));
  const startedAt=performance.now();

  // Entrada realista: la bola conserva TODO su tamaño mientras avanza hacia
  // la tronera. Al llegar a la zona del agujero, la propia boca de la tronera
  // la tapa progresivamente, como ocurriría físicamente, en vez de encogerla.
  el.style.display='block';
  el.style.zIndex='20';
  el.style.width=startW+'px';
  el.style.height=startH+'px';
  el.style.left=startLeft+'px';
  el.style.top=startTop+'px';
  el.style.opacity='1';
  el.style.transform='translate(-50%,-50%) scale(1)';
  el.style.transition='none';

  const tableEl=document.querySelector('.table');
  const pocketCover=document.createElement('div');
  pocketCover.className='pocket pocket-entry-cover';
  pocketCover.style.left=(endLeft-36)+'px';
  pocketCover.style.top=(endTop-36)+'px';
  pocketCover.style.width='72px';
  pocketCover.style.height='72px';
  pocketCover.style.opacity='0';
  pocketCover.style.zIndex='30';
  pocketCover.style.transform='scale(1.02)';
  pocketCover.style.pointerEvents='none';
  if(tableEl) tableEl.appendChild(pocketCover);

  function coverTForEffects(progress){
    const v=Math.max(0,Math.min(1,(progress-.48)/.42));
    return v*v*(3-2*v);
  }

  function animatePocket(now){
    if(!pocketingBalls.has(b)) return;
    const t=Math.min(1,(now-startedAt)/pocketAnimDuration);
    // Velocidad constante: la entrada conserva la velocidad con la que llegó.
    const e=t;
    const curLeft=startLeft+(endLeft-startLeft)*e;
    const curTop=startTop+(endTop-startTop)*e;
    el.style.left=curLeft+'px';
    el.style.top=curTop+'px';
    // Nunca reducir el tamaño: la boca de la tronera es la que oculta la bola.
    el.style.transform='translate(-50%,-50%) scale(1)';
    el.style.opacity='1';

    // El brillo, aro y estela son capas independientes de la bola. Mientras
    // la bola entra en la tronera deben viajar con ella; de lo contrario el
    // brillo queda congelado en la posición anterior y se ve separado.
    const pocketAngle=Math.atan2(endTop-startTop,endLeft-startLeft);
    const rollProgress=e;
    if(b.shine){
      b.shine.style.left=curLeft+'px';
      b.shine.style.top=curTop+'px';
      b.shine.style.opacity=String(Math.max(0,.32*(1-coverTForEffects(e))));
      b.shine.style.transform=`translate(-50%,-50%) rotate(${b.rollAngle + rollProgress*2.8}rad) scale(1)`;
    }
    if(b.streak){
      b.streak.style.left=curLeft+'px';
      b.streak.style.top=curTop+'px';
      b.streak.style.opacity=String(Math.max(0,.22*(1-coverTForEffects(e))));
      b.streak.style.transform=`translate(-50%,-50%) rotate(${pocketAngle}rad) scaleX(1.15)`;
    }
    if(b.ring){
      b.ring.style.left=curLeft+'px';
      b.ring.style.top=curTop+'px';
      b.ring.style.opacity=String(Math.max(0,.18*(1-coverTForEffects(e))));
      b.ring.style.transform=`translate(-50%,-50%) rotate(${b.rollAngle*1.7 + rollProgress*2.4 + pocketAngle*.35}rad) scale(.98)`;
    }

    // Cuando la bola ya está entrando, el frente de la tronera la cubre.
    // Esto produce una entrada natural vista desde arriba.
    // La boca empieza a ocultar la bola solo cuando ésta ya ha entrado
    // claramente en la abertura; el ocultamiento es progresivo, no brusco.
    const coverT=Math.max(0,Math.min(1,(t-.58)/.38));
    const coverEase=coverT*coverT*(3-2*coverT);
    pocketCover.style.opacity=String(coverEase*.96);

    if(t<1){
      requestAnimationFrame(animatePocket);
    }else{
      // Regla de bola blanca embocada (scratch): la blanca reaparece en
      // el mismo lugar de la mesa desde donde salió de su posición jugable,
      // y queda disponible para colocarse manualmente en cualquier punto.
      // Las demás bolas permanecen embocadas normalmente.
      if(b===balls[0]){
        // La blanca no reaparece mientras haya cualquier otra bola en movimiento.
        // Guardamos el punto exacto desde el que salió de la mesa y esperamos
        // a que todas las bolas queden dormidas antes de devolverla.
        whitePocketing=false;
        pendingWhiteRespawn={x:.5,y:.5};
        pendingWhiteRespawnReason='pocket';
        shotRuleRespawnPending=true;
        b.pocketed=true;
        b.sleeping=true;
        b.vx=0; b.vy=0;
        el.style.display='none';
        el.style.opacity='';
        el.style.transform='';
        el.style.width='';
        el.style.height='';
        el.style.left='';
        el.style.top='';
        el.style.zIndex='';
        placingCue=false;
        placementHeld=false;
        placementPointerId=null;
        placementSideSigns=null;
        placeCueBtn.classList.remove('active');
        aimLine.style.display='none';
        aimDot.style.display='none';
        impactLine.style.display='none';
        const ac=document.querySelector('#aimCue');
        if(ac) ac.style.visibility='hidden';
        statusEl.textContent='BLANCA EMBUCHADA • ESPERANDO A QUE SE DETENGAN LAS BOLAS';
        // No ponemos moving=false aquí: el resto del tiro debe continuar
        // hasta que todas las bolas estén realmente detenidas.
      }else{
        el.style.display='none';
        el.style.opacity='';
        el.style.transform='';
        el.style.width='';
        el.style.height='';
        el.style.left='';
        el.style.top='';
        el.style.zIndex='';
      }
      pocketCover.remove();
      if(b.shine) b.shine.style.opacity='0';
      if(b.ring) b.ring.style.opacity='0';
      if(b.streak) b.streak.style.opacity='0';
      pocketingBalls.delete(b);
    }
  }
  requestAnimationFrame(animatePocket);
}
function physics(dt){
  const {w,h}=dimensions();
  const r=ballRadius();
  const collisionR=collisionBallRadius();
  const B=tableBounds();

  // Segmentos personalizados: actúan como límites físicos para las bolas.
  // La bandera debe existir antes de comprobar los segmentos; antes quedaba
  // declarada dentro del bucle y provocaba un ReferenceError que detenía toda
  // la física cuando había líneas dibujadas.
  let hitCushionThisStep = false;
  function collideCustomSegments(ball, prevPx=null){
  if(!customLimitSegments.length) return false;

  const p=px(ball);
  const prev=prevPx || p;
  const vx=ball.vx, vy=ball.vy;
  const speed=Math.hypot(vx,vy);
  if(speed<1e-8) return false;

  const R=ballRadius();
  let best=null;

  // IMPORTANTE: la colisión se calcula contra LOS SEGMENTOS DIBUJADOS,
  // no contra un rectángulo ni contra los bordes de la imagen.
  // Cada segmento se trata como una banda de espesor R para que el
  // contorno de la bola nunca pueda atravesar la línea roja.
  for(const seg of customLimitSegments){
    if(!Array.isArray(seg)||seg.length<2) continue;

    const ax=seg[0][0]*w, ay=seg[0][1]*h;
    const bx=seg[1][0]*w, by=seg[1][1]*h;
    const sx=bx-ax, sy=by-ay;
    const len=Math.hypot(sx,sy);
    if(len<0.001) continue;

    const tx=sx/len, ty=sy/len;
    const qx=p.x-ax, qy=p.y-ay;
    const u=Math.max(0,Math.min(len,qx*tx+qy*ty));
    const cx=ax+tx*u, cy=ay+ty*u;

    let dx=p.x-cx, dy=p.y-cy;
    let dist=Math.hypot(dx,dy);

    let nx,ny;
    if(dist>1e-7){
      nx=dx/dist; ny=dy/dist;
    }else{
      nx=-ty; ny=tx;
      if(vx*nx+vy*ny>0){nx=-nx;ny=-ny;}
      dist=0;
    }

    // También comprobamos el segmento anterior para detectar un cruce
    // aunque la bola haya avanzado mucho entre dos frames.
    const pqx=prev.x-ax, pqy=prev.y-ay;
    const pu=Math.max(0,Math.min(len,pqx*tx+pqy*ty));
    const pcx=ax+tx*pu, pcy=ay+ty*pu;
    const pdx=prev.x-pcx, pdy=prev.y-pcy;
    const prevDist=Math.hypot(pdx,pdy);

    const penetration=R-dist;
    const sweptCross=prevDist>R && dist<=R;
    const vn=vx*nx+vy*ny;
    const movingInto=vn<0;

    if(penetration<=0 && !sweptCross) continue;
    if(!movingInto && penetration<=0) continue;

    if(!best || dist<best.dist)
      best={cx,cy,nx,ny,dist,penetration,prevDist};
  }

  if(!best) return false;

  let {cx,cy,nx,ny,dist}=best;

  // Normal siempre apunta desde la banda hacia el centro de la bola.
  // Si la bola ya atravesó parcialmente la línea, se fuerza hacia el lado
  // correcto antes de reflejarla.
  const side=(p.x-cx)*nx+(p.y-cy)*ny;
  if(side<0){nx=-nx;ny=-ny;}

  const vn=vx*nx+vy*ny;

  // CORRECCIÓN DURA DE POSICIÓN:
  // el centro queda exactamente R+0.35 px fuera del límite dibujado.
  // Así la bola no puede quedar visualmente montada sobre la línea.
  const eps=0.35;
  ball.x=(cx+nx*(R+eps))/w;
  ball.y=(cy+ny*(R+eps))/h;

  // Solo invertimos la componente normal si realmente venía contra la banda.
  if(vn<0){
    const wb = (ball===balls[0]) ? whiteWallBounce : wallBounce;
    ball.vx=(vx-2*vn*nx)*wb;
    ball.vy=(vy-2*vn*ny)*wb;
  }

  hitCushionThisStep=true;
  shotHadAnyCushionContact=true;
  if(ball!==balls[0]){ shotHadObjectCushionContact=true; shotObjectCushionBalls.add(ball); }
  if(ball===balls[0]){ shotHadCueCushionContact=true; whiteGuideActive=false; }
  if(ball===firstShotTarget) firstTargetGuideActive=false;
  return true;
}

  // PRIORIDAD ABSOLUTA: estabilidad. Las bolas solo reciben cambios de
  // velocidad por un impacto real; una bola que rueda libremente no debe
  // producir micro-oscilaciones ni cambios laterales artificiales.
  const f=Math.pow(friction,dt*60);
  const whiteFriction=Math.pow(Number(whitePhysicsSettings.normalFriction)||0.9955,dt*60);
  const FINAL_SPEED=18;
  const WHITE_FINAL_SPEED=Number(whitePhysicsSettings.stopSpeed)||7;       // zona de reposo: corta micro-movimientos
  const POSITION_SLOP=0.75;   // tolerancia para no estar corrigiendo contactos

  for(const b of balls){
    if(b.pocketed) continue;

    const oldX=b.x, oldY=b.y;
    b.x += b.vx*dt/w;
    b.y += b.vy*dt/h;
    const previousPx={x:oldX*w,y:oldY*h};

    // Primero comprobamos la tronera en la trayectoria recorrida. Así una bola
    // que entra limpiamente en una abertura no es capturada por un segmento de
    // banda antes de poder embocarse.
    if(pocketCheck(b, previousPx)) continue;

    // La banda se comprueba UNA sola vez, después del movimiento, usando la
    // posición anterior para localizar el contacto continuo. Esto elimina el
    // doble rebote que hacía que las bolas se desviaran o parecieran saltar.
    collideCustomSegments(b, previousPx);

    // BARRERA DE SEGURIDAD: impide que una bola pueda atravesar las bandas
    // aunque un segmento personalizado no haya detectado el cruce por la
    // velocidad del tiro. Las troneras siguen siendo gestionadas primero por
    // pocketCheck(), por lo que sus entradas no quedan bloqueadas.
    {
      const safeR = ballRadius();
      const minX = B.left + safeR;
      const maxX = B.right - safeR;
      const minY = B.top + safeR;
      const maxY = B.bottom - safeR;
      let q = px(b);

      if(q.x < minX){
        b.x = minX / w;
        if(b.vx < 0) b.vx = -b.vx * (b===balls[0] ? whiteWallBounce : wallBounce);
        shotHadAnyCushionContact = true;
        if(b===balls[0]) shotHadCueCushionContact = true;
        else { shotHadObjectCushionContact = true; shotObjectCushionBalls.add(b); }
      } else if(q.x > maxX){
        b.x = maxX / w;
        if(b.vx > 0) b.vx = -b.vx * (b===balls[0] ? whiteWallBounce : wallBounce);
        shotHadAnyCushionContact = true;
        if(b===balls[0]) shotHadCueCushionContact = true;
        else { shotHadObjectCushionContact = true; shotObjectCushionBalls.add(b); }
      }

      q = px(b);
      if(q.y < minY){
        b.y = minY / h;
        if(b.vy < 0) b.vy = -b.vy * (b===balls[0] ? whiteWallBounce : wallBounce);
        shotHadAnyCushionContact = true;
        if(b===balls[0]) shotHadCueCushionContact = true;
        else { shotHadObjectCushionContact = true; shotObjectCushionBalls.add(b); }
      } else if(q.y > maxY){
        b.y = maxY / h;
        if(b.vy > 0) b.vy = -b.vy * (b===balls[0] ? whiteWallBounce : wallBounce);
        shotHadAnyCushionContact = true;
        if(b===balls[0]) shotHadCueCushionContact = true;
        else { shotHadObjectCushionContact = true; shotObjectCushionBalls.add(b); }
      }
    }

    let p=px(b);

  }

  // Resolver contactos una vez por subpaso. No existe impulso si las bolas
  // no se están acercando de forma clara. Esto evita el ciclo de temblor.
  for(let i=0;i<balls.length;i++){
    const a=balls[i];
    if(a.pocketed) continue;
    for(let j=i+1;j<balls.length;j++){
      const b=balls[j];
      if(b.pocketed) continue;

      const A=px(a), C=px(b);
      let dx=C.x-A.x, dy=C.y-A.y;
      let dist=Math.hypot(dx,dy);
      if(dist<0.0001){dx=1;dy=0;dist=1;}
      const nx=dx/dist, ny=dy/dist;
      // Cada bola usa su radio visual REAL. El contacto físico ocurre
      // exactamente cuando las dos circunferencias se tocan.
      const ra=(a.el.getBoundingClientRect().width || collisionR*2)/2;
      const rb=(b.el.getBoundingClientRect().width || collisionR*2)/2;
      const minDist=ra+rb;
      const overlap=minDist-dist;

      if(overlap<=0) continue;

      const rvx=b.vx-a.vx, rvy=b.vy-a.vy;
      const rel=rvx*nx+rvy*ny;
      if((a===balls[0] || b===balls[0]) && rel<0){
        shotHadCueCollision=true;
        const hitTarget = (a===balls[0]) ? b : a;
        if(hitTarget && hitTarget!==balls[0]){
          shotCueHitTargets.add(hitTarget);
          // Una vez definidos los grupos, la PRIMERA bola de color que toca
          // la blanca debe pertenecer al grupo del jugador que tira.
          // Si toca primero la bola contraria, el tiro es falta, aunque
          // después llegue a tocar o embocar una bola propia.
          if(shotFirstCueContactColor===null){
            shotFirstCueContactColor=hitTarget.color||null;
            const shooter=(typeof window.__lastShotPlayer==='number')?window.__lastShotPlayer:1;
            const groups=window.__playerBallGroups;
            // La negra es SIEMPRE un primer contacto incorrecto mientras el
            // jugador no haya terminado su grupo. Antes de asignar grupos,
            // también es incorrecta para ambos.
            if(hitTarget.color==='black'){
              let blackWrong=true;
              if(groupsAssigned && groups){
                const ownColor=shooter===1?groups.player1:groups.player2;
                blackWrong=balls.some(b=>b!==balls[0] && !b.pocketed && b.color===ownColor);
              }
              if(blackWrong) shotWrongFirstContact=true;
            }else if(groups && groupsAssigned && (hitTarget.color==='red'||hitTarget.color==='yellow')){
              const ownColor=shooter===1?groups.player1:groups.player2;
              if(hitTarget.color!==ownColor) shotWrongFirstContact=true;
            }
          }
        }
      }

      // La guía de destino solo controla el tramo inicial de la bola que
      // acaba de ser golpeada por la blanca. Si esa bola encuentra después
      // otra bola, desde ese instante manda la física normal del nuevo choque.
      if(firstTargetGuideActive && (a===firstShotTarget || b===firstShotTarget) && a!==balls[0] && b!==balls[0]){
        firstTargetGuideActive=false;
      }

      const aSpeed=Math.hypot(a.vx,a.vy), bSpeed=Math.hypot(b.vx,b.vy);
      const aMoving=aSpeed>0.10, bMoving=bSpeed>0.10;

      // Dos bolas quietas que ya están en contacto no se empujan.
      // Solo hay golpe si existe movimiento hacia la otra bola.
      if(!aMoving && !bMoving) continue;
      if(rel>=0) continue;

      // CONTACTO REAL: eliminamos TODA la penetración de este subpaso.
      // No dejamos una separación artificial entre las superficies.
      // Si la bola blanca es la que llega contra una bola quieta, la blanca
      // se detiene justo en el borde de contacto y la otra recibe el impulso.
      const correction=overlap + 0.02;
      let moveA=.5, moveB=.5;
      if(!aMoving && bMoving){moveA=0;moveB=1;}
      else if(aMoving && !bMoving){moveA=1;moveB=0;}

      a.x-=nx*correction*moveA/w;
      a.y-=ny*correction*moveA/h;
      b.x+=nx*correction*moveB/w;
      b.y+=ny*correction*moveB/h;

      // Recalcular la separación después de corregir para garantizar que
      // las superficies queden exactamente en contacto, sin hueco visual.
      const A2=px(a), B2=px(b);
      const dx2=B2.x-A2.x, dy2=B2.y-A2.y;
      const d2=Math.hypot(dx2,dy2)||minDist;
      if(Math.abs(d2-minDist)>0.05){
        const extra=d2-minDist;
        const ex=dx2/d2, ey=dy2/d2;
        if(extra>0){
          // Si quedó un hueco, acercarlas exactamente hasta el contacto.
          a.x+=ex*extra*moveA/w; a.y+=ey*extra*moveA/h;
          b.x-=ex*extra*moveB/w; b.y-=ey*extra*moveB/h;
        }
      }

      // Para un choque frontal centro-con-centro entre bolas de igual masa,
      // usamos un choque prácticamente elástico (e=1): la componente normal
      // de la velocidad de la blanca se transfiere a la bola objetivo y la
      // blanca queda detenida en esa línea. Esto evita que la blanca siga
      // avanzando después de un golpe recto, incluso con máxima fuerza.
      const restitution=(a===balls[0] || b===balls[0]) ? 0.80 : 0.80;
      const cueFirst = (a===balls[0]) ? a : ((b===balls[0]) ? b : null);
      const targetFirst = (cueFirst===a) ? b : ((cueFirst===b) ? a : null);
      // Un choque frontal se determina por la VELOCIDAD REAL de la blanca
      // en el instante del contacto, no por la distancia recorrida ni por el
      // ángulo guardado de la guía. Así funciona igual cerca o lejos.
      const cueSpeedNow = cueFirst ? Math.hypot(cueFirst.vx,cueFirst.vy) : 0;
      const cueUX = cueFirst && cueSpeedNow>1e-6 ? cueFirst.vx/cueSpeedNow : 0;
      const cueUY = cueFirst && cueSpeedNow>1e-6 ? cueFirst.vy/cueSpeedNow : 0;
      const along = cueUX*nx + cueUY*ny;
      const cross = cueUX*ny - cueUY*nx;
      const maxPowerShot = (Number(window.__shotPowerAtStrike)||0) >= 0.999;
      const frontImpact = cueFirst && targetFirst && maxPowerShot &&
        Math.hypot(targetFirst.vx,targetFirst.vy) < 0.5 &&
        along > 0.985 && Math.abs(cross) < 0.035;

      if(frontImpact){
        // Choque frontal de masas iguales: la blanca pierde toda su
        // componente de avance y la bola objetivo recibe esa velocidad.
        const incoming = Math.max(0, cueFirst.vx*nx + cueFirst.vy*ny);
        const tangent = cueFirst.vx*(-ny) + cueFirst.vy*nx;
        cueFirst.vx = (-ny) * tangent;
        cueFirst.vy = nx * tangent;
        targetFirst.vx = nx * incoming;
        targetFirst.vy = ny * incoming;
        cueFirst.sleeping = false;
        targetFirst.sleeping = false;
      }else{
        const impulse=-(1+restitution)*rel/2;
        a.vx-=impulse*nx; a.vy-=impulse*ny;
        b.vx+=impulse*nx; b.vy+=impulse*ny;
      }

      // En el primer choque de la blanca contra una bola quieta, la dirección
      // inicial de la bola objetivo depende ÚNICAMENTE de la normal de contacto.
      // La fuerza del tiro solo escala la magnitud de esa velocidad; nunca su
      // ángulo. Esto evita que una fuerza mayor cambie artificialmente el curso.
      if(a===balls[0] || b===balls[0]){
        const cue=(a===balls[0]) ? a : b;
        const target=(a===balls[0]) ? b : a;
        const wasTargetStill = Math.hypot(target.vx,target.vy) < 0.5;
        if(wasTargetStill){
          // PRIMER IMPACTO: la dirección de salida se fija con la normal
          // geométrica calculada ANTES del tiro. Por tanto, cambiar la fuerza
          // jamás puede girar la trayectoria; solo cambia su velocidad.
          if(target===firstShotTarget){
            // La física del contacto ya fijó la velocidad de salida. Solo
            // alineamos la bola objetivo con la normal del choque para evitar
            // pequeñas desviaciones numéricas de la guía.
            const currentTargetSpeed=Math.hypot(target.vx,target.vy);
            if(currentTargetSpeed>0){
              target.vx=firstShotExitNX*currentTargetSpeed;
              target.vy=firstShotExitNY*currentTargetSpeed;
            }
          } else {
            const cueNormalSpeed = Math.max(0, cue.vx*nx + cue.vy*ny);
            const targetSpeed = cueNormalSpeed * (1 + restitution) / 2;
            target.vx = nx * targetSpeed;
            target.vy = ny * targetSpeed;
          }
        }
        // El primer choque termina el bloqueo direccional de la blanca.
        whiteGuideActive=false;
      }
      a.sleeping=false; b.sleeping=false;
    }
  }

  // Durante el primer recorrido de la bola golpeada, su velocidad queda
  // exactamente alineada con la misma dirección que dibuja la guía de destino.
  // La magnitud puede cambiar por fricción, pero el ángulo no cambia por la
  // fuerza del tiro ni por pequeñas imprecisiones numéricas.
  if(firstTargetGuideActive && firstShotTarget && !firstShotTarget.pocketed){
    const tv=Math.hypot(firstShotTarget.vx, firstShotTarget.vy);
    if(tv>0){
      firstShotTarget.vx=firstShotExitNX*tv;
      firstShotTarget.vy=firstShotExitNY*tv;
    }
  }

  // Segunda pasada de estabilidad: mata cualquier velocidad residual mínima
  // producida por una colisión en el mismo subpaso.
  for(const b of balls){
    if(b.pocketed) continue;
    // Mientras la blanca todavía no ha golpeado ninguna bola, su velocidad
    // se mantiene exactamente sobre la dirección fijada por la línea de tiro.
    // Esto evita pequeñas desviaciones numéricas que hacían que la blanca se
    // apartara de la guía antes del impacto.
    if(b===balls[0] && whiteGuideActive){
      const guideAngle=(typeof lastAimAngle==='number' && Number.isFinite(lastAimAngle)) ? lastAimAngle : shotAngle;
      const currentSpeed=Math.hypot(b.vx,b.vy);
      if(currentSpeed>0){
        b.vx=Math.cos(guideAngle)*currentSpeed;
        b.vy=Math.sin(guideAngle)*currentSpeed;
      }
    }

    // Fricción física aplicada en cada subpaso. Esto evita que las bolas
    // sigan rodando indefinidamente y les da una sensación más pesada.
    let bf = (b===balls[0]) ? whiteFriction : f;
    const preFinalSpeed=Math.hypot(b.vx,b.vy);
    if(b===balls[0] && preFinalSpeed>0 && preFinalSpeed <= (Number(whitePhysicsSettings.finalStartSpeed)||60)){
      const finalStart=Math.max(0.1,Number(whitePhysicsSettings.finalStartSpeed)||60);
      const finalStop=Math.min(finalStart-0.001,Math.max(0.01,Number(whitePhysicsSettings.stopSpeed)||7));
      const finalTime=Math.max(0.1,Number(whitePhysicsSettings.finalBrakeTime)||2);
      bf=Math.pow(finalStop/finalStart, dt/finalTime);
    }
    b.vx *= bf;
    b.vy *= bf;

    const v=Math.hypot(b.vx,b.vy);
    const stopSpeed = (b===balls[0]) ? WHITE_FINAL_SPEED : FINAL_SPEED;
    if(v<stopSpeed){b.vx=0;b.vy=0;b.sleeping=true;}
  }
}

function hideScoreboardGroups(){
  document.querySelectorAll('.scoreboard-balls .scoreball').forEach(el=>{
    el.style.opacity='0';
    el.style.visibility='hidden';
  });
}

function updateScoreboardRemaining(){
  const groups=window.__playerBallGroups;
  if(!groups) return;
  const remaining={red:0,yellow:0};
  for(const b of balls){
    if(b!==balls[0] && !b.pocketed && (b.color==='red'||b.color==='yellow')) remaining[b.color]++;
  }
  const leftColor=groups.player1;
  const rightColor=groups.player2;
  document.querySelectorAll('.scoreboard-balls .scoreball').forEach(el=>{
    const cls=el.className;
    const isLeft=/\bsb-r[1-7]\b/.test(cls);
    const isRight=/\bsb-y[1-7]\b/.test(cls);
    const color=isLeft?leftColor:(isRight?rightColor:null);
    const m=cls.match(/sb-[ry](\d+)/);
    const idx=m?Number(m[1]):0;
    if(!color || !idx) return;
    // Cuando el jugador ya eliminó sus 7 bolas, el último espacio pasa a mostrar la 8.
    // Esto solo es un indicador del objetivo; la bola negra real de la mesa sigue siendo independiente.
    const showEight = (idx===7 && remaining[color]===0);
    if(showEight){
      el.src='bolas/bola_negra.png';
    }else{
      el.src = color==='red' ? 'bola_roja_marcador.png' : 'bola_amarilla_marcador.png';
    }
    const visible=showEight || idx<=remaining[color];
    el.style.opacity=visible?'1':'0';
    el.style.visibility=visible?'visible':'hidden';
  });
}

function showScoreboardGroupsForPlayers(player1Color){
  player1Color=(player1Color==='red'||player1Color==='yellow')?player1Color:'yellow';
  const player2Color=player1Color==='red'?'yellow':'red';
  const leftSrc=player1Color==='red'?'bola_roja_marcador.png':'bola_amarilla_marcador.png';
  const rightSrc=player2Color==='red'?'bola_roja_marcador.png':'bola_amarilla_marcador.png';
  document.querySelectorAll('.scoreboard-balls .scoreball').forEach(el=>{
    const cls=el.className;
    const isLeft=/\bsb-r[1-7]\b/.test(cls);
    const isRight=/\bsb-y[1-7]\b/.test(cls);
    if(isLeft){
      el.src=leftSrc;
      el.style.opacity='1';
      el.style.visibility='visible';
    }else if(isRight){
      el.src=rightSrc;
      el.style.opacity='1';
      el.style.visibility='visible';
    }
  });
  window.__playerBallGroups={player1:player1Color,player2:player2Color};
  updateScoreboardRemaining();
}

function assignGroupsFromFirstPostBreakPocket(){
  // Los colores SOLO se definen en un tiro posterior al saque.
  // Debe entrar una roja/amarilla en ESTE tiro y la blanca NO puede entrar.
  // Si el tiro es falta (incluido tocar primero la negra), NO se define ningún grupo.
  // La primera bola de color válida es la que fija los grupos para toda la partida.
  if(groupsAssigned || currentShotIsBreak || !breakShotCompleted || !shotFirstPocketedColor) return false;
  if(shotWhitePocketed || pendingWhiteRespawn || shotWrongFirstContact) return false;

  const shooter=(typeof window.__getLastShotPlayer==='function')?window.__getLastShotPlayer():1;
  const player1Color=shooter===1?shotFirstPocketedColor:(shotFirstPocketedColor==='red'?'yellow':'red');
  showScoreboardGroupsForPlayers(player1Color);
  groupsAssigned=true;
  return true;
}

function respawnWhiteWhenReady(){
  if(!pendingWhiteRespawn) return false;
  const othersMoving=balls.some((b,i)=>i!==0 && !b.pocketed && !b.sleeping && Math.hypot(b.vx,b.vy)>FINAL_SPEED);
  if(othersMoving) return false;
  const b=balls[0];
  if(!b) return false;
  const {w,h}=dimensions();
  b.x=pendingWhiteRespawn.x;
  b.y=pendingWhiteRespawn.y;
  b.vx=0; b.vy=0; b.sleeping=true; b.pocketed=false;
  b.el.style.display='block';
  b.el.style.opacity='';
  b.el.style.transform='';
  b.el.style.width=''; b.el.style.height='';
  b.el.style.left=''; b.el.style.top=''; b.el.style.zIndex='';
  pendingWhiteRespawn=null;
  shotRuleRespawnPending=false;
  placingCue=true;
  whitePlacementAvailable=true;
  placementHeld=false; placementPointerId=null; placementSideSigns=null;
  placeCueBtn.classList.add('active');
  aimLine.style.display='none'; aimDot.style.display='none'; impactLine.style.display='none';
  const ac=document.querySelector('#aimCue');
  if(ac) ac.style.visibility='hidden';
  statusEl.textContent='BLANCA REAPARECIÓ • MANTÉN CLIC Y ARRASTRA PARA COLOCARLA';
  render();
  requestAnimationFrame(()=>{
    try{ render(); if(typeof window.__updateDirectionalCue==='function') window.__updateDirectionalCue(); }catch(_){}
  });
  return true;
}

let physicsAccumulator=0;
let previousFrameTime=0;
let shotElapsed=0;
const FIXED_DT=1/480;
const MAX_FRAME_DT=0.04;

function frame(t){
  if(!previousFrameTime) previousFrameTime=t;
  const realDt=Math.min(MAX_FRAME_DT,Math.max(0,(t-previousFrameTime)/1000));
  previousFrameTime=t;

  // Mientras la blanca acaba de reaparecer, el taco apuntador debe quedar
  // sincronizado con ella inmediatamente, sin esperar a que se mueva el mouse.
  if(!whitePocketing && typeof placingCue!=='undefined' && placingCue && typeof window.__updateDirectionalCue==='function'){
    window.__updateDirectionalCue();
  }

  // Si la 8 ya fue embocada, el tiro no continúa hacia ningún estado de turno:
  // esperamos fuera del bloque 'moving' hasta que termine también la animación
  // de caída de la 8 y entonces mostramos el menú de fin de partida.
  if(gameOverPending && !moving){
    if(finishGameAfterBallsStop()){
      requestAnimationFrame(frame);
      return;
    }
  }

  if(!moving && pendingWhiteRespawn){
    respawnWhiteWhenReady();
  }

  if(moving){
    shotElapsed += realDt;
    if(shotElapsed >= (Number(whitePhysicsSettings.maxRollTime)||30)){
      // Límite absoluto: ningún tiro puede mantener una bola rodando más de 15 s.
      for(const b of balls){
        if(!b.pocketed){ b.vx=0; b.vy=0; b.sleeping=true; }
      }
      physicsAccumulator=0;
      moving=false;
      aiming=true;
      setPower(0);
      statusEl.textContent='LISTO • LAS BOLAS SE DETUVIERON (MÁX. 30 SEGUNDOS)';
      if(currentShotIsBreak) breakShotCompleted=true;
      assignGroupsFromFirstPostBreakPocket();
      if(typeof updateScoreboardRemaining==='function') updateScoreboardRemaining();
      if(typeof window.__finishTurnAfterShot==='function'){
        const objectPocketed=shotPocketedObjectBalls.size>0;
        window.__finishTurnAfterShot(objectPocketed, !!pendingWhiteRespawn, false, !!shotWrongFirstContact);
      }
      requestAnimationFrame(frame);
      return;
    }
    physicsAccumulator+=realDt;
    let steps=0;
    // Fixed-step simulation makes the ball paths deterministic and prevents
    // frame-rate-dependent jitter.
    while(physicsAccumulator>=FIXED_DT && steps<32){
      physics(FIXED_DT);
      physicsAccumulator-=FIXED_DT;
      steps++;
    }
    render();

    const movingBalls=balls.some(b=>!b.pocketed && !b.sleeping);
    if(!movingBalls){
      for(const b of balls){
        if(!b.pocketed){b.vx=0;b.vy=0;b.sleeping=true;}
      }
      physicsAccumulator=0;

      // FIN DE PARTIDA: la 8 ya fue embocada. Ahora, y solo ahora que
      // todas las bolas están detenidas y terminó cualquier entrada a tronera,
      // mostramos el menú con máxima prioridad. No cambiamos el turno ni
      // permitimos recolocar la blanca.
      if(finishGameAfterBallsStop()){
        requestAnimationFrame(frame);
        return;
      }

      // REGLA ESPECIAL DE REPOSICIÓN DE LA BLANCA:
      // 1) Si la blanca no tocó ninguna otra bola durante el tiro, o
      // 2) si tocó una bola pero ninguna bola tocó una banda,
      // se considera scratch y la blanca vuelve al CENTRO de la mesa.
      // La reposición solo ocurre cuando absolutamente todas las bolas se han detenido.
      // Reglas de recolocación de la blanca: SOLO se evalúan cuando todas
      // las bolas ya están completamente detenidas.
      // A) La blanca no tocó ninguna bola -> se permite recolocarla en su posición FINAL.
      // B) La blanca tocó una bola, pero NINGUNA bola tocó banda -> se permite
      //    recolocarla en su posición FINAL.
      // C) La blanca tocó banda pero NO tocó ninguna bola -> también es FALTA,
      //    así que se permite recolocarla en su posición FINAL.
      // D) Solo cuando la blanca tocó bola Y alguna bola tocó banda queda sin
      //    recolocación especial (tiro válido).
      const noCueContact = !shotHadCueCollision;
      const cueHitButNoCushion = shotHadCueCollision && !shotHadAnyCushionContact && !shotHadCueCushionContact;
      const cueHitMultipleBallsNoCushion = shotCueHitTargets.size > 1 && !shotHadAnyCushionContact && !shotHadCueCushionContact;
      const cueTouchedCushionWithoutBall = !shotHadCueCollision && (shotHadAnyCushionContact || shotHadCueCushionContact);
      // Si la blanca toca primero una banda y después golpea una o más bolas,
      // pero NINGUNA bola de color toca banda durante ese tiro, también es falta.
      const cueHitBallsAfterOwnCushionNoObjectCushion = shotHadCueCollision && shotHadCueCushionContact && !shotHadObjectCushionContact;
      // El saque termina cuando todas las bolas se detienen. A partir del
      // siguiente tiro, la primera bola roja/amarilla embocada asigna los grupos.
      if(currentShotIsBreak) breakShotCompleted=true;
      assignGroupsFromFirstPostBreakPocket();
      if(typeof updateScoreboardRemaining==='function') updateScoreboardRemaining();

      const anyObjectBallPocketed = shotPocketedObjectBalls.size>0;
      // La decisión del turno se toma SOLO cuando todas las bolas ya se frenaron
      // y después de saber si la blanca quedó habilitada para recolocarse.
      const legalContactForPlacement = noCueContact || cueHitButNoCushion || cueTouchedCushionWithoutBall;
      // Si la blanca entró en una tronera, la recolocación queda pendiente
      // independientemente de que también se hayan embocado otras bolas.
      // Cuando todas las bolas se detienen, la blanca reaparece en el centro
      // y puede volver a colocarse con clic sostenido.
      const whitePocketedWithOthers = !!pendingWhiteRespawn && anyObjectBallPocketed;
      const allowPendingWhitePlacement = !!pendingWhiteRespawn || whitePocketedWithOthers;
      const specialCuePlacement = !currentShotIsBreak && !allowPendingWhitePlacement && (noCueContact || cueHitButNoCushion || cueHitMultipleBallsNoCushion || cueTouchedCushionWithoutBall || cueHitBallsAfterOwnCushionNoObjectCushion);
      // Una falta por primer contacto con la bola del rival también concede
      // bola en mano al jugador que recibe el turno.
      const breakObjectCushionCount = shotObjectCushionBalls.size;
      // SAQUE INICIAL (máxima prioridad): si no entró ninguna bola de color,
      // menos de 4 bolas de color tocaron banda => rival con bola en mano;
      // 4 o más => rival sin bola en mano. Si entró bola(s) de color sin blanca,
      // conserva turno y NO puede mover la blanca. Si entró la blanca, rival + mano.
      const breakWhiteCanMove = currentShotIsBreak
        ? (allowPendingWhitePlacement || (!anyObjectBallPocketed && breakObjectCushionCount < 4))
        : false;
      const whiteCanMoveNow = currentShotIsBreak ? breakWhiteCanMove : (allowPendingWhitePlacement || specialCuePlacement || shotWrongFirstContact);

      // Regla solicitada: SIEMPRE que la blanca quede disponible para mover,
      // el turno cambia al otro jugador. Si la blanca NO se puede mover y entró
      // una bola de color, el turno se conserva; si no entró ninguna, cambia.
      if(typeof window.__finishTurnAfterShot==='function'){
        window.__finishTurnAfterShot(anyObjectBallPocketed, whiteCanMoveNow, !!pendingWhiteRespawn, !!shotWrongFirstContact);
      }

      moving=false;
      aiming=true;
      setPower(0);

      if(pendingWhiteRespawn){
        statusEl.textContent='BLANCA REPOSICIONADA • MANTÉN CLIC Y ARRASTRA PARA COLOCARLA';
      }else if(specialCuePlacement || shotWrongFirstContact){
        placingCue=true;
        whitePlacementAvailable=true;
        placementHeld=false; placementPointerId=null; placementSideSigns=null;
        placeCueBtn.classList.add('active');
        aimLine.style.display='none'; aimDot.style.display='none'; impactLine.style.display='none';
        const ac=document.querySelector('#aimCue');
        if(ac) ac.style.visibility='hidden';
        // La blanca ya está en su posición FINAL; solo se habilita su recolocación.
        statusEl.textContent='BLANCA EN SU POSICIÓN FINAL • MANTÉN CLIC Y ARRASTRA PARA COLOCARLA';
        render();
        requestAnimationFrame(()=>{
          try{ render(); if(typeof window.__updateDirectionalCue==='function') window.__updateDirectionalCue(); }catch(_){ }
        });
      }else{
        statusEl.textContent='LISTO • MANTÉN EL TACO Y BÁJALO PARA CARGAR FUERZA';
      }
    }
  }
  requestAnimationFrame(frame);
}

window.__breakBurstDone=false;
  setupBalls();
  // Apuntar desde el inicio: la guía sigue al cursor aunque no se esté haciendo clic.
  requestAnimationFrame(()=>{
    const cue=balls[0];
    if(cue){
      const c=px(cue);
      pointer.x=c.x+180; pointer.y=c.y;
      updateAim();
    }
  });
setPower(0);
const initial=dimensions();
pointer.x=initial.w*.7; pointer.y=initial.h*.5;
requestAnimationFrame(frame);

window.addEventListener('resize',render);


(function(){
  const button=document.getElementById('whiteEffectButton');
  const overlay=document.getElementById('whiteEffectOverlay');
  const editor=document.getElementById('whiteEffectEditor');
  const ring=document.getElementById('whiteEffectRingEditor');
  const smallBall=button?.querySelector('.white-effect-ball');
  const smallRing=button?.querySelector('.white-effect-ring');
  if(!button||!overlay||!editor||!ring||!smallRing) return;

  let dragging=false;
  let pointerId=null;
  // Posición del efecto guardada como coordenadas normalizadas (-1 a 1).
  // Se conserva mientras se juega y solo vuelve al centro después de un tiro.
  let effectX=0;
  let effectY=0;

  function applySmallRing(){
    const w=button.clientWidth || 140;
    const ringW=smallRing.getBoundingClientRect().width || 42;
    const cx=w/2, cy=w/2;
    const max=(w*0.487) - ringW*0.36 - 1;
    const x=cx + effectX*max;
    const y=cy + effectY*max;
    smallRing.style.left=(x-ringW/2)+'px';
    smallRing.style.top=(y-ringW/2)+'px';
  }

  function setEditorFromSaved(){
    const r=editor.getBoundingClientRect();
    const ringSize=ring.getBoundingClientRect().width;
    const cx=r.width/2, cy=r.height/2;
    const max=(Math.min(r.width,r.height)*0.487) - (ringSize/2)*0.73 - 4;
    ring.style.left=(cx + effectX*max-ringSize/2)+'px';
    ring.style.top=(cy + effectY*max-ringSize/2)+'px';
  }

  function openEffectEditor(){
    applySmallRing();
    overlay.classList.add('open');
    button.classList.add('hidden');
    overlay.setAttribute('aria-hidden','false');
    requestAnimationFrame(setEditorFromSaved);
  }
  function closeEffectEditor(){
    if(dragging) return;
    setEditorFromSaved();
    overlay.classList.remove('open');
    button.classList.remove('hidden');
    overlay.setAttribute('aria-hidden','true');
    applySmallRing();
  }

  button.addEventListener('click',e=>{
    e.preventDefault(); e.stopPropagation();
    if(overlay.classList.contains('open')) closeEffectEditor();
    else openEffectEditor();
  });
  button.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){ e.preventDefault(); button.click(); }
  });

  function moveRing(clientX,clientY){
    const r=editor.getBoundingClientRect();
    const ringSize=ring.getBoundingClientRect().width;
    const ringRadius=ringSize/2;
    const centerX=r.width/2, centerY=r.height/2;
    const ballRadius=Math.min(r.width,r.height)*0.487;
    const visualRingRadius=ringRadius*0.73;
    const maxCenterDistance=Math.max(0,ballRadius-visualRingRadius-4);
    let dx=clientX-r.left-centerX, dy=clientY-r.top-centerY;
    const dist=Math.hypot(dx,dy);
    if(dist>maxCenterDistance && dist>0){
      const scale=maxCenterDistance/dist;
      dx*=scale; dy*=scale;
    }
    effectX=maxCenterDistance ? dx/maxCenterDistance : 0;
    effectY=maxCenterDistance ? dy/maxCenterDistance : 0;
    ring.style.left=(centerX+dx-ringRadius)+'px';
    ring.style.top=(centerY+dy-ringRadius)+'px';
    applySmallRing();
  }

  ring.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse' && e.button!==0) return;
    dragging=true; pointerId=e.pointerId;
    ring.classList.add('dragging');
    try{ring.setPointerCapture(pointerId)}catch(_){ }
    moveRing(e.clientX,e.clientY);
    e.preventDefault(); e.stopPropagation();
  });
  ring.addEventListener('pointermove',e=>{
    if(!dragging||e.pointerId!==pointerId)return;
    moveRing(e.clientX,e.clientY);
    e.preventDefault(); e.stopPropagation();
  });
  function endDrag(e){
    if(!dragging||e.pointerId!==pointerId)return;
    dragging=false;
    ring.classList.remove('dragging');
    try{ring.releasePointerCapture(pointerId)}catch(_){ }
    pointerId=null;
    applySmallRing();
    e.preventDefault(); e.stopPropagation();
  }
  ring.addEventListener('pointerup',endDrag);
  ring.addEventListener('pointercancel',endDrag);

  overlay.addEventListener('pointerdown',e=>{
    if(e.target===overlay) closeEffectEditor();
  });

  window.addEventListener('keydown',e=>{
    if(e.key==='Escape' && overlay.classList.contains('open') && !dragging) closeEffectEditor();
  });

  // Después de un tiro el punto de efecto vuelve al centro.
  // shoot() llama a este método sin depender de variables internas del juego.
  window.resetWhiteEffectAfterShot=function(){
    effectX=0; effectY=0;
    applySmallRing();
    setEditorFromSaved();
  };

  // Expuesto para que el juego pueda conservar el valor si lo necesita.
  window.getWhiteEffectPosition=function(){return {x:effectX,y:effectY};};
  applySmallRing();
})();


(function(){
  const cue=document.querySelector('.cue-real');
  const holder=document.querySelector('.cue-holder');
  const fill=document.querySelector('#powerFill');
  const val=document.querySelector('#powerValue');
  const status=document.querySelector('.game-status');
  if(!cue||!holder||!fill||!val)return;

  let holding=false;
  let pid=null;
  let startY=0;
  let drag=0;
  const maxDrag=240;

  function syncLimitInputs(){
  const q=id=>document.getElementById(id); if(!q('limLeft')) return;
  q('limLeft').value=(editableLimits.left*100).toFixed(1); q('limRight').value=(editableLimits.right*100).toFixed(1);
  q('limTop').value=(editableLimits.top*100).toFixed(1); q('limBottom').value=(editableLimits.bottom*100).toFixed(1);
  q('pocketRadiusEdit').value=(editablePocketRadius*100).toFixed(1);
  const i=Math.max(1,Math.min(6,parseInt(q('pocketIndex').value||1,10)))-1; q('pocketX').value=(editablePockets[i][0]*100).toFixed(1); q('pocketY').value=(editablePockets[i][1]*100).toFixed(1);
}
function persistLimits(){ localStorage.setItem('billiardsLimits_1390x766',JSON.stringify(editableLimits)); localStorage.setItem('billiardsPockets_1390x766',JSON.stringify(editablePockets)); localStorage.setItem('billiardsPocketRadius_1390x766',editablePocketRadius); localStorage.setItem('billiardsCustomLimitSegments_1390x766',JSON.stringify(customLimitSegments)); }
function installLimitEditor(){
  const svg=document.getElementById('debugLimits'), wrapEl=document.querySelector('.table-wrap'); if(!svg||!wrapEl) return;
  document.body.classList.add('limit-editor-active'); syncLimitInputs();
  document.getElementById('editTableBtn').onclick=()=>{document.getElementById('tableControls').style.display='block';document.getElementById('pocketControls').style.display='none';document.getElementById('editTableBtn').classList.add('active');document.getElementById('editPocketsBtn').classList.remove('active');};
  document.getElementById('editPocketsBtn').onclick=()=>{document.getElementById('tableControls').style.display='none';document.getElementById('pocketControls').style.display='block';document.getElementById('editPocketsBtn').classList.add('active');document.getElementById('editTableBtn').classList.remove('active');syncLimitInputs();};
  ['limLeft','limRight','limTop','limBottom'].forEach(id=>document.getElementById(id).onchange=()=>{editableLimits.left=+document.getElementById('limLeft').value/100;editableLimits.right=+document.getElementById('limRight').value/100;editableLimits.top=+document.getElementById('limTop').value/100;editableLimits.bottom=+document.getElementById('limBottom').value/100;drawDebugLimits();});
  document.getElementById('pocketRadiusEdit').onchange=()=>{editablePocketRadius=+document.getElementById('pocketRadiusEdit').value/100;drawDebugLimits();};
  document.getElementById('pocketIndex').onchange=syncLimitInputs;
  ['pocketX','pocketY'].forEach(id=>document.getElementById(id).onchange=()=>{const i=+document.getElementById('pocketIndex').value-1;editablePockets[i][0]=+document.getElementById('pocketX').value/100;editablePockets[i][1]=+document.getElementById('pocketY').value/100;drawDebugLimits();});
  document.getElementById('saveLimits').onclick=()=>{persistLimits();syncLimitInputs();};
  document.getElementById('resetLimits').onclick=()=>{editableLimits={...DEFAULT_LIMITS};editablePockets=DEFAULT_POCKETS.map(p=>p.slice());editablePocketRadius=.030;persistLimits();syncLimitInputs();drawDebugLimits();};
  let drag=null;
  svg.addEventListener('pointerdown',e=>{ const t=e.target; if(!t.classList.contains('limit-handle')&&!t.classList.contains('limit-handle-pocket')) return; drag={type:t.dataset.type,index:+t.dataset.index}; svg.setPointerCapture(e.pointerId); });
  svg.addEventListener('pointermove',e=>{ if(!drag) return; const r=svg.getBoundingClientRect(),x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height)); if(drag.type==='left') editableLimits.left=x; if(drag.type==='right') editableLimits.right=x; if(drag.type==='top') editableLimits.top=y; if(drag.type==='bottom') editableLimits.bottom=y; if(drag.type==='pocket'){editablePockets[drag.index]=[x,y];document.getElementById('pocketIndex').value=drag.index+1;} syncLimitInputs(); drawDebugLimits(); });
  svg.addEventListener('pointerup',()=>drag=null); svg.addEventListener('pointercancel',()=>drag=null);
}
function render(){
    const pct=Math.max(0,Math.min(1,drag/maxDrag));
    // Ambos tacos permanecen sincronizados durante toda la carga.
    // El taco de referencia y el taco apuntador se alejan la misma distancia;
    // ninguno regresa a su posición mientras el botón siga presionado.
    holder.style.transform='translateY(calc(-50% + '+drag+'px))';
    const aimCueSync=document.querySelector('#aimCue');
    if(aimCueSync){
      const angleSync=(typeof lastAimAngle==='number' && Number.isFinite(lastAimAngle))
        ? lastAimAngle
        : ((typeof shotAngle==='number' && Number.isFinite(shotAngle)) ? shotAngle : 0);
      const chargeOffset=-drag;
      aimCueSync.style.setProperty('--charge-offset', chargeOffset+'px');
      aimCueSync.style.transform='translate(-100%,-50%) rotate('+angleSync+'rad) translateX('+chargeOffset+'px)';
    }
    fill.style.height=(pct*100)+'%';
    val.textContent=Math.round(pct*100)+'%';
    if(holding && status) status.textContent='FUERZA: '+Math.round(pct*100)+'%';
  }

  function begin(e){
    if(typeof moving!=='undefined' && moving)return;
    if(e.pointerType==='mouse' && e.button!==0)return;

    holding=true;
    pid=e.pointerId;
    startY=e.clientY;
    drag=0;

    try{cue.setPointerCapture(pid)}catch(_){}
    render();
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  function follow(e){
    if(!holding || e.pointerId!==pid)return;
    drag=Math.max(0,e.clientY-startY);
    render();
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  function release(e){
    if(!holding || e.pointerId!==pid)return;

    // THIS IS THE SHOT TRIGGER:
    // releasing the held click/finger starts the ball action immediately.
    const shotPower=Math.max(0,Math.min(1,drag/maxDrag));
    holding=false;

    // Congela ambos tacos en la posición cargada hasta que el disparo haya
    // sido iniciado; solo después se permite el retorno a la posición normal.
    const releasedDrag=drag;
    render();
    try{cue.releasePointerCapture(pid)}catch(_){}

    if(shotPower>0.005){
      if(typeof setPower==='function') setPower(shotPower);
      else if(typeof power!=='undefined') power=shotPower;
      if(typeof shoot==='function') shoot();
    }

    // Solo al soltar se libera la carga y ambos tacos regresan juntos
    // a su posición normal. Mientras holding=true, el segundo taco queda
    // exactamente en la posición correspondiente al primer taco.
    const finalAngle=(typeof lastAimAngle==='number' && Number.isFinite(lastAimAngle))
      ? lastAimAngle
      : ((typeof shotAngle==='number' && Number.isFinite(shotAngle)) ? shotAngle : 0);
    drag=0;
    holder.style.transform='translateY(-50%)';
    const aimCueSync=document.querySelector('#aimCue');
    if(aimCueSync){
      aimCueSync.style.removeProperty('--charge-offset');
      aimCueSync.style.transform='translate(-100%,-50%) rotate('+finalAngle+'rad)';
    }
    fill.style.height='0%';
    val.textContent='0%';
    pid=null;

    e.preventDefault();
    e.stopImmediatePropagation();
  }

  document.addEventListener('pointerup',e=>{
    if(holding && pid===e.pointerId) release(e);
  },true);

  cue.addEventListener('pointerdown',begin,true);
  cue.addEventListener('pointermove',follow,true);
  cue.addEventListener('pointerup',release,true);
  cue.addEventListener('pointercancel',release,true);
  cue.addEventListener('dragstart',e=>e.preventDefault(),true);

  render();
})();


(function(){
  const aimCue=document.querySelector('#aimCue');
  const table=document.querySelector('.table-wrap');
  if(!aimCue || !table) return;

  function updateDirectionalCue(){
    if(whitePocketing || (typeof pocketingBalls!=='undefined' && balls && balls[0] && pocketingBalls.has(balls[0]))){
      aimCue.style.display='none';
      return;
    }
    if(typeof moving!=='undefined' && moving){
      aimCue.style.display='none';
      return;
    }
    if(typeof balls==='undefined' || !balls[0] || balls[0].pocketed){
      aimCue.style.display='none';
      return;
    }

    const white=balls[0];
    const pos=typeof px==='function' ? px(white) : null;
    if(!pos) return;

    const angle=(typeof lastAimAngle==='number' && Number.isFinite(lastAimAngle))
      ? lastAimAngle
      : ((typeof shotAngle==='number' && Number.isFinite(shotAngle)) ? shotAngle : 0);

    // The tip of taco 2 must touch the EDGE of the white ball,
    // never pass through its center. It rotates around the ball as the
    // aiming direction changes.
    const ballR=(typeof ballRadius==='function') ? ballRadius() : 18;
    const tipX=pos.x-Math.cos(angle)*ballR;
    const tipY=pos.y-Math.sin(angle)*ballR;

    // The right edge is the tip/pivot. The shaft therefore stays behind
    // the white ball, opposite to the shot direction.
    aimCue.style.left=tipX+'px';
    aimCue.style.top=tipY+'px';
    aimCue.style.transform='translate(-100%,-50%) rotate('+angle+'rad) translateX(var(--charge-offset, 0px))';
    aimCue.style.display='block';
    // Forzar que el navegador aplique la nueva posición inmediatamente.
    void aimCue.offsetWidth;
  }

  // Exponer una actualización inmediata para casos como el reingreso
  // de la blanca desde una tronera, sin esperar al siguiente intervalo.
  window.__updateDirectionalCue=updateDirectionalCue;

  // Keep it synchronized with the game's render loop without changing input.
  setInterval(updateDirectionalCue, 16);
  // Sincronización inmediata adicional tras cambios de posición de la blanca.
  requestAnimationFrame(updateDirectionalCue);
  setTimeout(updateDirectionalCue,0);
  setTimeout(updateDirectionalCue,32);
})();

installLimitEditor();

window.__RECOVERED_DRAWN_LIMITS__ = {left:.052,right:.948,top:.103,bottom:.900};


/* Recuperación de límites dibujados por el usuario.
   Se conservan los mismos puntos y se normalizan a la mesa 1385x766.
   No se generan límites nuevos. */
(function(){
  const SOURCE_W=1385, SOURCE_H=766;
  function normalizeBoundaryData(data){
    if(!data) return data;
    const walk=(v)=>{
      if(Array.isArray(v)) return v.map(walk);
      if(v && typeof v==='object'){
        const o={};
        for(const k in v){
          let x=v[k];
          if((k==='x'||k==='left'||k==='right'||k==='width') && typeof x==='number' && Math.abs(x)>1) x=x/SOURCE_W;
          if((k==='y'||k==='top'||k==='bottom'||k==='height') && typeof x==='number' && Math.abs(x)>1) x=x/SOURCE_H;
          o[k]=walk(x);
        }
        return o;
      }
      return v;
    };
    return walk(data);
  }
  try{localStorage.setItem('billiardsLimits', JSON.stringify(normalizeBoundaryData(editableLimits)));}catch(e){}
  try{localStorage.setItem('billiardsCustomLimitSegments', JSON.stringify(normalizeBoundaryData(customLimitSegments)));}catch(e){}
  try{localStorage.setItem('billiardsLimits', JSON.stringify(normalizeBoundaryData(editableLimits)));}catch(e){}
  try{localStorage.setItem('billiardsCustomLimitSegments', JSON.stringify(normalizeBoundaryData(customLimitSegments)));}catch(e){}
})();


(function(){
  function initTimerEditor(){
    const timer=document.getElementById('turnTimer');
    const panel=document.getElementById('timerEditorPanel');
    const launch=document.getElementById('timerEditorLauncher');
    const close=document.getElementById('timerEditorClose');
    const save=document.getElementById('timerEditorSave');
    if(!timer||!panel||!launch) return;
    const left=document.getElementById('timerLeftRange'), top=document.getElementById('timerTopRange'), width=document.getElementById('timerWidthRange'), height=document.getElementById('timerHeightRange');
    const lo=document.getElementById('timerLeftOut'), to=document.getElementById('timerTopOut'), wo=document.getElementById('timerWidthOut'), ho=document.getElementById('timerHeightOut');
    let handle=timer.querySelector('#timerResizeHandle');
    if(!handle){ handle=document.createElement('div'); handle.id='timerResizeHandle'; timer.appendChild(handle); }
    const defaults={left:50,top:145,width:430,height:8};
    let cfg={...defaults};
    try{
      const saved=JSON.parse(localStorage.getItem('billiardsTurnTimerLayout')||'null');
      if(saved) cfg={...defaults,...saved};
    }catch(e){}

    function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
    function apply(){
      timer.style.left=cfg.left+'%';
      timer.style.top=cfg.top+'px';
      timer.style.width=cfg.width+'px';
      const track=timer.querySelector('.turn-timer-track');
      if(track) track.style.height=cfg.height+'px';
      left.value=cfg.left; top.value=cfg.top; width.value=cfg.width; height.value=cfg.height;
      lo.textContent=cfg.left.toFixed(1)+'%'; to.textContent=Math.round(cfg.top)+'px'; wo.textContent=Math.round(cfg.width)+'px'; ho.textContent=Math.round(cfg.height)+'px';
    }
    function persist(){
      localStorage.setItem('billiardsTurnTimerLayout',JSON.stringify(cfg));
    }
    function open(){
      panel.classList.add('open');
      timer.classList.add('timer-editing');
      apply();
      // Bring editor controls above every game layer.
      launch.style.zIndex='20000';
      panel.style.zIndex='20001';
    }
    function closeEditor(){
      panel.classList.remove('open');
      timer.classList.remove('timer-editing');
    }
    [left,top,width,height].forEach(el=>el.addEventListener('input',()=>{
      cfg.left=+left.value; cfg.top=+top.value; cfg.width=+width.value; cfg.height=+height.value; apply();
    }));

    let mode=null, sx=0, sy=0, startL=0, startT=0, startW=0;
    function startDrag(e){
      if(!panel.classList.contains('open')) return;
      if(e.target===handle) return;
      mode='drag'; sx=e.clientX; sy=e.clientY; startL=cfg.left; startT=cfg.top;
      try{timer.setPointerCapture(e.pointerId)}catch(_){ }
      e.preventDefault(); e.stopPropagation();
    }
    function startResize(e){
      if(!panel.classList.contains('open')) return;
      mode='resize'; sx=e.clientX; startW=cfg.width;
      try{handle.setPointerCapture(e.pointerId)}catch(_){ }
      e.preventDefault(); e.stopPropagation();
    }
    function move(e){
      if(mode==='drag'){
        // Horizontal position is relative to the main game area; vertical is its top offset.
        const main=timer.closest('.main') || document.body;
        const rect=main.getBoundingClientRect();
        const dx=(e.clientX-sx)/Math.max(1,rect.width)*100;
        const dy=e.clientY-sy;
        cfg.left=clamp(startL+dx,0,100);
        cfg.top=clamp(startT+dy,0,1000);
        apply();
      }else if(mode==='resize'){
        cfg.width=clamp(startW+(e.clientX-sx),120,900);
        apply();
      }
    }
    function end(){mode=null;}

    launch.addEventListener('click',open);
    close.addEventListener('click',closeEditor);
    save.addEventListener('click',()=>{persist(); closeEditor();});
    timer.addEventListener('pointerdown',startDrag);
    handle.addEventListener('pointerdown',startResize);
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',end);
    window.addEventListener('pointercancel',end);
    apply();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initTimerEditor,{once:true});
  else initTimerEditor();
})();


document.addEventListener('DOMContentLoaded',()=>{
  const board=document.querySelector('.scoreboard-reference');
  if(!board) return;
  const defaults={
    p1:{left:7.5,top:100.5,size:170},
    p2:{left:84.5,top:100.5,size:170}
  };
  let saved=defaults;
  try{
    saved=JSON.parse(localStorage.getItem('billiardsTurnIndicators2')||'null')||defaults;
  }catch(e){}
  const wraps={};
  const mk=(id,label)=>{
    const wrap=document.createElement('div');
    wrap.className='turn-indicator-wrap';
    wrap.dataset.id=id;
    const img=document.createElement('img');
    img.src='turno.png';
    img.alt=label;
    wrap.appendChild(img);
    board.appendChild(wrap);
    const cfg=saved[id]||defaults[id];
    wrap.style.left=(cfg.left ?? defaults[id].left)+'%';
    wrap.style.top=(cfg.top ?? defaults[id].top)+'%';
    wrap.style.width=(cfg.size ?? defaults[id].size)+'px';
    wraps[id]=wrap;
  };
  mk('p1','Turno de Jugador 1');
  mk('p2','Turno de Jugador 2');

  const timerFill=document.getElementById('turnTimerFill');
  const timerTrack=document.getElementById('turnTimerTrack');
  const TURN_DURATION=30000;
  let activePlayer=1;
  let startedAt=performance.now();
  let timerPaused=false;
  let shotPauseRemaining=TURN_DURATION;
  let waitingForShotResult=false;
  window.__getActiveTurnPlayer=()=>activePlayer;

  function renderTurn(){
    if(wraps.p1) wraps.p1.classList.toggle('inactive',activePlayer!==1);
    if(wraps.p2) wraps.p2.classList.toggle('inactive',activePlayer!==2);
  }
  function resetTurnClock(){
    window.__turnTimerShotActive=false;
    startedAt=performance.now();
    shotPauseRemaining=TURN_DURATION;
    timerPaused=false;
    waitingForShotResult=false;
    if(timerFill) timerFill.style.transform='scaleX(1)';
  }
  window.__resetTurnTimerForNewGame=resetTurnClock;
  window.__cancelTurnTimerForGameOver=function(){
    timerPaused=true; waitingForShotResult=false; window.__turnTimerShotActive=true;
  };
  function switchTurn(){
    activePlayer=activePlayer===1?2:1;
    if(timerTrack) timerTrack.classList.toggle('switched',activePlayer===2);
    renderTurn();
    resetTurnClock();
  }
  // Se llama justo al comenzar el tiro: congela exactamente el tiempo restante.
  window.__pauseTurnTimer=function(){
    window.__turnTimerShotActive=true;
    if(timerPaused) return;
    const elapsed=performance.now()-startedAt;
    shotPauseRemaining=Math.max(0,TURN_DURATION-elapsed);
    timerPaused=true;
    waitingForShotResult=true;
    const remain=Math.max(0,shotPauseRemaining/TURN_DURATION);
    if(timerFill) timerFill.style.transform=`scaleX(${remain})`;
  };
  // Se llama cuando TODAS las bolas se frenaron.
  // Regla de turno:
  // - Si NO entra ninguna amarilla/roja -> cambia de turno.
  // - Si entra amarilla/roja y NO entra la blanca -> conserva el turno.
  // - Si entra amarilla/roja Y también entra la blanca -> cambia de turno.
  // - Si ya hay grupos definidos y la blanca toca PRIMERO una bola del color
  //   contrario, es falta y cambia de turno al detenerse todas las bolas.
  window.__finishTurnAfterShot=function(objectPocketed,whiteCanMove,whitePocketed,foul){
    if(!waitingForShotResult) return;
    waitingForShotResult=false;
    if(foul || !objectPocketed || whitePocketed){
      switchTurn();
    }else{
      resetTurnClock();
    }
  };
  function tick(now){
    if(timerPaused || window.__turnTimerShotActive || waitingForShotResult){
      // Durante el tiro el cronómetro está totalmente congelado.
      requestAnimationFrame(tick);
      return;
    }
    const elapsed=now-startedAt;
    const remain=Math.max(0,1-elapsed/TURN_DURATION);
    if(timerFill) timerFill.style.transform=`scaleX(${remain})`;
    if(elapsed>=TURN_DURATION) switchTurn();
    requestAnimationFrame(tick);
  }
  renderTurn();
  resetTurnClock();
  requestAnimationFrame(tick);

  // Editor de física de la bola blanca: valores guardados en el navegador.
  const wpMax=document.querySelector('#wpMaxRoll'), wpF=document.querySelector('#wpFriction'), wpFS=document.querySelector('#wpFinalStart'), wpFT=document.querySelector('#wpFinalTime'), wpSS=document.querySelector('#wpStopSpeed'), wpSave=document.querySelector('#wpSave'), wpReset=document.querySelector('#wpReset'), wpStatus=document.querySelector('#wpStatus');
  function renderWhitePhysicsEditor(){ if(!wpMax)return; wpMax.value=whitePhysicsSettings.maxRollTime; wpF.value=(Number(whitePhysicsSettings.normalFriction)*100).toFixed(2); wpFS.value=whitePhysicsSettings.finalStartSpeed; wpFT.value=whitePhysicsSettings.finalBrakeTime; wpSS.value=whitePhysicsSettings.stopSpeed; }
  if(wpSave){ wpSave.addEventListener('click',()=>{ whitePhysicsSettings={maxRollTime:Math.max(1,Math.min(120,Number(wpMax.value)||30)), normalFriction:Math.max(.95,Math.min(.9999,(Number(wpF.value)||99.55)/100)), finalStartSpeed:Math.max(1,Number(wpFS.value)||60), finalBrakeTime:Math.max(.1,Math.min(10,Number(wpFT.value)||2)), stopSpeed:Math.max(.1,Math.min(30,Number(wpSS.value)||7))}; localStorage.setItem('whitePhysicsSettings_v1',JSON.stringify(whitePhysicsSettings)); wpStatus.textContent='✓ GUARDADO Y APLICADO'; setTimeout(()=>wpStatus.textContent='Valores guardados localmente',1200); }); }
  if(wpReset){ wpReset.addEventListener('click',()=>{ whitePhysicsSettings={maxRollTime:30,normalFriction:.9955,finalStartSpeed:60,finalBrakeTime:2,stopSpeed:7}; localStorage.setItem('whitePhysicsSettings_v1',JSON.stringify(whitePhysicsSettings)); renderWhitePhysicsEditor(); wpStatus.textContent='Valores restaurados'; }); }
  renderWhitePhysicsEditor();

});
