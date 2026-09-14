const INK='#254139',YELLOW='#f6bc41';
function roundedRect(ctx,x,y,w,h,r){
 const radius=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+radius,y);ctx.lineTo(x+w-radius,y);ctx.quadraticCurveTo(x+w,y,x+w,y+radius);ctx.lineTo(x+w,y+h-radius);ctx.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);ctx.lineTo(x+radius,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-radius);ctx.lineTo(x,y+radius);ctx.quadraticCurveTo(x,y,x+radius,y);ctx.closePath();
}
export function drawSnapshotBrand(ctx,scale=1){
 const x=28*scale,y=24*scale,size=25*scale,r=5*scale;
 ctx.fillStyle='#d39b2b';roundedRect(ctx,x,y+3*scale,size,size,r);ctx.fill();
 ctx.fillStyle=YELLOW;roundedRect(ctx,x,y,size,size,r);ctx.fill();
 ctx.fillStyle=INK;roundedRect(ctx,x+4.7*scale,y+8.6*scale,15.6*scale,11.7*scale,1.3*scale);ctx.fill();
 roundedRect(ctx,x+6.25*scale,y+5.5*scale,4.7*scale,3.9*scale,1*scale);ctx.fill();
 roundedRect(ctx,x+14.05*scale,y+5.5*scale,4.7*scale,3.9*scale,1*scale);ctx.fill();
 ctx.fillStyle=INK;ctx.font=`800 ${25*scale}px 'Barlow Condensed', Impact, sans-serif`;ctx.textBaseline='middle';ctx.fillText('BRICKWILD',x+34*scale,y+12.5*scale);
}
export function composeGameSnapshot(renderer,scene,camera,doc=document){
 renderer.render(scene,camera);const source=renderer.domElement,canvas=doc.createElement('canvas');canvas.width=source.width;canvas.height=source.height;const ctx=canvas.getContext('2d');if(!ctx)throw Error('The snapshot canvas could not be created.');ctx.drawImage(source,0,0,canvas.width,canvas.height);drawSnapshotBrand(ctx,canvas.width/(source.clientWidth||canvas.width));return canvas;
}
