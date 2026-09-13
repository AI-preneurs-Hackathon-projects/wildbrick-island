// Stranded Beach: flat sand supports the existing foot, vehicle and flight physics.
// Only substantial cover is collidable; shore patterns and loose tiles are paint.
const C={sand:0xf2d89a,light:0xffe8b5,wet:0xdac28b,water:0x71cbd1,foam:0xe4f5e7,
 wood:0xa97048,woodLight:0xd59862,darkWood:0x6e4d3b,cream:0xfff1d3,
 coral:0xea8067,teal:0x59b8aa,leaf:0x62ab73,leafLight:0x86c989,
 rock:0x9daca7,rockLight:0xb9c4b6,yellow:0xf3c74f};
const pieces=[],entities=[];
const primitive=(shape,x,y,z,w,h,d,color,studs=true)=>({shape,x,y,z,w,h,d,color,studs});
const tile=(x,z,w,d,color)=>pieces.push(primitive('box',x,.035,z,w,.07,d,color,false));
function prop(id,kind,hp,color){
 const entity={id:`beach:${id}`,kind,hp,color,boxes:[],pieces:[]};entities.push(entity);
 return (x,y,z,w,h,d,tint=color,shape='brick',studs=true)=>{
  entity.boxes.push({x,y,z,w,h,d});entity.pieces.push(primitive(shape,x,y,z,w,h,d,tint,studs));
 };
}
// Broad tidal bands at the eastern edge and pale sand routes are completely flat.
// They remain inside the ground footprint; blue water lives outside the island.
for(const [x,w,c] of [[53.5,5,C.wet],[49,4,C.light],[45.5,2,C.wet]])tile(x,0,w,112,c);
for(let z=-51;z<=51;z+=12){tile(54,z,3,5,C.foam);tile(48,z+3,1.4,4,C.cream);}
tile(0,9,84,11,C.light);tile(-19,0,10,94,C.light);tile(20,4,10,76,C.light);
for(let x=-39;x<=39;x+=6)tile(x,9,1.2,.32,C.wet);
// Curved-looking dune bands made from staggered flat plates, not hidden barriers.
for(const [x,z,w,d] of [[-42,-43,17,6],[-38,-37,13,4],[-5,43,18,5],[1,47,22,4],[32,39,14,4],[36,43,17,5]])tile(x,z,w,d,C.light);

// The stranded toy-brick cutter is the focal silhouette. Its narrowing bow points
// east; an open raised deck, chunky mast and striped sail read from every approach.
const ship=prop('stranded-cutter','landmark',2200,C.coral);
ship(-2,.48,-15,19,.96,6.2,C.darkWood);
ship(-1.2,1.35,-15,22,1.0,8.0,C.coral);
ship(10.2,1.38,-15,2.6,1.06,5.8,C.coral);
ship(12,1.45,-15,1.2,1.2,3.8,C.coral);
ship(-1.2,2.03,-15,22,.36,8.1,C.cream);
ship(-1.2,2.34,-15,21.4,.26,7.5,C.woodLight);
// Low gunwales leave an approachable deck while remaining physical cover.
ship(-1.2,2.8,-18.9,22,.8,.45,C.teal);
ship(-1.2,2.8,-11.1,22,.8,.45,C.teal);
ship(-11.95,2.8,-15,.5,.8,8.1,C.teal);
ship(-7.5,3.28,-15,5.0,1.62,5.2,C.wood);
ship(-7.5,4.18,-15,5.6,.22,5.8,C.cream);
ship(-1,7.1,-15,.62,9.3,.62,C.darkWood,'cylinder');
ship(-1,10.8,-15,11.8,.45,.45,C.woodLight);
// Fabric is a thin but solid visible slab; aircraft can pass around or above it.
ship(-1,8.2,-15,10.4,4.9,.22,C.cream,'box',false);
ship(-1,8.2,-14.86,2.2,4.9,.08,C.coral,'box',false);
ship(-1,12.2,-15,.45,1,.45,C.woodLight,'cylinder');
ship(.2,12.43,-15,2.2,.7,.18,C.teal,'box',false);
// A two-stage boarding stair projects from the west end, away from the main lane.
ship(-13.7,.4,-15,2.2,.8,4,C.wood);
ship(-12.9,1.13,-15,1.6,.66,4,C.woodLight);
for(const [x,z] of [[3,-16.8],[5.1,-13.2]]){
 ship(x,3.04,z,1.65,1.15,1.65,C.yellow);
 ship(x,3.67,z,1.8,.13,1.8,C.cream);
}

function rock(id,x,z,w=4.5,h=3.6,d=4){
 const add=prop(id,'rock',480,C.rock);
 add(x,h*.24,z,w,h*.48,d,C.rock);
 add(x-.25,h*.68,z+.2,w*.75,h*.4,d*.78,C.rockLight);
 add(x+.2,h*.95,z,w*.48,h*.14,d*.52,C.cream);
}
for(const [i,p] of [[29,-13,5,4,6],[33,-18,4,2.7,3.5],[-34,0,5,3.8,6],[-39,-3,3.5,2.5,4],[-9,31,5.5,3.2,4],[11,37,5,3.8,4],[38,31,4.5,3.1,5],[-42,-35,5,4.2,5]].entries())rock(`rock-${i}`,...p);

function palm(id,x,z,height=7){
 const add=prop(id,'tree',160,C.leaf);
 // Chunked vertical trunks are legible and have matching small collision bounds.
 for(let i=0;i<4;i++)add(x,height*(i+.5)/4,z,.72,height/4,.72,i%2?C.wood:C.woodLight);
 add(x,height+.12,z,1.8,.85,1.8,C.leafLight);
 for(const sign of [-1,1]){
  add(x+sign*1.7,height+.15,z,2.6,.42,1.25,C.leaf);
  add(x+sign*3.3,height-.2,z,1.2,.42,.95,C.leafLight);
  add(x,height+.3,z+sign*1.65,1.2,.42,2.6,C.leaf);
  add(x,height-.12,z+sign*3.2,.95,.42,1.2,C.leafLight);
 }
 add(x-.52,height-.48,z+.5,.5,.6,.5,C.wood);
}
for(const [i,p] of [[-43,27,7.2],[-37,34,6.4],[-29,39,8.1],[31,16,7],[43,25,8.3],[35,-39,7.5],[27,-36,6.8],[-5,-40,7.6],[5,-44,6.4],[-46,-14,8]].entries())palm(`palm-${i}`,...p);

// Two low beach shacks create cover pockets on the western side. Their roofs
// are flat landing surfaces and colors contrast with the ship, rock and foliage.
function shack(id,x,z,color){
 const add=prop(id,'house',1200,color);
 add(x,.3,z,8,.6,7,C.wood);
 add(x,2.0,z,7.2,3.4,6.2,color);
 add(x,3.88,z,8.4,.36,7.5,C.cream);
 add(x,4.2,z,7.6,.28,6.7,C.teal);
 add(x,2,z+3.14,2.1,2.7,.12,C.darkWood,'box',false);
 for(const dx of [-2.35,2.35])add(x+dx,2.5,z+3.17,1.1,1.1,.15,C.water,'box',false);
}
shack('salvage-hut',-34,-22,C.teal);
shack('beach-hut',-31,24,C.coral);

// Driftwood stacks and a small supply cache offer lower cover off the main routes.
for(const [i,x,z] of [[0,7,24],[1,33,-28],[2,-29,-42]]){
 const add=prop(`driftwood-${i}`,'landmark',340,C.wood);
 add(x,.42,z,6,.84,1.5,C.wood);
 add(x+.4,1.13,z,4.8,.58,1.3,C.woodLight);
}
const cache=prop('supply-cache','landmark',350,C.yellow);
cache(34,1,0,3,2,3,C.yellow);cache(36.8,.65,1,2.2,1.3,2.2,C.coral);
cache(34,2.15,0,3.15,.3,3.15,C.cream);

// Low colorful shells / washed-up square tiles intentionally have no entity or
// collision record; every one is a continuously walkable surface below 0.1m.
for(let i=0;i<56;i++){
 const x=Math.sin(i*2.39)*43,z=Math.cos(i*3.71)*47;
 if(Math.abs(z-9)<6||Math.abs(x+19)<5||Math.abs(x-20)<5)continue;
 tile(x,z,.36+(i%3)*.15,.4,[C.cream,C.coral,C.teal,C.yellow][i%4]);
}

export const BEACH_MAP={
 id:'beach',name:'Stranded Beach',groundColor:C.sand,oceanColor:C.water,pieces,entities,
 // Every pad has >=4m clearance from solid cover, including palm canopies, so
 // both players and an 8x8 mounted body can join without intersecting scenery.
 spawns:[[-45,-45],[-18,-44],[16,-46],[46,-44],[-46,14],[-20,9],[0,9],[20,9],[47,0],[-46,45],[-16,45],[21,46],[47,45],[0,-30],[22,-27],[-20,25]],
 dropPoints:[[-45,-4],[-20,-31],[15,-32],[44,-25],[-44,16],[-17,10],[1,10],[20,10],[46,19],[-18,43],[23,44],[-1,25]],
};
