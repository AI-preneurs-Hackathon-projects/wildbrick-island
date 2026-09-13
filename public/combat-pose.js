// Presentation only: these offsets never enter movement or damage calculation.
export function combatPose(weapon,elapsed){
 const duration=weapon==='hammer'?.65:weapon==='punch'?.38:.42;
 const t=Math.max(0,Math.min(1,elapsed/duration));
 const strike=t<.34?t/.34:1-(t-.34)/.66;
 return {strike:elapsed>=0&&elapsed<duration?strike:0,active:elapsed>=0&&elapsed<duration};
}
