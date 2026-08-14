// Love Pong V1 - lightweight realtime multiplayer
let pongLoop=null,pongLastSync=0,pongLocalPaddle=.5;
const PONG_W=320,PONG_H=460,PADDLE_H=.24,BALL_R=.026;

function freshPong(){return {phase:'pong',hostY:.5,guestY:.5,ballX:.5,ballY:.5,vx:.0075*(Math.random()>.5?1:-1),vy:.0055*(Math.random()>.5?1:-1),hostScore:0,guestScore:0,winner:null,serving:true,serveAt:Date.now()+900};}

async function startLovePong(){
 if(!currentRoom?.guest_name)return;
 if(!isHost){alert('Host starts Love Pong 🏓❤️');return;}
 const state=freshPong();
 const {data,error}=await db.from('arcade_rooms').update({selected_game:'love-pong',status:'playing',game_state:state}).eq('id',currentRoom.id).select().single();
 if(error){console.error(error);alert('Could not start Love Pong yet.');return}
 renderRoom(data);
}

function showLovePong(room){
 const s=room.game_state;if(!s||s.phase!=='pong')return;
 $('roomPanel').classList.add('hidden');$('battlePanel').classList.add('hidden');$('pongPanel').classList.remove('hidden');
 $('pongRoomCode').textContent=room.room_code;
 $('pongBabyName').textContent=room.host_name||'Baby';$('pongSayangName').textContent=room.guest_name||'Sayang';
 $('pongScore').textContent=`${s.hostScore||0} — ${s.guestScore||0}`;
 $('pongStatus').textContent=s.winner?`${s.winner==='host'?(room.host_name||'Baby'):(room.guest_name||'Sayang')} wins! 🏆❤️`:(s.serving?'Get ready...':'First to 5 wins ❤️');
 pongLocalPaddle=isHost?(s.hostY??.5):(s.guestY??.5);
 drawPong(s);
 if(isHost&&!pongLoop)startPongHostLoop();
 if(!isHost&&pongLoop){clearInterval(pongLoop);pongLoop=null}
}

function drawPong(s){
 const c=$('pongCanvas'),ctx=c.getContext('2d'),w=c.width,h=c.height;
 ctx.clearRect(0,0,w,h);
 ctx.fillStyle='rgba(255,255,255,.05)';ctx.fillRect(0,0,w,h);
 ctx.strokeStyle='rgba(255,255,255,.14)';ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.stroke();ctx.setLineDash([]);
 const ph=h*PADDLE_H,pw=10;
 ctx.fillStyle='#f2cbd2';ctx.fillRect(12,(s.hostY??.5)*h-ph/2,pw,ph);
 ctx.fillStyle='#e8dfff';ctx.fillRect(w-22,(s.guestY??.5)*h-ph/2,pw,ph);
 ctx.font='26px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('❤️',(s.ballX??.5)*w,(s.ballY??.5)*h);
}

function startPongHostLoop(){
 if(pongLoop)clearInterval(pongLoop);
 pongLoop=setInterval(async()=>{
   if(!currentRoom||currentRoom.selected_game!=='love-pong'||currentRoom.game_state?.phase!=='pong'){clearInterval(pongLoop);pongLoop=null;return}
   const s=structuredClone(currentRoom.game_state);if(s.winner)return;
   if(Date.now()<(s.serveAt||0)){drawPong(s);return}
   s.serving=false;
   s.ballX+=s.vx;s.ballY+=s.vy;
   if(s.ballY<BALL_R){s.ballY=BALL_R;s.vy=Math.abs(s.vy)}
   if(s.ballY>1-BALL_R){s.ballY=1-BALL_R;s.vy=-Math.abs(s.vy)}
   const paddleHit=(side)=>{
     const py=side==='host'?s.hostY:s.guestY;
     return Math.abs(s.ballY-py)<PADDLE_H/2+.035;
   };
   if(s.ballX<.07&&s.vx<0&&paddleHit('host')){s.ballX=.07;s.vx=Math.abs(s.vx)*1.025;s.vy+=(s.ballY-s.hostY)*.012}
   if(s.ballX>.93&&s.vx>0&&paddleHit('guest')){s.ballX=.93;s.vx=-Math.abs(s.vx)*1.025;s.vy+=(s.ballY-s.guestY)*.012}
   if(s.ballX<-.03){s.guestScore=(s.guestScore||0)+1;resetPongBall(s,'host')}
   if(s.ballX>1.03){s.hostScore=(s.hostScore||0)+1;resetPongBall(s,'guest')}
   if(s.hostScore>=5){s.winner='host';s.serving=false}
   if(s.guestScore>=5){s.winner='guest';s.serving=false}
   drawPong(s);
   if(Date.now()-pongLastSync>80){pongLastSync=Date.now();const {data,error}=await db.from('arcade_rooms').update({game_state:s}).eq('id',currentRoom.id).select().single();if(!error)currentRoom=data;}
 },16);
}

function resetPongBall(s,toward){s.ballX=.5;s.ballY=.5;s.vx=.0075*(toward==='host'?-1:1);s.vy=.0055*(Math.random()>.5?1:-1);s.serving=true;s.serveAt=Date.now()+850;}

async function setPongPaddle(norm){
 if(!currentRoom||currentRoom.game_state?.phase!=='pong'||currentRoom.game_state?.winner)return;
 norm=Math.max(PADDLE_H/2,Math.min(1-PADDLE_H/2,norm));pongLocalPaddle=norm;
 const s=structuredClone(currentRoom.game_state);if(isHost)s.hostY=norm;else s.guestY=norm;currentRoom.game_state=s;drawPong(s);
 const now=Date.now();if(now-(setPongPaddle.last||0)<70)return;setPongPaddle.last=now;
 const patch=isHost?{'game_state':s}:{'game_state':s};
 const {data,error}=await db.from('arcade_rooms').update(patch).eq('id',currentRoom.id).select().single();if(!error)currentRoom=data;
}

function bindPongControls(){
 const c=$('pongCanvas');
 const pos=e=>{const r=c.getBoundingClientRect(),y=(e.touches?e.touches[0].clientY:e.clientY)-r.top;setPongPaddle(y/r.height)};
 c.addEventListener('touchstart',e=>{e.preventDefault();pos(e)},{passive:false});c.addEventListener('touchmove',e=>{e.preventDefault();pos(e)},{passive:false});
 c.addEventListener('pointerdown',pos);c.addEventListener('pointermove',e=>{if(e.buttons)pos(e)});
 $('pongUpBtn').onclick=()=>setPongPaddle(pongLocalPaddle-.12);$('pongDownBtn').onclick=()=>setPongPaddle(pongLocalPaddle+.12);
}

async function exitLovePong(){
 if(pongLoop){clearInterval(pongLoop);pongLoop=null}
 $('pongPanel').classList.add('hidden');$('roomPanel').classList.remove('hidden');
 if(isHost&&currentRoom){const {data}=await db.from('arcade_rooms').update({selected_game:null,status:'ready',game_state:{}}).eq('id',currentRoom.id).select().single();if(data)renderRoom(data)}
}

async function rematchLovePong(){if(!isHost)return;await startLovePong()}
window.addEventListener('DOMContentLoaded',bindPongControls);
