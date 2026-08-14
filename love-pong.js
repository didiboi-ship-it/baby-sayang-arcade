// Love Pong V1 - client-predicted realtime multiplayer
let pongLoop=null,pongLocalPaddle=.5,pongGuestAnim=null,pongVisual=null,pongTarget=null,pongFastChannel=null;
let pongRemoteGuestY=.5,pongLastBroadcast=0,pongLastPersist=0,pongLastPersistScore='0-0';
const PADDLE_H=.24,BALL_R=.026,WIN_SCORE=3;

function freshPong(){return {phase:'pong',hostY:.5,guestY:.5,ballX:.5,ballY:.5,vx:.0075*(Math.random()>.5?1:-1),vy:.0055*(Math.random()>.5?1:-1),hostScore:0,guestScore:0,winner:null,serving:true,serveAt:Date.now()+900};}

function ensurePongFastChannel(){
 if(!currentRoom)return;
 const topic=`pong-fast-${currentRoom.id}`;
 if(pongFastChannel?.topic===`realtime:${topic}`)return;
 if(pongFastChannel)db.removeChannel(pongFastChannel);
 pongFastChannel=db.channel(topic,{config:{broadcast:{self:false}}})
   .on('broadcast',{event:'pong_state'},({payload})=>{
      if(isHost||!payload)return;
      pongTarget={...payload,guestY:pongLocalPaddle,receivedAt:performance.now()};
      if(!pongVisual)pongVisual={...payload,guestY:pongLocalPaddle};
      $('pongScore').textContent=`${payload.hostScore||0} — ${payload.guestScore||0}`;
      $('pongStatus').textContent=payload.winner?`${payload.winner==='host'?(currentRoom.host_name||'Baby'):(currentRoom.guest_name||'Sayang')} wins! 🏆❤️`:(payload.serving?'Get ready...':'First to 3 wins ❤️');
   })
   .on('broadcast',{event:'guest_paddle'},({payload})=>{if(isHost&&payload?.y!=null){pongRemoteGuestY=payload.y;currentRoom.guest_paddle=payload.y;}})
   .subscribe();
}

async function startLovePong(){if(!currentRoom?.guest_name)return;if(!isHost){alert('Host starts Love Pong 🏓❤️');return}const state=freshPong();pongRemoteGuestY=.5;pongLastPersistScore='0-0';const {data,error}=await db.from('arcade_rooms').update({selected_game:'love-pong',status:'playing',game_state:state,host_paddle:.5,guest_paddle:.5}).eq('id',currentRoom.id).select().single();if(error){console.error(error);alert('Could not start Love Pong yet.');return}renderRoom(data)}

function showLovePong(room){const s=room.game_state;if(!s||s.phase!=='pong')return;$('roomPanel').classList.add('hidden');$('battlePanel').classList.add('hidden');$('pongPanel').classList.remove('hidden');$('pongRoomCode').textContent=room.room_code;$('pongBabyName').textContent=room.host_name||'Baby';$('pongSayangName').textContent=room.guest_name||'Sayang';$('pongScore').textContent=`${s.hostScore||0} — ${s.guestScore||0}`;$('pongStatus').textContent=s.winner?`${s.winner==='host'?(room.host_name||'Baby'):(room.guest_name||'Sayang')} wins! 🏆❤️`:(s.serving?'Get ready...':'First to 3 wins ❤️');pongLocalPaddle=isHost?(room.host_paddle??.5):(room.guest_paddle??.5);pongRemoteGuestY=room.guest_paddle??pongRemoteGuestY;ensurePongFastChannel();const drawState={...s,hostY:room.host_paddle??s.hostY,guestY:room.guest_paddle??s.guestY};if(isHost){currentRoom.game_state={...s};drawPong(drawState);if(!pongLoop)startPongHostLoop();stopGuestAnimation()}else{pongTarget={...drawState,receivedAt:performance.now()};if(!pongVisual)pongVisual={...drawState};startGuestAnimation();if(pongLoop){clearInterval(pongLoop);pongLoop=null}}}

function drawPong(s){const c=$('pongCanvas'),ctx=c.getContext('2d'),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='rgba(255,255,255,.05)';ctx.fillRect(0,0,w,h);ctx.strokeStyle='rgba(255,255,255,.14)';ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.stroke();ctx.setLineDash([]);const ph=h*PADDLE_H,pw=10;ctx.fillStyle='#f2cbd2';ctx.fillRect(12,(s.hostY??.5)*h-ph/2,pw,ph);ctx.fillStyle='#e8dfff';ctx.fillRect(w-22,(s.guestY??.5)*h-ph/2,pw,ph);ctx.font='26px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('❤️',(s.ballX??.5)*w,(s.ballY??.5)*h)}

function startGuestAnimation(){
 if(pongGuestAnim)return;
 let last=performance.now();
 const tick=now=>{
   if(isHost||!pongTarget||$('pongPanel').classList.contains('hidden')){pongGuestAnim=null;return}
   if(!pongVisual)pongVisual={...pongTarget};
   const dt=Math.min(34,now-last)/16.666;last=now;
   if(!pongTarget.winner&&!pongTarget.serving){
     pongVisual.ballX+=(pongTarget.vx||0)*dt;
     pongVisual.ballY+=(pongTarget.vy||0)*dt;
     if(pongVisual.ballY<BALL_R){pongVisual.ballY=BALL_R;pongVisual.vy=Math.abs(pongTarget.vy||0)}
     if(pongVisual.ballY>1-BALL_R){pongVisual.ballY=1-BALL_R;pongVisual.vy=-Math.abs(pongTarget.vy||0)}
   }
   // Tiny correction toward authoritative position, instead of snapping every network packet.
   const dx=(pongTarget.ballX??.5)-(pongVisual.ballX??.5),dy=(pongTarget.ballY??.5)-(pongVisual.ballY??.5);
   const hard=Math.hypot(dx,dy)>.18;
   const correction=hard?.7:.08;
   pongVisual.ballX+=dx*correction;pongVisual.ballY+=dy*correction;
   pongVisual.vx=pongTarget.vx;pongVisual.vy=pongTarget.vy;
   pongVisual.hostY+=( (pongTarget.hostY??.5)-(pongVisual.hostY??.5) )*.25;
   pongVisual.guestY=pongLocalPaddle;
   pongVisual.serving=pongTarget.serving;pongVisual.winner=pongTarget.winner;
   drawPong(pongVisual);pongGuestAnim=requestAnimationFrame(tick);
 };
 pongGuestAnim=requestAnimationFrame(tick);
}
function stopGuestAnimation(){if(pongGuestAnim){cancelAnimationFrame(pongGuestAnim);pongGuestAnim=null}pongVisual=null;pongTarget=null}

function startPongHostLoop(){if(pongLoop)clearInterval(pongLoop);pongLoop=setInterval(()=>{if(!currentRoom||currentRoom.selected_game!=='love-pong'||currentRoom.game_state?.phase!=='pong'){clearInterval(pongLoop);pongLoop=null;return}const s=currentRoom.game_state;if(s.winner){broadcastPongState(s,true);return}s.hostY=currentRoom.host_paddle??s.hostY;s.guestY=pongRemoteGuestY??s.guestY;if(Date.now()>=(s.serveAt||0)){s.serving=false;s.ballX+=s.vx;s.ballY+=s.vy;if(s.ballY<BALL_R){s.ballY=BALL_R;s.vy=Math.abs(s.vy)}if(s.ballY>1-BALL_R){s.ballY=1-BALL_R;s.vy=-Math.abs(s.vy)}const paddleHit=side=>Math.abs(s.ballY-(side==='host'?s.hostY:s.guestY))<PADDLE_H/2+.035;if(s.ballX<.07&&s.vx<0&&paddleHit('host')){s.ballX=.07;s.vx=Math.abs(s.vx)*1.025;s.vy+=(s.ballY-s.hostY)*.012}if(s.ballX>.93&&s.vx>0&&paddleHit('guest')){s.ballX=.93;s.vx=-Math.abs(s.vx)*1.025;s.vy+=(s.ballY-s.guestY)*.012}if(s.ballX<-.03){s.guestScore=(s.guestScore||0)+1;resetPongBall(s,'host')}if(s.ballX>1.03){s.hostScore=(s.hostScore||0)+1;resetPongBall(s,'guest')}if(s.hostScore>=WIN_SCORE){s.winner='host';s.serving=false}if(s.guestScore>=WIN_SCORE){s.winner='guest';s.serving=false}}drawPong(s);$('pongScore').textContent=`${s.hostScore||0} — ${s.guestScore||0}`;$('pongStatus').textContent=s.winner?`${s.winner==='host'?(currentRoom.host_name||'Baby'):(currentRoom.guest_name||'Sayang')} wins! 🏆❤️`:(s.serving?'Get ready...':'First to 3 wins ❤️');broadcastPongState(s,false);const scoreKey=`${s.hostScore}-${s.guestScore}`;if(scoreKey!==pongLastPersistScore||s.winner||Date.now()-pongLastPersist>1500){pongLastPersistScore=scoreKey;pongLastPersist=Date.now();db.from('arcade_rooms').update({game_state:{...s}}).eq('id',currentRoom.id).then(()=>{})}},16)}

function broadcastPongState(s,force){const now=Date.now();if(!pongFastChannel||(!force&&now-pongLastBroadcast<50))return;pongLastBroadcast=now;pongFastChannel.send({type:'broadcast',event:'pong_state',payload:{phase:'pong',hostY:s.hostY,guestY:s.guestY,ballX:s.ballX,ballY:s.ballY,vx:s.vx,vy:s.vy,hostScore:s.hostScore,guestScore:s.guestScore,winner:s.winner,serving:s.serving}})}
function resetPongBall(s,toward){s.ballX=.5;s.ballY=.5;s.vx=.0075*(toward==='host'?-1:1);s.vy=.0055*(Math.random()>.5?1:-1);s.serving=true;s.serveAt=Date.now()+700}

async function setPongPaddle(norm){if(!currentRoom||currentRoom.game_state?.phase!=='pong'||currentRoom.game_state?.winner)return;norm=Math.max(PADDLE_H/2,Math.min(1-PADDLE_H/2,norm));pongLocalPaddle=norm;if(isHost){currentRoom.host_paddle=norm;currentRoom.game_state.hostY=norm;drawPong({...currentRoom.game_state,guestY:pongRemoteGuestY})}else{currentRoom.guest_paddle=norm;if(pongVisual)pongVisual.guestY=norm;ensurePongFastChannel();pongFastChannel?.send({type:'broadcast',event:'guest_paddle',payload:{y:norm}})}const now=Date.now();if(now-(setPongPaddle.last||0)<250)return;setPongPaddle.last=now;db.from('arcade_rooms').update(isHost?{host_paddle:norm}:{guest_paddle:norm}).eq('id',currentRoom.id).then(()=>{})}
function bindPongControls(){const c=$('pongCanvas');const pos=e=>{const r=c.getBoundingClientRect(),y=(e.touches?e.touches[0].clientY:e.clientY)-r.top;setPongPaddle(y/r.height)};c.addEventListener('touchstart',e=>{e.preventDefault();pos(e)},{passive:false});c.addEventListener('touchmove',e=>{e.preventDefault();pos(e)},{passive:false});c.addEventListener('pointerdown',pos);c.addEventListener('pointermove',e=>{if(e.buttons)pos(e)});$('pongUpBtn').onclick=()=>setPongPaddle(pongLocalPaddle-.12);$('pongDownBtn').onclick=()=>setPongPaddle(pongLocalPaddle+.12)}
async function exitLovePong(){if(pongLoop){clearInterval(pongLoop);pongLoop=null}stopGuestAnimation();if(pongFastChannel){db.removeChannel(pongFastChannel);pongFastChannel=null}$('pongPanel').classList.add('hidden');$('roomPanel').classList.remove('hidden');if(isHost&&currentRoom){const {data}=await db.from('arcade_rooms').update({selected_game:null,status:'ready',game_state:{}}).eq('id',currentRoom.id).select().single();if(data)renderRoom(data)}}
async function rematchLovePong(){if(isHost)await startLovePong()}
window.addEventListener('DOMContentLoaded',bindPongControls);
