export const AVATAR_COLORS=[
 {name:'Orange',hex:'#f17a48'}, {name:'Red',hex:'#ee634e'},
 {name:'Green',hex:'#83bc66'}, {name:'Teal',hex:'#63c7b2'},
 {name:'Blue',hex:'#579fe2'}, {name:'Purple',hex:'#a084dc'},
 {name:'Pink',hex:'#ee83b2'}, {name:'Yellow',hex:'#ffcf55'},
];
export const DEFAULT_AVATAR_COLOR='#ffcf55';
export const avatarColor=value=>AVATAR_COLORS.find(c=>c.hex===value)?.hex||DEFAULT_AVATAR_COLOR;
