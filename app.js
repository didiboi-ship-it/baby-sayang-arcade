const SUPABASE_URL='https://lodrmcojkxedwsmkinyj.supabase.co';
const SUPABASE_KEY='sb_publishable_tlT9YGMMLBndjqguXwC-3A_lBZR0GKn';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

let currentRoom=null;
let roomChannel=null;
let isHost=false;

const $=id=>document.getElementById(id);
const createTab=$('createTab'),joinTab=$('joinTab'),createView=$('createView'),joinView=$('joinView');
const lobbyPanel=$('lobbyPanel'),roomPanel=$('roomPanel'),statusText=$('statusText');

function setTab(mode){
  const create=mode==='create';
  createTab.classList.toggle('active',create);
  joinTab.classList.toggle('active',!create);
  createView.classList.toggle('hidden',!create);
  joinView.classList.toggle('hidden',create);
  statusText.textContent='';
}
createTab.onclick=()=>setTab('create');
joinTab.onclick=()=>setTab('join');

function makeCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code='';
  for(let i=0;i<4;i++) code+=chars[Math.floor(Math.random()*chars.length)];
  return code;
}

async function createRoom(){
  const btn=$('createRoomBtn');
  btn.disabled=true; statusText.textContent='Creating your room...';
  try{
    let row=null,attempts=0;
    while(!row && attempts<5){
      const code=makeCode(); attempts++;
      const {data,error}=await db.from('arcade_rooms').insert({room_code:code,host_name:$('hostName').value.trim()||'Baby',status:'waiting'}).select().single();
      if(!error) row=data;
      else if(error.code!=='23505') throw error;
    }
    if(!row) throw new Error('Could not create a unique room code.');
    isHost=true;
    enterRoom(row);
  }catch(err){statusText.textContent='Could not create room. Try again ❤️'; console.error(err)}
  finally{btn.disabled=false}
}

async function joinRoom(){
  const btn=$('joinRoomBtn');
  const code=$('roomCodeInput').value.trim().toUpperCase();
  const name=$('guestName').value.trim()||'Sayang';
  if(!code){statusText.textContent='Enter the room code dulu 💗';return}
  btn.disabled=true; statusText.textContent='Looking for the room...';
  try{
    const {data:room,error}=await db.from('arcade_rooms').select('*').eq('room_code',code).maybeSingle();
    if(error) throw error;
    if(!room){statusText.textContent='Room tak jumpa 🥺 check code balik.';return}
    if(room.guest_name){statusText.textContent='Room ni dah ada dua player ❤️';return}
    const {data:updated,error:updateError}=await db.from('arcade_rooms').update({guest_name:name,status:'ready'}).eq('id',room.id).is('guest_name',null).select().maybeSingle();
    if(updateError) throw updateError;
    if(!updated){statusText.textContent='Someone joined this room first 🥺';return}
    isHost=false;
    enterRoom(updated);
  }catch(err){statusText.textContent='Could not join room. Try again ❤️'; console.error(err)}
  finally{btn.disabled=false}
}

function renderRoom(room){
  currentRoom=room;
  $('roomCodeLabel').textContent=room.room_code;
  $('hostLabel').textContent=room.host_name||'Baby';
  $('guestLabel').textContent=room.guest_name||'Waiting...';
  const connected=Boolean(room.guest_name);
  $('connectionState').textContent=connected?'Both players are connected ❤️':'Waiting for your person to join...';
  $('connectionState').classList.toggle('ready',connected);
  document.querySelector('[data-game="card-battle"]').disabled=!connected;
}

function enterRoom(room){
  statusText.textContent='';
  lobbyPanel.classList.add('hidden');
  roomPanel.classList.remove('hidden');
  renderRoom(room);
  subscribeRoom(room.id);
}

function subscribeRoom(roomId){
  if(roomChannel) db.removeChannel(roomChannel);
  roomChannel=db.channel(`arcade-room-${roomId}`)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'arcade_rooms',filter:`id=eq.${roomId}`},payload=>renderRoom(payload.new))
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'arcade_rooms',filter:`id=eq.${roomId}`},()=>resetToLobby('Room closed.'))
    .subscribe();
}

async function leaveRoom(){
  if(!currentRoom){resetToLobby();return}
  try{
    if(isHost){await db.from('arcade_rooms').delete().eq('id',currentRoom.id)}
    else{await db.from('arcade_rooms').update({guest_name:null,status:'waiting',selected_game:null}).eq('id',currentRoom.id)}
  }catch(err){console.error(err)}
  resetToLobby();
}

function resetToLobby(message=''){
  if(roomChannel){db.removeChannel(roomChannel);roomChannel=null}
  currentRoom=null; isHost=false;
  roomPanel.classList.add('hidden');
  lobbyPanel.classList.remove('hidden');
  statusText.textContent=message;
}

$('createRoomBtn').onclick=createRoom;
$('joinRoomBtn').onclick=joinRoom;
$('roomCodeInput').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''));
$('copyCodeBtn').onclick=async()=>{if(!currentRoom)return;try{await navigator.clipboard.writeText(currentRoom.room_code);$('copyCodeBtn').textContent='Copied ❤️';setTimeout(()=>$('copyCodeBtn').textContent='Copy room code',1400)}catch{alert(`Room code: ${currentRoom.room_code}`)}};
$('leaveRoomBtn').onclick=leaveRoom;

document.querySelector('[data-game="card-battle"]').onclick=async()=>{
  if(!currentRoom?.guest_name)return;
  try{
    const {data,error}=await db.from('arcade_rooms').update({selected_game:'card-battle',status:'playing',game_state:{phase:'setup'}}).eq('id',currentRoom.id).select().single();
    if(error)throw error;
    renderRoom(data);
    alert('Couple Card Battle room sync berjaya 🃏❤️ Game screen kita bina next.');
  }catch(err){console.error(err);alert('Could not start game yet.')}
};

window.addEventListener('beforeunload',()=>{if(roomChannel) db.removeChannel(roomChannel)});