#!/usr/bin/env node
// Offline diagnostic only. Imports the production renderer, then rasterizes its
// actual instantiated triangles on the CPU. No browser, WebGL, or GPU is used.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const args=process.argv.slice(2), options={};
let input;
for(let i=0;i<args.length;i++){
  if(args[i].startsWith('--')){
    if(args[i]==='--help'){console.log('Usage: node render-blueprint.mjs INPUT.json [--output OUTPUT.png] [--time 0] [--moving 0] [--site /workspace/sites/brickwild] [--triangles OUTPUT.json] [--width 2100]');process.exit(0);}
    if(i+1>=args.length)throw new Error(`Missing value for ${args[i]}`);
    options[args[i].slice(2)]=args[++i];
  }else if(!input)input=args[i];else throw new Error(`Unexpected argument: ${args[i]}`);
}
if(!input)throw new Error('Supply an actual blueprint JSON file. Use --help for options.');
input=path.resolve(input);
const site=path.resolve(options.site||'/workspace/sites/brickwild');
const output=path.resolve(options.output||input.replace(/\.json$/i,'')+'-geometry.png');
const time=Number(options.time||0),moving=Number(options.moving||0),width=Number(options.width||2100);
if(!Number.isFinite(time)||!Number.isFinite(moving)||!Number.isInteger(width)||width<900||width>6000)throw new Error('Invalid time, moving, or width option.');
const THREE=await import(pathToFileURL(path.join(site,'public/vendor/three.module.js')).href);
const {createGeneratedModel}=await import(pathToFileURL(path.join(site,'public/generated-model.js')).href);
const raw=JSON.parse(fs.readFileSync(input,'utf8'));
const model=createGeneratedModel(raw.blueprint||raw);
model.update(time,1,moving,0);
model.group.updateMatrixWorld(true);
const triangles=[],instances=[];
const transform=new THREE.Matrix4(),instance=new THREE.Matrix4(),color=new THREE.Color();
const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
model.group.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.visible)return;
  const position=mesh.geometry.getAttribute('position'),index=mesh.geometry.getIndex();
  const count=mesh.isInstancedMesh?mesh.count:1;
  const triangleCount=(index?index.count:position.count)/3;
  for(let j=0;j<count;j++){
    if(mesh.isInstancedMesh){mesh.getMatrixAt(j,instance);transform.multiplyMatrices(mesh.matrixWorld,instance);}else transform.copy(mesh.matrixWorld);
    color.copy(mesh.material.color);
    if(mesh.isInstancedMesh&&mesh.instanceColor){const instanceColor=new THREE.Color();mesh.getColorAt(j,instanceColor);color.multiply(instanceColor);}
    // Keep the renderer's linear RGB values; conversion happens after CPU light.
    const rgb=color.toArray();
    const first=triangles.length;
    for(let k=0;k<triangleCount;k++){
      a.fromBufferAttribute(position,index?index.getX(k*3):k*3).applyMatrix4(transform);
      b.fromBufferAttribute(position,index?index.getX(k*3+1):k*3+1).applyMatrix4(transform);
      c.fromBufferAttribute(position,index?index.getX(k*3+2):k*3+2).applyMatrix4(transform);
      triangles.push([...a.toArray(),...b.toArray(),...c.toArray(),...rgb,mesh.material.side]);
    }
    instances.push({geometry:mesh.geometry.type,instance:j,firstTriangle:first,triangleCount});
  }
});
const payload={
  title:model.blueprint.name,version:model.blueprint.version,
  input,output,time,moving,width,parts:model.parts,joints:model.blueprint.joints.length,
  movement:model.blueprint.movement,ability:model.blueprint.ability,
  size:model.size.toArray(),seat:model.seat.toArray(),generation:raw.generation||null,
  triangles,instances,
};
if(options.triangles){const file=path.resolve(options.triangles);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(payload));}
fs.mkdirSync(path.dirname(output),{recursive:true});
const python=String.raw`
import json,sys,math
import numpy as np
from PIL import Image,ImageDraw,ImageFont

p=json.load(sys.stdin)
tri=np.array(p['triangles'],dtype=np.float64)
vertices=tri[:,:9].reshape((-1,3,3))
colors=tri[:,9:12]
sides=tri[:,12]
seat=np.array(p['seat'])
# Exact vertical intersections through the seat, useful for support/clipping checks.
xz=vertices[:,:,[0,2]]
x0,z0=xz[:,0,0],xz[:,0,1];x1,z1=xz[:,1,0],xz[:,1,1];x2,z2=xz[:,2,0],xz[:,2,1]
den=(z1-z2)*(x0-x2)+(x2-x1)*(z0-z2)
safe=np.where(abs(den)>1e-12,den,1)
b0=((z1-z2)*(seat[0]-x2)+(x2-x1)*(seat[2]-z2))/safe
b1=((z2-z0)*(seat[0]-x2)+(x0-x2)*(seat[2]-z2))/safe
b2=1-b0-b1
hits=(abs(den)>1e-12)&(b0>=-1e-8)&(b1>=-1e-8)&(b2>=-1e-8)
hit_y=(b0*vertices[:,0,1]+b1*vertices[:,1,1]+b2*vertices[:,2,1])[hits]
levels=sorted(set(round(float(y),6) for y in hit_y))
below=[y for y in levels if y<=seat[1]+1e-5];above=[y for y in levels if y>seat[1]+1e-5]
seat_diagnostic={'verticalSurfaceLevels':levels,'nearestSurfaceBelow':max(below) if below else None,'nearestSurfaceAbove':min(above) if above else None,'topSurface':max(levels) if levels else None}
normals=np.cross(vertices[:,1]-vertices[:,0],vertices[:,2]-vertices[:,0])
normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-12)
light=np.array([-0.5,0.8,0.7]);light/=np.linalg.norm(light)
intensity=.52+.64*np.maximum(normals@light,0)+.13*np.maximum(normals[:,1],0)
linear=np.clip(colors*intensity[:,None],0,1)
rgb=np.where(linear<=.0031308,linear*12.92,1.055*linear**(1/2.4)-.055)
rgb=np.uint8(np.clip(rgb*255,0,255))

W=p['width']; unit=W/2100
margin=round(34*unit); gap=round(22*unit)
PW=(W-2*margin-2*gap)//3; PH=round(590*unit)
header=round(120*unit); footer=round(83*unit)
H=header+PH+footer
canvas=Image.new('RGB',(W,H),'#f0f3f2')
draw=ImageDraw.Draw(canvas)
def font(size,bold=False):
    file='/usr/share/fonts/truetype/dejavu/DejaVuSans'+('-Bold' if bold else '')+'.ttf'
    try:return ImageFont.truetype(file,max(10,round(size*unit)))
    except OSError:return ImageFont.load_default()
def fittext(text,maxwidth,f):
    if draw.textlength(text,font=f)<=maxwidth:return text
    while text and draw.textlength(text+'…',font=f)>maxwidth:text=text[:-1]
    return text+'…'
draw.text((margin,round(23*unit)),fittext(p['title'],W-2*margin,font(28,True)),fill='#152d2c',font=font(28,True))
gen=p.get('generation') or {}
meta=f"Schema v{p['version']}  ·  {p['parts']} parts  ·  {p['joints']} joints  ·  {p['movement']} / {p['ability']}  ·  t={p['time']:g}s, moving={p['moving']:g}"
if gen.get('durationMs'):meta+=f"  ·  API {gen['durationMs']/1000:.1f}s"
draw.text((margin,round(66*unit)),fittext(meta,W-2*margin,font(15)),fill='#526865',font=font(15))

views=[('Front','+Z toward origin',[0,0,1]),('Side','−X toward origin',[-1,0,0]),('Three-quarter','Elevated −X / +Z',[-1,.60,1])]
reports=[]
for panel_index,(title,subtitle,camera_dir) in enumerate(views):
    d=np.array(camera_dir,dtype=float);d/=np.linalg.norm(d)
    right=np.cross([0,1,0],d);right/=np.linalg.norm(right)
    up=np.cross(d,right)
    basis=np.array([right,up,d])
    projected=vertices@basis.T
    projected_seat=seat@basis.T
    allxy=np.concatenate([projected[:,:,:2].reshape((-1,2)),projected_seat[None,:2]])
    low=allxy.min(axis=0); high=allxy.max(axis=0)
    padding=round(37*unit); top=round(92*unit); bottom=round(42*unit)
    factor=min((PW-2*padding)/max(high[0]-low[0],.01),(PH-top-bottom)/max(high[1]-low[1],.01))
    center=(low+high)/2
    def project_xy(q):
        return np.stack([(q[...,0]-center[0])*factor+PW/2,
                         (center[1]-q[...,1])*factor+(top+PH-bottom)/2],axis=-1)
    xy=project_xy(projected)
    sx,sy=project_xy(projected_seat)
    image=np.empty((PH,PW,3),dtype=np.uint8);image[:]=[251,252,250]
    depth=np.full((PH,PW),-np.inf)
    owner=np.full((PH,PW),-1,dtype=np.int32)
    culled=0
    for ti,triangle in enumerate(xy):
        facing=normals[ti]@d
        if (sides[ti]==0 and facing<=1e-10) or (sides[ti]==1 and facing>=-1e-10):
            culled+=1;continue
        x0,y0=triangle[0];x1,y1=triangle[1];x2,y2=triangle[2]
        den=(y1-y2)*(x0-x2)+(x2-x1)*(y0-y2)
        if abs(den)<1e-10:continue
        xmin=max(0,int(math.floor(triangle[:,0].min())));xmax=min(PW-1,int(math.ceil(triangle[:,0].max())))
        ymin=max(0,int(math.floor(triangle[:,1].min())));ymax=min(PH-1,int(math.ceil(triangle[:,1].max())))
        if xmin>xmax or ymin>ymax:continue
        ys,xs=np.mgrid[ymin:ymax+1,xmin:xmax+1];xs=xs+.5;ys=ys+.5
        w0=((y1-y2)*(xs-x2)+(x2-x1)*(ys-y2))/den
        w1=((y2-y0)*(xs-x2)+(x0-x2)*(ys-y2))/den
        w2=1-w0-w1
        z=w0*projected[ti,0,2]+w1*projected[ti,1,2]+w2*projected[ti,2,2]
        region=depth[ymin:ymax+1,xmin:xmax+1]
        mask=(w0>=-1e-8)&(w1>=-1e-8)&(w2>=-1e-8)&(z>region)
        region[mask]=z[mask]
        image[ymin:ymax+1,xmin:xmax+1][mask]=rgb[ti]
        owner[ymin:ymax+1,xmin:xmax+1][mask]=ti
    view=Image.fromarray(image)
    vd=ImageDraw.Draw(view)
    vd.text((round(23*unit),round(20*unit)),title,fill='#163431',font=font(20,True))
    vd.text((round(23*unit),round(50*unit)),subtitle,fill='#78908b',font=font(13))
    # The seat is an always-visible diagnostic overlay, not an added mesh.
    r=max(4,round(6*unit));line=max(1,round(2*unit))
    vd.ellipse((sx-r-2,sy-r-2,sx+r+2,sy+r+2),fill='white')
    vd.ellipse((sx-r,sy-r,sx+r,sy+r),fill='#c93480',outline='#8e1457',width=line)
    vd.line((sx-r*2,sy,sx+r*2,sy),fill='#8e1457',width=line)
    vd.line((sx,sy-r*2,sx,sy+r*2),fill='#8e1457',width=line)
    label='Seat';lx=min(PW-round(60*unit),max(round(12*unit),sx+round(16*unit)));ly=max(top,sy-round(29*unit))
    bounds=vd.textbbox((lx,ly),label,font=font(13,True))
    vd.rectangle((bounds[0]-3,bounds[1]-2,bounds[2]+3,bounds[3]+2),fill='white')
    vd.text((lx,ly),label,fill='#a31d66',font=font(13,True))
    # One-unit scale bar; each view fits independently for maximum readability.
    bar=min(factor,PW*.3);bar_units=bar/factor
    bx=round(23*unit);by=PH-round(22*unit)
    vd.line((bx,by,bx+bar,by),fill='#76918a',width=line)
    vd.line((bx,by-4,bx,by+4),fill='#76918a',width=line)
    vd.line((bx+bar,by-4,bx+bar,by+4),fill='#76918a',width=line)
    vd.text((bx+bar+round(10*unit),by-round(9*unit)),f'{bar_units:.2g} world unit',fill='#78908b',font=font(11))
    px=margin+panel_index*(PW+gap)
    canvas.paste(view,(px,header))
    draw.rounded_rectangle((px,header,px+PW-1,header+PH-1),radius=round(9*unit),outline='#d4dfda',width=1)
    reports.append({'view':title,'visiblePixels':int((owner>=0).sum()),'culledTriangles':culled,'pixelsPerWorldUnit':round(float(factor),3)})

draw.text((margin,header+PH+round(19*unit)),f"Exact transformed mesh triangles, including studs  ·  {len(tri):,} triangles  ·  Magenta marker: renderer's seat",fill='#4f6961',font=font(13))
draw.text((margin,header+PH+round(44*unit)),"Offline CPU geometry diagnostic. Orthographic views fit independently; simplified lighting. Not a browser screenshot.",fill='#789087',font=font(12))
canvas.save(p['output'])
print(json.dumps({'output':p['output'],'width':W,'height':H,'triangles':len(tri),'instances':len(p['instances']),'seat':p['seat'],'seatDiagnostic':seat_diagnostic,'size':p['size'],'views':reports}))
`;
const result=spawnSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python',['-c',python],{input:JSON.stringify(payload),encoding:'utf8',maxBuffer:8*1024*1024});
model.dispose();
if(result.error)throw result.error;
if(result.status!==0){process.stderr.write(result.stderr);process.exit(result.status||1);}
process.stdout.write(result.stdout);
