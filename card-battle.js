// Couple Card Battle V1
const CARD_DECK=['attack','attack','attack','heal','heal','protect','protect','steal','skip','rare'];
const CARD_INFO={attack:['💥','Attack','-2 ❤️'],heal:['💗','Heal','+2 ❤️'],protect:['🛡️','Protect','Block next hit'],steal:['😈','Steal Heart','Steal 1 ❤️'],skip:['😏','Skip','Skip their turn'],rare:['💌','Love Letter','Heal 3 ❤️ + shield']};
const drawCard=()=>CARD_DECK[Math.floor(Math.random()*CARD_DECK.length)];
const hand=()=>Array.from({length:5},drawCard);

function freshBattle(){return {phase:'battle',turn:'host',host:{hp:10,shield:false,hand:hand()},guest:{hp:10,shield:false,hand:hand()},winner:null,log:'The battle begins ❤️'};}

function showBattle(room){
 const s=room.game_state;
 if(!s||s.phase!=='battle')return;
 $('roomPanel').classList.add('hidden'); $('battlePanel').classList.remove('hidden');
 $('battleRoomCode').textContent=room.room_code;
 $('babyName').textContent=room.host_name||'Baby'; $('sayangName').textContent=room.guest_name||'Sayang';
 $('babyHp').textContent='❤️'.repeat(Math.max(0,s.host.hp))||'💔'; $('sayangHp').textContent='❤️'.repeat(Math.max(0,s.guest.hp))||'💔';
 const me=isHost?'host':'guest', my=s[me];
 $('turnText').textContent=s.winner?`${s.winner==='host'?room.host_name:room.guest_name} wins! 🏆❤️`:(s.turn===me?'Your turn 🃏':'Waiting for your person...');
 $('battleLog').textContent=s.log||'';
 const area=$('myHand'); area.innerHTML='';
 my.hand.forEach((type,i)=>{const [em,n,desc]=CARD_INFO[type]; const b=document.createElement('button'); b.className='battle-card'; b.disabled=Boolean(s.winner)||s.turn!==me; b.innerHTML=`<span>${em}</span><b>${n}</b><small>${desc}</small>`; b.onclick=()=>playBattleCard(i); area.appendChild(b)});
 $('rematchBtn').classList.toggle('hidden',!s.winner||!isHost);
}

async function startCardBattle(){
 if(!currentRoom?.guest_name)return;
 if(!isHost){alert('Host starts the battle ❤️');return;}
 await updateBattle(freshBattle(),'card-battle','playing');
}

async function updateBattle(state,selected='card-battle',status='playing'){
 const {data,error}=await db.from('arcade_rooms').update({selected_game:selected,status,game_state:state}).eq('id',currentRoom.id).select().single();
 if(error){console.error(error);alert('Sync problem. Try again ❤️');return}
 renderRoom(data);
}

async function playBattleCard(index){
 const s=structuredClone(currentRoom.game_state), me=isHost?'host':'guest', them=isHost?'guest':'host';
 if(s.phase!=='battle'||s.turn!==me||s.winner)return;
 const type=s[me].hand[index]; if(!type)return;
 const mine=s[me], enemy=s[them];
 const myName=isHost?(currentRoom.host_name||'Baby'):(currentRoom.guest_name||'Sayang');
 const enemyName=isHost?(currentRoom.guest_name||'Sayang'):(currentRoom.host_name||'Baby');
 let msg='';
 const hit=(damage)=>{if(enemy.shield){enemy.shield=false;msg=`${enemyName}'s shield blocked the hit 🛡️`;}else{enemy.hp=Math.max(0,enemy.hp-damage);msg=`${myName} hit ${enemyName} for ${damage} ❤️`}};
 if(type==='attack')hit(2);
 if(type==='heal'){mine.hp=Math.min(10,mine.hp+2);msg=`${myName} healed 2 hearts 💗`;}
 if(type==='protect'){mine.shield=true;msg=`${myName} activated a shield 🛡️`;}
 if(type==='steal'){if(enemy.shield){enemy.shield=false;msg=`${enemyName}'s shield stopped the steal 🛡️`;}else{enemy.hp=Math.max(0,enemy.hp-1);mine.hp=Math.min(10,mine.hp+1);msg=`${myName} stole a heart 😈❤️`;}}
 if(type==='skip'){msg=`${myName} used Skip 😏 — another turn!`;}
 if(type==='rare'){mine.hp=Math.min(10,mine.hp+3);mine.shield=true;msg=`${myName} used the rare Love Letter 💌 +3 ❤️ & shield!`;}
 mine.hand.splice(index,1,drawCard());
 if(enemy.hp<=0){s.winner=me;s.turn=null;msg=`${myName} wins the Couple Card Battle! 🏆❤️`;}
 else if(type!=='skip')s.turn=them;
 s.log=msg;
 await updateBattle(s);
}

async function exitBattle(){
 if(!currentRoom)return;
 $('battlePanel').classList.add('hidden'); $('roomPanel').classList.remove('hidden');
 if(isHost) await updateBattle({},null,'ready');
}
