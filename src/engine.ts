export type Unit = { id:string; name:string; hp:number; attack:number; armor:number; range:number; speed:number; x:number; y:number; team:0|1 };
export type Result = { winner:0|1|2; ticks:number; remaining:number };
const distance=(a:Unit,b:Unit)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export function simulate(input:Unit[], seed=1):Result {
  let state=seed>>>0; const rand=()=>((state=(1664525*state+1013904223)>>>0)/4294967296);
  const units=input.map(u=>({...u,hp:Math.max(1,u.hp),cooldown:0}));
  for(let tick=0;tick<300;tick++){
    const alive=units.filter(u=>u.hp>0);
    const a=alive.filter(u=>u.team===0),b=alive.filter(u=>u.team===1);
    if(!a.length||!b.length)return {winner:a.length?0:b.length?1:2,ticks:tick,remaining:alive.reduce((s,u)=>s+u.hp,0)};
    const attacks:{target:Unit;damage:number}[]=[];
    for(const u of alive){
      const targets=alive.filter(v=>v.team!==u.team).sort((p,q)=>distance(u,p)-distance(u,q)||p.hp-q.hp);
      const target=targets[0]; if(!target)continue;
      if(distance(u,target)>u.range){const dx=Math.sign(target.x-u.x),dy=Math.sign(target.y-u.y);if(Math.abs(target.x-u.x)>=Math.abs(target.y-u.y))u.x+=dx;else u.y+=dy;continue;}
      if((u as Unit&{cooldown:number}).cooldown>0){(u as Unit&{cooldown:number}).cooldown--;continue;}
      attacks.push({target,damage:Math.max(1,u.attack*(0.9+rand()*0.2)*100/(100+Math.max(-50,target.armor)))});
      (u as Unit&{cooldown:number}).cooldown=Math.max(0,Math.round(10/Math.max(0.2,u.speed))-1);
    }
    for(const hit of attacks)hit.target.hp-=hit.damage;
  }
  const hp=(team:0|1)=>units.filter(u=>u.team===team&&u.hp>0).reduce((s,u)=>s+u.hp,0);
  return {winner:hp(0)>hp(1)?0:hp(1)>hp(0)?1:2,ticks:300,remaining:Math.abs(hp(0)-hp(1))};
}
export function estimate(board:Unit[],iterations=100,seed=42){let wins=0,draws=0;for(let i=0;i<iterations;i++){const result=simulate(board,seed+i);if(result.winner===0)wins++;if(result.winner===2)draws++;}return {wins,draws,iterations,winRate:wins/iterations};}
export function optimize(board:Unit[],iterations=120,seed=42){const allies=board.filter(u=>u.team===0);const enemies=board.filter(u=>u.team===1);if(!allies.length||!enemies.length)return {board,score:0};let best=allies.map(u=>({...u}));let score=-1;let rng=seed>>>0;const rand=()=>((rng=(1664525*rng+1013904223)>>>0)/4294967296);for(let k=0;k<iterations;k++){const candidate=best.map(u=>({...u}));const idx=Math.floor(rand()*candidate.length);const x=Math.floor(rand()*7),y=Math.floor(rand()*4);if(candidate.some((u,j)=>j!==idx&&u.x===x&&u.y===y))continue;candidate[idx].x=x;candidate[idx].y=y;const value=estimate([...candidate,...enemies],24,seed).winRate;if(value>score){score=value;best=candidate;}}return {board:[...best,...enemies],score};}
