import {test} from 'node:test';
import assert from 'node:assert/strict';
import {simulate,estimate,optimize,validateBoard,hexDistance} from '../.tmp-test/engine.js';
const stats={hp:680,attack:65,armor:35,mr:30,speed:.72,range:1,mana:95,initialMana:0,ap:100,crit:.25};
const catalogue={patch:'18.5',verified:false,status:'fixture',source:'test',champions:[
 {id:'a',name:'Frontliner',cost:2,traits:[],stats},
 {id:'b',name:'Carry',cost:4,traits:[],stats:{...stats,hp:540,attack:92,range:4}}
],items:[],traits:[]};
const board={units:[
 {uid:'a',championId:'a',team:0,x:3,y:3,stars:2,items:[],locked:true},
 {uid:'b',championId:'b',team:0,x:3,y:0,stars:2,items:[]},
 {uid:'c',championId:'a',team:1,x:3,y:4,stars:2,items:[]},
 {uid:'d',championId:'b',team:1,x:3,y:7,stars:2,items:[]}
]};
test('validates board and hex distances',()=>{assert.doesNotThrow(()=>validateBoard(board,catalogue));assert.equal(hexDistance(3,3,3,4),1);assert.throws(()=>validateBoard({units:[board.units[0],{...board.units[0],uid:'z'}]},catalogue),/occupy/);});
test('same seed yields exactly reproducible outcomes',()=>{assert.deepEqual(simulate(board,catalogue,123,true),simulate(board,catalogue,123,true));});
test('batch win rate and outcomes are bounded',()=>{const e=estimate(board,catalogue,22,7);assert.equal(e.iterations,22);assert.equal(e.wins+e.losses+e.draws,22);assert.ok(e.winRate>=0&&e.winRate<=1);});
test('position search preserves legal placements and locks',()=>{const output=optimize(board,catalogue,'quick',7);validateBoard(output.board,catalogue);assert.ok(output.evaluated>=1);const before=board.units[0],after=output.board.units.find(u=>u.uid===before.uid);assert.equal(after.x,before.x);assert.equal(after.y,before.y);});
test('combat does not mutate board input',()=>{const snapshot=structuredClone(board);simulate(board,catalogue,3);assert.deepEqual(board,snapshot);});
