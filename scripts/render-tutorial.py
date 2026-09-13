import sys,json,numpy as np,math
from PIL import Image
p=json.load(sys.stdin);tri=np.array(p['triangles']);v=tri[:,:9].reshape((-1,3,3));norm=np.cross(v[:,1]-v[:,0],v[:,2]-v[:,0]);norm/=np.maximum(np.linalg.norm(norm,axis=1)[:,None],1e-9)
d=np.array([-0.7,.52,1.]);d/=np.linalg.norm(d);right=np.cross([0,1,0],d);right/=np.linalg.norm(right);up=np.cross(d,right);proj=v@np.array([right,up,d]).T
W,H=960,480;low=proj[:,:,:2].min(axis=(0,1));high=proj[:,:,:2].max(axis=(0,1));center=(high+low)/2;scale=min((W-100)/(high[0]-low[0]),(H-60)/(high[1]-low[1]));xy=np.stack([(proj[:,:,0]-center[0])*scale+W/2,(center[1]-proj[:,:,1])*scale+H/2],axis=-1)
light=np.array([-.5,.8,1]);light/=np.linalg.norm(light);intensity=.46+.68*np.maximum(norm@light,0)+.10*np.maximum(norm[:,1],0);linear=np.clip(tri[:,9:12]*intensity[:,None],0,1);rgb=np.uint8(np.clip(np.where(linear<=.0031308,linear*12.92,1.055*linear**(1/2.4)-.055)*255,0,255))
image=np.empty((H,W,3),dtype=np.uint8);image[:]=[187,226,220];depth=np.full((H,W),-np.inf)
for i,t in enumerate(xy):
 if norm[i]@d<=0:continue
 x0,y0=t[0];x1,y1=t[1];x2,y2=t[2];den=(y1-y2)*(x0-x2)+(x2-x1)*(y0-y2)
 if abs(den)<1e-9:continue
 xmin=max(0,int(np.floor(t[:,0].min())));xmax=min(W-1,int(np.ceil(t[:,0].max())));ymin=max(0,int(np.floor(t[:,1].min())));ymax=min(H-1,int(np.ceil(t[:,1].max())))
 if xmin>xmax or ymin>ymax:continue
 ys,xs=np.mgrid[ymin:ymax+1,xmin:xmax+1];xs=xs+.5;ys=ys+.5;w0=((y1-y2)*(xs-x2)+(x2-x1)*(ys-y2))/den;w1=((y2-y0)*(xs-x2)+(x0-x2)*(ys-y2))/den;w2=1-w0-w1;z=w0*proj[i,0,2]+w1*proj[i,1,2]+w2*proj[i,2,2];region=depth[ymin:ymax+1,xmin:xmax+1];mask=(w0>=0)&(w1>=0)&(w2>=0)&(z>region);region[mask]=z[mask];image[ymin:ymax+1,xmin:xmax+1][mask]=rgb[i]
file='public/tutorial/'+p['name']+'.png';Image.fromarray(image).save(file);print(file)
