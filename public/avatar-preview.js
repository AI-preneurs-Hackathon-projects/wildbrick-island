import * as THREE from './vendor/three.module.js';
import {character} from './models.js';

// A transparent, on-demand render keeps the island visible around the builder.
export function createAvatarPreview(host,color){
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
 renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,30),model=character(color);
 camera.position.set(0,1.65,5.8);camera.lookAt(0,1.25,0);model.group.rotation.y=-.35;scene.add(model.group);
 scene.add(new THREE.HemisphereLight(0xffffff,0x718465,2.5));
 const sun=new THREE.DirectionalLight(0xfff0d5,3);sun.position.set(-3,5,4);scene.add(sun);
 host.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');
 let pointer=null,lastX=0;
 const render=()=>renderer.render(scene,camera);
 const resize=()=>{const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();render();};
 const rotate=delta=>{model.group.rotation.y+=delta;render();};
 host.addEventListener('pointerdown',e=>{if(e.button!==0||pointer!==null)return;pointer=e.pointerId;lastX=e.clientX;host.setPointerCapture(pointer);host.classList.add('dragging');e.preventDefault();host.focus({preventScroll:true});});
 host.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;rotate((e.clientX-lastX)*.015);lastX=e.clientX;});
 const release=e=>{if(e.pointerId!==pointer)return;pointer=null;host.classList.remove('dragging');};
 for(const event of ['pointerup','pointercancel','lostpointercapture'])host.addEventListener(event,release);
 host.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopPropagation();rotate(e.key==='ArrowLeft'?-.25:.25);});
 const observer=new ResizeObserver(resize);observer.observe(host);resize();
 return {setColor(value){model.setColor(value);render();}};
}
