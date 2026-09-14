// Shared keyboard/touch labels. One physical key maps to one gameplay action.
export const ACTION_BINDINGS=Object.freeze({
 left:{codes:['KeyA'],label:'A'},right:{codes:['KeyD'],label:'D'},forward:{codes:['KeyW'],label:'W'},back:{codes:['KeyS'],label:'S'},run:{codes:['ShiftLeft','ShiftRight'],label:'Shift'},
 rise:{codes:['ArrowUp','Space'],label:'↑ / Space',aria:'ArrowUp Space'},lower:{codes:['ArrowDown'],label:'↓',aria:'ArrowDown'},
 drop:{codes:['Enter'],label:'Enter',aria:'Enter'},pickup:{codes:['Enter'],label:'Enter',aria:'Enter'},attack:{codes:['ArrowRight'],label:'→',aria:'ArrowRight'},speak:{codes:['ArrowLeft'],label:'←',aria:'ArrowLeft'},
 lookLeft:{codes:['KeyQ'],label:'Q'},lookRight:{codes:['KeyE'],label:'E'},pitchUp:{codes:['KeyR'],label:'R'},pitchDown:{codes:['KeyF'],label:'F'},help:{codes:['KeyH'],label:'H'},menu:{codes:['Escape','KeyP'],label:'P / Esc'}
});
const byCode=new Map(Object.entries(ACTION_BINDINGS).flatMap(([action,b])=>b.codes.map(code=>[code,action])));
export const keyAction=code=>byCode.get(code);
export const bindingLabel=action=>ACTION_BINDINGS[action].label;
export const typingTarget=el=>!!el?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])')||!!el?.isContentEditable;
export const gameplayBlocked=s=>!s.started||s.paused||s.health<=0||s.roundFinished===true;
