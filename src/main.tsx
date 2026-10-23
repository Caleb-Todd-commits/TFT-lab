import React,{useEffect,useMemo,useRef,useState} from 'react';
import{createRoot}from'react-dom/client';
import{activeTraits,fallback,loadCatalogue,starterBoard,PATCH}from './data';
import type{Catalogue,Board,Placed,Side,Fight,Aggregate,Optimization}from './engine';
import{validPosition}from './engine';
import './style.css';
const STORE='tft-lab-board-v3';
const loadSaved=():Board|null=>{try{const d=JSON.parse(localStorage.getItem(STORE)||'null');return d&&Array.isArray(d.units)?d:null;}catch{return null;}};
const FORMAT=(n:number)=>Math.round(n).toLocaleString();
function App(){
 const[catalogue,setCatalogue]=useState<Catalogue>(fallback),[loading,setLoading]=useState(true);
 const[board,setBoard]=useState<Board>(()=>loadSaved()||starterBoard(fallback));
 const[selected,setSelected]=useState<string|null>(null),[side,setSide]=useState<Side>(0),[search,setSearch]=useState(''),[cost,setCost]=useState(0);
 const[effort,setEffort]=useState<'quick'|'balanced'|'deep'>('balanced');
 const[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[notice,setNotice]=useState('');
 const[fight,setFight]=useState<Fight|null>(null),[estimateResult,setEstimateResult]=useState<Aggregate|null>(null),[optimization,setOptimization]=useState<Optimization|null>(null);
 const[idCounter,setIdCounter]=useState(100),[importOpen,setImportOpen]=useState(false),[importText,setImportText]=useState('');
 const worker=useRef<Worker|null>(null),request=useRef(0),selection=useRef<string|null>(null);
 useEffect(()=>{selection.current=selected;},[selected]);
 useEffect(()=>{let mounted=true;loadCatalogue().then(data=>{if(!mounted)return;setCatalogue(data);setLoading(false);setBoard(previous=>{
 const names=new Map(fallback.champions.map(c=>[c.id,c.name]));const byName=new Map(data.champions.map(c=>[c.name.toLowerCase(),c.id]));
 const units=previous.units.flatMap(u=>{
  if(data.champions.some(c=>c.id===u.championId))return[u];const name=names.get(u.championId);const id=name&&byName.get(name.toLowerCase());return id?[{...u,championId:id}]:[];
 });return units.length?{units}:starterBoard(data);
 });}).catch(e=>{if(mounted){setNotice(String(e));setLoading(false);}});return()=>{mounted=false;};},[]);
 useEffect(()=>{try{localStorage.setItem(STORE,JSON.stringify(board));}catch{};setFight(null);setEstimateResult(null);setOptimization(null);},[board]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.key==='Delete'||e.key==='Backspace')&&selection.current&&!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLTextAreaElement)){setBoard(b=>({units:b.units.filter(u=>u.uid!==selection.current)}));setSelected(null);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
 useEffect(()=>()=>worker.current?.terminate(),[]);
 const championMap=useMemo(()=>new Map(catalogue.champions.map(c=>[c.id,c])),[catalogue]);
 const selectedUnit=board.units.find(u=>u.uid===selected);
 const selectedChampion=selectedUnit&&championMap.get(selectedUnit.championId);
 const visible=useMemo(()=>catalogue.champions.filter(c=>(!cost||c.cost===cost)&&(`${c.name} ${c.traits.join(' ')}`).toLowerCase().includes(search.toLowerCase())).slice(0,110),[catalogue,search,cost]);
 function mutate(fn:(units:Placed[])=>Placed[]){setBoard(old=>({units:fn(old.units)}));}
 function add(championId:string){const occupied=new Set(board.units.map(u=>`${u.x},${u.y}`));const spaces:Array<[number,number]>=[];for(let y=side===0?3:4;side===0?y>=0:y<8;side===0?y--:y++)for(let x=0;x<7;x++)if(!occupied.has(`${x},${y}`))spaces.push([x,y]);
 if(!spaces.length){setNotice('That side is full.');return;}
 const[x,y]=spaces[0],uid=`u${idCounter}`;setIdCounter(n=>n+1);
 mutate(units=>[...units,{uid,championId,team:side,x,y,stars:1,items:[]}]);setSelected(uid);setNotice('');}
 function cell(x:number,y:number){const unit=board.units.find(u=>u.x===x&&u.y===y);if(unit){if(selected&&selected!==unit.uid){const moving=board.units.find(u=>u.uid===selected);if(moving&&moving.team===unit.team){mutate(units=>units.map(u=>u.uid===selected?{...u,x,y}:u.uid===unit.uid?{...u,x:moving.x,y:moving.y}:u));return;}}setSelected(unit.uid);setSide(unit.team);return;}
 if(selected){const u=board.units.find(u=>u.uid===selected);if(u&&validPosition(x,y,u.team)){mutate(units=>units.map(p=>p.uid===selected?{...p,x,y}:p));return;}}
 setSide(y<4?0:1);
 }
 function drop(e:React.DragEvent,x:number,y:number){e.preventDefault();const uid=e.dataTransfer.getData('application/tft-unit');const moving=board.units.find(u=>u.uid===uid);if(!moving||!validPosition(x,y,moving.team))return;const other=board.units.find(u=>u.x===x&&u.y===y);mutate(units=>units.map(u=>u.uid===uid?{...u,x,y}:other&&u.uid===other.uid?{...u,x:moving.x,y:moving.y}:u));setSelected(uid);}
 function updateSelected(patch:Partial<Placed>){if(!selected)return;mutate(units=>units.map(u=>u.uid===selected?{...u,...patch}:u));}
 function stop(){worker.current?.terminate();worker.current=null;request.current++;setBusy(false);setProgress('Cancelled.');}
 function execute(kind:'fight'|'estimate'|'optimize'){
 if(busy||loading)return;
 if(!board.units.some(u=>u.team===0)||!board.units.some(u=>u.team===1)){setNotice('Add at least one unit to both boards first.');return;}
 setNotice('');setBusy(true);setProgress(kind==='optimize'?'Searching positions…':'Simulating…');worker.current?.terminate();
 const w=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});worker.current=w;const id=++request.current;
 w.onmessage=(event:MessageEvent<any>)=>{const m=event.data;if(m.id!==request.current)return;
 if(m.kind==='progress'){setProgress(`Evaluated ${m.done}/${m.total} candidate layouts`);return;}
 setBusy(false);setProgress('');w.terminate();worker.current=null;
 if(m.kind==='error'){setNotice(m.error);return;}
 if(kind==='fight')setFight(m.result as Fight);
 if(kind==='estimate')setEstimateResult(m.result as Aggregate);
 if(kind==='optimize'){const r=m.result as Optimization;setOptimization(r);setEstimateResult(r.after);setBoard(r.board);setNotice(`Searched ${r.evaluated} positions in ${(m.elapsedMs/1000).toFixed(1)}s. ${r.after.winRate===r.before.winRate?'No validated win-rate improvement.':'Compared with the original layout.'}`);}
 };
 w.onerror=()=>{setBusy(false);setProgress('');setNotice('The simulation worker encountered an error.');w.terminate();};
 w.postMessage({id,kind,board,catalogue,effort});
 }
 function saveExport(){const data=JSON.stringify({patch:PATCH,board},null,2);if(!navigator.clipboard){setImportText(data);setImportOpen(true);return;}void navigator.clipboard.writeText(data).then(()=>setNotice('Board JSON copied to clipboard.'),()=>{setImportText(data);setImportOpen(true);});}
 function importBoard(){try{const raw=JSON.parse(importText);const b=raw.board||raw;if(!Array.isArray(b.units))throw new Error('Missing units array');const seen=new Set<string>();const units:Placed[]=b.units.map((u:any,i:number)=>{const x=Number(u.x),y=Number(u.y),team=u.team===1?1:0;
 if(!validPosition(x,y,team))throw new Error(`Invalid position at unit ${i+1}`);if(seen.has(`${x},${y}`))throw new Error('Overlapping units');seen.add(`${x},${y}`);
 if(!championMap.has(String(u.championId)))throw new Error(`Unknown champion ${u.championId}`);
 return {uid:String(u.uid||`import${i}`),championId:String(u.championId),team,x,y,stars:[1,2,3].includes(u.stars)?u.stars:1,items:Array.isArray(u.items)?u.items.filter((v:any)=>typeof v==='string').slice(0,3):[],locked:!!u.locked} as Placed;
 });if(units.length>28)throw new Error('Too many units');setBoard({units});setSelected(null);setImportOpen(false);setNotice('Board imported.');}catch(e){setNotice(e instanceof Error?e.message:String(e));}}
 const traits0=activeTraits(board,catalogue,0),traits1=activeTraits(board,catalogue,1);
 const hasOfficial=catalogue.verified;
 return <main>
 <header className="top"><div><div className="eyebrow">TACTICAL SIMULATOR</div><h1>TFT <span>LAB</span></h1><div className="sub">One board. One opponent. Better decisions.</div></div><div className="version"><div className="version-tag">SET 18 · PATCH {PATCH}</div><div className={hasOfficial?'data ok':'data warning'}>{loading?'Loading patch data…':hasOfficial?'Versioned game-file roster':'Unverified / fallback roster'}</div></div></header>
 <div className="integrity" role="status"><strong>Model accuracy:</strong> Auto-attacks, defenses, movement and generic casts are simulated. <strong>Champion-specific spells, traits, item passives and full 8-player matchmaking are not emulated.</strong> Win rates are estimates, not live-game guarantees. <span title={catalogue.source}>{catalogue.status}</span></div>
 <div className="workspace"><section className="left">
 <div className="board-header"><div><h2>Combat Board</h2><small>Click a champion, then click a hex to move it. Drag to reposition.</small></div><button className="quiet" onClick={()=>{setBoard(starterBoard(catalogue));setSelected(null);}}>Reset board</button></div>
 <div className="board" aria-label="Seven columns by eight rows TFT battlefield">{Array.from({length:8},(_,y)=><div key={y} className={'hex-row '+(y===4?'divide':'')}>{Array.from({length:7},(_,x)=>{const u=board.units.find(z=>z.x===x&&z.y===y),c=u&&championMap.get(u.championId);return <button type="button" key={`${x}-${y}`} title={u?`${c?.name||u.championId} · ${u.stars} star`:`Place at ${x},${y}`} aria-label={`${x},${y}: ${c?.name||'empty'}`} onClick={()=>cell(x,y)} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,x,y)} draggable={!!u} onDragStart={e=>{if(u){e.dataTransfer.setData('application/tft-unit',u.uid);setSelected(u.uid);}}} className={'hex '+(y<4?'ours':'theirs')+(u?' filled':'')+(selected===u?.uid?' picked':'')}>
 {u?<><span className="cost">{c?.cost||'?'}g</span><span className="unit-name">{c?.name||u.championId}</span><span className="stars">{'★'.repeat(u.stars)}</span>{u.locked&&<span className="lock">●</span>}</>:<span className="empty">+</span>}
 </button>})}</div>)}</div>
 <div className="side-legend"><span><i className="blue-dot"/> Your board · {board.units.filter(u=>u.team===0).length} units</span><span><i className="red-dot"/> Opponent · {board.units.filter(u=>u.team===1).length} units</span></div>
 <div className="trait-columns"><div><strong>Your synergies</strong><div className="trait-chips">{traits0.length?traits0.slice(0,10).map(([t,n])=><span key={t}>{t} <b>{n}</b></span>):<small>No units</small>}</div></div><div><strong>Opponent synergies</strong><div className="trait-chips">{traits1.length?traits1.slice(0,10).map(([t,n])=><span key={t}>{t} <b>{n}</b></span>):<small>No units</small>}</div></div></div>
 <section className="actions"><div className="action-heading"><h2>Practice & optimize</h2><small>Heavy calculations run off the UI thread.</small></div><div className="action-line"><button disabled={busy||loading} onClick={()=>execute('fight')}>Single fight</button><button disabled={busy||loading} onClick={()=>execute('estimate')}>Run 128 fights</button><button className="primary" disabled={busy||loading} onClick={()=>execute('optimize')}>Find best position</button></div><div className="settings"><label>Search depth <select value={effort} disabled={busy} onChange={e=>setEffort(e.target.value as typeof effort)}><option value="quick">Quick · ~65 layouts</option><option value="balanced">Balanced · ~160 layouts</option><option value="deep">Deep · ~360 layouts</option></select></label><button className="quiet" onClick={saveExport}>Copy board</button><button className="quiet" onClick={()=>setImportOpen(v=>!v)}>Import board</button>{busy&&<button className="danger" onClick={stop}>Stop</button>}</div>
 {importOpen&&<div className="import"><textarea aria-label="Paste board JSON" rows={4} value={importText} onChange={e=>setImportText(e.target.value)} placeholder="Paste board JSON"/><button onClick={importBoard}>Load JSON</button></div>}
 {progress&&<p className="progress" role="status">{progress}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
 {(fight||estimateResult)&&<div className="result"><div className="result-title">Simulation result <span>APPROXIMATE</span></div>{estimateResult&&<div className="metrics"><div><strong>{Math.round(estimateResult.winRate*100)}%</strong><small>Estimated win / draw share</small></div><div><strong>{estimateResult.wins}/{estimateResult.iterations}</strong><small>Fights won</small></div><div><strong>{Math.round(estimateResult.avgHealthLead)}</strong><small>Average remaining HP lead</small></div></div>}{optimization&&<p className="insight">Original win estimate: {Math.round(optimization.before.winRate*100)}% → Chosen layout: {Math.round(optimization.after.winRate*100)}%. Searched {optimization.evaluated} candidates. Locks were respected.</p>}{fight&&<><div className="metrics"><div><strong>{fight.winner===2?'Draw':fight.winner===0?'Victory':'Defeat'}</strong><small>Outcome</small></div><div><strong>{fight.duration.toFixed(1)}s</strong><small>Battle duration</small></div><div><strong>{FORMAT(fight.damage[0])}</strong><small>Damage dealt</small></div></div><details><summary>Combat log ({fight.events.length} entries)</summary><div className="log">{fight.events.map((e,i)=><p key={i}>{e.time.toFixed(1)}s · {e.text}</p>)}</div></details></>}</div>}
 </section></section>
 <aside className="sidebar"><section><div className="section-title"><h2>Champion library</h2><small>{catalogue.champions.length} entries</small></div><div className="side-switch"><button className={side===0?'chosen':''} onClick={()=>setSide(0)}>Your team</button><button className={side===1?'chosen':''} onClick={()=>setSide(1)}>Opponent</button></div><input aria-label="Search champions" placeholder="Search name or trait…" value={search} onChange={e=>setSearch(e.target.value)}/><div className="filters">{[0,1,2,3,4,5].map(n=><button className={cost===n?'on':''} key={n} onClick={()=>setCost(n)}>{n?n+'g':'All'}</button>)}</div><div className="roster" role="list">{visible.map(c=><button role="listitem" className="roster-unit" key={c.id} onClick={()=>add(c.id)} title={`Add ${c.name} to ${side===0?'your':'opponent'} board`}><span className={'cost-chip tier-'+Math.min(c.cost,5)}>{c.cost}</span><span><b>{c.name}</b><small>{c.traits.join(' · ')||'—'}</small></span><span className="plus">+</span></button>)}{!visible.length&&<p className="sub">No champions match your search.</p>}</div></section>
 <section className="inspector"><div className="section-title"><h2>Selected champion</h2>{selectedUnit&&<button className="danger text-button" onClick={()=>{mutate(units=>units.filter(u=>u.uid!==selected));setSelected(null);}}>Remove</button>}</div>{selectedUnit&&selectedChampion?<><div className="selected-name">{selectedChampion.name} <small>{selectedChampion.cost} gold</small></div><div className="stat-grid"><span>HP <b>{FORMAT(selectedChampion.stats.hp)}</b></span><span>AD <b>{FORMAT(selectedChampion.stats.attack)}</b></span><span>Armor <b>{selectedChampion.stats.armor}</b></span><span>MR <b>{selectedChampion.stats.mr}</b></span><span>AS <b>{selectedChampion.stats.speed.toFixed(2)}</b></span><span>Range <b>{selectedChampion.stats.range}</b></span></div><div className="star-control"><label>Stars</label><div>{([1,2,3] as const).map(n=><button key={n} className={selectedUnit.stars===n?'chosen':''} onClick={()=>updateSelected({stars:n})}>{'★'.repeat(n)}</button>)}</div></div><label className="lock-check"><input type="checkbox" checked={!!selectedUnit.locked} onChange={e=>updateSelected({locked:e.target.checked})}/> Keep this unit fixed when optimizing</label><label className="item-label">Items (up to 3, flat published stats only)</label>{[0,1,2].map(index=><select key={index} value={selectedUnit.items[index]||''} onChange={e=>{const ids=[...selectedUnit.items];ids[index]=e.target.value;updateSelected({items:ids.filter(Boolean)});}}><option value="">Empty item slot</option>{catalogue.items.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>)}{selectedChampion.ability&&<details><summary>Published ability description</summary><p className="ability">{selectedChampion.ability}</p></details>}</>:<p className="muted">Select a champion on the board to change stars, items, or lock its position.</p>}</section></aside></div>
 <footer>Independent practice tool · Data: <a target="_blank" rel="noreferrer" href="https://communitydragon.org/">CommunityDragon</a> · <a target="_blank" rel="noreferrer" href="https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/">Official patch notes</a> · TFT Lab is not endorsed by Riot Games.</footer>
 </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
