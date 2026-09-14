// A flat, traversable alpine valley framed by climbable toy-brick ridges.
// Decorative paving stays below 10 cm; substantial geometry has matching boxes.
const pieces=[];
const entities=[];
const P={stone:0x8198ac,darkStone:0x647c96,lightStone:0xa5b9cb,snow:0xe9f3ec,
  pine:0x357d73,pineLight:0x55a18a,wood:0x98744f,path:0xd5c8a1,
  cream:0xffecc7,roof:0xd16a49,blue:0x79b8d2,ink:0x344559,gold:0xffcd61};
const primitive=(x,y,z,w,h,d,color,studs=false,shape='brick')=>({shape,x,y,z,w,h,d,color,studs});
function solid(id,kind,hp,color,parts){
  entities.push({id:'mountain:'+id,kind,hp,color,
    boxes:parts.map(({x,y,z,w,h,d})=>({x,y,z,w,h,d})),pieces:parts});
}
function paving(x,z,w,d,color=P.path){pieces.push(primitive(x,.025,z,w,.05,d,color));}

// Broad cross streets meet at a completely open market square. The side lanes
// connect behind the chalets without requiring stairs or jumping.
paving(0,0,19,104);
paving(0,0,104,17);
paving(0,0,29,27,P.cream);
paving(-35,0,10,79);
paving(35,0,10,79);
paving(0,-35,80,9);
paving(0,35,80,9);
for(let i=-4;i<=4;i++){
  if(Math.abs(i)>1){paving(-7.8,i*10,1.1,3.6,0xb6b8a1);paving(7.8,i*10,1.1,3.6,0xb6b8a1);}
  if(Math.abs(i)>1){paving(i*10,-6.8,3.6,1.1,0xb6b8a1);paving(i*10,6.8,3.6,1.1,0xb6b8a1);}
}
// Flush colored market tiles are visual decoration, never movement blockers.
for(const [x,z,c] of [[-11,-10,0x79b8d2],[11,-10,0xffcd61],[-11,10,0xe7a594],[11,10,0x75b79d]])
  pieces.push(primitive(x,.06,z,1.8,.04,1.8,c));

function ridge(id,x,z,w,d,levels){
  const parts=[];let top=0;
  for(let i=0;i<levels;i++){
    const h=1.6,ww=w-i*2.2,dd=d-i*1.9;
    parts.push(primitive(x,top+h/2,z,ww,h,dd,
      [P.stone,P.darkStone,P.lightStone][i%3]));top+=h;
  }
  parts.push(primitive(x,top+.14,z,
    w-(levels-1)*2.2,.28,d-(levels-1)*1.9,P.snow,true));
  solid(id,'rock',1700,P.stone,parts);
}
// Broken ridge lines leave the four cardinal entrances and outer routes open.
ridge('north-west-summit',-26,-47,18,12,5);
ridge('north-east-summit',27,-47,19,12,6);
ridge('western-bluff',-47,-23,12,17,4);
ridge('eastern-bluff',47,-23,12,17,5);
ridge('western-foothill',-47,24,12,15,3);
ridge('eastern-foothill',47,24,12,15,4);
ridge('south-west-ridge',-25,47,17,11,3);
ridge('south-east-ridge',26,47,18,11,4);

function chalet(id,x,z,color,face=1){
  const parts=[primitive(x,2.1,z,7.4,4.2,6.8,color,true),
    primitive(x,.3,z,8,.6,7.4,P.lightStone),
    primitive(x,4.25,z,8,.3,7.4,P.cream)];
  for(let i=0;i<4;i++)parts.push(primitive(x,4.65+i*.43,z,8.6-i*1.55,.45,7.9-i*.58,P.roof,true));
  // Toy chalet windows, lintels, a central dark door and snow-capped chimney.
  const front=z+face*3.45;
  parts.push(primitive(x,1.18,front,1.5,2.36,.16,P.wood),
    primitive(x,2.5,front+face*.06,1.8,.2,.24,P.cream));
  for(const dx of [-2.45,2.45]){
    parts.push(primitive(x+dx,2.55,front,1.6,1.55,.17,P.cream),
      primitive(x+dx,2.55,front+face*.11,1.25,1.18,.08,P.blue),
      primitive(x+dx,2.55,front+face*.16,.12,1.2,.06,P.cream));
  }
  parts.push(primitive(x+2.4,5.85,z-.6,1.1,2.1,1.1,P.darkStone),
    primitive(x+2.4,6.99,z-.6,1.35,.2,1.35,P.snow,true));
  solid(id,'house',1200,color,parts);
}
chalet('ochre-chalet',-23,-23,0xeab966,1);
chalet('coral-chalet',23,-23,0xe89b87,1);
chalet('mint-chalet',-23,24,0x79b69e,-1);
chalet('blue-chalet',23,24,0x88b4d2,-1);

// Tall village clock landmark sits beside the street, leaving the central
// north/south corridor and both east/west approaches clear for large vehicles.
const clockX=-23,clockZ=-11;
const clock=[primitive(clockX,.4,clockZ,6.4,.8,6.4,P.lightStone),
  primitive(clockX,4.25,clockZ,4.3,8.5,4.3,P.cream,true),
  primitive(clockX,8.55,clockZ,5,.3,5,P.wood),
  primitive(clockX,9.05,clockZ,5.5,.7,5.5,P.roof,true),
  primitive(clockX,9.65,clockZ,3.6,.55,3.6,P.roof,true),
  primitive(clockX,10.15,clockZ,1.8,.5,1.8,P.gold,true)];
for(const side of [-1,1]){
  clock.push(primitive(clockX,6.65,clockZ+side*2.21,2.7,2.7,.16,P.ink),
    primitive(clockX,6.65,clockZ+side*2.32,2.35,2.35,.08,P.gold),
    primitive(clockX,7.03,clockZ+side*2.39,.16,.85,.08,P.ink),
    primitive(clockX+.35,6.65,clockZ+side*2.39,.82,.16,.08,P.ink));
}
solid('clock-tower','landmark',1800,P.cream,clock);

// A compact brick lumber yard provides low cover opposite the clock. The
// central plaza remains empty and both landmarks are reachable on foot.
solid('lumber-yard','landmark',600,P.wood,[
  primitive(24,.5,11,5.8,1,3.4,P.wood,true),
  primitive(24,1.45,11,4.6,.9,2.8,0xb89362,true),
  primitive(24,2.15,11,3.2,.5,2.2,P.gold,true),
]);

function pine(id,x,z,s=1){
  const parts=[primitive(x,1.15*s,z,.7*s,2.3*s,.7*s,P.wood)];
  for(let i=0;i<4;i++)parts.push(primitive(x,(2.35+i*.78)*s,z,
    (3.6-i*.75)*s,.85*s,(3.6-i*.75)*s,i===3?P.snow:i%2?P.pineLight:P.pine,true));
  solid(id,'tree',100,P.pine,parts);
}
[
  [-35,-45,1],[-16,-44,.9],[16,-44,.9],[37,-43,1],
  [-46,-9,1.15],[46,-9,1.15],[-46,10,1],[46,10,1],
  [-34,43,1.05],[-14,45,.9],[14,45,.9],[37,43,1.05],
  [23,-13,.85],[-23,14,.85],
].forEach(([x,z,s],i)=>pine('pine-'+i,x,z,s));

// Four isolated rock outcrops provide approachable cover and landing tops
// beyond the village; their placement does not pinch the marked street grid.
for(const [i,[x,z]] of [[-12,-40],[12,-40],[-12,40],[12,40]].entries())
  solid('trail-rock-'+i,'rock',400,P.stone,[primitive(x,.85,z,3.2,1.7,3.2,P.stone),
    primitive(x,1.95,z,2.2,.5,2.2,P.lightStone,true)]);

export const MOUNTAIN_MAP={
  id:'mountain',name:'Mountain Village',groundColor:0x9fb7a1,oceanColor:0x98b9d0,
  pieces,entities,
  // Every point has at least an 8 × 8 m footprint clear of solid map geometry.
  spawns:[[0,-45],[0,45],[-45,0],[45,0],[-12,-32],[12,-32],[-12,32],[12,32],
    [-35,-34],[35,-34],[-35,33],[35,33],[0,-19],[0,19],[-12,0],[12,0]],
  dropPoints:[[0,0],[0,-29],[0,29],[-12,-16],[12,-16],[-12,17],[12,17],
    [-35,-33],[35,-33],[-35,32],[35,32],[-42,0],[42,0]],
};
