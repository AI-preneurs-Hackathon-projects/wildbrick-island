import assert from 'node:assert/strict';
import fs from 'node:fs';
import {composeGameSnapshot} from '../public/snapshot.js';

const calls=[];
const context={
 beginPath(){calls.push(['beginPath']);},moveTo(...v){calls.push(['moveTo',...v]);},lineTo(...v){calls.push(['lineTo',...v]);},quadraticCurveTo(...v){calls.push(['curve',...v]);},closePath(){calls.push(['closePath']);},fill(){calls.push(['fill']);},drawImage(...v){calls.push(['drawImage',...v]);},fillText(...v){calls.push(['fillText',...v]);},set fillStyle(v){calls.push(['fillStyle',v]);},set font(v){calls.push(['font',v]);},set textBaseline(v){calls.push(['baseline',v]);}
};
const output={width:0,height:0,getContext:type=>type==='2d'?context:null};
const source={width:1600,height:900,clientWidth:800};let renders=0;
const canvas=composeGameSnapshot({domElement:source,render(){renders++;}},{}, {},{createElement:tag=>{assert.equal(tag,'canvas');return output;}});
assert.equal(renders,1);assert.equal(canvas.width,1600);assert.equal(canvas.height,900);
assert.deepEqual(calls.find(call=>call[0]==='drawImage'),['drawImage',source,0,0,1600,900]);
assert.deepEqual(calls.find(call=>call[0]==='fillText').slice(1),['BRICKWILD',124,73]);
const main=fs.readFileSync(new URL('../public/main.js',import.meta.url),'utf8');
assert.doesNotMatch(main,/getDisplayMedia|preferCurrentTab|srcObject/);
console.log('PASS snapshots contain only the rendered game view plus the BrickWild top-left mark; gameplay UI and screen sharing are excluded.');
