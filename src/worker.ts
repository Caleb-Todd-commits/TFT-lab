import {estimate,optimize,simulate,validateBoard,type Board,type Catalogue} from './engine';
self.onmessage=(event:MessageEvent<{id:number;kind:'fight'|'estimate'|'optimize';board:Board;catalogue:Catalogue;effort?:'quick'|'balanced'|'deep'}>)=>{
 const {id,kind,board,catalogue,effort}=event.data;
 try{
   validateBoard(board,catalogue);
   if(!board.units.some(u=>u.team===0)||!board.units.some(u=>u.team===1))throw new Error('Add at least one champion to each side.');
   const start=performance.now();
   const result=kind==='fight'?simulate(board,catalogue,20261023,true):kind==='estimate'?estimate(board,catalogue,128,20261023):optimize(board,catalogue,effort||'balanced',20261023,(done,total)=>self.postMessage({id,kind:'progress',done,total}));
   self.postMessage({id,kind:'done',result,elapsedMs:Math.round(performance.now()-start)});
 }catch(error){self.postMessage({id,kind:'error',error:error instanceof Error?error.message:String(error)});}
};
