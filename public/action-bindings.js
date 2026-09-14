// Shared keyboard/touch labels. One physical key maps to one gameplay action.
export const ACTION_BINDINGS=Object.freeze({
 left:{codes:['KeyA'],label:'A'},right:{codes:['KeyD'],label:'D'},forward:{codes:['KeyW'],label:'W'},back:{codes:['KeyS'],label:'S'},run:{codes:['ShiftLeft','ShiftRight'],label:'Shift'},
 rise:{codes:['ArrowUp','Space'],label:'↑ / Space',aria:'ArrowUp Space'},lower:{codes:['ArrowDown'],label:'↓',aria:'ArrowDown'},
 drop:{codes:['Enter'],label:'Enter',aria:'Enter'},pickup:{codes:['Enter'],label:'Enter',aria:'Enter'},attack:{codes:['ArrowRight'],label:'→',aria:'ArrowRight'},speak:{codes:['ArrowLeft'],label:'←',aria:'ArrowLeft'},
 lookLeft:{codes:['KeyQ'],label:'Q'},lookRight:{codes:['KeyE'],label:'E'},pitchUp:{codes:['KeyR'],label:'R'},pitchDown:{codes:['KeyF'],label:'F'},collection:{codes:['KeyC'],label:'C',aria:'C'},slot1:{codes:['Digit1'],label:'1',slot:0},slot2:{codes:['Digit2'],label:'2',slot:1},slot3:{codes:['Digit3'],label:'3',slot:2},slot4:{codes:['Digit4'],label:'4',slot:3},slot5:{codes:['Digit5'],label:'5',slot:4},help:{codes:['KeyH'],label:'H'},menu:{codes:['Escape'],label:'Esc',aria:'Escape'}
});
const byCode=new Map(Object.entries(ACTION_BINDINGS).flatMap(([action,b])=>b.codes.map(code=>[code,action])));
export const keyAction=code=>byCode.get(code);
export const bindingLabel=action=>ACTION_BINDINGS[action].label;
export const typingTarget=el=>!!el?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])')||!!el?.isContentEditable;
export const gameplayBlocked=s=>!s.started||s.paused||s.health<=0||s.roundFinished===true;
