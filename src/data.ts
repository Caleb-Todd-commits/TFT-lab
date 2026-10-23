import type {Catalogue,Champion,Item,Stats,Board,Placed,Side} from './engine';
export const PATCH='18.5';
const CDN='https://raw.communitydragon.org';
const SNAPSHOT=`${CDN}/16.21/cdragon/tft/en_us.json`;
const LATEST=`${CDN}/latest/cdragon/tft/en_us.json`;
const CACHE='tft-lab-patch-18.5-v3';
const val=(n:unknown,f:number)=>typeof n==='number'&&Number.isFinite(n)?n:f;
const text=(n:unknown)=>String(n??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
function asset(path:unknown, version='16.21'){
 if(typeof path!=='string'||!path)return undefined;
 if(path.startsWith('https://'))return path;
 return `${CDN}/${version}/game/${path.replace(/^\/lol-game-data\/assets\//i,'assets/').replace(/^\/+/,'').toLowerCase()}`;
}
const fallbackNames=[
 ['Kha\'Zix',4,['Elderwood','Assassin']],['Hecarim',4,['Elderwood','Vanguard']],['Aphelios',4,['Elderwood','Rapidfire']],['Maokai',5,['Elderwood','Greenfather']],['Gnar',5,['Elderwood','Sprykin']],['Lux',5,['Solar','Spellweaver']],['Alune',5,['Lunar','Spellweaver']],['Kayle',4,['Solar','Rapidfire']],['Azir',4,['Flora Fatalis','Spellweaver']],['Tristana',2,['Fae','Rapidfire']],['Caitlyn',2,['Rapidfire']],['Morgana',3,['Coven','Spellweaver']],['Veigar',3,['Blackthorn','Spellweaver']],['Taric',5,['Vanguard']],['Ashe',5,['Blossom','Hunter']],['Draven',5,['Bounty Seeker']],['Elder Dragon',5,['Riftbeast']],['Ivern',5,['Greenfather']],['Kennen',5,['Vanguard']],['Sivir',3,['Primal','Rapidfire']],['Sett',4,['Blossom','Juggernaut']],['Master Yi',4,['Blossom']],['Yunara',4,['Blossom']],['Karma',3,['Blossom']],['Rengar',3,['Vanguard']],['Fiddlesticks',3,['Blackthorn']],['Alistar',2,['Vanguard']],['Ornn',2,['Vanguard']],['Camille',2,['Vanguard']],['Xayah',3,['Fae']]
] as [string,number,string[]][];
const statsFor=(cost:number):Stats=>({hp:460+cost*110,attack:42+cost*8,armor:20+cost*5,mr:20+cost*5,speed:0.65+cost*.025,range:cost>=4?3:cost===3?2:1,mana:100,initialMana:0,ap:100,crit:.25});
export const fallback:Catalogue={patch:PATCH,verified:false,status:'Offline training roster — sample statistics only; NOT verified patch 18.5 values.',source:'Built-in sample estimates (not a patch data source)',champions:fallbackNames.map(([name,cost,traits],i)=>({id:`sample-${i}`,name,cost,traits,stats:statsFor(cost)})),items:[],traits:[],};
function numberFromMap(a:unknown,keys:string[],f:number){if(!a||typeof a!=='object')return f;const o=a as Record<string,unknown>;for(const key of keys){if(typeof o[key]==='number')return val(o[key],f);const match=Object.keys(o).find(k=>k.toLowerCase()===key.toLowerCase());if(match)return val(o[match],f);}return f;}
function parseChampion(raw:any):Champion|null{
 if(!raw||!raw.name||!raw.apiName||!Number.isFinite(Number(raw.cost)))return null;
 const s=raw.stats||{},a=raw.ability||{};
 const range=numberFromMap(s,['range','attackRange'],1);
 return {id:String(raw.apiName),name:text(raw.name),cost:val(raw.cost,1),traits:Array.isArray(raw.traits)?raw.traits.filter((t:unknown)=>typeof t==='string'):[],icon:asset(raw.squareIcon||raw.icon),ability:text(a.desc||a.description),stats:{
 hp:numberFromMap(s,['hp','health'],600),attack:numberFromMap(s,['damage','attackDamage'],50),armor:numberFromMap(s,['armor'],20),mr:numberFromMap(s,['magicResist','mr'],20),speed:numberFromMap(s,['attackSpeed','speed'],0.7),range:range>20?range/180:range,
 mana:numberFromMap(s,['mana'],100),initialMana:numberFromMap(s,['initialMana'],0),ap:100,crit:numberFromMap(s,['critChance'],0.25)}};
}
function parseItem(raw:any):Item|null{
 if(!raw||!raw.apiName||!raw.name||String(raw.name).startsWith('TFT_'))return null;
 const p=raw.stats||{};
 const stats:Partial<Stats>={};const pairs:[keyof Stats,string[]][]=[['hp',['Health','HP']],['attack',['AttackDamage','AD']],['armor',['Armor']],['mr',['MagicResist']],['speed',['AttackSpeed']],['ap',['AbilityPower']],['crit',['CritChance']]];
 for(const [key,keys] of pairs){const n=numberFromMap(p,keys,NaN);if(Number.isFinite(n)&&n!==0)stats[key]=n;}
 return {id:String(raw.apiName),name:text(raw.name),description:text(raw.desc||raw.description),icon:asset(raw.icon),stats};
}
function parse(raw:any, source:string,verified:boolean):Catalogue{
 const sets=Array.isArray(raw.setData)?raw.setData:Object.values(raw.sets||{});
 const set=sets.find((x:any)=>Number(x?.number)===18||/enchanted wilds/i.test(String(x?.name||'')));
 if(!set)throw new Error('Source does not contain Set 18');
 const champions=(Array.isArray(set.champions)?set.champions:[]).map(parseChampion).filter(Boolean) as Champion[];
 const unique=[...new Map(champions.map(c=>[c.id,c])).values()];
 if(unique.length<55)throw new Error(`Insufficient Set 18 champions (${unique.length})`);
 const items=(Array.isArray(raw.items)?raw.items:[]).map(parseItem).filter(Boolean) as Item[];
 const traits=(Array.isArray(set.traits)?set.traits:[]).filter((t:any)=>t?.name).map((t:any)=>({name:text(t.name),breakpoints:(t.effects||[]).map((e:any)=>Number(e.minUnits)).filter((n:number)=>Number.isFinite(n)&&n>0)}));
 return {patch:PATCH,verified,status:verified?'Set 18 sourced from versioned 16.21 client data. Mid-patch balance values may still require verification.':'Set 18 data loaded from unpinned latest source; patch 18.5 accuracy unverified.',champions:unique.sort((a,b)=>a.cost-b.cost||a.name.localeCompare(b.name)),items:items.sort((a,b)=>a.name.localeCompare(b.name)),traits,source};
}
function cacheSave(data:Catalogue){try{localStorage.setItem(CACHE,JSON.stringify(data));}catch{/* optional cache */}}
export function cachedCatalogue():Catalogue|null{try{const raw=localStorage.getItem(CACHE);if(!raw)return null;const c=JSON.parse(raw) as Catalogue;return c.patch===PATCH&&c.champions.length>=55?c:null;}catch{return null;}}
/** Version-pinned fetch first; never silently promote fallback/latest to verified. */
export async function loadCatalogue():Promise<Catalogue>{
 const cached=cachedCatalogue();if(cached?.verified)return cached;
 for(const [url,pinned] of [[SNAPSHOT,true],[LATEST,false]] as const){try{
  const response=await fetch(url,{cache:'force-cache',signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const raw=await response.json();const parsed=parse(raw,url,pinned);cacheSave(parsed);return parsed;
 }catch{/* try next source */}}
 return cached||fallback;
}
export function starterBoard(catalogue:Catalogue):Board{
 const pool=catalogue.champions;const select=(index:number,cost:number)=>pool.filter(c=>c.cost===cost)[index]||pool[(index*11+3)%pool.length];
 const units:Placed[]=[];
 for(const [team,rows] of [[0,[0,3]],[1,[7,4]]] as [Side,number[]][]){const picks=[select(0,4),select(0,2),select(1,3),select(1,2)];picks.forEach((c,i)=>{if(!c)return;units.push({uid:`${team}-${i}`,championId:c.id,team,x:[1,2,4,5][i],y:i===0?rows[0]:rows[1],stars:i===0?2:1,items:[]});});}
 return {units};
}
export function activeTraits(board:Board,catalogue:Catalogue,team:Side){const lookup=new Map(catalogue.champions.map(c=>[c.id,c]));const counts=new Map<string,number>();for(const u of board.units.filter(u=>u.team===team)){for(const t of lookup.get(u.championId)?.traits||[])counts.set(t,(counts.get(t)||0)+1);}return [...counts].sort((a,b)=>b[1]-a[1]);}
