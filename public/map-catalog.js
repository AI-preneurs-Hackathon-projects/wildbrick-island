import {WORLD_ENTITIES,SPAWNS,DROP_POINTS} from './world-data.js';
import {BEACH_MAP} from './maps/beach.js';
import {MOUNTAIN_MAP} from './maps/mountain.js';
export const MAP_CYCLE=['island','beach','mountain'];
export const MAPS={island:{id:'island',name:'Wildbrick Island',entities:WORLD_ENTITIES,spawns:SPAWNS,dropPoints:DROP_POINTS},beach:BEACH_MAP,mountain:MOUNTAIN_MAP};
export const mapForRound=id=>MAP_CYCLE[((Math.max(1,id||1)-1)%MAP_CYCLE.length)];
export const getMap=id=>MAPS[id]||MAPS.island;
export const arenaMap=state=>getMap(state?.round?.mapId);
export const nextMap=id=>MAP_CYCLE[(MAP_CYCLE.indexOf(getMap(id).id)+1)%MAP_CYCLE.length];
