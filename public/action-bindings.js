// Shared keyboard/touch labels. One physical key maps to one gameplay action.
const bindings={
 left:{codes:['KeyA'],label:'A'},right:{codes:['KeyD'],label:'D'},forward:{codes:['KeyW'],label:'W'},back:{codes:['KeyS'],label:'S'},run:{codes:['ShiftLeft','ShiftRight'],label:'Shift'},
 rise:{codes:['ArrowUp','Space'],label:'↑ / Space',aria:'ArrowUp Space'},lower:{codes:['ArrowDown'],label:'↓',aria:'ArrowDown'},
 drop:{codes:['KeyG'],label:'G',aria:'g'},pickup:{codes:['KeyT'],label:'T',aria:'t'},attack:{codes:['ArrowRight'],label:'→',aria:'ArrowRight'},speak:{codes:['ArrowLeft'],label:'←',aria:'ArrowLeft'},
 lookLeft:{codes:['KeyQ'],label:'Q'},lookRight:{codes:['KeyE'],label:'E'},pitchUp:{codes:['KeyR'],label:'R'},pitchDown:{codes:['KeyF'],label:'F'},help:{codes:['KeyH'],label:'H'},menu:{codes:['Escape','KeyP'],label:'P / Esc'},
 collection:{codes:['KeyC'],label:'C',aria:'c'},
 ...Object.fromEntries(Array.from({length:5},(_,i)=>['creation'+(i+1),{codes:['Digit'+(i+1)],label:String(i+1),aria:String(i+1),slot:i}]))
};
export const ACTION_BINDINGS=Object.freeze(Object.fromEntries(Object.entries(bindings).map(([action,b])=>[action,Object.freeze({...b,codes:Object.freeze(b.codes),aria:b.aria||b.codes.map(c=>c.startsWith('Key')?c.slice(3).toLowerCase():c.startsWith('Shift')?'Shift':c).filter((c,i,a)=>a.indexOf(c)===i).join(' ')})])));
const byCode=new Map(Object.entries(ACTION_BINDINGS).flatMap(([action,b])=>b.codes.map(code=>[code,action])));
export const keyAction=code=>byCode.get(code);
export const bindingLabel=action=>ACTION_BINDINGS[action].label;
export const typingTarget=el=>!!el?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])')||!!el?.isContentEditable;
export const gameplayBlocked=s=>!s.started||s.paused||s.health<=0||s.roundFinished===true;
