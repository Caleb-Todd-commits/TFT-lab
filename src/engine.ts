/** Deterministic, intentionally approximate TFT auto-battle model.
 * This does NOT emulate champion-specific spells, trait scripts, or Riot's server.
 * It models hex movement, attacks, armor/MR, mana casts, shields and targeting.
 */
export type Side = 0 | 1;
export type Stats = { hp: number; attack: number; armor: number; mr: number; speed: number; range: number; mana: number; initialMana: number; ap: number; crit: number };
export type Champion = { id: string; name: string; cost: number; traits: string[]; icon?: string; ability?: string; stats: Stats };
export type Placed = { uid: string; championId: string; team: Side; x: number; y: number; stars: 1|2|3; items: string[]; locked?: boolean };
export type Board = { units: Placed[] };
export type CombatEvent = { time: number; text: string };
export type Fight = { winner: Side|2; duration: number; surviving: [number,number]; damage: [number,number]; health: [number,number]; events: CombatEvent[] };
export type Aggregate = { iterations: number; wins: number; losses: number; draws: number; winRate: number; avgHealthLead: number; avgDamage: number; avgDuration: number };
export type Item = { id: string; name: string; description?: string; stats?: Partial<Stats>; icon?: string };
export type Catalogue = { patch: string; verified: boolean; status: string; champions: Champion[]; items: Item[]; traits: { name:string; breakpoints:number[] }[]; source: string };
export const WIDTH = 7, HEIGHT = 8;
export const validPosition = (x:number,y:number, team: Side) => Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<7&&y>= (team===0?0:4)&&y<(team===0?4:8);
export function validateBoard(board:Board,catalogue:Catalogue) {
  const ids = new Set(catalogue.champions.map(c=>c.id)); const occupied=new Set<string>();
  for(const u of board.units){
    if(!ids.has(u.championId)) throw new Error(`Unknown champion ${u.championId}`);
    if(!validPosition(u.x,u.y,u.team)) throw new Error(`Invalid team ${u.team} position (${u.x},${u.y})`);
    if(![1,2,3].includes(u.stars)) throw new Error('Invalid star level');
    const spot=`${u.x},${u.y}`;if(occupied.has(spot))throw new Error('Two champions occupy '+spot);occupied.add(spot);
  }
  if(board.units.length>28)throw new Error('Maximum 28 units');
}
const clamp=(x:number,min:number,max:number)=>Math.min(max,Math.max(min,x));
function rng(seed:number){let a=(seed>>>0)||1;return ()=>{a^=a<<13;a^=a>>>17;a^=a<<5;return(a>>>0)/4294967296;};}
export function hexDistance(ax:number,ay:number,bx:number,by:number){
  const aq=ax-(ay-(ay&1))/2,bq=bx-(by-(by&1))/2;
  return (Math.abs(aq-bq)+Math.abs(ay-by)+Math.abs(aq+ay-bq-by))/2;
}
function neighbors(x:number,y:number){const v=y%2===0?[[-1,0],[1,0],[-1,-1],[0,-1],[-1,1],[0,1]]:[[-1,0],[1,0],[0,-1],[1,-1],[0,1],[1,1]];return v.map(([dx,dy])=>[x+dx,y+dy] as [number,number]).filter(([xx,yy])=>xx>=0&&xx<WIDTH&&yy>=0&&yy<HEIGHT);}
function finite(value:number,fallback:number){return Number.isFinite(value)?value:fallback;}
type Fighter={uid:string;name:string;team:Side;x:number;y:number;hp:number;maxHp:number;shield:number;attack:number;armor:number;mr:number;speed:number;range:number;mana:number;maxMana:number;ap:number;crit:number;nextAction:number;casts:number;damage:number;alive:boolean};
function prepare(board:Board,catalogue:Catalogue){const map=new Map(catalogue.champions.map(c=>[c.id,c]));const items=new Map(catalogue.items.map(i=>[i.id,i]));return board.units.map(u=>{
 const c=map.get(u.championId)!;const stats={...c.stats};for(const id of u.items.slice(0,3)){const mod=items.get(id)?.stats||{};for(const key of Object.keys(mod) as (keyof Stats)[]){const n=mod[key];if(typeof n==='number')stats[key]=finite(stats[key]+n,stats[key]);}}
 const mult=u.stars===1?1:u.stars===2?1.8:3.24;
 const hp=clamp(finite(stats.hp,600)*mult,1,40000);
 return {uid:u.uid,name:c.name,team:u.team,x:u.x,y:u.y,hp,maxHp:hp,shield:0,attack:clamp(finite(stats.attack,50)*mult,1,10000),armor:clamp(finite(stats.armor,20),-50,800),mr:clamp(finite(stats.mr,20),-50,800),speed:clamp(finite(stats.speed,0.7),0.2,5),range:clamp(finite(stats.range,1),1,7),mana:clamp(finite(stats.initialMana,0),0,500),maxMana:clamp(finite(stats.mana,100),20,500),ap:clamp(finite(stats.ap,100),1,1000),crit:clamp(finite(stats.crit,0.25),0,1),nextAction:0,casts:0,damage:0,alive:true as boolean} satisfies Fighter;
 });}
function mitigate(raw:number,resist:number){return raw*(resist>=0?100/(100+resist):2-100/(100-resist));}
function pickTarget(me:Fighter,enemies:Fighter[],random:()=>number){let best:Fighter|undefined;let score=Infinity;for(const enemy of enemies){if(!enemy.alive)continue;const d=hexDistance(me.x,me.y,enemy.x,enemy.y);const s=d*1000+enemy.hp/enemy.maxHp*10+random()*0.01;if(s<score){score=s;best=enemy;}}return best;}
function stepToward(u:Fighter,target:Fighter,all:Fighter[]){const occupied=new Set(all.filter(a=>a.alive&&a!==u).map(a=>`${a.x},${a.y}`));const open=neighbors(u.x,u.y).filter(([x,y])=>!occupied.has(`${x},${y}`));open.sort((a,b)=>hexDistance(a[0],a[1],target.x,target.y)-hexDistance(b[0],b[1],target.x,target.y));if(open.length&&hexDistance(...open[0],target.x,target.y)<hexDistance(u.x,u.y,target.x,target.y)){[u.x,u.y]=open[0];return true;}return false;}
/** 100ms simulation ticks; capped at 35 seconds. Deterministic for the same seed. */
export function simulate(board:Board,catalogue:Catalogue,seed=1,log=false):Fight{
 const units=prepare(board,catalogue),random=rng(seed);const events:CombatEvent[]=[];
 const put=(t:number,s:string)=>{if(log&&events.length<100)events.push({time:Math.round(t*10)/10,text:s});};
 const inflicted:[number,number]=[0,0];let elapsed=0;
 for(let tick=0;tick<350;tick++){
   elapsed=tick/10;const alive0=units.some(u=>u.team===0&&u.alive),alive1=units.some(u=>u.team===1&&u.alive);
   if(!alive0||!alive1)break;
   const attacks:{from:Fighter;to:Fighter;amount:number;magical:boolean;gainMana:boolean}[]=[];
   for(const u of units){if(!u.alive||u.nextAction>elapsed)continue;
     const target=pickTarget(u,units.filter(v=>v.team!==u.team),random);if(!target)continue;
     if(hexDistance(u.x,u.y,target.x,target.y)>u.range){stepToward(u,target,units);u.nextAction=elapsed+0.2;continue;}
     if(u.mana>=u.maxMana){u.mana=0;u.casts++;u.nextAction=elapsed+0.6;
       const area=units.filter(v=>v.team!==u.team&&v.alive&&hexDistance(v.x,v.y,target.x,target.y)<=1);
       // Generalized spell approximation, NOT champion ability implementation.
       const raw=(55+u.attack*0.9)*(u.ap/100)*(1+0.5*(u.casts===1?1:0));
       for(const v of area)attacks.push({from:u,to:v,amount:raw*(v===target?1:0.42),magical:true,gainMana:false});
       put(elapsed,`${u.name} casts a generic area spell`);
     }else{
       const crit=random()<u.crit?1.4:1;
       attacks.push({from:u,to:target,amount:u.attack*crit*(0.92+random()*0.16),magical:false,gainMana:true});
       u.nextAction=elapsed+1/u.speed;
     }
   }
   // Resolve action batch simultaneously to avoid roster-order first-hit bias.
   for(const a of attacks){const damage=Math.max(1,mitigate(a.amount,a.magical?a.to.mr:a.to.armor));const shieldLoss=Math.min(a.to.shield,damage);a.to.shield-=shieldLoss;const hpLoss=Math.min(Math.max(0,a.to.hp),damage-shieldLoss);a.to.hp-=damage-shieldLoss;a.from.damage+=hpLoss;inflicted[a.from.team]+=hpLoss;
      if(a.gainMana){a.from.mana=Math.min(a.from.maxMana,a.from.mana+10);a.to.mana=Math.min(a.to.maxMana,a.to.mana+Math.min(25,Math.ceil(damage/60)));}
   }
   for(const u of units)if(u.alive&&u.hp<=0){u.alive=false;put(elapsed,`${u.name} defeated`);}
 }
 const health:[number,number]=[0,0],surviving:[number,number]=[0,0];for(const u of units)if(u.alive){surviving[u.team]++;health[u.team]+=u.hp+u.shield;}
 const winner:Side|2=surviving[0]&&!surviving[1]?0:surviving[1]&&!surviving[0]?1:health[0]>health[1]?0:health[1]>health[0]?1:2;
 return {winner,duration:Math.min(35,elapsed),surviving,damage:inflicted,health,events};
}
export function estimate(board:Board,catalogue:Catalogue,iterations=64,seed=13):Aggregate{
 let wins=0,losses=0,draws=0,lead=0,dmg=0,duration=0;
 for(let i=0;i<iterations;i++){const r=simulate(board,catalogue,seed+i*7919);wins+=+(r.winner===0);losses+=+(r.winner===1);draws+=+(r.winner===2);lead+=r.health[0]-r.health[1];dmg+=r.damage[0];duration+=r.duration;}
 return {iterations,wins,losses,draws,winRate:(wins+draws*.5)/iterations,avgHealthLead:lead/iterations,avgDamage:dmg/iterations,avgDuration:duration/iterations};
}
export type Optimization={board:Board;before:Aggregate;after:Aggregate;evaluated:number;elapsedMs:number};
export function optimize(board:Board,catalogue:Catalogue,effort: 'quick'|'balanced'|'deep'='balanced',seed=67,progress?:(current:number,total:number)=>void):Optimization{
 const start=Date.now(),before=estimate(board,catalogue,48,seed+10000), allies=board.units.filter(u=>u.team===0),free=allies.filter(u=>!u.locked);
 if(!free.length||!board.units.some(u=>u.team===1))return {board,before,after:before,evaluated:0,elapsedMs:Date.now()-start};
 const budget=effort==='quick'?65:effort==='balanced'?160:360;
 const maxMs=effort==='quick'?1500:effort==='balanced'?4500:10000;
 const random=rng(seed);let current=board.units.map(u=>({...u,items:[...u.items]}));let best=current;let bestScore=-Infinity;
 const score=(candidate:Placed[],n=12)=>{const r=estimate({units:candidate},catalogue,n,seed+345);return r.winRate*3000+r.avgHealthLead/5;};
 bestScore=score(best,20);let evaluated=1;let active=best;
 for(let i=0;i<budget;i++){
   if(Date.now()-start>maxMs)break;
   const trial=active.map(u=>({...u}));const mover=free[Math.floor(random()*free.length)];const id=trial.findIndex(u=>u.uid===mover.uid);if(id<0)continue;
   const occupied=trial.filter((u,k)=>k!==id&&u.team===0).map(u=>`${u.x},${u.y}`);
   const spots=[] as [number,number][];for(let y=0;y<4;y++)for(let x=0;x<7;x++)if(!occupied.includes(`${x},${y}`))spots.push([x,y]);
   const [x,y]=spots[Math.floor(random()*spots.length)];trial[id].x=x;trial[id].y=y;
   const sc=score(trial);evaluated++;
   if(sc>bestScore){bestScore=sc;best=trial;active=trial;}else if(random()<.12)active=trial;
   if(i%24===0)progress?.(i+1,budget);
 }
 const after=estimate({units:best},catalogue,48,seed+10000);
 // Protect against noisy training score: never claim better without validation.
 const chosen=(after.winRate*3000+after.avgHealthLead/5)>=(before.winRate*3000+before.avgHealthLead/5)?best:board.units;
 return {board:{units:chosen},before,after:chosen===best?after:before,evaluated,elapsedMs:Date.now()-start};
}
