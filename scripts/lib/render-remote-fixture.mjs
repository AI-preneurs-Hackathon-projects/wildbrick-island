// Loaded only by the desktop diagnostic route; reuses actual Arena presentation.
import * as THREE from '/vendor/three.module.js';
import * as core from '/arena-core.js';
import {createArenaClient} from '/arena-client.js';
import {createArenaView} from '/arena-view.js';
import {remoteViewFixture,remoteProfiles} from '/__remote-view-fixture.js';
export async function renderRemoteFixture(run){
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1440,900);renderer.setScissorTest(true);document.body.append(renderer.domElement);const floors=[];
 const result=await remoteViewFixture({core,THREE,createArenaClient,createArenaView,seconds:run.seconds,profile:remoteProfiles.find(p=>p.name===run.latency),draw:async({scenes,cameras,tick})=>{
  await new Promise(requestAnimationFrame);
  if(tick===0)for(const scene of scenes){scene.background=new THREE.Color('#b9d9ed');scene.add(new THREE.HemisphereLight(0xffffff,0x556644,3));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(10,20,20);scene.add(light);const floor=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:'#8fa873'}));floor.rotation.x=-Math.PI/2;floor.position.set(0,-.02,10);scene.add(floor);floors.push(floor);}
  for(let i=0;i<2;i++){renderer.setViewport(i*720,0,720,900);renderer.setScissor(i*720,0,720,900);renderer.render(scenes[i],cameras[i]);}
 }});
 const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');result.renderer=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable';result.viewport=[innerWidth,innerHeight];result.version=run.version;
 window.finishFixture=()=>{for(const f of floors){f.geometry.dispose();f.material.dispose();}renderer.dispose();return result.resources;};window.render_game_to_text=()=>JSON.stringify({scope:'two Arena views',profile:run.latency,peers:result.peers});return result;
}
