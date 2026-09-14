// Presentation only: these offsets never enter movement or damage calculation.
export function combatPose(weapon,elapsed){
 const duration=weapon==='hammer'?.65:weapon==='punch'?.38:.42;
 const t=Math.max(0,Math.min(1,elapsed/duration));
 const strike=t<.34?t/.34:1-(t-.34)/.66;
 return {strike:elapsed>=0&&elapsed<duration?strike:0,active:elapsed>=0&&elapsed<duration};
}

// Upright carried melee weapons swing about local X, toward character +Z.
export const meleeAngle=strike=>Math.max(0,Math.min(1,strike))*1.45;

// Turn the hammer's broad head along the forward strike, keeping its handle upright.
export const meleeRotation=(strike,weapon)=>[meleeAngle(strike),weapon==='hammer'?Math.PI/2:0,0,'XYZ'];
