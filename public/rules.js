export const BUILDS = {
  car: {name:'Trail car',verb:'Drive',color:0xf06443,speed:22,description:'Take the scenic route.',command:'Build a car'},
  plane: {name:'Sky plane',verb:'Fly',color:0xf9c94e,speed:29,description:'The sky is your playground.',command:'Build a plane'},
  bow: {name:'Brick bow',verb:'Shoot',color:0x39b0aa,speed:7,description:'Aim for the bullseye.',command:'Build a bow'},
  sword: {name:'Star sword',verb:'Swing',color:0xa7a1eb,speed:7,description:'Make a smashing entrance.',command:'Build a sword'},
  foot: {name:'On foot',verb:'Jump',color:0xffffff,speed:7,description:'Follow your curiosity.',command:'Run'}
};
export function parseCommand(input){
 const text=String(input).toLowerCase().replace(/[^a-z\s]/g,' ').replace(/\s+/g,' ').trim();
 if(/\b(cancel|never|dont|stop building)\b/.test(text)||/\bdo not\b/.test(text))return null;
 if(/\b(airplane|aeroplane|plane|aircraft|jet)\b/.test(text))return 'plane';
 if(/\b(car|automobile|vehicle|buggy)\b/.test(text))return 'car';
 if(/\b(bow|archery|arrow|arrows)\b/.test(text))return 'bow';
 if(/\b(sword|blade)\b/.test(text))return 'sword';
 if(/\b(run|walk|foot|dismount|exit)\b/.test(text))return 'foot';
 return null;
}
export const GATES = [{x:0,z:-29,axis:'z'},{x:29,z:0,axis:'x'},{x:0,z:29,axis:'z'},{x:-29,z:0,axis:'x'}];
export const RINGS = [{x:-18,y:12,z:-15},{x:18,y:16,z:-29},{x:36,y:19,z:7},{x:7,y:15,z:32},{x:-32,y:12,z:18}];
export const TARGETS = [{x:15,z:-9},{x:21,z:-14},{x:27,z:-9}];
export const CRATES = [{x:-13,z:9},{x:-18,z:11},{x:-13,z:16}];
export function createState(){return {x:0,y:0,z:17,yaw:Math.PI,mode:'foot',custom:null,time:0,speed:0,vertical:0,flightAltitude:0,started:false,paused:false,autoRun:false,building:null,actionTime:0,cooldown:0,bricks:0,gates:[],rings:[],targets:[],crates:[],built:[],distance:0,won:false};}
export function completion(s){return s.gates.length===4&&s.rings.length===5&&s.targets.length===3&&s.crates.length===3;}
export function nearestTarget(s,targets,range,arc=0.85){let best=null,dist=range;for(const t of targets){const dx=t.x-s.x,dz=t.z-s.z,d=Math.hypot(dx,dz);if(d>dist||d<0.01)continue;const facing=(dx*Math.sin(s.yaw)+dz*Math.cos(s.yaw))/d;if(facing<arc)continue;best=t;dist=d;}return best;}
export function objective(s){
 if(!s.built.includes('car'))return {title:'Your imagination starts here',detail:'Build a car. Say it or tap it below.',type:'car'};
 if(s.gates.length<4)return {title:'Take the scenic route',detail:`Drive through the 4 mint gates · ${s.gates.length}/4`,type:'car'};
 if(s.targets.length<3)return {title:'Right on target',detail:`Build a bow. Hit 3 striped targets · ${s.targets.length}/3`,type:'bow'};
 if(s.crates.length<3)return {title:'A smashing little adventure',detail:`Build a sword. Break 3 purple crates · ${s.crates.length}/3`,type:'sword'};
 if(s.rings.length<5)return {title:'A little higher',detail:`Build a plane. Fly through 5 sky rings · ${s.rings.length}/5`,type:'plane'};
 return {title:'The island is yours!',detail:'All challenges complete. Keep creating.',type:'complete'};
}
