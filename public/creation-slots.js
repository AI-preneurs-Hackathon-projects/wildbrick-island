import {gameplayBlocked} from './action-bindings.js';
export const CREATION_SLOT_COUNT=5;
// Records are validated blueprints in the adventure store. Canonical JSON from
// that validator gives distinct designs the same identity after serialization.
const keys=new WeakMap();
export function creationKey(b){if(!b||typeof b!=='object')return JSON.stringify(b);if(!keys.has(b))keys.set(b,JSON.stringify(b));return keys.get(b);}
// Saved validated blueprints are immutable records; rebuilding creates geometry
// separately. Cache identities so HUD refreshes do not serialize every brick.
export function distinctCreations(records=[]){const seen=new Set();return records.filter(b=>{if(!b||typeof b!=='object')return false;const key=creationKey(b);if(seen.has(key))return false;seen.add(key);return true;});}
export const creationSlots=records=>distinctCreations(records).slice(0,CREATION_SLOT_COUNT);
export function createCreationSelection({records,state,onRebuild,onNotice=()=>{}}){
 const all=()=>distinctCreations(records()),slots=()=>all().slice(0,CREATION_SLOT_COUNT),older=()=>all().slice(CREATION_SLOT_COUNT);
 function rebuild(b){const s=state();if(gameplayBlocked(s))return false;if(s.building){onNotice('Let these bricks finish assembling before rebuilding a saved creation.');return false;}return onRebuild(b)!==false;}
 function choose(index,expected){if(!Number.isInteger(index)||index<0||index>=CREATION_SLOT_COUNT)return false;const b=slots()[index];if(!b)return false;if(expected&&creationKey(b)!==creationKey(expected)){onNotice('Your creation slots changed. Choose your creation again.');return false;}return rebuild(b);}
 function chooseOlder(expected){const b=older().find(b=>creationKey(b)===creationKey(expected));if(!b){onNotice('Your saved list changed. Open Your creations again.');return false;}return rebuild(b);}
 return {slots,older,choose,chooseOlder};
}
