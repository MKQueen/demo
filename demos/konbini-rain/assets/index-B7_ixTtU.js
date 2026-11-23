(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const a of r.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&n(a)}).observe(document,{childList:!0,subtree:!0});function t(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(s){if(s.ep)return;s.ep=!0;const r=t(s);fetch(s.href,r)}})();/**
 * @license
 * Copyright 2010-2024 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const ql="170",Es={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},bs={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},fp=0,Hh=1,up=2,Em=3,Cm=0,cf=1,hf=2,hi=3,Pn=0,on=1,St=2,pi=0,ii=1,In=2,Gh=3,Wh=4,dp=5,Ki=100,pp=101,mp=102,gp=103,yp=104,_p=200,xp=201,vp=202,Mp=203,nl=204,il=205,bp=206,Sp=207,wp=208,Tp=209,Ap=210,Ep=211,Cp=212,Rp=213,Pp=214,sl=0,rl=1,al=2,Is=3,ol=4,ll=5,cl=6,hl=7,Da=0,Ip=1,Dp=2,mi=0,Lp=1,zp=2,Up=3,Np=4,Op=5,Fp=6,Bp=7,Xh="attached",kp="detached",$l=300,Ui=301,Ji=302,da=303,pa=304,wr=306,gr=1e3,Wn=1001,ma=1002,Qt=1003,ff=1004,Rm=1004,hr=1005,Pm=1005,Vt=1006,na=1007,Im=1007,ni=1008,Dm=1008,_i=1009,uf=1010,df=1011,yr=1012,Kl=1013,Ni=1014,Cn=1015,Yn=1016,Jl=1017,jl=1018,Ds=1020,pf=35902,mf=1021,gf=1022,mn=1023,yf=1024,_f=1025,Cs=1026,Ls=1027,Ql=1028,La=1029,xf=1030,ec=1031,Lm=1032,tc=1033,ia=33776,sa=33777,ra=33778,aa=33779,fl=35840,ul=35841,dl=35842,pl=35843,ml=36196,gl=37492,yl=37496,_l=37808,xl=37809,vl=37810,Ml=37811,bl=37812,Sl=37813,wl=37814,Tl=37815,Al=37816,El=37817,Cl=37818,Rl=37819,Pl=37820,Il=37821,oa=36492,Dl=36494,Ll=36495,vf=36283,zl=36284,Ul=36285,Nl=36286,Vp=2200,Hp=2201,Gp=2202,ga=2300,Ol=2301,Qo=2302,Ss=2400,ws=2401,ya=2402,nc=2500,Mf=2501,zm=0,Um=1,Nm=2,Wp=3200,Xp=3201,Om=3202,Fm=3203,Qi=0,Yp=1,Gn="",Dt="srgb",es="srgb-linear",za="linear",Mt="srgb",Bm=0,_s=7680,km=7681,Vm=7682,Hm=7683,Gm=34055,Wm=34056,Xm=5386,Ym=512,Zm=513,qm=514,$m=515,Km=516,Jm=517,jm=518,Yh=519,Zp=512,qp=513,$p=514,bf=515,Kp=516,Jp=517,jp=518,Qp=519,_a=35044,Qm=35048,eg=35040,tg=35045,ng=35049,ig=35041,sg=35046,rg=35050,ag=35042,og="100",Zh="300 es",ui=2e3,xa=2001;class vi{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){if(this._listeners===void 0)return!1;const n=this._listeners;return n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){if(this._listeners===void 0)return;const s=this._listeners[e];if(s!==void 0){const r=s.indexOf(t);r!==-1&&s.splice(r,1)}}dispatchEvent(e){if(this._listeners===void 0)return;const n=this._listeners[e.type];if(n!==void 0){e.target=this;const s=n.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,e);e.target=null}}}const hn=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let vu=1234567;const Rs=Math.PI/180,_r=180/Math.PI;function Fn(){const i=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(hn[i&255]+hn[i>>8&255]+hn[i>>16&255]+hn[i>>24&255]+"-"+hn[e&255]+hn[e>>8&255]+"-"+hn[e>>16&15|64]+hn[e>>24&255]+"-"+hn[t&63|128]+hn[t>>8&255]+"-"+hn[t>>16&255]+hn[t>>24&255]+hn[n&255]+hn[n>>8&255]+hn[n>>16&255]+hn[n>>24&255]).toLowerCase()}function kt(i,e,t){return Math.max(e,Math.min(t,i))}function Sf(i,e){return(i%e+e)%e}function lg(i,e,t,n,s){return n+(i-e)*(s-n)/(t-e)}function cg(i,e,t){return i!==e?(t-i)/(e-i):0}function la(i,e,t){return(1-t)*i+t*e}function hg(i,e,t,n){return la(i,e,1-Math.exp(-t*n))}function fg(i,e=1){return e-Math.abs(Sf(i,e*2)-e)}function ug(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e),i*i*(3-2*i))}function dg(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e),i*i*i*(i*(i*6-15)+10))}function pg(i,e){return i+Math.floor(Math.random()*(e-i+1))}function mg(i,e){return i+Math.random()*(e-i)}function gg(i){return i*(.5-Math.random())}function yg(i){i!==void 0&&(vu=i);let e=vu+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function _g(i){return i*Rs}function xg(i){return i*_r}function vg(i){return(i&i-1)===0&&i!==0}function Mg(i){return Math.pow(2,Math.ceil(Math.log(i)/Math.LN2))}function bg(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function Sg(i,e,t,n,s){const r=Math.cos,a=Math.sin,o=r(t/2),l=a(t/2),c=r((e+n)/2),h=a((e+n)/2),f=r((e-n)/2),p=a((e-n)/2),u=r((n-e)/2),g=a((n-e)/2);switch(s){case"XYX":i.set(o*h,l*f,l*p,o*c);break;case"YZY":i.set(l*p,o*h,l*f,o*c);break;case"ZXZ":i.set(l*f,l*p,o*h,o*c);break;case"XZX":i.set(o*h,l*g,l*u,o*c);break;case"YXY":i.set(l*u,o*h,l*g,o*c);break;case"ZYZ":i.set(l*g,l*u,o*h,o*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function vn(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("Invalid component type.")}}function nt(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("Invalid component type.")}}const e0={DEG2RAD:Rs,RAD2DEG:_r,generateUUID:Fn,clamp:kt,euclideanModulo:Sf,mapLinear:lg,inverseLerp:cg,lerp:la,damp:hg,pingpong:fg,smoothstep:ug,smootherstep:dg,randInt:pg,randFloat:mg,randFloatSpread:gg,seededRandom:yg,degToRad:_g,radToDeg:xg,isPowerOfTwo:vg,ceilPowerOfTwo:Mg,floorPowerOfTwo:bg,setQuaternionFromProperEuler:Sg,normalize:nt,denormalize:vn};class ${constructor(e=0,t=0){$.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,n=this.y,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6],this.y=s[1]*t+s[4]*n+s[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(kt(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const n=Math.cos(t),s=Math.sin(t),r=this.x-e.x,a=this.y-e.y;return this.x=r*n-a*s+e.x,this.y=r*s+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class et{constructor(e,t,n,s,r,a,o,l,c){et.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,a,o,l,c)}set(e,t,n,s,r,a,o,l,c){const h=this.elements;return h[0]=e,h[1]=s,h[2]=o,h[3]=t,h[4]=r,h[5]=l,h[6]=n,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],h=n[4],f=n[7],p=n[2],u=n[5],g=n[8],y=s[0],d=s[3],m=s[6],_=s[1],x=s[4],v=s[7],E=s[2],T=s[5],R=s[8];return r[0]=a*y+o*_+l*E,r[3]=a*d+o*x+l*T,r[6]=a*m+o*v+l*R,r[1]=c*y+h*_+f*E,r[4]=c*d+h*x+f*T,r[7]=c*m+h*v+f*R,r[2]=p*y+u*_+g*E,r[5]=p*d+u*x+g*T,r[8]=p*m+u*v+g*R,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8];return t*a*h-t*o*c-n*r*h+n*o*l+s*r*c-s*a*l}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8],f=h*a-o*c,p=o*l-h*r,u=c*r-a*l,g=t*f+n*p+s*u;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const y=1/g;return e[0]=f*y,e[1]=(s*c-h*n)*y,e[2]=(o*n-s*a)*y,e[3]=p*y,e[4]=(h*t-s*l)*y,e[5]=(s*r-o*t)*y,e[6]=u*y,e[7]=(n*l-c*t)*y,e[8]=(a*t-n*r)*y,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,s,r,a,o){const l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*a+c*o)+a+e,-s*c,s*l,-s*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return this.premultiply(kc.makeScale(e,t)),this}rotate(e){return this.premultiply(kc.makeRotation(-e)),this}translate(e,t){return this.premultiply(kc.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<9;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const kc=new et;function t0(i){for(let e=i.length-1;e>=0;--e)if(i[e]>=65535)return!0;return!1}const wg={Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array};function fr(i,e){return new wg[i](e)}function va(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function n0(){const i=va("canvas");return i.style.display="block",i}const Mu={};function Jr(i){i in Mu||(Mu[i]=!0,console.warn(i))}function Tg(i,e,t){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(e,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:n()}}setTimeout(r,t)})}function Ag(i){const e=i.elements;e[2]=.5*e[2]+.5*e[3],e[6]=.5*e[6]+.5*e[7],e[10]=.5*e[10]+.5*e[11],e[14]=.5*e[14]+.5*e[15]}function Eg(i){const e=i.elements;e[11]===-1?(e[10]=-e[10]-1,e[14]=-e[14]):(e[10]=-e[10],e[14]=-e[14]+1)}const ct={enabled:!0,workingColorSpace:es,spaces:{},convert:function(i,e,t){return this.enabled===!1||e===t||!e||!t||(this.spaces[e].transfer===Mt&&(i.r=zi(i.r),i.g=zi(i.g),i.b=zi(i.b)),this.spaces[e].primaries!==this.spaces[t].primaries&&(i.applyMatrix3(this.spaces[e].toXYZ),i.applyMatrix3(this.spaces[t].fromXYZ)),this.spaces[t].transfer===Mt&&(i.r=mr(i.r),i.g=mr(i.g),i.b=mr(i.b))),i},fromWorkingColorSpace:function(i,e){return this.convert(i,this.workingColorSpace,e)},toWorkingColorSpace:function(i,e){return this.convert(i,e,this.workingColorSpace)},getPrimaries:function(i){return this.spaces[i].primaries},getTransfer:function(i){return i===Gn?za:this.spaces[i].transfer},getLuminanceCoefficients:function(i,e=this.workingColorSpace){return i.fromArray(this.spaces[e].luminanceCoefficients)},define:function(i){Object.assign(this.spaces,i)},_getMatrix:function(i,e,t){return i.copy(this.spaces[e].toXYZ).multiply(this.spaces[t].fromXYZ)},_getDrawingBufferColorSpace:function(i){return this.spaces[i].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(i=this.workingColorSpace){return this.spaces[i].workingColorSpaceConfig.unpackColorSpace}};function zi(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function mr(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}const bu=[.64,.33,.3,.6,.15,.06],Su=[.2126,.7152,.0722],wu=[.3127,.329],Tu=new et().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Au=new et().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);ct.define({[es]:{primaries:bu,whitePoint:wu,transfer:za,toXYZ:Tu,fromXYZ:Au,luminanceCoefficients:Su,workingColorSpaceConfig:{unpackColorSpace:Dt},outputColorSpaceConfig:{drawingBufferColorSpace:Dt}},[Dt]:{primaries:bu,whitePoint:wu,transfer:Mt,toXYZ:Tu,fromXYZ:Au,luminanceCoefficients:Su,outputColorSpaceConfig:{drawingBufferColorSpace:Dt}}});let Ys;class i0{static getDataURL(e){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let t;if(e instanceof HTMLCanvasElement)t=e;else{Ys===void 0&&(Ys=va("canvas")),Ys.width=e.width,Ys.height=e.height;const n=Ys.getContext("2d");e instanceof ImageData?n.putImageData(e,0,0):n.drawImage(e,0,0,e.width,e.height),t=Ys}return t.width>2048||t.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",e),t.toDataURL("image/jpeg",.6)):t.toDataURL("image/png")}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=va("canvas");t.width=e.width,t.height=e.height;const n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);const s=n.getImageData(0,0,e.width,e.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=zi(r[a]/255)*255;return n.putImageData(s,0,0),t}else if(e.data){const t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(zi(t[n]/255)*255):t[n]=zi(t[n]);return{data:t,width:e.width,height:e.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let Cg=0;class Ts{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Cg++}),this.uuid=Fn(),this.data=e,this.dataReady=!0,this.version=0}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(Vc(s[a].image)):r.push(Vc(s[a]))}else r=Vc(s);n.url=r}return t||(e.images[this.uuid]=n),n}}function Vc(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?i0.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let Rg=0;class Ht extends vi{constructor(e=Ht.DEFAULT_IMAGE,t=Ht.DEFAULT_MAPPING,n=Wn,s=Wn,r=Vt,a=ni,o=mn,l=_i,c=Ht.DEFAULT_ANISOTROPY,h=Gn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Rg++}),this.uuid=Fn(),this.name="",this.source=new Ts(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new $(0,0),this.repeat=new $(1,1),this.center=new $(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new et,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==$l)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case gr:e.x=e.x-Math.floor(e.x);break;case Wn:e.x=e.x<0?0:1;break;case ma:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case gr:e.y=e.y-Math.floor(e.y);break;case Wn:e.y=e.y<0?0:1;break;case ma:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}Ht.DEFAULT_IMAGE=null;Ht.DEFAULT_MAPPING=$l;Ht.DEFAULT_ANISOTROPY=1;class ot{constructor(e=0,t=0,n=0,s=1){ot.prototype.isVector4=!0,this.x=e,this.y=t,this.z=n,this.w=s}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,s){return this.x=e,this.y=t,this.z=n,this.w=s,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*s+a[12]*r,this.y=a[1]*t+a[5]*n+a[9]*s+a[13]*r,this.z=a[2]*t+a[6]*n+a[10]*s+a[14]*r,this.w=a[3]*t+a[7]*n+a[11]*s+a[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,s,r;const l=e.elements,c=l[0],h=l[4],f=l[8],p=l[1],u=l[5],g=l[9],y=l[2],d=l[6],m=l[10];if(Math.abs(h-p)<.01&&Math.abs(f-y)<.01&&Math.abs(g-d)<.01){if(Math.abs(h+p)<.1&&Math.abs(f+y)<.1&&Math.abs(g+d)<.1&&Math.abs(c+u+m-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const x=(c+1)/2,v=(u+1)/2,E=(m+1)/2,T=(h+p)/4,R=(f+y)/4,P=(g+d)/4;return x>v&&x>E?x<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(x),s=T/n,r=R/n):v>E?v<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(v),n=T/s,r=P/s):E<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(E),n=R/r,s=P/r),this.set(n,s,r,t),this}let _=Math.sqrt((d-g)*(d-g)+(f-y)*(f-y)+(p-h)*(p-h));return Math.abs(_)<.001&&(_=1),this.x=(d-g)/_,this.y=(f-y)/_,this.z=(p-h)/_,this.w=Math.acos((c+u+m-1)/2),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this.w=Math.max(e.w,Math.min(t.w,this.w)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this.w=Math.max(e,Math.min(t,this.w)),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class s0 extends vi{constructor(e=1,t=1,n={}){super(),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=1,this.scissor=new ot(0,0,e,t),this.scissorTest=!1,this.viewport=new ot(0,0,e,t);const s={width:e,height:t,depth:1};n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Vt,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},n);const r=new Ht(s,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace);r.flipY=!1,r.generateMipmaps=n.generateMipmaps,r.internalFormat=n.internalFormat,this.textures=[];const a=n.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0;this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=e,this.textures[s].image.height=t,this.textures[s].image.depth=n;this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let n=0,s=e.textures.length;n<s;n++)this.textures[n]=e.textures[n].clone(),this.textures[n].isRenderTargetTexture=!0;const t=Object.assign({},e.texture.image);return this.texture.source=new Ts(t),this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class ln extends s0{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}}class ic extends Ht{constructor(e=null,t=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=Qt,this.minFilter=Qt,this.wrapR=Wn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class Pg extends ln{constructor(e=1,t=1,n=1,s={}){super(e,t,s),this.isWebGLArrayRenderTarget=!0,this.depth=n,this.texture=new ic(null,e,t,n),this.texture.isRenderTargetTexture=!0}}class wf extends Ht{constructor(e=null,t=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=Qt,this.minFilter=Qt,this.wrapR=Wn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Ig extends ln{constructor(e=1,t=1,n=1,s={}){super(e,t,s),this.isWebGL3DRenderTarget=!0,this.depth=n,this.texture=new wf(null,e,t,n),this.texture.isRenderTargetTexture=!0}}class en{constructor(e=0,t=0,n=0,s=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=s}static slerpFlat(e,t,n,s,r,a,o){let l=n[s+0],c=n[s+1],h=n[s+2],f=n[s+3];const p=r[a+0],u=r[a+1],g=r[a+2],y=r[a+3];if(o===0){e[t+0]=l,e[t+1]=c,e[t+2]=h,e[t+3]=f;return}if(o===1){e[t+0]=p,e[t+1]=u,e[t+2]=g,e[t+3]=y;return}if(f!==y||l!==p||c!==u||h!==g){let d=1-o;const m=l*p+c*u+h*g+f*y,_=m>=0?1:-1,x=1-m*m;if(x>Number.EPSILON){const E=Math.sqrt(x),T=Math.atan2(E,m*_);d=Math.sin(d*T)/E,o=Math.sin(o*T)/E}const v=o*_;if(l=l*d+p*v,c=c*d+u*v,h=h*d+g*v,f=f*d+y*v,d===1-o){const E=1/Math.sqrt(l*l+c*c+h*h+f*f);l*=E,c*=E,h*=E,f*=E}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=f}static multiplyQuaternionsFlat(e,t,n,s,r,a){const o=n[s],l=n[s+1],c=n[s+2],h=n[s+3],f=r[a],p=r[a+1],u=r[a+2],g=r[a+3];return e[t]=o*g+h*f+l*u-c*p,e[t+1]=l*g+h*p+c*f-o*u,e[t+2]=c*g+h*u+o*p-l*f,e[t+3]=h*g-o*f-l*p-c*u,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,s){return this._x=e,this._y=t,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const n=e._x,s=e._y,r=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(n/2),h=o(s/2),f=o(r/2),p=l(n/2),u=l(s/2),g=l(r/2);switch(a){case"XYZ":this._x=p*h*f+c*u*g,this._y=c*u*f-p*h*g,this._z=c*h*g+p*u*f,this._w=c*h*f-p*u*g;break;case"YXZ":this._x=p*h*f+c*u*g,this._y=c*u*f-p*h*g,this._z=c*h*g-p*u*f,this._w=c*h*f+p*u*g;break;case"ZXY":this._x=p*h*f-c*u*g,this._y=c*u*f+p*h*g,this._z=c*h*g+p*u*f,this._w=c*h*f-p*u*g;break;case"ZYX":this._x=p*h*f-c*u*g,this._y=c*u*f+p*h*g,this._z=c*h*g-p*u*f,this._w=c*h*f+p*u*g;break;case"YZX":this._x=p*h*f+c*u*g,this._y=c*u*f+p*h*g,this._z=c*h*g-p*u*f,this._w=c*h*f-p*u*g;break;case"XZY":this._x=p*h*f-c*u*g,this._y=c*u*f-p*h*g,this._z=c*h*g+p*u*f,this._w=c*h*f+p*u*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const n=t/2,s=Math.sin(n);return this._x=e.x*s,this._y=e.y*s,this._z=e.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,n=t[0],s=t[4],r=t[8],a=t[1],o=t[5],l=t[9],c=t[2],h=t[6],f=t[10],p=n+o+f;if(p>0){const u=.5/Math.sqrt(p+1);this._w=.25/u,this._x=(h-l)*u,this._y=(r-c)*u,this._z=(a-s)*u}else if(n>o&&n>f){const u=2*Math.sqrt(1+n-o-f);this._w=(h-l)/u,this._x=.25*u,this._y=(s+a)/u,this._z=(r+c)/u}else if(o>f){const u=2*Math.sqrt(1+o-n-f);this._w=(r-c)/u,this._x=(s+a)/u,this._y=.25*u,this._z=(l+h)/u}else{const u=2*Math.sqrt(1+f-n-o);this._w=(a-s)/u,this._x=(r+c)/u,this._y=(l+h)/u,this._z=.25*u}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<Number.EPSILON?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(kt(this.dot(e),-1,1)))}rotateTowards(e,t){const n=this.angleTo(e);if(n===0)return this;const s=Math.min(1,t/n);return this.slerp(e,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const n=e._x,s=e._y,r=e._z,a=e._w,o=t._x,l=t._y,c=t._z,h=t._w;return this._x=n*h+a*o+s*c-r*l,this._y=s*h+a*l+r*o-n*c,this._z=r*h+a*c+n*l-s*o,this._w=a*h-n*o-s*l-r*c,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);const n=this._x,s=this._y,r=this._z,a=this._w;let o=a*e._w+n*e._x+s*e._y+r*e._z;if(o<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,o=-o):this.copy(e),o>=1)return this._w=a,this._x=n,this._y=s,this._z=r,this;const l=1-o*o;if(l<=Number.EPSILON){const u=1-t;return this._w=u*a+t*this._w,this._x=u*n+t*this._x,this._y=u*s+t*this._y,this._z=u*r+t*this._z,this.normalize(),this}const c=Math.sqrt(l),h=Math.atan2(c,o),f=Math.sin((1-t)*h)/c,p=Math.sin(t*h)/c;return this._w=a*f+this._w*p,this._x=n*f+this._x*p,this._y=s*f+this._y*p,this._z=r*f+this._z*p,this._onChangeCallback(),this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(e),s*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class w{constructor(e=0,t=0,n=0){w.prototype.isVector3=!0,this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Eu.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Eu.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*s,this.y=r[1]*t+r[4]*n+r[7]*s,this.z=r[2]*t+r[5]*n+r[8]*s,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=e.elements,a=1/(r[3]*t+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*s+r[12])*a,this.y=(r[1]*t+r[5]*n+r[9]*s+r[13])*a,this.z=(r[2]*t+r[6]*n+r[10]*s+r[14])*a,this}applyQuaternion(e){const t=this.x,n=this.y,s=this.z,r=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*s-o*n),h=2*(o*t-r*s),f=2*(r*n-a*t);return this.x=t+l*c+a*f-o*h,this.y=n+l*h+o*c-r*f,this.z=s+l*f+r*h-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*s,this.y=r[1]*t+r[5]*n+r[9]*s,this.z=r[2]*t+r[6]*n+r[10]*s,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const n=e.x,s=e.y,r=e.z,a=t.x,o=t.y,l=t.z;return this.x=s*l-r*o,this.y=r*a-n*l,this.z=n*o-s*a,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Hc.copy(this).projectOnVector(e),this.sub(Hc)}reflect(e){return this.sub(Hc.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(kt(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y,s=this.z-e.z;return t*t+n*n+s*s}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){const s=Math.sin(t)*e;return this.x=s*Math.sin(n),this.y=Math.cos(t)*e,this.z=s*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),s=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=s,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const Hc=new w,Eu=new en;class jt{constructor(e=new w(1/0,1/0,1/0),t=new w(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Jn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Jn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const n=Jn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const n=e.geometry;if(n!==void 0){const r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,Jn):Jn.fromBufferAttribute(r,a),Jn.applyMatrix4(e.matrixWorld),this.expandByPoint(Jn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),Ja.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Ja.copy(n.boundingBox)),Ja.applyMatrix4(e.matrixWorld),this.union(Ja)}const s=e.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Jn),Jn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Nr),ja.subVectors(this.max,Nr),Zs.subVectors(e.a,Nr),qs.subVectors(e.b,Nr),$s.subVectors(e.c,Nr),Vi.subVectors(qs,Zs),Hi.subVectors($s,qs),rs.subVectors(Zs,$s);let t=[0,-Vi.z,Vi.y,0,-Hi.z,Hi.y,0,-rs.z,rs.y,Vi.z,0,-Vi.x,Hi.z,0,-Hi.x,rs.z,0,-rs.x,-Vi.y,Vi.x,0,-Hi.y,Hi.x,0,-rs.y,rs.x,0];return!Gc(t,Zs,qs,$s,ja)||(t=[1,0,0,0,1,0,0,0,1],!Gc(t,Zs,qs,$s,ja))?!1:(Qa.crossVectors(Vi,Hi),t=[Qa.x,Qa.y,Qa.z],Gc(t,Zs,qs,$s,ja))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Jn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Jn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(wi[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),wi[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),wi[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),wi[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),wi[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),wi[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),wi[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),wi[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(wi),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}}const wi=[new w,new w,new w,new w,new w,new w,new w,new w],Jn=new w,Ja=new jt,Zs=new w,qs=new w,$s=new w,Vi=new w,Hi=new w,rs=new w,Nr=new w,ja=new w,Qa=new w,as=new w;function Gc(i,e,t,n,s){for(let r=0,a=i.length-3;r<=a;r+=3){as.fromArray(i,r);const o=s.x*Math.abs(as.x)+s.y*Math.abs(as.y)+s.z*Math.abs(as.z),l=e.dot(as),c=t.dot(as),h=n.dot(as);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}const Dg=new jt,Or=new w,Wc=new w;class gn{constructor(e=new w,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const n=this.center;t!==void 0?n.copy(t):Dg.setFromPoints(e).getCenter(n);let s=0;for(let r=0,a=e.length;r<a;r++)s=Math.max(s,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(s),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Or.subVectors(e,this.center);const t=Or.lengthSq();if(t>this.radius*this.radius){const n=Math.sqrt(t),s=(n-this.radius)*.5;this.center.addScaledVector(Or,s/n),this.radius+=s}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Wc.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Or.copy(e.center).add(Wc)),this.expandByPoint(Or.copy(e.center).sub(Wc))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}}const Ti=new w,Xc=new w,eo=new w,Gi=new w,Yc=new w,to=new w,Zc=new w;class Vs{constructor(e=new w,t=new w(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Ti)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=Ti.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Ti.copy(this.origin).addScaledVector(this.direction,t),Ti.distanceToSquared(e))}distanceSqToSegment(e,t,n,s){Xc.copy(e).add(t).multiplyScalar(.5),eo.copy(t).sub(e).normalize(),Gi.copy(this.origin).sub(Xc);const r=e.distanceTo(t)*.5,a=-this.direction.dot(eo),o=Gi.dot(this.direction),l=-Gi.dot(eo),c=Gi.lengthSq(),h=Math.abs(1-a*a);let f,p,u,g;if(h>0)if(f=a*l-o,p=a*o-l,g=r*h,f>=0)if(p>=-g)if(p<=g){const y=1/h;f*=y,p*=y,u=f*(f+a*p+2*o)+p*(a*f+p+2*l)+c}else p=r,f=Math.max(0,-(a*p+o)),u=-f*f+p*(p+2*l)+c;else p=-r,f=Math.max(0,-(a*p+o)),u=-f*f+p*(p+2*l)+c;else p<=-g?(f=Math.max(0,-(-a*r+o)),p=f>0?-r:Math.min(Math.max(-r,-l),r),u=-f*f+p*(p+2*l)+c):p<=g?(f=0,p=Math.min(Math.max(-r,-l),r),u=p*(p+2*l)+c):(f=Math.max(0,-(a*r+o)),p=f>0?r:Math.min(Math.max(-r,-l),r),u=-f*f+p*(p+2*l)+c);else p=a>0?-r:r,f=Math.max(0,-(a*p+o)),u=-f*f+p*(p+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,f),s&&s.copy(Xc).addScaledVector(eo,p),u}intersectSphere(e,t){Ti.subVectors(e.center,this.origin);const n=Ti.dot(this.direction),s=Ti.dot(Ti)-n*n,r=e.radius*e.radius;if(s>r)return null;const a=Math.sqrt(r-s),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){const n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,s,r,a,o,l;const c=1/this.direction.x,h=1/this.direction.y,f=1/this.direction.z,p=this.origin;return c>=0?(n=(e.min.x-p.x)*c,s=(e.max.x-p.x)*c):(n=(e.max.x-p.x)*c,s=(e.min.x-p.x)*c),h>=0?(r=(e.min.y-p.y)*h,a=(e.max.y-p.y)*h):(r=(e.max.y-p.y)*h,a=(e.min.y-p.y)*h),n>a||r>s||((r>n||isNaN(n))&&(n=r),(a<s||isNaN(s))&&(s=a),f>=0?(o=(e.min.z-p.z)*f,l=(e.max.z-p.z)*f):(o=(e.max.z-p.z)*f,l=(e.min.z-p.z)*f),n>l||o>s)||((o>n||n!==n)&&(n=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,t)}intersectsBox(e){return this.intersectBox(e,Ti)!==null}intersectTriangle(e,t,n,s,r){Yc.subVectors(t,e),to.subVectors(n,e),Zc.crossVectors(Yc,to);let a=this.direction.dot(Zc),o;if(a>0){if(s)return null;o=1}else if(a<0)o=-1,a=-a;else return null;Gi.subVectors(this.origin,e);const l=o*this.direction.dot(to.crossVectors(Gi,to));if(l<0)return null;const c=o*this.direction.dot(Yc.cross(Gi));if(c<0||l+c>a)return null;const h=-o*Gi.dot(Zc);return h<0?null:this.at(h/a,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class Ye{constructor(e,t,n,s,r,a,o,l,c,h,f,p,u,g,y,d){Ye.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,a,o,l,c,h,f,p,u,g,y,d)}set(e,t,n,s,r,a,o,l,c,h,f,p,u,g,y,d){const m=this.elements;return m[0]=e,m[4]=t,m[8]=n,m[12]=s,m[1]=r,m[5]=a,m[9]=o,m[13]=l,m[2]=c,m[6]=h,m[10]=f,m[14]=p,m[3]=u,m[7]=g,m[11]=y,m[15]=d,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Ye().fromArray(this.elements)}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){const t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){const t=this.elements,n=e.elements,s=1/Ks.setFromMatrixColumn(e,0).length(),r=1/Ks.setFromMatrixColumn(e,1).length(),a=1/Ks.setFromMatrixColumn(e,2).length();return t[0]=n[0]*s,t[1]=n[1]*s,t[2]=n[2]*s,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,n=e.x,s=e.y,r=e.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(s),c=Math.sin(s),h=Math.cos(r),f=Math.sin(r);if(e.order==="XYZ"){const p=a*h,u=a*f,g=o*h,y=o*f;t[0]=l*h,t[4]=-l*f,t[8]=c,t[1]=u+g*c,t[5]=p-y*c,t[9]=-o*l,t[2]=y-p*c,t[6]=g+u*c,t[10]=a*l}else if(e.order==="YXZ"){const p=l*h,u=l*f,g=c*h,y=c*f;t[0]=p+y*o,t[4]=g*o-u,t[8]=a*c,t[1]=a*f,t[5]=a*h,t[9]=-o,t[2]=u*o-g,t[6]=y+p*o,t[10]=a*l}else if(e.order==="ZXY"){const p=l*h,u=l*f,g=c*h,y=c*f;t[0]=p-y*o,t[4]=-a*f,t[8]=g+u*o,t[1]=u+g*o,t[5]=a*h,t[9]=y-p*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){const p=a*h,u=a*f,g=o*h,y=o*f;t[0]=l*h,t[4]=g*c-u,t[8]=p*c+y,t[1]=l*f,t[5]=y*c+p,t[9]=u*c-g,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){const p=a*l,u=a*c,g=o*l,y=o*c;t[0]=l*h,t[4]=y-p*f,t[8]=g*f+u,t[1]=f,t[5]=a*h,t[9]=-o*h,t[2]=-c*h,t[6]=u*f+g,t[10]=p-y*f}else if(e.order==="XZY"){const p=a*l,u=a*c,g=o*l,y=o*c;t[0]=l*h,t[4]=-f,t[8]=c*h,t[1]=p*f+y,t[5]=a*h,t[9]=u*f-g,t[2]=g*f-u,t[6]=o*h,t[10]=y*f+p}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Lg,e,zg)}lookAt(e,t,n){const s=this.elements;return Nn.subVectors(e,t),Nn.lengthSq()===0&&(Nn.z=1),Nn.normalize(),Wi.crossVectors(n,Nn),Wi.lengthSq()===0&&(Math.abs(n.z)===1?Nn.x+=1e-4:Nn.z+=1e-4,Nn.normalize(),Wi.crossVectors(n,Nn)),Wi.normalize(),no.crossVectors(Nn,Wi),s[0]=Wi.x,s[4]=no.x,s[8]=Nn.x,s[1]=Wi.y,s[5]=no.y,s[9]=Nn.y,s[2]=Wi.z,s[6]=no.z,s[10]=Nn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],h=n[1],f=n[5],p=n[9],u=n[13],g=n[2],y=n[6],d=n[10],m=n[14],_=n[3],x=n[7],v=n[11],E=n[15],T=s[0],R=s[4],P=s[8],S=s[12],M=s[1],D=s[5],U=s[9],B=s[13],G=s[2],Y=s[6],W=s[10],te=s[14],X=s[3],de=s[7],ve=s[11],ge=s[15];return r[0]=a*T+o*M+l*G+c*X,r[4]=a*R+o*D+l*Y+c*de,r[8]=a*P+o*U+l*W+c*ve,r[12]=a*S+o*B+l*te+c*ge,r[1]=h*T+f*M+p*G+u*X,r[5]=h*R+f*D+p*Y+u*de,r[9]=h*P+f*U+p*W+u*ve,r[13]=h*S+f*B+p*te+u*ge,r[2]=g*T+y*M+d*G+m*X,r[6]=g*R+y*D+d*Y+m*de,r[10]=g*P+y*U+d*W+m*ve,r[14]=g*S+y*B+d*te+m*ge,r[3]=_*T+x*M+v*G+E*X,r[7]=_*R+x*D+v*Y+E*de,r[11]=_*P+x*U+v*W+E*ve,r[15]=_*S+x*B+v*te+E*ge,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[4],s=e[8],r=e[12],a=e[1],o=e[5],l=e[9],c=e[13],h=e[2],f=e[6],p=e[10],u=e[14],g=e[3],y=e[7],d=e[11],m=e[15];return g*(+r*l*f-s*c*f-r*o*p+n*c*p+s*o*u-n*l*u)+y*(+t*l*u-t*c*p+r*a*p-s*a*u+s*c*h-r*l*h)+d*(+t*c*f-t*o*u-r*a*f+n*a*u+r*o*h-n*c*h)+m*(-s*o*h-t*l*f+t*o*p+s*a*f-n*a*p+n*l*h)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){const s=this.elements;return e.isVector3?(s[12]=e.x,s[13]=e.y,s[14]=e.z):(s[12]=e,s[13]=t,s[14]=n),this}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8],f=e[9],p=e[10],u=e[11],g=e[12],y=e[13],d=e[14],m=e[15],_=f*d*c-y*p*c+y*l*u-o*d*u-f*l*m+o*p*m,x=g*p*c-h*d*c-g*l*u+a*d*u+h*l*m-a*p*m,v=h*y*c-g*f*c+g*o*u-a*y*u-h*o*m+a*f*m,E=g*f*l-h*y*l-g*o*p+a*y*p+h*o*d-a*f*d,T=t*_+n*x+s*v+r*E;if(T===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const R=1/T;return e[0]=_*R,e[1]=(y*p*r-f*d*r-y*s*u+n*d*u+f*s*m-n*p*m)*R,e[2]=(o*d*r-y*l*r+y*s*c-n*d*c-o*s*m+n*l*m)*R,e[3]=(f*l*r-o*p*r-f*s*c+n*p*c+o*s*u-n*l*u)*R,e[4]=x*R,e[5]=(h*d*r-g*p*r+g*s*u-t*d*u-h*s*m+t*p*m)*R,e[6]=(g*l*r-a*d*r-g*s*c+t*d*c+a*s*m-t*l*m)*R,e[7]=(a*p*r-h*l*r+h*s*c-t*p*c-a*s*u+t*l*u)*R,e[8]=v*R,e[9]=(g*f*r-h*y*r-g*n*u+t*y*u+h*n*m-t*f*m)*R,e[10]=(a*y*r-g*o*r+g*n*c-t*y*c-a*n*m+t*o*m)*R,e[11]=(h*o*r-a*f*r-h*n*c+t*f*c+a*n*u-t*o*u)*R,e[12]=E*R,e[13]=(h*y*s-g*f*s+g*n*p-t*y*p-h*n*d+t*f*d)*R,e[14]=(g*o*s-a*y*s-g*n*l+t*y*l+a*n*d-t*o*d)*R,e[15]=(a*f*s-h*o*s+h*n*l-t*f*l-a*n*p+t*o*p)*R,this}scale(e){const t=this.elements,n=e.x,s=e.y,r=e.z;return t[0]*=n,t[4]*=s,t[8]*=r,t[1]*=n,t[5]*=s,t[9]*=r,t[2]*=n,t[6]*=s,t[10]*=r,t[3]*=n,t[7]*=s,t[11]*=r,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],s=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,s))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const n=Math.cos(t),s=Math.sin(t),r=1-n,a=e.x,o=e.y,l=e.z,c=r*a,h=r*o;return this.set(c*a+n,c*o-s*l,c*l+s*o,0,c*o+s*l,h*o+n,h*l-s*a,0,c*l-s*o,h*l+s*a,r*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,s,r,a){return this.set(1,n,r,0,e,1,a,0,t,s,1,0,0,0,0,1),this}compose(e,t,n){const s=this.elements,r=t._x,a=t._y,o=t._z,l=t._w,c=r+r,h=a+a,f=o+o,p=r*c,u=r*h,g=r*f,y=a*h,d=a*f,m=o*f,_=l*c,x=l*h,v=l*f,E=n.x,T=n.y,R=n.z;return s[0]=(1-(y+m))*E,s[1]=(u+v)*E,s[2]=(g-x)*E,s[3]=0,s[4]=(u-v)*T,s[5]=(1-(p+m))*T,s[6]=(d+_)*T,s[7]=0,s[8]=(g+x)*R,s[9]=(d-_)*R,s[10]=(1-(p+y))*R,s[11]=0,s[12]=e.x,s[13]=e.y,s[14]=e.z,s[15]=1,this}decompose(e,t,n){const s=this.elements;let r=Ks.set(s[0],s[1],s[2]).length();const a=Ks.set(s[4],s[5],s[6]).length(),o=Ks.set(s[8],s[9],s[10]).length();this.determinant()<0&&(r=-r),e.x=s[12],e.y=s[13],e.z=s[14],jn.copy(this);const c=1/r,h=1/a,f=1/o;return jn.elements[0]*=c,jn.elements[1]*=c,jn.elements[2]*=c,jn.elements[4]*=h,jn.elements[5]*=h,jn.elements[6]*=h,jn.elements[8]*=f,jn.elements[9]*=f,jn.elements[10]*=f,t.setFromRotationMatrix(jn),n.x=r,n.y=a,n.z=o,this}makePerspective(e,t,n,s,r,a,o=ui){const l=this.elements,c=2*r/(t-e),h=2*r/(n-s),f=(t+e)/(t-e),p=(n+s)/(n-s);let u,g;if(o===ui)u=-(a+r)/(a-r),g=-2*a*r/(a-r);else if(o===xa)u=-a/(a-r),g=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=c,l[4]=0,l[8]=f,l[12]=0,l[1]=0,l[5]=h,l[9]=p,l[13]=0,l[2]=0,l[6]=0,l[10]=u,l[14]=g,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(e,t,n,s,r,a,o=ui){const l=this.elements,c=1/(t-e),h=1/(n-s),f=1/(a-r),p=(t+e)*c,u=(n+s)*h;let g,y;if(o===ui)g=(a+r)*f,y=-2*f;else if(o===xa)g=r*f,y=-1*f;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-p,l[1]=0,l[5]=2*h,l[9]=0,l[13]=-u,l[2]=0,l[6]=0,l[10]=y,l[14]=-g,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<16;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}}const Ks=new w,jn=new Ye,Lg=new w(0,0,0),zg=new w(1,1,1),Wi=new w,no=new w,Nn=new w,Cu=new Ye,Ru=new en;class Mn{constructor(e=0,t=0,n=0,s=Mn.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=s}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,s=this._order){return this._x=e,this._y=t,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){const s=e.elements,r=s[0],a=s[4],o=s[8],l=s[1],c=s[5],h=s[9],f=s[2],p=s[6],u=s[10];switch(t){case"XYZ":this._y=Math.asin(kt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,u),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(p,c),this._z=0);break;case"YXZ":this._x=Math.asin(-kt(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,u),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-f,r),this._z=0);break;case"ZXY":this._x=Math.asin(kt(p,-1,1)),Math.abs(p)<.9999999?(this._y=Math.atan2(-f,u),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-kt(f,-1,1)),Math.abs(f)<.9999999?(this._x=Math.atan2(p,u),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(kt(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-f,r)):(this._x=0,this._y=Math.atan2(o,u));break;case"XZY":this._z=Math.asin(-kt(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(p,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,u),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return Cu.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Cu,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Ru.setFromEuler(this),this.setFromQuaternion(Ru,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}Mn.DEFAULT_ORDER="XYZ";class sc{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let Ug=0;const Pu=new w,Js=new en,Ai=new Ye,io=new w,Fr=new w,Ng=new w,Og=new en,Iu=new w(1,0,0),Du=new w(0,1,0),Lu=new w(0,0,1),zu={type:"added"},Fg={type:"removed"},js={type:"childadded",child:null},qc={type:"childremoved",child:null};class dt extends vi{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Ug++}),this.uuid=Fn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=dt.DEFAULT_UP.clone();const e=new w,t=new Mn,n=new en,s=new w(1,1,1);function r(){n.setFromEuler(t,!1)}function a(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new Ye},normalMatrix:{value:new et}}),this.matrix=new Ye,this.matrixWorld=new Ye,this.matrixAutoUpdate=dt.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=dt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new sc,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return Js.setFromAxisAngle(e,t),this.quaternion.multiply(Js),this}rotateOnWorldAxis(e,t){return Js.setFromAxisAngle(e,t),this.quaternion.premultiply(Js),this}rotateX(e){return this.rotateOnAxis(Iu,e)}rotateY(e){return this.rotateOnAxis(Du,e)}rotateZ(e){return this.rotateOnAxis(Lu,e)}translateOnAxis(e,t){return Pu.copy(e).applyQuaternion(this.quaternion),this.position.add(Pu.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Iu,e)}translateY(e){return this.translateOnAxis(Du,e)}translateZ(e){return this.translateOnAxis(Lu,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Ai.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?io.copy(e):io.set(e,t,n);const s=this.parent;this.updateWorldMatrix(!0,!1),Fr.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Ai.lookAt(Fr,io,this.up):Ai.lookAt(io,Fr,this.up),this.quaternion.setFromRotationMatrix(Ai),s&&(Ai.extractRotation(s.matrixWorld),Js.setFromRotationMatrix(Ai),this.quaternion.premultiply(Js.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(zu),js.child=e,this.dispatchEvent(js),js.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Fg),qc.child=e,this.dispatchEvent(qc),qc.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Ai.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Ai.multiply(e.parent.matrixWorld)),e.applyMatrix4(Ai),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(zu),js.child=e,this.dispatchEvent(js),js.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,s=this.children.length;n<s;n++){const a=this.children[n].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);const s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Fr,e,Ng),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Fr,Og,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t){const n=this.parent;if(e===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),t===!0){const s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].updateWorldMatrix(!1,!0)}}toJSON(e){const t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.visibility=this._visibility,s.active=this._active,s.bounds=this._bounds.map(o=>({boxInitialized:o.boxInitialized,boxMin:o.box.min.toArray(),boxMax:o.box.max.toArray(),sphereInitialized:o.sphereInitialized,sphereRadius:o.sphere.radius,sphereCenter:o.sphere.center.toArray()})),s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.geometryCount=this._geometryCount,s.matricesTexture=this._matricesTexture.toJSON(e),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(s.boundingSphere={center:s.boundingSphere.center.toArray(),radius:s.boundingSphere.radius}),this.boundingBox!==null&&(s.boundingBox={min:s.boundingBox.min.toArray(),max:s.boundingBox.max.toArray()}));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(e.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){const f=l[c];r(e.shapes,f)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(e.materials,this.material[l]));s.material=o}else s.material=r(e.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];s.animations.push(r(e.animations,l))}}if(t){const o=a(e.geometries),l=a(e.materials),c=a(e.textures),h=a(e.images),f=a(e.shapes),p=a(e.skeletons),u=a(e.animations),g=a(e.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),f.length>0&&(n.shapes=f),p.length>0&&(n.skeletons=p),u.length>0&&(n.animations=u),g.length>0&&(n.nodes=g)}return n.object=s,n;function a(o){const l=[];for(const c in o){const h=o[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){const s=e.children[n];this.add(s.clone())}return this}}dt.DEFAULT_UP=new w(0,1,0);dt.DEFAULT_MATRIX_AUTO_UPDATE=!0;dt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const Qn=new w,Ei=new w,$c=new w,Ci=new w,Qs=new w,er=new w,Uu=new w,Kc=new w,Jc=new w,jc=new w,Qc=new ot,eh=new ot,th=new ot;class En{constructor(e=new w,t=new w,n=new w){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,s){s.subVectors(n,t),Qn.subVectors(e,t),s.cross(Qn);const r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(e,t,n,s,r){Qn.subVectors(s,t),Ei.subVectors(n,t),$c.subVectors(e,t);const a=Qn.dot(Qn),o=Qn.dot(Ei),l=Qn.dot($c),c=Ei.dot(Ei),h=Ei.dot($c),f=a*c-o*o;if(f===0)return r.set(0,0,0),null;const p=1/f,u=(c*l-o*h)*p,g=(a*h-o*l)*p;return r.set(1-u-g,g,u)}static containsPoint(e,t,n,s){return this.getBarycoord(e,t,n,s,Ci)===null?!1:Ci.x>=0&&Ci.y>=0&&Ci.x+Ci.y<=1}static getInterpolation(e,t,n,s,r,a,o,l){return this.getBarycoord(e,t,n,s,Ci)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,Ci.x),l.addScaledVector(a,Ci.y),l.addScaledVector(o,Ci.z),l)}static getInterpolatedAttribute(e,t,n,s,r,a){return Qc.setScalar(0),eh.setScalar(0),th.setScalar(0),Qc.fromBufferAttribute(e,t),eh.fromBufferAttribute(e,n),th.fromBufferAttribute(e,s),a.setScalar(0),a.addScaledVector(Qc,r.x),a.addScaledVector(eh,r.y),a.addScaledVector(th,r.z),a}static isFrontFacing(e,t,n,s){return Qn.subVectors(n,t),Ei.subVectors(e,t),Qn.cross(Ei).dot(s)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,s){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[s]),this}setFromAttributeAndIndices(e,t,n,s){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,s),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Qn.subVectors(this.c,this.b),Ei.subVectors(this.a,this.b),Qn.cross(Ei).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return En.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return En.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,s,r){return En.getInterpolation(e,this.a,this.b,this.c,t,n,s,r)}containsPoint(e){return En.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return En.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const n=this.a,s=this.b,r=this.c;let a,o;Qs.subVectors(s,n),er.subVectors(r,n),Kc.subVectors(e,n);const l=Qs.dot(Kc),c=er.dot(Kc);if(l<=0&&c<=0)return t.copy(n);Jc.subVectors(e,s);const h=Qs.dot(Jc),f=er.dot(Jc);if(h>=0&&f<=h)return t.copy(s);const p=l*f-h*c;if(p<=0&&l>=0&&h<=0)return a=l/(l-h),t.copy(n).addScaledVector(Qs,a);jc.subVectors(e,r);const u=Qs.dot(jc),g=er.dot(jc);if(g>=0&&u<=g)return t.copy(r);const y=u*c-l*g;if(y<=0&&c>=0&&g<=0)return o=c/(c-g),t.copy(n).addScaledVector(er,o);const d=h*g-u*f;if(d<=0&&f-h>=0&&u-g>=0)return Uu.subVectors(r,s),o=(f-h)/(f-h+(u-g)),t.copy(s).addScaledVector(Uu,o);const m=1/(d+y+p);return a=y*m,o=p*m,t.copy(n).addScaledVector(Qs,a).addScaledVector(er,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}const r0={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Xi={h:0,s:0,l:0},so={h:0,s:0,l:0};function nh(i,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?i+(e-i)*6*t:t<1/2?e:t<2/3?i+(e-i)*6*(2/3-t):i}class re{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){const s=e;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Dt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,ct.toWorkingColorSpace(this,t),this}setRGB(e,t,n,s=ct.workingColorSpace){return this.r=e,this.g=t,this.b=n,ct.toWorkingColorSpace(this,s),this}setHSL(e,t,n,s=ct.workingColorSpace){if(e=Sf(e,1),t=kt(t,0,1),n=kt(n,0,1),t===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+t):n+t-n*t,a=2*n-r;this.r=nh(a,r,e+1/3),this.g=nh(a,r,e),this.b=nh(a,r,e-1/3)}return ct.toWorkingColorSpace(this,s),this}setStyle(e,t=Dt){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(e)){let r;const a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(e)){const r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(r,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Dt){const n=r0[e.toLowerCase()];return n!==void 0?this.setHex(n,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=zi(e.r),this.g=zi(e.g),this.b=zi(e.b),this}copyLinearToSRGB(e){return this.r=mr(e.r),this.g=mr(e.g),this.b=mr(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Dt){return ct.fromWorkingColorSpace(fn.copy(this),e),Math.round(kt(fn.r*255,0,255))*65536+Math.round(kt(fn.g*255,0,255))*256+Math.round(kt(fn.b*255,0,255))}getHexString(e=Dt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=ct.workingColorSpace){ct.fromWorkingColorSpace(fn.copy(this),t);const n=fn.r,s=fn.g,r=fn.b,a=Math.max(n,s,r),o=Math.min(n,s,r);let l,c;const h=(o+a)/2;if(o===a)l=0,c=0;else{const f=a-o;switch(c=h<=.5?f/(a+o):f/(2-a-o),a){case n:l=(s-r)/f+(s<r?6:0);break;case s:l=(r-n)/f+2;break;case r:l=(n-s)/f+4;break}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=ct.workingColorSpace){return ct.fromWorkingColorSpace(fn.copy(this),t),e.r=fn.r,e.g=fn.g,e.b=fn.b,e}getStyle(e=Dt){ct.fromWorkingColorSpace(fn.copy(this),e);const t=fn.r,n=fn.g,s=fn.b;return e!==Dt?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(e,t,n){return this.getHSL(Xi),this.setHSL(Xi.h+e,Xi.s+t,Xi.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(Xi),e.getHSL(so);const n=la(Xi.h,so.h,t),s=la(Xi.s,so.s,t),r=la(Xi.l,so.l,t);return this.setHSL(n,s,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,n=this.g,s=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*s,this.g=r[1]*t+r[4]*n+r[7]*s,this.b=r[2]*t+r[5]*n+r[8]*s,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const fn=new re;re.NAMES=r0;let Bg=0;class yn extends vi{static get type(){return"Material"}get type(){return this.constructor.type}set type(e){}constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Bg++}),this.uuid=Fn(),this.name="",this.blending=ii,this.side=Pn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=nl,this.blendDst=il,this.blendEquation=Ki,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new re(0,0,0),this.blendAlpha=0,this.depthFunc=Is,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Yh,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=_s,this.stencilZFail=_s,this.stencilZPass=_s,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const n=e[t];if(n===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==ii&&(n.blending=this.blending),this.side!==Pn&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==nl&&(n.blendSrc=this.blendSrc),this.blendDst!==il&&(n.blendDst=this.blendDst),this.blendEquation!==Ki&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Is&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Yh&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==_s&&(n.stencilFail=this.stencilFail),this.stencilZFail!==_s&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==_s&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){const a=[];for(const o in r){const l=r[o];delete l.metadata,a.push(l)}return a}if(t){const r=s(e.textures),a=s(e.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let n=null;if(t!==null){const s=t.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}}class De extends yn{static get type(){return"MeshBasicMaterial"}constructor(e){super(),this.isMeshBasicMaterial=!0,this.color=new re(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Mn,this.combine=Da,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const Ii=kg();function kg(){const i=new ArrayBuffer(4),e=new Float32Array(i),t=new Uint32Array(i),n=new Uint32Array(512),s=new Uint32Array(512);for(let l=0;l<256;++l){const c=l-127;c<-27?(n[l]=0,n[l|256]=32768,s[l]=24,s[l|256]=24):c<-14?(n[l]=1024>>-c-14,n[l|256]=1024>>-c-14|32768,s[l]=-c-1,s[l|256]=-c-1):c<=15?(n[l]=c+15<<10,n[l|256]=c+15<<10|32768,s[l]=13,s[l|256]=13):c<128?(n[l]=31744,n[l|256]=64512,s[l]=24,s[l|256]=24):(n[l]=31744,n[l|256]=64512,s[l]=13,s[l|256]=13)}const r=new Uint32Array(2048),a=new Uint32Array(64),o=new Uint32Array(64);for(let l=1;l<1024;++l){let c=l<<13,h=0;for(;(c&8388608)===0;)c<<=1,h-=8388608;c&=-8388609,h+=947912704,r[l]=c|h}for(let l=1024;l<2048;++l)r[l]=939524096+(l-1024<<13);for(let l=1;l<31;++l)a[l]=l<<23;a[31]=1199570944,a[32]=2147483648;for(let l=33;l<63;++l)a[l]=2147483648+(l-32<<23);a[63]=3347054592;for(let l=1;l<64;++l)l!==32&&(o[l]=1024);return{floatView:e,uint32View:t,baseTable:n,shiftTable:s,mantissaTable:r,exponentTable:a,offsetTable:o}}function An(i){Math.abs(i)>65504&&console.warn("THREE.DataUtils.toHalfFloat(): Value out of range."),i=kt(i,-65504,65504),Ii.floatView[0]=i;const e=Ii.uint32View[0],t=e>>23&511;return Ii.baseTable[t]+((e&8388607)>>Ii.shiftTable[t])}function jr(i){const e=i>>10;return Ii.uint32View[0]=Ii.mantissaTable[Ii.offsetTable[e]+(i&1023)]+Ii.exponentTable[e],Ii.floatView[0]}const Vg={toHalfFloat:An,fromHalfFloat:jr},Xt=new w,ro=new $;class Et{constructor(e,t,n=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=_a,this.updateRanges=[],this.gpuType=Cn,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[e+s]=t.array[n+s];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)ro.fromBufferAttribute(this,t),ro.applyMatrix3(e),this.setXY(t,ro.x,ro.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)Xt.fromBufferAttribute(this,t),Xt.applyMatrix3(e),this.setXYZ(t,Xt.x,Xt.y,Xt.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)Xt.fromBufferAttribute(this,t),Xt.applyMatrix4(e),this.setXYZ(t,Xt.x,Xt.y,Xt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Xt.fromBufferAttribute(this,t),Xt.applyNormalMatrix(e),this.setXYZ(t,Xt.x,Xt.y,Xt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Xt.fromBufferAttribute(this,t),Xt.transformDirection(e),this.setXYZ(t,Xt.x,Xt.y,Xt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=vn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=nt(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=vn(t,this.array)),t}setX(e,t){return this.normalized&&(t=nt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=vn(t,this.array)),t}setY(e,t){return this.normalized&&(t=nt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=vn(t,this.array)),t}setZ(e,t){return this.normalized&&(t=nt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=vn(t,this.array)),t}setW(e,t){return this.normalized&&(t=nt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=nt(t,this.array),n=nt(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,s){return e*=this.itemSize,this.normalized&&(t=nt(t,this.array),n=nt(n,this.array),s=nt(s,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this}setXYZW(e,t,n,s,r){return e*=this.itemSize,this.normalized&&(t=nt(t,this.array),n=nt(n,this.array),s=nt(s,this.array),r=nt(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==_a&&(e.usage=this.usage),e}}class Hg extends Et{constructor(e,t,n){super(new Int8Array(e),t,n)}}class Gg extends Et{constructor(e,t,n){super(new Uint8Array(e),t,n)}}class Wg extends Et{constructor(e,t,n){super(new Uint8ClampedArray(e),t,n)}}class Xg extends Et{constructor(e,t,n){super(new Int16Array(e),t,n)}}class Tf extends Et{constructor(e,t,n){super(new Uint16Array(e),t,n)}}class Yg extends Et{constructor(e,t,n){super(new Int32Array(e),t,n)}}class Af extends Et{constructor(e,t,n){super(new Uint32Array(e),t,n)}}class Zg extends Et{constructor(e,t,n){super(new Uint16Array(e),t,n),this.isFloat16BufferAttribute=!0}getX(e){let t=jr(this.array[e*this.itemSize]);return this.normalized&&(t=vn(t,this.array)),t}setX(e,t){return this.normalized&&(t=nt(t,this.array)),this.array[e*this.itemSize]=An(t),this}getY(e){let t=jr(this.array[e*this.itemSize+1]);return this.normalized&&(t=vn(t,this.array)),t}setY(e,t){return this.normalized&&(t=nt(t,this.array)),this.array[e*this.itemSize+1]=An(t),this}getZ(e){let t=jr(this.array[e*this.itemSize+2]);return this.normalized&&(t=vn(t,this.array)),t}setZ(e,t){return this.normalized&&(t=nt(t,this.array)),this.array[e*this.itemSize+2]=An(t),this}getW(e){let t=jr(this.array[e*this.itemSize+3]);return this.normalized&&(t=vn(t,this.array)),t}setW(e,t){return this.normalized&&(t=nt(t,this.array)),this.array[e*this.itemSize+3]=An(t),this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=nt(t,this.array),n=nt(n,this.array)),this.array[e+0]=An(t),this.array[e+1]=An(n),this}setXYZ(e,t,n,s){return e*=this.itemSize,this.normalized&&(t=nt(t,this.array),n=nt(n,this.array),s=nt(s,this.array)),this.array[e+0]=An(t),this.array[e+1]=An(n),this.array[e+2]=An(s),this}setXYZW(e,t,n,s,r){return e*=this.itemSize,this.normalized&&(t=nt(t,this.array),n=nt(n,this.array),s=nt(s,this.array),r=nt(r,this.array)),this.array[e+0]=An(t),this.array[e+1]=An(n),this.array[e+2]=An(s),this.array[e+3]=An(r),this}}class ze extends Et{constructor(e,t,n){super(new Float32Array(e),t,n)}}let qg=0;const kn=new Ye,ih=new dt,tr=new w,On=new jt,Br=new jt,rn=new w;class tt extends vi{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:qg++}),this.uuid=Fn(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(t0(e)?Af:Tf)(e,1):this.index=e,this}setIndirect(e){return this.indirect=e,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new et().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}const s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(e),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return kn.makeRotationFromQuaternion(e),this.applyMatrix4(kn),this}rotateX(e){return kn.makeRotationX(e),this.applyMatrix4(kn),this}rotateY(e){return kn.makeRotationY(e),this.applyMatrix4(kn),this}rotateZ(e){return kn.makeRotationZ(e),this.applyMatrix4(kn),this}translate(e,t,n){return kn.makeTranslation(e,t,n),this.applyMatrix4(kn),this}scale(e,t,n){return kn.makeScale(e,t,n),this.applyMatrix4(kn),this}lookAt(e){return ih.lookAt(e),ih.updateMatrix(),this.applyMatrix4(ih.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(tr).negate(),this.translate(tr.x,tr.y,tr.z),this}setFromPoints(e){const t=this.getAttribute("position");if(t===void 0){const n=[];for(let s=0,r=e.length;s<r;s++){const a=e[s];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new ze(n,3))}else{for(let n=0,s=t.count;n<s;n++){const r=e[n];t.setXYZ(n,r.x,r.y,r.z||0)}e.length>t.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new jt);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new w(-1/0,-1/0,-1/0),new w(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,s=t.length;n<s;n++){const r=t[n];On.setFromBufferAttribute(r),this.morphTargetsRelative?(rn.addVectors(this.boundingBox.min,On.min),this.boundingBox.expandByPoint(rn),rn.addVectors(this.boundingBox.max,On.max),this.boundingBox.expandByPoint(rn)):(this.boundingBox.expandByPoint(On.min),this.boundingBox.expandByPoint(On.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new gn);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new w,1/0);return}if(e){const n=this.boundingSphere.center;if(On.setFromBufferAttribute(e),t)for(let r=0,a=t.length;r<a;r++){const o=t[r];Br.setFromBufferAttribute(o),this.morphTargetsRelative?(rn.addVectors(On.min,Br.min),On.expandByPoint(rn),rn.addVectors(On.max,Br.max),On.expandByPoint(rn)):(On.expandByPoint(Br.min),On.expandByPoint(Br.max))}On.getCenter(n);let s=0;for(let r=0,a=e.count;r<a;r++)rn.fromBufferAttribute(e,r),s=Math.max(s,n.distanceToSquared(rn));if(t)for(let r=0,a=t.length;r<a;r++){const o=t[r],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)rn.fromBufferAttribute(o,c),l&&(tr.fromBufferAttribute(e,c),rn.add(tr)),s=Math.max(s,n.distanceToSquared(rn))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=t.position,s=t.normal,r=t.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Et(new Float32Array(4*n.count),4));const a=this.getAttribute("tangent"),o=[],l=[];for(let P=0;P<n.count;P++)o[P]=new w,l[P]=new w;const c=new w,h=new w,f=new w,p=new $,u=new $,g=new $,y=new w,d=new w;function m(P,S,M){c.fromBufferAttribute(n,P),h.fromBufferAttribute(n,S),f.fromBufferAttribute(n,M),p.fromBufferAttribute(r,P),u.fromBufferAttribute(r,S),g.fromBufferAttribute(r,M),h.sub(c),f.sub(c),u.sub(p),g.sub(p);const D=1/(u.x*g.y-g.x*u.y);isFinite(D)&&(y.copy(h).multiplyScalar(g.y).addScaledVector(f,-u.y).multiplyScalar(D),d.copy(f).multiplyScalar(u.x).addScaledVector(h,-g.x).multiplyScalar(D),o[P].add(y),o[S].add(y),o[M].add(y),l[P].add(d),l[S].add(d),l[M].add(d))}let _=this.groups;_.length===0&&(_=[{start:0,count:e.count}]);for(let P=0,S=_.length;P<S;++P){const M=_[P],D=M.start,U=M.count;for(let B=D,G=D+U;B<G;B+=3)m(e.getX(B+0),e.getX(B+1),e.getX(B+2))}const x=new w,v=new w,E=new w,T=new w;function R(P){E.fromBufferAttribute(s,P),T.copy(E);const S=o[P];x.copy(S),x.sub(E.multiplyScalar(E.dot(S))).normalize(),v.crossVectors(T,S);const D=v.dot(l[P])<0?-1:1;a.setXYZW(P,x.x,x.y,x.z,D)}for(let P=0,S=_.length;P<S;++P){const M=_[P],D=M.start,U=M.count;for(let B=D,G=D+U;B<G;B+=3)R(e.getX(B+0)),R(e.getX(B+1)),R(e.getX(B+2))}}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new Et(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let p=0,u=n.count;p<u;p++)n.setXYZ(p,0,0,0);const s=new w,r=new w,a=new w,o=new w,l=new w,c=new w,h=new w,f=new w;if(e)for(let p=0,u=e.count;p<u;p+=3){const g=e.getX(p+0),y=e.getX(p+1),d=e.getX(p+2);s.fromBufferAttribute(t,g),r.fromBufferAttribute(t,y),a.fromBufferAttribute(t,d),h.subVectors(a,r),f.subVectors(s,r),h.cross(f),o.fromBufferAttribute(n,g),l.fromBufferAttribute(n,y),c.fromBufferAttribute(n,d),o.add(h),l.add(h),c.add(h),n.setXYZ(g,o.x,o.y,o.z),n.setXYZ(y,l.x,l.y,l.z),n.setXYZ(d,c.x,c.y,c.z)}else for(let p=0,u=t.count;p<u;p+=3)s.fromBufferAttribute(t,p+0),r.fromBufferAttribute(t,p+1),a.fromBufferAttribute(t,p+2),h.subVectors(a,r),f.subVectors(s,r),h.cross(f),n.setXYZ(p+0,h.x,h.y,h.z),n.setXYZ(p+1,h.x,h.y,h.z),n.setXYZ(p+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)rn.fromBufferAttribute(e,t),rn.normalize(),e.setXYZ(t,rn.x,rn.y,rn.z)}toNonIndexed(){function e(o,l){const c=o.array,h=o.itemSize,f=o.normalized,p=new c.constructor(l.length*h);let u=0,g=0;for(let y=0,d=l.length;y<d;y++){o.isInterleavedBufferAttribute?u=l[y]*o.data.stride+o.offset:u=l[y]*h;for(let m=0;m<h;m++)p[g++]=c[u++]}return new Et(p,h,f)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new tt,n=this.index.array,s=this.attributes;for(const o in s){const l=s[o],c=e(l,n);t.setAttribute(o,c)}const r=this.morphAttributes;for(const o in r){const l=[],c=r[o];for(let h=0,f=c.length;h<f;h++){const p=c[h],u=e(p,n);l.push(u)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){const e={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const n=this.attributes;for(const l in n){const c=n[l];e.data.attributes[l]=c.toJSON(e.data)}const s={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],h=[];for(let f=0,p=c.length;f<p;f++){const u=c[f];h.push(u.toJSON(e.data))}h.length>0&&(s[l]=h,r=!0)}r&&(e.data.morphAttributes=s,e.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(e.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const n=e.index;n!==null&&this.setIndex(n.clone(t));const s=e.attributes;for(const c in s){const h=s[c];this.setAttribute(c,h.clone(t))}const r=e.morphAttributes;for(const c in r){const h=[],f=r[c];for(let p=0,u=f.length;p<u;p++)h.push(f[p].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;const a=e.groups;for(let c=0,h=a.length;c<h;c++){const f=a[c];this.addGroup(f.start,f.count,f.materialIndex)}const o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const Nu=new Ye,os=new Vs,ao=new gn,Ou=new w,oo=new w,lo=new w,co=new w,sh=new w,ho=new w,Fu=new w,fo=new w;class lt extends dt{constructor(e=new tt,t=new De){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(e,t){const n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(s,e);const o=this.morphTargetInfluences;if(r&&o){ho.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const h=o[l],f=r[l];h!==0&&(sh.fromBufferAttribute(f,e),a?ho.addScaledVector(sh,h):ho.addScaledVector(sh.sub(t),h))}t.add(ho)}return t}raycast(e,t){const n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),ao.copy(n.boundingSphere),ao.applyMatrix4(r),os.copy(e.ray).recast(e.near),!(ao.containsPoint(os.origin)===!1&&(os.intersectSphere(ao,Ou)===null||os.origin.distanceToSquared(Ou)>(e.far-e.near)**2))&&(Nu.copy(r).invert(),os.copy(e.ray).applyMatrix4(Nu),!(n.boundingBox!==null&&os.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,os)))}_computeIntersections(e,t,n){let s;const r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,f=r.attributes.normal,p=r.groups,u=r.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,y=p.length;g<y;g++){const d=p[g],m=a[d.materialIndex],_=Math.max(d.start,u.start),x=Math.min(o.count,Math.min(d.start+d.count,u.start+u.count));for(let v=_,E=x;v<E;v+=3){const T=o.getX(v),R=o.getX(v+1),P=o.getX(v+2);s=uo(this,m,e,n,c,h,f,T,R,P),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=d.materialIndex,t.push(s))}}else{const g=Math.max(0,u.start),y=Math.min(o.count,u.start+u.count);for(let d=g,m=y;d<m;d+=3){const _=o.getX(d),x=o.getX(d+1),v=o.getX(d+2);s=uo(this,a,e,n,c,h,f,_,x,v),s&&(s.faceIndex=Math.floor(d/3),t.push(s))}}else if(l!==void 0)if(Array.isArray(a))for(let g=0,y=p.length;g<y;g++){const d=p[g],m=a[d.materialIndex],_=Math.max(d.start,u.start),x=Math.min(l.count,Math.min(d.start+d.count,u.start+u.count));for(let v=_,E=x;v<E;v+=3){const T=v,R=v+1,P=v+2;s=uo(this,m,e,n,c,h,f,T,R,P),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=d.materialIndex,t.push(s))}}else{const g=Math.max(0,u.start),y=Math.min(l.count,u.start+u.count);for(let d=g,m=y;d<m;d+=3){const _=d,x=d+1,v=d+2;s=uo(this,a,e,n,c,h,f,_,x,v),s&&(s.faceIndex=Math.floor(d/3),t.push(s))}}}}function $g(i,e,t,n,s,r,a,o){let l;if(e.side===on?l=n.intersectTriangle(a,r,s,!0,o):l=n.intersectTriangle(s,r,a,e.side===Pn,o),l===null)return null;fo.copy(o),fo.applyMatrix4(i.matrixWorld);const c=t.ray.origin.distanceTo(fo);return c<t.near||c>t.far?null:{distance:c,point:fo.clone(),object:i}}function uo(i,e,t,n,s,r,a,o,l,c){i.getVertexPosition(o,oo),i.getVertexPosition(l,lo),i.getVertexPosition(c,co);const h=$g(i,e,t,n,oo,lo,co,Fu);if(h){const f=new w;En.getBarycoord(Fu,oo,lo,co,f),s&&(h.uv=En.getInterpolatedAttribute(s,o,l,c,f,new $)),r&&(h.uv1=En.getInterpolatedAttribute(r,o,l,c,f,new $)),a&&(h.normal=En.getInterpolatedAttribute(a,o,l,c,f,new w),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));const p={a:o,b:l,c,normal:new w,materialIndex:0};En.getNormal(oo,lo,co,p.normal),h.face=p,h.barycoord=f}return h}class Dn extends tt{constructor(e=1,t=1,n=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:s,heightSegments:r,depthSegments:a};const o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);const l=[],c=[],h=[],f=[];let p=0,u=0;g("z","y","x",-1,-1,n,t,e,a,r,0),g("z","y","x",1,-1,n,t,-e,a,r,1),g("x","z","y",1,1,e,n,t,s,a,2),g("x","z","y",1,-1,e,n,-t,s,a,3),g("x","y","z",1,-1,e,t,n,s,r,4),g("x","y","z",-1,-1,e,t,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new ze(c,3)),this.setAttribute("normal",new ze(h,3)),this.setAttribute("uv",new ze(f,2));function g(y,d,m,_,x,v,E,T,R,P,S){const M=v/R,D=E/P,U=v/2,B=E/2,G=T/2,Y=R+1,W=P+1;let te=0,X=0;const de=new w;for(let ve=0;ve<W;ve++){const ge=ve*D-B;for(let Xe=0;Xe<Y;Xe++){const ie=Xe*M-U;de[y]=ie*_,de[d]=ge*x,de[m]=G,c.push(de.x,de.y,de.z),de[y]=0,de[d]=0,de[m]=T>0?1:-1,h.push(de.x,de.y,de.z),f.push(Xe/R),f.push(1-ve/P),te+=1}}for(let ve=0;ve<P;ve++)for(let ge=0;ge<R;ge++){const Xe=p+ge+Y*ve,ie=p+ge+Y*(ve+1),V=p+(ge+1)+Y*(ve+1),J=p+(ge+1)+Y*ve;l.push(Xe,ie,J),l.push(ie,V,J),X+=6}o.addGroup(u,X,S),u+=X,p+=te}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Dn(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}function xr(i){const e={};for(const t in i){e[t]={};for(const n in i[t]){const s=i[t][n];s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)?s.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=s.clone():Array.isArray(s)?e[t][n]=s.slice():e[t][n]=s}}return e}function xn(i){const e={};for(let t=0;t<i.length;t++){const n=xr(i[t]);for(const s in n)e[s]=n[s]}return e}function Kg(i){const e=[];for(let t=0;t<i.length;t++)e.push(i[t].clone());return e}function a0(i){const e=i.getRenderTarget();return e===null?i.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:ct.workingColorSpace}const vr={clone:xr,merge:xn};var Jg=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,jg=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class At extends yn{static get type(){return"ShaderMaterial"}constructor(e){super(),this.isShaderMaterial=!0,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Jg,this.fragmentShader=jg,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=xr(e.uniforms),this.uniformsGroups=Kg(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const s in this.uniforms){const a=this.uniforms[s].value;a&&a.isTexture?t.uniforms[s]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[s]={type:"m4",value:a.toArray()}:t.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const n={};for(const s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}}class rc extends dt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Ye,this.projectionMatrix=new Ye,this.projectionMatrixInverse=new Ye,this.coordinateSystem=ui}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const Yi=new w,Bu=new $,ku=new $;class Jt extends rc{constructor(e=50,t=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=_r*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(Rs*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return _r*2*Math.atan(Math.tan(Rs*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){Yi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Yi.x,Yi.y).multiplyScalar(-e/Yi.z),Yi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Yi.x,Yi.y).multiplyScalar(-e/Yi.z)}getViewSize(e,t){return this.getViewBounds(e,Bu,ku),t.subVectors(ku,Bu)}setViewOffset(e,t,n,s,r,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(Rs*.5*this.fov)/this.zoom,n=2*t,s=this.aspect*n,r=-.5*s;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*s/l,t-=a.offsetY*n/c,s*=a.width/l,n*=a.height/c}const o=this.filmOffset;o!==0&&(r+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,t,t-n,e,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}const nr=-90,ir=1;class o0 extends dt{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const s=new Jt(nr,ir,e,t);s.layers=this.layers,this.add(s);const r=new Jt(nr,ir,e,t);r.layers=this.layers,this.add(r);const a=new Jt(nr,ir,e,t);a.layers=this.layers,this.add(a);const o=new Jt(nr,ir,e,t);o.layers=this.layers,this.add(o);const l=new Jt(nr,ir,e,t);l.layers=this.layers,this.add(l);const c=new Jt(nr,ir,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[n,s,r,a,o,l]=t;for(const c of t)this.remove(c);if(e===ui)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===xa)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[r,a,o,l,c,h]=this.children,f=e.getRenderTarget(),p=e.getActiveCubeFace(),u=e.getActiveMipmapLevel(),g=e.xr.enabled;e.xr.enabled=!1;const y=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,e.setRenderTarget(n,0,s),e.render(t,r),e.setRenderTarget(n,1,s),e.render(t,a),e.setRenderTarget(n,2,s),e.render(t,o),e.setRenderTarget(n,3,s),e.render(t,l),e.setRenderTarget(n,4,s),e.render(t,c),n.texture.generateMipmaps=y,e.setRenderTarget(n,5,s),e.render(t,h),e.setRenderTarget(f,p,u),e.xr.enabled=g,n.texture.needsPMREMUpdate=!0}}class Ua extends Ht{constructor(e,t,n,s,r,a,o,l,c,h){e=e!==void 0?e:[],t=t!==void 0?t:Ui,super(e,t,n,s,r,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class l0 extends ln{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const n={width:e,height:e,depth:1},s=[n,n,n,n,n,n];this.texture=new Ua(s,t.mapping,t.wrapS,t.wrapT,t.magFilter,t.minFilter,t.format,t.type,t.anisotropy,t.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=t.generateMipmaps!==void 0?t.generateMipmaps:!1,this.texture.minFilter=t.minFilter!==void 0?t.minFilter:Vt}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new Dn(5,5,5),r=new At({name:"CubemapFromEquirect",uniforms:xr(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:on,blending:pi});r.uniforms.tEquirect.value=t;const a=new lt(s,r),o=t.minFilter;return t.minFilter===ni&&(t.minFilter=Vt),new o0(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t,n,s){const r=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,n,s);e.setRenderTarget(r)}}const rh=new w,Qg=new w,ey=new et;class fi{constructor(e=new w(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,s){return this.normal.set(e,t,n),this.constant=s,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){const s=rh.subVectors(n,t).cross(Qg.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(s,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){const n=e.delta(rh),s=this.normal.dot(n);if(s===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const r=-(e.start.dot(this.normal)+this.constant)/s;return r<0||r>1?null:t.copy(e.start).addScaledVector(n,r)}intersectsLine(e){const t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const n=t||ey.getNormalMatrix(e),s=this.coplanarPoint(rh).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const ls=new gn,po=new w;class Na{constructor(e=new fi,t=new fi,n=new fi,s=new fi,r=new fi,a=new fi){this.planes=[e,t,n,s,r,a]}set(e,t,n,s,r,a){const o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(e){const t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=ui){const n=this.planes,s=e.elements,r=s[0],a=s[1],o=s[2],l=s[3],c=s[4],h=s[5],f=s[6],p=s[7],u=s[8],g=s[9],y=s[10],d=s[11],m=s[12],_=s[13],x=s[14],v=s[15];if(n[0].setComponents(l-r,p-c,d-u,v-m).normalize(),n[1].setComponents(l+r,p+c,d+u,v+m).normalize(),n[2].setComponents(l+a,p+h,d+g,v+_).normalize(),n[3].setComponents(l-a,p-h,d-g,v-_).normalize(),n[4].setComponents(l-o,p-f,d-y,v-x).normalize(),t===ui)n[5].setComponents(l+o,p+f,d+y,v+x).normalize();else if(t===xa)n[5].setComponents(o,f,y,x).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),ls.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),ls.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(ls)}intersectsSprite(e){return ls.center.set(0,0,0),ls.radius=.7071067811865476,ls.applyMatrix4(e.matrixWorld),this.intersectsSphere(ls)}intersectsSphere(e){const t=this.planes,n=e.center,s=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(e){const t=this.planes;for(let n=0;n<6;n++){const s=t[n];if(po.x=s.normal.x>0?e.max.x:e.min.x,po.y=s.normal.y>0?e.max.y:e.min.y,po.z=s.normal.z>0?e.max.z:e.min.z,s.distanceToPoint(po)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function c0(){let i=null,e=!1,t=null,n=null;function s(r,a){t(r,a),n=i.requestAnimationFrame(s)}return{start:function(){e!==!0&&t!==null&&(n=i.requestAnimationFrame(s),e=!0)},stop:function(){i.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){i=r}}}function ty(i){const e=new WeakMap;function t(o,l){const c=o.array,h=o.usage,f=c.byteLength,p=i.createBuffer();i.bindBuffer(l,p),i.bufferData(l,c,h),o.onUploadCallback();let u;if(c instanceof Float32Array)u=i.FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?u=i.HALF_FLOAT:u=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)u=i.SHORT;else if(c instanceof Uint32Array)u=i.UNSIGNED_INT;else if(c instanceof Int32Array)u=i.INT;else if(c instanceof Int8Array)u=i.BYTE;else if(c instanceof Uint8Array)u=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)u=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:p,type:u,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:f}}function n(o,l,c){const h=l.array,f=l.updateRanges;if(i.bindBuffer(c,o),f.length===0)i.bufferSubData(c,0,h);else{f.sort((u,g)=>u.start-g.start);let p=0;for(let u=1;u<f.length;u++){const g=f[p],y=f[u];y.start<=g.start+g.count+1?g.count=Math.max(g.count,y.start+y.count-g.start):(++p,f[p]=y)}f.length=p+1;for(let u=0,g=f.length;u<g;u++){const y=f[u];i.bufferSubData(c,y.start*h.BYTES_PER_ELEMENT,h,y.start,y.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);const l=e.get(o);l&&(i.deleteBuffer(l.buffer),e.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const h=e.get(o);(!h||h.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const c=e.get(o);if(c===void 0)e.set(o,t(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:s,remove:r,update:a}}class Ln extends tt{constructor(e=1,t=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:s};const r=e/2,a=t/2,o=Math.floor(n),l=Math.floor(s),c=o+1,h=l+1,f=e/o,p=t/l,u=[],g=[],y=[],d=[];for(let m=0;m<h;m++){const _=m*p-a;for(let x=0;x<c;x++){const v=x*f-r;g.push(v,-_,0),y.push(0,0,1),d.push(x/o),d.push(1-m/l)}}for(let m=0;m<l;m++)for(let _=0;_<o;_++){const x=_+c*m,v=_+c*(m+1),E=_+1+c*(m+1),T=_+1+c*m;u.push(x,v,T),u.push(v,E,T)}this.setIndex(u),this.setAttribute("position",new ze(g,3)),this.setAttribute("normal",new ze(y,3)),this.setAttribute("uv",new ze(d,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Ln(e.width,e.height,e.widthSegments,e.heightSegments)}}var ny=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,iy=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,sy=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,ry=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,ay=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,oy=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,ly=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,cy=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,hy=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,fy=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,uy=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,dy=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,py=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,my=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,gy=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,yy=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,_y=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,xy=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,vy=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,My=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,by=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,Sy=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,wy=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,Ty=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Ay=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Ey=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,Cy=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Ry=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Py=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Iy=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Dy="gl_FragColor = linearToOutputTexel( gl_FragColor );",Ly=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,zy=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,Uy=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,Ny=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Oy=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Fy=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,By=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,ky=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Vy=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Hy=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Gy=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Wy=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Xy=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Yy=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Zy=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,qy=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,$y=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Ky=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Jy=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,jy=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Qy=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,e1=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,t1=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,n1=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,i1=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,s1=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,r1=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,a1=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,o1=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,l1=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,c1=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,h1=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,f1=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,u1=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,d1=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,p1=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,m1=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,g1=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,y1=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,_1=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,x1=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,v1=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,M1=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,b1=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,S1=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,w1=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,T1=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,A1=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,E1=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,C1=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,R1=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,P1=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,I1=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,D1=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,L1=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,z1=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,U1=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,N1=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,O1=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,F1=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,B1=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,k1=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,V1=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,H1=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,G1=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,W1=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,X1=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Y1=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Z1=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,q1=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,$1=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,K1=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
		
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
		
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		
		#else
		
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,J1=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,j1=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Q1=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,e_=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const t_=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,n_=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,i_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,s_=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,r_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,a_=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,o_=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,l_=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,c_=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,h_=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,f_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,u_=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,d_=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,p_=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,m_=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,g_=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,y_=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,__=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,x_=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,v_=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,M_=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,b_=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,S_=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,w_=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,T_=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,A_=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,E_=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,C_=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,R_=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,P_=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,I_=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,D_=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,L_=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,z_=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,rt={alphahash_fragment:ny,alphahash_pars_fragment:iy,alphamap_fragment:sy,alphamap_pars_fragment:ry,alphatest_fragment:ay,alphatest_pars_fragment:oy,aomap_fragment:ly,aomap_pars_fragment:cy,batching_pars_vertex:hy,batching_vertex:fy,begin_vertex:uy,beginnormal_vertex:dy,bsdfs:py,iridescence_fragment:my,bumpmap_pars_fragment:gy,clipping_planes_fragment:yy,clipping_planes_pars_fragment:_y,clipping_planes_pars_vertex:xy,clipping_planes_vertex:vy,color_fragment:My,color_pars_fragment:by,color_pars_vertex:Sy,color_vertex:wy,common:Ty,cube_uv_reflection_fragment:Ay,defaultnormal_vertex:Ey,displacementmap_pars_vertex:Cy,displacementmap_vertex:Ry,emissivemap_fragment:Py,emissivemap_pars_fragment:Iy,colorspace_fragment:Dy,colorspace_pars_fragment:Ly,envmap_fragment:zy,envmap_common_pars_fragment:Uy,envmap_pars_fragment:Ny,envmap_pars_vertex:Oy,envmap_physical_pars_fragment:qy,envmap_vertex:Fy,fog_vertex:By,fog_pars_vertex:ky,fog_fragment:Vy,fog_pars_fragment:Hy,gradientmap_pars_fragment:Gy,lightmap_pars_fragment:Wy,lights_lambert_fragment:Xy,lights_lambert_pars_fragment:Yy,lights_pars_begin:Zy,lights_toon_fragment:$y,lights_toon_pars_fragment:Ky,lights_phong_fragment:Jy,lights_phong_pars_fragment:jy,lights_physical_fragment:Qy,lights_physical_pars_fragment:e1,lights_fragment_begin:t1,lights_fragment_maps:n1,lights_fragment_end:i1,logdepthbuf_fragment:s1,logdepthbuf_pars_fragment:r1,logdepthbuf_pars_vertex:a1,logdepthbuf_vertex:o1,map_fragment:l1,map_pars_fragment:c1,map_particle_fragment:h1,map_particle_pars_fragment:f1,metalnessmap_fragment:u1,metalnessmap_pars_fragment:d1,morphinstance_vertex:p1,morphcolor_vertex:m1,morphnormal_vertex:g1,morphtarget_pars_vertex:y1,morphtarget_vertex:_1,normal_fragment_begin:x1,normal_fragment_maps:v1,normal_pars_fragment:M1,normal_pars_vertex:b1,normal_vertex:S1,normalmap_pars_fragment:w1,clearcoat_normal_fragment_begin:T1,clearcoat_normal_fragment_maps:A1,clearcoat_pars_fragment:E1,iridescence_pars_fragment:C1,opaque_fragment:R1,packing:P1,premultiplied_alpha_fragment:I1,project_vertex:D1,dithering_fragment:L1,dithering_pars_fragment:z1,roughnessmap_fragment:U1,roughnessmap_pars_fragment:N1,shadowmap_pars_fragment:O1,shadowmap_pars_vertex:F1,shadowmap_vertex:B1,shadowmask_pars_fragment:k1,skinbase_vertex:V1,skinning_pars_vertex:H1,skinning_vertex:G1,skinnormal_vertex:W1,specularmap_fragment:X1,specularmap_pars_fragment:Y1,tonemapping_fragment:Z1,tonemapping_pars_fragment:q1,transmission_fragment:$1,transmission_pars_fragment:K1,uv_pars_fragment:J1,uv_pars_vertex:j1,uv_vertex:Q1,worldpos_vertex:e_,background_vert:t_,background_frag:n_,backgroundCube_vert:i_,backgroundCube_frag:s_,cube_vert:r_,cube_frag:a_,depth_vert:o_,depth_frag:l_,distanceRGBA_vert:c_,distanceRGBA_frag:h_,equirect_vert:f_,equirect_frag:u_,linedashed_vert:d_,linedashed_frag:p_,meshbasic_vert:m_,meshbasic_frag:g_,meshlambert_vert:y_,meshlambert_frag:__,meshmatcap_vert:x_,meshmatcap_frag:v_,meshnormal_vert:M_,meshnormal_frag:b_,meshphong_vert:S_,meshphong_frag:w_,meshphysical_vert:T_,meshphysical_frag:A_,meshtoon_vert:E_,meshtoon_frag:C_,points_vert:R_,points_frag:P_,shadow_vert:I_,shadow_frag:D_,sprite_vert:L_,sprite_frag:z_},Se={common:{diffuse:{value:new re(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new et},alphaMap:{value:null},alphaMapTransform:{value:new et},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new et}},envmap:{envMap:{value:null},envMapRotation:{value:new et},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new et}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new et}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new et},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new et},normalScale:{value:new $(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new et},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new et}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new et}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new et}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new re(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new re(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new et},alphaTest:{value:0},uvTransform:{value:new et}},sprite:{diffuse:{value:new re(16777215)},opacity:{value:1},center:{value:new $(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new et},alphaMap:{value:null},alphaMapTransform:{value:new et},alphaTest:{value:0}}},ti={basic:{uniforms:xn([Se.common,Se.specularmap,Se.envmap,Se.aomap,Se.lightmap,Se.fog]),vertexShader:rt.meshbasic_vert,fragmentShader:rt.meshbasic_frag},lambert:{uniforms:xn([Se.common,Se.specularmap,Se.envmap,Se.aomap,Se.lightmap,Se.emissivemap,Se.bumpmap,Se.normalmap,Se.displacementmap,Se.fog,Se.lights,{emissive:{value:new re(0)}}]),vertexShader:rt.meshlambert_vert,fragmentShader:rt.meshlambert_frag},phong:{uniforms:xn([Se.common,Se.specularmap,Se.envmap,Se.aomap,Se.lightmap,Se.emissivemap,Se.bumpmap,Se.normalmap,Se.displacementmap,Se.fog,Se.lights,{emissive:{value:new re(0)},specular:{value:new re(1118481)},shininess:{value:30}}]),vertexShader:rt.meshphong_vert,fragmentShader:rt.meshphong_frag},standard:{uniforms:xn([Se.common,Se.envmap,Se.aomap,Se.lightmap,Se.emissivemap,Se.bumpmap,Se.normalmap,Se.displacementmap,Se.roughnessmap,Se.metalnessmap,Se.fog,Se.lights,{emissive:{value:new re(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:rt.meshphysical_vert,fragmentShader:rt.meshphysical_frag},toon:{uniforms:xn([Se.common,Se.aomap,Se.lightmap,Se.emissivemap,Se.bumpmap,Se.normalmap,Se.displacementmap,Se.gradientmap,Se.fog,Se.lights,{emissive:{value:new re(0)}}]),vertexShader:rt.meshtoon_vert,fragmentShader:rt.meshtoon_frag},matcap:{uniforms:xn([Se.common,Se.bumpmap,Se.normalmap,Se.displacementmap,Se.fog,{matcap:{value:null}}]),vertexShader:rt.meshmatcap_vert,fragmentShader:rt.meshmatcap_frag},points:{uniforms:xn([Se.points,Se.fog]),vertexShader:rt.points_vert,fragmentShader:rt.points_frag},dashed:{uniforms:xn([Se.common,Se.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:rt.linedashed_vert,fragmentShader:rt.linedashed_frag},depth:{uniforms:xn([Se.common,Se.displacementmap]),vertexShader:rt.depth_vert,fragmentShader:rt.depth_frag},normal:{uniforms:xn([Se.common,Se.bumpmap,Se.normalmap,Se.displacementmap,{opacity:{value:1}}]),vertexShader:rt.meshnormal_vert,fragmentShader:rt.meshnormal_frag},sprite:{uniforms:xn([Se.sprite,Se.fog]),vertexShader:rt.sprite_vert,fragmentShader:rt.sprite_frag},background:{uniforms:{uvTransform:{value:new et},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:rt.background_vert,fragmentShader:rt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new et}},vertexShader:rt.backgroundCube_vert,fragmentShader:rt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:rt.cube_vert,fragmentShader:rt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:rt.equirect_vert,fragmentShader:rt.equirect_frag},distanceRGBA:{uniforms:xn([Se.common,Se.displacementmap,{referencePosition:{value:new w},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:rt.distanceRGBA_vert,fragmentShader:rt.distanceRGBA_frag},shadow:{uniforms:xn([Se.lights,Se.fog,{color:{value:new re(0)},opacity:{value:1}}]),vertexShader:rt.shadow_vert,fragmentShader:rt.shadow_frag}};ti.physical={uniforms:xn([ti.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new et},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new et},clearcoatNormalScale:{value:new $(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new et},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new et},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new et},sheen:{value:0},sheenColor:{value:new re(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new et},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new et},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new et},transmissionSamplerSize:{value:new $},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new et},attenuationDistance:{value:0},attenuationColor:{value:new re(0)},specularColor:{value:new re(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new et},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new et},anisotropyVector:{value:new $},anisotropyMap:{value:null},anisotropyMapTransform:{value:new et}}]),vertexShader:rt.meshphysical_vert,fragmentShader:rt.meshphysical_frag};const mo={r:0,b:0,g:0},cs=new Mn,U_=new Ye;function N_(i,e,t,n,s,r,a){const o=new re(0);let l=r===!0?0:1,c,h,f=null,p=0,u=null;function g(_){let x=_.isScene===!0?_.background:null;return x&&x.isTexture&&(x=(_.backgroundBlurriness>0?t:e).get(x)),x}function y(_){let x=!1;const v=g(_);v===null?m(o,l):v&&v.isColor&&(m(v,1),x=!0);const E=i.xr.getEnvironmentBlendMode();E==="additive"?n.buffers.color.setClear(0,0,0,1,a):E==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(i.autoClear||x)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function d(_,x){const v=g(x);v&&(v.isCubeTexture||v.mapping===wr)?(h===void 0&&(h=new lt(new Dn(1,1,1),new At({name:"BackgroundCubeMaterial",uniforms:xr(ti.backgroundCube.uniforms),vertexShader:ti.backgroundCube.vertexShader,fragmentShader:ti.backgroundCube.fragmentShader,side:on,depthTest:!1,depthWrite:!1,fog:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(E,T,R){this.matrixWorld.copyPosition(R.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),s.update(h)),cs.copy(x.backgroundRotation),cs.x*=-1,cs.y*=-1,cs.z*=-1,v.isCubeTexture&&v.isRenderTargetTexture===!1&&(cs.y*=-1,cs.z*=-1),h.material.uniforms.envMap.value=v,h.material.uniforms.flipEnvMap.value=v.isCubeTexture&&v.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=x.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=x.backgroundIntensity,h.material.uniforms.backgroundRotation.value.setFromMatrix4(U_.makeRotationFromEuler(cs)),h.material.toneMapped=ct.getTransfer(v.colorSpace)!==Mt,(f!==v||p!==v.version||u!==i.toneMapping)&&(h.material.needsUpdate=!0,f=v,p=v.version,u=i.toneMapping),h.layers.enableAll(),_.unshift(h,h.geometry,h.material,0,0,null)):v&&v.isTexture&&(c===void 0&&(c=new lt(new Ln(2,2),new At({name:"BackgroundMaterial",uniforms:xr(ti.background.uniforms),vertexShader:ti.background.vertexShader,fragmentShader:ti.background.fragmentShader,side:Pn,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),s.update(c)),c.material.uniforms.t2D.value=v,c.material.uniforms.backgroundIntensity.value=x.backgroundIntensity,c.material.toneMapped=ct.getTransfer(v.colorSpace)!==Mt,v.matrixAutoUpdate===!0&&v.updateMatrix(),c.material.uniforms.uvTransform.value.copy(v.matrix),(f!==v||p!==v.version||u!==i.toneMapping)&&(c.material.needsUpdate=!0,f=v,p=v.version,u=i.toneMapping),c.layers.enableAll(),_.unshift(c,c.geometry,c.material,0,0,null))}function m(_,x){_.getRGB(mo,a0(i)),n.buffers.color.setClear(mo.r,mo.g,mo.b,x,a)}return{getClearColor:function(){return o},setClearColor:function(_,x=1){o.set(_),l=x,m(o,l)},getClearAlpha:function(){return l},setClearAlpha:function(_){l=_,m(o,l)},render:y,addToRenderList:d}}function O_(i,e){const t=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=p(null);let r=s,a=!1;function o(M,D,U,B,G){let Y=!1;const W=f(B,U,D);r!==W&&(r=W,c(r.object)),Y=u(M,B,U,G),Y&&g(M,B,U,G),G!==null&&e.update(G,i.ELEMENT_ARRAY_BUFFER),(Y||a)&&(a=!1,v(M,D,U,B),G!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,e.get(G).buffer))}function l(){return i.createVertexArray()}function c(M){return i.bindVertexArray(M)}function h(M){return i.deleteVertexArray(M)}function f(M,D,U){const B=U.wireframe===!0;let G=n[M.id];G===void 0&&(G={},n[M.id]=G);let Y=G[D.id];Y===void 0&&(Y={},G[D.id]=Y);let W=Y[B];return W===void 0&&(W=p(l()),Y[B]=W),W}function p(M){const D=[],U=[],B=[];for(let G=0;G<t;G++)D[G]=0,U[G]=0,B[G]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:D,enabledAttributes:U,attributeDivisors:B,object:M,attributes:{},index:null}}function u(M,D,U,B){const G=r.attributes,Y=D.attributes;let W=0;const te=U.getAttributes();for(const X in te)if(te[X].location>=0){const ve=G[X];let ge=Y[X];if(ge===void 0&&(X==="instanceMatrix"&&M.instanceMatrix&&(ge=M.instanceMatrix),X==="instanceColor"&&M.instanceColor&&(ge=M.instanceColor)),ve===void 0||ve.attribute!==ge||ge&&ve.data!==ge.data)return!0;W++}return r.attributesNum!==W||r.index!==B}function g(M,D,U,B){const G={},Y=D.attributes;let W=0;const te=U.getAttributes();for(const X in te)if(te[X].location>=0){let ve=Y[X];ve===void 0&&(X==="instanceMatrix"&&M.instanceMatrix&&(ve=M.instanceMatrix),X==="instanceColor"&&M.instanceColor&&(ve=M.instanceColor));const ge={};ge.attribute=ve,ve&&ve.data&&(ge.data=ve.data),G[X]=ge,W++}r.attributes=G,r.attributesNum=W,r.index=B}function y(){const M=r.newAttributes;for(let D=0,U=M.length;D<U;D++)M[D]=0}function d(M){m(M,0)}function m(M,D){const U=r.newAttributes,B=r.enabledAttributes,G=r.attributeDivisors;U[M]=1,B[M]===0&&(i.enableVertexAttribArray(M),B[M]=1),G[M]!==D&&(i.vertexAttribDivisor(M,D),G[M]=D)}function _(){const M=r.newAttributes,D=r.enabledAttributes;for(let U=0,B=D.length;U<B;U++)D[U]!==M[U]&&(i.disableVertexAttribArray(U),D[U]=0)}function x(M,D,U,B,G,Y,W){W===!0?i.vertexAttribIPointer(M,D,U,G,Y):i.vertexAttribPointer(M,D,U,B,G,Y)}function v(M,D,U,B){y();const G=B.attributes,Y=U.getAttributes(),W=D.defaultAttributeValues;for(const te in Y){const X=Y[te];if(X.location>=0){let de=G[te];if(de===void 0&&(te==="instanceMatrix"&&M.instanceMatrix&&(de=M.instanceMatrix),te==="instanceColor"&&M.instanceColor&&(de=M.instanceColor)),de!==void 0){const ve=de.normalized,ge=de.itemSize,Xe=e.get(de);if(Xe===void 0)continue;const ie=Xe.buffer,V=Xe.type,J=Xe.bytesPerElement,le=V===i.INT||V===i.UNSIGNED_INT||de.gpuType===Kl;if(de.isInterleavedBufferAttribute){const oe=de.data,Le=oe.stride,Oe=de.offset;if(oe.isInstancedInterleavedBuffer){for(let Ge=0;Ge<X.locationSize;Ge++)m(X.location+Ge,oe.meshPerAttribute);M.isInstancedMesh!==!0&&B._maxInstanceCount===void 0&&(B._maxInstanceCount=oe.meshPerAttribute*oe.count)}else for(let Ge=0;Ge<X.locationSize;Ge++)d(X.location+Ge);i.bindBuffer(i.ARRAY_BUFFER,ie);for(let Ge=0;Ge<X.locationSize;Ge++)x(X.location+Ge,ge/X.locationSize,V,ve,Le*J,(Oe+ge/X.locationSize*Ge)*J,le)}else{if(de.isInstancedBufferAttribute){for(let oe=0;oe<X.locationSize;oe++)m(X.location+oe,de.meshPerAttribute);M.isInstancedMesh!==!0&&B._maxInstanceCount===void 0&&(B._maxInstanceCount=de.meshPerAttribute*de.count)}else for(let oe=0;oe<X.locationSize;oe++)d(X.location+oe);i.bindBuffer(i.ARRAY_BUFFER,ie);for(let oe=0;oe<X.locationSize;oe++)x(X.location+oe,ge/X.locationSize,V,ve,ge*J,ge/X.locationSize*oe*J,le)}}else if(W!==void 0){const ve=W[te];if(ve!==void 0)switch(ve.length){case 2:i.vertexAttrib2fv(X.location,ve);break;case 3:i.vertexAttrib3fv(X.location,ve);break;case 4:i.vertexAttrib4fv(X.location,ve);break;default:i.vertexAttrib1fv(X.location,ve)}}}}_()}function E(){P();for(const M in n){const D=n[M];for(const U in D){const B=D[U];for(const G in B)h(B[G].object),delete B[G];delete D[U]}delete n[M]}}function T(M){if(n[M.id]===void 0)return;const D=n[M.id];for(const U in D){const B=D[U];for(const G in B)h(B[G].object),delete B[G];delete D[U]}delete n[M.id]}function R(M){for(const D in n){const U=n[D];if(U[M.id]===void 0)continue;const B=U[M.id];for(const G in B)h(B[G].object),delete B[G];delete U[M.id]}}function P(){S(),a=!0,r!==s&&(r=s,c(r.object))}function S(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:P,resetDefaultState:S,dispose:E,releaseStatesOfGeometry:T,releaseStatesOfProgram:R,initAttributes:y,enableAttribute:d,disableUnusedAttributes:_}}function F_(i,e,t){let n;function s(c){n=c}function r(c,h){i.drawArrays(n,c,h),t.update(h,n,1)}function a(c,h,f){f!==0&&(i.drawArraysInstanced(n,c,h,f),t.update(h,n,f))}function o(c,h,f){if(f===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,c,0,h,0,f);let u=0;for(let g=0;g<f;g++)u+=h[g];t.update(u,n,1)}function l(c,h,f,p){if(f===0)return;const u=e.get("WEBGL_multi_draw");if(u===null)for(let g=0;g<c.length;g++)a(c[g],h[g],p[g]);else{u.multiDrawArraysInstancedWEBGL(n,c,0,h,0,p,0,f);let g=0;for(let y=0;y<f;y++)g+=h[y]*p[y];t.update(g,n,1)}}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o,this.renderMultiDrawInstances=l}function B_(i,e,t,n){let s;function r(){if(s!==void 0)return s;if(e.has("EXT_texture_filter_anisotropic")===!0){const R=e.get("EXT_texture_filter_anisotropic");s=i.getParameter(R.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(R){return!(R!==mn&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(R){const P=R===Yn&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(R!==_i&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&R!==Cn&&!P)}function l(R){if(R==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";R="mediump"}return R==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp";const h=l(c);h!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);const f=t.logarithmicDepthBuffer===!0,p=t.reverseDepthBuffer===!0&&e.has("EXT_clip_control"),u=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),g=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),y=i.getParameter(i.MAX_TEXTURE_SIZE),d=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),m=i.getParameter(i.MAX_VERTEX_ATTRIBS),_=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),x=i.getParameter(i.MAX_VARYING_VECTORS),v=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),E=g>0,T=i.getParameter(i.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:f,reverseDepthBuffer:p,maxTextures:u,maxVertexTextures:g,maxTextureSize:y,maxCubemapSize:d,maxAttributes:m,maxVertexUniforms:_,maxVaryings:x,maxFragmentUniforms:v,vertexTextures:E,maxSamples:T}}function k_(i){const e=this;let t=null,n=0,s=!1,r=!1;const a=new fi,o=new et,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(f,p){const u=f.length!==0||p||n!==0||s;return s=p,n=f.length,u},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(f,p){t=h(f,p,0)},this.setState=function(f,p,u){const g=f.clippingPlanes,y=f.clipIntersection,d=f.clipShadows,m=i.get(f);if(!s||g===null||g.length===0||r&&!d)r?h(null):c();else{const _=r?0:n,x=_*4;let v=m.clippingState||null;l.value=v,v=h(g,p,x,u);for(let E=0;E!==x;++E)v[E]=t[E];m.clippingState=v,this.numIntersection=y?this.numPlanes:0,this.numPlanes+=_}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function h(f,p,u,g){const y=f!==null?f.length:0;let d=null;if(y!==0){if(d=l.value,g!==!0||d===null){const m=u+y*4,_=p.matrixWorldInverse;o.getNormalMatrix(_),(d===null||d.length<m)&&(d=new Float32Array(m));for(let x=0,v=u;x!==y;++x,v+=4)a.copy(f[x]).applyMatrix4(_,o),a.normal.toArray(d,v),d[v+3]=a.constant}l.value=d,l.needsUpdate=!0}return e.numPlanes=y,e.numIntersection=0,d}}function V_(i){let e=new WeakMap;function t(a,o){return o===da?a.mapping=Ui:o===pa&&(a.mapping=Ji),a}function n(a){if(a&&a.isTexture){const o=a.mapping;if(o===da||o===pa)if(e.has(a)){const l=e.get(a).texture;return t(l,a.mapping)}else{const l=a.image;if(l&&l.height>0){const c=new l0(l.height);return c.fromEquirectangularTexture(i,a),e.set(a,c),a.addEventListener("dispose",s),t(c.texture,a.mapping)}else return null}}return a}function s(a){const o=a.target;o.removeEventListener("dispose",s);const l=e.get(o);l!==void 0&&(e.delete(o),l.dispose())}function r(){e=new WeakMap}return{get:n,dispose:r}}class Oa extends rc{constructor(e=-1,t=1,n=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2;let r=n-e,a=n+e,o=s+t,l=s-t;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}const ur=4,Vu=[.125,.215,.35,.446,.526,.582],Ms=20,ah=new Oa,Hu=new re;let oh=null,lh=0,ch=0,hh=!1;const xs=(1+Math.sqrt(5))/2,sr=1/xs,Gu=[new w(-xs,sr,0),new w(xs,sr,0),new w(-sr,0,xs),new w(sr,0,xs),new w(0,xs,-sr),new w(0,xs,sr),new w(-1,1,-1),new w(1,1,-1),new w(-1,1,1),new w(1,1,1)];class qh{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,n=.1,s=100){oh=this._renderer.getRenderTarget(),lh=this._renderer.getActiveCubeFace(),ch=this._renderer.getActiveMipmapLevel(),hh=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);const r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(e,n,s,r),t>0&&this._blur(r,0,0,t),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Yu(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Xu(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(oh,lh,ch),this._renderer.xr.enabled=hh,e.scissorTest=!1,go(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===Ui||e.mapping===Ji?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),oh=this._renderer.getRenderTarget(),lh=this._renderer.getActiveCubeFace(),ch=this._renderer.getActiveMipmapLevel(),hh=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:Vt,minFilter:Vt,generateMipmaps:!1,type:Yn,format:mn,colorSpace:es,depthBuffer:!1},s=Wu(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Wu(e,t,n);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=H_(r)),this._blurMaterial=G_(r,e,t)}return s}_compileMaterial(e){const t=new lt(this._lodPlanes[0],e);this._renderer.compile(t,ah)}_sceneToCubeUV(e,t,n,s){const o=new Jt(90,1,t,n),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],h=this._renderer,f=h.autoClear,p=h.toneMapping;h.getClearColor(Hu),h.toneMapping=mi,h.autoClear=!1;const u=new De({name:"PMREM.Background",side:on,depthWrite:!1,depthTest:!1}),g=new lt(new Dn,u);let y=!1;const d=e.background;d?d.isColor&&(u.color.copy(d),e.background=null,y=!0):(u.color.copy(Hu),y=!0);for(let m=0;m<6;m++){const _=m%3;_===0?(o.up.set(0,l[m],0),o.lookAt(c[m],0,0)):_===1?(o.up.set(0,0,l[m]),o.lookAt(0,c[m],0)):(o.up.set(0,l[m],0),o.lookAt(0,0,c[m]));const x=this._cubeSize;go(s,_*x,m>2?x:0,x,x),h.setRenderTarget(s),y&&h.render(g,o),h.render(e,o)}g.geometry.dispose(),g.material.dispose(),h.toneMapping=p,h.autoClear=f,e.background=d}_textureToCubeUV(e,t){const n=this._renderer,s=e.mapping===Ui||e.mapping===Ji;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=Yu()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Xu());const r=s?this._cubemapMaterial:this._equirectMaterial,a=new lt(this._lodPlanes[0],r),o=r.uniforms;o.envMap.value=e;const l=this._cubeSize;go(t,0,0,3*l,2*l),n.setRenderTarget(t),n.render(a,ah)}_applyPMREM(e){const t=this._renderer,n=t.autoClear;t.autoClear=!1;const s=this._lodPlanes.length;for(let r=1;r<s;r++){const a=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),o=Gu[(s-r-1)%Gu.length];this._blur(e,r-1,r,a,o)}t.autoClear=n}_blur(e,t,n,s,r){const a=this._pingPongRenderTarget;this._halfBlur(e,a,t,n,s,"latitudinal",r),this._halfBlur(a,e,n,n,s,"longitudinal",r)}_halfBlur(e,t,n,s,r,a,o){const l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const h=3,f=new lt(this._lodPlanes[s],c),p=c.uniforms,u=this._sizeLods[n]-1,g=isFinite(r)?Math.PI/(2*u):2*Math.PI/(2*Ms-1),y=r/g,d=isFinite(r)?1+Math.floor(h*y):Ms;d>Ms&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${d} samples when the maximum is set to ${Ms}`);const m=[];let _=0;for(let R=0;R<Ms;++R){const P=R/y,S=Math.exp(-P*P/2);m.push(S),R===0?_+=S:R<d&&(_+=2*S)}for(let R=0;R<m.length;R++)m[R]=m[R]/_;p.envMap.value=e.texture,p.samples.value=d,p.weights.value=m,p.latitudinal.value=a==="latitudinal",o&&(p.poleAxis.value=o);const{_lodMax:x}=this;p.dTheta.value=g,p.mipInt.value=x-n;const v=this._sizeLods[s],E=3*v*(s>x-ur?s-x+ur:0),T=4*(this._cubeSize-v);go(t,E,T,3*v,2*v),l.setRenderTarget(t),l.render(f,ah)}}function H_(i){const e=[],t=[],n=[];let s=i;const r=i-ur+1+Vu.length;for(let a=0;a<r;a++){const o=Math.pow(2,s);t.push(o);let l=1/o;a>i-ur?l=Vu[a-i+ur-1]:a===0&&(l=0),n.push(l);const c=1/(o-2),h=-c,f=1+c,p=[h,h,f,h,f,f,h,h,f,f,h,f],u=6,g=6,y=3,d=2,m=1,_=new Float32Array(y*g*u),x=new Float32Array(d*g*u),v=new Float32Array(m*g*u);for(let T=0;T<u;T++){const R=T%3*2/3-1,P=T>2?0:-1,S=[R,P,0,R+2/3,P,0,R+2/3,P+1,0,R,P,0,R+2/3,P+1,0,R,P+1,0];_.set(S,y*g*T),x.set(p,d*g*T);const M=[T,T,T,T,T,T];v.set(M,m*g*T)}const E=new tt;E.setAttribute("position",new Et(_,y)),E.setAttribute("uv",new Et(x,d)),E.setAttribute("faceIndex",new Et(v,m)),e.push(E),s>ur&&s--}return{lodPlanes:e,sizeLods:t,sigmas:n}}function Wu(i,e,t){const n=new ln(i,e,t);return n.texture.mapping=wr,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function go(i,e,t,n,s){i.viewport.set(e,t,n,s),i.scissor.set(e,t,n,s)}function G_(i,e,t){const n=new Float32Array(Ms),s=new w(0,1,0);return new At({name:"SphericalGaussianBlur",defines:{n:Ms,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:Ef(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:pi,depthTest:!1,depthWrite:!1})}function Xu(){return new At({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Ef(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:pi,depthTest:!1,depthWrite:!1})}function Yu(){return new At({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Ef(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:pi,depthTest:!1,depthWrite:!1})}function Ef(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function W_(i){let e=new WeakMap,t=null;function n(o){if(o&&o.isTexture){const l=o.mapping,c=l===da||l===pa,h=l===Ui||l===Ji;if(c||h){let f=e.get(o);const p=f!==void 0?f.texture.pmremVersion:0;if(o.isRenderTargetTexture&&o.pmremVersion!==p)return t===null&&(t=new qh(i)),f=c?t.fromEquirectangular(o,f):t.fromCubemap(o,f),f.texture.pmremVersion=o.pmremVersion,e.set(o,f),f.texture;if(f!==void 0)return f.texture;{const u=o.image;return c&&u&&u.height>0||h&&u&&s(u)?(t===null&&(t=new qh(i)),f=c?t.fromEquirectangular(o):t.fromCubemap(o),f.texture.pmremVersion=o.pmremVersion,e.set(o,f),o.addEventListener("dispose",r),f.texture):null}}}return o}function s(o){let l=0;const c=6;for(let h=0;h<c;h++)o[h]!==void 0&&l++;return l===c}function r(o){const l=o.target;l.removeEventListener("dispose",r);const c=e.get(l);c!==void 0&&(e.delete(l),c.dispose())}function a(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}return{get:n,dispose:a}}function X_(i){const e={};function t(n){if(e[n]!==void 0)return e[n];let s;switch(n){case"WEBGL_depth_texture":s=i.getExtension("WEBGL_depth_texture")||i.getExtension("MOZ_WEBGL_depth_texture")||i.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":s=i.getExtension("EXT_texture_filter_anisotropic")||i.getExtension("MOZ_EXT_texture_filter_anisotropic")||i.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":s=i.getExtension("WEBGL_compressed_texture_s3tc")||i.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":s=i.getExtension("WEBGL_compressed_texture_pvrtc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:s=i.getExtension(n)}return e[n]=s,s}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){const s=t(n);return s===null&&Jr("THREE.WebGLRenderer: "+n+" extension not supported."),s}}}function Y_(i,e,t,n){const s={},r=new WeakMap;function a(f){const p=f.target;p.index!==null&&e.remove(p.index);for(const g in p.attributes)e.remove(p.attributes[g]);for(const g in p.morphAttributes){const y=p.morphAttributes[g];for(let d=0,m=y.length;d<m;d++)e.remove(y[d])}p.removeEventListener("dispose",a),delete s[p.id];const u=r.get(p);u&&(e.remove(u),r.delete(p)),n.releaseStatesOfGeometry(p),p.isInstancedBufferGeometry===!0&&delete p._maxInstanceCount,t.memory.geometries--}function o(f,p){return s[p.id]===!0||(p.addEventListener("dispose",a),s[p.id]=!0,t.memory.geometries++),p}function l(f){const p=f.attributes;for(const g in p)e.update(p[g],i.ARRAY_BUFFER);const u=f.morphAttributes;for(const g in u){const y=u[g];for(let d=0,m=y.length;d<m;d++)e.update(y[d],i.ARRAY_BUFFER)}}function c(f){const p=[],u=f.index,g=f.attributes.position;let y=0;if(u!==null){const _=u.array;y=u.version;for(let x=0,v=_.length;x<v;x+=3){const E=_[x+0],T=_[x+1],R=_[x+2];p.push(E,T,T,R,R,E)}}else if(g!==void 0){const _=g.array;y=g.version;for(let x=0,v=_.length/3-1;x<v;x+=3){const E=x+0,T=x+1,R=x+2;p.push(E,T,T,R,R,E)}}else return;const d=new(t0(p)?Af:Tf)(p,1);d.version=y;const m=r.get(f);m&&e.remove(m),r.set(f,d)}function h(f){const p=r.get(f);if(p){const u=f.index;u!==null&&p.version<u.version&&c(f)}else c(f);return r.get(f)}return{get:o,update:l,getWireframeAttribute:h}}function Z_(i,e,t){let n;function s(p){n=p}let r,a;function o(p){r=p.type,a=p.bytesPerElement}function l(p,u){i.drawElements(n,u,r,p*a),t.update(u,n,1)}function c(p,u,g){g!==0&&(i.drawElementsInstanced(n,u,r,p*a,g),t.update(u,n,g))}function h(p,u,g){if(g===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,u,0,r,p,0,g);let d=0;for(let m=0;m<g;m++)d+=u[m];t.update(d,n,1)}function f(p,u,g,y){if(g===0)return;const d=e.get("WEBGL_multi_draw");if(d===null)for(let m=0;m<p.length;m++)c(p[m]/a,u[m],y[m]);else{d.multiDrawElementsInstancedWEBGL(n,u,0,r,p,0,y,0,g);let m=0;for(let _=0;_<g;_++)m+=u[_]*y[_];t.update(m,n,1)}}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h,this.renderMultiDrawInstances=f}function q_(i){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(t.calls++,a){case i.TRIANGLES:t.triangles+=o*(r/3);break;case i.LINES:t.lines+=o*(r/2);break;case i.LINE_STRIP:t.lines+=o*(r-1);break;case i.LINE_LOOP:t.lines+=o*r;break;case i.POINTS:t.points+=o*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",a);break}}function s(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:s,update:n}}function $_(i,e,t){const n=new WeakMap,s=new ot;function r(a,o,l){const c=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,f=h!==void 0?h.length:0;let p=n.get(o);if(p===void 0||p.count!==f){let M=function(){P.dispose(),n.delete(o),o.removeEventListener("dispose",M)};var u=M;p!==void 0&&p.texture.dispose();const g=o.morphAttributes.position!==void 0,y=o.morphAttributes.normal!==void 0,d=o.morphAttributes.color!==void 0,m=o.morphAttributes.position||[],_=o.morphAttributes.normal||[],x=o.morphAttributes.color||[];let v=0;g===!0&&(v=1),y===!0&&(v=2),d===!0&&(v=3);let E=o.attributes.position.count*v,T=1;E>e.maxTextureSize&&(T=Math.ceil(E/e.maxTextureSize),E=e.maxTextureSize);const R=new Float32Array(E*T*4*f),P=new ic(R,E,T,f);P.type=Cn,P.needsUpdate=!0;const S=v*4;for(let D=0;D<f;D++){const U=m[D],B=_[D],G=x[D],Y=E*T*4*D;for(let W=0;W<U.count;W++){const te=W*S;g===!0&&(s.fromBufferAttribute(U,W),R[Y+te+0]=s.x,R[Y+te+1]=s.y,R[Y+te+2]=s.z,R[Y+te+3]=0),y===!0&&(s.fromBufferAttribute(B,W),R[Y+te+4]=s.x,R[Y+te+5]=s.y,R[Y+te+6]=s.z,R[Y+te+7]=0),d===!0&&(s.fromBufferAttribute(G,W),R[Y+te+8]=s.x,R[Y+te+9]=s.y,R[Y+te+10]=s.z,R[Y+te+11]=G.itemSize===4?s.w:1)}}p={count:f,texture:P,size:new $(E,T)},n.set(o,p),o.addEventListener("dispose",M)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",a.morphTexture,t);else{let g=0;for(let d=0;d<c.length;d++)g+=c[d];const y=o.morphTargetsRelative?1:1-g;l.getUniforms().setValue(i,"morphTargetBaseInfluence",y),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",p.texture,t),l.getUniforms().setValue(i,"morphTargetsTextureSize",p.size)}return{update:r}}function K_(i,e,t,n){let s=new WeakMap;function r(l){const c=n.render.frame,h=l.geometry,f=e.get(l,h);if(s.get(f)!==c&&(e.update(f),s.set(f,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",o)===!1&&l.addEventListener("dispose",o),s.get(l)!==c&&(t.update(l.instanceMatrix,i.ARRAY_BUFFER),l.instanceColor!==null&&t.update(l.instanceColor,i.ARRAY_BUFFER),s.set(l,c))),l.isSkinnedMesh){const p=l.skeleton;s.get(p)!==c&&(p.update(),s.set(p,c))}return f}function a(){s=new WeakMap}function o(l){const c=l.target;c.removeEventListener("dispose",o),t.remove(c.instanceMatrix),c.instanceColor!==null&&t.remove(c.instanceColor)}return{update:r,dispose:a}}class Cf extends Ht{constructor(e,t,n,s,r,a,o,l,c,h=Cs){if(h!==Cs&&h!==Ls)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&h===Cs&&(n=Ni),n===void 0&&h===Ls&&(n=Ds),super(null,s,r,a,o,l,h,n,c),this.isDepthTexture=!0,this.image={width:e,height:t},this.magFilter=o!==void 0?o:Qt,this.minFilter=l!==void 0?l:Qt,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}}const h0=new Ht,Zu=new Cf(1,1),f0=new ic,u0=new wf,d0=new Ua,qu=[],$u=[],Ku=new Float32Array(16),Ju=new Float32Array(9),ju=new Float32Array(4);function Tr(i,e,t){const n=i[0];if(n<=0||n>0)return i;const s=e*t;let r=qu[s];if(r===void 0&&(r=new Float32Array(s),qu[s]=r),e!==0){n.toArray(r,0);for(let a=1,o=0;a!==e;++a)o+=t,i[a].toArray(r,o)}return r}function nn(i,e){if(i.length!==e.length)return!1;for(let t=0,n=i.length;t<n;t++)if(i[t]!==e[t])return!1;return!0}function sn(i,e){for(let t=0,n=e.length;t<n;t++)i[t]=e[t]}function ac(i,e){let t=$u[e];t===void 0&&(t=new Int32Array(e),$u[e]=t);for(let n=0;n!==e;++n)t[n]=i.allocateTextureUnit();return t}function J_(i,e){const t=this.cache;t[0]!==e&&(i.uniform1f(this.addr,e),t[0]=e)}function j_(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(nn(t,e))return;i.uniform2fv(this.addr,e),sn(t,e)}}function Q_(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(i.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(nn(t,e))return;i.uniform3fv(this.addr,e),sn(t,e)}}function ex(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(nn(t,e))return;i.uniform4fv(this.addr,e),sn(t,e)}}function tx(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(nn(t,e))return;i.uniformMatrix2fv(this.addr,!1,e),sn(t,e)}else{if(nn(t,n))return;ju.set(n),i.uniformMatrix2fv(this.addr,!1,ju),sn(t,n)}}function nx(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(nn(t,e))return;i.uniformMatrix3fv(this.addr,!1,e),sn(t,e)}else{if(nn(t,n))return;Ju.set(n),i.uniformMatrix3fv(this.addr,!1,Ju),sn(t,n)}}function ix(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(nn(t,e))return;i.uniformMatrix4fv(this.addr,!1,e),sn(t,e)}else{if(nn(t,n))return;Ku.set(n),i.uniformMatrix4fv(this.addr,!1,Ku),sn(t,n)}}function sx(i,e){const t=this.cache;t[0]!==e&&(i.uniform1i(this.addr,e),t[0]=e)}function rx(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(nn(t,e))return;i.uniform2iv(this.addr,e),sn(t,e)}}function ax(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(nn(t,e))return;i.uniform3iv(this.addr,e),sn(t,e)}}function ox(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(nn(t,e))return;i.uniform4iv(this.addr,e),sn(t,e)}}function lx(i,e){const t=this.cache;t[0]!==e&&(i.uniform1ui(this.addr,e),t[0]=e)}function cx(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(nn(t,e))return;i.uniform2uiv(this.addr,e),sn(t,e)}}function hx(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(nn(t,e))return;i.uniform3uiv(this.addr,e),sn(t,e)}}function fx(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(nn(t,e))return;i.uniform4uiv(this.addr,e),sn(t,e)}}function ux(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(Zu.compareFunction=bf,r=Zu):r=h0,t.setTexture2D(e||r,s)}function dx(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture3D(e||u0,s)}function px(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTextureCube(e||d0,s)}function mx(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture2DArray(e||f0,s)}function gx(i){switch(i){case 5126:return J_;case 35664:return j_;case 35665:return Q_;case 35666:return ex;case 35674:return tx;case 35675:return nx;case 35676:return ix;case 5124:case 35670:return sx;case 35667:case 35671:return rx;case 35668:case 35672:return ax;case 35669:case 35673:return ox;case 5125:return lx;case 36294:return cx;case 36295:return hx;case 36296:return fx;case 35678:case 36198:case 36298:case 36306:case 35682:return ux;case 35679:case 36299:case 36307:return dx;case 35680:case 36300:case 36308:case 36293:return px;case 36289:case 36303:case 36311:case 36292:return mx}}function yx(i,e){i.uniform1fv(this.addr,e)}function _x(i,e){const t=Tr(e,this.size,2);i.uniform2fv(this.addr,t)}function xx(i,e){const t=Tr(e,this.size,3);i.uniform3fv(this.addr,t)}function vx(i,e){const t=Tr(e,this.size,4);i.uniform4fv(this.addr,t)}function Mx(i,e){const t=Tr(e,this.size,4);i.uniformMatrix2fv(this.addr,!1,t)}function bx(i,e){const t=Tr(e,this.size,9);i.uniformMatrix3fv(this.addr,!1,t)}function Sx(i,e){const t=Tr(e,this.size,16);i.uniformMatrix4fv(this.addr,!1,t)}function wx(i,e){i.uniform1iv(this.addr,e)}function Tx(i,e){i.uniform2iv(this.addr,e)}function Ax(i,e){i.uniform3iv(this.addr,e)}function Ex(i,e){i.uniform4iv(this.addr,e)}function Cx(i,e){i.uniform1uiv(this.addr,e)}function Rx(i,e){i.uniform2uiv(this.addr,e)}function Px(i,e){i.uniform3uiv(this.addr,e)}function Ix(i,e){i.uniform4uiv(this.addr,e)}function Dx(i,e,t){const n=this.cache,s=e.length,r=ac(t,s);nn(n,r)||(i.uniform1iv(this.addr,r),sn(n,r));for(let a=0;a!==s;++a)t.setTexture2D(e[a]||h0,r[a])}function Lx(i,e,t){const n=this.cache,s=e.length,r=ac(t,s);nn(n,r)||(i.uniform1iv(this.addr,r),sn(n,r));for(let a=0;a!==s;++a)t.setTexture3D(e[a]||u0,r[a])}function zx(i,e,t){const n=this.cache,s=e.length,r=ac(t,s);nn(n,r)||(i.uniform1iv(this.addr,r),sn(n,r));for(let a=0;a!==s;++a)t.setTextureCube(e[a]||d0,r[a])}function Ux(i,e,t){const n=this.cache,s=e.length,r=ac(t,s);nn(n,r)||(i.uniform1iv(this.addr,r),sn(n,r));for(let a=0;a!==s;++a)t.setTexture2DArray(e[a]||f0,r[a])}function Nx(i){switch(i){case 5126:return yx;case 35664:return _x;case 35665:return xx;case 35666:return vx;case 35674:return Mx;case 35675:return bx;case 35676:return Sx;case 5124:case 35670:return wx;case 35667:case 35671:return Tx;case 35668:case 35672:return Ax;case 35669:case 35673:return Ex;case 5125:return Cx;case 36294:return Rx;case 36295:return Px;case 36296:return Ix;case 35678:case 36198:case 36298:case 36306:case 35682:return Dx;case 35679:case 36299:case 36307:return Lx;case 35680:case 36300:case 36308:case 36293:return zx;case 36289:case 36303:case 36311:case 36292:return Ux}}class Ox{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=gx(t.type)}}class Fx{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Nx(t.type)}}class Bx{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){const s=this.seq;for(let r=0,a=s.length;r!==a;++r){const o=s[r];o.setValue(e,t[o.id],n)}}}const fh=/(\w+)(\])?(\[|\.)?/g;function Qu(i,e){i.seq.push(e),i.map[e.id]=e}function kx(i,e,t){const n=i.name,s=n.length;for(fh.lastIndex=0;;){const r=fh.exec(n),a=fh.lastIndex;let o=r[1];const l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===s){Qu(t,c===void 0?new Ox(o,i,e):new Fx(o,i,e));break}else{let f=t.map[o];f===void 0&&(f=new Bx(o),Qu(t,f)),t=f}}}class el{constructor(e,t){this.seq=[],this.map={};const n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let s=0;s<n;++s){const r=e.getActiveUniform(t,s),a=e.getUniformLocation(t,r.name);kx(r,a,this)}}setValue(e,t,n,s){const r=this.map[t];r!==void 0&&r.setValue(e,n,s)}setOptional(e,t,n){const s=t[n];s!==void 0&&this.setValue(e,n,s)}static upload(e,t,n,s){for(let r=0,a=t.length;r!==a;++r){const o=t[r],l=n[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,s)}}static seqWithValue(e,t){const n=[];for(let s=0,r=e.length;s!==r;++s){const a=e[s];a.id in t&&n.push(a)}return n}}function ed(i,e,t){const n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),n}const Vx=37297;let Hx=0;function Gx(i,e){const t=i.split(`
`),n=[],s=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let a=s;a<r;a++){const o=a+1;n.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return n.join(`
`)}const td=new et;function Wx(i){ct._getMatrix(td,ct.workingColorSpace,i);const e=`mat3( ${td.elements.map(t=>t.toFixed(4))} )`;switch(ct.getTransfer(i)){case za:return[e,"LinearTransferOETF"];case Mt:return[e,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",i),[e,"LinearTransferOETF"]}}function nd(i,e,t){const n=i.getShaderParameter(e,i.COMPILE_STATUS),s=i.getShaderInfoLog(e).trim();if(n&&s==="")return"";const r=/ERROR: 0:(\d+)/.exec(s);if(r){const a=parseInt(r[1]);return t.toUpperCase()+`

`+s+`

`+Gx(i.getShaderSource(e),a)}else return s}function Xx(i,e){const t=Wx(e);return[`vec4 ${i}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}function Yx(i,e){let t;switch(e){case Lp:t="Linear";break;case zp:t="Reinhard";break;case Up:t="Cineon";break;case Np:t="ACESFilmic";break;case Fp:t="AgX";break;case Bp:t="Neutral";break;case Op:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+i+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const yo=new w;function Zx(){ct.getLuminanceCoefficients(yo);const i=yo.x.toFixed(4),e=yo.y.toFixed(4),t=yo.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function qx(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Qr).join(`
`)}function $x(i){const e=[];for(const t in i){const n=i[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function Kx(i,e){const t={},n=i.getProgramParameter(e,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){const r=i.getActiveAttrib(e,s),a=r.name;let o=1;r.type===i.FLOAT_MAT2&&(o=2),r.type===i.FLOAT_MAT3&&(o=3),r.type===i.FLOAT_MAT4&&(o=4),t[a]={type:r.type,location:i.getAttribLocation(e,a),locationSize:o}}return t}function Qr(i){return i!==""}function id(i,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function sd(i,e){return i.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const Jx=/^[ \t]*#include +<([\w\d./]+)>/gm;function $h(i){return i.replace(Jx,Qx)}const jx=new Map;function Qx(i,e){let t=rt[e];if(t===void 0){const n=jx.get(e);if(n!==void 0)t=rt[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("Can not resolve #include <"+e+">")}return $h(t)}const ev=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function rd(i){return i.replace(ev,tv)}function tv(i,e,t,n){let s="";for(let r=parseInt(e);r<parseInt(t);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function ad(i){let e=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?e+=`
#define HIGH_PRECISION`:i.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function nv(i){let e="SHADOWMAP_TYPE_BASIC";return i.shadowMapType===cf?e="SHADOWMAP_TYPE_PCF":i.shadowMapType===hf?e="SHADOWMAP_TYPE_PCF_SOFT":i.shadowMapType===hi&&(e="SHADOWMAP_TYPE_VSM"),e}function iv(i){let e="ENVMAP_TYPE_CUBE";if(i.envMap)switch(i.envMapMode){case Ui:case Ji:e="ENVMAP_TYPE_CUBE";break;case wr:e="ENVMAP_TYPE_CUBE_UV";break}return e}function sv(i){let e="ENVMAP_MODE_REFLECTION";if(i.envMap)switch(i.envMapMode){case Ji:e="ENVMAP_MODE_REFRACTION";break}return e}function rv(i){let e="ENVMAP_BLENDING_NONE";if(i.envMap)switch(i.combine){case Da:e="ENVMAP_BLENDING_MULTIPLY";break;case Ip:e="ENVMAP_BLENDING_MIX";break;case Dp:e="ENVMAP_BLENDING_ADD";break}return e}function av(i){const e=i.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:n,maxMip:t}}function ov(i,e,t,n){const s=i.getContext(),r=t.defines;let a=t.vertexShader,o=t.fragmentShader;const l=nv(t),c=iv(t),h=sv(t),f=rv(t),p=av(t),u=qx(t),g=$x(r),y=s.createProgram();let d,m,_=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(d=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(Qr).join(`
`),d.length>0&&(d+=`
`),m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(Qr).join(`
`),m.length>0&&(m+=`
`)):(d=[ad(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Qr).join(`
`),m=[ad(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+f:"",p?"#define CUBEUV_TEXEL_WIDTH "+p.texelWidth:"",p?"#define CUBEUV_TEXEL_HEIGHT "+p.texelHeight:"",p?"#define CUBEUV_MAX_MIP "+p.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor||t.batchingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==mi?"#define TONE_MAPPING":"",t.toneMapping!==mi?rt.tonemapping_pars_fragment:"",t.toneMapping!==mi?Yx("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",rt.colorspace_pars_fragment,Xx("linearToOutputTexel",t.outputColorSpace),Zx(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(Qr).join(`
`)),a=$h(a),a=id(a,t),a=sd(a,t),o=$h(o),o=id(o,t),o=sd(o,t),a=rd(a),o=rd(o),t.isRawShaderMaterial!==!0&&(_=`#version 300 es
`,d=[u,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+d,m=["#define varying in",t.glslVersion===Zh?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===Zh?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+m);const x=_+d+a,v=_+m+o,E=ed(s,s.VERTEX_SHADER,x),T=ed(s,s.FRAGMENT_SHADER,v);s.attachShader(y,E),s.attachShader(y,T),t.index0AttributeName!==void 0?s.bindAttribLocation(y,0,t.index0AttributeName):t.morphTargets===!0&&s.bindAttribLocation(y,0,"position"),s.linkProgram(y);function R(D){if(i.debug.checkShaderErrors){const U=s.getProgramInfoLog(y).trim(),B=s.getShaderInfoLog(E).trim(),G=s.getShaderInfoLog(T).trim();let Y=!0,W=!0;if(s.getProgramParameter(y,s.LINK_STATUS)===!1)if(Y=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,y,E,T);else{const te=nd(s,E,"vertex"),X=nd(s,T,"fragment");console.error("THREE.WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(y,s.VALIDATE_STATUS)+`

Material Name: `+D.name+`
Material Type: `+D.type+`

Program Info Log: `+U+`
`+te+`
`+X)}else U!==""?console.warn("THREE.WebGLProgram: Program Info Log:",U):(B===""||G==="")&&(W=!1);W&&(D.diagnostics={runnable:Y,programLog:U,vertexShader:{log:B,prefix:d},fragmentShader:{log:G,prefix:m}})}s.deleteShader(E),s.deleteShader(T),P=new el(s,y),S=Kx(s,y)}let P;this.getUniforms=function(){return P===void 0&&R(this),P};let S;this.getAttributes=function(){return S===void 0&&R(this),S};let M=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return M===!1&&(M=s.getProgramParameter(y,Vx)),M},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(y),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Hx++,this.cacheKey=e,this.usedTimes=1,this.program=y,this.vertexShader=E,this.fragmentShader=T,this}let lv=0;class cv{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){const t=e.vertexShader,n=e.fragmentShader,s=this._getShaderStage(t),r=this._getShaderStage(n),a=this._getShaderCacheForMaterial(e);return a.has(s)===!1&&(a.add(s),s.usedTimes++),a.has(r)===!1&&(a.add(r),r.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){const t=this.shaderCache;let n=t.get(e);return n===void 0&&(n=new hv(e),t.set(e,n)),n}}class hv{constructor(e){this.id=lv++,this.code=e,this.usedTimes=0}}function fv(i,e,t,n,s,r,a){const o=new sc,l=new cv,c=new Set,h=[],f=s.logarithmicDepthBuffer,p=s.vertexTextures;let u=s.precision;const g={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function y(S){return c.add(S),S===0?"uv":`uv${S}`}function d(S,M,D,U,B){const G=U.fog,Y=B.geometry,W=S.isMeshStandardMaterial?U.environment:null,te=(S.isMeshStandardMaterial?t:e).get(S.envMap||W),X=te&&te.mapping===wr?te.image.height:null,de=g[S.type];S.precision!==null&&(u=s.getMaxPrecision(S.precision),u!==S.precision&&console.warn("THREE.WebGLProgram.getParameters:",S.precision,"not supported, using",u,"instead."));const ve=Y.morphAttributes.position||Y.morphAttributes.normal||Y.morphAttributes.color,ge=ve!==void 0?ve.length:0;let Xe=0;Y.morphAttributes.position!==void 0&&(Xe=1),Y.morphAttributes.normal!==void 0&&(Xe=2),Y.morphAttributes.color!==void 0&&(Xe=3);let ie,V,J,le;if(de){const xt=ti[de];ie=xt.vertexShader,V=xt.fragmentShader}else ie=S.vertexShader,V=S.fragmentShader,l.update(S),J=l.getVertexShaderID(S),le=l.getFragmentShaderID(S);const oe=i.getRenderTarget(),Le=i.state.buffers.depth.getReversed(),Oe=B.isInstancedMesh===!0,Ge=B.isBatchedMesh===!0,Ke=!!S.map,ne=!!S.matcap,ue=!!te,z=!!S.aoMap,Fe=!!S.lightMap,he=!!S.bumpMap,Pe=!!S.normalMap,xe=!!S.displacementMap,qe=!!S.emissiveMap,Ie=!!S.metalnessMap,L=!!S.roughnessMap,b=S.anisotropy>0,H=S.clearcoat>0,Q=S.dispersion>0,ae=S.iridescence>0,ee=S.sheen>0,Ne=S.transmission>0,be=b&&!!S.anisotropyMap,j=H&&!!S.clearcoatMap,$e=H&&!!S.clearcoatNormalMap,ce=H&&!!S.clearcoatRoughnessMap,Ee=ae&&!!S.iridescenceMap,Je=ae&&!!S.iridescenceThicknessMap,je=ee&&!!S.sheenColorMap,Ue=ee&&!!S.sheenRoughnessMap,ft=!!S.specularMap,at=!!S.specularColorMap,Ct=!!S.specularIntensityMap,N=Ne&&!!S.transmissionMap,we=Ne&&!!S.thicknessMap,K=!!S.gradientMap,se=!!S.alphaMap,Ce=S.alphaTest>0,Te=!!S.alphaHash,it=!!S.extensions;let Ot=mi;S.toneMapped&&(oe===null||oe.isXRRenderTarget===!0)&&(Ot=i.toneMapping);const cn={shaderID:de,shaderType:S.type,shaderName:S.name,vertexShader:ie,fragmentShader:V,defines:S.defines,customVertexShaderID:J,customFragmentShaderID:le,isRawShaderMaterial:S.isRawShaderMaterial===!0,glslVersion:S.glslVersion,precision:u,batching:Ge,batchingColor:Ge&&B._colorsTexture!==null,instancing:Oe,instancingColor:Oe&&B.instanceColor!==null,instancingMorph:Oe&&B.morphTexture!==null,supportsVertexTextures:p,outputColorSpace:oe===null?i.outputColorSpace:oe.isXRRenderTarget===!0?oe.texture.colorSpace:es,alphaToCoverage:!!S.alphaToCoverage,map:Ke,matcap:ne,envMap:ue,envMapMode:ue&&te.mapping,envMapCubeUVHeight:X,aoMap:z,lightMap:Fe,bumpMap:he,normalMap:Pe,displacementMap:p&&xe,emissiveMap:qe,normalMapObjectSpace:Pe&&S.normalMapType===Yp,normalMapTangentSpace:Pe&&S.normalMapType===Qi,metalnessMap:Ie,roughnessMap:L,anisotropy:b,anisotropyMap:be,clearcoat:H,clearcoatMap:j,clearcoatNormalMap:$e,clearcoatRoughnessMap:ce,dispersion:Q,iridescence:ae,iridescenceMap:Ee,iridescenceThicknessMap:Je,sheen:ee,sheenColorMap:je,sheenRoughnessMap:Ue,specularMap:ft,specularColorMap:at,specularIntensityMap:Ct,transmission:Ne,transmissionMap:N,thicknessMap:we,gradientMap:K,opaque:S.transparent===!1&&S.blending===ii&&S.alphaToCoverage===!1,alphaMap:se,alphaTest:Ce,alphaHash:Te,combine:S.combine,mapUv:Ke&&y(S.map.channel),aoMapUv:z&&y(S.aoMap.channel),lightMapUv:Fe&&y(S.lightMap.channel),bumpMapUv:he&&y(S.bumpMap.channel),normalMapUv:Pe&&y(S.normalMap.channel),displacementMapUv:xe&&y(S.displacementMap.channel),emissiveMapUv:qe&&y(S.emissiveMap.channel),metalnessMapUv:Ie&&y(S.metalnessMap.channel),roughnessMapUv:L&&y(S.roughnessMap.channel),anisotropyMapUv:be&&y(S.anisotropyMap.channel),clearcoatMapUv:j&&y(S.clearcoatMap.channel),clearcoatNormalMapUv:$e&&y(S.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:ce&&y(S.clearcoatRoughnessMap.channel),iridescenceMapUv:Ee&&y(S.iridescenceMap.channel),iridescenceThicknessMapUv:Je&&y(S.iridescenceThicknessMap.channel),sheenColorMapUv:je&&y(S.sheenColorMap.channel),sheenRoughnessMapUv:Ue&&y(S.sheenRoughnessMap.channel),specularMapUv:ft&&y(S.specularMap.channel),specularColorMapUv:at&&y(S.specularColorMap.channel),specularIntensityMapUv:Ct&&y(S.specularIntensityMap.channel),transmissionMapUv:N&&y(S.transmissionMap.channel),thicknessMapUv:we&&y(S.thicknessMap.channel),alphaMapUv:se&&y(S.alphaMap.channel),vertexTangents:!!Y.attributes.tangent&&(Pe||b),vertexColors:S.vertexColors,vertexAlphas:S.vertexColors===!0&&!!Y.attributes.color&&Y.attributes.color.itemSize===4,pointsUvs:B.isPoints===!0&&!!Y.attributes.uv&&(Ke||se),fog:!!G,useFog:S.fog===!0,fogExp2:!!G&&G.isFogExp2,flatShading:S.flatShading===!0,sizeAttenuation:S.sizeAttenuation===!0,logarithmicDepthBuffer:f,reverseDepthBuffer:Le,skinning:B.isSkinnedMesh===!0,morphTargets:Y.morphAttributes.position!==void 0,morphNormals:Y.morphAttributes.normal!==void 0,morphColors:Y.morphAttributes.color!==void 0,morphTargetsCount:ge,morphTextureStride:Xe,numDirLights:M.directional.length,numPointLights:M.point.length,numSpotLights:M.spot.length,numSpotLightMaps:M.spotLightMap.length,numRectAreaLights:M.rectArea.length,numHemiLights:M.hemi.length,numDirLightShadows:M.directionalShadowMap.length,numPointLightShadows:M.pointShadowMap.length,numSpotLightShadows:M.spotShadowMap.length,numSpotLightShadowsWithMaps:M.numSpotLightShadowsWithMaps,numLightProbes:M.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:S.dithering,shadowMapEnabled:i.shadowMap.enabled&&D.length>0,shadowMapType:i.shadowMap.type,toneMapping:Ot,decodeVideoTexture:Ke&&S.map.isVideoTexture===!0&&ct.getTransfer(S.map.colorSpace)===Mt,decodeVideoTextureEmissive:qe&&S.emissiveMap.isVideoTexture===!0&&ct.getTransfer(S.emissiveMap.colorSpace)===Mt,premultipliedAlpha:S.premultipliedAlpha,doubleSided:S.side===St,flipSided:S.side===on,useDepthPacking:S.depthPacking>=0,depthPacking:S.depthPacking||0,index0AttributeName:S.index0AttributeName,extensionClipCullDistance:it&&S.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(it&&S.extensions.multiDraw===!0||Ge)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:S.customProgramCacheKey()};return cn.vertexUv1s=c.has(1),cn.vertexUv2s=c.has(2),cn.vertexUv3s=c.has(3),c.clear(),cn}function m(S){const M=[];if(S.shaderID?M.push(S.shaderID):(M.push(S.customVertexShaderID),M.push(S.customFragmentShaderID)),S.defines!==void 0)for(const D in S.defines)M.push(D),M.push(S.defines[D]);return S.isRawShaderMaterial===!1&&(_(M,S),x(M,S),M.push(i.outputColorSpace)),M.push(S.customProgramCacheKey),M.join()}function _(S,M){S.push(M.precision),S.push(M.outputColorSpace),S.push(M.envMapMode),S.push(M.envMapCubeUVHeight),S.push(M.mapUv),S.push(M.alphaMapUv),S.push(M.lightMapUv),S.push(M.aoMapUv),S.push(M.bumpMapUv),S.push(M.normalMapUv),S.push(M.displacementMapUv),S.push(M.emissiveMapUv),S.push(M.metalnessMapUv),S.push(M.roughnessMapUv),S.push(M.anisotropyMapUv),S.push(M.clearcoatMapUv),S.push(M.clearcoatNormalMapUv),S.push(M.clearcoatRoughnessMapUv),S.push(M.iridescenceMapUv),S.push(M.iridescenceThicknessMapUv),S.push(M.sheenColorMapUv),S.push(M.sheenRoughnessMapUv),S.push(M.specularMapUv),S.push(M.specularColorMapUv),S.push(M.specularIntensityMapUv),S.push(M.transmissionMapUv),S.push(M.thicknessMapUv),S.push(M.combine),S.push(M.fogExp2),S.push(M.sizeAttenuation),S.push(M.morphTargetsCount),S.push(M.morphAttributeCount),S.push(M.numDirLights),S.push(M.numPointLights),S.push(M.numSpotLights),S.push(M.numSpotLightMaps),S.push(M.numHemiLights),S.push(M.numRectAreaLights),S.push(M.numDirLightShadows),S.push(M.numPointLightShadows),S.push(M.numSpotLightShadows),S.push(M.numSpotLightShadowsWithMaps),S.push(M.numLightProbes),S.push(M.shadowMapType),S.push(M.toneMapping),S.push(M.numClippingPlanes),S.push(M.numClipIntersection),S.push(M.depthPacking)}function x(S,M){o.disableAll(),M.supportsVertexTextures&&o.enable(0),M.instancing&&o.enable(1),M.instancingColor&&o.enable(2),M.instancingMorph&&o.enable(3),M.matcap&&o.enable(4),M.envMap&&o.enable(5),M.normalMapObjectSpace&&o.enable(6),M.normalMapTangentSpace&&o.enable(7),M.clearcoat&&o.enable(8),M.iridescence&&o.enable(9),M.alphaTest&&o.enable(10),M.vertexColors&&o.enable(11),M.vertexAlphas&&o.enable(12),M.vertexUv1s&&o.enable(13),M.vertexUv2s&&o.enable(14),M.vertexUv3s&&o.enable(15),M.vertexTangents&&o.enable(16),M.anisotropy&&o.enable(17),M.alphaHash&&o.enable(18),M.batching&&o.enable(19),M.dispersion&&o.enable(20),M.batchingColor&&o.enable(21),S.push(o.mask),o.disableAll(),M.fog&&o.enable(0),M.useFog&&o.enable(1),M.flatShading&&o.enable(2),M.logarithmicDepthBuffer&&o.enable(3),M.reverseDepthBuffer&&o.enable(4),M.skinning&&o.enable(5),M.morphTargets&&o.enable(6),M.morphNormals&&o.enable(7),M.morphColors&&o.enable(8),M.premultipliedAlpha&&o.enable(9),M.shadowMapEnabled&&o.enable(10),M.doubleSided&&o.enable(11),M.flipSided&&o.enable(12),M.useDepthPacking&&o.enable(13),M.dithering&&o.enable(14),M.transmission&&o.enable(15),M.sheen&&o.enable(16),M.opaque&&o.enable(17),M.pointsUvs&&o.enable(18),M.decodeVideoTexture&&o.enable(19),M.decodeVideoTextureEmissive&&o.enable(20),M.alphaToCoverage&&o.enable(21),S.push(o.mask)}function v(S){const M=g[S.type];let D;if(M){const U=ti[M];D=vr.clone(U.uniforms)}else D=S.uniforms;return D}function E(S,M){let D;for(let U=0,B=h.length;U<B;U++){const G=h[U];if(G.cacheKey===M){D=G,++D.usedTimes;break}}return D===void 0&&(D=new ov(i,M,S,r),h.push(D)),D}function T(S){if(--S.usedTimes===0){const M=h.indexOf(S);h[M]=h[h.length-1],h.pop(),S.destroy()}}function R(S){l.remove(S)}function P(){l.dispose()}return{getParameters:d,getProgramCacheKey:m,getUniforms:v,acquireProgram:E,releaseProgram:T,releaseShaderCache:R,programs:h,dispose:P}}function uv(){let i=new WeakMap;function e(a){return i.has(a)}function t(a){let o=i.get(a);return o===void 0&&(o={},i.set(a,o)),o}function n(a){i.delete(a)}function s(a,o,l){i.get(a)[o]=l}function r(){i=new WeakMap}return{has:e,get:t,remove:n,update:s,dispose:r}}function dv(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.material.id!==e.material.id?i.material.id-e.material.id:i.z!==e.z?i.z-e.z:i.id-e.id}function od(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.z!==e.z?e.z-i.z:i.id-e.id}function ld(){const i=[];let e=0;const t=[],n=[],s=[];function r(){e=0,t.length=0,n.length=0,s.length=0}function a(f,p,u,g,y,d){let m=i[e];return m===void 0?(m={id:f.id,object:f,geometry:p,material:u,groupOrder:g,renderOrder:f.renderOrder,z:y,group:d},i[e]=m):(m.id=f.id,m.object=f,m.geometry=p,m.material=u,m.groupOrder=g,m.renderOrder=f.renderOrder,m.z=y,m.group=d),e++,m}function o(f,p,u,g,y,d){const m=a(f,p,u,g,y,d);u.transmission>0?n.push(m):u.transparent===!0?s.push(m):t.push(m)}function l(f,p,u,g,y,d){const m=a(f,p,u,g,y,d);u.transmission>0?n.unshift(m):u.transparent===!0?s.unshift(m):t.unshift(m)}function c(f,p){t.length>1&&t.sort(f||dv),n.length>1&&n.sort(p||od),s.length>1&&s.sort(p||od)}function h(){for(let f=e,p=i.length;f<p;f++){const u=i[f];if(u.id===null)break;u.id=null,u.object=null,u.geometry=null,u.material=null,u.group=null}}return{opaque:t,transmissive:n,transparent:s,init:r,push:o,unshift:l,finish:h,sort:c}}function pv(){let i=new WeakMap;function e(n,s){const r=i.get(n);let a;return r===void 0?(a=new ld,i.set(n,[a])):s>=r.length?(a=new ld,r.push(a)):a=r[s],a}function t(){i=new WeakMap}return{get:e,dispose:t}}function mv(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new w,color:new re};break;case"SpotLight":t={position:new w,direction:new w,color:new re,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new w,color:new re,distance:0,decay:0};break;case"HemisphereLight":t={direction:new w,skyColor:new re,groundColor:new re};break;case"RectAreaLight":t={color:new re,position:new w,halfWidth:new w,halfHeight:new w};break}return i[e.id]=t,t}}}function gv(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new $};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new $};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new $,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[e.id]=t,t}}}let yv=0;function _v(i,e){return(e.castShadow?2:0)-(i.castShadow?2:0)+(e.map?1:0)-(i.map?1:0)}function xv(i){const e=new mv,t=gv(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new w);const s=new w,r=new Ye,a=new Ye;function o(c){let h=0,f=0,p=0;for(let S=0;S<9;S++)n.probe[S].set(0,0,0);let u=0,g=0,y=0,d=0,m=0,_=0,x=0,v=0,E=0,T=0,R=0;c.sort(_v);for(let S=0,M=c.length;S<M;S++){const D=c[S],U=D.color,B=D.intensity,G=D.distance,Y=D.shadow&&D.shadow.map?D.shadow.map.texture:null;if(D.isAmbientLight)h+=U.r*B,f+=U.g*B,p+=U.b*B;else if(D.isLightProbe){for(let W=0;W<9;W++)n.probe[W].addScaledVector(D.sh.coefficients[W],B);R++}else if(D.isDirectionalLight){const W=e.get(D);if(W.color.copy(D.color).multiplyScalar(D.intensity),D.castShadow){const te=D.shadow,X=t.get(D);X.shadowIntensity=te.intensity,X.shadowBias=te.bias,X.shadowNormalBias=te.normalBias,X.shadowRadius=te.radius,X.shadowMapSize=te.mapSize,n.directionalShadow[u]=X,n.directionalShadowMap[u]=Y,n.directionalShadowMatrix[u]=D.shadow.matrix,_++}n.directional[u]=W,u++}else if(D.isSpotLight){const W=e.get(D);W.position.setFromMatrixPosition(D.matrixWorld),W.color.copy(U).multiplyScalar(B),W.distance=G,W.coneCos=Math.cos(D.angle),W.penumbraCos=Math.cos(D.angle*(1-D.penumbra)),W.decay=D.decay,n.spot[y]=W;const te=D.shadow;if(D.map&&(n.spotLightMap[E]=D.map,E++,te.updateMatrices(D),D.castShadow&&T++),n.spotLightMatrix[y]=te.matrix,D.castShadow){const X=t.get(D);X.shadowIntensity=te.intensity,X.shadowBias=te.bias,X.shadowNormalBias=te.normalBias,X.shadowRadius=te.radius,X.shadowMapSize=te.mapSize,n.spotShadow[y]=X,n.spotShadowMap[y]=Y,v++}y++}else if(D.isRectAreaLight){const W=e.get(D);W.color.copy(U).multiplyScalar(B),W.halfWidth.set(D.width*.5,0,0),W.halfHeight.set(0,D.height*.5,0),n.rectArea[d]=W,d++}else if(D.isPointLight){const W=e.get(D);if(W.color.copy(D.color).multiplyScalar(D.intensity),W.distance=D.distance,W.decay=D.decay,D.castShadow){const te=D.shadow,X=t.get(D);X.shadowIntensity=te.intensity,X.shadowBias=te.bias,X.shadowNormalBias=te.normalBias,X.shadowRadius=te.radius,X.shadowMapSize=te.mapSize,X.shadowCameraNear=te.camera.near,X.shadowCameraFar=te.camera.far,n.pointShadow[g]=X,n.pointShadowMap[g]=Y,n.pointShadowMatrix[g]=D.shadow.matrix,x++}n.point[g]=W,g++}else if(D.isHemisphereLight){const W=e.get(D);W.skyColor.copy(D.color).multiplyScalar(B),W.groundColor.copy(D.groundColor).multiplyScalar(B),n.hemi[m]=W,m++}}d>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=Se.LTC_FLOAT_1,n.rectAreaLTC2=Se.LTC_FLOAT_2):(n.rectAreaLTC1=Se.LTC_HALF_1,n.rectAreaLTC2=Se.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=f,n.ambient[2]=p;const P=n.hash;(P.directionalLength!==u||P.pointLength!==g||P.spotLength!==y||P.rectAreaLength!==d||P.hemiLength!==m||P.numDirectionalShadows!==_||P.numPointShadows!==x||P.numSpotShadows!==v||P.numSpotMaps!==E||P.numLightProbes!==R)&&(n.directional.length=u,n.spot.length=y,n.rectArea.length=d,n.point.length=g,n.hemi.length=m,n.directionalShadow.length=_,n.directionalShadowMap.length=_,n.pointShadow.length=x,n.pointShadowMap.length=x,n.spotShadow.length=v,n.spotShadowMap.length=v,n.directionalShadowMatrix.length=_,n.pointShadowMatrix.length=x,n.spotLightMatrix.length=v+E-T,n.spotLightMap.length=E,n.numSpotLightShadowsWithMaps=T,n.numLightProbes=R,P.directionalLength=u,P.pointLength=g,P.spotLength=y,P.rectAreaLength=d,P.hemiLength=m,P.numDirectionalShadows=_,P.numPointShadows=x,P.numSpotShadows=v,P.numSpotMaps=E,P.numLightProbes=R,n.version=yv++)}function l(c,h){let f=0,p=0,u=0,g=0,y=0;const d=h.matrixWorldInverse;for(let m=0,_=c.length;m<_;m++){const x=c[m];if(x.isDirectionalLight){const v=n.directional[f];v.direction.setFromMatrixPosition(x.matrixWorld),s.setFromMatrixPosition(x.target.matrixWorld),v.direction.sub(s),v.direction.transformDirection(d),f++}else if(x.isSpotLight){const v=n.spot[u];v.position.setFromMatrixPosition(x.matrixWorld),v.position.applyMatrix4(d),v.direction.setFromMatrixPosition(x.matrixWorld),s.setFromMatrixPosition(x.target.matrixWorld),v.direction.sub(s),v.direction.transformDirection(d),u++}else if(x.isRectAreaLight){const v=n.rectArea[g];v.position.setFromMatrixPosition(x.matrixWorld),v.position.applyMatrix4(d),a.identity(),r.copy(x.matrixWorld),r.premultiply(d),a.extractRotation(r),v.halfWidth.set(x.width*.5,0,0),v.halfHeight.set(0,x.height*.5,0),v.halfWidth.applyMatrix4(a),v.halfHeight.applyMatrix4(a),g++}else if(x.isPointLight){const v=n.point[p];v.position.setFromMatrixPosition(x.matrixWorld),v.position.applyMatrix4(d),p++}else if(x.isHemisphereLight){const v=n.hemi[y];v.direction.setFromMatrixPosition(x.matrixWorld),v.direction.transformDirection(d),y++}}}return{setup:o,setupView:l,state:n}}function cd(i){const e=new xv(i),t=[],n=[];function s(h){c.camera=h,t.length=0,n.length=0}function r(h){t.push(h)}function a(h){n.push(h)}function o(){e.setup(t)}function l(h){e.setupView(t,h)}const c={lightsArray:t,shadowsArray:n,camera:null,lights:e,transmissionRenderTarget:{}};return{init:s,state:c,setupLights:o,setupLightsView:l,pushLight:r,pushShadow:a}}function vv(i){let e=new WeakMap;function t(s,r=0){const a=e.get(s);let o;return a===void 0?(o=new cd(i),e.set(s,[o])):r>=a.length?(o=new cd(i),a.push(o)):o=a[r],o}function n(){e=new WeakMap}return{get:t,dispose:n}}class Rf extends yn{static get type(){return"MeshDepthMaterial"}constructor(e){super(),this.isMeshDepthMaterial=!0,this.depthPacking=Wp,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class Pf extends yn{static get type(){return"MeshDistanceMaterial"}constructor(e){super(),this.isMeshDistanceMaterial=!0,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}const Mv=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,bv=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function Sv(i,e,t){let n=new Na;const s=new $,r=new $,a=new ot,o=new Rf({depthPacking:Xp}),l=new Pf,c={},h=t.maxTextureSize,f={[Pn]:on,[on]:Pn,[St]:St},p=new At({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new $},radius:{value:4}},vertexShader:Mv,fragmentShader:bv}),u=p.clone();u.defines.HORIZONTAL_PASS=1;const g=new tt;g.setAttribute("position",new Et(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const y=new lt(g,p),d=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=cf;let m=this.type;this.render=function(T,R,P){if(d.enabled===!1||d.autoUpdate===!1&&d.needsUpdate===!1||T.length===0)return;const S=i.getRenderTarget(),M=i.getActiveCubeFace(),D=i.getActiveMipmapLevel(),U=i.state;U.setBlending(pi),U.buffers.color.setClear(1,1,1,1),U.buffers.depth.setTest(!0),U.setScissorTest(!1);const B=m!==hi&&this.type===hi,G=m===hi&&this.type!==hi;for(let Y=0,W=T.length;Y<W;Y++){const te=T[Y],X=te.shadow;if(X===void 0){console.warn("THREE.WebGLShadowMap:",te,"has no shadow.");continue}if(X.autoUpdate===!1&&X.needsUpdate===!1)continue;s.copy(X.mapSize);const de=X.getFrameExtents();if(s.multiply(de),r.copy(X.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/de.x),s.x=r.x*de.x,X.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/de.y),s.y=r.y*de.y,X.mapSize.y=r.y)),X.map===null||B===!0||G===!0){const ge=this.type!==hi?{minFilter:Qt,magFilter:Qt}:{};X.map!==null&&X.map.dispose(),X.map=new ln(s.x,s.y,ge),X.map.texture.name=te.name+".shadowMap",X.camera.updateProjectionMatrix()}i.setRenderTarget(X.map),i.clear();const ve=X.getViewportCount();for(let ge=0;ge<ve;ge++){const Xe=X.getViewport(ge);a.set(r.x*Xe.x,r.y*Xe.y,r.x*Xe.z,r.y*Xe.w),U.viewport(a),X.updateMatrices(te,ge),n=X.getFrustum(),v(R,P,X.camera,te,this.type)}X.isPointLightShadow!==!0&&this.type===hi&&_(X,P),X.needsUpdate=!1}m=this.type,d.needsUpdate=!1,i.setRenderTarget(S,M,D)};function _(T,R){const P=e.update(y);p.defines.VSM_SAMPLES!==T.blurSamples&&(p.defines.VSM_SAMPLES=T.blurSamples,u.defines.VSM_SAMPLES=T.blurSamples,p.needsUpdate=!0,u.needsUpdate=!0),T.mapPass===null&&(T.mapPass=new ln(s.x,s.y)),p.uniforms.shadow_pass.value=T.map.texture,p.uniforms.resolution.value=T.mapSize,p.uniforms.radius.value=T.radius,i.setRenderTarget(T.mapPass),i.clear(),i.renderBufferDirect(R,null,P,p,y,null),u.uniforms.shadow_pass.value=T.mapPass.texture,u.uniforms.resolution.value=T.mapSize,u.uniforms.radius.value=T.radius,i.setRenderTarget(T.map),i.clear(),i.renderBufferDirect(R,null,P,u,y,null)}function x(T,R,P,S){let M=null;const D=P.isPointLight===!0?T.customDistanceMaterial:T.customDepthMaterial;if(D!==void 0)M=D;else if(M=P.isPointLight===!0?l:o,i.localClippingEnabled&&R.clipShadows===!0&&Array.isArray(R.clippingPlanes)&&R.clippingPlanes.length!==0||R.displacementMap&&R.displacementScale!==0||R.alphaMap&&R.alphaTest>0||R.map&&R.alphaTest>0){const U=M.uuid,B=R.uuid;let G=c[U];G===void 0&&(G={},c[U]=G);let Y=G[B];Y===void 0&&(Y=M.clone(),G[B]=Y,R.addEventListener("dispose",E)),M=Y}if(M.visible=R.visible,M.wireframe=R.wireframe,S===hi?M.side=R.shadowSide!==null?R.shadowSide:R.side:M.side=R.shadowSide!==null?R.shadowSide:f[R.side],M.alphaMap=R.alphaMap,M.alphaTest=R.alphaTest,M.map=R.map,M.clipShadows=R.clipShadows,M.clippingPlanes=R.clippingPlanes,M.clipIntersection=R.clipIntersection,M.displacementMap=R.displacementMap,M.displacementScale=R.displacementScale,M.displacementBias=R.displacementBias,M.wireframeLinewidth=R.wireframeLinewidth,M.linewidth=R.linewidth,P.isPointLight===!0&&M.isMeshDistanceMaterial===!0){const U=i.properties.get(M);U.light=P}return M}function v(T,R,P,S,M){if(T.visible===!1)return;if(T.layers.test(R.layers)&&(T.isMesh||T.isLine||T.isPoints)&&(T.castShadow||T.receiveShadow&&M===hi)&&(!T.frustumCulled||n.intersectsObject(T))){T.modelViewMatrix.multiplyMatrices(P.matrixWorldInverse,T.matrixWorld);const B=e.update(T),G=T.material;if(Array.isArray(G)){const Y=B.groups;for(let W=0,te=Y.length;W<te;W++){const X=Y[W],de=G[X.materialIndex];if(de&&de.visible){const ve=x(T,de,S,M);T.onBeforeShadow(i,T,R,P,B,ve,X),i.renderBufferDirect(P,null,B,ve,T,X),T.onAfterShadow(i,T,R,P,B,ve,X)}}}else if(G.visible){const Y=x(T,G,S,M);T.onBeforeShadow(i,T,R,P,B,Y,null),i.renderBufferDirect(P,null,B,Y,T,null),T.onAfterShadow(i,T,R,P,B,Y,null)}}const U=T.children;for(let B=0,G=U.length;B<G;B++)v(U[B],R,P,S,M)}function E(T){T.target.removeEventListener("dispose",E);for(const P in c){const S=c[P],M=T.target.uuid;M in S&&(S[M].dispose(),delete S[M])}}}const wv={[sl]:rl,[al]:cl,[ol]:hl,[Is]:ll,[rl]:sl,[cl]:al,[hl]:ol,[ll]:Is};function Tv(i,e){function t(){let N=!1;const we=new ot;let K=null;const se=new ot(0,0,0,0);return{setMask:function(Ce){K!==Ce&&!N&&(i.colorMask(Ce,Ce,Ce,Ce),K=Ce)},setLocked:function(Ce){N=Ce},setClear:function(Ce,Te,it,Ot,cn){cn===!0&&(Ce*=Ot,Te*=Ot,it*=Ot),we.set(Ce,Te,it,Ot),se.equals(we)===!1&&(i.clearColor(Ce,Te,it,Ot),se.copy(we))},reset:function(){N=!1,K=null,se.set(-1,0,0,0)}}}function n(){let N=!1,we=!1,K=null,se=null,Ce=null;return{setReversed:function(Te){if(we!==Te){const it=e.get("EXT_clip_control");we?it.clipControlEXT(it.LOWER_LEFT_EXT,it.ZERO_TO_ONE_EXT):it.clipControlEXT(it.LOWER_LEFT_EXT,it.NEGATIVE_ONE_TO_ONE_EXT);const Ot=Ce;Ce=null,this.setClear(Ot)}we=Te},getReversed:function(){return we},setTest:function(Te){Te?oe(i.DEPTH_TEST):Le(i.DEPTH_TEST)},setMask:function(Te){K!==Te&&!N&&(i.depthMask(Te),K=Te)},setFunc:function(Te){if(we&&(Te=wv[Te]),se!==Te){switch(Te){case sl:i.depthFunc(i.NEVER);break;case rl:i.depthFunc(i.ALWAYS);break;case al:i.depthFunc(i.LESS);break;case Is:i.depthFunc(i.LEQUAL);break;case ol:i.depthFunc(i.EQUAL);break;case ll:i.depthFunc(i.GEQUAL);break;case cl:i.depthFunc(i.GREATER);break;case hl:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}se=Te}},setLocked:function(Te){N=Te},setClear:function(Te){Ce!==Te&&(we&&(Te=1-Te),i.clearDepth(Te),Ce=Te)},reset:function(){N=!1,K=null,se=null,Ce=null,we=!1}}}function s(){let N=!1,we=null,K=null,se=null,Ce=null,Te=null,it=null,Ot=null,cn=null;return{setTest:function(xt){N||(xt?oe(i.STENCIL_TEST):Le(i.STENCIL_TEST))},setMask:function(xt){we!==xt&&!N&&(i.stencilMask(xt),we=xt)},setFunc:function(xt,$n,bi){(K!==xt||se!==$n||Ce!==bi)&&(i.stencilFunc(xt,$n,bi),K=xt,se=$n,Ce=bi)},setOp:function(xt,$n,bi){(Te!==xt||it!==$n||Ot!==bi)&&(i.stencilOp(xt,$n,bi),Te=xt,it=$n,Ot=bi)},setLocked:function(xt){N=xt},setClear:function(xt){cn!==xt&&(i.clearStencil(xt),cn=xt)},reset:function(){N=!1,we=null,K=null,se=null,Ce=null,Te=null,it=null,Ot=null,cn=null}}}const r=new t,a=new n,o=new s,l=new WeakMap,c=new WeakMap;let h={},f={},p=new WeakMap,u=[],g=null,y=!1,d=null,m=null,_=null,x=null,v=null,E=null,T=null,R=new re(0,0,0),P=0,S=!1,M=null,D=null,U=null,B=null,G=null;const Y=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let W=!1,te=0;const X=i.getParameter(i.VERSION);X.indexOf("WebGL")!==-1?(te=parseFloat(/^WebGL (\d)/.exec(X)[1]),W=te>=1):X.indexOf("OpenGL ES")!==-1&&(te=parseFloat(/^OpenGL ES (\d)/.exec(X)[1]),W=te>=2);let de=null,ve={};const ge=i.getParameter(i.SCISSOR_BOX),Xe=i.getParameter(i.VIEWPORT),ie=new ot().fromArray(ge),V=new ot().fromArray(Xe);function J(N,we,K,se){const Ce=new Uint8Array(4),Te=i.createTexture();i.bindTexture(N,Te),i.texParameteri(N,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(N,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let it=0;it<K;it++)N===i.TEXTURE_3D||N===i.TEXTURE_2D_ARRAY?i.texImage3D(we,0,i.RGBA,1,1,se,0,i.RGBA,i.UNSIGNED_BYTE,Ce):i.texImage2D(we+it,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,Ce);return Te}const le={};le[i.TEXTURE_2D]=J(i.TEXTURE_2D,i.TEXTURE_2D,1),le[i.TEXTURE_CUBE_MAP]=J(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),le[i.TEXTURE_2D_ARRAY]=J(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),le[i.TEXTURE_3D]=J(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),oe(i.DEPTH_TEST),a.setFunc(Is),he(!1),Pe(Hh),oe(i.CULL_FACE),z(pi);function oe(N){h[N]!==!0&&(i.enable(N),h[N]=!0)}function Le(N){h[N]!==!1&&(i.disable(N),h[N]=!1)}function Oe(N,we){return f[N]!==we?(i.bindFramebuffer(N,we),f[N]=we,N===i.DRAW_FRAMEBUFFER&&(f[i.FRAMEBUFFER]=we),N===i.FRAMEBUFFER&&(f[i.DRAW_FRAMEBUFFER]=we),!0):!1}function Ge(N,we){let K=u,se=!1;if(N){K=p.get(we),K===void 0&&(K=[],p.set(we,K));const Ce=N.textures;if(K.length!==Ce.length||K[0]!==i.COLOR_ATTACHMENT0){for(let Te=0,it=Ce.length;Te<it;Te++)K[Te]=i.COLOR_ATTACHMENT0+Te;K.length=Ce.length,se=!0}}else K[0]!==i.BACK&&(K[0]=i.BACK,se=!0);se&&i.drawBuffers(K)}function Ke(N){return g!==N?(i.useProgram(N),g=N,!0):!1}const ne={[Ki]:i.FUNC_ADD,[pp]:i.FUNC_SUBTRACT,[mp]:i.FUNC_REVERSE_SUBTRACT};ne[gp]=i.MIN,ne[yp]=i.MAX;const ue={[_p]:i.ZERO,[xp]:i.ONE,[vp]:i.SRC_COLOR,[nl]:i.SRC_ALPHA,[Ap]:i.SRC_ALPHA_SATURATE,[wp]:i.DST_COLOR,[bp]:i.DST_ALPHA,[Mp]:i.ONE_MINUS_SRC_COLOR,[il]:i.ONE_MINUS_SRC_ALPHA,[Tp]:i.ONE_MINUS_DST_COLOR,[Sp]:i.ONE_MINUS_DST_ALPHA,[Ep]:i.CONSTANT_COLOR,[Cp]:i.ONE_MINUS_CONSTANT_COLOR,[Rp]:i.CONSTANT_ALPHA,[Pp]:i.ONE_MINUS_CONSTANT_ALPHA};function z(N,we,K,se,Ce,Te,it,Ot,cn,xt){if(N===pi){y===!0&&(Le(i.BLEND),y=!1);return}if(y===!1&&(oe(i.BLEND),y=!0),N!==dp){if(N!==d||xt!==S){if((m!==Ki||v!==Ki)&&(i.blendEquation(i.FUNC_ADD),m=Ki,v=Ki),xt)switch(N){case ii:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case In:i.blendFunc(i.ONE,i.ONE);break;case Gh:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case Wh:i.blendFuncSeparate(i.ZERO,i.SRC_COLOR,i.ZERO,i.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",N);break}else switch(N){case ii:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case In:i.blendFunc(i.SRC_ALPHA,i.ONE);break;case Gh:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case Wh:i.blendFunc(i.ZERO,i.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",N);break}_=null,x=null,E=null,T=null,R.set(0,0,0),P=0,d=N,S=xt}return}Ce=Ce||we,Te=Te||K,it=it||se,(we!==m||Ce!==v)&&(i.blendEquationSeparate(ne[we],ne[Ce]),m=we,v=Ce),(K!==_||se!==x||Te!==E||it!==T)&&(i.blendFuncSeparate(ue[K],ue[se],ue[Te],ue[it]),_=K,x=se,E=Te,T=it),(Ot.equals(R)===!1||cn!==P)&&(i.blendColor(Ot.r,Ot.g,Ot.b,cn),R.copy(Ot),P=cn),d=N,S=!1}function Fe(N,we){N.side===St?Le(i.CULL_FACE):oe(i.CULL_FACE);let K=N.side===on;we&&(K=!K),he(K),N.blending===ii&&N.transparent===!1?z(pi):z(N.blending,N.blendEquation,N.blendSrc,N.blendDst,N.blendEquationAlpha,N.blendSrcAlpha,N.blendDstAlpha,N.blendColor,N.blendAlpha,N.premultipliedAlpha),a.setFunc(N.depthFunc),a.setTest(N.depthTest),a.setMask(N.depthWrite),r.setMask(N.colorWrite);const se=N.stencilWrite;o.setTest(se),se&&(o.setMask(N.stencilWriteMask),o.setFunc(N.stencilFunc,N.stencilRef,N.stencilFuncMask),o.setOp(N.stencilFail,N.stencilZFail,N.stencilZPass)),qe(N.polygonOffset,N.polygonOffsetFactor,N.polygonOffsetUnits),N.alphaToCoverage===!0?oe(i.SAMPLE_ALPHA_TO_COVERAGE):Le(i.SAMPLE_ALPHA_TO_COVERAGE)}function he(N){M!==N&&(N?i.frontFace(i.CW):i.frontFace(i.CCW),M=N)}function Pe(N){N!==fp?(oe(i.CULL_FACE),N!==D&&(N===Hh?i.cullFace(i.BACK):N===up?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):Le(i.CULL_FACE),D=N}function xe(N){N!==U&&(W&&i.lineWidth(N),U=N)}function qe(N,we,K){N?(oe(i.POLYGON_OFFSET_FILL),(B!==we||G!==K)&&(i.polygonOffset(we,K),B=we,G=K)):Le(i.POLYGON_OFFSET_FILL)}function Ie(N){N?oe(i.SCISSOR_TEST):Le(i.SCISSOR_TEST)}function L(N){N===void 0&&(N=i.TEXTURE0+Y-1),de!==N&&(i.activeTexture(N),de=N)}function b(N,we,K){K===void 0&&(de===null?K=i.TEXTURE0+Y-1:K=de);let se=ve[K];se===void 0&&(se={type:void 0,texture:void 0},ve[K]=se),(se.type!==N||se.texture!==we)&&(de!==K&&(i.activeTexture(K),de=K),i.bindTexture(N,we||le[N]),se.type=N,se.texture=we)}function H(){const N=ve[de];N!==void 0&&N.type!==void 0&&(i.bindTexture(N.type,null),N.type=void 0,N.texture=void 0)}function Q(){try{i.compressedTexImage2D.apply(i,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function ae(){try{i.compressedTexImage3D.apply(i,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function ee(){try{i.texSubImage2D.apply(i,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function Ne(){try{i.texSubImage3D.apply(i,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function be(){try{i.compressedTexSubImage2D.apply(i,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function j(){try{i.compressedTexSubImage3D.apply(i,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function $e(){try{i.texStorage2D.apply(i,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function ce(){try{i.texStorage3D.apply(i,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function Ee(){try{i.texImage2D.apply(i,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function Je(){try{i.texImage3D.apply(i,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function je(N){ie.equals(N)===!1&&(i.scissor(N.x,N.y,N.z,N.w),ie.copy(N))}function Ue(N){V.equals(N)===!1&&(i.viewport(N.x,N.y,N.z,N.w),V.copy(N))}function ft(N,we){let K=c.get(we);K===void 0&&(K=new WeakMap,c.set(we,K));let se=K.get(N);se===void 0&&(se=i.getUniformBlockIndex(we,N.name),K.set(N,se))}function at(N,we){const se=c.get(we).get(N);l.get(we)!==se&&(i.uniformBlockBinding(we,se,N.__bindingPointIndex),l.set(we,se))}function Ct(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),a.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),h={},de=null,ve={},f={},p=new WeakMap,u=[],g=null,y=!1,d=null,m=null,_=null,x=null,v=null,E=null,T=null,R=new re(0,0,0),P=0,S=!1,M=null,D=null,U=null,B=null,G=null,ie.set(0,0,i.canvas.width,i.canvas.height),V.set(0,0,i.canvas.width,i.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:oe,disable:Le,bindFramebuffer:Oe,drawBuffers:Ge,useProgram:Ke,setBlending:z,setMaterial:Fe,setFlipSided:he,setCullFace:Pe,setLineWidth:xe,setPolygonOffset:qe,setScissorTest:Ie,activeTexture:L,bindTexture:b,unbindTexture:H,compressedTexImage2D:Q,compressedTexImage3D:ae,texImage2D:Ee,texImage3D:Je,updateUBOMapping:ft,uniformBlockBinding:at,texStorage2D:$e,texStorage3D:ce,texSubImage2D:ee,texSubImage3D:Ne,compressedTexSubImage2D:be,compressedTexSubImage3D:j,scissor:je,viewport:Ue,reset:Ct}}function Av(i,e){const t=i.image&&i.image.width?i.image.width/i.image.height:1;return t>e?(i.repeat.x=1,i.repeat.y=t/e,i.offset.x=0,i.offset.y=(1-i.repeat.y)/2):(i.repeat.x=e/t,i.repeat.y=1,i.offset.x=(1-i.repeat.x)/2,i.offset.y=0),i}function Ev(i,e){const t=i.image&&i.image.width?i.image.width/i.image.height:1;return t>e?(i.repeat.x=e/t,i.repeat.y=1,i.offset.x=(1-i.repeat.x)/2,i.offset.y=0):(i.repeat.x=1,i.repeat.y=t/e,i.offset.x=0,i.offset.y=(1-i.repeat.y)/2),i}function Cv(i){return i.repeat.x=1,i.repeat.y=1,i.offset.x=0,i.offset.y=0,i}function Kh(i,e,t,n){const s=Rv(n);switch(t){case mf:return i*e;case yf:return i*e;case _f:return i*e*2;case Ql:return i*e/s.components*s.byteLength;case La:return i*e/s.components*s.byteLength;case xf:return i*e*2/s.components*s.byteLength;case ec:return i*e*2/s.components*s.byteLength;case gf:return i*e*3/s.components*s.byteLength;case mn:return i*e*4/s.components*s.byteLength;case tc:return i*e*4/s.components*s.byteLength;case ia:case sa:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case ra:case aa:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case ul:case pl:return Math.max(i,16)*Math.max(e,8)/4;case fl:case dl:return Math.max(i,8)*Math.max(e,8)/2;case ml:case gl:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case yl:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case _l:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case xl:return Math.floor((i+4)/5)*Math.floor((e+3)/4)*16;case vl:return Math.floor((i+4)/5)*Math.floor((e+4)/5)*16;case Ml:return Math.floor((i+5)/6)*Math.floor((e+4)/5)*16;case bl:return Math.floor((i+5)/6)*Math.floor((e+5)/6)*16;case Sl:return Math.floor((i+7)/8)*Math.floor((e+4)/5)*16;case wl:return Math.floor((i+7)/8)*Math.floor((e+5)/6)*16;case Tl:return Math.floor((i+7)/8)*Math.floor((e+7)/8)*16;case Al:return Math.floor((i+9)/10)*Math.floor((e+4)/5)*16;case El:return Math.floor((i+9)/10)*Math.floor((e+5)/6)*16;case Cl:return Math.floor((i+9)/10)*Math.floor((e+7)/8)*16;case Rl:return Math.floor((i+9)/10)*Math.floor((e+9)/10)*16;case Pl:return Math.floor((i+11)/12)*Math.floor((e+9)/10)*16;case Il:return Math.floor((i+11)/12)*Math.floor((e+11)/12)*16;case oa:case Dl:case Ll:return Math.ceil(i/4)*Math.ceil(e/4)*16;case vf:case zl:return Math.ceil(i/4)*Math.ceil(e/4)*8;case Ul:case Nl:return Math.ceil(i/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function Rv(i){switch(i){case _i:case uf:return{byteLength:1,components:1};case yr:case df:case Yn:return{byteLength:2,components:1};case Jl:case jl:return{byteLength:2,components:4};case Ni:case Kl:case Cn:return{byteLength:4,components:1};case pf:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${i}.`)}const Pv={contain:Av,cover:Ev,fill:Cv,getByteLength:Kh};function Iv(i,e,t,n,s,r,a){const o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new $,h=new WeakMap;let f;const p=new WeakMap;let u=!1;try{u=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(L,b){return u?new OffscreenCanvas(L,b):va("canvas")}function y(L,b,H){let Q=1;const ae=Ie(L);if((ae.width>H||ae.height>H)&&(Q=H/Math.max(ae.width,ae.height)),Q<1)if(typeof HTMLImageElement<"u"&&L instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&L instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&L instanceof ImageBitmap||typeof VideoFrame<"u"&&L instanceof VideoFrame){const ee=Math.floor(Q*ae.width),Ne=Math.floor(Q*ae.height);f===void 0&&(f=g(ee,Ne));const be=b?g(ee,Ne):f;return be.width=ee,be.height=Ne,be.getContext("2d").drawImage(L,0,0,ee,Ne),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+ae.width+"x"+ae.height+") to ("+ee+"x"+Ne+")."),be}else return"data"in L&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+ae.width+"x"+ae.height+")."),L;return L}function d(L){return L.generateMipmaps}function m(L){i.generateMipmap(L)}function _(L){return L.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:L.isWebGL3DRenderTarget?i.TEXTURE_3D:L.isWebGLArrayRenderTarget||L.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function x(L,b,H,Q,ae=!1){if(L!==null){if(i[L]!==void 0)return i[L];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+L+"'")}let ee=b;if(b===i.RED&&(H===i.FLOAT&&(ee=i.R32F),H===i.HALF_FLOAT&&(ee=i.R16F),H===i.UNSIGNED_BYTE&&(ee=i.R8)),b===i.RED_INTEGER&&(H===i.UNSIGNED_BYTE&&(ee=i.R8UI),H===i.UNSIGNED_SHORT&&(ee=i.R16UI),H===i.UNSIGNED_INT&&(ee=i.R32UI),H===i.BYTE&&(ee=i.R8I),H===i.SHORT&&(ee=i.R16I),H===i.INT&&(ee=i.R32I)),b===i.RG&&(H===i.FLOAT&&(ee=i.RG32F),H===i.HALF_FLOAT&&(ee=i.RG16F),H===i.UNSIGNED_BYTE&&(ee=i.RG8)),b===i.RG_INTEGER&&(H===i.UNSIGNED_BYTE&&(ee=i.RG8UI),H===i.UNSIGNED_SHORT&&(ee=i.RG16UI),H===i.UNSIGNED_INT&&(ee=i.RG32UI),H===i.BYTE&&(ee=i.RG8I),H===i.SHORT&&(ee=i.RG16I),H===i.INT&&(ee=i.RG32I)),b===i.RGB_INTEGER&&(H===i.UNSIGNED_BYTE&&(ee=i.RGB8UI),H===i.UNSIGNED_SHORT&&(ee=i.RGB16UI),H===i.UNSIGNED_INT&&(ee=i.RGB32UI),H===i.BYTE&&(ee=i.RGB8I),H===i.SHORT&&(ee=i.RGB16I),H===i.INT&&(ee=i.RGB32I)),b===i.RGBA_INTEGER&&(H===i.UNSIGNED_BYTE&&(ee=i.RGBA8UI),H===i.UNSIGNED_SHORT&&(ee=i.RGBA16UI),H===i.UNSIGNED_INT&&(ee=i.RGBA32UI),H===i.BYTE&&(ee=i.RGBA8I),H===i.SHORT&&(ee=i.RGBA16I),H===i.INT&&(ee=i.RGBA32I)),b===i.RGB&&H===i.UNSIGNED_INT_5_9_9_9_REV&&(ee=i.RGB9_E5),b===i.RGBA){const Ne=ae?za:ct.getTransfer(Q);H===i.FLOAT&&(ee=i.RGBA32F),H===i.HALF_FLOAT&&(ee=i.RGBA16F),H===i.UNSIGNED_BYTE&&(ee=Ne===Mt?i.SRGB8_ALPHA8:i.RGBA8),H===i.UNSIGNED_SHORT_4_4_4_4&&(ee=i.RGBA4),H===i.UNSIGNED_SHORT_5_5_5_1&&(ee=i.RGB5_A1)}return(ee===i.R16F||ee===i.R32F||ee===i.RG16F||ee===i.RG32F||ee===i.RGBA16F||ee===i.RGBA32F)&&e.get("EXT_color_buffer_float"),ee}function v(L,b){let H;return L?b===null||b===Ni||b===Ds?H=i.DEPTH24_STENCIL8:b===Cn?H=i.DEPTH32F_STENCIL8:b===yr&&(H=i.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):b===null||b===Ni||b===Ds?H=i.DEPTH_COMPONENT24:b===Cn?H=i.DEPTH_COMPONENT32F:b===yr&&(H=i.DEPTH_COMPONENT16),H}function E(L,b){return d(L)===!0||L.isFramebufferTexture&&L.minFilter!==Qt&&L.minFilter!==Vt?Math.log2(Math.max(b.width,b.height))+1:L.mipmaps!==void 0&&L.mipmaps.length>0?L.mipmaps.length:L.isCompressedTexture&&Array.isArray(L.image)?b.mipmaps.length:1}function T(L){const b=L.target;b.removeEventListener("dispose",T),P(b),b.isVideoTexture&&h.delete(b)}function R(L){const b=L.target;b.removeEventListener("dispose",R),M(b)}function P(L){const b=n.get(L);if(b.__webglInit===void 0)return;const H=L.source,Q=p.get(H);if(Q){const ae=Q[b.__cacheKey];ae.usedTimes--,ae.usedTimes===0&&S(L),Object.keys(Q).length===0&&p.delete(H)}n.remove(L)}function S(L){const b=n.get(L);i.deleteTexture(b.__webglTexture);const H=L.source,Q=p.get(H);delete Q[b.__cacheKey],a.memory.textures--}function M(L){const b=n.get(L);if(L.depthTexture&&(L.depthTexture.dispose(),n.remove(L.depthTexture)),L.isWebGLCubeRenderTarget)for(let Q=0;Q<6;Q++){if(Array.isArray(b.__webglFramebuffer[Q]))for(let ae=0;ae<b.__webglFramebuffer[Q].length;ae++)i.deleteFramebuffer(b.__webglFramebuffer[Q][ae]);else i.deleteFramebuffer(b.__webglFramebuffer[Q]);b.__webglDepthbuffer&&i.deleteRenderbuffer(b.__webglDepthbuffer[Q])}else{if(Array.isArray(b.__webglFramebuffer))for(let Q=0;Q<b.__webglFramebuffer.length;Q++)i.deleteFramebuffer(b.__webglFramebuffer[Q]);else i.deleteFramebuffer(b.__webglFramebuffer);if(b.__webglDepthbuffer&&i.deleteRenderbuffer(b.__webglDepthbuffer),b.__webglMultisampledFramebuffer&&i.deleteFramebuffer(b.__webglMultisampledFramebuffer),b.__webglColorRenderbuffer)for(let Q=0;Q<b.__webglColorRenderbuffer.length;Q++)b.__webglColorRenderbuffer[Q]&&i.deleteRenderbuffer(b.__webglColorRenderbuffer[Q]);b.__webglDepthRenderbuffer&&i.deleteRenderbuffer(b.__webglDepthRenderbuffer)}const H=L.textures;for(let Q=0,ae=H.length;Q<ae;Q++){const ee=n.get(H[Q]);ee.__webglTexture&&(i.deleteTexture(ee.__webglTexture),a.memory.textures--),n.remove(H[Q])}n.remove(L)}let D=0;function U(){D=0}function B(){const L=D;return L>=s.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+L+" texture units while this GPU supports only "+s.maxTextures),D+=1,L}function G(L){const b=[];return b.push(L.wrapS),b.push(L.wrapT),b.push(L.wrapR||0),b.push(L.magFilter),b.push(L.minFilter),b.push(L.anisotropy),b.push(L.internalFormat),b.push(L.format),b.push(L.type),b.push(L.generateMipmaps),b.push(L.premultiplyAlpha),b.push(L.flipY),b.push(L.unpackAlignment),b.push(L.colorSpace),b.join()}function Y(L,b){const H=n.get(L);if(L.isVideoTexture&&xe(L),L.isRenderTargetTexture===!1&&L.version>0&&H.__version!==L.version){const Q=L.image;if(Q===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(Q.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{V(H,L,b);return}}t.bindTexture(i.TEXTURE_2D,H.__webglTexture,i.TEXTURE0+b)}function W(L,b){const H=n.get(L);if(L.version>0&&H.__version!==L.version){V(H,L,b);return}t.bindTexture(i.TEXTURE_2D_ARRAY,H.__webglTexture,i.TEXTURE0+b)}function te(L,b){const H=n.get(L);if(L.version>0&&H.__version!==L.version){V(H,L,b);return}t.bindTexture(i.TEXTURE_3D,H.__webglTexture,i.TEXTURE0+b)}function X(L,b){const H=n.get(L);if(L.version>0&&H.__version!==L.version){J(H,L,b);return}t.bindTexture(i.TEXTURE_CUBE_MAP,H.__webglTexture,i.TEXTURE0+b)}const de={[gr]:i.REPEAT,[Wn]:i.CLAMP_TO_EDGE,[ma]:i.MIRRORED_REPEAT},ve={[Qt]:i.NEAREST,[ff]:i.NEAREST_MIPMAP_NEAREST,[hr]:i.NEAREST_MIPMAP_LINEAR,[Vt]:i.LINEAR,[na]:i.LINEAR_MIPMAP_NEAREST,[ni]:i.LINEAR_MIPMAP_LINEAR},ge={[Zp]:i.NEVER,[Qp]:i.ALWAYS,[qp]:i.LESS,[bf]:i.LEQUAL,[$p]:i.EQUAL,[jp]:i.GEQUAL,[Kp]:i.GREATER,[Jp]:i.NOTEQUAL};function Xe(L,b){if(b.type===Cn&&e.has("OES_texture_float_linear")===!1&&(b.magFilter===Vt||b.magFilter===na||b.magFilter===hr||b.magFilter===ni||b.minFilter===Vt||b.minFilter===na||b.minFilter===hr||b.minFilter===ni)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(L,i.TEXTURE_WRAP_S,de[b.wrapS]),i.texParameteri(L,i.TEXTURE_WRAP_T,de[b.wrapT]),(L===i.TEXTURE_3D||L===i.TEXTURE_2D_ARRAY)&&i.texParameteri(L,i.TEXTURE_WRAP_R,de[b.wrapR]),i.texParameteri(L,i.TEXTURE_MAG_FILTER,ve[b.magFilter]),i.texParameteri(L,i.TEXTURE_MIN_FILTER,ve[b.minFilter]),b.compareFunction&&(i.texParameteri(L,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(L,i.TEXTURE_COMPARE_FUNC,ge[b.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(b.magFilter===Qt||b.minFilter!==hr&&b.minFilter!==ni||b.type===Cn&&e.has("OES_texture_float_linear")===!1)return;if(b.anisotropy>1||n.get(b).__currentAnisotropy){const H=e.get("EXT_texture_filter_anisotropic");i.texParameterf(L,H.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(b.anisotropy,s.getMaxAnisotropy())),n.get(b).__currentAnisotropy=b.anisotropy}}}function ie(L,b){let H=!1;L.__webglInit===void 0&&(L.__webglInit=!0,b.addEventListener("dispose",T));const Q=b.source;let ae=p.get(Q);ae===void 0&&(ae={},p.set(Q,ae));const ee=G(b);if(ee!==L.__cacheKey){ae[ee]===void 0&&(ae[ee]={texture:i.createTexture(),usedTimes:0},a.memory.textures++,H=!0),ae[ee].usedTimes++;const Ne=ae[L.__cacheKey];Ne!==void 0&&(ae[L.__cacheKey].usedTimes--,Ne.usedTimes===0&&S(b)),L.__cacheKey=ee,L.__webglTexture=ae[ee].texture}return H}function V(L,b,H){let Q=i.TEXTURE_2D;(b.isDataArrayTexture||b.isCompressedArrayTexture)&&(Q=i.TEXTURE_2D_ARRAY),b.isData3DTexture&&(Q=i.TEXTURE_3D);const ae=ie(L,b),ee=b.source;t.bindTexture(Q,L.__webglTexture,i.TEXTURE0+H);const Ne=n.get(ee);if(ee.version!==Ne.__version||ae===!0){t.activeTexture(i.TEXTURE0+H);const be=ct.getPrimaries(ct.workingColorSpace),j=b.colorSpace===Gn?null:ct.getPrimaries(b.colorSpace),$e=b.colorSpace===Gn||be===j?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,b.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,b.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,b.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,$e);let ce=y(b.image,!1,s.maxTextureSize);ce=qe(b,ce);const Ee=r.convert(b.format,b.colorSpace),Je=r.convert(b.type);let je=x(b.internalFormat,Ee,Je,b.colorSpace,b.isVideoTexture);Xe(Q,b);let Ue;const ft=b.mipmaps,at=b.isVideoTexture!==!0,Ct=Ne.__version===void 0||ae===!0,N=ee.dataReady,we=E(b,ce);if(b.isDepthTexture)je=v(b.format===Ls,b.type),Ct&&(at?t.texStorage2D(i.TEXTURE_2D,1,je,ce.width,ce.height):t.texImage2D(i.TEXTURE_2D,0,je,ce.width,ce.height,0,Ee,Je,null));else if(b.isDataTexture)if(ft.length>0){at&&Ct&&t.texStorage2D(i.TEXTURE_2D,we,je,ft[0].width,ft[0].height);for(let K=0,se=ft.length;K<se;K++)Ue=ft[K],at?N&&t.texSubImage2D(i.TEXTURE_2D,K,0,0,Ue.width,Ue.height,Ee,Je,Ue.data):t.texImage2D(i.TEXTURE_2D,K,je,Ue.width,Ue.height,0,Ee,Je,Ue.data);b.generateMipmaps=!1}else at?(Ct&&t.texStorage2D(i.TEXTURE_2D,we,je,ce.width,ce.height),N&&t.texSubImage2D(i.TEXTURE_2D,0,0,0,ce.width,ce.height,Ee,Je,ce.data)):t.texImage2D(i.TEXTURE_2D,0,je,ce.width,ce.height,0,Ee,Je,ce.data);else if(b.isCompressedTexture)if(b.isCompressedArrayTexture){at&&Ct&&t.texStorage3D(i.TEXTURE_2D_ARRAY,we,je,ft[0].width,ft[0].height,ce.depth);for(let K=0,se=ft.length;K<se;K++)if(Ue=ft[K],b.format!==mn)if(Ee!==null)if(at){if(N)if(b.layerUpdates.size>0){const Ce=Kh(Ue.width,Ue.height,b.format,b.type);for(const Te of b.layerUpdates){const it=Ue.data.subarray(Te*Ce/Ue.data.BYTES_PER_ELEMENT,(Te+1)*Ce/Ue.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,K,0,0,Te,Ue.width,Ue.height,1,Ee,it)}b.clearLayerUpdates()}else t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,K,0,0,0,Ue.width,Ue.height,ce.depth,Ee,Ue.data)}else t.compressedTexImage3D(i.TEXTURE_2D_ARRAY,K,je,Ue.width,Ue.height,ce.depth,0,Ue.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else at?N&&t.texSubImage3D(i.TEXTURE_2D_ARRAY,K,0,0,0,Ue.width,Ue.height,ce.depth,Ee,Je,Ue.data):t.texImage3D(i.TEXTURE_2D_ARRAY,K,je,Ue.width,Ue.height,ce.depth,0,Ee,Je,Ue.data)}else{at&&Ct&&t.texStorage2D(i.TEXTURE_2D,we,je,ft[0].width,ft[0].height);for(let K=0,se=ft.length;K<se;K++)Ue=ft[K],b.format!==mn?Ee!==null?at?N&&t.compressedTexSubImage2D(i.TEXTURE_2D,K,0,0,Ue.width,Ue.height,Ee,Ue.data):t.compressedTexImage2D(i.TEXTURE_2D,K,je,Ue.width,Ue.height,0,Ue.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):at?N&&t.texSubImage2D(i.TEXTURE_2D,K,0,0,Ue.width,Ue.height,Ee,Je,Ue.data):t.texImage2D(i.TEXTURE_2D,K,je,Ue.width,Ue.height,0,Ee,Je,Ue.data)}else if(b.isDataArrayTexture)if(at){if(Ct&&t.texStorage3D(i.TEXTURE_2D_ARRAY,we,je,ce.width,ce.height,ce.depth),N)if(b.layerUpdates.size>0){const K=Kh(ce.width,ce.height,b.format,b.type);for(const se of b.layerUpdates){const Ce=ce.data.subarray(se*K/ce.data.BYTES_PER_ELEMENT,(se+1)*K/ce.data.BYTES_PER_ELEMENT);t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,se,ce.width,ce.height,1,Ee,Je,Ce)}b.clearLayerUpdates()}else t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,ce.width,ce.height,ce.depth,Ee,Je,ce.data)}else t.texImage3D(i.TEXTURE_2D_ARRAY,0,je,ce.width,ce.height,ce.depth,0,Ee,Je,ce.data);else if(b.isData3DTexture)at?(Ct&&t.texStorage3D(i.TEXTURE_3D,we,je,ce.width,ce.height,ce.depth),N&&t.texSubImage3D(i.TEXTURE_3D,0,0,0,0,ce.width,ce.height,ce.depth,Ee,Je,ce.data)):t.texImage3D(i.TEXTURE_3D,0,je,ce.width,ce.height,ce.depth,0,Ee,Je,ce.data);else if(b.isFramebufferTexture){if(Ct)if(at)t.texStorage2D(i.TEXTURE_2D,we,je,ce.width,ce.height);else{let K=ce.width,se=ce.height;for(let Ce=0;Ce<we;Ce++)t.texImage2D(i.TEXTURE_2D,Ce,je,K,se,0,Ee,Je,null),K>>=1,se>>=1}}else if(ft.length>0){if(at&&Ct){const K=Ie(ft[0]);t.texStorage2D(i.TEXTURE_2D,we,je,K.width,K.height)}for(let K=0,se=ft.length;K<se;K++)Ue=ft[K],at?N&&t.texSubImage2D(i.TEXTURE_2D,K,0,0,Ee,Je,Ue):t.texImage2D(i.TEXTURE_2D,K,je,Ee,Je,Ue);b.generateMipmaps=!1}else if(at){if(Ct){const K=Ie(ce);t.texStorage2D(i.TEXTURE_2D,we,je,K.width,K.height)}N&&t.texSubImage2D(i.TEXTURE_2D,0,0,0,Ee,Je,ce)}else t.texImage2D(i.TEXTURE_2D,0,je,Ee,Je,ce);d(b)&&m(Q),Ne.__version=ee.version,b.onUpdate&&b.onUpdate(b)}L.__version=b.version}function J(L,b,H){if(b.image.length!==6)return;const Q=ie(L,b),ae=b.source;t.bindTexture(i.TEXTURE_CUBE_MAP,L.__webglTexture,i.TEXTURE0+H);const ee=n.get(ae);if(ae.version!==ee.__version||Q===!0){t.activeTexture(i.TEXTURE0+H);const Ne=ct.getPrimaries(ct.workingColorSpace),be=b.colorSpace===Gn?null:ct.getPrimaries(b.colorSpace),j=b.colorSpace===Gn||Ne===be?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,b.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,b.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,b.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,j);const $e=b.isCompressedTexture||b.image[0].isCompressedTexture,ce=b.image[0]&&b.image[0].isDataTexture,Ee=[];for(let se=0;se<6;se++)!$e&&!ce?Ee[se]=y(b.image[se],!0,s.maxCubemapSize):Ee[se]=ce?b.image[se].image:b.image[se],Ee[se]=qe(b,Ee[se]);const Je=Ee[0],je=r.convert(b.format,b.colorSpace),Ue=r.convert(b.type),ft=x(b.internalFormat,je,Ue,b.colorSpace),at=b.isVideoTexture!==!0,Ct=ee.__version===void 0||Q===!0,N=ae.dataReady;let we=E(b,Je);Xe(i.TEXTURE_CUBE_MAP,b);let K;if($e){at&&Ct&&t.texStorage2D(i.TEXTURE_CUBE_MAP,we,ft,Je.width,Je.height);for(let se=0;se<6;se++){K=Ee[se].mipmaps;for(let Ce=0;Ce<K.length;Ce++){const Te=K[Ce];b.format!==mn?je!==null?at?N&&t.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,Ce,0,0,Te.width,Te.height,je,Te.data):t.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,Ce,ft,Te.width,Te.height,0,Te.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):at?N&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,Ce,0,0,Te.width,Te.height,je,Ue,Te.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,Ce,ft,Te.width,Te.height,0,je,Ue,Te.data)}}}else{if(K=b.mipmaps,at&&Ct){K.length>0&&we++;const se=Ie(Ee[0]);t.texStorage2D(i.TEXTURE_CUBE_MAP,we,ft,se.width,se.height)}for(let se=0;se<6;se++)if(ce){at?N&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,0,0,0,Ee[se].width,Ee[se].height,je,Ue,Ee[se].data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,0,ft,Ee[se].width,Ee[se].height,0,je,Ue,Ee[se].data);for(let Ce=0;Ce<K.length;Ce++){const it=K[Ce].image[se].image;at?N&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,Ce+1,0,0,it.width,it.height,je,Ue,it.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,Ce+1,ft,it.width,it.height,0,je,Ue,it.data)}}else{at?N&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,0,0,0,je,Ue,Ee[se]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,0,ft,je,Ue,Ee[se]);for(let Ce=0;Ce<K.length;Ce++){const Te=K[Ce];at?N&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,Ce+1,0,0,je,Ue,Te.image[se]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,Ce+1,ft,je,Ue,Te.image[se])}}}d(b)&&m(i.TEXTURE_CUBE_MAP),ee.__version=ae.version,b.onUpdate&&b.onUpdate(b)}L.__version=b.version}function le(L,b,H,Q,ae,ee){const Ne=r.convert(H.format,H.colorSpace),be=r.convert(H.type),j=x(H.internalFormat,Ne,be,H.colorSpace),$e=n.get(b),ce=n.get(H);if(ce.__renderTarget=b,!$e.__hasExternalTextures){const Ee=Math.max(1,b.width>>ee),Je=Math.max(1,b.height>>ee);ae===i.TEXTURE_3D||ae===i.TEXTURE_2D_ARRAY?t.texImage3D(ae,ee,j,Ee,Je,b.depth,0,Ne,be,null):t.texImage2D(ae,ee,j,Ee,Je,0,Ne,be,null)}t.bindFramebuffer(i.FRAMEBUFFER,L),Pe(b)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,Q,ae,ce.__webglTexture,0,he(b)):(ae===i.TEXTURE_2D||ae>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&ae<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,Q,ae,ce.__webglTexture,ee),t.bindFramebuffer(i.FRAMEBUFFER,null)}function oe(L,b,H){if(i.bindRenderbuffer(i.RENDERBUFFER,L),b.depthBuffer){const Q=b.depthTexture,ae=Q&&Q.isDepthTexture?Q.type:null,ee=v(b.stencilBuffer,ae),Ne=b.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,be=he(b);Pe(b)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,be,ee,b.width,b.height):H?i.renderbufferStorageMultisample(i.RENDERBUFFER,be,ee,b.width,b.height):i.renderbufferStorage(i.RENDERBUFFER,ee,b.width,b.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,Ne,i.RENDERBUFFER,L)}else{const Q=b.textures;for(let ae=0;ae<Q.length;ae++){const ee=Q[ae],Ne=r.convert(ee.format,ee.colorSpace),be=r.convert(ee.type),j=x(ee.internalFormat,Ne,be,ee.colorSpace),$e=he(b);H&&Pe(b)===!1?i.renderbufferStorageMultisample(i.RENDERBUFFER,$e,j,b.width,b.height):Pe(b)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,$e,j,b.width,b.height):i.renderbufferStorage(i.RENDERBUFFER,j,b.width,b.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Le(L,b){if(b&&b.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(i.FRAMEBUFFER,L),!(b.depthTexture&&b.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const Q=n.get(b.depthTexture);Q.__renderTarget=b,(!Q.__webglTexture||b.depthTexture.image.width!==b.width||b.depthTexture.image.height!==b.height)&&(b.depthTexture.image.width=b.width,b.depthTexture.image.height=b.height,b.depthTexture.needsUpdate=!0),Y(b.depthTexture,0);const ae=Q.__webglTexture,ee=he(b);if(b.depthTexture.format===Cs)Pe(b)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,ae,0,ee):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,ae,0);else if(b.depthTexture.format===Ls)Pe(b)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,ae,0,ee):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,ae,0);else throw new Error("Unknown depthTexture format")}function Oe(L){const b=n.get(L),H=L.isWebGLCubeRenderTarget===!0;if(b.__boundDepthTexture!==L.depthTexture){const Q=L.depthTexture;if(b.__depthDisposeCallback&&b.__depthDisposeCallback(),Q){const ae=()=>{delete b.__boundDepthTexture,delete b.__depthDisposeCallback,Q.removeEventListener("dispose",ae)};Q.addEventListener("dispose",ae),b.__depthDisposeCallback=ae}b.__boundDepthTexture=Q}if(L.depthTexture&&!b.__autoAllocateDepthBuffer){if(H)throw new Error("target.depthTexture not supported in Cube render targets");Le(b.__webglFramebuffer,L)}else if(H){b.__webglDepthbuffer=[];for(let Q=0;Q<6;Q++)if(t.bindFramebuffer(i.FRAMEBUFFER,b.__webglFramebuffer[Q]),b.__webglDepthbuffer[Q]===void 0)b.__webglDepthbuffer[Q]=i.createRenderbuffer(),oe(b.__webglDepthbuffer[Q],L,!1);else{const ae=L.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ee=b.__webglDepthbuffer[Q];i.bindRenderbuffer(i.RENDERBUFFER,ee),i.framebufferRenderbuffer(i.FRAMEBUFFER,ae,i.RENDERBUFFER,ee)}}else if(t.bindFramebuffer(i.FRAMEBUFFER,b.__webglFramebuffer),b.__webglDepthbuffer===void 0)b.__webglDepthbuffer=i.createRenderbuffer(),oe(b.__webglDepthbuffer,L,!1);else{const Q=L.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ae=b.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,ae),i.framebufferRenderbuffer(i.FRAMEBUFFER,Q,i.RENDERBUFFER,ae)}t.bindFramebuffer(i.FRAMEBUFFER,null)}function Ge(L,b,H){const Q=n.get(L);b!==void 0&&le(Q.__webglFramebuffer,L,L.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),H!==void 0&&Oe(L)}function Ke(L){const b=L.texture,H=n.get(L),Q=n.get(b);L.addEventListener("dispose",R);const ae=L.textures,ee=L.isWebGLCubeRenderTarget===!0,Ne=ae.length>1;if(Ne||(Q.__webglTexture===void 0&&(Q.__webglTexture=i.createTexture()),Q.__version=b.version,a.memory.textures++),ee){H.__webglFramebuffer=[];for(let be=0;be<6;be++)if(b.mipmaps&&b.mipmaps.length>0){H.__webglFramebuffer[be]=[];for(let j=0;j<b.mipmaps.length;j++)H.__webglFramebuffer[be][j]=i.createFramebuffer()}else H.__webglFramebuffer[be]=i.createFramebuffer()}else{if(b.mipmaps&&b.mipmaps.length>0){H.__webglFramebuffer=[];for(let be=0;be<b.mipmaps.length;be++)H.__webglFramebuffer[be]=i.createFramebuffer()}else H.__webglFramebuffer=i.createFramebuffer();if(Ne)for(let be=0,j=ae.length;be<j;be++){const $e=n.get(ae[be]);$e.__webglTexture===void 0&&($e.__webglTexture=i.createTexture(),a.memory.textures++)}if(L.samples>0&&Pe(L)===!1){H.__webglMultisampledFramebuffer=i.createFramebuffer(),H.__webglColorRenderbuffer=[],t.bindFramebuffer(i.FRAMEBUFFER,H.__webglMultisampledFramebuffer);for(let be=0;be<ae.length;be++){const j=ae[be];H.__webglColorRenderbuffer[be]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,H.__webglColorRenderbuffer[be]);const $e=r.convert(j.format,j.colorSpace),ce=r.convert(j.type),Ee=x(j.internalFormat,$e,ce,j.colorSpace,L.isXRRenderTarget===!0),Je=he(L);i.renderbufferStorageMultisample(i.RENDERBUFFER,Je,Ee,L.width,L.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+be,i.RENDERBUFFER,H.__webglColorRenderbuffer[be])}i.bindRenderbuffer(i.RENDERBUFFER,null),L.depthBuffer&&(H.__webglDepthRenderbuffer=i.createRenderbuffer(),oe(H.__webglDepthRenderbuffer,L,!0)),t.bindFramebuffer(i.FRAMEBUFFER,null)}}if(ee){t.bindTexture(i.TEXTURE_CUBE_MAP,Q.__webglTexture),Xe(i.TEXTURE_CUBE_MAP,b);for(let be=0;be<6;be++)if(b.mipmaps&&b.mipmaps.length>0)for(let j=0;j<b.mipmaps.length;j++)le(H.__webglFramebuffer[be][j],L,b,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+be,j);else le(H.__webglFramebuffer[be],L,b,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+be,0);d(b)&&m(i.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(Ne){for(let be=0,j=ae.length;be<j;be++){const $e=ae[be],ce=n.get($e);t.bindTexture(i.TEXTURE_2D,ce.__webglTexture),Xe(i.TEXTURE_2D,$e),le(H.__webglFramebuffer,L,$e,i.COLOR_ATTACHMENT0+be,i.TEXTURE_2D,0),d($e)&&m(i.TEXTURE_2D)}t.unbindTexture()}else{let be=i.TEXTURE_2D;if((L.isWebGL3DRenderTarget||L.isWebGLArrayRenderTarget)&&(be=L.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(be,Q.__webglTexture),Xe(be,b),b.mipmaps&&b.mipmaps.length>0)for(let j=0;j<b.mipmaps.length;j++)le(H.__webglFramebuffer[j],L,b,i.COLOR_ATTACHMENT0,be,j);else le(H.__webglFramebuffer,L,b,i.COLOR_ATTACHMENT0,be,0);d(b)&&m(be),t.unbindTexture()}L.depthBuffer&&Oe(L)}function ne(L){const b=L.textures;for(let H=0,Q=b.length;H<Q;H++){const ae=b[H];if(d(ae)){const ee=_(L),Ne=n.get(ae).__webglTexture;t.bindTexture(ee,Ne),m(ee),t.unbindTexture()}}}const ue=[],z=[];function Fe(L){if(L.samples>0){if(Pe(L)===!1){const b=L.textures,H=L.width,Q=L.height;let ae=i.COLOR_BUFFER_BIT;const ee=L.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,Ne=n.get(L),be=b.length>1;if(be)for(let j=0;j<b.length;j++)t.bindFramebuffer(i.FRAMEBUFFER,Ne.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+j,i.RENDERBUFFER,null),t.bindFramebuffer(i.FRAMEBUFFER,Ne.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+j,i.TEXTURE_2D,null,0);t.bindFramebuffer(i.READ_FRAMEBUFFER,Ne.__webglMultisampledFramebuffer),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,Ne.__webglFramebuffer);for(let j=0;j<b.length;j++){if(L.resolveDepthBuffer&&(L.depthBuffer&&(ae|=i.DEPTH_BUFFER_BIT),L.stencilBuffer&&L.resolveStencilBuffer&&(ae|=i.STENCIL_BUFFER_BIT)),be){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,Ne.__webglColorRenderbuffer[j]);const $e=n.get(b[j]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,$e,0)}i.blitFramebuffer(0,0,H,Q,0,0,H,Q,ae,i.NEAREST),l===!0&&(ue.length=0,z.length=0,ue.push(i.COLOR_ATTACHMENT0+j),L.depthBuffer&&L.resolveDepthBuffer===!1&&(ue.push(ee),z.push(ee),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,z)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,ue))}if(t.bindFramebuffer(i.READ_FRAMEBUFFER,null),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),be)for(let j=0;j<b.length;j++){t.bindFramebuffer(i.FRAMEBUFFER,Ne.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+j,i.RENDERBUFFER,Ne.__webglColorRenderbuffer[j]);const $e=n.get(b[j]).__webglTexture;t.bindFramebuffer(i.FRAMEBUFFER,Ne.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+j,i.TEXTURE_2D,$e,0)}t.bindFramebuffer(i.DRAW_FRAMEBUFFER,Ne.__webglMultisampledFramebuffer)}else if(L.depthBuffer&&L.resolveDepthBuffer===!1&&l){const b=L.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[b])}}}function he(L){return Math.min(s.maxSamples,L.samples)}function Pe(L){const b=n.get(L);return L.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&b.__useRenderToTexture!==!1}function xe(L){const b=a.render.frame;h.get(L)!==b&&(h.set(L,b),L.update())}function qe(L,b){const H=L.colorSpace,Q=L.format,ae=L.type;return L.isCompressedTexture===!0||L.isVideoTexture===!0||H!==es&&H!==Gn&&(ct.getTransfer(H)===Mt?(Q!==mn||ae!==_i)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",H)),b}function Ie(L){return typeof HTMLImageElement<"u"&&L instanceof HTMLImageElement?(c.width=L.naturalWidth||L.width,c.height=L.naturalHeight||L.height):typeof VideoFrame<"u"&&L instanceof VideoFrame?(c.width=L.displayWidth,c.height=L.displayHeight):(c.width=L.width,c.height=L.height),c}this.allocateTextureUnit=B,this.resetTextureUnits=U,this.setTexture2D=Y,this.setTexture2DArray=W,this.setTexture3D=te,this.setTextureCube=X,this.rebindTextures=Ge,this.setupRenderTarget=Ke,this.updateRenderTargetMipmap=ne,this.updateMultisampleRenderTarget=Fe,this.setupDepthRenderbuffer=Oe,this.setupFrameBufferTexture=le,this.useMultisampledRTT=Pe}function p0(i,e){function t(n,s=Gn){let r;const a=ct.getTransfer(s);if(n===_i)return i.UNSIGNED_BYTE;if(n===Jl)return i.UNSIGNED_SHORT_4_4_4_4;if(n===jl)return i.UNSIGNED_SHORT_5_5_5_1;if(n===pf)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===uf)return i.BYTE;if(n===df)return i.SHORT;if(n===yr)return i.UNSIGNED_SHORT;if(n===Kl)return i.INT;if(n===Ni)return i.UNSIGNED_INT;if(n===Cn)return i.FLOAT;if(n===Yn)return i.HALF_FLOAT;if(n===mf)return i.ALPHA;if(n===gf)return i.RGB;if(n===mn)return i.RGBA;if(n===yf)return i.LUMINANCE;if(n===_f)return i.LUMINANCE_ALPHA;if(n===Cs)return i.DEPTH_COMPONENT;if(n===Ls)return i.DEPTH_STENCIL;if(n===Ql)return i.RED;if(n===La)return i.RED_INTEGER;if(n===xf)return i.RG;if(n===ec)return i.RG_INTEGER;if(n===tc)return i.RGBA_INTEGER;if(n===ia||n===sa||n===ra||n===aa)if(a===Mt)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===ia)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===sa)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===ra)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===aa)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===ia)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===sa)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===ra)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===aa)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===fl||n===ul||n===dl||n===pl)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===fl)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===ul)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===dl)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===pl)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===ml||n===gl||n===yl)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(n===ml||n===gl)return a===Mt?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===yl)return a===Mt?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(n===_l||n===xl||n===vl||n===Ml||n===bl||n===Sl||n===wl||n===Tl||n===Al||n===El||n===Cl||n===Rl||n===Pl||n===Il)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(n===_l)return a===Mt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===xl)return a===Mt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===vl)return a===Mt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===Ml)return a===Mt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===bl)return a===Mt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Sl)return a===Mt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===wl)return a===Mt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===Tl)return a===Mt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===Al)return a===Mt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===El)return a===Mt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===Cl)return a===Mt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===Rl)return a===Mt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===Pl)return a===Mt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===Il)return a===Mt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===oa||n===Dl||n===Ll)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(n===oa)return a===Mt?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===Dl)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===Ll)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===vf||n===zl||n===Ul||n===Nl)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(n===oa)return r.COMPRESSED_RED_RGTC1_EXT;if(n===zl)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===Ul)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===Nl)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===Ds?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:t}}class m0 extends Jt{constructor(e=[]){super(),this.isArrayCamera=!0,this.cameras=e}}class di extends dt{constructor(){super(),this.isGroup=!0,this.type="Group"}}const Dv={type:"move"};class uh{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new di,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new di,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new w,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new w),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new di,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new w,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new w),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let s=null,r=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(const y of e.hand.values()){const d=t.getJointPose(y,n),m=this._getHandJoint(c,y);d!==null&&(m.matrix.fromArray(d.transform.matrix),m.matrix.decompose(m.position,m.rotation,m.scale),m.matrixWorldNeedsUpdate=!0,m.jointRadius=d.radius),m.visible=d!==null}const h=c.joints["index-finger-tip"],f=c.joints["thumb-tip"],p=h.position.distanceTo(f.position),u=.02,g=.005;c.inputState.pinching&&p>u+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&p<=u-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(s=t.getPose(e.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Dv)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const n=new di;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}}const Lv=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,zv=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class Uv{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t,n){if(this.texture===null){const s=new Ht,r=e.properties.get(s);r.__webglTexture=t.texture,(t.depthNear!=n.depthNear||t.depthFar!=n.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=s}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,n=new At({vertexShader:Lv,fragmentShader:zv,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new lt(new Ln(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class Nv extends vi{constructor(e,t){super();const n=this;let s=null,r=1,a=null,o="local-floor",l=1,c=null,h=null,f=null,p=null,u=null,g=null;const y=new Uv,d=t.getContextAttributes();let m=null,_=null;const x=[],v=[],E=new $;let T=null;const R=new Jt;R.viewport=new ot;const P=new Jt;P.viewport=new ot;const S=[R,P],M=new m0;let D=null,U=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(V){let J=x[V];return J===void 0&&(J=new uh,x[V]=J),J.getTargetRaySpace()},this.getControllerGrip=function(V){let J=x[V];return J===void 0&&(J=new uh,x[V]=J),J.getGripSpace()},this.getHand=function(V){let J=x[V];return J===void 0&&(J=new uh,x[V]=J),J.getHandSpace()};function B(V){const J=v.indexOf(V.inputSource);if(J===-1)return;const le=x[J];le!==void 0&&(le.update(V.inputSource,V.frame,c||a),le.dispatchEvent({type:V.type,data:V.inputSource}))}function G(){s.removeEventListener("select",B),s.removeEventListener("selectstart",B),s.removeEventListener("selectend",B),s.removeEventListener("squeeze",B),s.removeEventListener("squeezestart",B),s.removeEventListener("squeezeend",B),s.removeEventListener("end",G),s.removeEventListener("inputsourceschange",Y);for(let V=0;V<x.length;V++){const J=v[V];J!==null&&(v[V]=null,x[V].disconnect(J))}D=null,U=null,y.reset(),e.setRenderTarget(m),u=null,p=null,f=null,s=null,_=null,ie.stop(),n.isPresenting=!1,e.setPixelRatio(T),e.setSize(E.width,E.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(V){r=V,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(V){o=V,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(V){c=V},this.getBaseLayer=function(){return p!==null?p:u},this.getBinding=function(){return f},this.getFrame=function(){return g},this.getSession=function(){return s},this.setSession=async function(V){if(s=V,s!==null){if(m=e.getRenderTarget(),s.addEventListener("select",B),s.addEventListener("selectstart",B),s.addEventListener("selectend",B),s.addEventListener("squeeze",B),s.addEventListener("squeezestart",B),s.addEventListener("squeezeend",B),s.addEventListener("end",G),s.addEventListener("inputsourceschange",Y),d.xrCompatible!==!0&&await t.makeXRCompatible(),T=e.getPixelRatio(),e.getSize(E),s.renderState.layers===void 0){const J={antialias:d.antialias,alpha:!0,depth:d.depth,stencil:d.stencil,framebufferScaleFactor:r};u=new XRWebGLLayer(s,t,J),s.updateRenderState({baseLayer:u}),e.setPixelRatio(1),e.setSize(u.framebufferWidth,u.framebufferHeight,!1),_=new ln(u.framebufferWidth,u.framebufferHeight,{format:mn,type:_i,colorSpace:e.outputColorSpace,stencilBuffer:d.stencil})}else{let J=null,le=null,oe=null;d.depth&&(oe=d.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,J=d.stencil?Ls:Cs,le=d.stencil?Ds:Ni);const Le={colorFormat:t.RGBA8,depthFormat:oe,scaleFactor:r};f=new XRWebGLBinding(s,t),p=f.createProjectionLayer(Le),s.updateRenderState({layers:[p]}),e.setPixelRatio(1),e.setSize(p.textureWidth,p.textureHeight,!1),_=new ln(p.textureWidth,p.textureHeight,{format:mn,type:_i,depthTexture:new Cf(p.textureWidth,p.textureHeight,le,void 0,void 0,void 0,void 0,void 0,void 0,J),stencilBuffer:d.stencil,colorSpace:e.outputColorSpace,samples:d.antialias?4:0,resolveDepthBuffer:p.ignoreDepthValues===!1})}_.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await s.requestReferenceSpace(o),ie.setContext(s),ie.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return y.getDepthTexture()};function Y(V){for(let J=0;J<V.removed.length;J++){const le=V.removed[J],oe=v.indexOf(le);oe>=0&&(v[oe]=null,x[oe].disconnect(le))}for(let J=0;J<V.added.length;J++){const le=V.added[J];let oe=v.indexOf(le);if(oe===-1){for(let Oe=0;Oe<x.length;Oe++)if(Oe>=v.length){v.push(le),oe=Oe;break}else if(v[Oe]===null){v[Oe]=le,oe=Oe;break}if(oe===-1)break}const Le=x[oe];Le&&Le.connect(le)}}const W=new w,te=new w;function X(V,J,le){W.setFromMatrixPosition(J.matrixWorld),te.setFromMatrixPosition(le.matrixWorld);const oe=W.distanceTo(te),Le=J.projectionMatrix.elements,Oe=le.projectionMatrix.elements,Ge=Le[14]/(Le[10]-1),Ke=Le[14]/(Le[10]+1),ne=(Le[9]+1)/Le[5],ue=(Le[9]-1)/Le[5],z=(Le[8]-1)/Le[0],Fe=(Oe[8]+1)/Oe[0],he=Ge*z,Pe=Ge*Fe,xe=oe/(-z+Fe),qe=xe*-z;if(J.matrixWorld.decompose(V.position,V.quaternion,V.scale),V.translateX(qe),V.translateZ(xe),V.matrixWorld.compose(V.position,V.quaternion,V.scale),V.matrixWorldInverse.copy(V.matrixWorld).invert(),Le[10]===-1)V.projectionMatrix.copy(J.projectionMatrix),V.projectionMatrixInverse.copy(J.projectionMatrixInverse);else{const Ie=Ge+xe,L=Ke+xe,b=he-qe,H=Pe+(oe-qe),Q=ne*Ke/L*Ie,ae=ue*Ke/L*Ie;V.projectionMatrix.makePerspective(b,H,Q,ae,Ie,L),V.projectionMatrixInverse.copy(V.projectionMatrix).invert()}}function de(V,J){J===null?V.matrixWorld.copy(V.matrix):V.matrixWorld.multiplyMatrices(J.matrixWorld,V.matrix),V.matrixWorldInverse.copy(V.matrixWorld).invert()}this.updateCamera=function(V){if(s===null)return;let J=V.near,le=V.far;y.texture!==null&&(y.depthNear>0&&(J=y.depthNear),y.depthFar>0&&(le=y.depthFar)),M.near=P.near=R.near=J,M.far=P.far=R.far=le,(D!==M.near||U!==M.far)&&(s.updateRenderState({depthNear:M.near,depthFar:M.far}),D=M.near,U=M.far),R.layers.mask=V.layers.mask|2,P.layers.mask=V.layers.mask|4,M.layers.mask=R.layers.mask|P.layers.mask;const oe=V.parent,Le=M.cameras;de(M,oe);for(let Oe=0;Oe<Le.length;Oe++)de(Le[Oe],oe);Le.length===2?X(M,R,P):M.projectionMatrix.copy(R.projectionMatrix),ve(V,M,oe)};function ve(V,J,le){le===null?V.matrix.copy(J.matrixWorld):(V.matrix.copy(le.matrixWorld),V.matrix.invert(),V.matrix.multiply(J.matrixWorld)),V.matrix.decompose(V.position,V.quaternion,V.scale),V.updateMatrixWorld(!0),V.projectionMatrix.copy(J.projectionMatrix),V.projectionMatrixInverse.copy(J.projectionMatrixInverse),V.isPerspectiveCamera&&(V.fov=_r*2*Math.atan(1/V.projectionMatrix.elements[5]),V.zoom=1)}this.getCamera=function(){return M},this.getFoveation=function(){if(!(p===null&&u===null))return l},this.setFoveation=function(V){l=V,p!==null&&(p.fixedFoveation=V),u!==null&&u.fixedFoveation!==void 0&&(u.fixedFoveation=V)},this.hasDepthSensing=function(){return y.texture!==null},this.getDepthSensingMesh=function(){return y.getMesh(M)};let ge=null;function Xe(V,J){if(h=J.getViewerPose(c||a),g=J,h!==null){const le=h.views;u!==null&&(e.setRenderTargetFramebuffer(_,u.framebuffer),e.setRenderTarget(_));let oe=!1;le.length!==M.cameras.length&&(M.cameras.length=0,oe=!0);for(let Oe=0;Oe<le.length;Oe++){const Ge=le[Oe];let Ke=null;if(u!==null)Ke=u.getViewport(Ge);else{const ue=f.getViewSubImage(p,Ge);Ke=ue.viewport,Oe===0&&(e.setRenderTargetTextures(_,ue.colorTexture,p.ignoreDepthValues?void 0:ue.depthStencilTexture),e.setRenderTarget(_))}let ne=S[Oe];ne===void 0&&(ne=new Jt,ne.layers.enable(Oe),ne.viewport=new ot,S[Oe]=ne),ne.matrix.fromArray(Ge.transform.matrix),ne.matrix.decompose(ne.position,ne.quaternion,ne.scale),ne.projectionMatrix.fromArray(Ge.projectionMatrix),ne.projectionMatrixInverse.copy(ne.projectionMatrix).invert(),ne.viewport.set(Ke.x,Ke.y,Ke.width,Ke.height),Oe===0&&(M.matrix.copy(ne.matrix),M.matrix.decompose(M.position,M.quaternion,M.scale)),oe===!0&&M.cameras.push(ne)}const Le=s.enabledFeatures;if(Le&&Le.includes("depth-sensing")){const Oe=f.getDepthInformation(le[0]);Oe&&Oe.isValid&&Oe.texture&&y.init(e,Oe,s.renderState)}}for(let le=0;le<x.length;le++){const oe=v[le],Le=x[le];oe!==null&&Le!==void 0&&Le.update(oe,J,c||a)}ge&&ge(V,J),J.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:J}),g=null}const ie=new c0;ie.setAnimationLoop(Xe),this.setAnimationLoop=function(V){ge=V},this.dispose=function(){}}}const hs=new Mn,Ov=new Ye;function Fv(i,e){function t(d,m){d.matrixAutoUpdate===!0&&d.updateMatrix(),m.value.copy(d.matrix)}function n(d,m){m.color.getRGB(d.fogColor.value,a0(i)),m.isFog?(d.fogNear.value=m.near,d.fogFar.value=m.far):m.isFogExp2&&(d.fogDensity.value=m.density)}function s(d,m,_,x,v){m.isMeshBasicMaterial||m.isMeshLambertMaterial?r(d,m):m.isMeshToonMaterial?(r(d,m),f(d,m)):m.isMeshPhongMaterial?(r(d,m),h(d,m)):m.isMeshStandardMaterial?(r(d,m),p(d,m),m.isMeshPhysicalMaterial&&u(d,m,v)):m.isMeshMatcapMaterial?(r(d,m),g(d,m)):m.isMeshDepthMaterial?r(d,m):m.isMeshDistanceMaterial?(r(d,m),y(d,m)):m.isMeshNormalMaterial?r(d,m):m.isLineBasicMaterial?(a(d,m),m.isLineDashedMaterial&&o(d,m)):m.isPointsMaterial?l(d,m,_,x):m.isSpriteMaterial?c(d,m):m.isShadowMaterial?(d.color.value.copy(m.color),d.opacity.value=m.opacity):m.isShaderMaterial&&(m.uniformsNeedUpdate=!1)}function r(d,m){d.opacity.value=m.opacity,m.color&&d.diffuse.value.copy(m.color),m.emissive&&d.emissive.value.copy(m.emissive).multiplyScalar(m.emissiveIntensity),m.map&&(d.map.value=m.map,t(m.map,d.mapTransform)),m.alphaMap&&(d.alphaMap.value=m.alphaMap,t(m.alphaMap,d.alphaMapTransform)),m.bumpMap&&(d.bumpMap.value=m.bumpMap,t(m.bumpMap,d.bumpMapTransform),d.bumpScale.value=m.bumpScale,m.side===on&&(d.bumpScale.value*=-1)),m.normalMap&&(d.normalMap.value=m.normalMap,t(m.normalMap,d.normalMapTransform),d.normalScale.value.copy(m.normalScale),m.side===on&&d.normalScale.value.negate()),m.displacementMap&&(d.displacementMap.value=m.displacementMap,t(m.displacementMap,d.displacementMapTransform),d.displacementScale.value=m.displacementScale,d.displacementBias.value=m.displacementBias),m.emissiveMap&&(d.emissiveMap.value=m.emissiveMap,t(m.emissiveMap,d.emissiveMapTransform)),m.specularMap&&(d.specularMap.value=m.specularMap,t(m.specularMap,d.specularMapTransform)),m.alphaTest>0&&(d.alphaTest.value=m.alphaTest);const _=e.get(m),x=_.envMap,v=_.envMapRotation;x&&(d.envMap.value=x,hs.copy(v),hs.x*=-1,hs.y*=-1,hs.z*=-1,x.isCubeTexture&&x.isRenderTargetTexture===!1&&(hs.y*=-1,hs.z*=-1),d.envMapRotation.value.setFromMatrix4(Ov.makeRotationFromEuler(hs)),d.flipEnvMap.value=x.isCubeTexture&&x.isRenderTargetTexture===!1?-1:1,d.reflectivity.value=m.reflectivity,d.ior.value=m.ior,d.refractionRatio.value=m.refractionRatio),m.lightMap&&(d.lightMap.value=m.lightMap,d.lightMapIntensity.value=m.lightMapIntensity,t(m.lightMap,d.lightMapTransform)),m.aoMap&&(d.aoMap.value=m.aoMap,d.aoMapIntensity.value=m.aoMapIntensity,t(m.aoMap,d.aoMapTransform))}function a(d,m){d.diffuse.value.copy(m.color),d.opacity.value=m.opacity,m.map&&(d.map.value=m.map,t(m.map,d.mapTransform))}function o(d,m){d.dashSize.value=m.dashSize,d.totalSize.value=m.dashSize+m.gapSize,d.scale.value=m.scale}function l(d,m,_,x){d.diffuse.value.copy(m.color),d.opacity.value=m.opacity,d.size.value=m.size*_,d.scale.value=x*.5,m.map&&(d.map.value=m.map,t(m.map,d.uvTransform)),m.alphaMap&&(d.alphaMap.value=m.alphaMap,t(m.alphaMap,d.alphaMapTransform)),m.alphaTest>0&&(d.alphaTest.value=m.alphaTest)}function c(d,m){d.diffuse.value.copy(m.color),d.opacity.value=m.opacity,d.rotation.value=m.rotation,m.map&&(d.map.value=m.map,t(m.map,d.mapTransform)),m.alphaMap&&(d.alphaMap.value=m.alphaMap,t(m.alphaMap,d.alphaMapTransform)),m.alphaTest>0&&(d.alphaTest.value=m.alphaTest)}function h(d,m){d.specular.value.copy(m.specular),d.shininess.value=Math.max(m.shininess,1e-4)}function f(d,m){m.gradientMap&&(d.gradientMap.value=m.gradientMap)}function p(d,m){d.metalness.value=m.metalness,m.metalnessMap&&(d.metalnessMap.value=m.metalnessMap,t(m.metalnessMap,d.metalnessMapTransform)),d.roughness.value=m.roughness,m.roughnessMap&&(d.roughnessMap.value=m.roughnessMap,t(m.roughnessMap,d.roughnessMapTransform)),m.envMap&&(d.envMapIntensity.value=m.envMapIntensity)}function u(d,m,_){d.ior.value=m.ior,m.sheen>0&&(d.sheenColor.value.copy(m.sheenColor).multiplyScalar(m.sheen),d.sheenRoughness.value=m.sheenRoughness,m.sheenColorMap&&(d.sheenColorMap.value=m.sheenColorMap,t(m.sheenColorMap,d.sheenColorMapTransform)),m.sheenRoughnessMap&&(d.sheenRoughnessMap.value=m.sheenRoughnessMap,t(m.sheenRoughnessMap,d.sheenRoughnessMapTransform))),m.clearcoat>0&&(d.clearcoat.value=m.clearcoat,d.clearcoatRoughness.value=m.clearcoatRoughness,m.clearcoatMap&&(d.clearcoatMap.value=m.clearcoatMap,t(m.clearcoatMap,d.clearcoatMapTransform)),m.clearcoatRoughnessMap&&(d.clearcoatRoughnessMap.value=m.clearcoatRoughnessMap,t(m.clearcoatRoughnessMap,d.clearcoatRoughnessMapTransform)),m.clearcoatNormalMap&&(d.clearcoatNormalMap.value=m.clearcoatNormalMap,t(m.clearcoatNormalMap,d.clearcoatNormalMapTransform),d.clearcoatNormalScale.value.copy(m.clearcoatNormalScale),m.side===on&&d.clearcoatNormalScale.value.negate())),m.dispersion>0&&(d.dispersion.value=m.dispersion),m.iridescence>0&&(d.iridescence.value=m.iridescence,d.iridescenceIOR.value=m.iridescenceIOR,d.iridescenceThicknessMinimum.value=m.iridescenceThicknessRange[0],d.iridescenceThicknessMaximum.value=m.iridescenceThicknessRange[1],m.iridescenceMap&&(d.iridescenceMap.value=m.iridescenceMap,t(m.iridescenceMap,d.iridescenceMapTransform)),m.iridescenceThicknessMap&&(d.iridescenceThicknessMap.value=m.iridescenceThicknessMap,t(m.iridescenceThicknessMap,d.iridescenceThicknessMapTransform))),m.transmission>0&&(d.transmission.value=m.transmission,d.transmissionSamplerMap.value=_.texture,d.transmissionSamplerSize.value.set(_.width,_.height),m.transmissionMap&&(d.transmissionMap.value=m.transmissionMap,t(m.transmissionMap,d.transmissionMapTransform)),d.thickness.value=m.thickness,m.thicknessMap&&(d.thicknessMap.value=m.thicknessMap,t(m.thicknessMap,d.thicknessMapTransform)),d.attenuationDistance.value=m.attenuationDistance,d.attenuationColor.value.copy(m.attenuationColor)),m.anisotropy>0&&(d.anisotropyVector.value.set(m.anisotropy*Math.cos(m.anisotropyRotation),m.anisotropy*Math.sin(m.anisotropyRotation)),m.anisotropyMap&&(d.anisotropyMap.value=m.anisotropyMap,t(m.anisotropyMap,d.anisotropyMapTransform))),d.specularIntensity.value=m.specularIntensity,d.specularColor.value.copy(m.specularColor),m.specularColorMap&&(d.specularColorMap.value=m.specularColorMap,t(m.specularColorMap,d.specularColorMapTransform)),m.specularIntensityMap&&(d.specularIntensityMap.value=m.specularIntensityMap,t(m.specularIntensityMap,d.specularIntensityMapTransform))}function g(d,m){m.matcap&&(d.matcap.value=m.matcap)}function y(d,m){const _=e.get(m).light;d.referencePosition.value.setFromMatrixPosition(_.matrixWorld),d.nearDistance.value=_.shadow.camera.near,d.farDistance.value=_.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function Bv(i,e,t,n){let s={},r={},a=[];const o=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(_,x){const v=x.program;n.uniformBlockBinding(_,v)}function c(_,x){let v=s[_.id];v===void 0&&(g(_),v=h(_),s[_.id]=v,_.addEventListener("dispose",d));const E=x.program;n.updateUBOMapping(_,E);const T=e.render.frame;r[_.id]!==T&&(p(_),r[_.id]=T)}function h(_){const x=f();_.__bindingPointIndex=x;const v=i.createBuffer(),E=_.__size,T=_.usage;return i.bindBuffer(i.UNIFORM_BUFFER,v),i.bufferData(i.UNIFORM_BUFFER,E,T),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,x,v),v}function f(){for(let _=0;_<o;_++)if(a.indexOf(_)===-1)return a.push(_),_;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function p(_){const x=s[_.id],v=_.uniforms,E=_.__cache;i.bindBuffer(i.UNIFORM_BUFFER,x);for(let T=0,R=v.length;T<R;T++){const P=Array.isArray(v[T])?v[T]:[v[T]];for(let S=0,M=P.length;S<M;S++){const D=P[S];if(u(D,T,S,E)===!0){const U=D.__offset,B=Array.isArray(D.value)?D.value:[D.value];let G=0;for(let Y=0;Y<B.length;Y++){const W=B[Y],te=y(W);typeof W=="number"||typeof W=="boolean"?(D.__data[0]=W,i.bufferSubData(i.UNIFORM_BUFFER,U+G,D.__data)):W.isMatrix3?(D.__data[0]=W.elements[0],D.__data[1]=W.elements[1],D.__data[2]=W.elements[2],D.__data[3]=0,D.__data[4]=W.elements[3],D.__data[5]=W.elements[4],D.__data[6]=W.elements[5],D.__data[7]=0,D.__data[8]=W.elements[6],D.__data[9]=W.elements[7],D.__data[10]=W.elements[8],D.__data[11]=0):(W.toArray(D.__data,G),G+=te.storage/Float32Array.BYTES_PER_ELEMENT)}i.bufferSubData(i.UNIFORM_BUFFER,U,D.__data)}}}i.bindBuffer(i.UNIFORM_BUFFER,null)}function u(_,x,v,E){const T=_.value,R=x+"_"+v;if(E[R]===void 0)return typeof T=="number"||typeof T=="boolean"?E[R]=T:E[R]=T.clone(),!0;{const P=E[R];if(typeof T=="number"||typeof T=="boolean"){if(P!==T)return E[R]=T,!0}else if(P.equals(T)===!1)return P.copy(T),!0}return!1}function g(_){const x=_.uniforms;let v=0;const E=16;for(let R=0,P=x.length;R<P;R++){const S=Array.isArray(x[R])?x[R]:[x[R]];for(let M=0,D=S.length;M<D;M++){const U=S[M],B=Array.isArray(U.value)?U.value:[U.value];for(let G=0,Y=B.length;G<Y;G++){const W=B[G],te=y(W),X=v%E,de=X%te.boundary,ve=X+de;v+=de,ve!==0&&E-ve<te.storage&&(v+=E-ve),U.__data=new Float32Array(te.storage/Float32Array.BYTES_PER_ELEMENT),U.__offset=v,v+=te.storage}}}const T=v%E;return T>0&&(v+=E-T),_.__size=v,_.__cache={},this}function y(_){const x={boundary:0,storage:0};return typeof _=="number"||typeof _=="boolean"?(x.boundary=4,x.storage=4):_.isVector2?(x.boundary=8,x.storage=8):_.isVector3||_.isColor?(x.boundary=16,x.storage=12):_.isVector4?(x.boundary=16,x.storage=16):_.isMatrix3?(x.boundary=48,x.storage=48):_.isMatrix4?(x.boundary=64,x.storage=64):_.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",_),x}function d(_){const x=_.target;x.removeEventListener("dispose",d);const v=a.indexOf(x.__bindingPointIndex);a.splice(v,1),i.deleteBuffer(s[x.id]),delete s[x.id],delete r[x.id]}function m(){for(const _ in s)i.deleteBuffer(s[_]);a=[],s={},r={}}return{bind:l,update:c,dispose:m}}class g0{constructor(e={}){const{canvas:t=n0(),context:n=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:f=!1,reverseDepthBuffer:p=!1}=e;this.isWebGLRenderer=!0;let u;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");u=n.getContextAttributes().alpha}else u=a;const g=new Uint32Array(4),y=new Int32Array(4);let d=null,m=null;const _=[],x=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=Dt,this.toneMapping=mi,this.toneMappingExposure=1;const v=this;let E=!1,T=0,R=0,P=null,S=-1,M=null;const D=new ot,U=new ot;let B=null;const G=new re(0);let Y=0,W=t.width,te=t.height,X=1,de=null,ve=null;const ge=new ot(0,0,W,te),Xe=new ot(0,0,W,te);let ie=!1;const V=new Na;let J=!1,le=!1;const oe=new Ye,Le=new Ye,Oe=new w,Ge=new ot,Ke={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let ne=!1;function ue(){return P===null?X:1}let z=n;function Fe(A,O){return t.getContext(A,O)}try{const A={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:f};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${ql}`),t.addEventListener("webglcontextlost",se,!1),t.addEventListener("webglcontextrestored",Ce,!1),t.addEventListener("webglcontextcreationerror",Te,!1),z===null){const O="webgl2";if(z=Fe(O,A),z===null)throw Fe(O)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(A){throw console.error("THREE.WebGLRenderer: "+A.message),A}let he,Pe,xe,qe,Ie,L,b,H,Q,ae,ee,Ne,be,j,$e,ce,Ee,Je,je,Ue,ft,at,Ct,N;function we(){he=new X_(z),he.init(),at=new p0(z,he),Pe=new B_(z,he,e,at),xe=new Tv(z,he),Pe.reverseDepthBuffer&&p&&xe.buffers.depth.setReversed(!0),qe=new q_(z),Ie=new uv,L=new Iv(z,he,xe,Ie,Pe,at,qe),b=new V_(v),H=new W_(v),Q=new ty(z),Ct=new O_(z,Q),ae=new Y_(z,Q,qe,Ct),ee=new K_(z,ae,Q,qe),je=new $_(z,Pe,L),ce=new k_(Ie),Ne=new fv(v,b,H,he,Pe,Ct,ce),be=new Fv(v,Ie),j=new pv,$e=new vv(he),Je=new N_(v,b,H,xe,ee,u,l),Ee=new Sv(v,ee,Pe),N=new Bv(z,qe,Pe,xe),Ue=new F_(z,he,qe),ft=new Z_(z,he,qe),qe.programs=Ne.programs,v.capabilities=Pe,v.extensions=he,v.properties=Ie,v.renderLists=j,v.shadowMap=Ee,v.state=xe,v.info=qe}we();const K=new Nv(v,z);this.xr=K,this.getContext=function(){return z},this.getContextAttributes=function(){return z.getContextAttributes()},this.forceContextLoss=function(){const A=he.get("WEBGL_lose_context");A&&A.loseContext()},this.forceContextRestore=function(){const A=he.get("WEBGL_lose_context");A&&A.restoreContext()},this.getPixelRatio=function(){return X},this.setPixelRatio=function(A){A!==void 0&&(X=A,this.setSize(W,te,!1))},this.getSize=function(A){return A.set(W,te)},this.setSize=function(A,O,Z=!0){if(K.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}W=A,te=O,t.width=Math.floor(A*X),t.height=Math.floor(O*X),Z===!0&&(t.style.width=A+"px",t.style.height=O+"px"),this.setViewport(0,0,A,O)},this.getDrawingBufferSize=function(A){return A.set(W*X,te*X).floor()},this.setDrawingBufferSize=function(A,O,Z){W=A,te=O,X=Z,t.width=Math.floor(A*Z),t.height=Math.floor(O*Z),this.setViewport(0,0,A,O)},this.getCurrentViewport=function(A){return A.copy(D)},this.getViewport=function(A){return A.copy(ge)},this.setViewport=function(A,O,Z,q){A.isVector4?ge.set(A.x,A.y,A.z,A.w):ge.set(A,O,Z,q),xe.viewport(D.copy(ge).multiplyScalar(X).round())},this.getScissor=function(A){return A.copy(Xe)},this.setScissor=function(A,O,Z,q){A.isVector4?Xe.set(A.x,A.y,A.z,A.w):Xe.set(A,O,Z,q),xe.scissor(U.copy(Xe).multiplyScalar(X).round())},this.getScissorTest=function(){return ie},this.setScissorTest=function(A){xe.setScissorTest(ie=A)},this.setOpaqueSort=function(A){de=A},this.setTransparentSort=function(A){ve=A},this.getClearColor=function(A){return A.copy(Je.getClearColor())},this.setClearColor=function(){Je.setClearColor.apply(Je,arguments)},this.getClearAlpha=function(){return Je.getClearAlpha()},this.setClearAlpha=function(){Je.setClearAlpha.apply(Je,arguments)},this.clear=function(A=!0,O=!0,Z=!0){let q=0;if(A){let F=!1;if(P!==null){const _e=P.texture.format;F=_e===tc||_e===ec||_e===La}if(F){const _e=P.texture.type,Ae=_e===_i||_e===Ni||_e===yr||_e===Ds||_e===Jl||_e===jl,Be=Je.getClearColor(),ke=Je.getClearAlpha(),Qe=Be.r,st=Be.g,Ve=Be.b;Ae?(g[0]=Qe,g[1]=st,g[2]=Ve,g[3]=ke,z.clearBufferuiv(z.COLOR,0,g)):(y[0]=Qe,y[1]=st,y[2]=Ve,y[3]=ke,z.clearBufferiv(z.COLOR,0,y))}else q|=z.COLOR_BUFFER_BIT}O&&(q|=z.DEPTH_BUFFER_BIT),Z&&(q|=z.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),z.clear(q)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",se,!1),t.removeEventListener("webglcontextrestored",Ce,!1),t.removeEventListener("webglcontextcreationerror",Te,!1),j.dispose(),$e.dispose(),Ie.dispose(),b.dispose(),H.dispose(),ee.dispose(),Ct.dispose(),N.dispose(),Ne.dispose(),K.dispose(),K.removeEventListener("sessionstart",uu),K.removeEventListener("sessionend",du),ss.stop()};function se(A){A.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),E=!0}function Ce(){console.log("THREE.WebGLRenderer: Context Restored."),E=!1;const A=qe.autoReset,O=Ee.enabled,Z=Ee.autoUpdate,q=Ee.needsUpdate,F=Ee.type;we(),qe.autoReset=A,Ee.enabled=O,Ee.autoUpdate=Z,Ee.needsUpdate=q,Ee.type=F}function Te(A){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",A.statusMessage)}function it(A){const O=A.target;O.removeEventListener("dispose",it),Ot(O)}function Ot(A){cn(A),Ie.remove(A)}function cn(A){const O=Ie.get(A).programs;O!==void 0&&(O.forEach(function(Z){Ne.releaseProgram(Z)}),A.isShaderMaterial&&Ne.releaseShaderCache(A))}this.renderBufferDirect=function(A,O,Z,q,F,_e){O===null&&(O=Ke);const Ae=F.isMesh&&F.matrixWorld.determinant()<0,Be=wm(A,O,Z,q,F);xe.setMaterial(q,Ae);let ke=Z.index,Qe=1;if(q.wireframe===!0){if(ke=ae.getWireframeAttribute(Z),ke===void 0)return;Qe=2}const st=Z.drawRange,Ve=Z.attributes.position;let mt=st.start*Qe,Rt=(st.start+st.count)*Qe;_e!==null&&(mt=Math.max(mt,_e.start*Qe),Rt=Math.min(Rt,(_e.start+_e.count)*Qe)),ke!==null?(mt=Math.max(mt,0),Rt=Math.min(Rt,ke.count)):Ve!=null&&(mt=Math.max(mt,0),Rt=Math.min(Rt,Ve.count));const Pt=Rt-mt;if(Pt<0||Pt===1/0)return;Ct.setup(F,q,Be,Z,ke);let Sn,yt=Ue;if(ke!==null&&(Sn=Q.get(ke),yt=ft,yt.setIndex(Sn)),F.isMesh)q.wireframe===!0?(xe.setLineWidth(q.wireframeLinewidth*ue()),yt.setMode(z.LINES)):yt.setMode(z.TRIANGLES);else if(F.isLine){let He=q.linewidth;He===void 0&&(He=1),xe.setLineWidth(He*ue()),F.isLineSegments?yt.setMode(z.LINES):F.isLineLoop?yt.setMode(z.LINE_LOOP):yt.setMode(z.LINE_STRIP)}else F.isPoints?yt.setMode(z.POINTS):F.isSprite&&yt.setMode(z.TRIANGLES);if(F.isBatchedMesh)if(F._multiDrawInstances!==null)yt.renderMultiDrawInstances(F._multiDrawStarts,F._multiDrawCounts,F._multiDrawCount,F._multiDrawInstances);else if(he.get("WEBGL_multi_draw"))yt.renderMultiDraw(F._multiDrawStarts,F._multiDrawCounts,F._multiDrawCount);else{const He=F._multiDrawStarts,Si=F._multiDrawCounts,_t=F._multiDrawCount,Kn=ke?Q.get(ke).bytesPerElement:1,Xs=Ie.get(q).currentProgram.getUniforms();for(let Un=0;Un<_t;Un++)Xs.setValue(z,"_gl_DrawID",Un),yt.render(He[Un]/Kn,Si[Un])}else if(F.isInstancedMesh)yt.renderInstances(mt,Pt,F.count);else if(Z.isInstancedBufferGeometry){const He=Z._maxInstanceCount!==void 0?Z._maxInstanceCount:1/0,Si=Math.min(Z.instanceCount,He);yt.renderInstances(mt,Pt,Si)}else yt.render(mt,Pt)};function xt(A,O,Z){A.transparent===!0&&A.side===St&&A.forceSinglePass===!1?(A.side=on,A.needsUpdate=!0,Ka(A,O,Z),A.side=Pn,A.needsUpdate=!0,Ka(A,O,Z),A.side=St):Ka(A,O,Z)}this.compile=function(A,O,Z=null){Z===null&&(Z=A),m=$e.get(Z),m.init(O),x.push(m),Z.traverseVisible(function(F){F.isLight&&F.layers.test(O.layers)&&(m.pushLight(F),F.castShadow&&m.pushShadow(F))}),A!==Z&&A.traverseVisible(function(F){F.isLight&&F.layers.test(O.layers)&&(m.pushLight(F),F.castShadow&&m.pushShadow(F))}),m.setupLights();const q=new Set;return A.traverse(function(F){if(!(F.isMesh||F.isPoints||F.isLine||F.isSprite))return;const _e=F.material;if(_e)if(Array.isArray(_e))for(let Ae=0;Ae<_e.length;Ae++){const Be=_e[Ae];xt(Be,Z,F),q.add(Be)}else xt(_e,Z,F),q.add(_e)}),x.pop(),m=null,q},this.compileAsync=function(A,O,Z=null){const q=this.compile(A,O,Z);return new Promise(F=>{function _e(){if(q.forEach(function(Ae){Ie.get(Ae).currentProgram.isReady()&&q.delete(Ae)}),q.size===0){F(A);return}setTimeout(_e,10)}he.get("KHR_parallel_shader_compile")!==null?_e():setTimeout(_e,10)})};let $n=null;function bi(A){$n&&$n(A)}function uu(){ss.stop()}function du(){ss.start()}const ss=new c0;ss.setAnimationLoop(bi),typeof self<"u"&&ss.setContext(self),this.setAnimationLoop=function(A){$n=A,K.setAnimationLoop(A),A===null?ss.stop():ss.start()},K.addEventListener("sessionstart",uu),K.addEventListener("sessionend",du),this.render=function(A,O){if(O!==void 0&&O.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(E===!0)return;if(A.matrixWorldAutoUpdate===!0&&A.updateMatrixWorld(),O.parent===null&&O.matrixWorldAutoUpdate===!0&&O.updateMatrixWorld(),K.enabled===!0&&K.isPresenting===!0&&(K.cameraAutoUpdate===!0&&K.updateCamera(O),O=K.getCamera()),A.isScene===!0&&A.onBeforeRender(v,A,O,P),m=$e.get(A,x.length),m.init(O),x.push(m),Le.multiplyMatrices(O.projectionMatrix,O.matrixWorldInverse),V.setFromProjectionMatrix(Le),le=this.localClippingEnabled,J=ce.init(this.clippingPlanes,le),d=j.get(A,_.length),d.init(),_.push(d),K.enabled===!0&&K.isPresenting===!0){const _e=v.xr.getDepthSensingMesh();_e!==null&&Bc(_e,O,-1/0,v.sortObjects)}Bc(A,O,0,v.sortObjects),d.finish(),v.sortObjects===!0&&d.sort(de,ve),ne=K.enabled===!1||K.isPresenting===!1||K.hasDepthSensing()===!1,ne&&Je.addToRenderList(d,A),this.info.render.frame++,J===!0&&ce.beginShadows();const Z=m.state.shadowsArray;Ee.render(Z,A,O),J===!0&&ce.endShadows(),this.info.autoReset===!0&&this.info.reset();const q=d.opaque,F=d.transmissive;if(m.setupLights(),O.isArrayCamera){const _e=O.cameras;if(F.length>0)for(let Ae=0,Be=_e.length;Ae<Be;Ae++){const ke=_e[Ae];mu(q,F,A,ke)}ne&&Je.render(A);for(let Ae=0,Be=_e.length;Ae<Be;Ae++){const ke=_e[Ae];pu(d,A,ke,ke.viewport)}}else F.length>0&&mu(q,F,A,O),ne&&Je.render(A),pu(d,A,O);P!==null&&(L.updateMultisampleRenderTarget(P),L.updateRenderTargetMipmap(P)),A.isScene===!0&&A.onAfterRender(v,A,O),Ct.resetDefaultState(),S=-1,M=null,x.pop(),x.length>0?(m=x[x.length-1],J===!0&&ce.setGlobalState(v.clippingPlanes,m.state.camera)):m=null,_.pop(),_.length>0?d=_[_.length-1]:d=null};function Bc(A,O,Z,q){if(A.visible===!1)return;if(A.layers.test(O.layers)){if(A.isGroup)Z=A.renderOrder;else if(A.isLOD)A.autoUpdate===!0&&A.update(O);else if(A.isLight)m.pushLight(A),A.castShadow&&m.pushShadow(A);else if(A.isSprite){if(!A.frustumCulled||V.intersectsSprite(A)){q&&Ge.setFromMatrixPosition(A.matrixWorld).applyMatrix4(Le);const Ae=ee.update(A),Be=A.material;Be.visible&&d.push(A,Ae,Be,Z,Ge.z,null)}}else if((A.isMesh||A.isLine||A.isPoints)&&(!A.frustumCulled||V.intersectsObject(A))){const Ae=ee.update(A),Be=A.material;if(q&&(A.boundingSphere!==void 0?(A.boundingSphere===null&&A.computeBoundingSphere(),Ge.copy(A.boundingSphere.center)):(Ae.boundingSphere===null&&Ae.computeBoundingSphere(),Ge.copy(Ae.boundingSphere.center)),Ge.applyMatrix4(A.matrixWorld).applyMatrix4(Le)),Array.isArray(Be)){const ke=Ae.groups;for(let Qe=0,st=ke.length;Qe<st;Qe++){const Ve=ke[Qe],mt=Be[Ve.materialIndex];mt&&mt.visible&&d.push(A,Ae,mt,Z,Ge.z,Ve)}}else Be.visible&&d.push(A,Ae,Be,Z,Ge.z,null)}}const _e=A.children;for(let Ae=0,Be=_e.length;Ae<Be;Ae++)Bc(_e[Ae],O,Z,q)}function pu(A,O,Z,q){const F=A.opaque,_e=A.transmissive,Ae=A.transparent;m.setupLightsView(Z),J===!0&&ce.setGlobalState(v.clippingPlanes,Z),q&&xe.viewport(D.copy(q)),F.length>0&&$a(F,O,Z),_e.length>0&&$a(_e,O,Z),Ae.length>0&&$a(Ae,O,Z),xe.buffers.depth.setTest(!0),xe.buffers.depth.setMask(!0),xe.buffers.color.setMask(!0),xe.setPolygonOffset(!1)}function mu(A,O,Z,q){if((Z.isScene===!0?Z.overrideMaterial:null)!==null)return;m.state.transmissionRenderTarget[q.id]===void 0&&(m.state.transmissionRenderTarget[q.id]=new ln(1,1,{generateMipmaps:!0,type:he.has("EXT_color_buffer_half_float")||he.has("EXT_color_buffer_float")?Yn:_i,minFilter:ni,samples:4,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:ct.workingColorSpace}));const _e=m.state.transmissionRenderTarget[q.id],Ae=q.viewport||D;_e.setSize(Ae.z,Ae.w);const Be=v.getRenderTarget();v.setRenderTarget(_e),v.getClearColor(G),Y=v.getClearAlpha(),Y<1&&v.setClearColor(16777215,.5),v.clear(),ne&&Je.render(Z);const ke=v.toneMapping;v.toneMapping=mi;const Qe=q.viewport;if(q.viewport!==void 0&&(q.viewport=void 0),m.setupLightsView(q),J===!0&&ce.setGlobalState(v.clippingPlanes,q),$a(A,Z,q),L.updateMultisampleRenderTarget(_e),L.updateRenderTargetMipmap(_e),he.has("WEBGL_multisampled_render_to_texture")===!1){let st=!1;for(let Ve=0,mt=O.length;Ve<mt;Ve++){const Rt=O[Ve],Pt=Rt.object,Sn=Rt.geometry,yt=Rt.material,He=Rt.group;if(yt.side===St&&Pt.layers.test(q.layers)){const Si=yt.side;yt.side=on,yt.needsUpdate=!0,gu(Pt,Z,q,Sn,yt,He),yt.side=Si,yt.needsUpdate=!0,st=!0}}st===!0&&(L.updateMultisampleRenderTarget(_e),L.updateRenderTargetMipmap(_e))}v.setRenderTarget(Be),v.setClearColor(G,Y),Qe!==void 0&&(q.viewport=Qe),v.toneMapping=ke}function $a(A,O,Z){const q=O.isScene===!0?O.overrideMaterial:null;for(let F=0,_e=A.length;F<_e;F++){const Ae=A[F],Be=Ae.object,ke=Ae.geometry,Qe=q===null?Ae.material:q,st=Ae.group;Be.layers.test(Z.layers)&&gu(Be,O,Z,ke,Qe,st)}}function gu(A,O,Z,q,F,_e){A.onBeforeRender(v,O,Z,q,F,_e),A.modelViewMatrix.multiplyMatrices(Z.matrixWorldInverse,A.matrixWorld),A.normalMatrix.getNormalMatrix(A.modelViewMatrix),F.onBeforeRender(v,O,Z,q,A,_e),F.transparent===!0&&F.side===St&&F.forceSinglePass===!1?(F.side=on,F.needsUpdate=!0,v.renderBufferDirect(Z,O,q,F,A,_e),F.side=Pn,F.needsUpdate=!0,v.renderBufferDirect(Z,O,q,F,A,_e),F.side=St):v.renderBufferDirect(Z,O,q,F,A,_e),A.onAfterRender(v,O,Z,q,F,_e)}function Ka(A,O,Z){O.isScene!==!0&&(O=Ke);const q=Ie.get(A),F=m.state.lights,_e=m.state.shadowsArray,Ae=F.state.version,Be=Ne.getParameters(A,F.state,_e,O,Z),ke=Ne.getProgramCacheKey(Be);let Qe=q.programs;q.environment=A.isMeshStandardMaterial?O.environment:null,q.fog=O.fog,q.envMap=(A.isMeshStandardMaterial?H:b).get(A.envMap||q.environment),q.envMapRotation=q.environment!==null&&A.envMap===null?O.environmentRotation:A.envMapRotation,Qe===void 0&&(A.addEventListener("dispose",it),Qe=new Map,q.programs=Qe);let st=Qe.get(ke);if(st!==void 0){if(q.currentProgram===st&&q.lightsStateVersion===Ae)return _u(A,Be),st}else Be.uniforms=Ne.getUniforms(A),A.onBeforeCompile(Be,v),st=Ne.acquireProgram(Be,ke),Qe.set(ke,st),q.uniforms=Be.uniforms;const Ve=q.uniforms;return(!A.isShaderMaterial&&!A.isRawShaderMaterial||A.clipping===!0)&&(Ve.clippingPlanes=ce.uniform),_u(A,Be),q.needsLights=Am(A),q.lightsStateVersion=Ae,q.needsLights&&(Ve.ambientLightColor.value=F.state.ambient,Ve.lightProbe.value=F.state.probe,Ve.directionalLights.value=F.state.directional,Ve.directionalLightShadows.value=F.state.directionalShadow,Ve.spotLights.value=F.state.spot,Ve.spotLightShadows.value=F.state.spotShadow,Ve.rectAreaLights.value=F.state.rectArea,Ve.ltc_1.value=F.state.rectAreaLTC1,Ve.ltc_2.value=F.state.rectAreaLTC2,Ve.pointLights.value=F.state.point,Ve.pointLightShadows.value=F.state.pointShadow,Ve.hemisphereLights.value=F.state.hemi,Ve.directionalShadowMap.value=F.state.directionalShadowMap,Ve.directionalShadowMatrix.value=F.state.directionalShadowMatrix,Ve.spotShadowMap.value=F.state.spotShadowMap,Ve.spotLightMatrix.value=F.state.spotLightMatrix,Ve.spotLightMap.value=F.state.spotLightMap,Ve.pointShadowMap.value=F.state.pointShadowMap,Ve.pointShadowMatrix.value=F.state.pointShadowMatrix),q.currentProgram=st,q.uniformsList=null,st}function yu(A){if(A.uniformsList===null){const O=A.currentProgram.getUniforms();A.uniformsList=el.seqWithValue(O.seq,A.uniforms)}return A.uniformsList}function _u(A,O){const Z=Ie.get(A);Z.outputColorSpace=O.outputColorSpace,Z.batching=O.batching,Z.batchingColor=O.batchingColor,Z.instancing=O.instancing,Z.instancingColor=O.instancingColor,Z.instancingMorph=O.instancingMorph,Z.skinning=O.skinning,Z.morphTargets=O.morphTargets,Z.morphNormals=O.morphNormals,Z.morphColors=O.morphColors,Z.morphTargetsCount=O.morphTargetsCount,Z.numClippingPlanes=O.numClippingPlanes,Z.numIntersection=O.numClipIntersection,Z.vertexAlphas=O.vertexAlphas,Z.vertexTangents=O.vertexTangents,Z.toneMapping=O.toneMapping}function wm(A,O,Z,q,F){O.isScene!==!0&&(O=Ke),L.resetTextureUnits();const _e=O.fog,Ae=q.isMeshStandardMaterial?O.environment:null,Be=P===null?v.outputColorSpace:P.isXRRenderTarget===!0?P.texture.colorSpace:es,ke=(q.isMeshStandardMaterial?H:b).get(q.envMap||Ae),Qe=q.vertexColors===!0&&!!Z.attributes.color&&Z.attributes.color.itemSize===4,st=!!Z.attributes.tangent&&(!!q.normalMap||q.anisotropy>0),Ve=!!Z.morphAttributes.position,mt=!!Z.morphAttributes.normal,Rt=!!Z.morphAttributes.color;let Pt=mi;q.toneMapped&&(P===null||P.isXRRenderTarget===!0)&&(Pt=v.toneMapping);const Sn=Z.morphAttributes.position||Z.morphAttributes.normal||Z.morphAttributes.color,yt=Sn!==void 0?Sn.length:0,He=Ie.get(q),Si=m.state.lights;if(J===!0&&(le===!0||A!==M)){const Bn=A===M&&q.id===S;ce.setState(q,A,Bn)}let _t=!1;q.version===He.__version?(He.needsLights&&He.lightsStateVersion!==Si.state.version||He.outputColorSpace!==Be||F.isBatchedMesh&&He.batching===!1||!F.isBatchedMesh&&He.batching===!0||F.isBatchedMesh&&He.batchingColor===!0&&F.colorTexture===null||F.isBatchedMesh&&He.batchingColor===!1&&F.colorTexture!==null||F.isInstancedMesh&&He.instancing===!1||!F.isInstancedMesh&&He.instancing===!0||F.isSkinnedMesh&&He.skinning===!1||!F.isSkinnedMesh&&He.skinning===!0||F.isInstancedMesh&&He.instancingColor===!0&&F.instanceColor===null||F.isInstancedMesh&&He.instancingColor===!1&&F.instanceColor!==null||F.isInstancedMesh&&He.instancingMorph===!0&&F.morphTexture===null||F.isInstancedMesh&&He.instancingMorph===!1&&F.morphTexture!==null||He.envMap!==ke||q.fog===!0&&He.fog!==_e||He.numClippingPlanes!==void 0&&(He.numClippingPlanes!==ce.numPlanes||He.numIntersection!==ce.numIntersection)||He.vertexAlphas!==Qe||He.vertexTangents!==st||He.morphTargets!==Ve||He.morphNormals!==mt||He.morphColors!==Rt||He.toneMapping!==Pt||He.morphTargetsCount!==yt)&&(_t=!0):(_t=!0,He.__version=q.version);let Kn=He.currentProgram;_t===!0&&(Kn=Ka(q,O,F));let Xs=!1,Un=!1,zr=!1;const It=Kn.getUniforms(),ci=He.uniforms;if(xe.useProgram(Kn.program)&&(Xs=!0,Un=!0,zr=!0),q.id!==S&&(S=q.id,Un=!0),Xs||M!==A){xe.buffers.depth.getReversed()?(oe.copy(A.projectionMatrix),Ag(oe),Eg(oe),It.setValue(z,"projectionMatrix",oe)):It.setValue(z,"projectionMatrix",A.projectionMatrix),It.setValue(z,"viewMatrix",A.matrixWorldInverse);const Bi=It.map.cameraPosition;Bi!==void 0&&Bi.setValue(z,Oe.setFromMatrixPosition(A.matrixWorld)),Pe.logarithmicDepthBuffer&&It.setValue(z,"logDepthBufFC",2/(Math.log(A.far+1)/Math.LN2)),(q.isMeshPhongMaterial||q.isMeshToonMaterial||q.isMeshLambertMaterial||q.isMeshBasicMaterial||q.isMeshStandardMaterial||q.isShaderMaterial)&&It.setValue(z,"isOrthographic",A.isOrthographicCamera===!0),M!==A&&(M=A,Un=!0,zr=!0)}if(F.isSkinnedMesh){It.setOptional(z,F,"bindMatrix"),It.setOptional(z,F,"bindMatrixInverse");const Bn=F.skeleton;Bn&&(Bn.boneTexture===null&&Bn.computeBoneTexture(),It.setValue(z,"boneTexture",Bn.boneTexture,L))}F.isBatchedMesh&&(It.setOptional(z,F,"batchingTexture"),It.setValue(z,"batchingTexture",F._matricesTexture,L),It.setOptional(z,F,"batchingIdTexture"),It.setValue(z,"batchingIdTexture",F._indirectTexture,L),It.setOptional(z,F,"batchingColorTexture"),F._colorsTexture!==null&&It.setValue(z,"batchingColorTexture",F._colorsTexture,L));const Ur=Z.morphAttributes;if((Ur.position!==void 0||Ur.normal!==void 0||Ur.color!==void 0)&&je.update(F,Z,Kn),(Un||He.receiveShadow!==F.receiveShadow)&&(He.receiveShadow=F.receiveShadow,It.setValue(z,"receiveShadow",F.receiveShadow)),q.isMeshGouraudMaterial&&q.envMap!==null&&(ci.envMap.value=ke,ci.flipEnvMap.value=ke.isCubeTexture&&ke.isRenderTargetTexture===!1?-1:1),q.isMeshStandardMaterial&&q.envMap===null&&O.environment!==null&&(ci.envMapIntensity.value=O.environmentIntensity),Un&&(It.setValue(z,"toneMappingExposure",v.toneMappingExposure),He.needsLights&&Tm(ci,zr),_e&&q.fog===!0&&be.refreshFogUniforms(ci,_e),be.refreshMaterialUniforms(ci,q,X,te,m.state.transmissionRenderTarget[A.id]),el.upload(z,yu(He),ci,L)),q.isShaderMaterial&&q.uniformsNeedUpdate===!0&&(el.upload(z,yu(He),ci,L),q.uniformsNeedUpdate=!1),q.isSpriteMaterial&&It.setValue(z,"center",F.center),It.setValue(z,"modelViewMatrix",F.modelViewMatrix),It.setValue(z,"normalMatrix",F.normalMatrix),It.setValue(z,"modelMatrix",F.matrixWorld),q.isShaderMaterial||q.isRawShaderMaterial){const Bn=q.uniformsGroups;for(let Bi=0,ki=Bn.length;Bi<ki;Bi++){const xu=Bn[Bi];N.update(xu,Kn),N.bind(xu,Kn)}}return Kn}function Tm(A,O){A.ambientLightColor.needsUpdate=O,A.lightProbe.needsUpdate=O,A.directionalLights.needsUpdate=O,A.directionalLightShadows.needsUpdate=O,A.pointLights.needsUpdate=O,A.pointLightShadows.needsUpdate=O,A.spotLights.needsUpdate=O,A.spotLightShadows.needsUpdate=O,A.rectAreaLights.needsUpdate=O,A.hemisphereLights.needsUpdate=O}function Am(A){return A.isMeshLambertMaterial||A.isMeshToonMaterial||A.isMeshPhongMaterial||A.isMeshStandardMaterial||A.isShadowMaterial||A.isShaderMaterial&&A.lights===!0}this.getActiveCubeFace=function(){return T},this.getActiveMipmapLevel=function(){return R},this.getRenderTarget=function(){return P},this.setRenderTargetTextures=function(A,O,Z){Ie.get(A.texture).__webglTexture=O,Ie.get(A.depthTexture).__webglTexture=Z;const q=Ie.get(A);q.__hasExternalTextures=!0,q.__autoAllocateDepthBuffer=Z===void 0,q.__autoAllocateDepthBuffer||he.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),q.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(A,O){const Z=Ie.get(A);Z.__webglFramebuffer=O,Z.__useDefaultFramebuffer=O===void 0},this.setRenderTarget=function(A,O=0,Z=0){P=A,T=O,R=Z;let q=!0,F=null,_e=!1,Ae=!1;if(A){const ke=Ie.get(A);if(ke.__useDefaultFramebuffer!==void 0)xe.bindFramebuffer(z.FRAMEBUFFER,null),q=!1;else if(ke.__webglFramebuffer===void 0)L.setupRenderTarget(A);else if(ke.__hasExternalTextures)L.rebindTextures(A,Ie.get(A.texture).__webglTexture,Ie.get(A.depthTexture).__webglTexture);else if(A.depthBuffer){const Ve=A.depthTexture;if(ke.__boundDepthTexture!==Ve){if(Ve!==null&&Ie.has(Ve)&&(A.width!==Ve.image.width||A.height!==Ve.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");L.setupDepthRenderbuffer(A)}}const Qe=A.texture;(Qe.isData3DTexture||Qe.isDataArrayTexture||Qe.isCompressedArrayTexture)&&(Ae=!0);const st=Ie.get(A).__webglFramebuffer;A.isWebGLCubeRenderTarget?(Array.isArray(st[O])?F=st[O][Z]:F=st[O],_e=!0):A.samples>0&&L.useMultisampledRTT(A)===!1?F=Ie.get(A).__webglMultisampledFramebuffer:Array.isArray(st)?F=st[Z]:F=st,D.copy(A.viewport),U.copy(A.scissor),B=A.scissorTest}else D.copy(ge).multiplyScalar(X).floor(),U.copy(Xe).multiplyScalar(X).floor(),B=ie;if(xe.bindFramebuffer(z.FRAMEBUFFER,F)&&q&&xe.drawBuffers(A,F),xe.viewport(D),xe.scissor(U),xe.setScissorTest(B),_e){const ke=Ie.get(A.texture);z.framebufferTexture2D(z.FRAMEBUFFER,z.COLOR_ATTACHMENT0,z.TEXTURE_CUBE_MAP_POSITIVE_X+O,ke.__webglTexture,Z)}else if(Ae){const ke=Ie.get(A.texture),Qe=O||0;z.framebufferTextureLayer(z.FRAMEBUFFER,z.COLOR_ATTACHMENT0,ke.__webglTexture,Z||0,Qe)}S=-1},this.readRenderTargetPixels=function(A,O,Z,q,F,_e,Ae){if(!(A&&A.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Be=Ie.get(A).__webglFramebuffer;if(A.isWebGLCubeRenderTarget&&Ae!==void 0&&(Be=Be[Ae]),Be){xe.bindFramebuffer(z.FRAMEBUFFER,Be);try{const ke=A.texture,Qe=ke.format,st=ke.type;if(!Pe.textureFormatReadable(Qe)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!Pe.textureTypeReadable(st)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}O>=0&&O<=A.width-q&&Z>=0&&Z<=A.height-F&&z.readPixels(O,Z,q,F,at.convert(Qe),at.convert(st),_e)}finally{const ke=P!==null?Ie.get(P).__webglFramebuffer:null;xe.bindFramebuffer(z.FRAMEBUFFER,ke)}}},this.readRenderTargetPixelsAsync=async function(A,O,Z,q,F,_e,Ae){if(!(A&&A.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Be=Ie.get(A).__webglFramebuffer;if(A.isWebGLCubeRenderTarget&&Ae!==void 0&&(Be=Be[Ae]),Be){const ke=A.texture,Qe=ke.format,st=ke.type;if(!Pe.textureFormatReadable(Qe))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!Pe.textureTypeReadable(st))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");if(O>=0&&O<=A.width-q&&Z>=0&&Z<=A.height-F){xe.bindFramebuffer(z.FRAMEBUFFER,Be);const Ve=z.createBuffer();z.bindBuffer(z.PIXEL_PACK_BUFFER,Ve),z.bufferData(z.PIXEL_PACK_BUFFER,_e.byteLength,z.STREAM_READ),z.readPixels(O,Z,q,F,at.convert(Qe),at.convert(st),0);const mt=P!==null?Ie.get(P).__webglFramebuffer:null;xe.bindFramebuffer(z.FRAMEBUFFER,mt);const Rt=z.fenceSync(z.SYNC_GPU_COMMANDS_COMPLETE,0);return z.flush(),await Tg(z,Rt,4),z.bindBuffer(z.PIXEL_PACK_BUFFER,Ve),z.getBufferSubData(z.PIXEL_PACK_BUFFER,0,_e),z.deleteBuffer(Ve),z.deleteSync(Rt),_e}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(A,O=null,Z=0){A.isTexture!==!0&&(Jr("WebGLRenderer: copyFramebufferToTexture function signature has changed."),O=arguments[0]||null,A=arguments[1]);const q=Math.pow(2,-Z),F=Math.floor(A.image.width*q),_e=Math.floor(A.image.height*q),Ae=O!==null?O.x:0,Be=O!==null?O.y:0;L.setTexture2D(A,0),z.copyTexSubImage2D(z.TEXTURE_2D,Z,0,0,Ae,Be,F,_e),xe.unbindTexture()},this.copyTextureToTexture=function(A,O,Z=null,q=null,F=0){A.isTexture!==!0&&(Jr("WebGLRenderer: copyTextureToTexture function signature has changed."),q=arguments[0]||null,A=arguments[1],O=arguments[2],F=arguments[3]||0,Z=null);let _e,Ae,Be,ke,Qe,st,Ve,mt,Rt;const Pt=A.isCompressedTexture?A.mipmaps[F]:A.image;Z!==null?(_e=Z.max.x-Z.min.x,Ae=Z.max.y-Z.min.y,Be=Z.isBox3?Z.max.z-Z.min.z:1,ke=Z.min.x,Qe=Z.min.y,st=Z.isBox3?Z.min.z:0):(_e=Pt.width,Ae=Pt.height,Be=Pt.depth||1,ke=0,Qe=0,st=0),q!==null?(Ve=q.x,mt=q.y,Rt=q.z):(Ve=0,mt=0,Rt=0);const Sn=at.convert(O.format),yt=at.convert(O.type);let He;O.isData3DTexture?(L.setTexture3D(O,0),He=z.TEXTURE_3D):O.isDataArrayTexture||O.isCompressedArrayTexture?(L.setTexture2DArray(O,0),He=z.TEXTURE_2D_ARRAY):(L.setTexture2D(O,0),He=z.TEXTURE_2D),z.pixelStorei(z.UNPACK_FLIP_Y_WEBGL,O.flipY),z.pixelStorei(z.UNPACK_PREMULTIPLY_ALPHA_WEBGL,O.premultiplyAlpha),z.pixelStorei(z.UNPACK_ALIGNMENT,O.unpackAlignment);const Si=z.getParameter(z.UNPACK_ROW_LENGTH),_t=z.getParameter(z.UNPACK_IMAGE_HEIGHT),Kn=z.getParameter(z.UNPACK_SKIP_PIXELS),Xs=z.getParameter(z.UNPACK_SKIP_ROWS),Un=z.getParameter(z.UNPACK_SKIP_IMAGES);z.pixelStorei(z.UNPACK_ROW_LENGTH,Pt.width),z.pixelStorei(z.UNPACK_IMAGE_HEIGHT,Pt.height),z.pixelStorei(z.UNPACK_SKIP_PIXELS,ke),z.pixelStorei(z.UNPACK_SKIP_ROWS,Qe),z.pixelStorei(z.UNPACK_SKIP_IMAGES,st);const zr=A.isDataArrayTexture||A.isData3DTexture,It=O.isDataArrayTexture||O.isData3DTexture;if(A.isRenderTargetTexture||A.isDepthTexture){const ci=Ie.get(A),Ur=Ie.get(O),Bn=Ie.get(ci.__renderTarget),Bi=Ie.get(Ur.__renderTarget);xe.bindFramebuffer(z.READ_FRAMEBUFFER,Bn.__webglFramebuffer),xe.bindFramebuffer(z.DRAW_FRAMEBUFFER,Bi.__webglFramebuffer);for(let ki=0;ki<Be;ki++)zr&&z.framebufferTextureLayer(z.READ_FRAMEBUFFER,z.COLOR_ATTACHMENT0,Ie.get(A).__webglTexture,F,st+ki),A.isDepthTexture?(It&&z.framebufferTextureLayer(z.DRAW_FRAMEBUFFER,z.COLOR_ATTACHMENT0,Ie.get(O).__webglTexture,F,Rt+ki),z.blitFramebuffer(ke,Qe,_e,Ae,Ve,mt,_e,Ae,z.DEPTH_BUFFER_BIT,z.NEAREST)):It?z.copyTexSubImage3D(He,F,Ve,mt,Rt+ki,ke,Qe,_e,Ae):z.copyTexSubImage2D(He,F,Ve,mt,Rt+ki,ke,Qe,_e,Ae);xe.bindFramebuffer(z.READ_FRAMEBUFFER,null),xe.bindFramebuffer(z.DRAW_FRAMEBUFFER,null)}else It?A.isDataTexture||A.isData3DTexture?z.texSubImage3D(He,F,Ve,mt,Rt,_e,Ae,Be,Sn,yt,Pt.data):O.isCompressedArrayTexture?z.compressedTexSubImage3D(He,F,Ve,mt,Rt,_e,Ae,Be,Sn,Pt.data):z.texSubImage3D(He,F,Ve,mt,Rt,_e,Ae,Be,Sn,yt,Pt):A.isDataTexture?z.texSubImage2D(z.TEXTURE_2D,F,Ve,mt,_e,Ae,Sn,yt,Pt.data):A.isCompressedTexture?z.compressedTexSubImage2D(z.TEXTURE_2D,F,Ve,mt,Pt.width,Pt.height,Sn,Pt.data):z.texSubImage2D(z.TEXTURE_2D,F,Ve,mt,_e,Ae,Sn,yt,Pt);z.pixelStorei(z.UNPACK_ROW_LENGTH,Si),z.pixelStorei(z.UNPACK_IMAGE_HEIGHT,_t),z.pixelStorei(z.UNPACK_SKIP_PIXELS,Kn),z.pixelStorei(z.UNPACK_SKIP_ROWS,Xs),z.pixelStorei(z.UNPACK_SKIP_IMAGES,Un),F===0&&O.generateMipmaps&&z.generateMipmap(He),xe.unbindTexture()},this.copyTextureToTexture3D=function(A,O,Z=null,q=null,F=0){return A.isTexture!==!0&&(Jr("WebGLRenderer: copyTextureToTexture3D function signature has changed."),Z=arguments[0]||null,q=arguments[1]||null,A=arguments[2],O=arguments[3],F=arguments[4]||0),Jr('WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.'),this.copyTextureToTexture(A,O,Z,q,F)},this.initRenderTarget=function(A){Ie.get(A).__webglFramebuffer===void 0&&L.setupRenderTarget(A)},this.initTexture=function(A){A.isCubeTexture?L.setTextureCube(A,0):A.isData3DTexture?L.setTexture3D(A,0):A.isDataArrayTexture||A.isCompressedArrayTexture?L.setTexture2DArray(A,0):L.setTexture2D(A,0),xe.unbindTexture()},this.resetState=function(){T=0,R=0,P=null,xe.reset(),Ct.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return ui}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorspace=ct._getDrawingBufferColorSpace(e),t.unpackColorSpace=ct._getUnpackColorSpace()}}class Fa{constructor(e,t=25e-5){this.isFogExp2=!0,this.name="",this.color=new re(e),this.density=t}clone(){return new Fa(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}}class oc{constructor(e,t=1,n=1e3){this.isFog=!0,this.name="",this.color=new re(e),this.near=t,this.far=n}clone(){return new oc(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}}class If extends dt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Mn,this.environmentIntensity=1,this.environmentRotation=new Mn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}}class lc{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=_a,this.updateRanges=[],this.version=0,this.uuid=Fn()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let s=0,r=this.stride;s<r;s++)this.array[e+s]=t.array[n+s];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Fn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){return e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Fn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const _n=new w;class zs{constructor(e,t,n,s=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=n,this.normalized=s}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)_n.fromBufferAttribute(this,t),_n.applyMatrix4(e),this.setXYZ(t,_n.x,_n.y,_n.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)_n.fromBufferAttribute(this,t),_n.applyNormalMatrix(e),this.setXYZ(t,_n.x,_n.y,_n.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)_n.fromBufferAttribute(this,t),_n.transformDirection(e),this.setXYZ(t,_n.x,_n.y,_n.z);return this}getComponent(e,t){let n=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(n=vn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=nt(n,this.array)),this.data.array[e*this.data.stride+this.offset+t]=n,this}setX(e,t){return this.normalized&&(t=nt(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=nt(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=nt(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=nt(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=vn(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=vn(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=vn(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=vn(t,this.array)),t}setXY(e,t,n){return e=e*this.data.stride+this.offset,this.normalized&&(t=nt(t,this.array),n=nt(n,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,s){return e=e*this.data.stride+this.offset,this.normalized&&(t=nt(t,this.array),n=nt(n,this.array),s=nt(s,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=s,this}setXYZW(e,t,n,s,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=nt(t,this.array),n=nt(n,this.array),s=nt(s,this.array),r=nt(r,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=s,this.data.array[e+3]=r,this}clone(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let n=0;n<this.count;n++){const s=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[s+r])}return new Et(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new zs(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let n=0;n<this.count;n++){const s=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[s+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}class Ba extends yn{static get type(){return"SpriteMaterial"}constructor(e){super(),this.isSpriteMaterial=!0,this.color=new re(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}let rr;const kr=new w,ar=new w,or=new w,lr=new $,Vr=new $,y0=new Ye,_o=new w,Hr=new w,xo=new w,hd=new $,dh=new $,fd=new $;class cc extends dt{constructor(e=new Ba){if(super(),this.isSprite=!0,this.type="Sprite",rr===void 0){rr=new tt;const t=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new lc(t,5);rr.setIndex([0,1,2,0,2,3]),rr.setAttribute("position",new zs(n,3,0,!1)),rr.setAttribute("uv",new zs(n,2,3,!1))}this.geometry=rr,this.material=e,this.center=new $(.5,.5)}raycast(e,t){e.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),ar.setFromMatrixScale(this.matrixWorld),y0.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),or.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&ar.multiplyScalar(-or.z);const n=this.material.rotation;let s,r;n!==0&&(r=Math.cos(n),s=Math.sin(n));const a=this.center;vo(_o.set(-.5,-.5,0),or,a,ar,s,r),vo(Hr.set(.5,-.5,0),or,a,ar,s,r),vo(xo.set(.5,.5,0),or,a,ar,s,r),hd.set(0,0),dh.set(1,0),fd.set(1,1);let o=e.ray.intersectTriangle(_o,Hr,xo,!1,kr);if(o===null&&(vo(Hr.set(-.5,.5,0),or,a,ar,s,r),dh.set(0,1),o=e.ray.intersectTriangle(_o,xo,Hr,!1,kr),o===null))return;const l=e.ray.origin.distanceTo(kr);l<e.near||l>e.far||t.push({distance:l,point:kr.clone(),uv:En.getInterpolation(kr,_o,Hr,xo,hd,dh,fd,new $),face:null,object:this})}copy(e,t){return super.copy(e,t),e.center!==void 0&&this.center.copy(e.center),this.material=e.material,this}}function vo(i,e,t,n,s,r){lr.subVectors(i,t).addScalar(.5).multiply(n),s!==void 0?(Vr.x=r*lr.x-s*lr.y,Vr.y=s*lr.x+r*lr.y):Vr.copy(lr),i.copy(e),i.x+=Vr.x,i.y+=Vr.y,i.applyMatrix4(y0)}const Mo=new w,ud=new w;class _0 extends dt{constructor(){super(),this._currentLevel=0,this.type="LOD",Object.defineProperties(this,{levels:{enumerable:!0,value:[]},isLOD:{value:!0}}),this.autoUpdate=!0}copy(e){super.copy(e,!1);const t=e.levels;for(let n=0,s=t.length;n<s;n++){const r=t[n];this.addLevel(r.object.clone(),r.distance,r.hysteresis)}return this.autoUpdate=e.autoUpdate,this}addLevel(e,t=0,n=0){t=Math.abs(t);const s=this.levels;let r;for(r=0;r<s.length&&!(t<s[r].distance);r++);return s.splice(r,0,{distance:t,hysteresis:n,object:e}),this.add(e),this}removeLevel(e){const t=this.levels;for(let n=0;n<t.length;n++)if(t[n].distance===e){const s=t.splice(n,1);return this.remove(s[0].object),!0}return!1}getCurrentLevel(){return this._currentLevel}getObjectForDistance(e){const t=this.levels;if(t.length>0){let n,s;for(n=1,s=t.length;n<s;n++){let r=t[n].distance;if(t[n].object.visible&&(r-=r*t[n].hysteresis),e<r)break}return t[n-1].object}return null}raycast(e,t){if(this.levels.length>0){Mo.setFromMatrixPosition(this.matrixWorld);const s=e.ray.origin.distanceTo(Mo);this.getObjectForDistance(s).raycast(e,t)}}update(e){const t=this.levels;if(t.length>1){Mo.setFromMatrixPosition(e.matrixWorld),ud.setFromMatrixPosition(this.matrixWorld);const n=Mo.distanceTo(ud)/e.zoom;t[0].object.visible=!0;let s,r;for(s=1,r=t.length;s<r;s++){let a=t[s].distance;if(t[s].object.visible&&(a-=a*t[s].hysteresis),n>=a)t[s-1].object.visible=!1,t[s].object.visible=!0;else break}for(this._currentLevel=s-1;s<r;s++)t[s].object.visible=!1}}toJSON(e){const t=super.toJSON(e);this.autoUpdate===!1&&(t.object.autoUpdate=!1),t.object.levels=[];const n=this.levels;for(let s=0,r=n.length;s<r;s++){const a=n[s];t.object.levels.push({object:a.object.uuid,distance:a.distance,hysteresis:a.hysteresis})}return t}}const dd=new w,pd=new ot,md=new ot,kv=new w,gd=new Ye,bo=new w,ph=new gn,yd=new Ye,mh=new Vs;class x0 extends lt{constructor(e,t){super(e,t),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=Xh,this.bindMatrix=new Ye,this.bindMatrixInverse=new Ye,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){const e=this.geometry;this.boundingBox===null&&(this.boundingBox=new jt),this.boundingBox.makeEmpty();const t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,bo),this.boundingBox.expandByPoint(bo)}computeBoundingSphere(){const e=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new gn),this.boundingSphere.makeEmpty();const t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,bo),this.boundingSphere.expandByPoint(bo)}copy(e,t){return super.copy(e,t),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}raycast(e,t){const n=this.material,s=this.matrixWorld;n!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),ph.copy(this.boundingSphere),ph.applyMatrix4(s),e.ray.intersectsSphere(ph)!==!1&&(yd.copy(s).invert(),mh.copy(e.ray).applyMatrix4(yd),!(this.boundingBox!==null&&mh.intersectsBox(this.boundingBox)===!1)&&this._computeIntersections(e,t,mh)))}getVertexPosition(e,t){return super.getVertexPosition(e,t),this.applyBoneTransform(e,t),t}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){const e=new ot,t=this.geometry.attributes.skinWeight;for(let n=0,s=t.count;n<s;n++){e.fromBufferAttribute(t,n);const r=1/e.manhattanLength();r!==1/0?e.multiplyScalar(r):e.set(1,0,0,0),t.setXYZW(n,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode===Xh?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===kp?this.bindMatrixInverse.copy(this.bindMatrix).invert():console.warn("THREE.SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(e,t){const n=this.skeleton,s=this.geometry;pd.fromBufferAttribute(s.attributes.skinIndex,e),md.fromBufferAttribute(s.attributes.skinWeight,e),dd.copy(t).applyMatrix4(this.bindMatrix),t.set(0,0,0);for(let r=0;r<4;r++){const a=md.getComponent(r);if(a!==0){const o=pd.getComponent(r);gd.multiplyMatrices(n.bones[o].matrixWorld,n.boneInverses[o]),t.addScaledVector(kv.copy(dd).applyMatrix4(gd),a)}}return t.applyMatrix4(this.bindMatrixInverse)}}class Df extends dt{constructor(){super(),this.isBone=!0,this.type="Bone"}}class si extends Ht{constructor(e=null,t=1,n=1,s,r,a,o,l,c=Qt,h=Qt,f,p){super(null,a,o,l,c,h,s,r,f,p),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}const _d=new Ye,Vv=new Ye;class hc{constructor(e=[],t=[]){this.uuid=Fn(),this.bones=e.slice(0),this.boneInverses=t,this.boneMatrices=null,this.boneTexture=null,this.init()}init(){const e=this.bones,t=this.boneInverses;if(this.boneMatrices=new Float32Array(e.length*16),t.length===0)this.calculateInverses();else if(e.length!==t.length){console.warn("THREE.Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let n=0,s=this.bones.length;n<s;n++)this.boneInverses.push(new Ye)}}calculateInverses(){this.boneInverses.length=0;for(let e=0,t=this.bones.length;e<t;e++){const n=new Ye;this.bones[e]&&n.copy(this.bones[e].matrixWorld).invert(),this.boneInverses.push(n)}}pose(){for(let e=0,t=this.bones.length;e<t;e++){const n=this.bones[e];n&&n.matrixWorld.copy(this.boneInverses[e]).invert()}for(let e=0,t=this.bones.length;e<t;e++){const n=this.bones[e];n&&(n.parent&&n.parent.isBone?(n.matrix.copy(n.parent.matrixWorld).invert(),n.matrix.multiply(n.matrixWorld)):n.matrix.copy(n.matrixWorld),n.matrix.decompose(n.position,n.quaternion,n.scale))}}update(){const e=this.bones,t=this.boneInverses,n=this.boneMatrices,s=this.boneTexture;for(let r=0,a=e.length;r<a;r++){const o=e[r]?e[r].matrixWorld:Vv;_d.multiplyMatrices(o,t[r]),_d.toArray(n,r*16)}s!==null&&(s.needsUpdate=!0)}clone(){return new hc(this.bones,this.boneInverses)}computeBoneTexture(){let e=Math.sqrt(this.bones.length*4);e=Math.ceil(e/4)*4,e=Math.max(e,4);const t=new Float32Array(e*e*4);t.set(this.boneMatrices);const n=new si(t,e,e,mn,Cn);return n.needsUpdate=!0,this.boneMatrices=t,this.boneTexture=n,this}getBoneByName(e){for(let t=0,n=this.bones.length;t<n;t++){const s=this.bones[t];if(s.name===e)return s}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(e,t){this.uuid=e.uuid;for(let n=0,s=e.bones.length;n<s;n++){const r=e.bones[n];let a=t[r];a===void 0&&(console.warn("THREE.Skeleton: No bone found with UUID:",r),a=new Df),this.bones.push(a),this.boneInverses.push(new Ye().fromArray(e.boneInverses[n]))}return this.init(),this}toJSON(){const e={metadata:{version:4.6,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};e.uuid=this.uuid;const t=this.bones,n=this.boneInverses;for(let s=0,r=t.length;s<r;s++){const a=t[s];e.bones.push(a.uuid);const o=n[s];e.boneInverses.push(o.toArray())}return e}}class Us extends Et{constructor(e,t,n,s=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=s}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){const e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}}const cr=new Ye,xd=new Ye,So=[],vd=new jt,Hv=new Ye,Gr=new lt,Wr=new gn;class Ar extends lt{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new Us(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let s=0;s<n;s++)this.setMatrixAt(s,Hv)}computeBoundingBox(){const e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new jt),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,cr),vd.copy(e.boundingBox).applyMatrix4(cr),this.boundingBox.union(vd)}computeBoundingSphere(){const e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new gn),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,cr),Wr.copy(e.boundingSphere).applyMatrix4(cr),this.boundingSphere.union(Wr)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){const n=t.morphTargetInfluences,s=this.morphTexture.source.data.data,r=n.length+1,a=e*r+1;for(let o=0;o<n.length;o++)n[o]=s[a+o]}raycast(e,t){const n=this.matrixWorld,s=this.count;if(Gr.geometry=this.geometry,Gr.material=this.material,Gr.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Wr.copy(this.boundingSphere),Wr.applyMatrix4(n),e.ray.intersectsSphere(Wr)!==!1))for(let r=0;r<s;r++){this.getMatrixAt(r,cr),xd.multiplyMatrices(n,cr),Gr.matrixWorld=xd,Gr.raycast(e,So);for(let a=0,o=So.length;a<o;a++){const l=So[a];l.instanceId=r,l.object=this,t.push(l)}So.length=0}}setColorAt(e,t){this.instanceColor===null&&(this.instanceColor=new Us(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3)}setMatrixAt(e,t){t.toArray(this.instanceMatrix.array,e*16)}setMorphAt(e,t){const n=t.morphTargetInfluences,s=n.length+1;this.morphTexture===null&&(this.morphTexture=new si(new Float32Array(s*this.count),s,this.count,Ql,Cn));const r=this.morphTexture.source.data.data;let a=0;for(let c=0;c<n.length;c++)a+=n[c];const o=this.geometry.morphTargetsRelative?1:1-a,l=s*e;r[l]=o,r.set(n,l+1)}updateMorphTargets(){}dispose(){return this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null),this}}function gh(i,e){return i-e}function Gv(i,e){return i.z-e.z}function Wv(i,e){return e.z-i.z}class Xv{constructor(){this.index=0,this.pool=[],this.list=[]}push(e,t,n,s){const r=this.pool,a=this.list;this.index>=r.length&&r.push({start:-1,count:-1,z:-1,index:-1});const o=r[this.index];a.push(o),this.index++,o.start=e,o.count=t,o.z=n,o.index=s}reset(){this.list.length=0,this.index=0}}const wn=new Ye,Yv=new re(1,1,1),yh=new Na,wo=new jt,fs=new gn,Xr=new w,Md=new w,Zv=new w,_h=new Xv,un=new lt,To=[];function qv(i,e,t=0){const n=e.itemSize;if(i.isInterleavedBufferAttribute||i.array.constructor!==e.array.constructor){const s=i.count;for(let r=0;r<s;r++)for(let a=0;a<n;a++)e.setComponent(r+t,a,i.getComponent(r,a))}else e.array.set(i.array,t*n);e.needsUpdate=!0}function us(i,e){if(i.constructor!==e.constructor){const t=Math.min(i.length,e.length);for(let n=0;n<t;n++)e[n]=i[n]}else{const t=Math.min(i.length,e.length);e.set(new i.constructor(i.buffer,0,t))}}class v0 extends lt{get maxInstanceCount(){return this._maxInstanceCount}get instanceCount(){return this._instanceInfo.length-this._availableInstanceIds.length}get unusedVertexCount(){return this._maxVertexCount-this._nextVertexStart}get unusedIndexCount(){return this._maxIndexCount-this._nextIndexStart}constructor(e,t,n=t*2,s){super(new tt,s),this.isBatchedMesh=!0,this.perObjectFrustumCulled=!0,this.sortObjects=!0,this.boundingBox=null,this.boundingSphere=null,this.customSort=null,this._instanceInfo=[],this._geometryInfo=[],this._availableInstanceIds=[],this._availableGeometryIds=[],this._nextIndexStart=0,this._nextVertexStart=0,this._geometryCount=0,this._visibilityChanged=!0,this._geometryInitialized=!1,this._maxInstanceCount=e,this._maxVertexCount=t,this._maxIndexCount=n,this._multiDrawCounts=new Int32Array(e),this._multiDrawStarts=new Int32Array(e),this._multiDrawCount=0,this._multiDrawInstances=null,this._matricesTexture=null,this._indirectTexture=null,this._colorsTexture=null,this._initMatricesTexture(),this._initIndirectTexture()}_initMatricesTexture(){let e=Math.sqrt(this._maxInstanceCount*4);e=Math.ceil(e/4)*4,e=Math.max(e,4);const t=new Float32Array(e*e*4),n=new si(t,e,e,mn,Cn);this._matricesTexture=n}_initIndirectTexture(){let e=Math.sqrt(this._maxInstanceCount);e=Math.ceil(e);const t=new Uint32Array(e*e),n=new si(t,e,e,La,Ni);this._indirectTexture=n}_initColorsTexture(){let e=Math.sqrt(this._maxInstanceCount);e=Math.ceil(e);const t=new Float32Array(e*e*4).fill(1),n=new si(t,e,e,mn,Cn);n.colorSpace=ct.workingColorSpace,this._colorsTexture=n}_initializeGeometry(e){const t=this.geometry,n=this._maxVertexCount,s=this._maxIndexCount;if(this._geometryInitialized===!1){for(const r in e.attributes){const a=e.getAttribute(r),{array:o,itemSize:l,normalized:c}=a,h=new o.constructor(n*l),f=new Et(h,l,c);t.setAttribute(r,f)}if(e.getIndex()!==null){const r=n>65535?new Uint32Array(s):new Uint16Array(s);t.setIndex(new Et(r,1))}this._geometryInitialized=!0}}_validateGeometry(e){const t=this.geometry;if(!!e.getIndex()!=!!t.getIndex())throw new Error('BatchedMesh: All geometries must consistently have "index".');for(const n in t.attributes){if(!e.hasAttribute(n))throw new Error(`BatchedMesh: Added geometry missing "${n}". All geometries must have consistent attributes.`);const s=e.getAttribute(n),r=t.getAttribute(n);if(s.itemSize!==r.itemSize||s.normalized!==r.normalized)throw new Error("BatchedMesh: All attributes must have a consistent itemSize and normalized value.")}}setCustomSort(e){return this.customSort=e,this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new jt);const e=this.boundingBox,t=this._instanceInfo;e.makeEmpty();for(let n=0,s=t.length;n<s;n++){if(t[n].active===!1)continue;const r=t[n].geometryIndex;this.getMatrixAt(n,wn),this.getBoundingBoxAt(r,wo).applyMatrix4(wn),e.union(wo)}}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new gn);const e=this.boundingSphere,t=this._instanceInfo;e.makeEmpty();for(let n=0,s=t.length;n<s;n++){if(t[n].active===!1)continue;const r=t[n].geometryIndex;this.getMatrixAt(n,wn),this.getBoundingSphereAt(r,fs).applyMatrix4(wn),e.union(fs)}}addInstance(e){if(this._instanceInfo.length>=this.maxInstanceCount&&this._availableInstanceIds.length===0)throw new Error("BatchedMesh: Maximum item count reached.");const n={visible:!0,active:!0,geometryIndex:e};let s=null;this._availableInstanceIds.length>0?(this._availableInstanceIds.sort(gh),s=this._availableInstanceIds.shift(),this._instanceInfo[s]=n):(s=this._instanceInfo.length,this._instanceInfo.push(n));const r=this._matricesTexture;wn.identity().toArray(r.image.data,s*16),r.needsUpdate=!0;const a=this._colorsTexture;return a&&(Yv.toArray(a.image.data,s*4),a.needsUpdate=!0),this._visibilityChanged=!0,s}addGeometry(e,t=-1,n=-1){this._initializeGeometry(e),this._validateGeometry(e);const s={vertexStart:-1,vertexCount:-1,reservedVertexCount:-1,indexStart:-1,indexCount:-1,reservedIndexCount:-1,start:-1,count:-1,boundingBox:null,boundingSphere:null,active:!0},r=this._geometryInfo;s.vertexStart=this._nextVertexStart,s.reservedVertexCount=t===-1?e.getAttribute("position").count:t;const a=e.getIndex();if(a!==null&&(s.indexStart=this._nextIndexStart,s.reservedIndexCount=n===-1?a.count:n),s.indexStart!==-1&&s.indexStart+s.reservedIndexCount>this._maxIndexCount||s.vertexStart+s.reservedVertexCount>this._maxVertexCount)throw new Error("BatchedMesh: Reserved space request exceeds the maximum buffer size.");let l;return this._availableGeometryIds.length>0?(this._availableGeometryIds.sort(gh),l=this._availableGeometryIds.shift(),r[l]=s):(l=this._geometryCount,this._geometryCount++,r.push(s)),this.setGeometryAt(l,e),this._nextIndexStart=s.indexStart+s.reservedIndexCount,this._nextVertexStart=s.vertexStart+s.reservedVertexCount,l}setGeometryAt(e,t){if(e>=this._geometryCount)throw new Error("BatchedMesh: Maximum geometry count reached.");this._validateGeometry(t);const n=this.geometry,s=n.getIndex()!==null,r=n.getIndex(),a=t.getIndex(),o=this._geometryInfo[e];if(s&&a.count>o.reservedIndexCount||t.attributes.position.count>o.reservedVertexCount)throw new Error("BatchedMesh: Reserved space not large enough for provided geometry.");const l=o.vertexStart,c=o.reservedVertexCount;o.vertexCount=t.getAttribute("position").count;for(const h in n.attributes){const f=t.getAttribute(h),p=n.getAttribute(h);qv(f,p,l);const u=f.itemSize;for(let g=f.count,y=c;g<y;g++){const d=l+g;for(let m=0;m<u;m++)p.setComponent(d,m,0)}p.needsUpdate=!0,p.addUpdateRange(l*u,c*u)}if(s){const h=o.indexStart,f=o.reservedIndexCount;o.indexCount=t.getIndex().count;for(let p=0;p<a.count;p++)r.setX(h+p,l+a.getX(p));for(let p=a.count,u=f;p<u;p++)r.setX(h+p,l);r.needsUpdate=!0,r.addUpdateRange(h,o.reservedIndexCount)}return o.start=s?o.indexStart:o.vertexStart,o.count=s?o.indexCount:o.vertexCount,o.boundingBox=null,t.boundingBox!==null&&(o.boundingBox=t.boundingBox.clone()),o.boundingSphere=null,t.boundingSphere!==null&&(o.boundingSphere=t.boundingSphere.clone()),this._visibilityChanged=!0,e}deleteGeometry(e){const t=this._geometryInfo;if(e>=t.length||t[e].active===!1)return this;const n=this._instanceInfo;for(let s=0,r=n.length;s<r;s++)n[s].geometryIndex===e&&this.deleteInstance(s);return t[e].active=!1,this._availableGeometryIds.push(e),this._visibilityChanged=!0,this}deleteInstance(e){const t=this._instanceInfo;return e>=t.length||t[e].active===!1?this:(t[e].active=!1,this._availableInstanceIds.push(e),this._visibilityChanged=!0,this)}optimize(){let e=0,t=0;const n=this._geometryInfo,s=n.map((a,o)=>o).sort((a,o)=>n[a].vertexStart-n[o].vertexStart),r=this.geometry;for(let a=0,o=n.length;a<o;a++){const l=s[a],c=n[l];if(c.active!==!1){if(r.index!==null){if(c.indexStart!==t){const{indexStart:h,vertexStart:f,reservedIndexCount:p}=c,u=r.index,g=u.array,y=e-f;for(let d=h;d<h+p;d++)g[d]=g[d]+y;u.array.copyWithin(t,h,h+p),u.addUpdateRange(t,p),c.indexStart=t}t+=c.reservedIndexCount}if(c.vertexStart!==e){const{vertexStart:h,reservedVertexCount:f}=c,p=r.attributes;for(const u in p){const g=p[u],{array:y,itemSize:d}=g;y.copyWithin(e*d,h*d,(h+f)*d),g.addUpdateRange(e*d,f*d)}c.vertexStart=e}e+=c.reservedVertexCount,c.start=r.index?c.indexStart:c.vertexStart,this._nextIndexStart=r.index?c.indexStart+c.reservedIndexCount:0,this._nextVertexStart=c.vertexStart+c.reservedVertexCount}}return this}getBoundingBoxAt(e,t){if(e>=this._geometryCount)return null;const n=this.geometry,s=this._geometryInfo[e];if(s.boundingBox===null){const r=new jt,a=n.index,o=n.attributes.position;for(let l=s.start,c=s.start+s.count;l<c;l++){let h=l;a&&(h=a.getX(h)),r.expandByPoint(Xr.fromBufferAttribute(o,h))}s.boundingBox=r}return t.copy(s.boundingBox),t}getBoundingSphereAt(e,t){if(e>=this._geometryCount)return null;const n=this.geometry,s=this._geometryInfo[e];if(s.boundingSphere===null){const r=new gn;this.getBoundingBoxAt(e,wo),wo.getCenter(r.center);const a=n.index,o=n.attributes.position;let l=0;for(let c=s.start,h=s.start+s.count;c<h;c++){let f=c;a&&(f=a.getX(f)),Xr.fromBufferAttribute(o,f),l=Math.max(l,r.center.distanceToSquared(Xr))}r.radius=Math.sqrt(l),s.boundingSphere=r}return t.copy(s.boundingSphere),t}setMatrixAt(e,t){const n=this._instanceInfo,s=this._matricesTexture,r=this._matricesTexture.image.data;return e>=n.length||n[e].active===!1?this:(t.toArray(r,e*16),s.needsUpdate=!0,this)}getMatrixAt(e,t){const n=this._instanceInfo,s=this._matricesTexture.image.data;return e>=n.length||n[e].active===!1?null:t.fromArray(s,e*16)}setColorAt(e,t){this._colorsTexture===null&&this._initColorsTexture();const n=this._colorsTexture,s=this._colorsTexture.image.data,r=this._instanceInfo;return e>=r.length||r[e].active===!1?this:(t.toArray(s,e*4),n.needsUpdate=!0,this)}getColorAt(e,t){const n=this._colorsTexture.image.data,s=this._instanceInfo;return e>=s.length||s[e].active===!1?null:t.fromArray(n,e*4)}setVisibleAt(e,t){const n=this._instanceInfo;return e>=n.length||n[e].active===!1||n[e].visible===t?this:(n[e].visible=t,this._visibilityChanged=!0,this)}getVisibleAt(e){const t=this._instanceInfo;return e>=t.length||t[e].active===!1?!1:t[e].visible}setGeometryIdAt(e,t){const n=this._instanceInfo,s=this._geometryInfo;return e>=n.length||n[e].active===!1||t>=s.length||s[t].active===!1?null:(n[e].geometryIndex=t,this)}getGeometryIdAt(e){const t=this._instanceInfo;return e>=t.length||t[e].active===!1?-1:t[e].geometryIndex}getGeometryRangeAt(e,t={}){if(e<0||e>=this._geometryCount)return null;const n=this._geometryInfo[e];return t.vertexStart=n.vertexStart,t.vertexCount=n.vertexCount,t.reservedVertexCount=n.reservedVertexCount,t.indexStart=n.indexStart,t.indexCount=n.indexCount,t.reservedIndexCount=n.reservedIndexCount,t.start=n.start,t.count=n.count,t}setInstanceCount(e){const t=this._availableInstanceIds,n=this._instanceInfo;for(t.sort(gh);t[t.length-1]===n.length;)n.pop(),t.pop();if(e<n.length)throw new Error(`BatchedMesh: Instance ids outside the range ${e} are being used. Cannot shrink instance count.`);const s=new Int32Array(e),r=new Int32Array(e);us(this._multiDrawCounts,s),us(this._multiDrawStarts,r),this._multiDrawCounts=s,this._multiDrawStarts=r,this._maxInstanceCount=e;const a=this._indirectTexture,o=this._matricesTexture,l=this._colorsTexture;a.dispose(),this._initIndirectTexture(),us(a.image.data,this._indirectTexture.image.data),o.dispose(),this._initMatricesTexture(),us(o.image.data,this._matricesTexture.image.data),l&&(l.dispose(),this._initColorsTexture(),us(l.image.data,this._colorsTexture.image.data))}setGeometrySize(e,t){const n=[...this._geometryInfo].filter(o=>o.active);if(Math.max(...n.map(o=>o.vertexStart+o.reservedVertexCount))>e)throw new Error(`BatchedMesh: Geometry vertex values are being used outside the range ${t}. Cannot shrink further.`);if(this.geometry.index&&Math.max(...n.map(l=>l.indexStart+l.reservedIndexCount))>t)throw new Error(`BatchedMesh: Geometry index values are being used outside the range ${t}. Cannot shrink further.`);const r=this.geometry;r.dispose(),this._maxVertexCount=e,this._maxIndexCount=t,this._geometryInitialized&&(this._geometryInitialized=!1,this.geometry=new tt,this._initializeGeometry(r));const a=this.geometry;r.index&&us(r.index.array,a.index.array);for(const o in r.attributes)us(r.attributes[o].array,a.attributes[o].array)}raycast(e,t){const n=this._instanceInfo,s=this._geometryInfo,r=this.matrixWorld,a=this.geometry;un.material=this.material,un.geometry.index=a.index,un.geometry.attributes=a.attributes,un.geometry.boundingBox===null&&(un.geometry.boundingBox=new jt),un.geometry.boundingSphere===null&&(un.geometry.boundingSphere=new gn);for(let o=0,l=n.length;o<l;o++){if(!n[o].visible||!n[o].active)continue;const c=n[o].geometryIndex,h=s[c];un.geometry.setDrawRange(h.start,h.count),this.getMatrixAt(o,un.matrixWorld).premultiply(r),this.getBoundingBoxAt(c,un.geometry.boundingBox),this.getBoundingSphereAt(c,un.geometry.boundingSphere),un.raycast(e,To);for(let f=0,p=To.length;f<p;f++){const u=To[f];u.object=this,u.batchId=o,t.push(u)}To.length=0}un.material=null,un.geometry.index=null,un.geometry.attributes={},un.geometry.setDrawRange(0,1/0)}copy(e){return super.copy(e),this.geometry=e.geometry.clone(),this.perObjectFrustumCulled=e.perObjectFrustumCulled,this.sortObjects=e.sortObjects,this.boundingBox=e.boundingBox!==null?e.boundingBox.clone():null,this.boundingSphere=e.boundingSphere!==null?e.boundingSphere.clone():null,this._geometryInfo=e._geometryInfo.map(t=>({...t,boundingBox:t.boundingBox!==null?t.boundingBox.clone():null,boundingSphere:t.boundingSphere!==null?t.boundingSphere.clone():null})),this._instanceInfo=e._instanceInfo.map(t=>({...t})),this._maxInstanceCount=e._maxInstanceCount,this._maxVertexCount=e._maxVertexCount,this._maxIndexCount=e._maxIndexCount,this._geometryInitialized=e._geometryInitialized,this._geometryCount=e._geometryCount,this._multiDrawCounts=e._multiDrawCounts.slice(),this._multiDrawStarts=e._multiDrawStarts.slice(),this._matricesTexture=e._matricesTexture.clone(),this._matricesTexture.image.data=this._matricesTexture.image.data.slice(),this._colorsTexture!==null&&(this._colorsTexture=e._colorsTexture.clone(),this._colorsTexture.image.data=this._colorsTexture.image.data.slice()),this}dispose(){return this.geometry.dispose(),this._matricesTexture.dispose(),this._matricesTexture=null,this._indirectTexture.dispose(),this._indirectTexture=null,this._colorsTexture!==null&&(this._colorsTexture.dispose(),this._colorsTexture=null),this}onBeforeRender(e,t,n,s,r){if(!this._visibilityChanged&&!this.perObjectFrustumCulled&&!this.sortObjects)return;const a=s.getIndex(),o=a===null?1:a.array.BYTES_PER_ELEMENT,l=this._instanceInfo,c=this._multiDrawStarts,h=this._multiDrawCounts,f=this._geometryInfo,p=this.perObjectFrustumCulled,u=this._indirectTexture,g=u.image.data;p&&(wn.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse).multiply(this.matrixWorld),yh.setFromProjectionMatrix(wn,e.coordinateSystem));let y=0;if(this.sortObjects){wn.copy(this.matrixWorld).invert(),Xr.setFromMatrixPosition(n.matrixWorld).applyMatrix4(wn),Md.set(0,0,-1).transformDirection(n.matrixWorld).transformDirection(wn);for(let _=0,x=l.length;_<x;_++)if(l[_].visible&&l[_].active){const v=l[_].geometryIndex;this.getMatrixAt(_,wn),this.getBoundingSphereAt(v,fs).applyMatrix4(wn);let E=!1;if(p&&(E=!yh.intersectsSphere(fs)),!E){const T=f[v],R=Zv.subVectors(fs.center,Xr).dot(Md);_h.push(T.start,T.count,R,_)}}const d=_h.list,m=this.customSort;m===null?d.sort(r.transparent?Wv:Gv):m.call(this,d,n);for(let _=0,x=d.length;_<x;_++){const v=d[_];c[y]=v.start*o,h[y]=v.count,g[y]=v.index,y++}_h.reset()}else for(let d=0,m=l.length;d<m;d++)if(l[d].visible&&l[d].active){const _=l[d].geometryIndex;let x=!1;if(p&&(this.getMatrixAt(d,wn),this.getBoundingSphereAt(_,fs).applyMatrix4(wn),x=!yh.intersectsSphere(fs)),!x){const v=f[_];c[y]=v.start*o,h[y]=v.count,g[y]=d,y++}}u.needsUpdate=!0,this._multiDrawCount=y,this._visibilityChanged=!1}onBeforeShadow(e,t,n,s,r,a){this.onBeforeRender(e,null,s,r,a)}}class bn extends yn{static get type(){return"LineBasicMaterial"}constructor(e){super(),this.isLineBasicMaterial=!0,this.color=new re(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}}const Fl=new w,Bl=new w,bd=new Ye,Yr=new Vs,Ao=new gn,xh=new w,Sd=new w;class ji extends dt{constructor(e=new tt,t=new bn){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,n=[0];for(let s=1,r=t.count;s<r;s++)Fl.fromBufferAttribute(t,s-1),Bl.fromBufferAttribute(t,s),n[s]=n[s-1],n[s]+=Fl.distanceTo(Bl);e.setAttribute("lineDistance",new ze(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){const n=this.geometry,s=this.matrixWorld,r=e.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Ao.copy(n.boundingSphere),Ao.applyMatrix4(s),Ao.radius+=r,e.ray.intersectsSphere(Ao)===!1)return;bd.copy(s).invert(),Yr.copy(e.ray).applyMatrix4(bd);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=this.isLineSegments?2:1,h=n.index,p=n.attributes.position;if(h!==null){const u=Math.max(0,a.start),g=Math.min(h.count,a.start+a.count);for(let y=u,d=g-1;y<d;y+=c){const m=h.getX(y),_=h.getX(y+1),x=Eo(this,e,Yr,l,m,_);x&&t.push(x)}if(this.isLineLoop){const y=h.getX(g-1),d=h.getX(u),m=Eo(this,e,Yr,l,y,d);m&&t.push(m)}}else{const u=Math.max(0,a.start),g=Math.min(p.count,a.start+a.count);for(let y=u,d=g-1;y<d;y+=c){const m=Eo(this,e,Yr,l,y,y+1);m&&t.push(m)}if(this.isLineLoop){const y=Eo(this,e,Yr,l,g-1,u);y&&t.push(y)}}}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function Eo(i,e,t,n,s,r){const a=i.geometry.attributes.position;if(Fl.fromBufferAttribute(a,s),Bl.fromBufferAttribute(a,r),t.distanceSqToSegment(Fl,Bl,xh,Sd)>n)return;xh.applyMatrix4(i.matrixWorld);const l=e.ray.origin.distanceTo(xh);if(!(l<e.near||l>e.far))return{distance:l,point:Sd.clone().applyMatrix4(i.matrixWorld),index:s,face:null,faceIndex:null,barycoord:null,object:i}}const wd=new w,Td=new w;class Mi extends ji{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,n=[];for(let s=0,r=t.count;s<r;s+=2)wd.fromBufferAttribute(t,s),Td.fromBufferAttribute(t,s+1),n[s]=s===0?0:n[s-1],n[s+1]=n[s]+wd.distanceTo(Td);e.setAttribute("lineDistance",new ze(n,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class M0 extends ji{constructor(e,t){super(e,t),this.isLineLoop=!0,this.type="LineLoop"}}class Lf extends yn{static get type(){return"PointsMaterial"}constructor(e){super(),this.isPointsMaterial=!0,this.color=new re(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}const Ad=new Ye,Jh=new Vs,Co=new gn,Ro=new w;class b0 extends dt{constructor(e=new tt,t=new Lf){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){const n=this.geometry,s=this.matrixWorld,r=e.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Co.copy(n.boundingSphere),Co.applyMatrix4(s),Co.radius+=r,e.ray.intersectsSphere(Co)===!1)return;Ad.copy(s).invert(),Jh.copy(e.ray).applyMatrix4(Ad);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=n.index,f=n.attributes.position;if(c!==null){const p=Math.max(0,a.start),u=Math.min(c.count,a.start+a.count);for(let g=p,y=u;g<y;g++){const d=c.getX(g);Ro.fromBufferAttribute(f,d),Ed(Ro,d,l,s,e,t,this)}}else{const p=Math.max(0,a.start),u=Math.min(f.count,a.start+a.count);for(let g=p,y=u;g<y;g++)Ro.fromBufferAttribute(f,g),Ed(Ro,g,l,s,e,t,this)}}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function Ed(i,e,t,n,s,r,a){const o=Jh.distanceSqToPoint(i);if(o<t){const l=new w;Jh.closestPointToPoint(i,l),l.applyMatrix4(n);const c=s.ray.origin.distanceTo(l);if(c<s.near||c>s.far)return;r.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:a})}}class $v extends Ht{constructor(e,t,n,s,r,a,o,l,c){super(e,t,n,s,r,a,o,l,c),this.isVideoTexture=!0,this.minFilter=a!==void 0?a:Vt,this.magFilter=r!==void 0?r:Vt,this.generateMipmaps=!1;const h=this;function f(){h.needsUpdate=!0,e.requestVideoFrameCallback(f)}"requestVideoFrameCallback"in e&&e.requestVideoFrameCallback(f)}clone(){return new this.constructor(this.image).copy(this)}update(){const e=this.image;"requestVideoFrameCallback"in e===!1&&e.readyState>=e.HAVE_CURRENT_DATA&&(this.needsUpdate=!0)}}class Kv extends Ht{constructor(e,t){super({width:e,height:t}),this.isFramebufferTexture=!0,this.magFilter=Qt,this.minFilter=Qt,this.generateMipmaps=!1,this.needsUpdate=!0}}class fc extends Ht{constructor(e,t,n,s,r,a,o,l,c,h,f,p){super(null,a,o,l,c,h,s,r,f,p),this.isCompressedTexture=!0,this.image={width:t,height:n},this.mipmaps=e,this.flipY=!1,this.generateMipmaps=!1}}class Jv extends fc{constructor(e,t,n,s,r,a){super(e,t,n,r,a),this.isCompressedArrayTexture=!0,this.image.depth=s,this.wrapR=Wn,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class jv extends fc{constructor(e,t,n){super(void 0,e[0].width,e[0].height,t,n,Ui),this.isCompressedCubeTexture=!0,this.isCubeTexture=!0,this.image=e}}class Ns extends Ht{constructor(e,t,n,s,r,a,o,l,c){super(e,t,n,s,r,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class ai{constructor(){this.type="Curve",this.arcLengthDivisions=200}getPoint(){return console.warn("THREE.Curve: .getPoint() not implemented."),null}getPointAt(e,t){const n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){const t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){const t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){const e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const t=[];let n,s=this.getPoint(0),r=0;t.push(0);for(let a=1;a<=e;a++)n=this.getPoint(a/e),r+=n.distanceTo(s),t.push(r),s=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t){const n=this.getLengths();let s=0;const r=n.length;let a;t?a=t:a=e*n[r-1];let o=0,l=r-1,c;for(;o<=l;)if(s=Math.floor(o+(l-o)/2),c=n[s]-a,c<0)o=s+1;else if(c>0)l=s-1;else{l=s;break}if(s=l,n[s]===a)return s/(r-1);const h=n[s],p=n[s+1]-h,u=(a-h)/p;return(s+u)/(r-1)}getTangent(e,t){let s=e-1e-4,r=e+1e-4;s<0&&(s=0),r>1&&(r=1);const a=this.getPoint(s),o=this.getPoint(r),l=t||(a.isVector2?new $:new w);return l.copy(o).sub(a).normalize(),l}getTangentAt(e,t){const n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t){const n=new w,s=[],r=[],a=[],o=new w,l=new Ye;for(let u=0;u<=e;u++){const g=u/e;s[u]=this.getTangentAt(g,new w)}r[0]=new w,a[0]=new w;let c=Number.MAX_VALUE;const h=Math.abs(s[0].x),f=Math.abs(s[0].y),p=Math.abs(s[0].z);h<=c&&(c=h,n.set(1,0,0)),f<=c&&(c=f,n.set(0,1,0)),p<=c&&n.set(0,0,1),o.crossVectors(s[0],n).normalize(),r[0].crossVectors(s[0],o),a[0].crossVectors(s[0],r[0]);for(let u=1;u<=e;u++){if(r[u]=r[u-1].clone(),a[u]=a[u-1].clone(),o.crossVectors(s[u-1],s[u]),o.length()>Number.EPSILON){o.normalize();const g=Math.acos(kt(s[u-1].dot(s[u]),-1,1));r[u].applyMatrix4(l.makeRotationAxis(o,g))}a[u].crossVectors(s[u],r[u])}if(t===!0){let u=Math.acos(kt(r[0].dot(r[e]),-1,1));u/=e,s[0].dot(o.crossVectors(r[0],r[e]))>0&&(u=-u);for(let g=1;g<=e;g++)r[g].applyMatrix4(l.makeRotationAxis(s[g],u*g)),a[g].crossVectors(s[g],r[g])}return{tangents:s,normals:r,binormals:a}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){const e={metadata:{version:4.6,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}}class uc extends ai{constructor(e=0,t=0,n=1,s=1,r=0,a=Math.PI*2,o=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=s,this.aStartAngle=r,this.aEndAngle=a,this.aClockwise=o,this.aRotation=l}getPoint(e,t=new $){const n=t,s=Math.PI*2;let r=this.aEndAngle-this.aStartAngle;const a=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=s;for(;r>s;)r-=s;r<Number.EPSILON&&(a?r=0:r=s),this.aClockwise===!0&&!a&&(r===s?r=-s:r=r-s);const o=this.aStartAngle+e*r;let l=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){const h=Math.cos(this.aRotation),f=Math.sin(this.aRotation),p=l-this.aX,u=c-this.aY;l=p*h-u*f+this.aX,c=p*f+u*h+this.aY}return n.set(l,c)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){const e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}}class S0 extends uc{constructor(e,t,n,s,r,a){super(e,t,n,n,s,r,a),this.isArcCurve=!0,this.type="ArcCurve"}}function zf(){let i=0,e=0,t=0,n=0;function s(r,a,o,l){i=r,e=o,t=-3*r+3*a-2*o-l,n=2*r-2*a+o+l}return{initCatmullRom:function(r,a,o,l,c){s(a,o,c*(o-r),c*(l-a))},initNonuniformCatmullRom:function(r,a,o,l,c,h,f){let p=(a-r)/c-(o-r)/(c+h)+(o-a)/h,u=(o-a)/h-(l-a)/(h+f)+(l-o)/f;p*=h,u*=h,s(a,o,p,u)},calc:function(r){const a=r*r,o=a*r;return i+e*r+t*a+n*o}}}const Po=new w,vh=new zf,Mh=new zf,bh=new zf;class Uf extends ai{constructor(e=[],t=!1,n="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=n,this.tension=s}getPoint(e,t=new w){const n=t,s=this.points,r=s.length,a=(r-(this.closed?0:1))*e;let o=Math.floor(a),l=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/r)+1)*r:l===0&&o===r-1&&(o=r-2,l=1);let c,h;this.closed||o>0?c=s[(o-1)%r]:(Po.subVectors(s[0],s[1]).add(s[0]),c=Po);const f=s[o%r],p=s[(o+1)%r];if(this.closed||o+2<r?h=s[(o+2)%r]:(Po.subVectors(s[r-1],s[r-2]).add(s[r-1]),h=Po),this.curveType==="centripetal"||this.curveType==="chordal"){const u=this.curveType==="chordal"?.5:.25;let g=Math.pow(c.distanceToSquared(f),u),y=Math.pow(f.distanceToSquared(p),u),d=Math.pow(p.distanceToSquared(h),u);y<1e-4&&(y=1),g<1e-4&&(g=y),d<1e-4&&(d=y),vh.initNonuniformCatmullRom(c.x,f.x,p.x,h.x,g,y,d),Mh.initNonuniformCatmullRom(c.y,f.y,p.y,h.y,g,y,d),bh.initNonuniformCatmullRom(c.z,f.z,p.z,h.z,g,y,d)}else this.curveType==="catmullrom"&&(vh.initCatmullRom(c.x,f.x,p.x,h.x,this.tension),Mh.initCatmullRom(c.y,f.y,p.y,h.y,this.tension),bh.initCatmullRom(c.z,f.z,p.z,h.z,this.tension));return n.set(vh.calc(l),Mh.calc(l),bh.calc(l)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const s=e.points[t];this.points.push(s.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){const e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){const s=this.points[t];e.points.push(s.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const s=e.points[t];this.points.push(new w().fromArray(s))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}}function Cd(i,e,t,n,s){const r=(n-e)*.5,a=(s-t)*.5,o=i*i,l=i*o;return(2*t-2*n+r+a)*l+(-3*t+3*n-2*r-a)*o+r*i+t}function Qv(i,e){const t=1-i;return t*t*e}function e2(i,e){return 2*(1-i)*i*e}function t2(i,e){return i*i*e}function ca(i,e,t,n){return Qv(i,e)+e2(i,t)+t2(i,n)}function n2(i,e){const t=1-i;return t*t*t*e}function i2(i,e){const t=1-i;return 3*t*t*i*e}function s2(i,e){return 3*(1-i)*i*i*e}function r2(i,e){return i*i*i*e}function ha(i,e,t,n,s){return n2(i,e)+i2(i,t)+s2(i,n)+r2(i,s)}class Nf extends ai{constructor(e=new $,t=new $,n=new $,s=new $){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=n,this.v3=s}getPoint(e,t=new $){const n=t,s=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(ha(e,s.x,r.x,a.x,o.x),ha(e,s.y,r.y,a.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}}class w0 extends ai{constructor(e=new w,t=new w,n=new w,s=new w){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=n,this.v3=s}getPoint(e,t=new w){const n=t,s=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(ha(e,s.x,r.x,a.x,o.x),ha(e,s.y,r.y,a.y,o.y),ha(e,s.z,r.z,a.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}}class Of extends ai{constructor(e=new $,t=new $){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new $){const n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new $){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class T0 extends ai{constructor(e=new w,t=new w){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=e,this.v2=t}getPoint(e,t=new w){const n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new w){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class Ff extends ai{constructor(e=new $,t=new $,n=new $){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new $){const n=t,s=this.v0,r=this.v1,a=this.v2;return n.set(ca(e,s.x,r.x,a.x),ca(e,s.y,r.y,a.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class Bf extends ai{constructor(e=new w,t=new w,n=new w){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new w){const n=t,s=this.v0,r=this.v1,a=this.v2;return n.set(ca(e,s.x,r.x,a.x),ca(e,s.y,r.y,a.y),ca(e,s.z,r.z,a.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class kf extends ai{constructor(e=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=e}getPoint(e,t=new $){const n=t,s=this.points,r=(s.length-1)*e,a=Math.floor(r),o=r-a,l=s[a===0?a:a-1],c=s[a],h=s[a>s.length-2?s.length-1:a+1],f=s[a>s.length-3?s.length-1:a+2];return n.set(Cd(o,l.x,c.x,h.x,f.x),Cd(o,l.y,c.y,h.y,f.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const s=e.points[t];this.points.push(s.clone())}return this}toJSON(){const e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){const s=this.points[t];e.points.push(s.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const s=e.points[t];this.points.push(new $().fromArray(s))}return this}}var kl=Object.freeze({__proto__:null,ArcCurve:S0,CatmullRomCurve3:Uf,CubicBezierCurve:Nf,CubicBezierCurve3:w0,EllipseCurve:uc,LineCurve:Of,LineCurve3:T0,QuadraticBezierCurve:Ff,QuadraticBezierCurve3:Bf,SplineCurve:kf});class A0 extends ai{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(e){this.curves.push(e)}closePath(){const e=this.curves[0].getPoint(0),t=this.curves[this.curves.length-1].getPoint(1);if(!e.equals(t)){const n=e.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new kl[n](t,e))}return this}getPoint(e,t){const n=e*this.getLength(),s=this.getCurveLengths();let r=0;for(;r<s.length;){if(s[r]>=n){const a=s[r]-n,o=this.curves[r],l=o.getLength(),c=l===0?0:1-a/l;return o.getPointAt(c,t)}r++}return null}getLength(){const e=this.getCurveLengths();return e[e.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;const e=[];let t=0;for(let n=0,s=this.curves.length;n<s;n++)t+=this.curves[n].getLength(),e.push(t);return this.cacheLengths=e,e}getSpacedPoints(e=40){const t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return this.autoClose&&t.push(t[0]),t}getPoints(e=12){const t=[];let n;for(let s=0,r=this.curves;s<r.length;s++){const a=r[s],o=a.isEllipseCurve?e*2:a.isLineCurve||a.isLineCurve3?1:a.isSplineCurve?e*a.points.length:e,l=a.getPoints(o);for(let c=0;c<l.length;c++){const h=l[c];n&&n.equals(h)||(t.push(h),n=h)}}return this.autoClose&&t.length>1&&!t[t.length-1].equals(t[0])&&t.push(t[0]),t}copy(e){super.copy(e),this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){const s=e.curves[t];this.curves.push(s.clone())}return this.autoClose=e.autoClose,this}toJSON(){const e=super.toJSON();e.autoClose=this.autoClose,e.curves=[];for(let t=0,n=this.curves.length;t<n;t++){const s=this.curves[t];e.curves.push(s.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.autoClose=e.autoClose,this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){const s=e.curves[t];this.curves.push(new kl[s.type]().fromJSON(s))}return this}}class Ma extends A0{constructor(e){super(),this.type="Path",this.currentPoint=new $,e&&this.setFromPoints(e)}setFromPoints(e){this.moveTo(e[0].x,e[0].y);for(let t=1,n=e.length;t<n;t++)this.lineTo(e[t].x,e[t].y);return this}moveTo(e,t){return this.currentPoint.set(e,t),this}lineTo(e,t){const n=new Of(this.currentPoint.clone(),new $(e,t));return this.curves.push(n),this.currentPoint.set(e,t),this}quadraticCurveTo(e,t,n,s){const r=new Ff(this.currentPoint.clone(),new $(e,t),new $(n,s));return this.curves.push(r),this.currentPoint.set(n,s),this}bezierCurveTo(e,t,n,s,r,a){const o=new Nf(this.currentPoint.clone(),new $(e,t),new $(n,s),new $(r,a));return this.curves.push(o),this.currentPoint.set(r,a),this}splineThru(e){const t=[this.currentPoint.clone()].concat(e),n=new kf(t);return this.curves.push(n),this.currentPoint.copy(e[e.length-1]),this}arc(e,t,n,s,r,a){const o=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(e+o,t+l,n,s,r,a),this}absarc(e,t,n,s,r,a){return this.absellipse(e,t,n,n,s,r,a),this}ellipse(e,t,n,s,r,a,o,l){const c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(e+c,t+h,n,s,r,a,o,l),this}absellipse(e,t,n,s,r,a,o,l){const c=new uc(e,t,n,s,r,a,o,l);if(this.curves.length>0){const f=c.getPoint(0);f.equals(this.currentPoint)||this.lineTo(f.x,f.y)}this.curves.push(c);const h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(e){return super.copy(e),this.currentPoint.copy(e.currentPoint),this}toJSON(){const e=super.toJSON();return e.currentPoint=this.currentPoint.toArray(),e}fromJSON(e){return super.fromJSON(e),this.currentPoint.fromArray(e.currentPoint),this}}class ka extends tt{constructor(e=[new $(0,-.5),new $(.5,0),new $(0,.5)],t=12,n=0,s=Math.PI*2){super(),this.type="LatheGeometry",this.parameters={points:e,segments:t,phiStart:n,phiLength:s},t=Math.floor(t),s=kt(s,0,Math.PI*2);const r=[],a=[],o=[],l=[],c=[],h=1/t,f=new w,p=new $,u=new w,g=new w,y=new w;let d=0,m=0;for(let _=0;_<=e.length-1;_++)switch(_){case 0:d=e[_+1].x-e[_].x,m=e[_+1].y-e[_].y,u.x=m*1,u.y=-d,u.z=m*0,y.copy(u),u.normalize(),l.push(u.x,u.y,u.z);break;case e.length-1:l.push(y.x,y.y,y.z);break;default:d=e[_+1].x-e[_].x,m=e[_+1].y-e[_].y,u.x=m*1,u.y=-d,u.z=m*0,g.copy(u),u.x+=y.x,u.y+=y.y,u.z+=y.z,u.normalize(),l.push(u.x,u.y,u.z),y.copy(g)}for(let _=0;_<=t;_++){const x=n+_*h*s,v=Math.sin(x),E=Math.cos(x);for(let T=0;T<=e.length-1;T++){f.x=e[T].x*v,f.y=e[T].y,f.z=e[T].x*E,a.push(f.x,f.y,f.z),p.x=_/t,p.y=T/(e.length-1),o.push(p.x,p.y);const R=l[3*T+0]*v,P=l[3*T+1],S=l[3*T+0]*E;c.push(R,P,S)}}for(let _=0;_<t;_++)for(let x=0;x<e.length-1;x++){const v=x+_*e.length,E=v,T=v+e.length,R=v+e.length+1,P=v+1;r.push(E,T,P),r.push(R,P,T)}this.setIndex(r),this.setAttribute("position",new ze(a,3)),this.setAttribute("uv",new ze(o,2)),this.setAttribute("normal",new ze(c,3))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new ka(e.points,e.segments,e.phiStart,e.phiLength)}}class dc extends ka{constructor(e=1,t=1,n=4,s=8){const r=new Ma;r.absarc(0,-t/2,e,Math.PI*1.5,0),r.absarc(0,t/2,e,0,Math.PI*.5),super(r.getPoints(n),s),this.type="CapsuleGeometry",this.parameters={radius:e,length:t,capSegments:n,radialSegments:s}}static fromJSON(e){return new dc(e.radius,e.length,e.capSegments,e.radialSegments)}}class pc extends tt{constructor(e=1,t=32,n=0,s=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:n,thetaLength:s},t=Math.max(3,t);const r=[],a=[],o=[],l=[],c=new w,h=new $;a.push(0,0,0),o.push(0,0,1),l.push(.5,.5);for(let f=0,p=3;f<=t;f++,p+=3){const u=n+f/t*s;c.x=e*Math.cos(u),c.y=e*Math.sin(u),a.push(c.x,c.y,c.z),o.push(0,0,1),h.x=(a[p]/e+1)/2,h.y=(a[p+1]/e+1)/2,l.push(h.x,h.y)}for(let f=1;f<=t;f++)r.push(f,f+1,0);this.setIndex(r),this.setAttribute("position",new ze(a,3)),this.setAttribute("normal",new ze(o,3)),this.setAttribute("uv",new ze(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new pc(e.radius,e.segments,e.thetaStart,e.thetaLength)}}class Xn extends tt{constructor(e=1,t=1,n=1,s=32,r=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:s,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l};const c=this;s=Math.floor(s),r=Math.floor(r);const h=[],f=[],p=[],u=[];let g=0;const y=[],d=n/2;let m=0;_(),a===!1&&(e>0&&x(!0),t>0&&x(!1)),this.setIndex(h),this.setAttribute("position",new ze(f,3)),this.setAttribute("normal",new ze(p,3)),this.setAttribute("uv",new ze(u,2));function _(){const v=new w,E=new w;let T=0;const R=(t-e)/n;for(let P=0;P<=r;P++){const S=[],M=P/r,D=M*(t-e)+e;for(let U=0;U<=s;U++){const B=U/s,G=B*l+o,Y=Math.sin(G),W=Math.cos(G);E.x=D*Y,E.y=-M*n+d,E.z=D*W,f.push(E.x,E.y,E.z),v.set(Y,R,W).normalize(),p.push(v.x,v.y,v.z),u.push(B,1-M),S.push(g++)}y.push(S)}for(let P=0;P<s;P++)for(let S=0;S<r;S++){const M=y[S][P],D=y[S+1][P],U=y[S+1][P+1],B=y[S][P+1];(e>0||S!==0)&&(h.push(M,D,B),T+=3),(t>0||S!==r-1)&&(h.push(D,U,B),T+=3)}c.addGroup(m,T,0),m+=T}function x(v){const E=g,T=new $,R=new w;let P=0;const S=v===!0?e:t,M=v===!0?1:-1;for(let U=1;U<=s;U++)f.push(0,d*M,0),p.push(0,M,0),u.push(.5,.5),g++;const D=g;for(let U=0;U<=s;U++){const G=U/s*l+o,Y=Math.cos(G),W=Math.sin(G);R.x=S*W,R.y=d*M,R.z=S*Y,f.push(R.x,R.y,R.z),p.push(0,M,0),T.x=Y*.5+.5,T.y=W*.5*M+.5,u.push(T.x,T.y),g++}for(let U=0;U<s;U++){const B=E+U,G=D+U;v===!0?h.push(G,G+1,B):h.push(G+1,G,B),P+=3}c.addGroup(m,P,v===!0?1:2),m+=P}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Xn(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class Er extends Xn{constructor(e=1,t=1,n=32,s=1,r=!1,a=0,o=Math.PI*2){super(0,e,t,n,s,r,a,o),this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:n,heightSegments:s,openEnded:r,thetaStart:a,thetaLength:o}}static fromJSON(e){return new Er(e.radius,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class ts extends tt{constructor(e=[],t=[],n=1,s=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:n,detail:s};const r=[],a=[];o(s),c(n),h(),this.setAttribute("position",new ze(r,3)),this.setAttribute("normal",new ze(r.slice(),3)),this.setAttribute("uv",new ze(a,2)),s===0?this.computeVertexNormals():this.normalizeNormals();function o(_){const x=new w,v=new w,E=new w;for(let T=0;T<t.length;T+=3)u(t[T+0],x),u(t[T+1],v),u(t[T+2],E),l(x,v,E,_)}function l(_,x,v,E){const T=E+1,R=[];for(let P=0;P<=T;P++){R[P]=[];const S=_.clone().lerp(v,P/T),M=x.clone().lerp(v,P/T),D=T-P;for(let U=0;U<=D;U++)U===0&&P===T?R[P][U]=S:R[P][U]=S.clone().lerp(M,U/D)}for(let P=0;P<T;P++)for(let S=0;S<2*(T-P)-1;S++){const M=Math.floor(S/2);S%2===0?(p(R[P][M+1]),p(R[P+1][M]),p(R[P][M])):(p(R[P][M+1]),p(R[P+1][M+1]),p(R[P+1][M]))}}function c(_){const x=new w;for(let v=0;v<r.length;v+=3)x.x=r[v+0],x.y=r[v+1],x.z=r[v+2],x.normalize().multiplyScalar(_),r[v+0]=x.x,r[v+1]=x.y,r[v+2]=x.z}function h(){const _=new w;for(let x=0;x<r.length;x+=3){_.x=r[x+0],_.y=r[x+1],_.z=r[x+2];const v=d(_)/2/Math.PI+.5,E=m(_)/Math.PI+.5;a.push(v,1-E)}g(),f()}function f(){for(let _=0;_<a.length;_+=6){const x=a[_+0],v=a[_+2],E=a[_+4],T=Math.max(x,v,E),R=Math.min(x,v,E);T>.9&&R<.1&&(x<.2&&(a[_+0]+=1),v<.2&&(a[_+2]+=1),E<.2&&(a[_+4]+=1))}}function p(_){r.push(_.x,_.y,_.z)}function u(_,x){const v=_*3;x.x=e[v+0],x.y=e[v+1],x.z=e[v+2]}function g(){const _=new w,x=new w,v=new w,E=new w,T=new $,R=new $,P=new $;for(let S=0,M=0;S<r.length;S+=9,M+=6){_.set(r[S+0],r[S+1],r[S+2]),x.set(r[S+3],r[S+4],r[S+5]),v.set(r[S+6],r[S+7],r[S+8]),T.set(a[M+0],a[M+1]),R.set(a[M+2],a[M+3]),P.set(a[M+4],a[M+5]),E.copy(_).add(x).add(v).divideScalar(3);const D=d(E);y(T,M+0,_,D),y(R,M+2,x,D),y(P,M+4,v,D)}}function y(_,x,v,E){E<0&&_.x===1&&(a[x]=_.x-1),v.x===0&&v.z===0&&(a[x]=E/2/Math.PI+.5)}function d(_){return Math.atan2(_.z,-_.x)}function m(_){return Math.atan2(-_.y,Math.sqrt(_.x*_.x+_.z*_.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new ts(e.vertices,e.indices,e.radius,e.details)}}class mc extends ts{constructor(e=1,t=0){const n=(1+Math.sqrt(5))/2,s=1/n,r=[-1,-1,-1,-1,-1,1,-1,1,-1,-1,1,1,1,-1,-1,1,-1,1,1,1,-1,1,1,1,0,-s,-n,0,-s,n,0,s,-n,0,s,n,-s,-n,0,-s,n,0,s,-n,0,s,n,0,-n,0,-s,n,0,-s,-n,0,s,n,0,s],a=[3,11,7,3,7,15,3,15,13,7,19,17,7,17,6,7,6,15,17,4,8,17,8,10,17,10,6,8,0,16,8,16,2,8,2,10,0,12,1,0,1,18,0,18,16,6,10,2,6,2,13,6,13,15,2,16,18,2,18,3,2,3,13,18,1,9,18,9,11,18,11,3,4,14,12,4,12,0,4,0,8,11,9,5,11,5,19,11,19,7,19,5,14,19,14,4,19,4,17,1,12,14,1,14,5,1,5,9];super(r,a,e,t),this.type="DodecahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new mc(e.radius,e.detail)}}const Io=new w,Do=new w,Sh=new w,Lo=new En;class E0 extends tt{constructor(e=null,t=1){if(super(),this.type="EdgesGeometry",this.parameters={geometry:e,thresholdAngle:t},e!==null){const s=Math.pow(10,4),r=Math.cos(Rs*t),a=e.getIndex(),o=e.getAttribute("position"),l=a?a.count:o.count,c=[0,0,0],h=["a","b","c"],f=new Array(3),p={},u=[];for(let g=0;g<l;g+=3){a?(c[0]=a.getX(g),c[1]=a.getX(g+1),c[2]=a.getX(g+2)):(c[0]=g,c[1]=g+1,c[2]=g+2);const{a:y,b:d,c:m}=Lo;if(y.fromBufferAttribute(o,c[0]),d.fromBufferAttribute(o,c[1]),m.fromBufferAttribute(o,c[2]),Lo.getNormal(Sh),f[0]=`${Math.round(y.x*s)},${Math.round(y.y*s)},${Math.round(y.z*s)}`,f[1]=`${Math.round(d.x*s)},${Math.round(d.y*s)},${Math.round(d.z*s)}`,f[2]=`${Math.round(m.x*s)},${Math.round(m.y*s)},${Math.round(m.z*s)}`,!(f[0]===f[1]||f[1]===f[2]||f[2]===f[0]))for(let _=0;_<3;_++){const x=(_+1)%3,v=f[_],E=f[x],T=Lo[h[_]],R=Lo[h[x]],P=`${v}_${E}`,S=`${E}_${v}`;S in p&&p[S]?(Sh.dot(p[S].normal)<=r&&(u.push(T.x,T.y,T.z),u.push(R.x,R.y,R.z)),p[S]=null):P in p||(p[P]={index0:c[_],index1:c[x],normal:Sh.clone()})}}for(const g in p)if(p[g]){const{index0:y,index1:d}=p[g];Io.fromBufferAttribute(o,y),Do.fromBufferAttribute(o,d),u.push(Io.x,Io.y,Io.z),u.push(Do.x,Do.y,Do.z)}this.setAttribute("position",new ze(u,3))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}}class Ps extends Ma{constructor(e){super(e),this.uuid=Fn(),this.type="Shape",this.holes=[]}getPointsHoles(e){const t=[];for(let n=0,s=this.holes.length;n<s;n++)t[n]=this.holes[n].getPoints(e);return t}extractPoints(e){return{shape:this.getPoints(e),holes:this.getPointsHoles(e)}}copy(e){super.copy(e),this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){const s=e.holes[t];this.holes.push(s.clone())}return this}toJSON(){const e=super.toJSON();e.uuid=this.uuid,e.holes=[];for(let t=0,n=this.holes.length;t<n;t++){const s=this.holes[t];e.holes.push(s.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.uuid=e.uuid,this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){const s=e.holes[t];this.holes.push(new Ma().fromJSON(s))}return this}}const a2={triangulate:function(i,e,t=2){const n=e&&e.length,s=n?e[0]*t:i.length;let r=C0(i,0,s,t,!0);const a=[];if(!r||r.next===r.prev)return a;let o,l,c,h,f,p,u;if(n&&(r=f2(i,e,r,t)),i.length>80*t){o=c=i[0],l=h=i[1];for(let g=t;g<s;g+=t)f=i[g],p=i[g+1],f<o&&(o=f),p<l&&(l=p),f>c&&(c=f),p>h&&(h=p);u=Math.max(c-o,h-l),u=u!==0?32767/u:0}return ba(r,a,t,o,l,u,0),a}};function C0(i,e,t,n,s){let r,a;if(s===b2(i,e,t,n)>0)for(r=e;r<t;r+=n)a=Rd(r,i[r],i[r+1],a);else for(r=t-n;r>=e;r-=n)a=Rd(r,i[r],i[r+1],a);return a&&gc(a,a.next)&&(wa(a),a=a.next),a}function Os(i,e){if(!i)return i;e||(e=i);let t=i,n;do if(n=!1,!t.steiner&&(gc(t,t.next)||Nt(t.prev,t,t.next)===0)){if(wa(t),t=e=t.prev,t===t.next)break;n=!0}else t=t.next;while(n||t!==e);return e}function ba(i,e,t,n,s,r,a){if(!i)return;!a&&r&&g2(i,n,s,r);let o=i,l,c;for(;i.prev!==i.next;){if(l=i.prev,c=i.next,r?l2(i,n,s,r):o2(i)){e.push(l.i/t|0),e.push(i.i/t|0),e.push(c.i/t|0),wa(i),i=c.next,o=c.next;continue}if(i=c,i===o){a?a===1?(i=c2(Os(i),e,t),ba(i,e,t,n,s,r,2)):a===2&&h2(i,e,t,n,s,r):ba(Os(i),e,t,n,s,r,1);break}}}function o2(i){const e=i.prev,t=i,n=i.next;if(Nt(e,t,n)>=0)return!1;const s=e.x,r=t.x,a=n.x,o=e.y,l=t.y,c=n.y,h=s<r?s<a?s:a:r<a?r:a,f=o<l?o<c?o:c:l<c?l:c,p=s>r?s>a?s:a:r>a?r:a,u=o>l?o>c?o:c:l>c?l:c;let g=n.next;for(;g!==e;){if(g.x>=h&&g.x<=p&&g.y>=f&&g.y<=u&&dr(s,o,r,l,a,c,g.x,g.y)&&Nt(g.prev,g,g.next)>=0)return!1;g=g.next}return!0}function l2(i,e,t,n){const s=i.prev,r=i,a=i.next;if(Nt(s,r,a)>=0)return!1;const o=s.x,l=r.x,c=a.x,h=s.y,f=r.y,p=a.y,u=o<l?o<c?o:c:l<c?l:c,g=h<f?h<p?h:p:f<p?f:p,y=o>l?o>c?o:c:l>c?l:c,d=h>f?h>p?h:p:f>p?f:p,m=jh(u,g,e,t,n),_=jh(y,d,e,t,n);let x=i.prevZ,v=i.nextZ;for(;x&&x.z>=m&&v&&v.z<=_;){if(x.x>=u&&x.x<=y&&x.y>=g&&x.y<=d&&x!==s&&x!==a&&dr(o,h,l,f,c,p,x.x,x.y)&&Nt(x.prev,x,x.next)>=0||(x=x.prevZ,v.x>=u&&v.x<=y&&v.y>=g&&v.y<=d&&v!==s&&v!==a&&dr(o,h,l,f,c,p,v.x,v.y)&&Nt(v.prev,v,v.next)>=0))return!1;v=v.nextZ}for(;x&&x.z>=m;){if(x.x>=u&&x.x<=y&&x.y>=g&&x.y<=d&&x!==s&&x!==a&&dr(o,h,l,f,c,p,x.x,x.y)&&Nt(x.prev,x,x.next)>=0)return!1;x=x.prevZ}for(;v&&v.z<=_;){if(v.x>=u&&v.x<=y&&v.y>=g&&v.y<=d&&v!==s&&v!==a&&dr(o,h,l,f,c,p,v.x,v.y)&&Nt(v.prev,v,v.next)>=0)return!1;v=v.nextZ}return!0}function c2(i,e,t){let n=i;do{const s=n.prev,r=n.next.next;!gc(s,r)&&R0(s,n,n.next,r)&&Sa(s,r)&&Sa(r,s)&&(e.push(s.i/t|0),e.push(n.i/t|0),e.push(r.i/t|0),wa(n),wa(n.next),n=i=r),n=n.next}while(n!==i);return Os(n)}function h2(i,e,t,n,s,r){let a=i;do{let o=a.next.next;for(;o!==a.prev;){if(a.i!==o.i&&x2(a,o)){let l=P0(a,o);a=Os(a,a.next),l=Os(l,l.next),ba(a,e,t,n,s,r,0),ba(l,e,t,n,s,r,0);return}o=o.next}a=a.next}while(a!==i)}function f2(i,e,t,n){const s=[];let r,a,o,l,c;for(r=0,a=e.length;r<a;r++)o=e[r]*n,l=r<a-1?e[r+1]*n:i.length,c=C0(i,o,l,n,!1),c===c.next&&(c.steiner=!0),s.push(_2(c));for(s.sort(u2),r=0;r<s.length;r++)t=d2(s[r],t);return t}function u2(i,e){return i.x-e.x}function d2(i,e){const t=p2(i,e);if(!t)return e;const n=P0(t,i);return Os(n,n.next),Os(t,t.next)}function p2(i,e){let t=e,n=-1/0,s;const r=i.x,a=i.y;do{if(a<=t.y&&a>=t.next.y&&t.next.y!==t.y){const p=t.x+(a-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(p<=r&&p>n&&(n=p,s=t.x<t.next.x?t:t.next,p===r))return s}t=t.next}while(t!==e);if(!s)return null;const o=s,l=s.x,c=s.y;let h=1/0,f;t=s;do r>=t.x&&t.x>=l&&r!==t.x&&dr(a<c?r:n,a,l,c,a<c?n:r,a,t.x,t.y)&&(f=Math.abs(a-t.y)/(r-t.x),Sa(t,i)&&(f<h||f===h&&(t.x>s.x||t.x===s.x&&m2(s,t)))&&(s=t,h=f)),t=t.next;while(t!==o);return s}function m2(i,e){return Nt(i.prev,i,e.prev)<0&&Nt(e.next,i,i.next)<0}function g2(i,e,t,n){let s=i;do s.z===0&&(s.z=jh(s.x,s.y,e,t,n)),s.prevZ=s.prev,s.nextZ=s.next,s=s.next;while(s!==i);s.prevZ.nextZ=null,s.prevZ=null,y2(s)}function y2(i){let e,t,n,s,r,a,o,l,c=1;do{for(t=i,i=null,r=null,a=0;t;){for(a++,n=t,o=0,e=0;e<c&&(o++,n=n.nextZ,!!n);e++);for(l=c;o>0||l>0&&n;)o!==0&&(l===0||!n||t.z<=n.z)?(s=t,t=t.nextZ,o--):(s=n,n=n.nextZ,l--),r?r.nextZ=s:i=s,s.prevZ=r,r=s;t=n}r.nextZ=null,c*=2}while(a>1);return i}function jh(i,e,t,n,s){return i=(i-t)*s|0,e=(e-n)*s|0,i=(i|i<<8)&16711935,i=(i|i<<4)&252645135,i=(i|i<<2)&858993459,i=(i|i<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,i|e<<1}function _2(i){let e=i,t=i;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==i);return t}function dr(i,e,t,n,s,r,a,o){return(s-a)*(e-o)>=(i-a)*(r-o)&&(i-a)*(n-o)>=(t-a)*(e-o)&&(t-a)*(r-o)>=(s-a)*(n-o)}function x2(i,e){return i.next.i!==e.i&&i.prev.i!==e.i&&!v2(i,e)&&(Sa(i,e)&&Sa(e,i)&&M2(i,e)&&(Nt(i.prev,i,e.prev)||Nt(i,e.prev,e))||gc(i,e)&&Nt(i.prev,i,i.next)>0&&Nt(e.prev,e,e.next)>0)}function Nt(i,e,t){return(e.y-i.y)*(t.x-e.x)-(e.x-i.x)*(t.y-e.y)}function gc(i,e){return i.x===e.x&&i.y===e.y}function R0(i,e,t,n){const s=Uo(Nt(i,e,t)),r=Uo(Nt(i,e,n)),a=Uo(Nt(t,n,i)),o=Uo(Nt(t,n,e));return!!(s!==r&&a!==o||s===0&&zo(i,t,e)||r===0&&zo(i,n,e)||a===0&&zo(t,i,n)||o===0&&zo(t,e,n))}function zo(i,e,t){return e.x<=Math.max(i.x,t.x)&&e.x>=Math.min(i.x,t.x)&&e.y<=Math.max(i.y,t.y)&&e.y>=Math.min(i.y,t.y)}function Uo(i){return i>0?1:i<0?-1:0}function v2(i,e){let t=i;do{if(t.i!==i.i&&t.next.i!==i.i&&t.i!==e.i&&t.next.i!==e.i&&R0(t,t.next,i,e))return!0;t=t.next}while(t!==i);return!1}function Sa(i,e){return Nt(i.prev,i,i.next)<0?Nt(i,e,i.next)>=0&&Nt(i,i.prev,e)>=0:Nt(i,e,i.prev)<0||Nt(i,i.next,e)<0}function M2(i,e){let t=i,n=!1;const s=(i.x+e.x)/2,r=(i.y+e.y)/2;do t.y>r!=t.next.y>r&&t.next.y!==t.y&&s<(t.next.x-t.x)*(r-t.y)/(t.next.y-t.y)+t.x&&(n=!n),t=t.next;while(t!==i);return n}function P0(i,e){const t=new Qh(i.i,i.x,i.y),n=new Qh(e.i,e.x,e.y),s=i.next,r=e.prev;return i.next=e,e.prev=i,t.next=s,s.prev=t,n.next=t,t.prev=n,r.next=n,n.prev=r,n}function Rd(i,e,t,n){const s=new Qh(i,e,t);return n?(s.next=n.next,s.prev=n,n.next.prev=s,n.next=s):(s.prev=s,s.next=s),s}function wa(i){i.next.prev=i.prev,i.prev.next=i.next,i.prevZ&&(i.prevZ.nextZ=i.nextZ),i.nextZ&&(i.nextZ.prevZ=i.prevZ)}function Qh(i,e,t){this.i=i,this.x=e,this.y=t,this.prev=null,this.next=null,this.z=0,this.prevZ=null,this.nextZ=null,this.steiner=!1}function b2(i,e,t,n){let s=0;for(let r=e,a=t-n;r<t;r+=n)s+=(i[a]-i[r])*(i[r+1]+i[a+1]),a=r;return s}class gi{static area(e){const t=e.length;let n=0;for(let s=t-1,r=0;r<t;s=r++)n+=e[s].x*e[r].y-e[r].x*e[s].y;return n*.5}static isClockWise(e){return gi.area(e)<0}static triangulateShape(e,t){const n=[],s=[],r=[];Pd(e),Id(n,e);let a=e.length;t.forEach(Pd);for(let l=0;l<t.length;l++)s.push(a),a+=t[l].length,Id(n,t[l]);const o=a2.triangulate(n,s);for(let l=0;l<o.length;l+=3)r.push(o.slice(l,l+3));return r}}function Pd(i){const e=i.length;e>2&&i[e-1].equals(i[0])&&i.pop()}function Id(i,e){for(let t=0;t<e.length;t++)i.push(e[t].x),i.push(e[t].y)}class yc extends tt{constructor(e=new Ps([new $(.5,.5),new $(-.5,.5),new $(-.5,-.5),new $(.5,-.5)]),t={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:e,options:t},e=Array.isArray(e)?e:[e];const n=this,s=[],r=[];for(let o=0,l=e.length;o<l;o++){const c=e[o];a(c)}this.setAttribute("position",new ze(s,3)),this.setAttribute("uv",new ze(r,2)),this.computeVertexNormals();function a(o){const l=[],c=t.curveSegments!==void 0?t.curveSegments:12,h=t.steps!==void 0?t.steps:1,f=t.depth!==void 0?t.depth:1;let p=t.bevelEnabled!==void 0?t.bevelEnabled:!0,u=t.bevelThickness!==void 0?t.bevelThickness:.2,g=t.bevelSize!==void 0?t.bevelSize:u-.1,y=t.bevelOffset!==void 0?t.bevelOffset:0,d=t.bevelSegments!==void 0?t.bevelSegments:3;const m=t.extrudePath,_=t.UVGenerator!==void 0?t.UVGenerator:S2;let x,v=!1,E,T,R,P;m&&(x=m.getSpacedPoints(h),v=!0,p=!1,E=m.computeFrenetFrames(h,!1),T=new w,R=new w,P=new w),p||(d=0,u=0,g=0,y=0);const S=o.extractPoints(c);let M=S.shape;const D=S.holes;if(!gi.isClockWise(M)){M=M.reverse();for(let ne=0,ue=D.length;ne<ue;ne++){const z=D[ne];gi.isClockWise(z)&&(D[ne]=z.reverse())}}const B=gi.triangulateShape(M,D),G=M;for(let ne=0,ue=D.length;ne<ue;ne++){const z=D[ne];M=M.concat(z)}function Y(ne,ue,z){return ue||console.error("THREE.ExtrudeGeometry: vec does not exist"),ne.clone().addScaledVector(ue,z)}const W=M.length,te=B.length;function X(ne,ue,z){let Fe,he,Pe;const xe=ne.x-ue.x,qe=ne.y-ue.y,Ie=z.x-ne.x,L=z.y-ne.y,b=xe*xe+qe*qe,H=xe*L-qe*Ie;if(Math.abs(H)>Number.EPSILON){const Q=Math.sqrt(b),ae=Math.sqrt(Ie*Ie+L*L),ee=ue.x-qe/Q,Ne=ue.y+xe/Q,be=z.x-L/ae,j=z.y+Ie/ae,$e=((be-ee)*L-(j-Ne)*Ie)/(xe*L-qe*Ie);Fe=ee+xe*$e-ne.x,he=Ne+qe*$e-ne.y;const ce=Fe*Fe+he*he;if(ce<=2)return new $(Fe,he);Pe=Math.sqrt(ce/2)}else{let Q=!1;xe>Number.EPSILON?Ie>Number.EPSILON&&(Q=!0):xe<-Number.EPSILON?Ie<-Number.EPSILON&&(Q=!0):Math.sign(qe)===Math.sign(L)&&(Q=!0),Q?(Fe=-qe,he=xe,Pe=Math.sqrt(b)):(Fe=xe,he=qe,Pe=Math.sqrt(b/2))}return new $(Fe/Pe,he/Pe)}const de=[];for(let ne=0,ue=G.length,z=ue-1,Fe=ne+1;ne<ue;ne++,z++,Fe++)z===ue&&(z=0),Fe===ue&&(Fe=0),de[ne]=X(G[ne],G[z],G[Fe]);const ve=[];let ge,Xe=de.concat();for(let ne=0,ue=D.length;ne<ue;ne++){const z=D[ne];ge=[];for(let Fe=0,he=z.length,Pe=he-1,xe=Fe+1;Fe<he;Fe++,Pe++,xe++)Pe===he&&(Pe=0),xe===he&&(xe=0),ge[Fe]=X(z[Fe],z[Pe],z[xe]);ve.push(ge),Xe=Xe.concat(ge)}for(let ne=0;ne<d;ne++){const ue=ne/d,z=u*Math.cos(ue*Math.PI/2),Fe=g*Math.sin(ue*Math.PI/2)+y;for(let he=0,Pe=G.length;he<Pe;he++){const xe=Y(G[he],de[he],Fe);oe(xe.x,xe.y,-z)}for(let he=0,Pe=D.length;he<Pe;he++){const xe=D[he];ge=ve[he];for(let qe=0,Ie=xe.length;qe<Ie;qe++){const L=Y(xe[qe],ge[qe],Fe);oe(L.x,L.y,-z)}}}const ie=g+y;for(let ne=0;ne<W;ne++){const ue=p?Y(M[ne],Xe[ne],ie):M[ne];v?(R.copy(E.normals[0]).multiplyScalar(ue.x),T.copy(E.binormals[0]).multiplyScalar(ue.y),P.copy(x[0]).add(R).add(T),oe(P.x,P.y,P.z)):oe(ue.x,ue.y,0)}for(let ne=1;ne<=h;ne++)for(let ue=0;ue<W;ue++){const z=p?Y(M[ue],Xe[ue],ie):M[ue];v?(R.copy(E.normals[ne]).multiplyScalar(z.x),T.copy(E.binormals[ne]).multiplyScalar(z.y),P.copy(x[ne]).add(R).add(T),oe(P.x,P.y,P.z)):oe(z.x,z.y,f/h*ne)}for(let ne=d-1;ne>=0;ne--){const ue=ne/d,z=u*Math.cos(ue*Math.PI/2),Fe=g*Math.sin(ue*Math.PI/2)+y;for(let he=0,Pe=G.length;he<Pe;he++){const xe=Y(G[he],de[he],Fe);oe(xe.x,xe.y,f+z)}for(let he=0,Pe=D.length;he<Pe;he++){const xe=D[he];ge=ve[he];for(let qe=0,Ie=xe.length;qe<Ie;qe++){const L=Y(xe[qe],ge[qe],Fe);v?oe(L.x,L.y+x[h-1].y,x[h-1].x+z):oe(L.x,L.y,f+z)}}}V(),J();function V(){const ne=s.length/3;if(p){let ue=0,z=W*ue;for(let Fe=0;Fe<te;Fe++){const he=B[Fe];Le(he[2]+z,he[1]+z,he[0]+z)}ue=h+d*2,z=W*ue;for(let Fe=0;Fe<te;Fe++){const he=B[Fe];Le(he[0]+z,he[1]+z,he[2]+z)}}else{for(let ue=0;ue<te;ue++){const z=B[ue];Le(z[2],z[1],z[0])}for(let ue=0;ue<te;ue++){const z=B[ue];Le(z[0]+W*h,z[1]+W*h,z[2]+W*h)}}n.addGroup(ne,s.length/3-ne,0)}function J(){const ne=s.length/3;let ue=0;le(G,ue),ue+=G.length;for(let z=0,Fe=D.length;z<Fe;z++){const he=D[z];le(he,ue),ue+=he.length}n.addGroup(ne,s.length/3-ne,1)}function le(ne,ue){let z=ne.length;for(;--z>=0;){const Fe=z;let he=z-1;he<0&&(he=ne.length-1);for(let Pe=0,xe=h+d*2;Pe<xe;Pe++){const qe=W*Pe,Ie=W*(Pe+1),L=ue+Fe+qe,b=ue+he+qe,H=ue+he+Ie,Q=ue+Fe+Ie;Oe(L,b,H,Q)}}}function oe(ne,ue,z){l.push(ne),l.push(ue),l.push(z)}function Le(ne,ue,z){Ge(ne),Ge(ue),Ge(z);const Fe=s.length/3,he=_.generateTopUV(n,s,Fe-3,Fe-2,Fe-1);Ke(he[0]),Ke(he[1]),Ke(he[2])}function Oe(ne,ue,z,Fe){Ge(ne),Ge(ue),Ge(Fe),Ge(ue),Ge(z),Ge(Fe);const he=s.length/3,Pe=_.generateSideWallUV(n,s,he-6,he-3,he-2,he-1);Ke(Pe[0]),Ke(Pe[1]),Ke(Pe[3]),Ke(Pe[1]),Ke(Pe[2]),Ke(Pe[3])}function Ge(ne){s.push(l[ne*3+0]),s.push(l[ne*3+1]),s.push(l[ne*3+2])}function Ke(ne){r.push(ne.x),r.push(ne.y)}}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){const e=super.toJSON(),t=this.parameters.shapes,n=this.parameters.options;return w2(t,n,e)}static fromJSON(e,t){const n=[];for(let r=0,a=e.shapes.length;r<a;r++){const o=t[e.shapes[r]];n.push(o)}const s=e.options.extrudePath;return s!==void 0&&(e.options.extrudePath=new kl[s.type]().fromJSON(s)),new yc(n,e.options)}}const S2={generateTopUV:function(i,e,t,n,s){const r=e[t*3],a=e[t*3+1],o=e[n*3],l=e[n*3+1],c=e[s*3],h=e[s*3+1];return[new $(r,a),new $(o,l),new $(c,h)]},generateSideWallUV:function(i,e,t,n,s,r){const a=e[t*3],o=e[t*3+1],l=e[t*3+2],c=e[n*3],h=e[n*3+1],f=e[n*3+2],p=e[s*3],u=e[s*3+1],g=e[s*3+2],y=e[r*3],d=e[r*3+1],m=e[r*3+2];return Math.abs(o-h)<Math.abs(a-c)?[new $(a,1-l),new $(c,1-f),new $(p,1-g),new $(y,1-m)]:[new $(o,1-l),new $(h,1-f),new $(u,1-g),new $(d,1-m)]}};function w2(i,e,t){if(t.shapes=[],Array.isArray(i))for(let n=0,s=i.length;n<s;n++){const r=i[n];t.shapes.push(r.uuid)}else t.shapes.push(i.uuid);return t.options=Object.assign({},e),e.extrudePath!==void 0&&(t.options.extrudePath=e.extrudePath.toJSON()),t}class _c extends ts{constructor(e=1,t=0){const n=(1+Math.sqrt(5))/2,s=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],r=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(s,r,e,t),this.type="IcosahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new _c(e.radius,e.detail)}}class Va extends ts{constructor(e=1,t=0){const n=[1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],s=[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2];super(n,s,e,t),this.type="OctahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new Va(e.radius,e.detail)}}class xc extends tt{constructor(e=.5,t=1,n=32,s=1,r=0,a=Math.PI*2){super(),this.type="RingGeometry",this.parameters={innerRadius:e,outerRadius:t,thetaSegments:n,phiSegments:s,thetaStart:r,thetaLength:a},n=Math.max(3,n),s=Math.max(1,s);const o=[],l=[],c=[],h=[];let f=e;const p=(t-e)/s,u=new w,g=new $;for(let y=0;y<=s;y++){for(let d=0;d<=n;d++){const m=r+d/n*a;u.x=f*Math.cos(m),u.y=f*Math.sin(m),l.push(u.x,u.y,u.z),c.push(0,0,1),g.x=(u.x/t+1)/2,g.y=(u.y/t+1)/2,h.push(g.x,g.y)}f+=p}for(let y=0;y<s;y++){const d=y*(n+1);for(let m=0;m<n;m++){const _=m+d,x=_,v=_+n+1,E=_+n+2,T=_+1;o.push(x,v,T),o.push(v,E,T)}}this.setIndex(o),this.setAttribute("position",new ze(l,3)),this.setAttribute("normal",new ze(c,3)),this.setAttribute("uv",new ze(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new xc(e.innerRadius,e.outerRadius,e.thetaSegments,e.phiSegments,e.thetaStart,e.thetaLength)}}class vc extends tt{constructor(e=new Ps([new $(0,.5),new $(-.5,-.5),new $(.5,-.5)]),t=12){super(),this.type="ShapeGeometry",this.parameters={shapes:e,curveSegments:t};const n=[],s=[],r=[],a=[];let o=0,l=0;if(Array.isArray(e)===!1)c(e);else for(let h=0;h<e.length;h++)c(e[h]),this.addGroup(o,l,h),o+=l,l=0;this.setIndex(n),this.setAttribute("position",new ze(s,3)),this.setAttribute("normal",new ze(r,3)),this.setAttribute("uv",new ze(a,2));function c(h){const f=s.length/3,p=h.extractPoints(t);let u=p.shape;const g=p.holes;gi.isClockWise(u)===!1&&(u=u.reverse());for(let d=0,m=g.length;d<m;d++){const _=g[d];gi.isClockWise(_)===!0&&(g[d]=_.reverse())}const y=gi.triangulateShape(u,g);for(let d=0,m=g.length;d<m;d++){const _=g[d];u=u.concat(_)}for(let d=0,m=u.length;d<m;d++){const _=u[d];s.push(_.x,_.y,0),r.push(0,0,1),a.push(_.x,_.y)}for(let d=0,m=y.length;d<m;d++){const _=y[d],x=_[0]+f,v=_[1]+f,E=_[2]+f;n.push(x,v,E),l+=3}}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){const e=super.toJSON(),t=this.parameters.shapes;return T2(t,e)}static fromJSON(e,t){const n=[];for(let s=0,r=e.shapes.length;s<r;s++){const a=t[e.shapes[s]];n.push(a)}return new vc(n,e.curveSegments)}}function T2(i,e){if(e.shapes=[],Array.isArray(i))for(let t=0,n=i.length;t<n;t++){const s=i[t];e.shapes.push(s.uuid)}else e.shapes.push(i.uuid);return e}class Fi extends tt{constructor(e=1,t=32,n=16,s=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:s,phiLength:r,thetaStart:a,thetaLength:o},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));const l=Math.min(a+o,Math.PI);let c=0;const h=[],f=new w,p=new w,u=[],g=[],y=[],d=[];for(let m=0;m<=n;m++){const _=[],x=m/n;let v=0;m===0&&a===0?v=.5/t:m===n&&l===Math.PI&&(v=-.5/t);for(let E=0;E<=t;E++){const T=E/t;f.x=-e*Math.cos(s+T*r)*Math.sin(a+x*o),f.y=e*Math.cos(a+x*o),f.z=e*Math.sin(s+T*r)*Math.sin(a+x*o),g.push(f.x,f.y,f.z),p.copy(f).normalize(),y.push(p.x,p.y,p.z),d.push(T+v,1-x),_.push(c++)}h.push(_)}for(let m=0;m<n;m++)for(let _=0;_<t;_++){const x=h[m][_+1],v=h[m][_],E=h[m+1][_],T=h[m+1][_+1];(m!==0||a>0)&&u.push(x,v,T),(m!==n-1||l<Math.PI)&&u.push(v,E,T)}this.setIndex(u),this.setAttribute("position",new ze(g,3)),this.setAttribute("normal",new ze(y,3)),this.setAttribute("uv",new ze(d,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Fi(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}}class Mc extends ts{constructor(e=1,t=0){const n=[1,1,1,-1,-1,1,-1,1,-1,1,-1,-1],s=[2,1,0,0,3,2,1,3,0,2,3,1];super(n,s,e,t),this.type="TetrahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new Mc(e.radius,e.detail)}}class Ha extends tt{constructor(e=1,t=.4,n=12,s=48,r=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:s,arc:r},n=Math.floor(n),s=Math.floor(s);const a=[],o=[],l=[],c=[],h=new w,f=new w,p=new w;for(let u=0;u<=n;u++)for(let g=0;g<=s;g++){const y=g/s*r,d=u/n*Math.PI*2;f.x=(e+t*Math.cos(d))*Math.cos(y),f.y=(e+t*Math.cos(d))*Math.sin(y),f.z=t*Math.sin(d),o.push(f.x,f.y,f.z),h.x=e*Math.cos(y),h.y=e*Math.sin(y),p.subVectors(f,h).normalize(),l.push(p.x,p.y,p.z),c.push(g/s),c.push(u/n)}for(let u=1;u<=n;u++)for(let g=1;g<=s;g++){const y=(s+1)*u+g-1,d=(s+1)*(u-1)+g-1,m=(s+1)*(u-1)+g,_=(s+1)*u+g;a.push(y,d,_),a.push(d,m,_)}this.setIndex(a),this.setAttribute("position",new ze(o,3)),this.setAttribute("normal",new ze(l,3)),this.setAttribute("uv",new ze(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Ha(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc)}}class bc extends tt{constructor(e=1,t=.4,n=64,s=8,r=2,a=3){super(),this.type="TorusKnotGeometry",this.parameters={radius:e,tube:t,tubularSegments:n,radialSegments:s,p:r,q:a},n=Math.floor(n),s=Math.floor(s);const o=[],l=[],c=[],h=[],f=new w,p=new w,u=new w,g=new w,y=new w,d=new w,m=new w;for(let x=0;x<=n;++x){const v=x/n*r*Math.PI*2;_(v,r,a,e,u),_(v+.01,r,a,e,g),d.subVectors(g,u),m.addVectors(g,u),y.crossVectors(d,m),m.crossVectors(y,d),y.normalize(),m.normalize();for(let E=0;E<=s;++E){const T=E/s*Math.PI*2,R=-t*Math.cos(T),P=t*Math.sin(T);f.x=u.x+(R*m.x+P*y.x),f.y=u.y+(R*m.y+P*y.y),f.z=u.z+(R*m.z+P*y.z),l.push(f.x,f.y,f.z),p.subVectors(f,u).normalize(),c.push(p.x,p.y,p.z),h.push(x/n),h.push(E/s)}}for(let x=1;x<=n;x++)for(let v=1;v<=s;v++){const E=(s+1)*(x-1)+(v-1),T=(s+1)*x+(v-1),R=(s+1)*x+v,P=(s+1)*(x-1)+v;o.push(E,T,P),o.push(T,R,P)}this.setIndex(o),this.setAttribute("position",new ze(l,3)),this.setAttribute("normal",new ze(c,3)),this.setAttribute("uv",new ze(h,2));function _(x,v,E,T,R){const P=Math.cos(x),S=Math.sin(x),M=E/v*x,D=Math.cos(M);R.x=T*(2+D)*.5*P,R.y=T*(2+D)*S*.5,R.z=T*Math.sin(M)*.5}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new bc(e.radius,e.tube,e.tubularSegments,e.radialSegments,e.p,e.q)}}class Ga extends tt{constructor(e=new Bf(new w(-1,-1,0),new w(-1,1,0),new w(1,1,0)),t=64,n=1,s=8,r=!1){super(),this.type="TubeGeometry",this.parameters={path:e,tubularSegments:t,radius:n,radialSegments:s,closed:r};const a=e.computeFrenetFrames(t,r);this.tangents=a.tangents,this.normals=a.normals,this.binormals=a.binormals;const o=new w,l=new w,c=new $;let h=new w;const f=[],p=[],u=[],g=[];y(),this.setIndex(g),this.setAttribute("position",new ze(f,3)),this.setAttribute("normal",new ze(p,3)),this.setAttribute("uv",new ze(u,2));function y(){for(let x=0;x<t;x++)d(x);d(r===!1?t:0),_(),m()}function d(x){h=e.getPointAt(x/t,h);const v=a.normals[x],E=a.binormals[x];for(let T=0;T<=s;T++){const R=T/s*Math.PI*2,P=Math.sin(R),S=-Math.cos(R);l.x=S*v.x+P*E.x,l.y=S*v.y+P*E.y,l.z=S*v.z+P*E.z,l.normalize(),p.push(l.x,l.y,l.z),o.x=h.x+n*l.x,o.y=h.y+n*l.y,o.z=h.z+n*l.z,f.push(o.x,o.y,o.z)}}function m(){for(let x=1;x<=t;x++)for(let v=1;v<=s;v++){const E=(s+1)*(x-1)+(v-1),T=(s+1)*x+(v-1),R=(s+1)*x+v,P=(s+1)*(x-1)+v;g.push(E,T,P),g.push(T,R,P)}}function _(){for(let x=0;x<=t;x++)for(let v=0;v<=s;v++)c.x=x/t,c.y=v/s,u.push(c.x,c.y)}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){const e=super.toJSON();return e.path=this.parameters.path.toJSON(),e}static fromJSON(e){return new Ga(new kl[e.path.type]().fromJSON(e.path),e.tubularSegments,e.radius,e.radialSegments,e.closed)}}class I0 extends tt{constructor(e=null){if(super(),this.type="WireframeGeometry",this.parameters={geometry:e},e!==null){const t=[],n=new Set,s=new w,r=new w;if(e.index!==null){const a=e.attributes.position,o=e.index;let l=e.groups;l.length===0&&(l=[{start:0,count:o.count,materialIndex:0}]);for(let c=0,h=l.length;c<h;++c){const f=l[c],p=f.start,u=f.count;for(let g=p,y=p+u;g<y;g+=3)for(let d=0;d<3;d++){const m=o.getX(g+d),_=o.getX(g+(d+1)%3);s.fromBufferAttribute(a,m),r.fromBufferAttribute(a,_),Dd(s,r,n)===!0&&(t.push(s.x,s.y,s.z),t.push(r.x,r.y,r.z))}}}else{const a=e.attributes.position;for(let o=0,l=a.count/3;o<l;o++)for(let c=0;c<3;c++){const h=3*o+c,f=3*o+(c+1)%3;s.fromBufferAttribute(a,h),r.fromBufferAttribute(a,f),Dd(s,r,n)===!0&&(t.push(s.x,s.y,s.z),t.push(r.x,r.y,r.z))}}this.setAttribute("position",new ze(t,3))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}}function Dd(i,e,t){const n=`${i.x},${i.y},${i.z}-${e.x},${e.y},${e.z}`,s=`${e.x},${e.y},${e.z}-${i.x},${i.y},${i.z}`;return t.has(n)===!0||t.has(s)===!0?!1:(t.add(n),t.add(s),!0)}var Ld=Object.freeze({__proto__:null,BoxGeometry:Dn,CapsuleGeometry:dc,CircleGeometry:pc,ConeGeometry:Er,CylinderGeometry:Xn,DodecahedronGeometry:mc,EdgesGeometry:E0,ExtrudeGeometry:yc,IcosahedronGeometry:_c,LatheGeometry:ka,OctahedronGeometry:Va,PlaneGeometry:Ln,PolyhedronGeometry:ts,RingGeometry:xc,ShapeGeometry:vc,SphereGeometry:Fi,TetrahedronGeometry:Mc,TorusGeometry:Ha,TorusKnotGeometry:bc,TubeGeometry:Ga,WireframeGeometry:I0});class D0 extends yn{static get type(){return"ShadowMaterial"}constructor(e){super(),this.isShadowMaterial=!0,this.color=new re(0),this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.fog=e.fog,this}}class L0 extends At{static get type(){return"RawShaderMaterial"}constructor(e){super(e),this.isRawShaderMaterial=!0}}class Vf extends yn{static get type(){return"MeshStandardMaterial"}constructor(e){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.color=new re(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new re(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Qi,this.normalScale=new $(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Mn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class z0 extends Vf{static get type(){return"MeshPhysicalMaterial"}constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new $(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return kt(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new re(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new re(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new re(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}}class U0 extends yn{static get type(){return"MeshPhongMaterial"}constructor(e){super(),this.isMeshPhongMaterial=!0,this.color=new re(16777215),this.specular=new re(1118481),this.shininess=30,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new re(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Qi,this.normalScale=new $(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Mn,this.combine=Da,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.specular.copy(e.specular),this.shininess=e.shininess,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class Hf extends yn{static get type(){return"MeshToonMaterial"}constructor(e){super(),this.isMeshToonMaterial=!0,this.defines={TOON:""},this.color=new re(16777215),this.map=null,this.gradientMap=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new re(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Qi,this.normalScale=new $(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.gradientMap=e.gradientMap,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.alphaMap=e.alphaMap,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}class N0 extends yn{static get type(){return"MeshNormalMaterial"}constructor(e){super(),this.isMeshNormalMaterial=!0,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Qi,this.normalScale=new $(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.flatShading=!1,this.setValues(e)}copy(e){return super.copy(e),this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.flatShading=e.flatShading,this}}class O0 extends yn{static get type(){return"MeshLambertMaterial"}constructor(e){super(),this.isMeshLambertMaterial=!0,this.color=new re(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new re(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Qi,this.normalScale=new $(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Mn,this.combine=Da,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class F0 extends yn{static get type(){return"MeshMatcapMaterial"}constructor(e){super(),this.isMeshMatcapMaterial=!0,this.defines={MATCAP:""},this.color=new re(16777215),this.matcap=null,this.map=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Qi,this.normalScale=new $(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={MATCAP:""},this.color.copy(e.color),this.matcap=e.matcap,this.map=e.map,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.alphaMap=e.alphaMap,this.flatShading=e.flatShading,this.fog=e.fog,this}}class B0 extends bn{static get type(){return"LineDashedMaterial"}constructor(e){super(),this.isLineDashedMaterial=!0,this.scale=1,this.dashSize=3,this.gapSize=1,this.setValues(e)}copy(e){return super.copy(e),this.scale=e.scale,this.dashSize=e.dashSize,this.gapSize=e.gapSize,this}}function As(i,e,t){return!i||!t&&i.constructor===e?i:typeof e.BYTES_PER_ELEMENT=="number"?new e(i):Array.prototype.slice.call(i)}function k0(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}function V0(i){function e(s,r){return i[s]-i[r]}const t=i.length,n=new Array(t);for(let s=0;s!==t;++s)n[s]=s;return n.sort(e),n}function ef(i,e,t){const n=i.length,s=new i.constructor(n);for(let r=0,a=0;a!==n;++r){const o=t[r]*e;for(let l=0;l!==e;++l)s[a++]=i[o+l]}return s}function Gf(i,e,t,n){let s=1,r=i[0];for(;r!==void 0&&r[n]===void 0;)r=i[s++];if(r===void 0)return;let a=r[n];if(a!==void 0)if(Array.isArray(a))do a=r[n],a!==void 0&&(e.push(r.time),t.push.apply(t,a)),r=i[s++];while(r!==void 0);else if(a.toArray!==void 0)do a=r[n],a!==void 0&&(e.push(r.time),a.toArray(t,t.length)),r=i[s++];while(r!==void 0);else do a=r[n],a!==void 0&&(e.push(r.time),t.push(a)),r=i[s++];while(r!==void 0)}function A2(i,e,t,n,s=30){const r=i.clone();r.name=e;const a=[];for(let l=0;l<r.tracks.length;++l){const c=r.tracks[l],h=c.getValueSize(),f=[],p=[];for(let u=0;u<c.times.length;++u){const g=c.times[u]*s;if(!(g<t||g>=n)){f.push(c.times[u]);for(let y=0;y<h;++y)p.push(c.values[u*h+y])}}f.length!==0&&(c.times=As(f,c.times.constructor),c.values=As(p,c.values.constructor),a.push(c))}r.tracks=a;let o=1/0;for(let l=0;l<r.tracks.length;++l)o>r.tracks[l].times[0]&&(o=r.tracks[l].times[0]);for(let l=0;l<r.tracks.length;++l)r.tracks[l].shift(-1*o);return r.resetDuration(),r}function E2(i,e=0,t=i,n=30){n<=0&&(n=30);const s=t.tracks.length,r=e/n;for(let a=0;a<s;++a){const o=t.tracks[a],l=o.ValueTypeName;if(l==="bool"||l==="string")continue;const c=i.tracks.find(function(m){return m.name===o.name&&m.ValueTypeName===l});if(c===void 0)continue;let h=0;const f=o.getValueSize();o.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline&&(h=f/3);let p=0;const u=c.getValueSize();c.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline&&(p=u/3);const g=o.times.length-1;let y;if(r<=o.times[0]){const m=h,_=f-h;y=o.values.slice(m,_)}else if(r>=o.times[g]){const m=g*f+h,_=m+f-h;y=o.values.slice(m,_)}else{const m=o.createInterpolant(),_=h,x=f-h;m.evaluate(r),y=m.resultBuffer.slice(_,x)}l==="quaternion"&&new en().fromArray(y).normalize().conjugate().toArray(y);const d=c.times.length;for(let m=0;m<d;++m){const _=m*u+p;if(l==="quaternion")en.multiplyQuaternionsFlat(c.values,_,y,0,c.values,_);else{const x=u-p*2;for(let v=0;v<x;++v)c.values[_+v]-=y[v]}}}return i.blendMode=Mf,i}const C2={convertArray:As,isTypedArray:k0,getKeyframeOrder:V0,sortedArray:ef,flattenJSON:Gf,subclip:A2,makeClipAdditive:E2};class Wa{constructor(e,t,n,s){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){const t=this.parameterPositions;let n=this._cachedIndex,s=t[n],r=t[n-1];e:{t:{let a;n:{i:if(!(e<s)){for(let o=n+2;;){if(s===void 0){if(e<r)break i;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(r=s,s=t[++n],e<s)break t}a=t.length;break n}if(!(e>=r)){const o=t[1];e<o&&(n=2,r=o);for(let l=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(s=r,r=t[--n-1],e>=r)break t}a=n,n=0;break n}break e}for(;n<a;){const o=n+a>>>1;e<t[o]?a=o:n=o+1}if(s=t[n],r=t[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,s)}return this.interpolate_(n,r,e,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){const t=this.resultBuffer,n=this.sampleValues,s=this.valueSize,r=e*s;for(let a=0;a!==s;++a)t[a]=n[r+a];return t}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}}class H0 extends Wa{constructor(e,t,n,s){super(e,t,n,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Ss,endingEnd:Ss}}intervalChanged_(e,t,n){const s=this.parameterPositions;let r=e-2,a=e+1,o=s[r],l=s[a];if(o===void 0)switch(this.getSettings_().endingStart){case ws:r=e,o=2*t-n;break;case ya:r=s.length-2,o=t+s[r]-s[r+1];break;default:r=e,o=n}if(l===void 0)switch(this.getSettings_().endingEnd){case ws:a=e,l=2*n-t;break;case ya:a=1,l=n+s[1]-s[0];break;default:a=e-1,l=t}const c=(n-t)*.5,h=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(l-n),this._offsetPrev=r*h,this._offsetNext=a*h}interpolate_(e,t,n,s){const r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=this._offsetPrev,f=this._offsetNext,p=this._weightPrev,u=this._weightNext,g=(n-t)/(s-t),y=g*g,d=y*g,m=-p*d+2*p*y-p*g,_=(1+p)*d+(-1.5-2*p)*y+(-.5+p)*g+1,x=(-1-u)*d+(1.5+u)*y+.5*g,v=u*d-u*y;for(let E=0;E!==o;++E)r[E]=m*a[h+E]+_*a[c+E]+x*a[l+E]+v*a[f+E];return r}}class Wf extends Wa{constructor(e,t,n,s){super(e,t,n,s)}interpolate_(e,t,n,s){const r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=(n-t)/(s-t),f=1-h;for(let p=0;p!==o;++p)r[p]=a[c+p]*f+a[l+p]*h;return r}}class G0 extends Wa{constructor(e,t,n,s){super(e,t,n,s)}interpolate_(e){return this.copySampleValue_(e-1)}}class oi{constructor(e,t,n,s){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=As(t,this.TimeBufferType),this.values=As(n,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(e){const t=e.constructor;let n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:As(e.times,Array),values:As(e.values,Array)};const s=e.getInterpolation();s!==e.DefaultInterpolation&&(n.interpolation=s)}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new G0(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new Wf(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new H0(this.times,this.values,this.getValueSize(),e)}setInterpolation(e){let t;switch(e){case ga:t=this.InterpolantFactoryMethodDiscrete;break;case Ol:t=this.InterpolantFactoryMethodLinear;break;case Qo:t=this.InterpolantFactoryMethodSmooth;break}if(t===void 0){const n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return console.warn("THREE.KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return ga;case this.InterpolantFactoryMethodLinear:return Ol;case this.InterpolantFactoryMethodSmooth:return Qo}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){const t=this.times;for(let n=0,s=t.length;n!==s;++n)t[n]+=e}return this}scale(e){if(e!==1){const t=this.times;for(let n=0,s=t.length;n!==s;++n)t[n]*=e}return this}trim(e,t){const n=this.times,s=n.length;let r=0,a=s-1;for(;r!==s&&n[r]<e;)++r;for(;a!==-1&&n[a]>t;)--a;if(++a,r!==0||a!==s){r>=a&&(a=Math.max(a,1),r=a-1);const o=this.getValueSize();this.times=n.slice(r,a),this.values=this.values.slice(r*o,a*o)}return this}validate(){let e=!0;const t=this.getValueSize();t-Math.floor(t)!==0&&(console.error("THREE.KeyframeTrack: Invalid value size in track.",this),e=!1);const n=this.times,s=this.values,r=n.length;r===0&&(console.error("THREE.KeyframeTrack: Track is empty.",this),e=!1);let a=null;for(let o=0;o!==r;o++){const l=n[o];if(typeof l=="number"&&isNaN(l)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,o,l),e=!1;break}if(a!==null&&a>l){console.error("THREE.KeyframeTrack: Out of order keys.",this,o,l,a),e=!1;break}a=l}if(s!==void 0&&k0(s))for(let o=0,l=s.length;o!==l;++o){const c=s[o];if(isNaN(c)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,o,c),e=!1;break}}return e}optimize(){const e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),s=this.getInterpolation()===Qo,r=e.length-1;let a=1;for(let o=1;o<r;++o){let l=!1;const c=e[o],h=e[o+1];if(c!==h&&(o!==1||c!==e[0]))if(s)l=!0;else{const f=o*n,p=f-n,u=f+n;for(let g=0;g!==n;++g){const y=t[f+g];if(y!==t[p+g]||y!==t[u+g]){l=!0;break}}}if(l){if(o!==a){e[a]=e[o];const f=o*n,p=a*n;for(let u=0;u!==n;++u)t[p+u]=t[f+u]}++a}}if(r>0){e[a]=e[r];for(let o=r*n,l=a*n,c=0;c!==n;++c)t[l+c]=t[o+c];++a}return a!==e.length?(this.times=e.slice(0,a),this.values=t.slice(0,a*n)):(this.times=e,this.values=t),this}clone(){const e=this.times.slice(),t=this.values.slice(),n=this.constructor,s=new n(this.name,e,t);return s.createInterpolant=this.createInterpolant,s}}oi.prototype.TimeBufferType=Float32Array;oi.prototype.ValueBufferType=Float32Array;oi.prototype.DefaultInterpolation=Ol;class Hs extends oi{constructor(e,t,n){super(e,t,n)}}Hs.prototype.ValueTypeName="bool";Hs.prototype.ValueBufferType=Array;Hs.prototype.DefaultInterpolation=ga;Hs.prototype.InterpolantFactoryMethodLinear=void 0;Hs.prototype.InterpolantFactoryMethodSmooth=void 0;class Xf extends oi{}Xf.prototype.ValueTypeName="color";class Ta extends oi{}Ta.prototype.ValueTypeName="number";class W0 extends Wa{constructor(e,t,n,s){super(e,t,n,s)}interpolate_(e,t,n,s){const r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=(n-t)/(s-t);let c=e*o;for(let h=c+o;c!==h;c+=4)en.slerpFlat(r,0,a,c-o,a,c,l);return r}}class Xa extends oi{InterpolantFactoryMethodLinear(e){return new W0(this.times,this.values,this.getValueSize(),e)}}Xa.prototype.ValueTypeName="quaternion";Xa.prototype.InterpolantFactoryMethodSmooth=void 0;class Gs extends oi{constructor(e,t,n){super(e,t,n)}}Gs.prototype.ValueTypeName="string";Gs.prototype.ValueBufferType=Array;Gs.prototype.DefaultInterpolation=ga;Gs.prototype.InterpolantFactoryMethodLinear=void 0;Gs.prototype.InterpolantFactoryMethodSmooth=void 0;class Aa extends oi{}Aa.prototype.ValueTypeName="vector";class Ea{constructor(e="",t=-1,n=[],s=nc){this.name=e,this.tracks=n,this.duration=t,this.blendMode=s,this.uuid=Fn(),this.duration<0&&this.resetDuration()}static parse(e){const t=[],n=e.tracks,s=1/(e.fps||1);for(let a=0,o=n.length;a!==o;++a)t.push(P2(n[a]).scale(s));const r=new this(e.name,e.duration,t,e.blendMode);return r.uuid=e.uuid,r}static toJSON(e){const t=[],n=e.tracks,s={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid,blendMode:e.blendMode};for(let r=0,a=n.length;r!==a;++r)t.push(oi.toJSON(n[r]));return s}static CreateFromMorphTargetSequence(e,t,n,s){const r=t.length,a=[];for(let o=0;o<r;o++){let l=[],c=[];l.push((o+r-1)%r,o,(o+1)%r),c.push(0,1,0);const h=V0(l);l=ef(l,1,h),c=ef(c,1,h),!s&&l[0]===0&&(l.push(r),c.push(c[0])),a.push(new Ta(".morphTargetInfluences["+t[o].name+"]",l,c).scale(1/n))}return new this(e,-1,a)}static findByName(e,t){let n=e;if(!Array.isArray(e)){const s=e;n=s.geometry&&s.geometry.animations||s.animations}for(let s=0;s<n.length;s++)if(n[s].name===t)return n[s];return null}static CreateClipsFromMorphTargetSequences(e,t,n){const s={},r=/^([\w-]*?)([\d]+)$/;for(let o=0,l=e.length;o<l;o++){const c=e[o],h=c.name.match(r);if(h&&h.length>1){const f=h[1];let p=s[f];p||(s[f]=p=[]),p.push(c)}}const a=[];for(const o in s)a.push(this.CreateFromMorphTargetSequence(o,s[o],t,n));return a}static parseAnimation(e,t){if(!e)return console.error("THREE.AnimationClip: No animation in JSONLoader data."),null;const n=function(f,p,u,g,y){if(u.length!==0){const d=[],m=[];Gf(u,d,m,g),d.length!==0&&y.push(new f(p,d,m))}},s=[],r=e.name||"default",a=e.fps||30,o=e.blendMode;let l=e.length||-1;const c=e.hierarchy||[];for(let f=0;f<c.length;f++){const p=c[f].keys;if(!(!p||p.length===0))if(p[0].morphTargets){const u={};let g;for(g=0;g<p.length;g++)if(p[g].morphTargets)for(let y=0;y<p[g].morphTargets.length;y++)u[p[g].morphTargets[y]]=-1;for(const y in u){const d=[],m=[];for(let _=0;_!==p[g].morphTargets.length;++_){const x=p[g];d.push(x.time),m.push(x.morphTarget===y?1:0)}s.push(new Ta(".morphTargetInfluence["+y+"]",d,m))}l=u.length*a}else{const u=".bones["+t[f].name+"]";n(Aa,u+".position",p,"pos",s),n(Xa,u+".quaternion",p,"rot",s),n(Aa,u+".scale",p,"scl",s)}}return s.length===0?null:new this(r,l,s,o)}resetDuration(){const e=this.tracks;let t=0;for(let n=0,s=e.length;n!==s;++n){const r=this.tracks[n];t=Math.max(t,r.times[r.times.length-1])}return this.duration=t,this}trim(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this}validate(){let e=!0;for(let t=0;t<this.tracks.length;t++)e=e&&this.tracks[t].validate();return e}optimize(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}clone(){const e=[];for(let t=0;t<this.tracks.length;t++)e.push(this.tracks[t].clone());return new this.constructor(this.name,this.duration,e,this.blendMode)}toJSON(){return this.constructor.toJSON(this)}}function R2(i){switch(i.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return Ta;case"vector":case"vector2":case"vector3":case"vector4":return Aa;case"color":return Xf;case"quaternion":return Xa;case"bool":case"boolean":return Hs;case"string":return Gs}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+i)}function P2(i){if(i.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");const e=R2(i.type);if(i.times===void 0){const t=[],n=[];Gf(i.keys,t,n,"value"),i.times=t,i.values=n}return e.parse!==void 0?e.parse(i):new e(i.name,i.times,i.values,i.interpolation)}const Di={enabled:!1,files:{},add:function(i,e){this.enabled!==!1&&(this.files[i]=e)},get:function(i){if(this.enabled!==!1)return this.files[i]},remove:function(i){delete this.files[i]},clear:function(){this.files={}}};class Yf{constructor(e,t,n){const s=this;let r=!1,a=0,o=0,l;const c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this.itemStart=function(h){o++,r===!1&&s.onStart!==void 0&&s.onStart(h,a,o),r=!0},this.itemEnd=function(h){a++,s.onProgress!==void 0&&s.onProgress(h,a,o),a===o&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(h){s.onError!==void 0&&s.onError(h)},this.resolveURL=function(h){return l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,f){return c.push(h,f),this},this.removeHandler=function(h){const f=c.indexOf(h);return f!==-1&&c.splice(f,2),this},this.getHandler=function(h){for(let f=0,p=c.length;f<p;f+=2){const u=c[f],g=c[f+1];if(u.global&&(u.lastIndex=0),u.test(h))return g}return null}}}const X0=new Yf;class zn{constructor(e){this.manager=e!==void 0?e:X0,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(e,t){const n=this;return new Promise(function(s,r){n.load(e,s,t,r)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}}zn.DEFAULT_MATERIAL_NAME="__DEFAULT";const Ri={};class I2 extends Error{constructor(e,t){super(e),this.response=t}}class Oi extends zn{constructor(e){super(e)}load(e,t,n,s){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const r=Di.get(e);if(r!==void 0)return this.manager.itemStart(e),setTimeout(()=>{t&&t(r),this.manager.itemEnd(e)},0),r;if(Ri[e]!==void 0){Ri[e].push({onLoad:t,onProgress:n,onError:s});return}Ri[e]=[],Ri[e].push({onLoad:t,onProgress:n,onError:s});const a=new Request(e,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin"}),o=this.mimeType,l=this.responseType;fetch(a).then(c=>{if(c.status===200||c.status===0){if(c.status===0&&console.warn("THREE.FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||c.body===void 0||c.body.getReader===void 0)return c;const h=Ri[e],f=c.body.getReader(),p=c.headers.get("X-File-Size")||c.headers.get("Content-Length"),u=p?parseInt(p):0,g=u!==0;let y=0;const d=new ReadableStream({start(m){_();function _(){f.read().then(({done:x,value:v})=>{if(x)m.close();else{y+=v.byteLength;const E=new ProgressEvent("progress",{lengthComputable:g,loaded:y,total:u});for(let T=0,R=h.length;T<R;T++){const P=h[T];P.onProgress&&P.onProgress(E)}m.enqueue(v),_()}},x=>{m.error(x)})}}});return new Response(d)}else throw new I2(`fetch for "${c.url}" responded with ${c.status}: ${c.statusText}`,c)}).then(c=>{switch(l){case"arraybuffer":return c.arrayBuffer();case"blob":return c.blob();case"document":return c.text().then(h=>new DOMParser().parseFromString(h,o));case"json":return c.json();default:if(o===void 0)return c.text();{const f=/charset="?([^;"\s]*)"?/i.exec(o),p=f&&f[1]?f[1].toLowerCase():void 0,u=new TextDecoder(p);return c.arrayBuffer().then(g=>u.decode(g))}}}).then(c=>{Di.add(e,c);const h=Ri[e];delete Ri[e];for(let f=0,p=h.length;f<p;f++){const u=h[f];u.onLoad&&u.onLoad(c)}}).catch(c=>{const h=Ri[e];if(h===void 0)throw this.manager.itemError(e),c;delete Ri[e];for(let f=0,p=h.length;f<p;f++){const u=h[f];u.onError&&u.onError(c)}this.manager.itemError(e)}).finally(()=>{this.manager.itemEnd(e)}),this.manager.itemStart(e)}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}}class D2 extends zn{constructor(e){super(e)}load(e,t,n,s){const r=this,a=new Oi(this.manager);a.setPath(this.path),a.setRequestHeader(this.requestHeader),a.setWithCredentials(this.withCredentials),a.load(e,function(o){try{t(r.parse(JSON.parse(o)))}catch(l){s?s(l):console.error(l),r.manager.itemError(e)}},n,s)}parse(e){const t=[];for(let n=0;n<e.length;n++){const s=Ea.parse(e[n]);t.push(s)}return t}}class L2 extends zn{constructor(e){super(e)}load(e,t,n,s){const r=this,a=[],o=new fc,l=new Oi(this.manager);l.setPath(this.path),l.setResponseType("arraybuffer"),l.setRequestHeader(this.requestHeader),l.setWithCredentials(r.withCredentials);let c=0;function h(f){l.load(e[f],function(p){const u=r.parse(p,!0);a[f]={width:u.width,height:u.height,format:u.format,mipmaps:u.mipmaps},c+=1,c===6&&(u.mipmapCount===1&&(o.minFilter=Vt),o.image=a,o.format=u.format,o.needsUpdate=!0,t&&t(o))},n,s)}if(Array.isArray(e))for(let f=0,p=e.length;f<p;++f)h(f);else l.load(e,function(f){const p=r.parse(f,!0);if(p.isCubemap){const u=p.mipmaps.length/p.mipmapCount;for(let g=0;g<u;g++){a[g]={mipmaps:[]};for(let y=0;y<p.mipmapCount;y++)a[g].mipmaps.push(p.mipmaps[g*p.mipmapCount+y]),a[g].format=p.format,a[g].width=p.width,a[g].height=p.height}o.image=a}else o.image.width=p.width,o.image.height=p.height,o.mipmaps=p.mipmaps;p.mipmapCount===1&&(o.minFilter=Vt),o.format=p.format,o.needsUpdate=!0,t&&t(o)},n,s);return o}}class Ca extends zn{constructor(e){super(e)}load(e,t,n,s){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const r=this,a=Di.get(e);if(a!==void 0)return r.manager.itemStart(e),setTimeout(function(){t&&t(a),r.manager.itemEnd(e)},0),a;const o=va("img");function l(){h(),Di.add(e,this),t&&t(this),r.manager.itemEnd(e)}function c(f){h(),s&&s(f),r.manager.itemError(e),r.manager.itemEnd(e)}function h(){o.removeEventListener("load",l,!1),o.removeEventListener("error",c,!1)}return o.addEventListener("load",l,!1),o.addEventListener("error",c,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(o.crossOrigin=this.crossOrigin),r.manager.itemStart(e),o.src=e,o}}class z2 extends zn{constructor(e){super(e)}load(e,t,n,s){const r=new Ua;r.colorSpace=Dt;const a=new Ca(this.manager);a.setCrossOrigin(this.crossOrigin),a.setPath(this.path);let o=0;function l(c){a.load(e[c],function(h){r.images[c]=h,o++,o===6&&(r.needsUpdate=!0,t&&t(r))},void 0,s)}for(let c=0;c<e.length;++c)l(c);return r}}class U2 extends zn{constructor(e){super(e)}load(e,t,n,s){const r=this,a=new si,o=new Oi(this.manager);return o.setResponseType("arraybuffer"),o.setRequestHeader(this.requestHeader),o.setPath(this.path),o.setWithCredentials(r.withCredentials),o.load(e,function(l){let c;try{c=r.parse(l)}catch(h){if(s!==void 0)s(h);else{console.error(h);return}}c.image!==void 0?a.image=c.image:c.data!==void 0&&(a.image.width=c.width,a.image.height=c.height,a.image.data=c.data),a.wrapS=c.wrapS!==void 0?c.wrapS:Wn,a.wrapT=c.wrapT!==void 0?c.wrapT:Wn,a.magFilter=c.magFilter!==void 0?c.magFilter:Vt,a.minFilter=c.minFilter!==void 0?c.minFilter:Vt,a.anisotropy=c.anisotropy!==void 0?c.anisotropy:1,c.colorSpace!==void 0&&(a.colorSpace=c.colorSpace),c.flipY!==void 0&&(a.flipY=c.flipY),c.format!==void 0&&(a.format=c.format),c.type!==void 0&&(a.type=c.type),c.mipmaps!==void 0&&(a.mipmaps=c.mipmaps,a.minFilter=ni),c.mipmapCount===1&&(a.minFilter=Vt),c.generateMipmaps!==void 0&&(a.generateMipmaps=c.generateMipmaps),a.needsUpdate=!0,t&&t(a,c)},n,s),a}}class N2 extends zn{constructor(e){super(e)}load(e,t,n,s){const r=new Ht,a=new Ca(this.manager);return a.setCrossOrigin(this.crossOrigin),a.setPath(this.path),a.load(e,function(o){r.image=o,r.needsUpdate=!0,t!==void 0&&t(r)},n,s),r}}class ns extends dt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new re(e),this.intensity=t}dispose(){}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,this.groundColor!==void 0&&(t.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(t.object.distance=this.distance),this.angle!==void 0&&(t.object.angle=this.angle),this.decay!==void 0&&(t.object.decay=this.decay),this.penumbra!==void 0&&(t.object.penumbra=this.penumbra),this.shadow!==void 0&&(t.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(t.object.target=this.target.uuid),t}}class Zf extends ns{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(dt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new re(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}}const wh=new Ye,zd=new w,Ud=new w;class qf{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new $(512,512),this.map=null,this.mapPass=null,this.matrix=new Ye,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Na,this._frameExtents=new $(1,1),this._viewportCount=1,this._viewports=[new ot(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera,n=this.matrix;zd.setFromMatrixPosition(e.matrixWorld),t.position.copy(zd),Ud.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Ud),t.updateMatrixWorld(),wh.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(wh),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(wh)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}class O2 extends qf{constructor(){super(new Jt(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1}updateMatrices(e){const t=this.camera,n=_r*2*e.angle*this.focus,s=this.mapSize.width/this.mapSize.height,r=e.distance||t.far;(n!==t.fov||s!==t.aspect||r!==t.far)&&(t.fov=n,t.aspect=s,t.far=r,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this}}class Sc extends ns{constructor(e,t,n=0,s=Math.PI/3,r=0,a=2){super(e,t),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(dt.DEFAULT_UP),this.updateMatrix(),this.target=new dt,this.distance=n,this.angle=s,this.penumbra=r,this.decay=a,this.map=null,this.shadow=new O2}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}const Nd=new Ye,Zr=new w,Th=new w;class F2 extends qf{constructor(){super(new Jt(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new $(4,2),this._viewportCount=6,this._viewports=[new ot(2,1,1,1),new ot(0,1,1,1),new ot(3,1,1,1),new ot(1,1,1,1),new ot(3,0,1,1),new ot(1,0,1,1)],this._cubeDirections=[new w(1,0,0),new w(-1,0,0),new w(0,0,1),new w(0,0,-1),new w(0,1,0),new w(0,-1,0)],this._cubeUps=[new w(0,1,0),new w(0,1,0),new w(0,1,0),new w(0,1,0),new w(0,0,1),new w(0,0,-1)]}updateMatrices(e,t=0){const n=this.camera,s=this.matrix,r=e.distance||n.far;r!==n.far&&(n.far=r,n.updateProjectionMatrix()),Zr.setFromMatrixPosition(e.matrixWorld),n.position.copy(Zr),Th.copy(n.position),Th.add(this._cubeDirections[t]),n.up.copy(this._cubeUps[t]),n.lookAt(Th),n.updateMatrixWorld(),s.makeTranslation(-Zr.x,-Zr.y,-Zr.z),Nd.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Nd)}}class $f extends ns{constructor(e,t,n=0,s=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=s,this.shadow=new F2}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}}class B2 extends qf{constructor(){super(new Oa(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class Cr extends ns{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(dt.DEFAULT_UP),this.updateMatrix(),this.target=new dt,this.shadow=new B2}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}class Y0 extends ns{constructor(e,t){super(e,t),this.isAmbientLight=!0,this.type="AmbientLight"}}class Z0 extends ns{constructor(e,t,n=10,s=10){super(e,t),this.isRectAreaLight=!0,this.type="RectAreaLight",this.width=n,this.height=s}get power(){return this.intensity*this.width*this.height*Math.PI}set power(e){this.intensity=e/(this.width*this.height*Math.PI)}copy(e){return super.copy(e),this.width=e.width,this.height=e.height,this}toJSON(e){const t=super.toJSON(e);return t.object.width=this.width,t.object.height=this.height,t}}class q0{constructor(){this.isSphericalHarmonics3=!0,this.coefficients=[];for(let e=0;e<9;e++)this.coefficients.push(new w)}set(e){for(let t=0;t<9;t++)this.coefficients[t].copy(e[t]);return this}zero(){for(let e=0;e<9;e++)this.coefficients[e].set(0,0,0);return this}getAt(e,t){const n=e.x,s=e.y,r=e.z,a=this.coefficients;return t.copy(a[0]).multiplyScalar(.282095),t.addScaledVector(a[1],.488603*s),t.addScaledVector(a[2],.488603*r),t.addScaledVector(a[3],.488603*n),t.addScaledVector(a[4],1.092548*(n*s)),t.addScaledVector(a[5],1.092548*(s*r)),t.addScaledVector(a[6],.315392*(3*r*r-1)),t.addScaledVector(a[7],1.092548*(n*r)),t.addScaledVector(a[8],.546274*(n*n-s*s)),t}getIrradianceAt(e,t){const n=e.x,s=e.y,r=e.z,a=this.coefficients;return t.copy(a[0]).multiplyScalar(.886227),t.addScaledVector(a[1],2*.511664*s),t.addScaledVector(a[2],2*.511664*r),t.addScaledVector(a[3],2*.511664*n),t.addScaledVector(a[4],2*.429043*n*s),t.addScaledVector(a[5],2*.429043*s*r),t.addScaledVector(a[6],.743125*r*r-.247708),t.addScaledVector(a[7],2*.429043*n*r),t.addScaledVector(a[8],.429043*(n*n-s*s)),t}add(e){for(let t=0;t<9;t++)this.coefficients[t].add(e.coefficients[t]);return this}addScaledSH(e,t){for(let n=0;n<9;n++)this.coefficients[n].addScaledVector(e.coefficients[n],t);return this}scale(e){for(let t=0;t<9;t++)this.coefficients[t].multiplyScalar(e);return this}lerp(e,t){for(let n=0;n<9;n++)this.coefficients[n].lerp(e.coefficients[n],t);return this}equals(e){for(let t=0;t<9;t++)if(!this.coefficients[t].equals(e.coefficients[t]))return!1;return!0}copy(e){return this.set(e.coefficients)}clone(){return new this.constructor().copy(this)}fromArray(e,t=0){const n=this.coefficients;for(let s=0;s<9;s++)n[s].fromArray(e,t+s*3);return this}toArray(e=[],t=0){const n=this.coefficients;for(let s=0;s<9;s++)n[s].toArray(e,t+s*3);return e}static getBasisAt(e,t){const n=e.x,s=e.y,r=e.z;t[0]=.282095,t[1]=.488603*s,t[2]=.488603*r,t[3]=.488603*n,t[4]=1.092548*n*s,t[5]=1.092548*s*r,t[6]=.315392*(3*r*r-1),t[7]=1.092548*n*r,t[8]=.546274*(n*n-s*s)}}class $0 extends ns{constructor(e=new q0,t=1){super(void 0,t),this.isLightProbe=!0,this.sh=e}copy(e){return super.copy(e),this.sh.copy(e.sh),this}fromJSON(e){return this.intensity=e.intensity,this.sh.fromArray(e.sh),this}toJSON(e){const t=super.toJSON(e);return t.object.sh=this.sh.toArray(),t}}class wc extends zn{constructor(e){super(e),this.textures={}}load(e,t,n,s){const r=this,a=new Oi(r.manager);a.setPath(r.path),a.setRequestHeader(r.requestHeader),a.setWithCredentials(r.withCredentials),a.load(e,function(o){try{t(r.parse(JSON.parse(o)))}catch(l){s?s(l):console.error(l),r.manager.itemError(e)}},n,s)}parse(e){const t=this.textures;function n(r){return t[r]===void 0&&console.warn("THREE.MaterialLoader: Undefined texture",r),t[r]}const s=this.createMaterialFromType(e.type);if(e.uuid!==void 0&&(s.uuid=e.uuid),e.name!==void 0&&(s.name=e.name),e.color!==void 0&&s.color!==void 0&&s.color.setHex(e.color),e.roughness!==void 0&&(s.roughness=e.roughness),e.metalness!==void 0&&(s.metalness=e.metalness),e.sheen!==void 0&&(s.sheen=e.sheen),e.sheenColor!==void 0&&(s.sheenColor=new re().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(s.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&s.emissive!==void 0&&s.emissive.setHex(e.emissive),e.specular!==void 0&&s.specular!==void 0&&s.specular.setHex(e.specular),e.specularIntensity!==void 0&&(s.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&s.specularColor!==void 0&&s.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(s.shininess=e.shininess),e.clearcoat!==void 0&&(s.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(s.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(s.dispersion=e.dispersion),e.iridescence!==void 0&&(s.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(s.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(s.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(s.transmission=e.transmission),e.thickness!==void 0&&(s.thickness=e.thickness),e.attenuationDistance!==void 0&&(s.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&s.attenuationColor!==void 0&&s.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(s.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(s.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(s.fog=e.fog),e.flatShading!==void 0&&(s.flatShading=e.flatShading),e.blending!==void 0&&(s.blending=e.blending),e.combine!==void 0&&(s.combine=e.combine),e.side!==void 0&&(s.side=e.side),e.shadowSide!==void 0&&(s.shadowSide=e.shadowSide),e.opacity!==void 0&&(s.opacity=e.opacity),e.transparent!==void 0&&(s.transparent=e.transparent),e.alphaTest!==void 0&&(s.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(s.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(s.depthFunc=e.depthFunc),e.depthTest!==void 0&&(s.depthTest=e.depthTest),e.depthWrite!==void 0&&(s.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(s.colorWrite=e.colorWrite),e.blendSrc!==void 0&&(s.blendSrc=e.blendSrc),e.blendDst!==void 0&&(s.blendDst=e.blendDst),e.blendEquation!==void 0&&(s.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(s.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(s.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(s.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&s.blendColor!==void 0&&s.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(s.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(s.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(s.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(s.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(s.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(s.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(s.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(s.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(s.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(s.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(s.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(s.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(s.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(s.rotation=e.rotation),e.linewidth!==void 0&&(s.linewidth=e.linewidth),e.dashSize!==void 0&&(s.dashSize=e.dashSize),e.gapSize!==void 0&&(s.gapSize=e.gapSize),e.scale!==void 0&&(s.scale=e.scale),e.polygonOffset!==void 0&&(s.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(s.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(s.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(s.dithering=e.dithering),e.alphaToCoverage!==void 0&&(s.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(s.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(s.forceSinglePass=e.forceSinglePass),e.visible!==void 0&&(s.visible=e.visible),e.toneMapped!==void 0&&(s.toneMapped=e.toneMapped),e.userData!==void 0&&(s.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?s.vertexColors=e.vertexColors>0:s.vertexColors=e.vertexColors),e.uniforms!==void 0)for(const r in e.uniforms){const a=e.uniforms[r];switch(s.uniforms[r]={},a.type){case"t":s.uniforms[r].value=n(a.value);break;case"c":s.uniforms[r].value=new re().setHex(a.value);break;case"v2":s.uniforms[r].value=new $().fromArray(a.value);break;case"v3":s.uniforms[r].value=new w().fromArray(a.value);break;case"v4":s.uniforms[r].value=new ot().fromArray(a.value);break;case"m3":s.uniforms[r].value=new et().fromArray(a.value);break;case"m4":s.uniforms[r].value=new Ye().fromArray(a.value);break;default:s.uniforms[r].value=a.value}}if(e.defines!==void 0&&(s.defines=e.defines),e.vertexShader!==void 0&&(s.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(s.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(s.glslVersion=e.glslVersion),e.extensions!==void 0)for(const r in e.extensions)s.extensions[r]=e.extensions[r];if(e.lights!==void 0&&(s.lights=e.lights),e.clipping!==void 0&&(s.clipping=e.clipping),e.size!==void 0&&(s.size=e.size),e.sizeAttenuation!==void 0&&(s.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(s.map=n(e.map)),e.matcap!==void 0&&(s.matcap=n(e.matcap)),e.alphaMap!==void 0&&(s.alphaMap=n(e.alphaMap)),e.bumpMap!==void 0&&(s.bumpMap=n(e.bumpMap)),e.bumpScale!==void 0&&(s.bumpScale=e.bumpScale),e.normalMap!==void 0&&(s.normalMap=n(e.normalMap)),e.normalMapType!==void 0&&(s.normalMapType=e.normalMapType),e.normalScale!==void 0){let r=e.normalScale;Array.isArray(r)===!1&&(r=[r,r]),s.normalScale=new $().fromArray(r)}return e.displacementMap!==void 0&&(s.displacementMap=n(e.displacementMap)),e.displacementScale!==void 0&&(s.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(s.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(s.roughnessMap=n(e.roughnessMap)),e.metalnessMap!==void 0&&(s.metalnessMap=n(e.metalnessMap)),e.emissiveMap!==void 0&&(s.emissiveMap=n(e.emissiveMap)),e.emissiveIntensity!==void 0&&(s.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(s.specularMap=n(e.specularMap)),e.specularIntensityMap!==void 0&&(s.specularIntensityMap=n(e.specularIntensityMap)),e.specularColorMap!==void 0&&(s.specularColorMap=n(e.specularColorMap)),e.envMap!==void 0&&(s.envMap=n(e.envMap)),e.envMapRotation!==void 0&&s.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(s.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(s.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(s.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(s.lightMap=n(e.lightMap)),e.lightMapIntensity!==void 0&&(s.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(s.aoMap=n(e.aoMap)),e.aoMapIntensity!==void 0&&(s.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(s.gradientMap=n(e.gradientMap)),e.clearcoatMap!==void 0&&(s.clearcoatMap=n(e.clearcoatMap)),e.clearcoatRoughnessMap!==void 0&&(s.clearcoatRoughnessMap=n(e.clearcoatRoughnessMap)),e.clearcoatNormalMap!==void 0&&(s.clearcoatNormalMap=n(e.clearcoatNormalMap)),e.clearcoatNormalScale!==void 0&&(s.clearcoatNormalScale=new $().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(s.iridescenceMap=n(e.iridescenceMap)),e.iridescenceThicknessMap!==void 0&&(s.iridescenceThicknessMap=n(e.iridescenceThicknessMap)),e.transmissionMap!==void 0&&(s.transmissionMap=n(e.transmissionMap)),e.thicknessMap!==void 0&&(s.thicknessMap=n(e.thicknessMap)),e.anisotropyMap!==void 0&&(s.anisotropyMap=n(e.anisotropyMap)),e.sheenColorMap!==void 0&&(s.sheenColorMap=n(e.sheenColorMap)),e.sheenRoughnessMap!==void 0&&(s.sheenRoughnessMap=n(e.sheenRoughnessMap)),s}setTextures(e){return this.textures=e,this}createMaterialFromType(e){return wc.createMaterialFromType(e)}static createMaterialFromType(e){const t={ShadowMaterial:D0,SpriteMaterial:Ba,RawShaderMaterial:L0,ShaderMaterial:At,PointsMaterial:Lf,MeshPhysicalMaterial:z0,MeshStandardMaterial:Vf,MeshPhongMaterial:U0,MeshToonMaterial:Hf,MeshNormalMaterial:N0,MeshLambertMaterial:O0,MeshDepthMaterial:Rf,MeshDistanceMaterial:Pf,MeshBasicMaterial:De,MeshMatcapMaterial:F0,LineDashedMaterial:B0,LineBasicMaterial:bn,Material:yn};return new t[e]}}class tf{static decodeText(e){if(console.warn("THREE.LoaderUtils: decodeText() has been deprecated with r165 and will be removed with r175. Use TextDecoder instead."),typeof TextDecoder<"u")return new TextDecoder().decode(e);let t="";for(let n=0,s=e.length;n<s;n++)t+=String.fromCharCode(e[n]);try{return decodeURIComponent(escape(t))}catch{return t}}static extractUrlBase(e){const t=e.lastIndexOf("/");return t===-1?"./":e.slice(0,t+1)}static resolveURL(e,t){return typeof e!="string"||e===""?"":(/^https?:\/\//i.test(t)&&/^\//.test(e)&&(t=t.replace(/(^https?:\/\/[^\/]+).*/i,"$1")),/^(https?:)?\/\//i.test(e)||/^data:.*,.*$/i.test(e)||/^blob:.*$/i.test(e)?e:t+e)}}class Kf extends tt{constructor(){super(),this.isInstancedBufferGeometry=!0,this.type="InstancedBufferGeometry",this.instanceCount=1/0}copy(e){return super.copy(e),this.instanceCount=e.instanceCount,this}toJSON(){const e=super.toJSON();return e.instanceCount=this.instanceCount,e.isInstancedBufferGeometry=!0,e}}class K0 extends zn{constructor(e){super(e)}load(e,t,n,s){const r=this,a=new Oi(r.manager);a.setPath(r.path),a.setRequestHeader(r.requestHeader),a.setWithCredentials(r.withCredentials),a.load(e,function(o){try{t(r.parse(JSON.parse(o)))}catch(l){s?s(l):console.error(l),r.manager.itemError(e)}},n,s)}parse(e){const t={},n={};function s(u,g){if(t[g]!==void 0)return t[g];const d=u.interleavedBuffers[g],m=r(u,d.buffer),_=fr(d.type,m),x=new lc(_,d.stride);return x.uuid=d.uuid,t[g]=x,x}function r(u,g){if(n[g]!==void 0)return n[g];const d=u.arrayBuffers[g],m=new Uint32Array(d).buffer;return n[g]=m,m}const a=e.isInstancedBufferGeometry?new Kf:new tt,o=e.data.index;if(o!==void 0){const u=fr(o.type,o.array);a.setIndex(new Et(u,1))}const l=e.data.attributes;for(const u in l){const g=l[u];let y;if(g.isInterleavedBufferAttribute){const d=s(e.data,g.data);y=new zs(d,g.itemSize,g.offset,g.normalized)}else{const d=fr(g.type,g.array),m=g.isInstancedBufferAttribute?Us:Et;y=new m(d,g.itemSize,g.normalized)}g.name!==void 0&&(y.name=g.name),g.usage!==void 0&&y.setUsage(g.usage),a.setAttribute(u,y)}const c=e.data.morphAttributes;if(c)for(const u in c){const g=c[u],y=[];for(let d=0,m=g.length;d<m;d++){const _=g[d];let x;if(_.isInterleavedBufferAttribute){const v=s(e.data,_.data);x=new zs(v,_.itemSize,_.offset,_.normalized)}else{const v=fr(_.type,_.array);x=new Et(v,_.itemSize,_.normalized)}_.name!==void 0&&(x.name=_.name),y.push(x)}a.morphAttributes[u]=y}e.data.morphTargetsRelative&&(a.morphTargetsRelative=!0);const f=e.data.groups||e.data.drawcalls||e.data.offsets;if(f!==void 0)for(let u=0,g=f.length;u!==g;++u){const y=f[u];a.addGroup(y.start,y.count,y.materialIndex)}const p=e.data.boundingSphere;if(p!==void 0){const u=new w;p.center!==void 0&&u.fromArray(p.center),a.boundingSphere=new gn(u,p.radius)}return e.name&&(a.name=e.name),e.userData&&(a.userData=e.userData),a}}class k2 extends zn{constructor(e){super(e)}load(e,t,n,s){const r=this,a=this.path===""?tf.extractUrlBase(e):this.path;this.resourcePath=this.resourcePath||a;const o=new Oi(this.manager);o.setPath(this.path),o.setRequestHeader(this.requestHeader),o.setWithCredentials(this.withCredentials),o.load(e,function(l){let c=null;try{c=JSON.parse(l)}catch(f){s!==void 0&&s(f),console.error("THREE:ObjectLoader: Can't parse "+e+".",f.message);return}const h=c.metadata;if(h===void 0||h.type===void 0||h.type.toLowerCase()==="geometry"){s!==void 0&&s(new Error("THREE.ObjectLoader: Can't load "+e)),console.error("THREE.ObjectLoader: Can't load "+e);return}r.parse(c,t)},n,s)}async loadAsync(e,t){const n=this,s=this.path===""?tf.extractUrlBase(e):this.path;this.resourcePath=this.resourcePath||s;const r=new Oi(this.manager);r.setPath(this.path),r.setRequestHeader(this.requestHeader),r.setWithCredentials(this.withCredentials);const a=await r.loadAsync(e,t),o=JSON.parse(a),l=o.metadata;if(l===void 0||l.type===void 0||l.type.toLowerCase()==="geometry")throw new Error("THREE.ObjectLoader: Can't load "+e);return await n.parseAsync(o)}parse(e,t){const n=this.parseAnimations(e.animations),s=this.parseShapes(e.shapes),r=this.parseGeometries(e.geometries,s),a=this.parseImages(e.images,function(){t!==void 0&&t(c)}),o=this.parseTextures(e.textures,a),l=this.parseMaterials(e.materials,o),c=this.parseObject(e.object,r,l,o,n),h=this.parseSkeletons(e.skeletons,c);if(this.bindSkeletons(c,h),this.bindLightTargets(c),t!==void 0){let f=!1;for(const p in a)if(a[p].data instanceof HTMLImageElement){f=!0;break}f===!1&&t(c)}return c}async parseAsync(e){const t=this.parseAnimations(e.animations),n=this.parseShapes(e.shapes),s=this.parseGeometries(e.geometries,n),r=await this.parseImagesAsync(e.images),a=this.parseTextures(e.textures,r),o=this.parseMaterials(e.materials,a),l=this.parseObject(e.object,s,o,a,t),c=this.parseSkeletons(e.skeletons,l);return this.bindSkeletons(l,c),this.bindLightTargets(l),l}parseShapes(e){const t={};if(e!==void 0)for(let n=0,s=e.length;n<s;n++){const r=new Ps().fromJSON(e[n]);t[r.uuid]=r}return t}parseSkeletons(e,t){const n={},s={};if(t.traverse(function(r){r.isBone&&(s[r.uuid]=r)}),e!==void 0)for(let r=0,a=e.length;r<a;r++){const o=new hc().fromJSON(e[r],s);n[o.uuid]=o}return n}parseGeometries(e,t){const n={};if(e!==void 0){const s=new K0;for(let r=0,a=e.length;r<a;r++){let o;const l=e[r];switch(l.type){case"BufferGeometry":case"InstancedBufferGeometry":o=s.parse(l);break;default:l.type in Ld?o=Ld[l.type].fromJSON(l,t):console.warn(`THREE.ObjectLoader: Unsupported geometry type "${l.type}"`)}o.uuid=l.uuid,l.name!==void 0&&(o.name=l.name),l.userData!==void 0&&(o.userData=l.userData),n[l.uuid]=o}}return n}parseMaterials(e,t){const n={},s={};if(e!==void 0){const r=new wc;r.setTextures(t);for(let a=0,o=e.length;a<o;a++){const l=e[a];n[l.uuid]===void 0&&(n[l.uuid]=r.parse(l)),s[l.uuid]=n[l.uuid]}}return s}parseAnimations(e){const t={};if(e!==void 0)for(let n=0;n<e.length;n++){const s=e[n],r=Ea.parse(s);t[r.uuid]=r}return t}parseImages(e,t){const n=this,s={};let r;function a(l){return n.manager.itemStart(l),r.load(l,function(){n.manager.itemEnd(l)},void 0,function(){n.manager.itemError(l),n.manager.itemEnd(l)})}function o(l){if(typeof l=="string"){const c=l,h=/^(\/\/)|([a-z]+:(\/\/)?)/i.test(c)?c:n.resourcePath+c;return a(h)}else return l.data?{data:fr(l.type,l.data),width:l.width,height:l.height}:null}if(e!==void 0&&e.length>0){const l=new Yf(t);r=new Ca(l),r.setCrossOrigin(this.crossOrigin);for(let c=0,h=e.length;c<h;c++){const f=e[c],p=f.url;if(Array.isArray(p)){const u=[];for(let g=0,y=p.length;g<y;g++){const d=p[g],m=o(d);m!==null&&(m instanceof HTMLImageElement?u.push(m):u.push(new si(m.data,m.width,m.height)))}s[f.uuid]=new Ts(u)}else{const u=o(f.url);s[f.uuid]=new Ts(u)}}}return s}async parseImagesAsync(e){const t=this,n={};let s;async function r(a){if(typeof a=="string"){const o=a,l=/^(\/\/)|([a-z]+:(\/\/)?)/i.test(o)?o:t.resourcePath+o;return await s.loadAsync(l)}else return a.data?{data:fr(a.type,a.data),width:a.width,height:a.height}:null}if(e!==void 0&&e.length>0){s=new Ca(this.manager),s.setCrossOrigin(this.crossOrigin);for(let a=0,o=e.length;a<o;a++){const l=e[a],c=l.url;if(Array.isArray(c)){const h=[];for(let f=0,p=c.length;f<p;f++){const u=c[f],g=await r(u);g!==null&&(g instanceof HTMLImageElement?h.push(g):h.push(new si(g.data,g.width,g.height)))}n[l.uuid]=new Ts(h)}else{const h=await r(l.url);n[l.uuid]=new Ts(h)}}}return n}parseTextures(e,t){function n(r,a){return typeof r=="number"?r:(console.warn("THREE.ObjectLoader.parseTexture: Constant should be in numeric form.",r),a[r])}const s={};if(e!==void 0)for(let r=0,a=e.length;r<a;r++){const o=e[r];o.image===void 0&&console.warn('THREE.ObjectLoader: No "image" specified for',o.uuid),t[o.image]===void 0&&console.warn("THREE.ObjectLoader: Undefined image",o.image);const l=t[o.image],c=l.data;let h;Array.isArray(c)?(h=new Ua,c.length===6&&(h.needsUpdate=!0)):(c&&c.data?h=new si:h=new Ht,c&&(h.needsUpdate=!0)),h.source=l,h.uuid=o.uuid,o.name!==void 0&&(h.name=o.name),o.mapping!==void 0&&(h.mapping=n(o.mapping,V2)),o.channel!==void 0&&(h.channel=o.channel),o.offset!==void 0&&h.offset.fromArray(o.offset),o.repeat!==void 0&&h.repeat.fromArray(o.repeat),o.center!==void 0&&h.center.fromArray(o.center),o.rotation!==void 0&&(h.rotation=o.rotation),o.wrap!==void 0&&(h.wrapS=n(o.wrap[0],Od),h.wrapT=n(o.wrap[1],Od)),o.format!==void 0&&(h.format=o.format),o.internalFormat!==void 0&&(h.internalFormat=o.internalFormat),o.type!==void 0&&(h.type=o.type),o.colorSpace!==void 0&&(h.colorSpace=o.colorSpace),o.minFilter!==void 0&&(h.minFilter=n(o.minFilter,Fd)),o.magFilter!==void 0&&(h.magFilter=n(o.magFilter,Fd)),o.anisotropy!==void 0&&(h.anisotropy=o.anisotropy),o.flipY!==void 0&&(h.flipY=o.flipY),o.generateMipmaps!==void 0&&(h.generateMipmaps=o.generateMipmaps),o.premultiplyAlpha!==void 0&&(h.premultiplyAlpha=o.premultiplyAlpha),o.unpackAlignment!==void 0&&(h.unpackAlignment=o.unpackAlignment),o.compareFunction!==void 0&&(h.compareFunction=o.compareFunction),o.userData!==void 0&&(h.userData=o.userData),s[o.uuid]=h}return s}parseObject(e,t,n,s,r){let a;function o(p){return t[p]===void 0&&console.warn("THREE.ObjectLoader: Undefined geometry",p),t[p]}function l(p){if(p!==void 0){if(Array.isArray(p)){const u=[];for(let g=0,y=p.length;g<y;g++){const d=p[g];n[d]===void 0&&console.warn("THREE.ObjectLoader: Undefined material",d),u.push(n[d])}return u}return n[p]===void 0&&console.warn("THREE.ObjectLoader: Undefined material",p),n[p]}}function c(p){return s[p]===void 0&&console.warn("THREE.ObjectLoader: Undefined texture",p),s[p]}let h,f;switch(e.type){case"Scene":a=new If,e.background!==void 0&&(Number.isInteger(e.background)?a.background=new re(e.background):a.background=c(e.background)),e.environment!==void 0&&(a.environment=c(e.environment)),e.fog!==void 0&&(e.fog.type==="Fog"?a.fog=new oc(e.fog.color,e.fog.near,e.fog.far):e.fog.type==="FogExp2"&&(a.fog=new Fa(e.fog.color,e.fog.density)),e.fog.name!==""&&(a.fog.name=e.fog.name)),e.backgroundBlurriness!==void 0&&(a.backgroundBlurriness=e.backgroundBlurriness),e.backgroundIntensity!==void 0&&(a.backgroundIntensity=e.backgroundIntensity),e.backgroundRotation!==void 0&&a.backgroundRotation.fromArray(e.backgroundRotation),e.environmentIntensity!==void 0&&(a.environmentIntensity=e.environmentIntensity),e.environmentRotation!==void 0&&a.environmentRotation.fromArray(e.environmentRotation);break;case"PerspectiveCamera":a=new Jt(e.fov,e.aspect,e.near,e.far),e.focus!==void 0&&(a.focus=e.focus),e.zoom!==void 0&&(a.zoom=e.zoom),e.filmGauge!==void 0&&(a.filmGauge=e.filmGauge),e.filmOffset!==void 0&&(a.filmOffset=e.filmOffset),e.view!==void 0&&(a.view=Object.assign({},e.view));break;case"OrthographicCamera":a=new Oa(e.left,e.right,e.top,e.bottom,e.near,e.far),e.zoom!==void 0&&(a.zoom=e.zoom),e.view!==void 0&&(a.view=Object.assign({},e.view));break;case"AmbientLight":a=new Y0(e.color,e.intensity);break;case"DirectionalLight":a=new Cr(e.color,e.intensity),a.target=e.target||"";break;case"PointLight":a=new $f(e.color,e.intensity,e.distance,e.decay);break;case"RectAreaLight":a=new Z0(e.color,e.intensity,e.width,e.height);break;case"SpotLight":a=new Sc(e.color,e.intensity,e.distance,e.angle,e.penumbra,e.decay),a.target=e.target||"";break;case"HemisphereLight":a=new Zf(e.color,e.groundColor,e.intensity);break;case"LightProbe":a=new $0().fromJSON(e);break;case"SkinnedMesh":h=o(e.geometry),f=l(e.material),a=new x0(h,f),e.bindMode!==void 0&&(a.bindMode=e.bindMode),e.bindMatrix!==void 0&&a.bindMatrix.fromArray(e.bindMatrix),e.skeleton!==void 0&&(a.skeleton=e.skeleton);break;case"Mesh":h=o(e.geometry),f=l(e.material),a=new lt(h,f);break;case"InstancedMesh":h=o(e.geometry),f=l(e.material);const p=e.count,u=e.instanceMatrix,g=e.instanceColor;a=new Ar(h,f,p),a.instanceMatrix=new Us(new Float32Array(u.array),16),g!==void 0&&(a.instanceColor=new Us(new Float32Array(g.array),g.itemSize));break;case"BatchedMesh":h=o(e.geometry),f=l(e.material),a=new v0(e.maxInstanceCount,e.maxVertexCount,e.maxIndexCount,f),a.geometry=h,a.perObjectFrustumCulled=e.perObjectFrustumCulled,a.sortObjects=e.sortObjects,a._drawRanges=e.drawRanges,a._reservedRanges=e.reservedRanges,a._visibility=e.visibility,a._active=e.active,a._bounds=e.bounds.map(y=>{const d=new jt;d.min.fromArray(y.boxMin),d.max.fromArray(y.boxMax);const m=new gn;return m.radius=y.sphereRadius,m.center.fromArray(y.sphereCenter),{boxInitialized:y.boxInitialized,box:d,sphereInitialized:y.sphereInitialized,sphere:m}}),a._maxInstanceCount=e.maxInstanceCount,a._maxVertexCount=e.maxVertexCount,a._maxIndexCount=e.maxIndexCount,a._geometryInitialized=e.geometryInitialized,a._geometryCount=e.geometryCount,a._matricesTexture=c(e.matricesTexture.uuid),e.colorsTexture!==void 0&&(a._colorsTexture=c(e.colorsTexture.uuid));break;case"LOD":a=new _0;break;case"Line":a=new ji(o(e.geometry),l(e.material));break;case"LineLoop":a=new M0(o(e.geometry),l(e.material));break;case"LineSegments":a=new Mi(o(e.geometry),l(e.material));break;case"PointCloud":case"Points":a=new b0(o(e.geometry),l(e.material));break;case"Sprite":a=new cc(l(e.material));break;case"Group":a=new di;break;case"Bone":a=new Df;break;default:a=new dt}if(a.uuid=e.uuid,e.name!==void 0&&(a.name=e.name),e.matrix!==void 0?(a.matrix.fromArray(e.matrix),e.matrixAutoUpdate!==void 0&&(a.matrixAutoUpdate=e.matrixAutoUpdate),a.matrixAutoUpdate&&a.matrix.decompose(a.position,a.quaternion,a.scale)):(e.position!==void 0&&a.position.fromArray(e.position),e.rotation!==void 0&&a.rotation.fromArray(e.rotation),e.quaternion!==void 0&&a.quaternion.fromArray(e.quaternion),e.scale!==void 0&&a.scale.fromArray(e.scale)),e.up!==void 0&&a.up.fromArray(e.up),e.castShadow!==void 0&&(a.castShadow=e.castShadow),e.receiveShadow!==void 0&&(a.receiveShadow=e.receiveShadow),e.shadow&&(e.shadow.intensity!==void 0&&(a.shadow.intensity=e.shadow.intensity),e.shadow.bias!==void 0&&(a.shadow.bias=e.shadow.bias),e.shadow.normalBias!==void 0&&(a.shadow.normalBias=e.shadow.normalBias),e.shadow.radius!==void 0&&(a.shadow.radius=e.shadow.radius),e.shadow.mapSize!==void 0&&a.shadow.mapSize.fromArray(e.shadow.mapSize),e.shadow.camera!==void 0&&(a.shadow.camera=this.parseObject(e.shadow.camera))),e.visible!==void 0&&(a.visible=e.visible),e.frustumCulled!==void 0&&(a.frustumCulled=e.frustumCulled),e.renderOrder!==void 0&&(a.renderOrder=e.renderOrder),e.userData!==void 0&&(a.userData=e.userData),e.layers!==void 0&&(a.layers.mask=e.layers),e.children!==void 0){const p=e.children;for(let u=0;u<p.length;u++)a.add(this.parseObject(p[u],t,n,s,r))}if(e.animations!==void 0){const p=e.animations;for(let u=0;u<p.length;u++){const g=p[u];a.animations.push(r[g])}}if(e.type==="LOD"){e.autoUpdate!==void 0&&(a.autoUpdate=e.autoUpdate);const p=e.levels;for(let u=0;u<p.length;u++){const g=p[u],y=a.getObjectByProperty("uuid",g.object);y!==void 0&&a.addLevel(y,g.distance,g.hysteresis)}}return a}bindSkeletons(e,t){Object.keys(t).length!==0&&e.traverse(function(n){if(n.isSkinnedMesh===!0&&n.skeleton!==void 0){const s=t[n.skeleton];s===void 0?console.warn("THREE.ObjectLoader: No skeleton found with UUID:",n.skeleton):n.bind(s,n.bindMatrix)}})}bindLightTargets(e){e.traverse(function(t){if(t.isDirectionalLight||t.isSpotLight){const n=t.target,s=e.getObjectByProperty("uuid",n);s!==void 0?t.target=s:t.target=new dt}})}}const V2={UVMapping:$l,CubeReflectionMapping:Ui,CubeRefractionMapping:Ji,EquirectangularReflectionMapping:da,EquirectangularRefractionMapping:pa,CubeUVReflectionMapping:wr},Od={RepeatWrapping:gr,ClampToEdgeWrapping:Wn,MirroredRepeatWrapping:ma},Fd={NearestFilter:Qt,NearestMipmapNearestFilter:ff,NearestMipmapLinearFilter:hr,LinearFilter:Vt,LinearMipmapNearestFilter:na,LinearMipmapLinearFilter:ni};class H2 extends zn{constructor(e){super(e),this.isImageBitmapLoader=!0,typeof createImageBitmap>"u"&&console.warn("THREE.ImageBitmapLoader: createImageBitmap() not supported."),typeof fetch>"u"&&console.warn("THREE.ImageBitmapLoader: fetch() not supported."),this.options={premultiplyAlpha:"none"}}setOptions(e){return this.options=e,this}load(e,t,n,s){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const r=this,a=Di.get(e);if(a!==void 0){if(r.manager.itemStart(e),a.then){a.then(c=>{t&&t(c),r.manager.itemEnd(e)}).catch(c=>{s&&s(c)});return}return setTimeout(function(){t&&t(a),r.manager.itemEnd(e)},0),a}const o={};o.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",o.headers=this.requestHeader;const l=fetch(e,o).then(function(c){return c.blob()}).then(function(c){return createImageBitmap(c,Object.assign(r.options,{colorSpaceConversion:"none"}))}).then(function(c){return Di.add(e,c),t&&t(c),r.manager.itemEnd(e),c}).catch(function(c){s&&s(c),Di.remove(e),r.manager.itemError(e),r.manager.itemEnd(e)});Di.add(e,l),r.manager.itemStart(e)}}let No;class Jf{static getContext(){return No===void 0&&(No=new(window.AudioContext||window.webkitAudioContext)),No}static setContext(e){No=e}}class G2 extends zn{constructor(e){super(e)}load(e,t,n,s){const r=this,a=new Oi(this.manager);a.setResponseType("arraybuffer"),a.setPath(this.path),a.setRequestHeader(this.requestHeader),a.setWithCredentials(this.withCredentials),a.load(e,function(l){try{const c=l.slice(0);Jf.getContext().decodeAudioData(c,function(f){t(f)}).catch(o)}catch(c){o(c)}},n,s);function o(l){s?s(l):console.error(l),r.manager.itemError(e)}}}const Bd=new Ye,kd=new Ye,ds=new Ye;class W2{constructor(){this.type="StereoCamera",this.aspect=1,this.eyeSep=.064,this.cameraL=new Jt,this.cameraL.layers.enable(1),this.cameraL.matrixAutoUpdate=!1,this.cameraR=new Jt,this.cameraR.layers.enable(2),this.cameraR.matrixAutoUpdate=!1,this._cache={focus:null,fov:null,aspect:null,near:null,far:null,zoom:null,eyeSep:null}}update(e){const t=this._cache;if(t.focus!==e.focus||t.fov!==e.fov||t.aspect!==e.aspect*this.aspect||t.near!==e.near||t.far!==e.far||t.zoom!==e.zoom||t.eyeSep!==this.eyeSep){t.focus=e.focus,t.fov=e.fov,t.aspect=e.aspect*this.aspect,t.near=e.near,t.far=e.far,t.zoom=e.zoom,t.eyeSep=this.eyeSep,ds.copy(e.projectionMatrix);const s=t.eyeSep/2,r=s*t.near/t.focus,a=t.near*Math.tan(Rs*t.fov*.5)/t.zoom;let o,l;kd.elements[12]=-s,Bd.elements[12]=s,o=-a*t.aspect+r,l=a*t.aspect+r,ds.elements[0]=2*t.near/(l-o),ds.elements[8]=(l+o)/(l-o),this.cameraL.projectionMatrix.copy(ds),o=-a*t.aspect-r,l=a*t.aspect-r,ds.elements[0]=2*t.near/(l-o),ds.elements[8]=(l+o)/(l-o),this.cameraR.projectionMatrix.copy(ds)}this.cameraL.matrixWorld.copy(e.matrixWorld).multiply(kd),this.cameraR.matrixWorld.copy(e.matrixWorld).multiply(Bd)}}class Tc{constructor(e=!0){this.autoStart=e,this.startTime=0,this.oldTime=0,this.elapsedTime=0,this.running=!1}start(){this.startTime=Vd(),this.oldTime=this.startTime,this.elapsedTime=0,this.running=!0}stop(){this.getElapsedTime(),this.running=!1,this.autoStart=!1}getElapsedTime(){return this.getDelta(),this.elapsedTime}getDelta(){let e=0;if(this.autoStart&&!this.running)return this.start(),0;if(this.running){const t=Vd();e=(t-this.oldTime)/1e3,this.oldTime=t,this.elapsedTime+=e}return e}}function Vd(){return performance.now()}const ps=new w,Hd=new en,X2=new w,ms=new w;class Y2 extends dt{constructor(){super(),this.type="AudioListener",this.context=Jf.getContext(),this.gain=this.context.createGain(),this.gain.connect(this.context.destination),this.filter=null,this.timeDelta=0,this._clock=new Tc}getInput(){return this.gain}removeFilter(){return this.filter!==null&&(this.gain.disconnect(this.filter),this.filter.disconnect(this.context.destination),this.gain.connect(this.context.destination),this.filter=null),this}getFilter(){return this.filter}setFilter(e){return this.filter!==null?(this.gain.disconnect(this.filter),this.filter.disconnect(this.context.destination)):this.gain.disconnect(this.context.destination),this.filter=e,this.gain.connect(this.filter),this.filter.connect(this.context.destination),this}getMasterVolume(){return this.gain.gain.value}setMasterVolume(e){return this.gain.gain.setTargetAtTime(e,this.context.currentTime,.01),this}updateMatrixWorld(e){super.updateMatrixWorld(e);const t=this.context.listener,n=this.up;if(this.timeDelta=this._clock.getDelta(),this.matrixWorld.decompose(ps,Hd,X2),ms.set(0,0,-1).applyQuaternion(Hd),t.positionX){const s=this.context.currentTime+this.timeDelta;t.positionX.linearRampToValueAtTime(ps.x,s),t.positionY.linearRampToValueAtTime(ps.y,s),t.positionZ.linearRampToValueAtTime(ps.z,s),t.forwardX.linearRampToValueAtTime(ms.x,s),t.forwardY.linearRampToValueAtTime(ms.y,s),t.forwardZ.linearRampToValueAtTime(ms.z,s),t.upX.linearRampToValueAtTime(n.x,s),t.upY.linearRampToValueAtTime(n.y,s),t.upZ.linearRampToValueAtTime(n.z,s)}else t.setPosition(ps.x,ps.y,ps.z),t.setOrientation(ms.x,ms.y,ms.z,n.x,n.y,n.z)}}class J0 extends dt{constructor(e){super(),this.type="Audio",this.listener=e,this.context=e.context,this.gain=this.context.createGain(),this.gain.connect(e.getInput()),this.autoplay=!1,this.buffer=null,this.detune=0,this.loop=!1,this.loopStart=0,this.loopEnd=0,this.offset=0,this.duration=void 0,this.playbackRate=1,this.isPlaying=!1,this.hasPlaybackControl=!0,this.source=null,this.sourceType="empty",this._startedAt=0,this._progress=0,this._connected=!1,this.filters=[]}getOutput(){return this.gain}setNodeSource(e){return this.hasPlaybackControl=!1,this.sourceType="audioNode",this.source=e,this.connect(),this}setMediaElementSource(e){return this.hasPlaybackControl=!1,this.sourceType="mediaNode",this.source=this.context.createMediaElementSource(e),this.connect(),this}setMediaStreamSource(e){return this.hasPlaybackControl=!1,this.sourceType="mediaStreamNode",this.source=this.context.createMediaStreamSource(e),this.connect(),this}setBuffer(e){return this.buffer=e,this.sourceType="buffer",this.autoplay&&this.play(),this}play(e=0){if(this.isPlaying===!0){console.warn("THREE.Audio: Audio is already playing.");return}if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}this._startedAt=this.context.currentTime+e;const t=this.context.createBufferSource();return t.buffer=this.buffer,t.loop=this.loop,t.loopStart=this.loopStart,t.loopEnd=this.loopEnd,t.onended=this.onEnded.bind(this),t.start(this._startedAt,this._progress+this.offset,this.duration),this.isPlaying=!0,this.source=t,this.setDetune(this.detune),this.setPlaybackRate(this.playbackRate),this.connect()}pause(){if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}return this.isPlaying===!0&&(this._progress+=Math.max(this.context.currentTime-this._startedAt,0)*this.playbackRate,this.loop===!0&&(this._progress=this._progress%(this.duration||this.buffer.duration)),this.source.stop(),this.source.onended=null,this.isPlaying=!1),this}stop(e=0){if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}return this._progress=0,this.source!==null&&(this.source.stop(this.context.currentTime+e),this.source.onended=null),this.isPlaying=!1,this}connect(){if(this.filters.length>0){this.source.connect(this.filters[0]);for(let e=1,t=this.filters.length;e<t;e++)this.filters[e-1].connect(this.filters[e]);this.filters[this.filters.length-1].connect(this.getOutput())}else this.source.connect(this.getOutput());return this._connected=!0,this}disconnect(){if(this._connected!==!1){if(this.filters.length>0){this.source.disconnect(this.filters[0]);for(let e=1,t=this.filters.length;e<t;e++)this.filters[e-1].disconnect(this.filters[e]);this.filters[this.filters.length-1].disconnect(this.getOutput())}else this.source.disconnect(this.getOutput());return this._connected=!1,this}}getFilters(){return this.filters}setFilters(e){return e||(e=[]),this._connected===!0?(this.disconnect(),this.filters=e.slice(),this.connect()):this.filters=e.slice(),this}setDetune(e){return this.detune=e,this.isPlaying===!0&&this.source.detune!==void 0&&this.source.detune.setTargetAtTime(this.detune,this.context.currentTime,.01),this}getDetune(){return this.detune}getFilter(){return this.getFilters()[0]}setFilter(e){return this.setFilters(e?[e]:[])}setPlaybackRate(e){if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}return this.playbackRate=e,this.isPlaying===!0&&this.source.playbackRate.setTargetAtTime(this.playbackRate,this.context.currentTime,.01),this}getPlaybackRate(){return this.playbackRate}onEnded(){this.isPlaying=!1}getLoop(){return this.hasPlaybackControl===!1?(console.warn("THREE.Audio: this Audio has no playback control."),!1):this.loop}setLoop(e){if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}return this.loop=e,this.isPlaying===!0&&(this.source.loop=this.loop),this}setLoopStart(e){return this.loopStart=e,this}setLoopEnd(e){return this.loopEnd=e,this}getVolume(){return this.gain.gain.value}setVolume(e){return this.gain.gain.setTargetAtTime(e,this.context.currentTime,.01),this}}const gs=new w,Gd=new en,Z2=new w,ys=new w;class q2 extends J0{constructor(e){super(e),this.panner=this.context.createPanner(),this.panner.panningModel="HRTF",this.panner.connect(this.gain)}connect(){super.connect(),this.panner.connect(this.gain)}disconnect(){super.disconnect(),this.panner.disconnect(this.gain)}getOutput(){return this.panner}getRefDistance(){return this.panner.refDistance}setRefDistance(e){return this.panner.refDistance=e,this}getRolloffFactor(){return this.panner.rolloffFactor}setRolloffFactor(e){return this.panner.rolloffFactor=e,this}getDistanceModel(){return this.panner.distanceModel}setDistanceModel(e){return this.panner.distanceModel=e,this}getMaxDistance(){return this.panner.maxDistance}setMaxDistance(e){return this.panner.maxDistance=e,this}setDirectionalCone(e,t,n){return this.panner.coneInnerAngle=e,this.panner.coneOuterAngle=t,this.panner.coneOuterGain=n,this}updateMatrixWorld(e){if(super.updateMatrixWorld(e),this.hasPlaybackControl===!0&&this.isPlaying===!1)return;this.matrixWorld.decompose(gs,Gd,Z2),ys.set(0,0,1).applyQuaternion(Gd);const t=this.panner;if(t.positionX){const n=this.context.currentTime+this.listener.timeDelta;t.positionX.linearRampToValueAtTime(gs.x,n),t.positionY.linearRampToValueAtTime(gs.y,n),t.positionZ.linearRampToValueAtTime(gs.z,n),t.orientationX.linearRampToValueAtTime(ys.x,n),t.orientationY.linearRampToValueAtTime(ys.y,n),t.orientationZ.linearRampToValueAtTime(ys.z,n)}else t.setPosition(gs.x,gs.y,gs.z),t.setOrientation(ys.x,ys.y,ys.z)}}class $2{constructor(e,t=2048){this.analyser=e.context.createAnalyser(),this.analyser.fftSize=t,this.data=new Uint8Array(this.analyser.frequencyBinCount),e.getOutput().connect(this.analyser)}getFrequencyData(){return this.analyser.getByteFrequencyData(this.data),this.data}getAverageFrequency(){let e=0;const t=this.getFrequencyData();for(let n=0;n<t.length;n++)e+=t[n];return e/t.length}}class j0{constructor(e,t,n){this.binding=e,this.valueSize=n;let s,r,a;switch(t){case"quaternion":s=this._slerp,r=this._slerpAdditive,a=this._setAdditiveIdentityQuaternion,this.buffer=new Float64Array(n*6),this._workIndex=5;break;case"string":case"bool":s=this._select,r=this._select,a=this._setAdditiveIdentityOther,this.buffer=new Array(n*5);break;default:s=this._lerp,r=this._lerpAdditive,a=this._setAdditiveIdentityNumeric,this.buffer=new Float64Array(n*5)}this._mixBufferRegion=s,this._mixBufferRegionAdditive=r,this._setIdentity=a,this._origIndex=3,this._addIndex=4,this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,this.useCount=0,this.referenceCount=0}accumulate(e,t){const n=this.buffer,s=this.valueSize,r=e*s+s;let a=this.cumulativeWeight;if(a===0){for(let o=0;o!==s;++o)n[r+o]=n[o];a=t}else{a+=t;const o=t/a;this._mixBufferRegion(n,r,0,o,s)}this.cumulativeWeight=a}accumulateAdditive(e){const t=this.buffer,n=this.valueSize,s=n*this._addIndex;this.cumulativeWeightAdditive===0&&this._setIdentity(),this._mixBufferRegionAdditive(t,s,0,e,n),this.cumulativeWeightAdditive+=e}apply(e){const t=this.valueSize,n=this.buffer,s=e*t+t,r=this.cumulativeWeight,a=this.cumulativeWeightAdditive,o=this.binding;if(this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,r<1){const l=t*this._origIndex;this._mixBufferRegion(n,s,l,1-r,t)}a>0&&this._mixBufferRegionAdditive(n,s,this._addIndex*t,1,t);for(let l=t,c=t+t;l!==c;++l)if(n[l]!==n[l+t]){o.setValue(n,s);break}}saveOriginalState(){const e=this.binding,t=this.buffer,n=this.valueSize,s=n*this._origIndex;e.getValue(t,s);for(let r=n,a=s;r!==a;++r)t[r]=t[s+r%n];this._setIdentity(),this.cumulativeWeight=0,this.cumulativeWeightAdditive=0}restoreOriginalState(){const e=this.valueSize*3;this.binding.setValue(this.buffer,e)}_setAdditiveIdentityNumeric(){const e=this._addIndex*this.valueSize,t=e+this.valueSize;for(let n=e;n<t;n++)this.buffer[n]=0}_setAdditiveIdentityQuaternion(){this._setAdditiveIdentityNumeric(),this.buffer[this._addIndex*this.valueSize+3]=1}_setAdditiveIdentityOther(){const e=this._origIndex*this.valueSize,t=this._addIndex*this.valueSize;for(let n=0;n<this.valueSize;n++)this.buffer[t+n]=this.buffer[e+n]}_select(e,t,n,s,r){if(s>=.5)for(let a=0;a!==r;++a)e[t+a]=e[n+a]}_slerp(e,t,n,s){en.slerpFlat(e,t,e,t,e,n,s)}_slerpAdditive(e,t,n,s,r){const a=this._workIndex*r;en.multiplyQuaternionsFlat(e,a,e,t,e,n),en.slerpFlat(e,t,e,t,e,a,s)}_lerp(e,t,n,s,r){const a=1-s;for(let o=0;o!==r;++o){const l=t+o;e[l]=e[l]*a+e[n+o]*s}}_lerpAdditive(e,t,n,s,r){for(let a=0;a!==r;++a){const o=t+a;e[o]=e[o]+e[n+a]*s}}}const jf="\\[\\]\\.:\\/",K2=new RegExp("["+jf+"]","g"),Qf="[^"+jf+"]",J2="[^"+jf.replace("\\.","")+"]",j2=/((?:WC+[\/:])*)/.source.replace("WC",Qf),Q2=/(WCOD+)?/.source.replace("WCOD",J2),eM=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Qf),tM=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Qf),nM=new RegExp("^"+j2+Q2+eM+tM+"$"),iM=["material","materials","bones","map"];class sM{constructor(e,t,n){const s=n||pt.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,s)}getValue(e,t){this.bind();const n=this._targetGroup.nCachedObjects_,s=this._bindings[n];s!==void 0&&s.getValue(e,t)}setValue(e,t){const n=this._bindings;for(let s=this._targetGroup.nCachedObjects_,r=n.length;s!==r;++s)n[s].setValue(e,t)}bind(){const e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){const e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}}class pt{constructor(e,t,n){this.path=t,this.parsedPath=n||pt.parseTrackName(t),this.node=pt.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){return e&&e.isAnimationObjectGroup?new pt.Composite(e,t,n):new pt(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(K2,"")}static parseTrackName(e){const t=nM.exec(e);if(t===null)throw new Error("PropertyBinding: Cannot parse trackName: "+e);const n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},s=n.nodeName&&n.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){const r=n.nodeName.substring(s+1);iM.indexOf(r)!==-1&&(n.nodeName=n.nodeName.substring(0,s),n.objectName=r)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){const n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){const n=function(r){for(let a=0;a<r.length;a++){const o=r[a];if(o.name===t||o.uuid===t)return o;const l=n(o.children);if(l)return l}return null},s=n(e.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){const n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)e[t++]=n[s]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){const n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=e[t++]}_setValue_array_setNeedsUpdate(e,t){const n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){const n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node;const t=this.parsedPath,n=t.objectName,s=t.propertyName;let r=t.propertyIndex;if(e||(e=pt.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){console.warn("THREE.PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let c=t.objectIndex;switch(n){case"materials":if(!e.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let h=0;h<e.length;h++)if(e[h].name===c){c=h;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[n]===void 0){console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[n]}if(c!==void 0){if(e[c]===void 0){console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}const a=e[s];if(a===void 0){const c=t.nodeName;console.error("THREE.PropertyBinding: Trying to update property for track: "+c+"."+s+" but it wasn't found.",e);return}let o=this.Versioning.None;this.targetObject=e,e.needsUpdate!==void 0?o=this.Versioning.NeedsUpdate:e.matrixWorldNeedsUpdate!==void 0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(s==="morphTargetInfluences"){if(!e.geometry){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[r]!==void 0&&(r=e.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=r}else a.fromArray!==void 0&&a.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(l=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=s;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}}pt.Composite=sM;pt.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};pt.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};pt.prototype.GetterByBindingType=[pt.prototype._getValue_direct,pt.prototype._getValue_array,pt.prototype._getValue_arrayElement,pt.prototype._getValue_toArray];pt.prototype.SetterByBindingTypeAndVersioning=[[pt.prototype._setValue_direct,pt.prototype._setValue_direct_setNeedsUpdate,pt.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[pt.prototype._setValue_array,pt.prototype._setValue_array_setNeedsUpdate,pt.prototype._setValue_array_setMatrixWorldNeedsUpdate],[pt.prototype._setValue_arrayElement,pt.prototype._setValue_arrayElement_setNeedsUpdate,pt.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[pt.prototype._setValue_fromArray,pt.prototype._setValue_fromArray_setNeedsUpdate,pt.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];class rM{constructor(){this.isAnimationObjectGroup=!0,this.uuid=Fn(),this._objects=Array.prototype.slice.call(arguments),this.nCachedObjects_=0;const e={};this._indicesByUUID=e;for(let n=0,s=arguments.length;n!==s;++n)e[arguments[n].uuid]=n;this._paths=[],this._parsedPaths=[],this._bindings=[],this._bindingsIndicesByPath={};const t=this;this.stats={objects:{get total(){return t._objects.length},get inUse(){return this.total-t.nCachedObjects_}},get bindingsPerObject(){return t._bindings.length}}}add(){const e=this._objects,t=this._indicesByUUID,n=this._paths,s=this._parsedPaths,r=this._bindings,a=r.length;let o,l=e.length,c=this.nCachedObjects_;for(let h=0,f=arguments.length;h!==f;++h){const p=arguments[h],u=p.uuid;let g=t[u];if(g===void 0){g=l++,t[u]=g,e.push(p);for(let y=0,d=a;y!==d;++y)r[y].push(new pt(p,n[y],s[y]))}else if(g<c){o=e[g];const y=--c,d=e[y];t[d.uuid]=g,e[g]=d,t[u]=y,e[y]=p;for(let m=0,_=a;m!==_;++m){const x=r[m],v=x[y];let E=x[g];x[g]=v,E===void 0&&(E=new pt(p,n[m],s[m])),x[y]=E}}else e[g]!==o&&console.error("THREE.AnimationObjectGroup: Different objects with the same UUID detected. Clean the caches or recreate your infrastructure when reloading scenes.")}this.nCachedObjects_=c}remove(){const e=this._objects,t=this._indicesByUUID,n=this._bindings,s=n.length;let r=this.nCachedObjects_;for(let a=0,o=arguments.length;a!==o;++a){const l=arguments[a],c=l.uuid,h=t[c];if(h!==void 0&&h>=r){const f=r++,p=e[f];t[p.uuid]=h,e[h]=p,t[c]=f,e[f]=l;for(let u=0,g=s;u!==g;++u){const y=n[u],d=y[f],m=y[h];y[h]=d,y[f]=m}}}this.nCachedObjects_=r}uncache(){const e=this._objects,t=this._indicesByUUID,n=this._bindings,s=n.length;let r=this.nCachedObjects_,a=e.length;for(let o=0,l=arguments.length;o!==l;++o){const c=arguments[o],h=c.uuid,f=t[h];if(f!==void 0)if(delete t[h],f<r){const p=--r,u=e[p],g=--a,y=e[g];t[u.uuid]=f,e[f]=u,t[y.uuid]=p,e[p]=y,e.pop();for(let d=0,m=s;d!==m;++d){const _=n[d],x=_[p],v=_[g];_[f]=x,_[p]=v,_.pop()}}else{const p=--a,u=e[p];p>0&&(t[u.uuid]=f),e[f]=u,e.pop();for(let g=0,y=s;g!==y;++g){const d=n[g];d[f]=d[p],d.pop()}}}this.nCachedObjects_=r}subscribe_(e,t){const n=this._bindingsIndicesByPath;let s=n[e];const r=this._bindings;if(s!==void 0)return r[s];const a=this._paths,o=this._parsedPaths,l=this._objects,c=l.length,h=this.nCachedObjects_,f=new Array(c);s=r.length,n[e]=s,a.push(e),o.push(t),r.push(f);for(let p=h,u=l.length;p!==u;++p){const g=l[p];f[p]=new pt(g,e,t)}return f}unsubscribe_(e){const t=this._bindingsIndicesByPath,n=t[e];if(n!==void 0){const s=this._paths,r=this._parsedPaths,a=this._bindings,o=a.length-1,l=a[o],c=e[o];t[c]=n,a[n]=l,a.pop(),r[n]=r[o],r.pop(),s[n]=s[o],s.pop()}}}class Q0{constructor(e,t,n=null,s=t.blendMode){this._mixer=e,this._clip=t,this._localRoot=n,this.blendMode=s;const r=t.tracks,a=r.length,o=new Array(a),l={endingStart:Ss,endingEnd:Ss};for(let c=0;c!==a;++c){const h=r[c].createInterpolant(null);o[c]=h,h.settings=l}this._interpolantSettings=l,this._interpolants=o,this._propertyBindings=new Array(a),this._cacheIndex=null,this._byClipCacheIndex=null,this._timeScaleInterpolant=null,this._weightInterpolant=null,this.loop=Hp,this._loopCount=-1,this._startTime=null,this.time=0,this.timeScale=1,this._effectiveTimeScale=1,this.weight=1,this._effectiveWeight=1,this.repetitions=1/0,this.paused=!1,this.enabled=!0,this.clampWhenFinished=!1,this.zeroSlopeAtStart=!0,this.zeroSlopeAtEnd=!0}play(){return this._mixer._activateAction(this),this}stop(){return this._mixer._deactivateAction(this),this.reset()}reset(){return this.paused=!1,this.enabled=!0,this.time=0,this._loopCount=-1,this._startTime=null,this.stopFading().stopWarping()}isRunning(){return this.enabled&&!this.paused&&this.timeScale!==0&&this._startTime===null&&this._mixer._isActiveAction(this)}isScheduled(){return this._mixer._isActiveAction(this)}startAt(e){return this._startTime=e,this}setLoop(e,t){return this.loop=e,this.repetitions=t,this}setEffectiveWeight(e){return this.weight=e,this._effectiveWeight=this.enabled?e:0,this.stopFading()}getEffectiveWeight(){return this._effectiveWeight}fadeIn(e){return this._scheduleFading(e,0,1)}fadeOut(e){return this._scheduleFading(e,1,0)}crossFadeFrom(e,t,n){if(e.fadeOut(t),this.fadeIn(t),n){const s=this._clip.duration,r=e._clip.duration,a=r/s,o=s/r;e.warp(1,a,t),this.warp(o,1,t)}return this}crossFadeTo(e,t,n){return e.crossFadeFrom(this,t,n)}stopFading(){const e=this._weightInterpolant;return e!==null&&(this._weightInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this}setEffectiveTimeScale(e){return this.timeScale=e,this._effectiveTimeScale=this.paused?0:e,this.stopWarping()}getEffectiveTimeScale(){return this._effectiveTimeScale}setDuration(e){return this.timeScale=this._clip.duration/e,this.stopWarping()}syncWith(e){return this.time=e.time,this.timeScale=e.timeScale,this.stopWarping()}halt(e){return this.warp(this._effectiveTimeScale,0,e)}warp(e,t,n){const s=this._mixer,r=s.time,a=this.timeScale;let o=this._timeScaleInterpolant;o===null&&(o=s._lendControlInterpolant(),this._timeScaleInterpolant=o);const l=o.parameterPositions,c=o.sampleValues;return l[0]=r,l[1]=r+n,c[0]=e/a,c[1]=t/a,this}stopWarping(){const e=this._timeScaleInterpolant;return e!==null&&(this._timeScaleInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this}getMixer(){return this._mixer}getClip(){return this._clip}getRoot(){return this._localRoot||this._mixer._root}_update(e,t,n,s){if(!this.enabled){this._updateWeight(e);return}const r=this._startTime;if(r!==null){const l=(e-r)*n;l<0||n===0?t=0:(this._startTime=null,t=n*l)}t*=this._updateTimeScale(e);const a=this._updateTime(t),o=this._updateWeight(e);if(o>0){const l=this._interpolants,c=this._propertyBindings;switch(this.blendMode){case Mf:for(let h=0,f=l.length;h!==f;++h)l[h].evaluate(a),c[h].accumulateAdditive(o);break;case nc:default:for(let h=0,f=l.length;h!==f;++h)l[h].evaluate(a),c[h].accumulate(s,o)}}}_updateWeight(e){let t=0;if(this.enabled){t=this.weight;const n=this._weightInterpolant;if(n!==null){const s=n.evaluate(e)[0];t*=s,e>n.parameterPositions[1]&&(this.stopFading(),s===0&&(this.enabled=!1))}}return this._effectiveWeight=t,t}_updateTimeScale(e){let t=0;if(!this.paused){t=this.timeScale;const n=this._timeScaleInterpolant;if(n!==null){const s=n.evaluate(e)[0];t*=s,e>n.parameterPositions[1]&&(this.stopWarping(),t===0?this.paused=!0:this.timeScale=t)}}return this._effectiveTimeScale=t,t}_updateTime(e){const t=this._clip.duration,n=this.loop;let s=this.time+e,r=this._loopCount;const a=n===Gp;if(e===0)return r===-1?s:a&&(r&1)===1?t-s:s;if(n===Vp){r===-1&&(this._loopCount=0,this._setEndings(!0,!0,!1));e:{if(s>=t)s=t;else if(s<0)s=0;else{this.time=s;break e}this.clampWhenFinished?this.paused=!0:this.enabled=!1,this.time=s,this._mixer.dispatchEvent({type:"finished",action:this,direction:e<0?-1:1})}}else{if(r===-1&&(e>=0?(r=0,this._setEndings(!0,this.repetitions===0,a)):this._setEndings(this.repetitions===0,!0,a)),s>=t||s<0){const o=Math.floor(s/t);s-=t*o,r+=Math.abs(o);const l=this.repetitions-r;if(l<=0)this.clampWhenFinished?this.paused=!0:this.enabled=!1,s=e>0?t:0,this.time=s,this._mixer.dispatchEvent({type:"finished",action:this,direction:e>0?1:-1});else{if(l===1){const c=e<0;this._setEndings(c,!c,a)}else this._setEndings(!1,!1,a);this._loopCount=r,this.time=s,this._mixer.dispatchEvent({type:"loop",action:this,loopDelta:o})}}else this.time=s;if(a&&(r&1)===1)return t-s}return s}_setEndings(e,t,n){const s=this._interpolantSettings;n?(s.endingStart=ws,s.endingEnd=ws):(e?s.endingStart=this.zeroSlopeAtStart?ws:Ss:s.endingStart=ya,t?s.endingEnd=this.zeroSlopeAtEnd?ws:Ss:s.endingEnd=ya)}_scheduleFading(e,t,n){const s=this._mixer,r=s.time;let a=this._weightInterpolant;a===null&&(a=s._lendControlInterpolant(),this._weightInterpolant=a);const o=a.parameterPositions,l=a.sampleValues;return o[0]=r,l[0]=t,o[1]=r+e,l[1]=n,this}}const aM=new Float32Array(1);class oM extends vi{constructor(e){super(),this._root=e,this._initMemoryManager(),this._accuIndex=0,this.time=0,this.timeScale=1}_bindAction(e,t){const n=e._localRoot||this._root,s=e._clip.tracks,r=s.length,a=e._propertyBindings,o=e._interpolants,l=n.uuid,c=this._bindingsByRootAndName;let h=c[l];h===void 0&&(h={},c[l]=h);for(let f=0;f!==r;++f){const p=s[f],u=p.name;let g=h[u];if(g!==void 0)++g.referenceCount,a[f]=g;else{if(g=a[f],g!==void 0){g._cacheIndex===null&&(++g.referenceCount,this._addInactiveBinding(g,l,u));continue}const y=t&&t._propertyBindings[f].binding.parsedPath;g=new j0(pt.create(n,u,y),p.ValueTypeName,p.getValueSize()),++g.referenceCount,this._addInactiveBinding(g,l,u),a[f]=g}o[f].resultBuffer=g.buffer}}_activateAction(e){if(!this._isActiveAction(e)){if(e._cacheIndex===null){const n=(e._localRoot||this._root).uuid,s=e._clip.uuid,r=this._actionsByClip[s];this._bindAction(e,r&&r.knownActions[0]),this._addInactiveAction(e,s,n)}const t=e._propertyBindings;for(let n=0,s=t.length;n!==s;++n){const r=t[n];r.useCount++===0&&(this._lendBinding(r),r.saveOriginalState())}this._lendAction(e)}}_deactivateAction(e){if(this._isActiveAction(e)){const t=e._propertyBindings;for(let n=0,s=t.length;n!==s;++n){const r=t[n];--r.useCount===0&&(r.restoreOriginalState(),this._takeBackBinding(r))}this._takeBackAction(e)}}_initMemoryManager(){this._actions=[],this._nActiveActions=0,this._actionsByClip={},this._bindings=[],this._nActiveBindings=0,this._bindingsByRootAndName={},this._controlInterpolants=[],this._nActiveControlInterpolants=0;const e=this;this.stats={actions:{get total(){return e._actions.length},get inUse(){return e._nActiveActions}},bindings:{get total(){return e._bindings.length},get inUse(){return e._nActiveBindings}},controlInterpolants:{get total(){return e._controlInterpolants.length},get inUse(){return e._nActiveControlInterpolants}}}}_isActiveAction(e){const t=e._cacheIndex;return t!==null&&t<this._nActiveActions}_addInactiveAction(e,t,n){const s=this._actions,r=this._actionsByClip;let a=r[t];if(a===void 0)a={knownActions:[e],actionByRoot:{}},e._byClipCacheIndex=0,r[t]=a;else{const o=a.knownActions;e._byClipCacheIndex=o.length,o.push(e)}e._cacheIndex=s.length,s.push(e),a.actionByRoot[n]=e}_removeInactiveAction(e){const t=this._actions,n=t[t.length-1],s=e._cacheIndex;n._cacheIndex=s,t[s]=n,t.pop(),e._cacheIndex=null;const r=e._clip.uuid,a=this._actionsByClip,o=a[r],l=o.knownActions,c=l[l.length-1],h=e._byClipCacheIndex;c._byClipCacheIndex=h,l[h]=c,l.pop(),e._byClipCacheIndex=null;const f=o.actionByRoot,p=(e._localRoot||this._root).uuid;delete f[p],l.length===0&&delete a[r],this._removeInactiveBindingsForAction(e)}_removeInactiveBindingsForAction(e){const t=e._propertyBindings;for(let n=0,s=t.length;n!==s;++n){const r=t[n];--r.referenceCount===0&&this._removeInactiveBinding(r)}}_lendAction(e){const t=this._actions,n=e._cacheIndex,s=this._nActiveActions++,r=t[s];e._cacheIndex=s,t[s]=e,r._cacheIndex=n,t[n]=r}_takeBackAction(e){const t=this._actions,n=e._cacheIndex,s=--this._nActiveActions,r=t[s];e._cacheIndex=s,t[s]=e,r._cacheIndex=n,t[n]=r}_addInactiveBinding(e,t,n){const s=this._bindingsByRootAndName,r=this._bindings;let a=s[t];a===void 0&&(a={},s[t]=a),a[n]=e,e._cacheIndex=r.length,r.push(e)}_removeInactiveBinding(e){const t=this._bindings,n=e.binding,s=n.rootNode.uuid,r=n.path,a=this._bindingsByRootAndName,o=a[s],l=t[t.length-1],c=e._cacheIndex;l._cacheIndex=c,t[c]=l,t.pop(),delete o[r],Object.keys(o).length===0&&delete a[s]}_lendBinding(e){const t=this._bindings,n=e._cacheIndex,s=this._nActiveBindings++,r=t[s];e._cacheIndex=s,t[s]=e,r._cacheIndex=n,t[n]=r}_takeBackBinding(e){const t=this._bindings,n=e._cacheIndex,s=--this._nActiveBindings,r=t[s];e._cacheIndex=s,t[s]=e,r._cacheIndex=n,t[n]=r}_lendControlInterpolant(){const e=this._controlInterpolants,t=this._nActiveControlInterpolants++;let n=e[t];return n===void 0&&(n=new Wf(new Float32Array(2),new Float32Array(2),1,aM),n.__cacheIndex=t,e[t]=n),n}_takeBackControlInterpolant(e){const t=this._controlInterpolants,n=e.__cacheIndex,s=--this._nActiveControlInterpolants,r=t[s];e.__cacheIndex=s,t[s]=e,r.__cacheIndex=n,t[n]=r}clipAction(e,t,n){const s=t||this._root,r=s.uuid;let a=typeof e=="string"?Ea.findByName(s,e):e;const o=a!==null?a.uuid:e,l=this._actionsByClip[o];let c=null;if(n===void 0&&(a!==null?n=a.blendMode:n=nc),l!==void 0){const f=l.actionByRoot[r];if(f!==void 0&&f.blendMode===n)return f;c=l.knownActions[0],a===null&&(a=c._clip)}if(a===null)return null;const h=new Q0(this,a,t,n);return this._bindAction(h,c),this._addInactiveAction(h,o,r),h}existingAction(e,t){const n=t||this._root,s=n.uuid,r=typeof e=="string"?Ea.findByName(n,e):e,a=r?r.uuid:e,o=this._actionsByClip[a];return o!==void 0&&o.actionByRoot[s]||null}stopAllAction(){const e=this._actions,t=this._nActiveActions;for(let n=t-1;n>=0;--n)e[n].stop();return this}update(e){e*=this.timeScale;const t=this._actions,n=this._nActiveActions,s=this.time+=e,r=Math.sign(e),a=this._accuIndex^=1;for(let c=0;c!==n;++c)t[c]._update(s,e,r,a);const o=this._bindings,l=this._nActiveBindings;for(let c=0;c!==l;++c)o[c].apply(a);return this}setTime(e){this.time=0;for(let t=0;t<this._actions.length;t++)this._actions[t].time=0;return this.update(e)}getRoot(){return this._root}uncacheClip(e){const t=this._actions,n=e.uuid,s=this._actionsByClip,r=s[n];if(r!==void 0){const a=r.knownActions;for(let o=0,l=a.length;o!==l;++o){const c=a[o];this._deactivateAction(c);const h=c._cacheIndex,f=t[t.length-1];c._cacheIndex=null,c._byClipCacheIndex=null,f._cacheIndex=h,t[h]=f,t.pop(),this._removeInactiveBindingsForAction(c)}delete s[n]}}uncacheRoot(e){const t=e.uuid,n=this._actionsByClip;for(const a in n){const o=n[a].actionByRoot,l=o[t];l!==void 0&&(this._deactivateAction(l),this._removeInactiveAction(l))}const s=this._bindingsByRootAndName,r=s[t];if(r!==void 0)for(const a in r){const o=r[a];o.restoreOriginalState(),this._removeInactiveBinding(o)}}uncacheAction(e,t){const n=this.existingAction(e,t);n!==null&&(this._deactivateAction(n),this._removeInactiveAction(n))}}class eu{constructor(e){this.value=e}clone(){return new eu(this.value.clone===void 0?this.value:this.value.clone())}}let lM=0;class cM extends vi{constructor(){super(),this.isUniformsGroup=!0,Object.defineProperty(this,"id",{value:lM++}),this.name="",this.usage=_a,this.uniforms=[]}add(e){return this.uniforms.push(e),this}remove(e){const t=this.uniforms.indexOf(e);return t!==-1&&this.uniforms.splice(t,1),this}setName(e){return this.name=e,this}setUsage(e){return this.usage=e,this}dispose(){return this.dispatchEvent({type:"dispose"}),this}copy(e){this.name=e.name,this.usage=e.usage;const t=e.uniforms;this.uniforms.length=0;for(let n=0,s=t.length;n<s;n++){const r=Array.isArray(t[n])?t[n]:[t[n]];for(let a=0;a<r.length;a++)this.uniforms.push(r[a].clone())}return this}clone(){return new this.constructor().copy(this)}}class hM extends lc{constructor(e,t,n=1){super(e,t),this.isInstancedInterleavedBuffer=!0,this.meshPerAttribute=n}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}clone(e){const t=super.clone(e);return t.meshPerAttribute=this.meshPerAttribute,t}toJSON(e){const t=super.toJSON(e);return t.isInstancedInterleavedBuffer=!0,t.meshPerAttribute=this.meshPerAttribute,t}}class fM{constructor(e,t,n,s,r){this.isGLBufferAttribute=!0,this.name="",this.buffer=e,this.type=t,this.itemSize=n,this.elementSize=s,this.count=r,this.version=0}set needsUpdate(e){e===!0&&this.version++}setBuffer(e){return this.buffer=e,this}setType(e,t){return this.type=e,this.elementSize=t,this}setItemSize(e){return this.itemSize=e,this}setCount(e){return this.count=e,this}}const Wd=new Ye;class uM{constructor(e,t,n=0,s=1/0){this.ray=new Vs(e,t),this.near=n,this.far=s,this.camera=null,this.layers=new sc,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,(t.near+t.far)/(t.near-t.far)).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):console.error("THREE.Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return Wd.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(Wd),this}intersectObject(e,t=!0,n=[]){return nf(e,this,n,t),n.sort(Xd),n}intersectObjects(e,t=!0,n=[]){for(let s=0,r=e.length;s<r;s++)nf(e[s],this,n,t);return n.sort(Xd),n}}function Xd(i,e){return i.distance-e.distance}function nf(i,e,t,n){let s=!0;if(i.layers.test(e.layers)&&i.raycast(e,t)===!1&&(s=!1),s===!0&&n===!0){const r=i.children;for(let a=0,o=r.length;a<o;a++)nf(r[a],e,t,!0)}}class sf{constructor(e=1,t=0,n=0){return this.radius=e,this.phi=t,this.theta=n,this}set(e,t,n){return this.radius=e,this.phi=t,this.theta=n,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=Math.max(1e-6,Math.min(Math.PI-1e-6,this.phi)),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){return this.radius=Math.sqrt(e*e+t*t+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,n),this.phi=Math.acos(kt(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}}class dM{constructor(e=1,t=0,n=0){return this.radius=e,this.theta=t,this.y=n,this}set(e,t,n){return this.radius=e,this.theta=t,this.y=n,this}copy(e){return this.radius=e.radius,this.theta=e.theta,this.y=e.y,this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){return this.radius=Math.sqrt(e*e+n*n),this.theta=Math.atan2(e,n),this.y=t,this}clone(){return new this.constructor().copy(this)}}class tu{constructor(e,t,n,s){tu.prototype.isMatrix2=!0,this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,s)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,s){const r=this.elements;return r[0]=e,r[2]=t,r[1]=n,r[3]=s,this}}const Yd=new $;class pM{constructor(e=new $(1/0,1/0),t=new $(-1/0,-1/0)){this.isBox2=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const n=Yd.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=1/0,this.max.x=this.max.y=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y}getCenter(e){return this.isEmpty()?e.set(0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Yd).distanceTo(e)}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}}const Zd=new w,Oo=new w;class mM{constructor(e=new w,t=new w){this.start=e,this.end=t}set(e,t){return this.start.copy(e),this.end.copy(t),this}copy(e){return this.start.copy(e.start),this.end.copy(e.end),this}getCenter(e){return e.addVectors(this.start,this.end).multiplyScalar(.5)}delta(e){return e.subVectors(this.end,this.start)}distanceSq(){return this.start.distanceToSquared(this.end)}distance(){return this.start.distanceTo(this.end)}at(e,t){return this.delta(t).multiplyScalar(e).add(this.start)}closestPointToPointParameter(e,t){Zd.subVectors(e,this.start),Oo.subVectors(this.end,this.start);const n=Oo.dot(Oo);let r=Oo.dot(Zd)/n;return t&&(r=kt(r,0,1)),r}closestPointToPoint(e,t,n){const s=this.closestPointToPointParameter(e,t);return this.delta(n).multiplyScalar(s).add(this.start)}applyMatrix4(e){return this.start.applyMatrix4(e),this.end.applyMatrix4(e),this}equals(e){return e.start.equals(this.start)&&e.end.equals(this.end)}clone(){return new this.constructor().copy(this)}}const qd=new w;class gM extends dt{constructor(e,t){super(),this.light=e,this.matrixAutoUpdate=!1,this.color=t,this.type="SpotLightHelper";const n=new tt,s=[0,0,0,0,0,1,0,0,0,1,0,1,0,0,0,-1,0,1,0,0,0,0,1,1,0,0,0,0,-1,1];for(let a=0,o=1,l=32;a<l;a++,o++){const c=a/l*Math.PI*2,h=o/l*Math.PI*2;s.push(Math.cos(c),Math.sin(c),1,Math.cos(h),Math.sin(h),1)}n.setAttribute("position",new ze(s,3));const r=new bn({fog:!1,toneMapped:!1});this.cone=new Mi(n,r),this.add(this.cone),this.update()}dispose(){this.cone.geometry.dispose(),this.cone.material.dispose()}update(){this.light.updateWorldMatrix(!0,!1),this.light.target.updateWorldMatrix(!0,!1),this.parent?(this.parent.updateWorldMatrix(!0),this.matrix.copy(this.parent.matrixWorld).invert().multiply(this.light.matrixWorld)):this.matrix.copy(this.light.matrixWorld),this.matrixWorld.copy(this.light.matrixWorld);const e=this.light.distance?this.light.distance:1e3,t=e*Math.tan(this.light.angle);this.cone.scale.set(t,t,e),qd.setFromMatrixPosition(this.light.target.matrixWorld),this.cone.lookAt(qd),this.color!==void 0?this.cone.material.color.set(this.color):this.cone.material.color.copy(this.light.color)}}const Zi=new w,Fo=new Ye,Ah=new Ye;class yM extends Mi{constructor(e){const t=em(e),n=new tt,s=[],r=[],a=new re(0,0,1),o=new re(0,1,0);for(let c=0;c<t.length;c++){const h=t[c];h.parent&&h.parent.isBone&&(s.push(0,0,0),s.push(0,0,0),r.push(a.r,a.g,a.b),r.push(o.r,o.g,o.b))}n.setAttribute("position",new ze(s,3)),n.setAttribute("color",new ze(r,3));const l=new bn({vertexColors:!0,depthTest:!1,depthWrite:!1,toneMapped:!1,transparent:!0});super(n,l),this.isSkeletonHelper=!0,this.type="SkeletonHelper",this.root=e,this.bones=t,this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1}updateMatrixWorld(e){const t=this.bones,n=this.geometry,s=n.getAttribute("position");Ah.copy(this.root.matrixWorld).invert();for(let r=0,a=0;r<t.length;r++){const o=t[r];o.parent&&o.parent.isBone&&(Fo.multiplyMatrices(Ah,o.matrixWorld),Zi.setFromMatrixPosition(Fo),s.setXYZ(a,Zi.x,Zi.y,Zi.z),Fo.multiplyMatrices(Ah,o.parent.matrixWorld),Zi.setFromMatrixPosition(Fo),s.setXYZ(a+1,Zi.x,Zi.y,Zi.z),a+=2)}n.getAttribute("position").needsUpdate=!0,super.updateMatrixWorld(e)}dispose(){this.geometry.dispose(),this.material.dispose()}}function em(i){const e=[];i.isBone===!0&&e.push(i);for(let t=0;t<i.children.length;t++)e.push.apply(e,em(i.children[t]));return e}class _M extends lt{constructor(e,t,n){const s=new Fi(t,4,2),r=new De({wireframe:!0,fog:!1,toneMapped:!1});super(s,r),this.light=e,this.color=n,this.type="PointLightHelper",this.matrix=this.light.matrixWorld,this.matrixAutoUpdate=!1,this.update()}dispose(){this.geometry.dispose(),this.material.dispose()}update(){this.light.updateWorldMatrix(!0,!1),this.color!==void 0?this.material.color.set(this.color):this.material.color.copy(this.light.color)}}const xM=new w,$d=new re,Kd=new re;class vM extends dt{constructor(e,t,n){super(),this.light=e,this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1,this.color=n,this.type="HemisphereLightHelper";const s=new Va(t);s.rotateY(Math.PI*.5),this.material=new De({wireframe:!0,fog:!1,toneMapped:!1}),this.color===void 0&&(this.material.vertexColors=!0);const r=s.getAttribute("position"),a=new Float32Array(r.count*3);s.setAttribute("color",new Et(a,3)),this.add(new lt(s,this.material)),this.update()}dispose(){this.children[0].geometry.dispose(),this.children[0].material.dispose()}update(){const e=this.children[0];if(this.color!==void 0)this.material.color.set(this.color);else{const t=e.geometry.getAttribute("color");$d.copy(this.light.color),Kd.copy(this.light.groundColor);for(let n=0,s=t.count;n<s;n++){const r=n<s/2?$d:Kd;t.setXYZ(n,r.r,r.g,r.b)}t.needsUpdate=!0}this.light.updateWorldMatrix(!0,!1),e.lookAt(xM.setFromMatrixPosition(this.light.matrixWorld).negate())}}class MM extends Mi{constructor(e=10,t=10,n=4473924,s=8947848){n=new re(n),s=new re(s);const r=t/2,a=e/t,o=e/2,l=[],c=[];for(let p=0,u=0,g=-o;p<=t;p++,g+=a){l.push(-o,0,g,o,0,g),l.push(g,0,-o,g,0,o);const y=p===r?n:s;y.toArray(c,u),u+=3,y.toArray(c,u),u+=3,y.toArray(c,u),u+=3,y.toArray(c,u),u+=3}const h=new tt;h.setAttribute("position",new ze(l,3)),h.setAttribute("color",new ze(c,3));const f=new bn({vertexColors:!0,toneMapped:!1});super(h,f),this.type="GridHelper"}dispose(){this.geometry.dispose(),this.material.dispose()}}class bM extends Mi{constructor(e=10,t=16,n=8,s=64,r=4473924,a=8947848){r=new re(r),a=new re(a);const o=[],l=[];if(t>1)for(let f=0;f<t;f++){const p=f/t*(Math.PI*2),u=Math.sin(p)*e,g=Math.cos(p)*e;o.push(0,0,0),o.push(u,0,g);const y=f&1?r:a;l.push(y.r,y.g,y.b),l.push(y.r,y.g,y.b)}for(let f=0;f<n;f++){const p=f&1?r:a,u=e-e/n*f;for(let g=0;g<s;g++){let y=g/s*(Math.PI*2),d=Math.sin(y)*u,m=Math.cos(y)*u;o.push(d,0,m),l.push(p.r,p.g,p.b),y=(g+1)/s*(Math.PI*2),d=Math.sin(y)*u,m=Math.cos(y)*u,o.push(d,0,m),l.push(p.r,p.g,p.b)}}const c=new tt;c.setAttribute("position",new ze(o,3)),c.setAttribute("color",new ze(l,3));const h=new bn({vertexColors:!0,toneMapped:!1});super(c,h),this.type="PolarGridHelper"}dispose(){this.geometry.dispose(),this.material.dispose()}}const Jd=new w,Bo=new w,jd=new w;class SM extends dt{constructor(e,t,n){super(),this.light=e,this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1,this.color=n,this.type="DirectionalLightHelper",t===void 0&&(t=1);let s=new tt;s.setAttribute("position",new ze([-t,t,0,t,t,0,t,-t,0,-t,-t,0,-t,t,0],3));const r=new bn({fog:!1,toneMapped:!1});this.lightPlane=new ji(s,r),this.add(this.lightPlane),s=new tt,s.setAttribute("position",new ze([0,0,0,0,0,1],3)),this.targetLine=new ji(s,r),this.add(this.targetLine),this.update()}dispose(){this.lightPlane.geometry.dispose(),this.lightPlane.material.dispose(),this.targetLine.geometry.dispose(),this.targetLine.material.dispose()}update(){this.light.updateWorldMatrix(!0,!1),this.light.target.updateWorldMatrix(!0,!1),Jd.setFromMatrixPosition(this.light.matrixWorld),Bo.setFromMatrixPosition(this.light.target.matrixWorld),jd.subVectors(Bo,Jd),this.lightPlane.lookAt(Bo),this.color!==void 0?(this.lightPlane.material.color.set(this.color),this.targetLine.material.color.set(this.color)):(this.lightPlane.material.color.copy(this.light.color),this.targetLine.material.color.copy(this.light.color)),this.targetLine.lookAt(Bo),this.targetLine.scale.z=jd.length()}}const ko=new w,Ft=new rc;class wM extends Mi{constructor(e){const t=new tt,n=new bn({color:16777215,vertexColors:!0,toneMapped:!1}),s=[],r=[],a={};o("n1","n2"),o("n2","n4"),o("n4","n3"),o("n3","n1"),o("f1","f2"),o("f2","f4"),o("f4","f3"),o("f3","f1"),o("n1","f1"),o("n2","f2"),o("n3","f3"),o("n4","f4"),o("p","n1"),o("p","n2"),o("p","n3"),o("p","n4"),o("u1","u2"),o("u2","u3"),o("u3","u1"),o("c","t"),o("p","c"),o("cn1","cn2"),o("cn3","cn4"),o("cf1","cf2"),o("cf3","cf4");function o(g,y){l(g),l(y)}function l(g){s.push(0,0,0),r.push(0,0,0),a[g]===void 0&&(a[g]=[]),a[g].push(s.length/3-1)}t.setAttribute("position",new ze(s,3)),t.setAttribute("color",new ze(r,3)),super(t,n),this.type="CameraHelper",this.camera=e,this.camera.updateProjectionMatrix&&this.camera.updateProjectionMatrix(),this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1,this.pointMap=a,this.update();const c=new re(16755200),h=new re(16711680),f=new re(43775),p=new re(16777215),u=new re(3355443);this.setColors(c,h,f,p,u)}setColors(e,t,n,s,r){const o=this.geometry.getAttribute("color");o.setXYZ(0,e.r,e.g,e.b),o.setXYZ(1,e.r,e.g,e.b),o.setXYZ(2,e.r,e.g,e.b),o.setXYZ(3,e.r,e.g,e.b),o.setXYZ(4,e.r,e.g,e.b),o.setXYZ(5,e.r,e.g,e.b),o.setXYZ(6,e.r,e.g,e.b),o.setXYZ(7,e.r,e.g,e.b),o.setXYZ(8,e.r,e.g,e.b),o.setXYZ(9,e.r,e.g,e.b),o.setXYZ(10,e.r,e.g,e.b),o.setXYZ(11,e.r,e.g,e.b),o.setXYZ(12,e.r,e.g,e.b),o.setXYZ(13,e.r,e.g,e.b),o.setXYZ(14,e.r,e.g,e.b),o.setXYZ(15,e.r,e.g,e.b),o.setXYZ(16,e.r,e.g,e.b),o.setXYZ(17,e.r,e.g,e.b),o.setXYZ(18,e.r,e.g,e.b),o.setXYZ(19,e.r,e.g,e.b),o.setXYZ(20,e.r,e.g,e.b),o.setXYZ(21,e.r,e.g,e.b),o.setXYZ(22,e.r,e.g,e.b),o.setXYZ(23,e.r,e.g,e.b),o.setXYZ(24,t.r,t.g,t.b),o.setXYZ(25,t.r,t.g,t.b),o.setXYZ(26,t.r,t.g,t.b),o.setXYZ(27,t.r,t.g,t.b),o.setXYZ(28,t.r,t.g,t.b),o.setXYZ(29,t.r,t.g,t.b),o.setXYZ(30,t.r,t.g,t.b),o.setXYZ(31,t.r,t.g,t.b),o.setXYZ(32,n.r,n.g,n.b),o.setXYZ(33,n.r,n.g,n.b),o.setXYZ(34,n.r,n.g,n.b),o.setXYZ(35,n.r,n.g,n.b),o.setXYZ(36,n.r,n.g,n.b),o.setXYZ(37,n.r,n.g,n.b),o.setXYZ(38,s.r,s.g,s.b),o.setXYZ(39,s.r,s.g,s.b),o.setXYZ(40,r.r,r.g,r.b),o.setXYZ(41,r.r,r.g,r.b),o.setXYZ(42,r.r,r.g,r.b),o.setXYZ(43,r.r,r.g,r.b),o.setXYZ(44,r.r,r.g,r.b),o.setXYZ(45,r.r,r.g,r.b),o.setXYZ(46,r.r,r.g,r.b),o.setXYZ(47,r.r,r.g,r.b),o.setXYZ(48,r.r,r.g,r.b),o.setXYZ(49,r.r,r.g,r.b),o.needsUpdate=!0}update(){const e=this.geometry,t=this.pointMap,n=1,s=1;Ft.projectionMatrixInverse.copy(this.camera.projectionMatrixInverse),Gt("c",t,e,Ft,0,0,-1),Gt("t",t,e,Ft,0,0,1),Gt("n1",t,e,Ft,-n,-s,-1),Gt("n2",t,e,Ft,n,-s,-1),Gt("n3",t,e,Ft,-n,s,-1),Gt("n4",t,e,Ft,n,s,-1),Gt("f1",t,e,Ft,-n,-s,1),Gt("f2",t,e,Ft,n,-s,1),Gt("f3",t,e,Ft,-n,s,1),Gt("f4",t,e,Ft,n,s,1),Gt("u1",t,e,Ft,n*.7,s*1.1,-1),Gt("u2",t,e,Ft,-n*.7,s*1.1,-1),Gt("u3",t,e,Ft,0,s*2,-1),Gt("cf1",t,e,Ft,-n,0,1),Gt("cf2",t,e,Ft,n,0,1),Gt("cf3",t,e,Ft,0,-s,1),Gt("cf4",t,e,Ft,0,s,1),Gt("cn1",t,e,Ft,-n,0,-1),Gt("cn2",t,e,Ft,n,0,-1),Gt("cn3",t,e,Ft,0,-s,-1),Gt("cn4",t,e,Ft,0,s,-1),e.getAttribute("position").needsUpdate=!0}dispose(){this.geometry.dispose(),this.material.dispose()}}function Gt(i,e,t,n,s,r,a){ko.set(s,r,a).unproject(n);const o=e[i];if(o!==void 0){const l=t.getAttribute("position");for(let c=0,h=o.length;c<h;c++)l.setXYZ(o[c],ko.x,ko.y,ko.z)}}const Vo=new jt;class TM extends Mi{constructor(e,t=16776960){const n=new Uint16Array([0,1,1,2,2,3,3,0,4,5,5,6,6,7,7,4,0,4,1,5,2,6,3,7]),s=new Float32Array(24),r=new tt;r.setIndex(new Et(n,1)),r.setAttribute("position",new Et(s,3)),super(r,new bn({color:t,toneMapped:!1})),this.object=e,this.type="BoxHelper",this.matrixAutoUpdate=!1,this.update()}update(e){if(e!==void 0&&console.warn("THREE.BoxHelper: .update() has no longer arguments."),this.object!==void 0&&Vo.setFromObject(this.object),Vo.isEmpty())return;const t=Vo.min,n=Vo.max,s=this.geometry.attributes.position,r=s.array;r[0]=n.x,r[1]=n.y,r[2]=n.z,r[3]=t.x,r[4]=n.y,r[5]=n.z,r[6]=t.x,r[7]=t.y,r[8]=n.z,r[9]=n.x,r[10]=t.y,r[11]=n.z,r[12]=n.x,r[13]=n.y,r[14]=t.z,r[15]=t.x,r[16]=n.y,r[17]=t.z,r[18]=t.x,r[19]=t.y,r[20]=t.z,r[21]=n.x,r[22]=t.y,r[23]=t.z,s.needsUpdate=!0,this.geometry.computeBoundingSphere()}setFromObject(e){return this.object=e,this.update(),this}copy(e,t){return super.copy(e,t),this.object=e.object,this}dispose(){this.geometry.dispose(),this.material.dispose()}}class AM extends Mi{constructor(e,t=16776960){const n=new Uint16Array([0,1,1,2,2,3,3,0,4,5,5,6,6,7,7,4,0,4,1,5,2,6,3,7]),s=[1,1,1,-1,1,1,-1,-1,1,1,-1,1,1,1,-1,-1,1,-1,-1,-1,-1,1,-1,-1],r=new tt;r.setIndex(new Et(n,1)),r.setAttribute("position",new ze(s,3)),super(r,new bn({color:t,toneMapped:!1})),this.box=e,this.type="Box3Helper",this.geometry.computeBoundingSphere()}updateMatrixWorld(e){const t=this.box;t.isEmpty()||(t.getCenter(this.position),t.getSize(this.scale),this.scale.multiplyScalar(.5),super.updateMatrixWorld(e))}dispose(){this.geometry.dispose(),this.material.dispose()}}class EM extends ji{constructor(e,t=1,n=16776960){const s=n,r=[1,-1,0,-1,1,0,-1,-1,0,1,1,0,-1,1,0,-1,-1,0,1,-1,0,1,1,0],a=new tt;a.setAttribute("position",new ze(r,3)),a.computeBoundingSphere(),super(a,new bn({color:s,toneMapped:!1})),this.type="PlaneHelper",this.plane=e,this.size=t;const o=[1,1,0,-1,1,0,-1,-1,0,1,1,0,-1,-1,0,1,-1,0],l=new tt;l.setAttribute("position",new ze(o,3)),l.computeBoundingSphere(),this.add(new lt(l,new De({color:s,opacity:.2,transparent:!0,depthWrite:!1,toneMapped:!1})))}updateMatrixWorld(e){this.position.set(0,0,0),this.scale.set(.5*this.size,.5*this.size,1),this.lookAt(this.plane.normal),this.translateZ(-this.plane.constant),super.updateMatrixWorld(e)}dispose(){this.geometry.dispose(),this.material.dispose(),this.children[0].geometry.dispose(),this.children[0].material.dispose()}}const Qd=new w;let Ho,Eh;class CM extends dt{constructor(e=new w(0,0,1),t=new w(0,0,0),n=1,s=16776960,r=n*.2,a=r*.2){super(),this.type="ArrowHelper",Ho===void 0&&(Ho=new tt,Ho.setAttribute("position",new ze([0,0,0,0,1,0],3)),Eh=new Xn(0,.5,1,5,1),Eh.translate(0,-.5,0)),this.position.copy(t),this.line=new ji(Ho,new bn({color:s,toneMapped:!1})),this.line.matrixAutoUpdate=!1,this.add(this.line),this.cone=new lt(Eh,new De({color:s,toneMapped:!1})),this.cone.matrixAutoUpdate=!1,this.add(this.cone),this.setDirection(e),this.setLength(n,r,a)}setDirection(e){if(e.y>.99999)this.quaternion.set(0,0,0,1);else if(e.y<-.99999)this.quaternion.set(1,0,0,0);else{Qd.set(e.z,0,-e.x).normalize();const t=Math.acos(e.y);this.quaternion.setFromAxisAngle(Qd,t)}}setLength(e,t=e*.2,n=t*.2){this.line.scale.set(1,Math.max(1e-4,e-t),1),this.line.updateMatrix(),this.cone.scale.set(n,t,n),this.cone.position.y=e,this.cone.updateMatrix()}setColor(e){this.line.material.color.set(e),this.cone.material.color.set(e)}copy(e){return super.copy(e,!1),this.line.copy(e.line),this.cone.copy(e.cone),this}dispose(){this.line.geometry.dispose(),this.line.material.dispose(),this.cone.geometry.dispose(),this.cone.material.dispose()}}class RM extends Mi{constructor(e=1){const t=[0,0,0,e,0,0,0,0,0,0,e,0,0,0,0,0,0,e],n=[1,0,0,1,.6,0,0,1,0,.6,1,0,0,0,1,0,.6,1],s=new tt;s.setAttribute("position",new ze(t,3)),s.setAttribute("color",new ze(n,3));const r=new bn({vertexColors:!0,toneMapped:!1});super(s,r),this.type="AxesHelper"}setColors(e,t,n){const s=new re,r=this.geometry.attributes.color.array;return s.set(e),s.toArray(r,0),s.toArray(r,3),s.set(t),s.toArray(r,6),s.toArray(r,9),s.set(n),s.toArray(r,12),s.toArray(r,15),this.geometry.attributes.color.needsUpdate=!0,this}dispose(){this.geometry.dispose(),this.material.dispose()}}class PM{constructor(){this.type="ShapePath",this.color=new re,this.subPaths=[],this.currentPath=null}moveTo(e,t){return this.currentPath=new Ma,this.subPaths.push(this.currentPath),this.currentPath.moveTo(e,t),this}lineTo(e,t){return this.currentPath.lineTo(e,t),this}quadraticCurveTo(e,t,n,s){return this.currentPath.quadraticCurveTo(e,t,n,s),this}bezierCurveTo(e,t,n,s,r,a){return this.currentPath.bezierCurveTo(e,t,n,s,r,a),this}splineThru(e){return this.currentPath.splineThru(e),this}toShapes(e){function t(m){const _=[];for(let x=0,v=m.length;x<v;x++){const E=m[x],T=new Ps;T.curves=E.curves,_.push(T)}return _}function n(m,_){const x=_.length;let v=!1;for(let E=x-1,T=0;T<x;E=T++){let R=_[E],P=_[T],S=P.x-R.x,M=P.y-R.y;if(Math.abs(M)>Number.EPSILON){if(M<0&&(R=_[T],S=-S,P=_[E],M=-M),m.y<R.y||m.y>P.y)continue;if(m.y===R.y){if(m.x===R.x)return!0}else{const D=M*(m.x-R.x)-S*(m.y-R.y);if(D===0)return!0;if(D<0)continue;v=!v}}else{if(m.y!==R.y)continue;if(P.x<=m.x&&m.x<=R.x||R.x<=m.x&&m.x<=P.x)return!0}}return v}const s=gi.isClockWise,r=this.subPaths;if(r.length===0)return[];let a,o,l;const c=[];if(r.length===1)return o=r[0],l=new Ps,l.curves=o.curves,c.push(l),c;let h=!s(r[0].getPoints());h=e?!h:h;const f=[],p=[];let u=[],g=0,y;p[g]=void 0,u[g]=[];for(let m=0,_=r.length;m<_;m++)o=r[m],y=o.getPoints(),a=s(y),a=e?!a:a,a?(!h&&p[g]&&g++,p[g]={s:new Ps,p:y},p[g].s.curves=o.curves,h&&g++,u[g]=[]):u[g].push({h:o,p:y[0]});if(!p[0])return t(r);if(p.length>1){let m=!1,_=0;for(let x=0,v=p.length;x<v;x++)f[x]=[];for(let x=0,v=p.length;x<v;x++){const E=u[x];for(let T=0;T<E.length;T++){const R=E[T];let P=!0;for(let S=0;S<p.length;S++)n(R.p,p[S].p)&&(x!==S&&_++,P?(P=!1,f[S].push(R)):m=!0);P&&f[x].push(R)}}_>0&&m===!1&&(u=f)}let d;for(let m=0,_=p.length;m<_;m++){l=p[m].s,c.push(l),d=u[m];for(let x=0,v=d.length;x<v;x++)l.holes.push(d[x].h)}return c}}class tm extends vi{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(){}disconnect(){}dispose(){}update(){}}class IM extends ln{constructor(e=1,t=1,n=1,s={}){console.warn('THREE.WebGLMultipleRenderTargets has been deprecated and will be removed in r172. Use THREE.WebGLRenderTarget and set the "count" parameter to enable MRT.'),super(e,t,{...s,count:n}),this.isWebGLMultipleRenderTargets=!0}get texture(){return this.textures}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:ql}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=ql);const DM=Object.freeze(Object.defineProperty({__proto__:null,ACESFilmicToneMapping:Np,AddEquation:Ki,AddOperation:Dp,AdditiveAnimationBlendMode:Mf,AdditiveBlending:In,AgXToneMapping:Fp,AlphaFormat:mf,AlwaysCompare:Qp,AlwaysDepth:rl,AlwaysStencilFunc:Yh,AmbientLight:Y0,AnimationAction:Q0,AnimationClip:Ea,AnimationLoader:D2,AnimationMixer:oM,AnimationObjectGroup:rM,AnimationUtils:C2,ArcCurve:S0,ArrayCamera:m0,ArrowHelper:CM,AttachedBindMode:Xh,Audio:J0,AudioAnalyser:$2,AudioContext:Jf,AudioListener:Y2,AudioLoader:G2,AxesHelper:RM,BackSide:on,BasicDepthPacking:Wp,BasicShadowMap:Cm,BatchedMesh:v0,Bone:Df,BooleanKeyframeTrack:Hs,Box2:pM,Box3:jt,Box3Helper:AM,BoxGeometry:Dn,BoxHelper:TM,BufferAttribute:Et,BufferGeometry:tt,BufferGeometryLoader:K0,ByteType:uf,Cache:Di,Camera:rc,CameraHelper:wM,CanvasTexture:Ns,CapsuleGeometry:dc,CatmullRomCurve3:Uf,CineonToneMapping:Up,CircleGeometry:pc,ClampToEdgeWrapping:Wn,Clock:Tc,Color:re,ColorKeyframeTrack:Xf,ColorManagement:ct,CompressedArrayTexture:Jv,CompressedCubeTexture:jv,CompressedTexture:fc,CompressedTextureLoader:L2,ConeGeometry:Er,ConstantAlphaFactor:Rp,ConstantColorFactor:Ep,Controls:tm,CubeCamera:o0,CubeReflectionMapping:Ui,CubeRefractionMapping:Ji,CubeTexture:Ua,CubeTextureLoader:z2,CubeUVReflectionMapping:wr,CubicBezierCurve:Nf,CubicBezierCurve3:w0,CubicInterpolant:H0,CullFaceBack:Hh,CullFaceFront:up,CullFaceFrontBack:Em,CullFaceNone:fp,Curve:ai,CurvePath:A0,CustomBlending:dp,CustomToneMapping:Op,CylinderGeometry:Xn,Cylindrical:dM,Data3DTexture:wf,DataArrayTexture:ic,DataTexture:si,DataTextureLoader:U2,DataUtils:Vg,DecrementStencilOp:Hm,DecrementWrapStencilOp:Wm,DefaultLoadingManager:X0,DepthFormat:Cs,DepthStencilFormat:Ls,DepthTexture:Cf,DetachedBindMode:kp,DirectionalLight:Cr,DirectionalLightHelper:SM,DiscreteInterpolant:G0,DodecahedronGeometry:mc,DoubleSide:St,DstAlphaFactor:bp,DstColorFactor:wp,DynamicCopyUsage:rg,DynamicDrawUsage:Qm,DynamicReadUsage:ng,EdgesGeometry:E0,EllipseCurve:uc,EqualCompare:$p,EqualDepth:ol,EqualStencilFunc:qm,EquirectangularReflectionMapping:da,EquirectangularRefractionMapping:pa,Euler:Mn,EventDispatcher:vi,ExtrudeGeometry:yc,FileLoader:Oi,Float16BufferAttribute:Zg,Float32BufferAttribute:ze,FloatType:Cn,Fog:oc,FogExp2:Fa,FramebufferTexture:Kv,FrontSide:Pn,Frustum:Na,GLBufferAttribute:fM,GLSL1:og,GLSL3:Zh,GreaterCompare:Kp,GreaterDepth:cl,GreaterEqualCompare:jp,GreaterEqualDepth:ll,GreaterEqualStencilFunc:jm,GreaterStencilFunc:Km,GridHelper:MM,Group:di,HalfFloatType:Yn,HemisphereLight:Zf,HemisphereLightHelper:vM,IcosahedronGeometry:_c,ImageBitmapLoader:H2,ImageLoader:Ca,ImageUtils:i0,IncrementStencilOp:Vm,IncrementWrapStencilOp:Gm,InstancedBufferAttribute:Us,InstancedBufferGeometry:Kf,InstancedInterleavedBuffer:hM,InstancedMesh:Ar,Int16BufferAttribute:Xg,Int32BufferAttribute:Yg,Int8BufferAttribute:Hg,IntType:Kl,InterleavedBuffer:lc,InterleavedBufferAttribute:zs,Interpolant:Wa,InterpolateDiscrete:ga,InterpolateLinear:Ol,InterpolateSmooth:Qo,InvertStencilOp:Xm,KeepStencilOp:_s,KeyframeTrack:oi,LOD:_0,LatheGeometry:ka,Layers:sc,LessCompare:qp,LessDepth:al,LessEqualCompare:bf,LessEqualDepth:Is,LessEqualStencilFunc:$m,LessStencilFunc:Zm,Light:ns,LightProbe:$0,Line:ji,Line3:mM,LineBasicMaterial:bn,LineCurve:Of,LineCurve3:T0,LineDashedMaterial:B0,LineLoop:M0,LineSegments:Mi,LinearFilter:Vt,LinearInterpolant:Wf,LinearMipMapLinearFilter:Dm,LinearMipMapNearestFilter:Im,LinearMipmapLinearFilter:ni,LinearMipmapNearestFilter:na,LinearSRGBColorSpace:es,LinearToneMapping:Lp,LinearTransfer:za,Loader:zn,LoaderUtils:tf,LoadingManager:Yf,LoopOnce:Vp,LoopPingPong:Gp,LoopRepeat:Hp,LuminanceAlphaFormat:_f,LuminanceFormat:yf,MOUSE:Es,Material:yn,MaterialLoader:wc,MathUtils:e0,Matrix2:tu,Matrix3:et,Matrix4:Ye,MaxEquation:yp,Mesh:lt,MeshBasicMaterial:De,MeshDepthMaterial:Rf,MeshDistanceMaterial:Pf,MeshLambertMaterial:O0,MeshMatcapMaterial:F0,MeshNormalMaterial:N0,MeshPhongMaterial:U0,MeshPhysicalMaterial:z0,MeshStandardMaterial:Vf,MeshToonMaterial:Hf,MinEquation:gp,MirroredRepeatWrapping:ma,MixOperation:Ip,MultiplyBlending:Wh,MultiplyOperation:Da,NearestFilter:Qt,NearestMipMapLinearFilter:Pm,NearestMipMapNearestFilter:Rm,NearestMipmapLinearFilter:hr,NearestMipmapNearestFilter:ff,NeutralToneMapping:Bp,NeverCompare:Zp,NeverDepth:sl,NeverStencilFunc:Ym,NoBlending:pi,NoColorSpace:Gn,NoToneMapping:mi,NormalAnimationBlendMode:nc,NormalBlending:ii,NotEqualCompare:Jp,NotEqualDepth:hl,NotEqualStencilFunc:Jm,NumberKeyframeTrack:Ta,Object3D:dt,ObjectLoader:k2,ObjectSpaceNormalMap:Yp,OctahedronGeometry:Va,OneFactor:xp,OneMinusConstantAlphaFactor:Pp,OneMinusConstantColorFactor:Cp,OneMinusDstAlphaFactor:Sp,OneMinusDstColorFactor:Tp,OneMinusSrcAlphaFactor:il,OneMinusSrcColorFactor:Mp,OrthographicCamera:Oa,PCFShadowMap:cf,PCFSoftShadowMap:hf,PMREMGenerator:qh,Path:Ma,PerspectiveCamera:Jt,Plane:fi,PlaneGeometry:Ln,PlaneHelper:EM,PointLight:$f,PointLightHelper:_M,Points:b0,PointsMaterial:Lf,PolarGridHelper:bM,PolyhedronGeometry:ts,PositionalAudio:q2,PropertyBinding:pt,PropertyMixer:j0,QuadraticBezierCurve:Ff,QuadraticBezierCurve3:Bf,Quaternion:en,QuaternionKeyframeTrack:Xa,QuaternionLinearInterpolant:W0,RED_GREEN_RGTC2_Format:Ul,RED_RGTC1_Format:vf,REVISION:ql,RGBADepthPacking:Xp,RGBAFormat:mn,RGBAIntegerFormat:tc,RGBA_ASTC_10x10_Format:Rl,RGBA_ASTC_10x5_Format:Al,RGBA_ASTC_10x6_Format:El,RGBA_ASTC_10x8_Format:Cl,RGBA_ASTC_12x10_Format:Pl,RGBA_ASTC_12x12_Format:Il,RGBA_ASTC_4x4_Format:_l,RGBA_ASTC_5x4_Format:xl,RGBA_ASTC_5x5_Format:vl,RGBA_ASTC_6x5_Format:Ml,RGBA_ASTC_6x6_Format:bl,RGBA_ASTC_8x5_Format:Sl,RGBA_ASTC_8x6_Format:wl,RGBA_ASTC_8x8_Format:Tl,RGBA_BPTC_Format:oa,RGBA_ETC2_EAC_Format:yl,RGBA_PVRTC_2BPPV1_Format:pl,RGBA_PVRTC_4BPPV1_Format:dl,RGBA_S3TC_DXT1_Format:sa,RGBA_S3TC_DXT3_Format:ra,RGBA_S3TC_DXT5_Format:aa,RGBDepthPacking:Om,RGBFormat:gf,RGBIntegerFormat:Lm,RGB_BPTC_SIGNED_Format:Dl,RGB_BPTC_UNSIGNED_Format:Ll,RGB_ETC1_Format:ml,RGB_ETC2_Format:gl,RGB_PVRTC_2BPPV1_Format:ul,RGB_PVRTC_4BPPV1_Format:fl,RGB_S3TC_DXT1_Format:ia,RGDepthPacking:Fm,RGFormat:xf,RGIntegerFormat:ec,RawShaderMaterial:L0,Ray:Vs,Raycaster:uM,RectAreaLight:Z0,RedFormat:Ql,RedIntegerFormat:La,ReinhardToneMapping:zp,RenderTarget:s0,RepeatWrapping:gr,ReplaceStencilOp:km,ReverseSubtractEquation:mp,RingGeometry:xc,SIGNED_RED_GREEN_RGTC2_Format:Nl,SIGNED_RED_RGTC1_Format:zl,SRGBColorSpace:Dt,SRGBTransfer:Mt,Scene:If,ShaderChunk:rt,ShaderLib:ti,ShaderMaterial:At,ShadowMaterial:D0,Shape:Ps,ShapeGeometry:vc,ShapePath:PM,ShapeUtils:gi,ShortType:df,Skeleton:hc,SkeletonHelper:yM,SkinnedMesh:x0,Source:Ts,Sphere:gn,SphereGeometry:Fi,Spherical:sf,SphericalHarmonics3:q0,SplineCurve:kf,SpotLight:Sc,SpotLightHelper:gM,Sprite:cc,SpriteMaterial:Ba,SrcAlphaFactor:nl,SrcAlphaSaturateFactor:Ap,SrcColorFactor:vp,StaticCopyUsage:sg,StaticDrawUsage:_a,StaticReadUsage:tg,StereoCamera:W2,StreamCopyUsage:ag,StreamDrawUsage:eg,StreamReadUsage:ig,StringKeyframeTrack:Gs,SubtractEquation:pp,SubtractiveBlending:Gh,TOUCH:bs,TangentSpaceNormalMap:Qi,TetrahedronGeometry:Mc,Texture:Ht,TextureLoader:N2,TextureUtils:Pv,TorusGeometry:Ha,TorusKnotGeometry:bc,Triangle:En,TriangleFanDrawMode:Nm,TriangleStripDrawMode:Um,TrianglesDrawMode:zm,TubeGeometry:Ga,UVMapping:$l,Uint16BufferAttribute:Tf,Uint32BufferAttribute:Af,Uint8BufferAttribute:Gg,Uint8ClampedBufferAttribute:Wg,Uniform:eu,UniformsGroup:cM,UniformsLib:Se,UniformsUtils:vr,UnsignedByteType:_i,UnsignedInt248Type:Ds,UnsignedInt5999Type:pf,UnsignedIntType:Ni,UnsignedShort4444Type:Jl,UnsignedShort5551Type:jl,UnsignedShortType:yr,VSMShadowMap:hi,Vector2:$,Vector3:w,Vector4:ot,VectorKeyframeTrack:Aa,VideoTexture:$v,WebGL3DRenderTarget:Ig,WebGLArrayRenderTarget:Pg,WebGLCoordinateSystem:ui,WebGLCubeRenderTarget:l0,WebGLMultipleRenderTargets:IM,WebGLRenderTarget:ln,WebGLRenderer:g0,WebGLUtils:p0,WebGPUCoordinateSystem:xa,WireframeGeometry:I0,WrapAroundEnding:ya,ZeroCurvatureEnding:Ss,ZeroFactor:_p,ZeroSlopeEnding:ws,ZeroStencilOp:Bm,createCanvasElement:n0},Symbol.toStringTag,{value:"Module"})),ep={type:"change"},nu={type:"start"},nm={type:"end"},Go=new Vs,tp=new fi,LM=Math.cos(70*e0.DEG2RAD),Kt=new w,Tn=2*Math.PI,Tt={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Ch=1e-6;class zM extends tm{constructor(e,t=null){super(e,t),this.state=Tt.NONE,this.enabled=!0,this.target=new w,this.cursor=new w,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:Es.ROTATE,MIDDLE:Es.DOLLY,RIGHT:Es.PAN},this.touches={ONE:bs.ROTATE,TWO:bs.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._domElementKeyEvents=null,this._lastPosition=new w,this._lastQuaternion=new en,this._lastTargetPosition=new w,this._quat=new en().setFromUnitVectors(e.up,new w(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new sf,this._sphericalDelta=new sf,this._scale=1,this._panOffset=new w,this._rotateStart=new $,this._rotateEnd=new $,this._rotateDelta=new $,this._panStart=new $,this._panEnd=new $,this._panDelta=new $,this._dollyStart=new $,this._dollyEnd=new $,this._dollyDelta=new $,this._dollyDirection=new w,this._mouse=new $,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=NM.bind(this),this._onPointerDown=UM.bind(this),this._onPointerUp=OM.bind(this),this._onContextMenu=WM.bind(this),this._onMouseWheel=kM.bind(this),this._onKeyDown=VM.bind(this),this._onTouchStart=HM.bind(this),this._onTouchMove=GM.bind(this),this._onMouseDown=FM.bind(this),this._onMouseMove=BM.bind(this),this._interceptControlDown=XM.bind(this),this._interceptControlUp=YM.bind(this),this.domElement!==null&&this.connect(),this.update()}connect(){this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(ep),this.update(),this.state=Tt.NONE}update(e=null){const t=this.object.position;Kt.copy(t).sub(this.target),Kt.applyQuaternion(this._quat),this._spherical.setFromVector3(Kt),this.autoRotate&&this.state===Tt.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let n=this.minAzimuthAngle,s=this.maxAzimuthAngle;isFinite(n)&&isFinite(s)&&(n<-Math.PI?n+=Tn:n>Math.PI&&(n-=Tn),s<-Math.PI?s+=Tn:s>Math.PI&&(s-=Tn),n<=s?this._spherical.theta=Math.max(n,Math.min(s,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(n+s)/2?Math.max(n,this._spherical.theta):Math.min(s,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let r=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{const a=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),r=a!=this._spherical.radius}if(Kt.setFromSpherical(this._spherical),Kt.applyQuaternion(this._quatInverse),t.copy(this.target).add(Kt),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let a=null;if(this.object.isPerspectiveCamera){const o=Kt.length();a=this._clampDistance(o*this._scale);const l=o-a;this.object.position.addScaledVector(this._dollyDirection,l),this.object.updateMatrixWorld(),r=!!l}else if(this.object.isOrthographicCamera){const o=new w(this._mouse.x,this._mouse.y,0);o.unproject(this.object);const l=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),r=l!==this.object.zoom;const c=new w(this._mouse.x,this._mouse.y,0);c.unproject(this.object),this.object.position.sub(c).add(o),this.object.updateMatrixWorld(),a=Kt.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;a!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(a).add(this.object.position):(Go.origin.copy(this.object.position),Go.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(Go.direction))<LM?this.object.lookAt(this.target):(tp.setFromNormalAndCoplanarPoint(this.object.up,this.target),Go.intersectPlane(tp,this.target))))}else if(this.object.isOrthographicCamera){const a=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),a!==this.object.zoom&&(this.object.updateProjectionMatrix(),r=!0)}return this._scale=1,this._performCursorZoom=!1,r||this._lastPosition.distanceToSquared(this.object.position)>Ch||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Ch||this._lastTargetPosition.distanceToSquared(this.target)>Ch?(this.dispatchEvent(ep),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?Tn/60*this.autoRotateSpeed*e:Tn/60/60*this.autoRotateSpeed}_getZoomScale(e){const t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){Kt.setFromMatrixColumn(t,0),Kt.multiplyScalar(-e),this._panOffset.add(Kt)}_panUp(e,t){this.screenSpacePanning===!0?Kt.setFromMatrixColumn(t,1):(Kt.setFromMatrixColumn(t,0),Kt.crossVectors(this.object.up,Kt)),Kt.multiplyScalar(e),this._panOffset.add(Kt)}_pan(e,t){const n=this.domElement;if(this.object.isPerspectiveCamera){const s=this.object.position;Kt.copy(s).sub(this.target);let r=Kt.length();r*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*r/n.clientHeight,this.object.matrix),this._panUp(2*t*r/n.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/n.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/n.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;const n=this.domElement.getBoundingClientRect(),s=e-n.left,r=t-n.top,a=n.width,o=n.height;this._mouse.x=s/a*2-1,this._mouse.y=-(r/o)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const t=this.domElement;this._rotateLeft(Tn*this._rotateDelta.x/t.clientHeight),this._rotateUp(Tn*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this._rotateUp(Tn*this.rotateSpeed/this.domElement.clientHeight):this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this._rotateUp(-Tn*this.rotateSpeed/this.domElement.clientHeight):this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this._rotateLeft(Tn*this.rotateSpeed/this.domElement.clientHeight):this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this._rotateLeft(-Tn*this.rotateSpeed/this.domElement.clientHeight):this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._rotateStart.set(n,s)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._panStart.set(n,s)}}_handleTouchStartDolly(e){const t=this._getSecondPointerPosition(e),n=e.pageX-t.x,s=e.pageY-t.y,r=Math.sqrt(n*n+s*s);this._dollyStart.set(0,r)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{const n=this._getSecondPointerPosition(e),s=.5*(e.pageX+n.x),r=.5*(e.pageY+n.y);this._rotateEnd.set(s,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const t=this.domElement;this._rotateLeft(Tn*this._rotateDelta.x/t.clientHeight),this._rotateUp(Tn*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._panEnd.set(n,s)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){const t=this._getSecondPointerPosition(e),n=e.pageX-t.x,s=e.pageY-t.y,r=Math.sqrt(n*n+s*s);this._dollyEnd.set(0,r),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);const a=(e.pageX+t.x)*.5,o=(e.pageY+t.y)*.5;this._updateZoomParameters(a,o)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new $,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){const t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){const t=e.deltaMode,n={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:n.deltaY*=16;break;case 2:n.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(n.deltaY*=10),n}}function UM(i){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(i.pointerId),this.domElement.addEventListener("pointermove",this._onPointerMove),this.domElement.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(i)&&(this._addPointer(i),i.pointerType==="touch"?this._onTouchStart(i):this._onMouseDown(i)))}function NM(i){this.enabled!==!1&&(i.pointerType==="touch"?this._onTouchMove(i):this._onMouseMove(i))}function OM(i){switch(this._removePointer(i),this._pointers.length){case 0:this.domElement.releasePointerCapture(i.pointerId),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(nm),this.state=Tt.NONE;break;case 1:const e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}function FM(i){let e;switch(i.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case Es.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(i),this.state=Tt.DOLLY;break;case Es.ROTATE:if(i.ctrlKey||i.metaKey||i.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(i),this.state=Tt.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(i),this.state=Tt.ROTATE}break;case Es.PAN:if(i.ctrlKey||i.metaKey||i.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(i),this.state=Tt.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(i),this.state=Tt.PAN}break;default:this.state=Tt.NONE}this.state!==Tt.NONE&&this.dispatchEvent(nu)}function BM(i){switch(this.state){case Tt.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(i);break;case Tt.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(i);break;case Tt.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(i);break}}function kM(i){this.enabled===!1||this.enableZoom===!1||this.state!==Tt.NONE||(i.preventDefault(),this.dispatchEvent(nu),this._handleMouseWheel(this._customWheelEvent(i)),this.dispatchEvent(nm))}function VM(i){this.enabled===!1||this.enablePan===!1||this._handleKeyDown(i)}function HM(i){switch(this._trackPointer(i),this._pointers.length){case 1:switch(this.touches.ONE){case bs.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(i),this.state=Tt.TOUCH_ROTATE;break;case bs.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(i),this.state=Tt.TOUCH_PAN;break;default:this.state=Tt.NONE}break;case 2:switch(this.touches.TWO){case bs.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(i),this.state=Tt.TOUCH_DOLLY_PAN;break;case bs.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(i),this.state=Tt.TOUCH_DOLLY_ROTATE;break;default:this.state=Tt.NONE}break;default:this.state=Tt.NONE}this.state!==Tt.NONE&&this.dispatchEvent(nu)}function GM(i){switch(this._trackPointer(i),this.state){case Tt.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(i),this.update();break;case Tt.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(i),this.update();break;case Tt.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(i),this.update();break;case Tt.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(i),this.update();break;default:this.state=Tt.NONE}}function WM(i){this.enabled!==!1&&i.preventDefault()}function XM(i){i.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function YM(i){i.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}const bt={bgTop:"#04060d",bgHorizon:"#0d1730",bgBottom:"#070a12",fog:"#0a1020",hemiSky:"#6f95cf",hemiGround:"#141826",moon:"#b7d0ff",road:"#171c27",roadDark:"#0f1420",roadLine:"#e7edf5",roadStop:"#efd98a",lot:"#34343c",lotTile:"#3d3d45",lotTileAlt:"#36363e",curb:"#555560",curbTop:"#6b6b75",gutter:"#20242e",manhole:"#3f434c",tactile:"#c9a84c",wall:"#ded8c6",wallShade:"#c4beac",wallPanel:"#e8e2d1",kick:"#3e4450",frame:"#eef0ec",frameShade:"#b9bdb9",roof:"#5f656d",roofDark:"#454b54",canopy:"#e6e9e3",interiorFloor:"#cfc8b4",interiorCeil:"#efeadd",shelf:"#f2eee3",shelfMetal:"#9aa0a8",fridgeGlass:"#b9e4e3",brand:{cream:"#fbf3dd",navy:"#20304f",teal:"#3fa8a0",amber:"#ffc96b",coral:"#ff7a5e",pink:"#ff6f9c"},warm:"#ffd9a0",warmDeep:"#ffb45e",warmHot:"#ff9b4a",cool:"#9fd8ff",neonPink:"#ff6f9c",neonCyan:"#7fe8e0",neonAmber:"#ffca7a",trafficGreen:"#7dffc0",trafficRed:"#ff5a5a",wood:"#2a1e19",woodLight:"#3b2a22",brass:"#c09a5c",brassDark:"#7a5c30"},We={lot:{top:.12},store:{minX:-2.9,maxX:1.7,minZ:-4.6,maxZ:1,wallT:.18,floorY:.14,wallTopY:3.52,parapetY:3.74,glassY0:.45,glassY1:2.5,fasciaY0:2.5,fasciaY1:3.4,windowX0:-2.72,windowX1:.54,doorX0:.62,doorX1:1.5,interior:{minX:-2.72,maxX:1.52,minZ:-4.42,maxZ:.82,floorY:.14,ceilY:2.52},canopy:{x0:-1.3,x1:1.78,z0:1,z1:2.28,y:2.4,thickness:.09},sign:{x0:-2.78,x1:1.56,y0:2.62,y1:3.3,z:1.03}},pylon:{x:2.82,z:1.5,baseY:.12},lights:{interior:[{x:-1.6,y:2.35,z:-.4,color:"warm",intensity:1.95,distance:3.8,decay:2},{x:-.5,y:2.35,z:-2.2,color:"warm",intensity:2.1,distance:4,decay:2},{x:.9,y:2.3,z:-3.4,color:"warm",intensity:1.5,distance:3.5,decay:2},{x:1.15,y:2.1,z:-.6,color:"warmDeep",intensity:.8,distance:2.6,decay:2},{x:-1.65,y:2.3,z:.3,color:"warm",intensity:1.15,distance:3,decay:2}],canopy:{x:.35,y:2.2,z:1.65,color:"warm",intensity:.85,distance:3,decay:2},sign:{x:-.6,y:3,z:1.9,color:"warm",intensity:.6,distance:3.2,decay:2},vending:{x:2.5,y:1,z:-1.5,color:"cool",intensity:.45,distance:2.8,decay:2}}},k={bounds:{minX:-22,maxX:22,minZ:-22,maxZ:22},road:{ew:{minZ:-2.2,maxZ:1.8},ns:{minX:-2.2,maxX:1.8}},walk:{north:{minZ:-3.7,maxZ:-2.2},south:{minZ:1.8,maxZ:3.3},east:{minX:1.8,maxX:3.3},west:{minX:-3.7,maxX:-2.2}},minorEW:[{minZ:-15.4,maxZ:-13.4},{minZ:13.4,maxZ:15.4}],minorNS:[{minX:-15.4,maxX:-13.4},{minX:13.4,maxX:15.4}],storeOffset:{dx:5.5,dz:-3.2},shops:[{id:"izakaya",style:"izakaya",jp:"居酒屋 とり吉",en:"TORIYOSHI",kind:"izakaya",x:-2.4,z:4.4,ry:Math.PI/2,w:3.6,d:5,h:6.2,accent:"#ff6f5e",sign:"#ffd28a",paper:"#2a1c18"},{id:"ramen",style:"ramen",jp:"ラーメン 麺屋 灯",en:"MENYA AKARI",kind:"ramen",x:-2.4,z:7,ry:Math.PI/2,w:3.8,d:5,h:6.6,accent:"#ff8a5c",sign:"#ffd9a0",paper:"#f3ead8"},{id:"books",style:"books",jp:"古書 かもめ",en:"KAMOME BOOKS",kind:"books",x:-2.4,z:9.6,ry:Math.PI/2,w:3,d:4.6,h:5.4,accent:"#d8b06a",sign:"#ffe0a8",paper:"#f0e2c8"},{id:"cafe",style:"cafe",jp:"喫茶 ひかり",en:"HIKARI COFFEE",kind:"cafe",x:-2.4,z:11.8,ry:Math.PI/2,w:2.8,d:4.2,h:5,accent:"#ffcf94",sign:"#ffd9a0",paper:"#2a1c14"},{id:"north-cafe",style:"cafe",jp:"喫茶 月見",en:"TSUKIMI CAFE",kind:"cafe",x:-11.6,z:-2.4,ry:0,w:2.8,d:4,h:5.2,accent:"#ffcf94",sign:"#ffd9a0",paper:"#2a1c14"},{id:"pharmacy",style:"pharmacy",jp:"くすり 月見",en:"PHARMACY",kind:"pharmacy",x:-8.6,z:-2.4,ry:0,w:2.6,d:4,h:5,accent:"#7dffc0",sign:"#c8f0ff",paper:"#1a3a3a"},{id:"thrift",style:"thrift",jp:"100円ショップ",en:"HYAKU-EN",kind:"thrift",x:-6,z:-2.4,ry:0,w:2.4,d:4,h:4.8,accent:"#ff8a5c",sign:"#ffe0b0",paper:"#5a2a2a"},{id:"barber",style:"barber",jp:"床屋 タカハシ",en:"TAKAHASHI",kind:"barber",x:-4,z:-2.4,ry:0,w:1.8,d:3.6,h:4.6,accent:"#9fd8ff",sign:"#cfe8ff",paper:"#1e2a3a"},{id:"clothing",style:"clothing",jp:"洋服 そよ風",en:"SOYOKAZE",kind:"clothing",x:3.3,z:4.4,ry:-Math.PI/2,w:2.2,d:3.8,h:4.8,accent:"#e8a0b8",sign:"#ffe0e8",paper:"#3a2430"},{id:"electronics",style:"electronics",jp:"電器 ヤマ電",en:"YAMADEN",kind:"electronics",x:3.3,z:6.6,ry:-Math.PI/2,w:2.2,d:3.8,h:4.8,accent:"#9fd8ff",sign:"#d8f0ff",paper:"#1e2a3a"},{id:"post",style:"post",jp:"月見郵便局",en:"POST OFFICE",kind:"post",x:3.3,z:8.8,ry:-Math.PI/2,w:2,d:3.4,h:4.2,accent:"#ff6f5e",sign:"#ffd9a0",paper:"#3a1e1a"},{id:"koban",style:"post",jp:"月見交番",en:"KOBA N",kind:"post",x:3.3,z:10.8,ry:-Math.PI/2,w:1.7,d:2.6,h:3.4,accent:"#9fd8ff",sign:"#d8f0ff",paper:"#1e2a3a"},{id:"clinic-pharmacy",style:"pharmacy",jp:"24h 月見薬局",en:"TSUKIMI 24H",kind:"pharmacy",x:11.2,z:-6.2,ry:-Math.PI/2,w:1.9,d:2.2,h:3.4,accent:"#7dffc0",sign:"#c8f0ff",paper:"#1a3a3a"},{id:"clinic-flower",style:"flower",jp:"花 ふじ",en:"FUJI FLOWERS",kind:"clothing",x:11.2,z:-3.8,ry:-Math.PI/2,w:1.7,d:2,h:3.2,accent:"#ffb7c5",sign:"#ffe0e8",paper:"#3a2430"},{id:"river-cafe",style:"cafe",jp:"川辺 喫茶",en:"RIVERSIDE",kind:"cafe",x:10.4,z:16.8,ry:0,w:3,d:2.2,h:3.8,accent:"#ffcf94",sign:"#ffd9a0",paper:"#2a1c14"}],school:{x:-7,z:-19.1,w:12,d:4.2,h:12,floors:4},gym:{x:-20.2,z:-18.4,w:3.1,d:5.6,h:7},pool:{x:1.6,z:-19,w:3,d:3},schoolYard:{x:-7,z:-16.35,w:12,d:1.6},shrine:{x:-18.7,z:6.2,w:5.2,d:8.6},hospital:{x:17,z:-11,w:3,d:6,h:15,floors:5},station:{platformX0:17.3,platformX1:19.2,z0:-7,z1:9},river:{minZ:18.6,maxZ:22,y:.045},rail:{minX:19.2,maxX:22},bridgeMain:{x0:-2.2,x1:1.8,z:18.6},bridgeWest:{x0:-15.4,x1:-13.4,z:18.6},houses:[{x:-19,z:-12.2,w:3,d:2.6,h:3.1,ry:Math.PI/2,roof:"gable",warm:"#ffcf94",garden:!0},{x:-19,z:-7.6,w:3,d:2.6,h:3,ry:Math.PI/2,roof:"hip",warm:"#ffd9a0",garden:!0},{x:-19,z:14.4,w:3,d:2.4,h:3,ry:Math.PI/2,roof:"hip",warm:"#ffd9a0",garden:!0},{x:-19,z:16.8,w:3,d:2.4,h:2.9,ry:Math.PI/2,roof:"gable",warm:"#ffcf94",garden:!0},{x:6.6,z:-19,w:3,d:2.8,h:3.1,ry:0,roof:"gable",warm:"#ffcf94",garden:!0},{x:11.2,z:-19,w:3,d:2.8,h:3,ry:0,roof:"hip",warm:"#ffd9a0",garden:!0},{x:-11.2,z:-9.6,w:3,d:2.6,h:3.2,ry:0,roof:"gable",warm:"#ffcf94",garden:!0},{x:-5.2,z:-9.6,w:3,d:2.6,h:3,ry:0,roof:"hip",warm:"#ffd9a0",garden:!0},{x:-12,z:5.2,w:2.8,d:2.6,h:3.2,ry:Math.PI/2,roof:"gable",warm:"#ffcf94",garden:!0},{x:-12,z:10.2,w:2.8,d:2.6,h:3.1,ry:Math.PI/2,roof:"hip",warm:"#ffcf94",garden:!0},{x:10.8,z:5.2,w:3,d:2.6,h:3.1,ry:-Math.PI/2,roof:"hip",warm:"#ffcf94",garden:!0},{x:11.2,z:9.6,w:3,d:2.8,h:3.1,ry:-Math.PI/2,roof:"gable",warm:"#ffd9a0",garden:!0},{x:17,z:11.4,w:2.8,d:2.4,h:3,ry:-Math.PI/2,roof:"gable",warm:"#ffd9a0",garden:!0},{x:17,z:14.4,w:2.8,d:2.4,h:2.9,ry:-Math.PI/2,roof:"hip",warm:"#ffcf94",garden:!0}],apartments:[{x:-8.6,z:6.2,w:2.4,d:3,h:11,floors:3,ry:0},{x:10.5,z:-9.2,w:3.2,d:3,h:15,floors:5,ry:0},{x:-19.2,z:-1.6,w:3.2,d:2.8,h:9,floors:3,ry:0}],parks:[{x:-11.4,z:-12.4,w:2.6,d:1.6},{x:-10,z:16.2,w:6,d:2.8},{x:6,z:16.4,w:6,d:2.6}],parking:{x:5.8,z:-11,w:4,d:3.6},riversidePark:{x:0,z:16.6,w:18,d:2.4},market:{x:-4.2,z:17,w:5,d:2.2},townLights:[{x:.2,y:4,z:.2,color:"warm",intensity:2.2,distance:9,decay:2},{x:-2.4,y:3.4,z:7,color:"warm",intensity:2,distance:8,decay:2},{x:5,y:3.2,z:-3,color:"warm",intensity:1.8,distance:7,decay:2},{x:-15,y:3.4,z:7,color:"warmDeep",intensity:1.4,distance:7,decay:2},{x:16.8,y:4,z:2,color:"cool",intensity:1.5,distance:7,decay:2},{x:-15,y:3.2,z:-9,color:"warmDeep",intensity:1.3,distance:7,decay:2}]},im={hero:{target:[.4,2.4,1.2],radius:74,az:.7,el:.86,fov:32},front:{target:[5.6,1.6,-2.2],radius:16,az:.16,el:1,fov:36},shops:{target:[-2.6,1.6,8],radius:20,az:.75,el:.92,fov:36},homes:{target:[-10,1.8,-8],radius:24,az:.65,el:.9,fov:36},shrine:{target:[-18,2,6.2],radius:19,az:.95,el:.78,fov:38},rail:{target:[17.8,1.8,2],radius:17,az:1.3,el:.9,fov:36},school:{target:[-7,3,-17.2],radius:30,az:.42,el:1.05,fov:36},river:{target:[0,1.4,16.8],radius:26,az:.45,el:.82,fov:36},top:{target:[0,1,.2],radius:112,az:.55,el:.5,fov:33},inside:{target:[5.6,1.3,-5.4],radius:4.8,az:.14,el:1.42,fov:44},back:{target:[5.6,1.3,-8],radius:11,az:2.6,el:1.02,fov:36}};function li(i=1){let e=i>>>0;return function(){e|=0,e=e+1831565813|0;let n=Math.imul(e^e>>>15,1|e);return n=n+Math.imul(n^n>>>7,61|n)^n,((n^n>>>14)>>>0)/4294967296}}const sm={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};class Ya{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}const ZM=new Oa(-1,1,1,-1,0,1);class qM extends tt{constructor(){super(),this.setAttribute("position",new ze([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new ze([0,2,0,0,2,0],2))}}const $M=new qM;class rm{constructor(e){this._mesh=new lt($M,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,ZM)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}class am extends Ya{constructor(e,t){super(),this.textureID=t!==void 0?t:"tDiffuse",e instanceof At?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=vr.clone(e.uniforms),this.material=new At({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this.fsQuad=new rm(this.material)}render(e,t,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this.fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this.fsQuad.render(e))}dispose(){this.material.dispose(),this.fsQuad.dispose()}}class np extends Ya{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){const s=e.getContext(),r=e.state;r.buffers.color.setMask(!1),r.buffers.depth.setMask(!1),r.buffers.color.setLocked(!0),r.buffers.depth.setLocked(!0);let a,o;this.inverse?(a=0,o=1):(a=1,o=0),r.buffers.stencil.setTest(!0),r.buffers.stencil.setOp(s.REPLACE,s.REPLACE,s.REPLACE),r.buffers.stencil.setFunc(s.ALWAYS,a,4294967295),r.buffers.stencil.setClear(o),r.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),r.buffers.color.setLocked(!1),r.buffers.depth.setLocked(!1),r.buffers.color.setMask(!0),r.buffers.depth.setMask(!0),r.buffers.stencil.setLocked(!1),r.buffers.stencil.setFunc(s.EQUAL,1,4294967295),r.buffers.stencil.setOp(s.KEEP,s.KEEP,s.KEEP),r.buffers.stencil.setLocked(!0)}}class KM extends Ya{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class JM{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){const n=e.getSize(new $);this._width=n.width,this._height=n.height,t=new ln(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:Yn}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new am(sm),this.copyPass.material.blending=pi,this.clock=new Tc}swapBuffers(){const e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){const t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){e===void 0&&(e=this.clock.getDelta());const t=this.renderer.getRenderTarget();let n=!1;for(let s=0,r=this.passes.length;s<r;s++){const a=this.passes[s];if(a.enabled!==!1){if(a.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(s),a.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),a.needsSwap){if(n){const o=this.renderer.getContext(),l=this.renderer.state.buffers.stencil;l.setFunc(o.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),l.setFunc(o.EQUAL,1,4294967295)}this.swapBuffers()}np!==void 0&&(a instanceof np?n=!0:a instanceof KM&&(n=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){const t=this.renderer.getSize(new $);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;const n=this._width*this._pixelRatio,s=this._height*this._pixelRatio;this.renderTarget1.setSize(n,s),this.renderTarget2.setSize(n,s);for(let r=0;r<this.passes.length;r++)this.passes[r].setSize(n,s)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class jM extends Ya{constructor(e,t,n=null,s=null,r=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=n,this.clearColor=s,this.clearAlpha=r,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new re}render(e,t,n){const s=e.autoClear;e.autoClear=!1;let r,a;this.overrideMaterial!==null&&(a=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(r=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:n),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(r),this.overrideMaterial!==null&&(this.scene.overrideMaterial=a),e.autoClear=s}}const QM={uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new re(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};class Mr extends Ya{constructor(e,t,n,s){super(),this.strength=t!==void 0?t:1,this.radius=n,this.threshold=s,this.resolution=e!==void 0?new $(e.x,e.y):new $(256,256),this.clearColor=new re(0,0,0),this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let r=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);this.renderTargetBright=new ln(r,a,{type:Yn}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let f=0;f<this.nMips;f++){const p=new ln(r,a,{type:Yn});p.texture.name="UnrealBloomPass.h"+f,p.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(p);const u=new ln(r,a,{type:Yn});u.texture.name="UnrealBloomPass.v"+f,u.texture.generateMipmaps=!1,this.renderTargetsVertical.push(u),r=Math.round(r/2),a=Math.round(a/2)}const o=QM;this.highPassUniforms=vr.clone(o.uniforms),this.highPassUniforms.luminosityThreshold.value=s,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new At({uniforms:this.highPassUniforms,vertexShader:o.vertexShader,fragmentShader:o.fragmentShader}),this.separableBlurMaterials=[];const l=[3,5,7,9,11];r=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);for(let f=0;f<this.nMips;f++)this.separableBlurMaterials.push(this.getSeperableBlurMaterial(l[f])),this.separableBlurMaterials[f].uniforms.invSize.value=new $(1/r,1/a),r=Math.round(r/2),a=Math.round(a/2);this.compositeMaterial=this.getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;const c=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=c,this.bloomTintColors=[new w(1,1,1),new w(1,1,1),new w(1,1,1),new w(1,1,1),new w(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors;const h=sm;this.copyUniforms=vr.clone(h.uniforms),this.blendMaterial=new At({uniforms:this.copyUniforms,vertexShader:h.vertexShader,fragmentShader:h.fragmentShader,blending:In,depthTest:!1,depthWrite:!1,transparent:!0}),this.enabled=!0,this.needsSwap=!1,this._oldClearColor=new re,this.oldClearAlpha=1,this.basic=new De,this.fsQuad=new rm(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this.basic.dispose(),this.fsQuad.dispose()}setSize(e,t){let n=Math.round(e/2),s=Math.round(t/2);this.renderTargetBright.setSize(n,s);for(let r=0;r<this.nMips;r++)this.renderTargetsHorizontal[r].setSize(n,s),this.renderTargetsVertical[r].setSize(n,s),this.separableBlurMaterials[r].uniforms.invSize.value=new $(1/n,1/s),n=Math.round(n/2),s=Math.round(s/2)}render(e,t,n,s,r){e.getClearColor(this._oldClearColor),this.oldClearAlpha=e.getClearAlpha();const a=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),r&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this.fsQuad.material=this.basic,this.basic.map=n.texture,e.setRenderTarget(null),e.clear(),this.fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=n.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this.fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this.fsQuad.render(e);let o=this.renderTargetBright;for(let l=0;l<this.nMips;l++)this.fsQuad.material=this.separableBlurMaterials[l],this.separableBlurMaterials[l].uniforms.colorTexture.value=o.texture,this.separableBlurMaterials[l].uniforms.direction.value=Mr.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[l]),e.clear(),this.fsQuad.render(e),this.separableBlurMaterials[l].uniforms.colorTexture.value=this.renderTargetsHorizontal[l].texture,this.separableBlurMaterials[l].uniforms.direction.value=Mr.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[l]),e.clear(),this.fsQuad.render(e),o=this.renderTargetsVertical[l];this.fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this.fsQuad.render(e),this.fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,r&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(n),this.fsQuad.render(e)),e.setClearColor(this._oldClearColor,this.oldClearAlpha),e.autoClear=a}getSeperableBlurMaterial(e){const t=[];for(let n=0;n<e;n++)t.push(.39894*Math.exp(-.5*n*n/(e*e))/e);return new At({defines:{KERNEL_RADIUS:e},uniforms:{colorTexture:{value:null},invSize:{value:new $(.5,.5)},direction:{value:new $(.5,.5)},gaussianCoefficients:{value:t}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {
					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`})}getCompositeMaterial(e){return new At({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`})}}Mr.BlurDirectionX=new $(1,0);Mr.BlurDirectionY=new $(0,1);const eb={uniforms:{tDiffuse:{value:null},uResolution:{value:new $(1,1)},uTime:{value:0},uExposure:{value:1},uBloom:{value:1},uVignette:{value:.48},uGrain:{value:.035},uSaturation:{value:1.2},uTilt:{value:.7},uFade:{value:0},uShadowTint:{value:new re("#24406e")},uHighlightTint:{value:new re("#ffd9a8")},uAberration:{value:.55}},vertexShader:`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uExposure;
    uniform float uBloom;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uSaturation;
    uniform float uTilt;
    uniform float uFade;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;
    uniform float uAberration;
    varying vec2 vUv;

    // ACES filmic approximation (Narkowicz)
    vec3 aces( vec3 x ) {
      const float a = 2.51;
      const float b = 0.03;
      const float c = 2.43;
      const float d = 0.59;
      const float e = 0.14;
      return clamp( ( x * ( a * x + b ) ) / ( x * ( c * x + d ) + e ), 0.0, 1.0 );
    }

    vec3 toSRGB( vec3 c ) {
      return mix( pow( c, vec3( 1.0 / 2.4 ) ) * 1.055 - 0.055, c * 12.92, step( c, vec3( 0.0031308 ) ) );
    }

    float hash( vec2 p ) {
      p = fract( p * vec2( 123.34, 456.21 ) );
      p += dot( p, p + 45.32 );
      return fract( p.x * p.y );
    }

    vec3 sampleSoft( vec2 uv, float radius ) {
      if ( radius < 0.0001 ) return texture2D( tDiffuse, uv ).rgb;
      vec2 px = radius / uResolution;
      vec3 sum = vec3( 0.0 );
      float total = 0.0;
      for ( int i = 0; i < 8; i ++ ) {
        float a = float( i ) * 0.7853981634 + 0.3;
        vec2 o = vec2( cos( a ), sin( a ) );
        vec3 s = texture2D( tDiffuse, uv + o * px * 2.2 ).rgb;
        float w = 1.0;
        sum += s * w;
        total += w;
        vec3 s2 = texture2D( tDiffuse, uv + o * px * 0.9 ).rgb;
        sum += s2 * 1.0;
        total += 1.0;
      }
      return sum / total;
    }

    void main() {
      vec2 uv = vUv;
      // 轻微镜头色散：画面边缘更明显，中间几乎没有
      vec2 center = uv - 0.5;
      float edge = smoothstep( 0.12, 0.62, length( center ) );
      float ab = uAberration * edge * 0.0016;
      vec3 color;
      color.r = texture2D( tDiffuse, uv + center * ab ).r;
      color.g = texture2D( tDiffuse, uv ).g;
      color.b = texture2D( tDiffuse, uv - center * ab ).b;

      // 移轴式微模糊（上下远处模糊，保留中间的模型细节）——微缩摄影感
      float band = smoothstep( 0.30, 0.78, abs( uv.y - 0.5 ) );
      float radius = band * uTilt * 2.6;
      vec3 soft = sampleSoft( uv, radius );
      color = mix( color, soft, band * 0.82 );

      // 曝光 + tonemap
      color *= uExposure;
      color = aces( color );
      color = toSRGB( color );

      // 分离调色：冷阴影、暖高光
      color = max( color, vec3( 0.0001 ) );
      float luma = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
      float shadowW = 1.0 - smoothstep( 0.02, 0.42, luma );
      float highW = smoothstep( 0.55, 1.0, luma );
      color += uShadowTint * shadowW * 0.085;
      color = mix( color, color * uHighlightTint, highW * 0.28 );

      // 饱和度
      color = mix( vec3( luma ), color, uSaturation );

      // 轻微 S 曲线，给夜景一点对比度（三渲二的色块更干净）
      color = clamp( color, 0.0, 1.0 );
      color = color * color * ( 3.0 - 2.0 * color ) * 0.35 + color * 0.65;

      // 暗角
      vec2 vigUv = ( uv - 0.5 ) * vec2( uResolution.x / uResolution.y, 1.0 );
      float vig = 1.0 - uVignette * smoothstep( 0.34, 1.05, length( vigUv ) );
      color *= vig;

      // 颗粒（动画噪点，微弱）
      float grain = hash( uv * uResolution.xy + fract( uTime ) * 371.0 ) - 0.5;
      color += grain * uGrain * ( 0.25 + 0.75 * ( 1.0 - luma ) );

      // 轻微暗部蓝移 + 高光柔化
      color = clamp( color, 0.0, 1.0 );
      color *= uFade;

      // 抖动
      float dither = ( hash( uv * uResolution.xy + 17.0 ) - 0.5 ) / 255.0;
      color += dither;

      gl_FragColor = vec4( color, 1.0 );
    }
  `};function tb(i,e,t,n={}){const s=i.getDrawingBufferSize(new $),r=new ln(s.x,s.y,{type:Yn,minFilter:Vt,magFilter:Vt,samples:n.samples??4});r.texture.colorSpace=es;const a=new JM(i,r);a.setPixelRatio(i.getPixelRatio()),a.setSize(window.innerWidth,window.innerHeight);const o=new jM(e,t);a.addPass(o);const l=new Mr(new $(window.innerWidth,window.innerHeight),n.bloomStrength??.72,n.bloomRadius??.62,n.bloomThreshold??.72);a.addPass(l);const c=new am(eb);c.renderToScreen=!0,a.addPass(c);const h=c.uniforms;h.uExposure.value=n.exposure??1,h.uBloom.value=1;function f(y,d){a.setSize(y,d);const m=i.getDrawingBufferSize(new $);h.uResolution.value.set(m.x,m.y),l.resolution.set(y,d)}function p(){f(window.innerWidth,window.innerHeight)}f(window.innerWidth,window.innerHeight);let u=performance.now();const g=n.fadeMs??1800;return{composer:a,bloom:l,grade:c,uniforms:h,setSize:f,resize:p,render(y,d){h.uTime.value=d;const m=Math.min(1,(performance.now()-u)/g);h.uFade.value=m*m*(3-2*m),a.render(y)},get fadeDone(){return performance.now()-u>g+100}}}function Rh(i){const e=new Uint8Array(i.length*4);i.forEach((n,s)=>{const r=Math.round(Math.min(1,Math.max(0,n))*255);e[s*4+0]=r,e[s*4+1]=r,e[s*4+2]=r,e[s*4+3]=255});const t=new si(e,i.length,1,mn);return t.minFilter=Qt,t.magFilter=Qt,t.generateMipmaps=!1,t.colorSpace=Gn,t.needsUpdate=!0,t}const nb={hard:Rh([.3,.55,.82,1]),soft:Rh([.52,.74,.9,1]),tiny:Rh([.55,.85,1])},ib=`#include <common>
uniform vec3 uRimColor;
uniform float uRimStrength;
uniform float uRimPower;`,sb=`#include <common>
uniform vec3 uRimColor;
uniform float uRimStrength;
uniform float uRimPower;`,rb=`#include <opaque_fragment>
  {
    float rimDot = 1.0 - clamp( dot( normalize( vNormal ), normalize( vViewPosition ) ), 0.0, 1.0 );
    float rim = pow( rimDot, uRimPower );
    // 只在受光一侧的掠射边缘出光，避免整圈发光
    gl_FragColor.rgb += uRimColor * ( uRimStrength * rim );
  }`;function ab(i,{rim:e=.16,rimColor:t="#8dc8ff",rimPower:n=3.2}={}){if(e<=0)return i;i.userData.rim={rim:e,rimColor:t,rimPower:n};const s=i.onBeforeCompile;return i.onBeforeCompile=(r,a)=>{s&&s(r,a);const o=new re(t);r.uniforms.uRimColor={value:o},r.uniforms.uRimStrength={value:e},r.uniforms.uRimPower={value:n},r.vertexShader=r.vertexShader.replace("#include <common>",ib),r.fragmentShader=r.fragmentShader.replace("#include <common>",sb),r.fragmentShader=r.fragmentShader.replace("#include <opaque_fragment>",rb)},i.customProgramCacheKey=()=>`rim:${e}:${t}:${n}`,i}const Ph=new Map;function I(i,e={}){const t=JSON.stringify({color:i,...e,__map:e.map?e.map.uuid:""});if(Ph.has(t))return Ph.get(t);const n=new Hf({color:i,gradientMap:nb[e.gradient||"hard"],map:e.map||null,emissive:e.emissive||"#000000",emissiveIntensity:e.emissiveIntensity??1,transparent:e.transparent??!1,opacity:e.opacity??1,side:e.side??Pn,vertexColors:e.vertexColors??!1,depthWrite:e.depthWrite??!0,alphaTest:e.alphaTest??0});return e.map&&(n.map.colorSpace=Dt),ab(n,e),Ph.set(t,n),n}function gt(i,e={}){const t=new De({color:i,map:e.map||null,transparent:e.transparent??!1,opacity:e.opacity??1,side:e.side??Pn,depthWrite:e.depthWrite??!0,alphaTest:e.alphaTest??0,toneMapped:e.toneMapped??!0,fog:e.fog??!0,blending:e.blending??ii});return e.map&&(t.map.colorSpace=Dt),t}function zt(i,e=1.4,t={}){const n=gt("#ffffff",{map:i,transparent:t.transparent??!1,opacity:t.opacity??1,side:t.side??Pn,alphaTest:t.alphaTest??0,fog:!1});return n.color.setScalar(e),n}function Za(i,e=2){const t=new De({color:i,fog:!1});return t.color.multiplyScalar(e),t}const ob=`
  uniform float uWidth;
  void main() {
    vec3 n = normalize( normalMatrix * normal );
    vec4 mv = modelViewMatrix * vec4( position, 1.0 );
    // 屏幕空间近似恒定宽度：偏移量随视距线性增长
    mv.xyz += n * uWidth * ( -mv.z );
    gl_Position = projectionMatrix * mv;
  }
`,lb=`
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4( uColor, 1.0 );
  }
`,Ih=new Map;function cb(i=.00115,e="#080b13"){const t=`${i}:${e}`;if(Ih.has(t))return Ih.get(t);const n=new At({uniforms:{uWidth:{value:i},uColor:{value:new re(e)}},vertexShader:ob,fragmentShader:lb,side:on,transparent:!1,depthWrite:!0,depthTest:!0,fog:!1});return Ih.set(t,n),n}function Lt(i,e={}){const t=e.width??.00115,n=e.color??"#080b13",s=cb(t,n),r=[];i.traverse(a=>{if(!a.isMesh||a.isInstancedMesh||a.isLine||a.isPoints||a.userData.noOutline||a.userData.isOutline||Array.isArray(a.material))return;const o=a.material;!o||o.transparent||o.opacity<.99||o.isShaderMaterial||r.push(a)});for(const a of r){if(a.userData.skipOutline)continue;const o=new lt(a.geometry,s);o.userData.isOutline=!0,o.castShadow=!1,o.receiveShadow=!1,o.matrixAutoUpdate=!0,o.position.set(0,0,0),o.rotation.set(0,0,0),o.scale.set(1,1,1),o.renderOrder=(a.renderOrder||0)+1,a.add(o)}return i}let qr=null;function Ac(){if(qr)return qr;const i=128,e=document.createElement("canvas");e.width=e.height=i;const t=e.getContext("2d"),n=t.createRadialGradient(i/2,i/2,0,i/2,i/2,i/2);return n.addColorStop(0,"rgba(255,255,255,1)"),n.addColorStop(.25,"rgba(255,255,255,0.55)"),n.addColorStop(.6,"rgba(255,255,255,0.12)"),n.addColorStop(1,"rgba(255,255,255,0)"),t.fillStyle=n,t.fillRect(0,0,i,i),qr=new Ns(e),qr.colorSpace=Dt,qr}function Yt(i,e=2.4,t=.5){const n=new Ba({map:Ac(),color:new re(i),transparent:!0,opacity:t,blending:In,depthWrite:!1,fog:!1}),s=new cc(n);return s.scale.set(e,e,1),s.userData.isGlowSprite=!0,s}const Re='"Hiragino Sans", "Hiragino Kaku Gothic ProN", "YuGothic", "Noto Sans JP", "PingFang SC", sans-serif',ht='"Avenir Next", "Helvetica Neue", "Hiragino Sans", Arial, sans-serif';function hb(i,e){const t=document.createElement("canvas");t.width=i,t.height=e;const n=t.getContext("2d");return{canvas:t,ctx:n}}function Ze(i,e,t,n={}){const{canvas:s,ctx:r}=hb(i,e);t(r,i,e);const a=new Ns(s);return a.colorSpace=n.srgb===!1?Gn:Dt,a.anisotropy=n.anisotropy??8,a.minFilter=n.minFilter??ni,a.magFilter=n.magFilter??Vt,n.repeat&&(a.wrapS=a.wrapT=gr,a.repeat.set(n.repeat[0],n.repeat[1])),n.wrap&&(a.wrapS=a.wrapT=n.wrap),a.needsUpdate=!0,a}function wt(i,e,t,n,s,r){const a=Math.min(r,n/2,s/2);i.beginPath(),i.moveTo(e+a,t),i.lineTo(e+n-a,t),i.quadraticCurveTo(e+n,t,e+n,t+a),i.lineTo(e+n,t+s-a),i.quadraticCurveTo(e+n,t+s,e+n-a,t+s),i.lineTo(e+a,t+s),i.quadraticCurveTo(e,t+s,e,t+s-a),i.lineTo(e,t+a),i.quadraticCurveTo(e,t,e+a,t),i.closePath()}function fb(i,e,t,n,s=4,r=.32){i.beginPath();for(let a=0;a<s*2;a+=1){const o=Math.PI/s*a-Math.PI/2,l=a%2===0?n:n*r,c=e+Math.cos(o)*l,h=t+Math.sin(o)*l;a===0?i.moveTo(c,h):i.lineTo(c,h)}i.closePath()}function Dh(i,e){const{cx:t,cy:n,r:s}=e,r=e.disc??"#20304f",a=e.moon??"#ffc96b",o=e.star??"#fbf3dd";i.save(),i.fillStyle=r,i.beginPath(),i.arc(t,n,s,0,Math.PI*2),i.fill(),i.fillStyle=a,i.beginPath(),i.arc(t-s*.08,n-s*.04,s*.62,0,Math.PI*2),i.fill(),i.fillStyle=r,i.beginPath(),i.arc(t+s*.26,n-s*.2,s*.58,0,Math.PI*2),i.fill(),i.fillStyle=o,fb(i,t+s*.44,n+s*.38,s*.18,4,.36),i.fill(),i.beginPath(),i.arc(t+s*.1,n+s*.55,s*.07,0,Math.PI*2),i.fill(),i.restore()}const Lh=new Map;function pn(i,e){return()=>(Lh.has(i)||Lh.set(i,e()),Lh.get(i))}const Rn={mainSign:pn("mainSign",()=>Ze(2048,320,(i,e,t)=>{const n=i.createLinearGradient(0,0,0,t);n.addColorStop(0,"#fff9e9"),n.addColorStop(.62,"#f8efd8"),n.addColorStop(1,"#efe3c7"),i.fillStyle=n,i.fillRect(0,0,e,t),i.fillStyle="#2b3a60",i.fillRect(0,t-26,e,26),i.fillStyle="#3fa8a0",i.fillRect(0,0,e,10),Dh(i,{cx:190,cy:150,r:108,disc:"#20304f",moon:"#ffc96b",star:"#fbf3dd"}),i.fillStyle="#20304f",i.textBaseline="middle",i.font=`700 138px ${Re}`,i.fillText("つきみマート",330,138),i.fillStyle="#3fa8a0",i.font=`600 44px ${ht}`,i.letterSpacing="10px",i.fillText("TSUKIMI MART",336,242),i.letterSpacing="0px",i.fillStyle="rgba(32,48,79,0.62)",i.font=`500 30px ${Re}`,i.fillText("月見町二丁目店",1330,253),i.fillStyle="#ff7a5e",wt(i,1716,64,238,190,34),i.fill(),i.fillStyle="#fff7e3",i.font=`800 98px ${ht}`,i.textAlign="center",i.fillText("24H",1835,138),i.font=`600 28px ${Re}`,i.fillText("24時間営業",1835,207),i.textAlign="left"})),pylonSign:pn("pylonSign",()=>Ze(512,1536,(i,e,t)=>{const n=i.createLinearGradient(0,0,0,t);n.addColorStop(0,"#fff9e9"),n.addColorStop(1,"#f4e9d2"),i.fillStyle=n,i.fillRect(0,0,e,t),i.fillStyle="#20304f",i.fillRect(0,0,e,430),Dh(i,{cx:256,cy:195,r:118,disc:"#20304f",moon:"#ffc96b",star:"#fbf3dd"}),i.fillStyle="#fbf3dd",i.textAlign="center",i.font=`700 54px ${ht}`,i.letterSpacing="6px",i.fillText("TSUKIMI",256,372),i.letterSpacing="0px",i.fillStyle="#20304f",i.font=`700 116px ${Re}`,"つきみマート".split("").forEach((r,a)=>i.fillText(r,256,560+a*134)),i.strokeStyle="rgba(32,48,79,0.28)",i.lineWidth=4,i.beginPath(),i.moveTo(64,1240),i.lineTo(448,1240),i.stroke(),i.fillStyle="#3fa8a0",i.font=`600 36px ${Re}`,i.fillText("24時間営業",256,1310),i.fillStyle="#ff7a5e",wt(i,96,1352,320,132,26),i.fill(),i.fillStyle="#fff7e3",i.font=`800 86px ${ht}`,i.fillText("24H",256,1420)})),doorSticker:pn("doorSticker",()=>Ze(512,256,(i,e,t)=>{i.clearRect(0,0,e,t),i.fillStyle="rgba(255,255,255,0.94)",wt(i,10,10,e-20,t-20,18),i.fill(),i.strokeStyle="rgba(63,168,160,0.9)",i.lineWidth=6,wt(i,10,10,e-20,t-20,18),i.stroke(),i.strokeStyle="#3fa8a0",i.lineWidth=16,i.lineCap="round",i.beginPath(),i.moveTo(70,128),i.lineTo(150,128),i.stroke(),i.beginPath(),i.moveTo(120,88),i.lineTo(158,128),i.lineTo(120,168),i.stroke(),i.fillStyle="#20304f",i.font=`700 58px ${Re}`,i.textAlign="center",i.fillText("自動ドア",330,112),i.fillStyle="rgba(32,48,79,0.55)",i.font=`500 40px ${ht}`,i.letterSpacing="3px",i.fillText("AUTOMATIC DOOR",330,178)})),sticker:pn("sticker",()=>Ze(512,512,(i,e,t)=>{i.clearRect(0,0,e,t),i.strokeStyle="#20304f",i.fillStyle="rgba(251,243,221,0.95)",i.lineWidth=12,i.beginPath(),i.arc(256,256,220,0,Math.PI*2),i.fill(),i.stroke(),i.fillStyle="#20304f",i.textAlign="center",i.font=`700 180px ${ht}`,i.fillText("ATM",256,300),i.font=`600 60px ${Re}`,i.fillText("24時間",256,396)})),wallAd:pn("wallAd",()=>Ze(768,1024,(i,e,t)=>{const n=i.createLinearGradient(0,0,0,t);n.addColorStop(0,"#19384f"),n.addColorStop(.55,"#2a6072"),n.addColorStop(1,"#c8efe8"),i.fillStyle=n,i.fillRect(0,0,e,t),i.fillStyle="rgba(255,201,107,0.95)",i.beginPath(),i.arc(560,190,100,0,Math.PI*2),i.fill(),i.fillStyle="rgba(25,56,79,0.9)",i.beginPath(),i.arc(608,158,92,0,Math.PI*2),i.fill();for(let s=0;s<38;s+=1){const r=s*137.5%e,a=260+s*83%620,o=5+s*37%16;i.fillStyle=`rgba(220,255,250,${.12+s%5*.06})`,i.beginPath(),i.arc(r,a,o,0,Math.PI*2),i.fill()}i.save(),i.translate(e/2,500),i.fillStyle="rgba(245,255,252,0.92)",wt(i,-100,-150,200,470,54),i.fill(),i.fillStyle="#3fa8a0",wt(i,-100,-40,200,210,22),i.fill(),i.fillStyle="#fbf3dd",i.font=`800 68px ${Re}`,i.textAlign="center",i.fillText("月のしずく",0,60),i.font=`600 34px ${ht}`,i.fillText("MOON DROP",0,112),i.fillStyle="#20304f",wt(i,-62,-220,124,80,18),i.fill(),i.fillStyle="#ffc96b",i.beginPath(),i.arc(0,-180,26,0,Math.PI*2),i.fill(),i.restore(),i.fillStyle="#fbf3dd",i.font=`700 92px ${Re}`,i.textAlign="center",i.fillText("つめた〜い",e/2,150),i.fillStyle="#20304f",wt(i,148,880,472,96,22),i.fill(),i.fillStyle="#fbf3dd",i.font=`700 52px ${Re}`,i.fillText("新発売",e/2,946),i.textAlign="left"})),doorMat:pn("doorMat",()=>Ze(768,384,(i,e,t)=>{i.fillStyle="#1c2740",i.fillRect(0,0,e,t),i.strokeStyle="rgba(251,243,221,0.5)",i.lineWidth=10,i.strokeRect(18,18,e-36,t-36),Dh(i,{cx:210,cy:t/2,r:92,disc:"#1c2740",moon:"#ffc96b",star:"#fbf3dd"}),i.fillStyle="#fbf3dd",i.font=`700 88px ${Re}`,i.textBaseline="middle",i.fillText("つきみマート",330,170),i.fillStyle="#3fa8a0",i.font=`600 34px ${ht}`,i.letterSpacing="6px",i.fillText("TSUKIMI MART",334,262),i.letterSpacing="0px"})),noticePosters:pn("noticePosters",()=>Ze(768,1024,(i,e,t)=>{i.fillStyle="#d8c8a4",i.fillRect(0,0,e,t);for(let r=0;r<2600;r+=1){const a=r*61.7%e,o=r*131.3%t;i.fillStyle=`rgba(90,66,36,${.03+r%7*.012})`,i.fillRect(a,o,3,3)}const n=(r,a,o,l,c,h)=>{i.save(),i.translate(r,a),i.rotate(h),i.fillStyle=c,i.fillRect(0,0,o,l),i.fillStyle="rgba(255,255,255,0.85)",i.fillRect(10,10,o-20,l-20),i.restore()};n(70,80,240,320,"#f2e6c8",-.035),n(360,120,260,350,"#e9dcc0",.028),n(160,500,280,380,"#efe2c4",-.012),i.strokeStyle="rgba(40,50,70,0.55)",i.lineWidth=6;for(let r=0;r<5;r+=1)i.beginPath(),i.moveTo(110,180+r*36),i.lineTo(270,180+r*36),i.stroke();i.fillStyle="#ff7a5e",i.beginPath(),i.arc(440,250,54,0,Math.PI*2),i.fill(),i.fillStyle="#20304f",i.font=`700 54px ${Re}`,i.fillText("ねこ",405,270),i.fillStyle="#20304f",i.font=`700 48px ${Re}`,i.fillText("夏祭り",200,570),i.fillText("お知らせ",200,630),i.fillStyle="#3fa8a0",i.fillRect(200,660,180,14);const s=(r,a,o)=>{i.fillStyle="rgba(0,0,0,0.18)",i.beginPath(),i.arc(r+3,a+4,11,0,Math.PI*2),i.fill(),i.fillStyle=o,i.beginPath(),i.arc(r,a,10,0,Math.PI*2),i.fill()};s(190,100,"#ff7a5e"),s(490,140,"#3fa8a0"),s(300,520,"#ffc96b")})),aFrame:pn("aFrame",()=>Ze(512,768,(i,e,t)=>{i.fillStyle="#26324d",i.fillRect(0,0,e,t),i.strokeStyle="rgba(251,243,221,0.35)",i.lineWidth=6,i.strokeRect(16,16,e-32,t-32),i.fillStyle="#ffc96b",i.beginPath(),i.arc(e/2,170,86,0,Math.PI*2),i.fill(),i.fillStyle="#26324d",i.beginPath(),i.arc(e/2+30,148,80,0,Math.PI*2),i.fill(),i.fillStyle="#fbf3dd",i.textAlign="center",i.font=`700 62px ${Re}`,i.fillText("できたて",e/2,330),i.fillText("コーヒー",e/2,404),i.fillStyle="#ff7a5e",i.font=`800 150px ${ht}`,i.fillText("100",e/2,570),i.font=`700 58px ${ht}`,i.fillText("円",e/2,640),i.fillStyle="rgba(251,243,221,0.65)",i.font=`500 30px ${Re}`,i.fillText("M サイズ / 税込",e/2,710),i.textAlign="left"})),glassPosterOden:pn("glassPosterOden",()=>Wo({w:640,h:900,bg:"#7a2f24",bg2:"#b8492f",title:"おでん",sub:"はじめました",accent:"#ffc96b",kind:"oden"})),glassPosterCoffee:pn("glassPosterCoffee",()=>Wo({w:640,h:900,bg:"#20304f",bg2:"#3a5478",title:"できたて",sub:"COFFEE",accent:"#ffc96b",kind:"coffee"})),posterMoonDango:pn("posterMoonDango",()=>Wo({w:640,h:900,bg:"#1f4a55",bg2:"#3f8a84",title:"月見だんご",sub:"今夜、月がきれい",accent:"#ffe3a3",kind:"dango"})),posterOnigiri:pn("posterOnigiri",()=>Wo({w:640,h:900,bg:"#f5ead0",bg2:"#fbf7ea",title:"おにぎり",sub:"新発売",accent:"#ff7a5e",dark:!0,kind:"onigiri"})),aisleSign:pn("aisleSign",()=>Ze(1024,256,(i,e,t)=>{const n=i.createLinearGradient(0,0,0,t);n.addColorStop(0,"#2b5fa8"),n.addColorStop(1,"#1d4379"),i.fillStyle=n,i.fillRect(0,0,e,t),i.fillStyle="#f7f4e8",i.fillRect(0,0,26,t),i.fillRect(0,0,e,10),i.fillStyle="#eaf6ff",i.font=`700 120px ${Re}`,i.textAlign="center",i.textBaseline="middle",i.fillText("おにぎり・お弁当",e/2+20,t/2+4),i.fillStyle="#ffc96b",i.beginPath(),i.arc(110,118,36,0,Math.PI*2),i.fill(),i.fillStyle="#1d4379",i.beginPath(),i.arc(124,108,32,0,Math.PI*2),i.fill()})),menuBoard:pn("menuBoard",()=>Ze(1024,512,(i,e,t)=>{i.fillStyle="#f5efdd",i.fillRect(0,0,e,t),i.fillStyle="#20304f",i.fillRect(0,0,e,96),i.fillStyle="#ffc96b",i.font=`700 58px ${Re}`,i.fillText("ホットスナック",40,68),i.fillStyle="#20304f",[["からあげ","¥240"],["フランク","¥190"],["ナゲット","¥220"],["ポテト","¥180"]].forEach(([s,r],a)=>{const o=200+a*78;i.font=`600 52px ${Re}`,i.fillText(s,48,o),i.font=`700 52px ${ht}`,i.fillStyle="#ff7a5e",i.textAlign="right",i.fillText(r,e-48,o),i.textAlign="left",i.fillStyle="#20304f",i.strokeStyle="rgba(32,48,79,0.18)",i.lineWidth=3,i.beginPath(),i.moveTo(48,o+28),i.lineTo(e-48,o+28),i.stroke()})}))};function Wo({w:i,h:e,bg:t,bg2:n,title:s,sub:r,accent:a,dark:o=!1,kind:l}){return Ze(i,e,c=>{const h=c.createLinearGradient(0,0,0,e);h.addColorStop(0,t),h.addColorStop(1,n),c.fillStyle=h,c.fillRect(0,0,i,e),c.strokeStyle=o?"rgba(32,48,79,0.35)":"rgba(251,243,221,0.4)",c.lineWidth=12,c.strokeRect(16,16,i-32,e-32),c.fillStyle=a,c.beginPath(),c.arc(i*.78,e*.16,i*.14,0,Math.PI*2),c.fill();const f=o?"#20304f":"#fbf3dd";if(l==="oden"){c.fillStyle="rgba(251,243,221,0.92)",wt(c,i*.16,e*.42,i*.68,e*.2,26),c.fill(),c.fillStyle="#d2a04c",wt(c,i*.2,e*.45,i*.6,e*.08,18),c.fill(),c.fillStyle="#f5e6bb",c.beginPath(),c.ellipse(i*.33,e*.5,46,26,0,0,Math.PI*2),c.fill(),c.fillStyle="#c97a3f",wt(c,i*.44,e*.455,90,44,20),c.fill(),c.fillStyle="#f7ecd2",c.beginPath(),c.arc(i*.61,e*.5,30,0,Math.PI*2),c.fill(),c.strokeStyle="rgba(251,243,221,0.75)",c.lineWidth=10;for(let p=0;p<3;p+=1)c.beginPath(),c.moveTo(i*(.3+p*.18),e*.38),c.bezierCurveTo(i*(.26+p*.18),e*.32,i*(.36+p*.18),e*.28,i*(.32+p*.18),e*.22),c.stroke()}else if(l==="coffee"){c.fillStyle="#fbf3dd",wt(c,i*.3,e*.36,i*.4,e*.2,18),c.fill(),c.fillStyle="#6b3f27",c.beginPath(),c.ellipse(i*.5,e*.37,i*.19,e*.03,0,0,Math.PI*2),c.fill(),c.strokeStyle="#fbf3dd",c.lineWidth=10;for(let p=0;p<3;p+=1)c.beginPath(),c.moveTo(i*(.38+p*.12),e*.3),c.bezierCurveTo(i*.34+p*.12*i,e*.24,i*.42+p*.12*i,e*.2,i*.38+p*.12*i,e*.14),c.stroke()}else l==="dango"?(c.fillStyle="#ffe3a3",c.beginPath(),c.arc(i*.5,e*.32,i*.16,0,Math.PI*2),c.fill(),c.fillStyle=n,c.beginPath(),c.arc(i*.56,e*.29,i*.15,0,Math.PI*2),c.fill(),c.strokeStyle="#e8d3a8",c.lineWidth=18,c.beginPath(),c.moveTo(i*.5,e*.42),c.lineTo(i*.5,e*.62),c.stroke(),["#f7ead0","#f0d3a8","#f7ead0"].forEach((p,u)=>{c.fillStyle=p,c.beginPath(),c.arc(i*.5,e*(.44+u*.07),42,0,Math.PI*2),c.fill()})):l==="onigiri"&&(c.fillStyle="#fbf7ea",c.beginPath(),c.moveTo(i*.5,e*.32),c.lineTo(i*.72,e*.58),c.lineTo(i*.28,e*.58),c.closePath(),c.fill(),c.fillStyle="#20304f",c.fillRect(i*.34,e*.48,i*.32,e*.12),c.fillStyle="#3fa8a0",c.beginPath(),c.arc(i*.5,e*.4,20,0,Math.PI*2),c.fill());c.fillStyle=f,c.textAlign="center",c.font=`800 ${l==="onigiri"?118:128}px ${Re}`,c.fillText(s,i/2,e*.78),c.fillStyle=a,c.font=`700 52px ${Re}`,c.fillText(r,i/2,e*.855),c.fillStyle=a,c.fillRect(0,e-74,i,74),c.fillStyle="#20304f",c.font=`600 32px ${ht}`,c.letterSpacing="8px",c.fillText("TSUKIMI MART",i/2,e-26),c.letterSpacing="0px",c.textAlign="left"})}const ub={wood:pn("wood",()=>Ze(1024,1024,(i,e,t)=>{const n=i.createLinearGradient(0,0,e,t);n.addColorStop(0,"#2a1d17"),n.addColorStop(.45,"#33231b"),n.addColorStop(1,"#241812"),i.fillStyle=n,i.fillRect(0,0,e,t);let s=12345;const r=()=>(s=(s*1664525+1013904223)%4294967296,s/4294967296);for(let o=0;o<190;o+=1){const l=r()*t,c=6+r()*22,h=.002+r()*.01;i.strokeStyle=r()>.5?`rgba(120,82,52,${.04+r()*.08})`:`rgba(10,6,4,${.05+r()*.12})`,i.lineWidth=.6+r()*2.6,i.beginPath();for(let f=0;f<=e;f+=16){const p=l+Math.sin(f*h+r()*.2)*c+Math.sin(f*h*2.7)*c*.25;f===0?i.moveTo(f,p):i.lineTo(f,p)}i.stroke()}for(let o=0;o<4200;o+=1){const l=r()*e,c=r()*t;i.fillStyle=`rgba(255,220,180,${r()*.02})`,i.fillRect(l,c,1.5,1.5)}const a=i.createRadialGradient(e/2,t/2,e*.2,e/2,t/2,e*.75);a.addColorStop(0,"rgba(0,0,0,0)"),a.addColorStop(1,"rgba(0,0,0,0.35)"),i.fillStyle=a,i.fillRect(0,0,e,t)})),brassPlate:pn("brassPlate",()=>Ze(1024,192,(i,e,t)=>{const n=i.createLinearGradient(0,0,0,t);n.addColorStop(0,"#d9b570"),n.addColorStop(.35,"#c49a55"),n.addColorStop(.55,"#e0c084"),n.addColorStop(1,"#9c7639"),i.fillStyle=n,i.fillRect(0,0,e,t);for(let r=0;r<90;r+=1)i.strokeStyle=`rgba(255,240,200,${.03+r%6*.012})`,i.lineWidth=1,i.beginPath(),i.moveTo(0,r*23%t),i.lineTo(e,r*23%t),i.stroke();i.textAlign="center",i.textBaseline="middle",i.fillStyle="rgba(255,246,214,0.55)",i.font=`700 74px ${Re}`,i.fillText("雨夜のコンビニ",e/2+2,74),i.fillStyle="rgba(58,38,16,0.92)",i.fillText("雨夜のコンビニ",e/2,72),i.fillStyle="rgba(58,38,16,0.78)",i.font=`600 26px ${ht}`,i.letterSpacing="9px",i.fillText("RAINY KONBINI  ·  TSUKIMI MART",e/2,140),i.letterSpacing="0px";const s=(r,a)=>{const o=i.createRadialGradient(r-4,a-4,1,r,a,12);o.addColorStop(0,"#f0d8a0"),o.addColorStop(1,"#8a6630"),i.fillStyle=o,i.beginPath(),i.arc(r,a,10,0,Math.PI*2),i.fill(),i.strokeStyle="rgba(60,40,16,0.7)",i.lineWidth=3,i.beginPath(),i.moveTo(r-5,a),i.lineTo(r+5,a),i.stroke()};s(36,30),s(e-36,30),s(36,t-30),s(e-36,t-30)}))};function db(i,e={}){return new De({map:i,transparent:!0,opacity:e.opacity??1,depthWrite:!1,side:e.side??Pn,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2,toneMapped:!0,fog:!1})}function vs({w:i=256,h:e=128,bg:t="#fbf3dd",fg:n="#20304f",text:s="",sub:r="",font:a=Re,size:o=52}){return Ze(i,e,l=>{l.fillStyle=t,l.fillRect(0,0,i,e),l.strokeStyle="rgba(32,48,79,0.25)",l.lineWidth=4,l.strokeRect(4,4,i-8,e-8),l.fillStyle=n,l.textAlign="center",l.textBaseline="middle",l.font=`700 ${o}px ${a}`,l.fillText(s,i/2,r?e*.42:e*.52),r&&(l.font=`600 ${Math.round(o*.58)}px ${a}`,l.fillStyle="rgba(32,48,79,0.65)",l.fillText(r,i/2,e*.7))})}const $r=new w;function Vn(i,e,t,n,s,r){const a=2*Math.PI*s/4,o=Math.max(r-2*s,0),l=Math.PI/4;$r.copy(e),$r[n]=0,$r.normalize();const c=.5*a/(a+o),h=1-$r.angleTo(i)/l;return Math.sign($r[t])===1?h*c:o/(a+o)+c+c*(1-h)}class pb extends Dn{constructor(e=1,t=1,n=1,s=2,r=.1){if(s=s*2+1,r=Math.min(e/2,t/2,n/2,r),super(1,1,1,s,s,s),s===1)return;const a=this.toNonIndexed();this.index=null,this.attributes.position=a.attributes.position,this.attributes.normal=a.attributes.normal,this.attributes.uv=a.attributes.uv;const o=new w,l=new w,c=new w(e,t,n).divideScalar(2).subScalar(r),h=this.attributes.position.array,f=this.attributes.normal.array,p=this.attributes.uv.array,u=h.length/6,g=new w,y=.5/s;for(let d=0,m=0;d<h.length;d+=3,m+=2)switch(o.fromArray(h,d),l.copy(o),l.x-=Math.sign(l.x)*y,l.y-=Math.sign(l.y)*y,l.z-=Math.sign(l.z)*y,l.normalize(),h[d+0]=c.x*Math.sign(o.x)+l.x*r,h[d+1]=c.y*Math.sign(o.y)+l.y*r,h[d+2]=c.z*Math.sign(o.z)+l.z*r,f[d+0]=l.x,f[d+1]=l.y,f[d+2]=l.z,Math.floor(d/u)){case 0:g.set(1,0,0),p[m+0]=Vn(g,l,"z","y",r,n),p[m+1]=1-Vn(g,l,"y","z",r,t);break;case 1:g.set(-1,0,0),p[m+0]=1-Vn(g,l,"z","y",r,n),p[m+1]=1-Vn(g,l,"y","z",r,t);break;case 2:g.set(0,1,0),p[m+0]=1-Vn(g,l,"x","z",r,e),p[m+1]=Vn(g,l,"z","x",r,n);break;case 3:g.set(0,-1,0),p[m+0]=1-Vn(g,l,"x","z",r,e),p[m+1]=1-Vn(g,l,"z","x",r,n);break;case 4:g.set(0,0,1),p[m+0]=1-Vn(g,l,"x","y",r,e),p[m+1]=1-Vn(g,l,"y","x",r,t);break;case 5:g.set(0,0,-1),p[m+0]=Vn(g,l,"x","y",r,e),p[m+1]=1-Vn(g,l,"y","x",r,t);break}}}const mb=Math.PI/180,zh=new Map;function Rr(i,e){return zh.has(i)||zh.set(i,e()),zh.get(i)}function gb(i,e,t){return Rr(`box:${i}:${e}:${t}`,()=>new Dn(i,e,t))}function yb(i,e,t,n=.04,s=2){return Rr(`rbox:${i}:${e}:${t}:${n}:${s}`,()=>new pb(i,e,t,s,n))}function om(i,e){return Rr(`plane:${i}:${e}`,()=>new Ln(i,e))}function _b(i,e,t,n=16,s=!1){return Rr(`cyl:${i}:${e}:${t}:${n}:${s}`,()=>new Xn(i,e,t,n,1,s))}function xb(i,e=16,t=12){return Rr(`sph:${i}:${e}:${t}`,()=>new Fi(i,e,t))}function vb(i,e,t=8,n=24,s=Math.PI*2){return Rr(`tor:${i}:${e}:${t}:${n}:${s}`,()=>new Ha(i,e,t,n,s))}function is(i,e,t={}){const n=new lt(i,e);return n.position.set(t.x??0,t.y??0,t.z??0),n.rotation.set(t.rx??0,t.ry??0,t.rz??0),n.scale.set(t.sx??1,t.sy??1,t.sz??1),n.castShadow=t.cast??!0,n.receiveShadow=t.receive??!0,t.name&&(n.name=t.name),t.renderOrder!==void 0&&(n.renderOrder=t.renderOrder),t.parent&&t.parent.add(n),n}function C(i,e,t,n,s={}){return is(gb(i,e,t),n,s)}function Mb(i,e,t,n,s,r={}){return is(yb(i,e,t,n,r.seg??2),s,r)}function me(i,e,t,n={}){return is(om(i,e),t,{cast:!1,receive:!1,...n})}function ye(i,e,t,n,s,r={}){return is(_b(i,e,t,n,r.open??!1),s,r)}function tn(i,e,t={}){return is(xb(i,t.ws??16,t.hs??12),e,t)}function iu(i,e,t,n,s,r={}){return is(vb(i,e,t,n,r.arc??Math.PI*2),s,r)}function su(i,e,t,n={}){const s=new Uf(i.map(o=>o.isVector3?o:new w(...o))),r=new Ga(s,n.segments??24,e,n.radialSegments??4,!1);return is(r,t,{...n,cast:n.cast??!1,receive:n.receive??!1})}function lm(i,e,t=.6,n=[]){const s=i.isVector3?i:new w(...i),r=e.isVector3?e:new w(...e),a=[],o=18;for(let l=0;l<=o;l+=1){const c=l/o,h=s.clone().lerp(r,c);h.y-=Math.sin(c*Math.PI)*t;for(const f of n)h.add(f.clone().multiplyScalar(Math.sin(c*Math.PI)));a.push(h)}return a}function pe(i=""){const e=new di;return e.name=i,e}function ru(i,e=!0,t=!0){return i.traverse(n=>{n.isMesh&&(n.userData.isOutline||(n.castShadow=e,n.receiveShadow=t))}),i}function bb(){return Ze(2048,320,(i,e,t)=>{const n=i.createLinearGradient(0,0,0,t);n.addColorStop(0,"#d9b570"),n.addColorStop(.35,"#c49a55"),n.addColorStop(.55,"#e0c084"),n.addColorStop(1,"#9c7639"),i.fillStyle=n,i.fillRect(0,0,e,t);for(let r=0;r<120;r+=1)i.strokeStyle=`rgba(255,240,200,${.03+r%6*.012})`,i.lineWidth=1,i.beginPath(),i.moveTo(0,r*37%t),i.lineTo(e,r*37%t),i.stroke();i.textAlign="center",i.textBaseline="middle",i.fillStyle="rgba(255,246,214,0.55)",i.font=`700 118px ${Re}`,i.fillText("雨夜の小さな町",e/2+3,124),i.fillStyle="rgba(58,38,16,0.92)",i.fillText("雨夜の小さな町",e/2,121),i.fillStyle="rgba(58,38,16,0.78)",i.font=`600 36px ${ht}`,i.letterSpacing="12px",i.fillText("RAINY LITTLE TOWN  ·  TSUKIMI",e/2,232),i.letterSpacing="0px";const s=(r,a)=>{const o=i.createRadialGradient(r-5,a-5,1,r,a,16);o.addColorStop(0,"#f0d8a0"),o.addColorStop(1,"#8a6630"),i.fillStyle=o,i.beginPath(),i.arc(r,a,13,0,Math.PI*2),i.fill(),i.strokeStyle="rgba(60,40,16,0.7)",i.lineWidth=4,i.beginPath(),i.moveTo(r-7,a),i.lineTo(r+7,a),i.stroke()};s(44,38),s(e-44,38),s(44,t-38),s(e-44,t-38)})}function Sb(i){const e=pe("base"),{minX:t,maxX:n,minZ:s,maxZ:r}=k.bounds,a=n-t,o=r-s,l=(t+n)/2,c=(s+r)/2,h=a/2+.32,f=o/2+.32,p=I("#c9b8a8",{map:ub.wood(),rim:.06,rimColor:"#b98a55",gradient:"soft"}),u=Mb(a+.64,.85,o+.64,.1,p,{x:l,y:-.525,z:c,cast:!0,receive:!0,parent:e,seg:3});u.name="plinth";const g=C(a+.2,.05,o+.2,I("#0b0908",{rim:0}),{x:l,y:-.975,z:c,cast:!1,receive:!1,parent:e});g.name="felt";const y=I("#20242c",{rim:.1,rimColor:"#4a5b74"});C(a,.1,o,y,{x:l,y:-.05,z:c,cast:!0,receive:!0,parent:e}).name="ground-slab";const d=I(bt.brass,{rim:.35,rimColor:"#ffe1a8",emissive:"#3a2a10",emissiveIntensity:.35,gradient:"soft"}),m=.035,_=-.093;C(a+.24,.02,m,d,{x:l,y:_,z:s-.1,parent:e,cast:!1}),C(a+.24,.02,m,d,{x:l,y:_,z:r+.1,parent:e,cast:!1}),C(m,.02,o+.1,d,{y:_,x:t-.1,z:c,parent:e,cast:!1}),C(m,.02,o+.1,d,{y:_,x:n+.1,z:c,parent:e,cast:!1});const x=I("#ffffff",{map:bb(),rim:.2,rimColor:"#ffe6b0",emissive:"#2a1c08",emissiveIntensity:.5,gradient:"soft"}),v=5.6,E=r+.322,T=me(v,.66,x,{x:l,y:-.5,z:E,cast:!1,receive:!1,parent:e});T.name="nameplate",C(v+.12,.78,.03,I(bt.brassDark,{rim:.3,rimColor:"#ffd898",gradient:"soft"}),{x:l,y:-.5,z:E-.014,cast:!1,parent:e});for(const P of[l-v/2+.16,l+v/2-.16])for(const S of[-.72,-.28])ye(.028,.028,.02,8,I("#d9b671",{rim:.4,rimColor:"#fff0c0"}),{y:S,z:E+.012,x:P,rx:Math.PI/2,parent:e,cast:!1});const R=I(bt.brass,{rim:.3,rimColor:"#ffe3ac",gradient:"soft"});for(const P of[-1,1])for(const S of[-1,1]){const M=l+P*(h-.03),D=c+S*(f-.03);C(.16,.98,.16,R,{x:M,y:-.52,z:D,cast:!1,parent:e}),C(.2,.14,.2,R,{x:M,y:-.06,z:D,cast:!1,parent:e})}return Lt(e,{width:9e-4,color:"#07080d"}),e.traverse(P=>{P.isMesh&&P.layers.set(1)}),{group:e}}class Ec extends lt{constructor(e,t={}){super(e),this.isReflector=!0,this.type="Reflector",this.camera=new Jt;const n=this,s=t.color!==void 0?new re(t.color):new re(8355711),r=t.textureWidth||512,a=t.textureHeight||512,o=t.clipBias||0,l=t.shader||Ec.ReflectorShader,c=t.multisample!==void 0?t.multisample:4,h=new fi,f=new w,p=new w,u=new w,g=new Ye,y=new w(0,0,-1),d=new ot,m=new w,_=new w,x=new ot,v=new Ye,E=this.camera,T=new ln(r,a,{samples:c,type:Yn}),R=new At({name:l.name!==void 0?l.name:"unspecified",uniforms:vr.clone(l.uniforms),fragmentShader:l.fragmentShader,vertexShader:l.vertexShader});R.uniforms.tDiffuse.value=T.texture,R.uniforms.color.value=s,R.uniforms.textureMatrix.value=v,this.material=R,this.onBeforeRender=function(P,S,M){if(p.setFromMatrixPosition(n.matrixWorld),u.setFromMatrixPosition(M.matrixWorld),g.extractRotation(n.matrixWorld),f.set(0,0,1),f.applyMatrix4(g),m.subVectors(p,u),m.dot(f)>0)return;m.reflect(f).negate(),m.add(p),g.extractRotation(M.matrixWorld),y.set(0,0,-1),y.applyMatrix4(g),y.add(u),_.subVectors(p,y),_.reflect(f).negate(),_.add(p),E.position.copy(m),E.up.set(0,1,0),E.up.applyMatrix4(g),E.up.reflect(f),E.lookAt(_),E.far=M.far,E.updateMatrixWorld(),E.projectionMatrix.copy(M.projectionMatrix),v.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),v.multiply(E.projectionMatrix),v.multiply(E.matrixWorldInverse),v.multiply(n.matrixWorld),h.setFromNormalAndCoplanarPoint(f,p),h.applyMatrix4(E.matrixWorldInverse),d.set(h.normal.x,h.normal.y,h.normal.z,h.constant);const D=E.projectionMatrix;x.x=(Math.sign(d.x)+D.elements[8])/D.elements[0],x.y=(Math.sign(d.y)+D.elements[9])/D.elements[5],x.z=-1,x.w=(1+D.elements[10])/D.elements[14],d.multiplyScalar(2/d.dot(x)),D.elements[2]=d.x,D.elements[6]=d.y,D.elements[10]=d.z+1-o,D.elements[14]=d.w,n.visible=!1;const U=P.getRenderTarget(),B=P.xr.enabled,G=P.shadowMap.autoUpdate;P.xr.enabled=!1,P.shadowMap.autoUpdate=!1,P.setRenderTarget(T),P.state.buffers.depth.setMask(!0),P.autoClear===!1&&P.clear(),P.render(S,E),P.xr.enabled=B,P.shadowMap.autoUpdate=G,P.setRenderTarget(U);const Y=M.viewport;Y!==void 0&&P.state.viewport(Y),n.visible=!0},this.getRenderTarget=function(){return T},this.dispose=function(){T.dispose(),n.material.dispose()}}}Ec.ReflectorShader={name:"ReflectorShader",uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null}},vertexShader:`
		uniform mat4 textureMatrix;
		varying vec4 vUv;

		#include <common>
		#include <logdepthbuf_pars_vertex>

		void main() {

			vUv = textureMatrix * vec4( position, 1.0 );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

			#include <logdepthbuf_vertex>

		}`,fragmentShader:`
		uniform vec3 color;
		uniform sampler2D tDiffuse;
		varying vec4 vUv;

		#include <logdepthbuf_pars_fragment>

		float blendOverlay( float base, float blend ) {

			return( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );

		}

		vec3 blendOverlay( vec3 base, vec3 blend ) {

			return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );

		}

		void main() {

			#include <logdepthbuf_fragment>

			vec4 base = texture2DProj( tDiffuse, vUv );
			gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>

		}`};function wb(){return Ze(1024,1024,(i,e,t)=>{i.fillStyle="#232833",i.fillRect(0,0,e,t);const n=li(77);for(let s=0;s<26e3;s+=1){const r=n()*e,a=n()*t,o=22+n()*48;i.fillStyle=`rgba(${o+6},${o+8},${o+16},${.16+n()*.4})`;const l=n()*2.2+.4;i.fillRect(r,a,l,l)}for(let s=0;s<26;s+=1){const r=n()*e,a=n()*t,o=30+n()*160,l=i.createRadialGradient(r,a,0,r,a,o);l.addColorStop(0,`rgba(10,13,20,${.12+n()*.2})`),l.addColorStop(1,"rgba(10,13,20,0)"),i.fillStyle=l,i.beginPath(),i.arc(r,a,o,0,Math.PI*2),i.fill()}i.strokeStyle="rgba(10,13,20,0.4)";for(let s=0;s<36;s+=1){let r=n()*e,a=n()*t;i.lineWidth=.6+n()*1.2,i.beginPath(),i.moveTo(r,a);for(let o=0;o<4;o+=1)r+=(n()-.5)*48,a+=(n()-.5)*48,i.lineTo(r,a);i.stroke()}})}function Tb(){return Ze(1024,1024,(i,e,t)=>{i.fillStyle="#808080",i.fillRect(0,0,e,t);const n=li(1234);for(let s=0;s<70;s+=1){const r=n()*e,a=n()*t,o=36+n()*190,l=i.createRadialGradient(r,a,0,r,a,o),c=105+Math.floor(n()*95);l.addColorStop(0,`rgba(${c},${c},${c},${.1+n()*.16})`),l.addColorStop(1,"rgba(128,128,128,0)"),i.fillStyle=l,i.fillRect(r-o,a-o,o*2,o*2)}for(let s=0;s<12;s+=1){const r=n()*e,a=n()*t,o=40+n()*90,l=i.createRadialGradient(r,a,0,r,a,o);l.addColorStop(0,"rgba(255,255,255,0.9)"),l.addColorStop(.6,"rgba(225,225,225,0.55)"),l.addColorStop(1,"rgba(160,160,160,0)"),i.save(),i.translate(r,a),i.scale(1,.5+n()*.4),i.translate(-r,-a),i.fillStyle=l,i.beginPath(),i.arc(r,a,o,0,Math.PI*2),i.fill(),i.restore()}},{srgb:!1,anisotropy:4})}function Ab(){return Ze(1024,1024,(i,e,t)=>{i.fillStyle="#3b3b43",i.fillRect(0,0,e,t);const n=li(31),s=e/8;for(let r=0;r<8;r+=1)for(let a=0;a<8;a+=1){const o=46+Math.floor(n()*12);i.fillStyle=`rgb(${o+5},${o+5},${o+10})`,i.fillRect(a*s+2,r*s+2,s-4,s-4);for(let l=0;l<60;l+=1){const c=a*s+n()*s,h=r*s+n()*s;i.fillStyle=`rgba(20,22,28,${.05+n()*.08})`,i.fillRect(c,h,1.5,1.5)}}})}const Eb={name:"WetRoadShader",uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null},uAsphalt:{value:null},uWet:{value:null},uTime:{value:0},uReflectBoost:{value:1},uRain:{value:1},uAreaMin:{value:new $(k.bounds.minX,k.bounds.minZ)},uAreaSize:{value:new $(k.bounds.maxX-k.bounds.minX,k.bounds.maxZ-k.bounds.minZ)}},vertexShader:`
    uniform mat4 textureMatrix;
    varying vec4 vUvProj;
    varying vec3 vWorldPos;
    varying vec3 vViewDir;
    void main() {
      vec4 worldPos = modelMatrix * vec4( position, 1.0 );
      vWorldPos = worldPos.xyz;
      vViewDir = cameraPosition - worldPos.xyz;
      vUvProj = textureMatrix * vec4( position, 1.0 );
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,fragmentShader:`
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform sampler2D uAsphalt;
    uniform sampler2D uWet;
    uniform float uTime;
    uniform float uReflectBoost;
    uniform float uRain;
    uniform vec2 uAreaMin;
    uniform vec2 uAreaSize;
    varying vec4 vUvProj;
    varying vec3 vWorldPos;
    varying vec3 vViewDir;
    float hash21( vec2 p ) {
      p = fract( p * vec2( 234.34, 435.345 ) );
      p += dot( p, p + 34.23 );
      return fract( p.x * p.y );
    }
    void main() {
      vec2 uv = ( vWorldPos.xz - uAreaMin ) / uAreaSize;
      vec3 asphalt = texture2D( uAsphalt, uv ).rgb;
      float wet = texture2D( uWet, uv ).r;
      wet = clamp( wet * 1.25 - 0.15, 0.0, 1.0 );
      vec2 proj = vUvProj.xy / vUvProj.w;
      vec2 distort = vec2(
        sin( vWorldPos.z * 7.0 + uTime * 1.4 ),
        cos( vWorldPos.x * 6.0 - uTime * 1.1 )
      ) * ( 0.0011 + 0.0018 * wet ) * uRain;
      vec3 refl = vec3( 0.0 );
      float total = 0.0;
      for ( int i = 0; i < 5; i ++ ) {
        float fi = float( i ) - 2.0;
        vec2 off = proj + distort + vec2( fi * 0.0016, fi * 0.0065 * ( 0.35 + wet ) );
        float w = 1.0 - abs( fi ) * 0.16;
        refl += texture2D( tDiffuse, off ).rgb * w;
        total += w;
      }
      refl /= total;
      vec3 V = normalize( vViewDir );
      float fres = pow( 1.0 - clamp( V.y, 0.0, 1.0 ), 1.7 );
      float strength = mix( 0.13, 1.0, wet ) * ( 0.34 + fres * 1.15 ) * uReflectBoost;
      vec3 base = asphalt * color;
      base *= mix( 1.0, 0.52, wet );
      base += vec3( 0.012, 0.018, 0.035 ) * ( 1.0 - wet );
      float spark = step( 0.996, hash21( floor( vWorldPos.xz * 70.0 ) + floor( uTime * 20.0 ) ) );
      vec3 col = base + refl * strength + spark * wet * vec3( 0.10, 0.13, 0.16 );
      float stain = smoothstep( 0.35, 1.0, texture2D( uWet, uv * 2.3 + 0.37 ).r );
      col *= mix( 0.86, 1.0, stain );
      gl_FragColor = vec4( col, 1.0 );
    }
  `},Cb=`
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`,Rb=`
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec2 uv = vWorld.xz * vec2(1.6, 2.4);
    float w1 = sin(uv.x * 2.0 + uTime * 0.8) * 0.5 + 0.5;
    float w2 = sin(uv.y * 3.0 - uTime * 0.6 + w1 * 2.0) * 0.5 + 0.5;
    float ripple = smoothstep(0.86, 1.0, w1 * 0.6 + w2 * 0.4);
    vec3 deep = vec3(0.012, 0.03, 0.045);
    vec3 shallow = vec3(0.03, 0.075, 0.09);
    vec3 col = mix(deep, shallow, w2 * 0.7 + ripple * 0.25);
    // 远处灯光的细碎倒影
    float glow = smoothstep(0.55, 1.0, sin(uv.x * 1.3 - uTime * 0.2) * 0.5 + 0.5) * 0.12;
    col += vec3(1.0, 0.7, 0.45) * glow * 0.55;
    gl_FragColor = vec4(col, 0.94);
  }
`;function cm(){return I("#e4eaf2",{rim:.2,rimColor:"#9fbfe0",gradient:"tiny"})}function Xo(i,e,t,n,s,r=0,a=null){const o=me(e,t,a||cm(),{x:n,y:.008,z:s,rx:-Math.PI/2,rz:r,cast:!1,receive:!0,parent:i});return o.userData.roadMark=!0,o}function Uh(i,e,t,n,s,r,a,o=.12,l=.12){const c=t-e,h=s-n,f=(e+t)/2,p=(n+s)/2;C(c,l,h,a,{x:f,y:o-l/2,z:p,cast:!1,receive:!0,parent:i}).layers.set(1),me(c,h,r,{x:f,y:o+6e-4,z:p,rx:-Math.PI/2,cast:!1,receive:!0,parent:i})}function Pb(i){const e=pe("ground"),t=wb(),n=Tb(),s=Ab(),r=k.bounds,a=r.maxX-r.minX,o=r.maxZ-r.minZ,l=(r.minX+r.maxX)/2,c=(r.minZ+r.maxZ)/2,h=new Ec(new Ln(a,o),{clipBias:.002,textureWidth:i.quality?.isMobile?512:1024,textureHeight:i.quality?.isMobile?512:1024,multisample:0,shader:Eb,color:"#8f98aa"});h.rotation.x=-Math.PI/2,h.position.set(l,.002,c),h.name="wet-road";const f=h.material.uniforms;f.uAsphalt.value=t,f.uWet.value=n,f.uAreaMin.value.set(r.minX,r.minZ),f.uAreaSize.value.set(a,o),i.quality?.isMobile&&(f.uReflectBoost.value=1.4),e.add(h),t.colorSpace=Dt,n.colorSpace=Gn;const p=I("#9a9aa2",{map:s,rim:.14,rimColor:"#7f9cc0",gradient:"soft"});s.colorSpace=Dt;const u=I("#3a3a42",{rim:.12,rimColor:"#6f8fb4",gradient:"soft"}),g=[[r.minX,k.walk.west.maxX+0,r.minZ,k.walk.north.maxZ],[k.walk.east.minX+0,k.rail.minX,r.minZ,k.walk.north.maxZ],[r.minX,k.walk.west.maxX+0,k.walk.south.minZ,k.river.minZ],[k.walk.east.minX+0,k.rail.minX,k.walk.south.minZ,k.river.minZ]];for(const[ie,V,J,le]of g)Uh(e,ie,V,J,le,p,u);Uh(e,r.minX,k.rail.minX,k.river.maxZ,r.maxZ,p,u),Uh(e,k.rail.minX,r.maxX,r.minZ,k.river.minZ,I("#4a4742",{rim:.1,rimColor:"#8a8f96",gradient:"soft"}),u,.1,.1),I(bt.curb,{rim:.18,rimColor:"#a8c4e4",gradient:"soft"});const y=I(bt.curbTop,{rim:.16,rimColor:"#b8d4f0",gradient:"soft"}),d=(ie,V,J)=>{C(V-ie,.13,.09,p,{x:(ie+V)/2,y:.065,z:J,cast:!1,receive:!0,parent:e}),C(V-ie,.025,.11,y,{x:(ie+V)/2,y:.1325,z:J,cast:!1,receive:!0,parent:e})},m=(ie,V,J)=>{C(.09,.13,V-ie,p,{x:J,y:.065,z:(ie+V)/2,cast:!1,receive:!0,parent:e}),C(.11,.025,V-ie,y,{x:J,y:.1325,z:(ie+V)/2,cast:!1,receive:!0,parent:e})};d(r.minX,k.walk.west.maxX,k.walk.north.maxZ),d(k.walk.east.minX,k.rail.minX,k.walk.north.maxZ),d(r.minX,k.walk.west.maxX,k.walk.south.minZ),d(k.walk.east.minX,k.rail.minX,k.walk.south.minZ),m(r.minZ,k.walk.north.maxZ,k.walk.west.maxX),m(r.minZ,k.walk.north.maxZ,k.walk.east.minX),m(k.walk.south.minZ,k.river.minZ,k.walk.west.maxX),m(k.walk.south.minZ,k.river.minZ,k.walk.east.minX);const _=I("#1d2129",{rim:.1,rimColor:"#48607f",gradient:"soft"});for(const[ie,V,J]of[[r.minX,k.walk.west.maxX,k.road.ew.minZ+.2],[k.walk.east.minX,k.rail.minX,k.road.ew.minZ+.2],[r.minX,k.walk.west.maxX,k.road.ew.maxZ-.2],[k.walk.east.minX,k.rail.minX,k.road.ew.maxZ-.2]])me(V-ie-.2,.2,_,{x:(ie+V)/2,y:.006,z:J,rx:-Math.PI/2,cast:!1,receive:!0,parent:e});const x=cm(),v=(ie,V,J,le)=>{const oe=J/(le*2-1);for(let Le=0;Le<le;Le+=1){const Oe=V-J/2+(Le*2+.5)*oe;ie==="x"?Xo(e,oe,k.road.ew.maxZ-k.road.ew.minZ-.1,Oe,(k.road.ew.minZ+k.road.ew.maxZ)/2,0,x):Xo(e,k.road.ns.maxX-k.road.ns.minX-.1,oe,(k.road.ns.minX+k.road.ns.maxX)/2,Oe,0,x)}};v("x",(k.walk.west.minX+k.walk.west.maxX)/2,1,4),v("x",(k.walk.east.minX+k.walk.east.maxX)/2,1,4),v("y",(k.walk.north.minZ+k.walk.north.maxZ)/2,1,4),v("y",(k.walk.south.minZ+k.walk.south.maxZ)/2,1,4);const E=I("#e7edf5",{rim:.1,rimColor:"#9fb6cf",gradient:"tiny"});for(let ie=r.minX+.9;ie<r.maxX-.7;ie+=1.3)ie>-2.4&&ie<2.4||Xo(e,.6,.05,ie,(k.road.ew.minZ+k.road.ew.maxZ)/2,0,E);for(let ie=r.minZ+.9;ie<k.river.minZ-.6;ie+=1.3)ie>-2.3&&ie<3.7||Xo(e,.05,.6,(k.road.ns.minX+k.road.ns.maxX)/2,ie,0,E);const T=Ze(128,128,(ie,V,J)=>{ie.fillStyle="#bca052",ie.fillRect(0,0,V,J),ie.fillStyle="#8d7433";for(let le=8;le<J;le+=16)for(let oe=8;oe<V;oe+=16)ie.beginPath(),ie.arc(oe,le,4.2,0,Math.PI*2),ie.fill()}),R=I("#ffffff",{map:T,rim:.1,rimColor:"#d8b870",gradient:"tiny"});for(const[ie,V,J,le]of[[-1.6,-1,.9,.28],[1.6,-1,.9,.28],[-1.6,2.2,.9,.28],[1.6,2.2,.9,.28],[3.9,-1,2.4,.28],[-4.2,2.2,2.4,.28]])me(J,le,R,{x:ie,y:.1225,z:V,rx:-Math.PI/2,cast:!1,receive:!0,parent:e});const P=Ze(256,256,(ie,V,J)=>{ie.fillStyle="#3c414c",ie.beginPath(),ie.arc(V/2,J/2,V*.46,0,Math.PI*2),ie.fill(),ie.strokeStyle="#1b1e25",ie.lineWidth=5;for(let le=28;le<V*.44;le+=26)ie.beginPath(),ie.arc(V/2,J/2,le,0,Math.PI*2),ie.stroke()}),S=I("#ffffff",{map:P,rim:.15,rimColor:"#8fa8c8",gradient:"soft"});for(const[ie,V]of[[-.5,.9],[4.4,.4],[-3.8,.2],[.4,4.8]])me(.65,.65,S,{x:ie,y:.011,z:V,rx:-Math.PI/2,cast:!1,receive:!0,parent:e});const M=new At({uniforms:{uTime:{value:0}},vertexShader:Cb,fragmentShader:Rb,transparent:!0,depthWrite:!1,fog:!1}),D=me(k.rail.minX-r.minX,k.river.maxZ-k.river.minZ,M,{x:(r.minX+k.rail.minX)/2,y:k.river.y,z:(k.river.minZ+k.river.maxZ)/2,rx:-Math.PI/2,cast:!1,receive:!1,parent:e});D.userData.noOutline=!0;const U=I("#6b6f72",{rim:.12,rimColor:"#9fb8d8",gradient:"soft"});for(const ie of[k.river.minZ-.04,k.river.maxZ+.04])C(k.rail.minX-r.minX,.4,.12,U,{x:(r.minX+k.rail.minX)/2,y:.02,z:ie,cast:!1,receive:!0,parent:e}),C(k.rail.minX-r.minX,.04,.2,I("#8a8d84",{rim:.12}),{x:(r.minX+k.rail.minX)/2,y:.24,z:ie,cast:!1,receive:!0,parent:e});me(k.rail.minX-r.minX,k.river.maxZ-k.river.minZ,I("#0d1a20",{rim:0}),{x:(r.minX+k.rail.minX)/2,y:-.1,z:(k.river.minZ+k.river.maxZ)/2,rx:-Math.PI/2,cast:!1,receive:!1,parent:e}),C(k.rail.maxX-k.rail.minX,.06,k.river.minZ-r.minZ,I("#3f3b36",{rim:.1}),{x:(k.rail.minX+k.rail.maxX)/2,y:.09,z:(r.minZ+k.river.minZ)/2,cast:!1,receive:!0,parent:e}).layers.set(1);const G=I("#4a3a2c",{rim:.1});for(let ie=r.minZ+.2;ie<k.river.minZ-.1;ie+=.36)C(.72,.045,.14,G,{x:k.rail.minX+.34,y:.125,z:ie,cast:!1,receive:!0,parent:e});const Y=I("#9aa2ab",{rim:.3,rimColor:"#e6f2ff",gradient:"soft"});for(const ie of[-.16,.16])C(.045,.05,k.river.minZ-r.minZ-.2,Y,{x:k.rail.minX+.34+ie,y:.16,z:(r.minZ+k.river.minZ)/2,cast:!0,receive:!0,parent:e});const W=Ze(256,256,(ie,V,J)=>{const le=ie.createRadialGradient(V/2,J/2,0,V/2,J/2,V/2);le.addColorStop(0,"rgba(150,190,255,0.55)"),le.addColorStop(.5,"rgba(90,130,210,0.3)"),le.addColorStop(1,"rgba(20,30,60,0)"),ie.fillStyle=le,ie.beginPath(),ie.ellipse(V/2,J/2,V*.47,J*.4,0,0,Math.PI*2),ie.fill()}),te=new De({map:W,transparent:!0,opacity:.55,depthWrite:!1,color:"#7d9cc4",fog:!1}),X=[[-4.7,2.2,.9,.36,.8],[-2.9,1.9,.7,.3,1.6],[2.6,2.3,.8,.34,.2],[5.4,2.1,.9,.32,1.2],[3,-1.1,1,.34,.6],[-3.4,-1,.8,.3,1.4],[-6.7,-1,.7,.28,.4],[6.1,-1.1,.8,.3,1.8],[-.4,1,1.4,.55,.3],[.5,4.3,1,.4,1.1],[-4.9,4.9,.8,.32,.9]];for(const[ie,V,J,le,oe]of X){const Le=me(1,1,te.clone(),{x:ie,y:.123,z:V,rx:-Math.PI/2,rz:oe,cast:!1,receive:!1,parent:e});Le.scale.set(J,le,1),Le.userData.noOutline=!0}const de=Ze(512,256,(ie,V,J)=>{ie.clearRect(0,0,V,J);const le=li(88);for(let oe=0;oe<26;oe+=1){const Le=le()*V,Oe=6+le()*34,Ge=40+le()*200,Ke=ie.createLinearGradient(0,J,0,J-Ge);Ke.addColorStop(0,`rgba(255,206,140,${.12+le()*.2})`),Ke.addColorStop(.6,`rgba(255,220,170,${.08+le()*.12})`),Ke.addColorStop(1,"rgba(255,220,170,0)"),ie.fillStyle=Ke,ie.fillRect(Le,J-Ge,Oe,Ge)}}),ve=new De({map:de,transparent:!0,opacity:.5,depthWrite:!1,blending:In,fog:!1}),ge=[[3.9,-.2,3.6,1.3,.55],[-1.85,3.85,.9,1.9,.42],[-1.85,5.8,.9,1.8,.38],[-5.9,2.4,2.6,1,.26],[3,6,2.4,1,.22],[5.6,6.1,2,1,.28]];for(const[ie,V,J,le,oe]of ge){const Le=me(J,le,ve.clone(),{x:ie,y:.1228,z:V,rx:-Math.PI/2,cast:!1,receive:!1,parent:e});Le.material.opacity=oe,Le.userData.noOutline=!0}const Xe=h.material.uniforms;return i.handles.ground={reflector:h},{group:e,reflector:h,update(ie){Xe.uTime.value=ie,M.uniforms.uTime.value=ie}}}function Ib(){const i={uTime:{value:0},uTint:{value:new re("#9fd6d8")},uReflect:{value:.3}};return{material:new At({uniforms:i,transparent:!0,depthWrite:!1,side:Pn,vertexShader:`
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vNormal = normalize( normalMatrix * normal );
        vec4 mv = modelViewMatrix * vec4( position, 1.0 );
        vViewPos = - mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,fragmentShader:`
      uniform float uTime;
      uniform vec3 uTint;
      uniform float uReflect;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;

      void main() {
        vec3 n = normalize( vNormal );
        vec3 v = normalize( vViewPos );
        float fres = pow( 1.0 - clamp( dot( n, v ), 0.0, 1.0 ), 3.2 );

        // 灯箱在玻璃上的斜向柔光反光
        float streak = smoothstep( 0.78, 1.0, 1.0 - abs( fract( vUv.y * 1.35 + vUv.x * 0.28 ) - 0.5 ) * 2.0 );
        float streak2 = smoothstep( 0.86, 1.0, 1.0 - abs( fract( vUv.y * 0.72 - vUv.x * 0.12 + 0.3 ) - 0.5 ) * 2.0 );

        // 顶部雨棚暖光映在玻璃上沿
        float warmTop = smoothstep( 0.55, 1.0, vUv.y ) * 0.10;

        vec3 color = mix( uTint * 0.75, vec3( 0.78, 0.93, 1.0 ), fres * 0.7 );
        color += vec3( 0.9, 0.96, 1.0 ) * ( streak * 0.1 + streak2 * 0.06 ) * uReflect;
        color += vec3( 1.0, 0.75, 0.45 ) * warmTop * uReflect * 0.6;

        float alpha = 0.018 + fres * 0.12 * uReflect + streak * 0.018 + streak2 * 0.012 + warmTop * 0.22;
        gl_FragColor = vec4( color, alpha );
      }
    `}),uniforms:i}}function ip(i,e,t,n={}){const s=pe("door-panel"),r=I(bt.frame,{rim:.18,rimColor:"#a8c8e0",gradient:"soft"}),a=.045,o=.05;C(i,a*1.4,o,r,{y:e/2-a*.7,parent:s,cast:!0,receive:!0}),C(i,a*1.4,o,r,{y:-e/2+a*.7,parent:s,cast:!0,receive:!0}),C(a,e,o,r,{x:-i/2+a/2,parent:s,cast:!0,receive:!0}),C(a,e,o,r,{x:i/2-a/2,parent:s,cast:!0,receive:!0});const l=me(i-a*2,e-a*2,t.material,{z:.002,cast:!1,receive:!1,parent:s});l.userData.isGlass=!0;const c=I("#b7bcc4",{rim:.3,rimColor:"#eaf4ff",gradient:"soft"}),h=n.handleSide==="left"?-i*.3:i*.3;for(const p of[.055,-.055])ye(.014,.014,.46,10,c,{x:h,y:-.06,z:p,parent:s,cast:!1}),C(.03,.03,.08,c,{x:h,y:.17,z:p*.6,parent:s,cast:!1}),C(.03,.03,.08,c,{x:h,y:-.29,z:p*.6,parent:s,cast:!1});const f=me(.2,.1,gt("#ffffff",{map:Rn.doorSticker(),transparent:!0,alphaTest:.05}),{x:-.02,y:.52,z:.04,cast:!1,receive:!1,parent:s});return f.userData.noOutline=!0,s}function Db(i){const{handles:e}=i,t=pe("store"),n=We.store,s=n.interior,r=n.wallTopY-We.lot.top,a=(We.lot.top+n.wallTopY)/2,o=(n.minX+n.maxX)/2,l=(n.minZ+n.maxZ)/2,c=n.maxX-n.minX,h=n.maxZ-n.minZ,f=I(bt.wall,{rim:.16,rimColor:"#9fc4e8",gradient:"soft"}),p=I(bt.wallShade,{rim:.14,rimColor:"#9fc4e8",gradient:"soft"}),u=I(bt.kick,{rim:.14,rimColor:"#7f9ec4",gradient:"soft"}),g=I(bt.frame,{rim:.2,rimColor:"#a8c8e0",gradient:"soft"}),y=I(bt.roof,{rim:.14,rimColor:"#9fb4d0",gradient:"soft"});I(bt.roofDark,{rim:.1,rimColor:"#8aa2c0",gradient:"soft"});const d=I("#a9aeb6",{rim:.22,rimColor:"#e8f2ff",gradient:"soft"}),m=I("#e2eae6",{rim:.26,rimColor:"#b8d8ee",gradient:"soft",transparent:!0,opacity:.94,side:St});C(.18,r,h,f,{x:n.minX+.09,y:a,z:l,parent:t}),C(c,r,.18,f,{x:o,y:a,z:n.minZ+.09,parent:t}),C(.18,r,h,f,{x:n.maxX-.09,y:a,z:l,parent:t});for(const j of[-3.7,-2.4,-1.1,.2])C(.012,r-.2,.03,p,{x:n.maxX+.002,y:a+.02,z:j,parent:t,cast:!1});C(.02,.3,h,u,{x:n.maxX+.003,y:We.lot.top+.15,z:l,parent:t,cast:!1}),C(.02,.12,h,g,{x:n.maxX+.004,y:n.wallTopY-.3,z:l,parent:t,cast:!1});for(const j of[-3.9,-2.4,-.9,.6])C(.012,r-.2,.03,p,{x:n.minX-.002,y:a+.02,z:j,parent:t,cast:!1});C(n.doorX1-n.minX+.18,.33,.18,u,{x:(n.minX+n.doorX1)/2+.02,y:We.lot.top+.165,z:n.maxZ-.09,parent:t}),C(n.doorX1-n.minX+.2,.035,.2,g,{x:(n.minX+n.doorX1)/2+.02,y:We.lot.top+.35,z:n.maxZ-.09,parent:t,cast:!1}),C(c,n.wallTopY-n.fasciaY0,.18,f,{x:o,y:(n.fasciaY0+n.wallTopY)/2,z:n.maxZ-.09,parent:t}),C(c,.05,.2,g,{x:o,y:n.fasciaY0+.02,z:n.maxZ-.08,parent:t,cast:!1}),C(.18,n.fasciaY0-We.lot.top,.18,g,{x:n.minX+.09,y:(We.lot.top+n.fasciaY0)/2,z:n.maxZ-.09,parent:t}),C(.18,n.fasciaY0-We.lot.top,.18,g,{x:n.maxX-.09,y:(We.lot.top+n.fasciaY0)/2,z:n.maxZ-.09,parent:t}),C(.1,n.fasciaY0-We.lot.top,.18,g,{x:(n.windowX1+n.doorX0)/2,y:(We.lot.top+n.fasciaY0)/2,z:n.maxZ-.09,parent:t});const _=Ib();e.glass=_;const x=n.windowX1-n.windowX0,v=n.glassY1-n.glassY0,E=(n.glassY0+n.glassY1)/2,T=(n.windowX0+n.windowX1)/2,R=me(x,v,_.material,{x:T,y:E,z:n.maxZ-.11,cast:!1,receive:!1,parent:t});R.userData.isGlass=!0;for(const j of[-1.62,-.51])C(.05,v,.07,g,{x:j,y:E,z:n.maxZ-.09,parent:t,cast:!1});C(x,.06,.08,g,{x:T,y:n.glassY0+.03,z:n.maxZ-.09,parent:t,cast:!1}),C(x,.055,.08,g,{x:T,y:n.glassY1-.02,z:n.maxZ-.09,parent:t,cast:!1}),C(.07,n.fasciaY0-We.lot.top,.2,g,{x:n.doorX0-.035,y:(We.lot.top+n.fasciaY0)/2,z:n.maxZ-.09,parent:t}),C(.07,n.fasciaY0-We.lot.top,.2,g,{x:n.doorX1+.035,y:(We.lot.top+n.fasciaY0)/2,z:n.maxZ-.09,parent:t}),C(n.doorX1-n.doorX0+.14,.07,.2,g,{x:(n.doorX0+n.doorX1)/2,y:n.fasciaY0-.03,z:n.maxZ-.09,parent:t}),C(n.doorX1-n.doorX0+.2,.028,.34,d,{x:(n.doorX0+n.doorX1)/2,y:We.lot.top+.014,z:n.maxZ+.08,parent:t,cast:!1});const P=(n.doorX1-n.doorX0)/2-.005,S=n.glassY1-n.glassY0,M=ip(P,S,_,{handleSide:"right"}),D=ip(P,S,_,{handleSide:"left"}),U=n.maxZ-.06;M.position.set((n.doorX0+n.doorX1)/2-P/2-.003,E,U),D.position.set((n.doorX0+n.doorX1)/2+P/2+.003,E,U),t.add(M,D),e.door={left:M,right:D,closedX:[M.position.x,D.position.x],openX:[M.position.x-P-.03,D.position.x+P+.03],y:E,z:U},C(.24,.1,.12,I("#2c3340",{rim:.15,rimColor:"#7f9ec4"}),{x:(n.doorX0+n.doorX1)/2,y:n.fasciaY0-.1,z:n.maxZ+.02,parent:t,cast:!1}),C(.07,.025,.07,gt(new re("#ff9d6b").multiplyScalar(1.4)),{x:(n.doorX0+n.doorX1)/2,y:n.fasciaY0-.11,z:n.maxZ+.07,parent:t,cast:!1});const B=C(c-.34,.045,.05,new De({color:new re("#ffe1b4").multiplyScalar(1.5)}),{x:o,y:n.fasciaY0-.04,z:n.maxZ+.035,parent:t,cast:!1});B.userData.noOutline=!0;const G=zt(Rn.mainSign(),1.68,{side:St}),Y=o,W=(n.sign.y0+n.sign.y1)/2;C(n.sign.x1-n.sign.x0+.1,n.sign.y1-n.sign.y0+.12,.14,I("#2b3b5b",{rim:.2,rimColor:"#8fb4dd",gradient:"soft"}),{x:Y,y:W,z:n.sign.z+.05,parent:t,cast:!0});const te=me(n.sign.x1-n.sign.x0,n.sign.y1-n.sign.y0,G,{x:Y,y:W,z:n.sign.z+.125,cast:!1,receive:!1,parent:t});te.name="main-sign",te.userData.noOutline=!0;const X=I("#c9ced8",{rim:.25,rimColor:"#f2f8ff",gradient:"soft"}),de=n.sign.x1-n.sign.x0,ve=n.sign.y1-n.sign.y0;C(de+.12,.04,.06,X,{x:Y,y:W+ve/2+.02,z:n.sign.z+.13,parent:t,cast:!1}),C(de+.12,.04,.06,X,{x:Y,y:W-ve/2-.02,z:n.sign.z+.13,parent:t,cast:!1}),C(.04,ve+.08,.06,X,{x:Y-de/2-.04,y:W,z:n.sign.z+.13,parent:t,cast:!1}),C(.04,ve+.08,.06,X,{x:Y+de/2+.04,y:W,z:n.sign.z+.13,parent:t,cast:!1});const ge=pe("canopy"),Xe=n.canopy.x1-n.canopy.x0,ie=n.canopy.z1-n.canopy.z0,V=(n.canopy.x0+n.canopy.x1)/2,J=C(Xe,n.canopy.thickness,ie,m,{x:V,y:n.canopy.y,z:(n.canopy.z0+n.canopy.z1)/2,rx:.055,parent:ge});J.castShadow=!1;const le=I("#c3c9d1",{rim:.24,rimColor:"#eef6ff",gradient:"soft"});C(Xe+.04,.06,.055,le,{x:V,y:n.canopy.y-.02,z:n.canopy.z0+.03,parent:ge,cast:!1}),C(Xe+.04,.06,.055,le,{x:V,y:n.canopy.y-.055,z:n.canopy.z1-.03,parent:ge,cast:!1}),C(.055,.06,ie,le,{x:n.canopy.x0+.03,y:n.canopy.y-.04,z:(n.canopy.z0+n.canopy.z1)/2,parent:ge,cast:!1}),C(.055,.06,ie,le,{x:n.canopy.x1-.03,y:n.canopy.y-.04,z:(n.canopy.z0+n.canopy.z1)/2,parent:ge,cast:!1});for(const j of[-.55,.35,1.25])C(.04,.035,ie-.1,le,{x:j,y:n.canopy.y-.065,z:(n.canopy.z0+n.canopy.z1)/2,parent:ge,cast:!1});for(const j of[-1.05,.25,1.55]){const $e=ye(.022,.022,1.28,8,le,{x:j,y:n.canopy.y+.22,z:n.canopy.z1-.52,rx:39*mb,parent:ge,cast:!1});$e.rotation.z=0}const oe=new De({color:new re("#ffdca6").multiplyScalar(1.8)}),Le=C(Xe-.2,.03,.045,oe,{x:V,y:n.canopy.y-.1,z:n.canopy.z1-.12,parent:ge,cast:!1});Le.userData.noOutline=!0;for(const j of[-.8,.35,1.45])ye(.05,.055,.05,12,gt("#fff0cf"),{x:j,y:n.canopy.y-.11,z:n.canopy.z1-.42,parent:ge,cast:!1});t.add(ge);const Oe=pe("pylon");Oe.position.set(We.pylon.x,We.pylon.baseY,We.pylon.z),C(.56,.22,.56,I("#6b6f78",{rim:.14,rimColor:"#9db8d8"}),{y:.11,parent:Oe}),ye(.085,.1,2,12,d,{y:1.12,parent:Oe});const Ge=zt(Rn.pylonSign(),1.58,{side:St});C(1.02,2.6,.22,I("#efe8d6",{rim:.18,rimColor:"#ffd9a0",gradient:"soft"}),{x:0,y:3,z:0,parent:Oe}),me(.94,2.48,Ge,{y:3,z:.113,cast:!1,receive:!1,parent:Oe}),me(.94,2.48,Ge,{y:3,z:-.113,ry:Math.PI,cast:!1,receive:!1,parent:Oe}),C(1.08,.12,.26,I("#2b3b5b",{rim:.18,rimColor:"#8fb4dd"}),{y:4.36,parent:Oe}),C(1.08,.08,.26,I("#3fa8a0",{rim:.2,rimColor:"#8ff0e8"}),{y:1.68,parent:Oe}),t.add(Oe),C(c+.12,.16,h+.12,y,{x:o,y:n.wallTopY+.08,z:l,parent:t});const Ke=.24,ne=n.wallTopY+.16+Ke/2;C(c+.2,Ke,.1,f,{x:o,y:ne,z:n.minZ-.04,parent:t,cast:!1}),C(c+.2,Ke,.1,f,{x:o,y:ne,z:n.maxZ+.04,parent:t,cast:!1}),C(.1,Ke,h+.2,f,{x:n.minX-.04,y:ne,z:l,parent:t,cast:!1}),C(.1,Ke,h+.2,f,{x:n.maxX+.04,y:ne,z:l,parent:t,cast:!1});const ue=I("#c7cbd2",{rim:.24,rimColor:"#eaf4ff",gradient:"soft"});C(c+.26,.04,.14,ue,{x:o,y:ne+Ke/2+.02,z:n.minZ-.04,parent:t,cast:!1}),C(c+.26,.04,.14,ue,{x:o,y:ne+Ke/2+.02,z:n.maxZ+.04,parent:t,cast:!1}),C(.14,.04,h+.26,ue,{x:n.minX-.04,y:ne+Ke/2+.02,z:l,parent:t,cast:!1}),C(.14,.04,h+.26,ue,{x:n.maxX+.04,y:ne+Ke/2+.02,z:l,parent:t,cast:!1});const z=I("#4d5563",{rim:.14,rimColor:"#8fb0d4",gradient:"soft"});C(.92,2.05,.06,z,{x:.86,y:We.lot.top+1.025,z:n.minZ-.02,parent:t,cast:!1}),C(.98,.06,.1,I("#8d939c"),{x:.86,y:We.lot.top+2.08,z:n.minZ-.02,parent:t,cast:!1}),C(.16,.08,.12,I("#5a606b"),{x:.86,y:We.lot.top+2.35,z:n.minZ-.04,parent:t,cast:!1}),C(.11,.035,.09,gt(new re("#ffc987").multiplyScalar(1.3)),{x:.86,y:We.lot.top+2.31,z:n.minZ-.06,parent:t,cast:!1});for(let j=0;j<5;j+=1)C(.6,.03,.03,d,{x:-1.55,y:We.lot.top+1.3+j*.09,z:n.minZ-.03,parent:t,cast:!1});ye(.055,.055,3.2,10,d,{x:n.minX+.12,y:We.lot.top+1.6,z:n.minZ-.08,parent:t,cast:!1}),ye(.07,.07,.18,10,d,{x:n.minX+.12,y:n.wallTopY-.1,z:n.minZ-.08,parent:t,cast:!1}),C(.06,1.95,.82,z,{x:n.minX-.03,y:We.lot.top+.975,z:-3.15,parent:t,cast:!1}),C(.1,.06,.9,I("#8d939c"),{x:n.minX-.03,y:We.lot.top+1.98,z:-3.15,parent:t,cast:!1}),C(.12,.07,.16,I("#5a606b"),{x:n.minX-.06,y:We.lot.top+2.28,z:-3.15,parent:t,cast:!1}),C(.08,.03,.1,gt(new re("#ffc987").multiplyScalar(1.3)),{x:n.minX-.09,y:We.lot.top+2.24,z:-3.15,parent:t,cast:!1}),C(s.maxX-s.minX,.03,s.maxZ-s.minZ,I("#8d8678",{rim:.1,rimColor:"#c8b58e"}),{x:(s.minX+s.maxX)/2,y:We.lot.top+.01,z:(s.minZ+s.maxZ)/2,parent:t,cast:!1});const Fe=C(s.maxX-s.minX,.06,s.maxZ-s.minZ,I(bt.interiorCeil,{rim:.06,rimColor:"#ffe9c4",gradient:"soft"}),{x:(s.minX+s.maxX)/2,y:s.ceilY+.03,z:(s.minZ+s.maxZ)/2,parent:t,cast:!1,receive:!0});Fe.userData.isCeil=!0;const he=me(.44,.62,new De({map:Rn.glassPosterOden(),transparent:!1,fog:!0}),{x:-2.46,y:1.02,z:n.maxZ-.096,cast:!1,receive:!1,parent:t});he.rotation.z=-.035;const Pe=me(.3,.44,new De({map:Rn.glassPosterCoffee(),transparent:!1,fog:!0}),{x:.5,y:1.42,z:n.maxZ-.096,cast:!1,receive:!1,parent:t});Pe.rotation.z=.025;for(const j of[he,Pe]){j.userData.noOutline=!0,j.renderOrder=2;const $e=new De({color:"#f0eee1",transparent:!0,opacity:.55,depthWrite:!1,fog:!1});for(const ce of[.4,-.4]){const Ee=me(.16,.05,$e,{x:0,y:ce,z:.002,cast:!1,receive:!1,parent:j});Ee.userData.noOutline=!0}}const xe=Ze(512,256,(j,$e,ce)=>{j.clearRect(0,0,$e,ce),j.fillStyle="rgba(255,255,255,0.95)",j.font=`700 66px ${Re}`,j.textAlign="center",j.textBaseline="middle",j.fillText("24時間営業",$e/2,60),j.font=`600 46px ${Re}`,j.fillText("ATM・コピー機",$e/2,135),j.font=`600 34px ${Re}`,j.fillStyle="rgba(255,255,255,0.8)",j.fillText("防犯カメラ作動中",$e/2,200)}),qe=new De({map:xe,transparent:!0,opacity:.9,depthWrite:!1,fog:!1}),Ie=me(.6,.3,qe,{x:.24,y:2.18,z:n.maxZ-.094,cast:!1,receive:!1,parent:t});Ie.userData.noOutline=!0;const L=Ze(1024,128,(j,$e,ce)=>{const Ee=j.createLinearGradient(0,0,0,ce);Ee.addColorStop(0,"#f8f1dc"),Ee.addColorStop(1,"#efe3c8"),j.fillStyle=Ee,j.fillRect(0,0,$e,ce),j.fillStyle="#3fa8a0",j.fillRect(0,0,$e,14),j.fillStyle="#20304f",j.font=`700 62px ${ht}`,j.textAlign="center",j.textBaseline="middle",j.letterSpacing="12px",j.fillText("TSUKIMI MART · 24H",$e/2,ce/2+4),j.letterSpacing="0px"}),b=new De({map:L,fog:!1});b.color.setScalar(1.18);const H=me(Xe-.08,.16,b,{x:V,y:n.canopy.y-.075,z:n.canopy.z1+.012,cast:!1,receive:!1,parent:t});H.userData.noOutline=!0,e.flickerMats=e.flickerMats||[],e.flickerMats.push({mat:b,base:1.18});const Q=Yt("#ffc27a",2.2,.08);Q.position.set((n.doorX0+n.doorX1)/2,1.15,n.maxZ+.55),t.add(Q),e.flickerMats=e.flickerMats||[],e.flickerMats.push({mat:G,base:1.12},{mat:Ge,base:1.15},{mat:oe,base:1.8}),e.dripPoints=e.dripPoints||[];for(const j of[-1.15,-.6,-.05,.5,1.05,1.6])e.dripPoints.push(new w(j,n.canopy.y-.06,n.canopy.z1-.02));e.dripPoints.push(new w(-2.2,n.sign.y0-.05,n.sign.z+.16)),e.dripPoints.push(new w(.9,n.sign.y0-.05,n.sign.z+.16)),e.dripPoints.push(new w(-1.8,n.wallTopY+.18,n.maxZ+.12)),e.dripPoints.push(new w(1.2,n.wallTopY+.18,n.maxZ+.12));const ae=Yt("#ffd9a0",5.2,.12);ae.position.set(Y,W,n.sign.z+.7),t.add(ae);const ee=Yt("#ffc987",3,.09);ee.position.set(0,2.25,1.7),t.add(ee);const Ne=Yt("#ffd9a0",3,.1);Ne.position.set(We.pylon.x,3.1,We.pylon.z+.4),t.add(Ne);const be=Yt("#ffb066",1.8,.16);return be.position.set(.86,We.lot.top+2.3,n.minZ-.2),t.add(be),ru(t,!0,!0),t.traverse(j=>{(j.userData.isGlass||j.isSprite)&&(j.castShadow=!1,j.receiveShadow=!1)}),Lt(t,{width:.0011,color:"#080b14"}),{group:t,update(j){_.uniforms.uTime.value=j}}}const Ut=We.store.interior,Me=Ut.floorY,Pi=Ut.ceilY,hm=(Ut.minX+Ut.maxX)/2;function Lb(){return Ze(1024,1024,(i,e,t)=>{i.fillStyle="#cec8b8",i.fillRect(0,0,e,t);const n=li(202),s=4,r=e/s;for(let o=0;o<s;o+=1)for(let l=0;l<s;l+=1){const c=196+Math.floor(n()*16);i.fillStyle=`rgb(${c},${c-4},${c-16})`,i.fillRect(l*r+3,o*r+3,r-6,r-6);for(let h=0;h<120;h+=1){const f=l*r+n()*r,p=o*r+n()*r;i.fillStyle=`rgba(120,110,92,${.03+n()*.05})`,i.fillRect(f,p,2,2)}}const a=i.createRadialGradient(e*.86,t*.9,0,e*.86,t*.9,e*.3);a.addColorStop(0,"rgba(110,100,84,0.16)"),a.addColorStop(1,"rgba(110,100,84,0)"),i.fillStyle=a,i.fillRect(0,0,e,t)},{repeat:[2.2,2.7]})}function zb(i){const e=[{bg:"#e9d8bd",accent:"#d95f46",title:"アニメ",sub:"冬の新作"},{bg:"#20304f",accent:"#ffc96b",title:"週刊 旅",sub:"雪の温泉"},{bg:"#a8d8c8",accent:"#204a4a",title:"カー",sub:"NEW MODEL"},{bg:"#f2d7d0",accent:"#7a3f52",title:"neko",sub:"ねこの本"},{bg:"#f4e6c8",accent:"#3fa8a0",title:"料理",sub:"冬の煮込み"},{bg:"#404a68",accent:"#f2b0c0",title:"音楽",sub:"LIVE 2026"}],t=e[i%e.length];return Ze(256,360,(n,s,r)=>{n.fillStyle=t.bg,n.fillRect(0,0,s,r),n.fillStyle=t.accent,n.fillRect(0,0,s,18),n.fillStyle="#20304f",n.font=`700 44px ${Re}`,n.textAlign="left",n.fillText(t.title,18,78),n.font=`600 20px ${ht}`,n.fillStyle="rgba(32,48,79,0.7)",n.fillText(t.sub,20,110),n.fillStyle=t.accent,n.beginPath(),n.arc(s*.5,r*.5,s*.28,0,Math.PI*2),n.fill(),n.fillStyle="rgba(255,255,255,0.75)",n.beginPath(),n.arc(s*.56,r*.47,s*.16,0,Math.PI*2),n.fill(),n.fillStyle="rgba(32,48,79,0.8)",n.fillRect(20,r*.72,s-40,10),n.fillRect(20,r*.77,(s-40)*.7,8),n.fillStyle=t.accent,n.fillRect(0,r-36,s,36),n.fillStyle="#fbf3dd",n.font=`700 24px ${Re}`,n.fillText("月見町 書店",16,r-12)})}function fm(i,e,t){return Ze(768,192,(n,s,r)=>{n.fillStyle=t,n.fillRect(0,0,s,r),n.fillStyle="rgba(255,255,255,0.16)",n.fillRect(0,0,18,r),n.fillStyle="#f7f6ec",n.font=`700 88px ${Re}`,n.textAlign="center",n.textBaseline="middle",n.fillText(i,s/2+20,r/2-8),n.font=`600 26px ${ht}`,n.fillStyle="rgba(247,246,236,0.72)",n.letterSpacing="6px",n.fillText(e,s/2+20,r/2+58),n.letterSpacing="0px",n.fillStyle="#ffc96b",n.beginPath(),n.arc(72,r/2,30,0,Math.PI*2),n.fill(),n.fillStyle=t,n.beginPath(),n.arc(84,r/2-8,26,0,Math.PI*2),n.fill()})}function sp(){return Ze(256,192,(i,e,t)=>{i.fillStyle="#182a2a",i.fillRect(0,0,e,t),i.strokeStyle="#3f6f6a",i.lineWidth=4,i.strokeRect(6,6,e-12,t-12),i.fillStyle="#9fe8d8",i.font=`600 24px ${Re}`,i.fillText("つきみマート",20,46),i.fillStyle="#c8f2e8",i.font=`700 30px ${Re}`,i.fillText("おにぎり  ¥140",20,92),i.fillText("コーヒー  ¥100",20,130),i.fillStyle="#ffd26a",i.font=`700 26px ${Re}`,i.fillText("合計  ¥240",20,168)})}function rp(){return Ze(256,384,(i,e,t)=>{i.fillStyle="#1f3f66",i.fillRect(0,0,e,t),i.fillStyle="#f4efe0",i.font=`700 52px ${ht}`,i.textAlign="center",i.fillText("ATM",e/2,76),i.fillStyle="#7fe8e0",i.fillRect(28,100,e-56,4),i.fillStyle="rgba(244,239,224,0.85)",i.font=`500 22px ${Re}`,i.fillText("お引き出し",e/2,150),i.fillText("お預け入れ",e/2,186),i.fillStyle="#ffc96b",wt(i,52,220,e-104,58,10),i.fill(),i.fillStyle="#20304f",i.font=`700 26px ${Re}`,i.fillText("24時間",e/2,258),i.fillStyle="rgba(127,232,224,0.7)",i.font=`600 18px ${Re}`,i.fillText("月見銀行",e/2,330)})}function Ub(){return Ze(1024,192,(i,e,t)=>{const n=i.createLinearGradient(0,0,e,0);n.addColorStop(0,"#2b5fa8"),n.addColorStop(.5,"#3f8ac0"),n.addColorStop(1,"#2b5fa8"),i.fillStyle=n,i.fillRect(0,0,e,t),i.fillStyle="#f7f4e8",i.font=`700 86px ${Re}`,i.textAlign="center",i.textBaseline="middle",i.fillText("つめた〜い ドリンク",e/2,t/2-4),i.fillStyle="#b9efff",i.font=`600 26px ${ht}`,i.letterSpacing="10px",i.fillText("COLD DRINKS",e/2,t/2+58),i.letterSpacing="0px"})}function um(){return Ze(512,512,(i,e,t)=>{i.fillStyle="#f6efe0",i.fillRect(0,0,e,t),i.fillStyle="#20304f",i.fillRect(0,0,e,86),i.fillStyle="#ffc96b",i.font=`700 46px ${Re}`,i.fillText("カウンターコーヒー",28,58);const n=[["ブレンド M","¥100"],["ブレンド L","¥150"],["カフェラテ","¥180"],["ホットココア","¥150"]];i.fillStyle="#20304f",n.forEach(([s,r],a)=>{const o=180+a*78;i.font=`600 40px ${Re}`,i.fillText(s,32,o),i.fillStyle="#ff7a5e",i.font=`700 40px ${ht}`,i.textAlign="right",i.fillText(r,e-32,o),i.textAlign="left",i.fillStyle="#20304f",i.strokeStyle="rgba(32,48,79,0.2)",i.lineWidth=2,i.beginPath(),i.moveTo(32,o+20),i.lineTo(e-32,o+20),i.stroke()}),i.fillStyle="#3fa8a0",i.font=`600 22px ${Re}`,i.fillText("店内で挽きたてをどうぞ",32,t-32)})}function Nb(){return Ze(256,384,(i,e,t)=>{i.fillStyle="#4b5360",i.fillRect(0,0,e,t),i.strokeStyle="rgba(255,255,255,0.14)",i.lineWidth=6,i.strokeRect(14,14,e-28,t-28),i.fillStyle="#f2ecdc",i.font=`700 30px ${ht}`,i.textAlign="center",i.fillText("STAFF ONLY",e/2,160),i.font=`500 22px ${Re}`,i.fillStyle="rgba(242,236,220,0.7)",i.fillText("関係者以外",e/2,210),i.fillText("立入禁止",e/2,242),i.fillStyle="rgba(160,210,220,0.5)",i.fillRect(56,60,e-112,60)})}function Ob(){return Ze(512,512,(i,e,t)=>{i.fillStyle="#e7e2d4",i.fillRect(0,0,e,t),i.fillStyle="#20304f",i.fillRect(0,0,e,64),i.fillStyle="#fbf3dd",i.font=`700 34px ${Re}`,i.fillText("たばこ",24,44);const n=["#c94a3e","#3f7ac0","#e2b04a","#5aa86a","#7c5fb0","#d87a3a"];for(let s=0;s<4;s+=1)for(let r=0;r<6;r+=1)i.fillStyle=n[(s*6+r)%n.length],i.fillRect(20+r*80,96+s*100,68,78),i.fillStyle="rgba(255,255,255,0.5)",i.fillRect(28+r*80,118+s*100,52,8)})}function Fb(){return Ze(512,256,(i,e,t)=>{i.clearRect(0,0,e,t),i.strokeStyle="rgba(255,111,156,0.9)",i.lineWidth=7,i.beginPath(),i.arc(e/2,t/2,96,0,Math.PI*2),i.stroke(),i.fillStyle="#ffb3c8",i.font=`700 104px ${ht}`,i.textAlign="center",i.textBaseline="middle",i.fillText("OPEN",e/2,t/2-2),i.fillStyle="rgba(127,232,224,0.95)",i.font=`600 40px ${ht}`,i.fillText("24 HOURS",e/2,t/2+78)})}function Bb(){return Ze(512,256,(i,e,t)=>{i.fillStyle="#f7f2e4",i.fillRect(0,0,e,t),i.fillStyle="#ff7a5e",i.fillRect(0,0,e,16),i.fillRect(0,t-16,e,16),i.fillStyle="#20304f",i.font=`700 74px ${Re}`,i.textAlign="center",i.textBaseline="middle",i.fillText("いらっしゃいませ",e/2,t/2-8),i.fillStyle="#3fa8a0",i.font=`600 26px ${ht}`,i.letterSpacing="8px",i.fillText("TSUKIMI MART",e/2,t/2+64),i.letterSpacing="0px"})}function kb(){return Ze(512,512,(i,e,t)=>{i.clearRect(0,0,e,t),i.fillStyle="rgba(240,196,92,0.55)",i.fillRect(e/2-12,0,24,t*.62),i.beginPath(),i.moveTo(e/2-40,t*.52),i.lineTo(e/2+40,t*.52),i.lineTo(e/2,t*.68),i.closePath(),i.fill(),i.save(),i.translate(e/2,t*.82),i.fillStyle="rgba(240,196,92,0.75)",i.font=`700 64px ${Re}`,i.textAlign="center",i.fillText("レジ",0,0),i.restore()})}function Vb(){return Ze(384,768,(i,e,t)=>{const n=i.createLinearGradient(0,0,0,t);n.addColorStop(0,"#7a2f24"),n.addColorStop(1,"#b8492f"),i.fillStyle=n,i.fillRect(0,0,e,t),i.strokeStyle="rgba(251,243,221,0.35)",i.lineWidth=8,i.strokeRect(10,10,e-20,t-20),i.fillStyle="#ffc96b",i.beginPath(),i.arc(e/2,150,66,0,Math.PI*2),i.fill(),i.fillStyle="#7a2f24",i.beginPath(),i.arc(e/2+24,132,62,0,Math.PI*2),i.fill(),i.fillStyle="#fbf3dd",i.textAlign="center",i.font=`700 58px ${Re}`,i.fillText("おでん",e/2,340),i.fillText("はじめました",e/2,410),i.font=`600 30px ${Re}`,i.fillStyle="rgba(251,243,221,0.8)",i.fillText("だいこん・たまご・ちくわ",e/2,510),i.fillStyle="#ffc96b",wt(i,52,580,e-104,96,16),i.fill(),i.fillStyle="#5c231c",i.font=`700 46px ${Re}`,i.fillText("全品 70円",e/2,644)})}const Vl=["#f2ead6","#1fae9e","#f2b32b","#e0473a","#2f6fd0","#8fd06a","#f2e2b0","#b45fd0","#f5f1e6","#3fc0d8"],ap=["#e84a3a","#f2b32b","#1fae8e","#2f6fd0","#c84a9a","#f2e6c8","#3fc0d8","#f09a2a","#b8342a","#7ac04a","#e05a8a"];function Hb(i,e){const t=li(4242),n=[],s=[],r=[],a=[],o=[],l=[],c=[],h=[-1,-1.95,-2.9],f=.34,p=-2.15,u=.05,g=[.12,.46,.8,1.14],y={box:.13,can:.11,bottle:.17};for(const U of h)for(let B=0;B<g.length;B+=1)for(const G of[-1,1]){const Y=U+G*(f/2-.06);let W=p+.14;const te=B===0?"box":B===1?"can":"box";for(;W<u-.08;){if(t()>.1){const X=ap[Math.floor(t()*ap.length)],de=(t()-.5)*.015;te==="box"?n.push({x:W,y:Me+g[B]+.5*y.box,z:Y+de,ry:(t()-.5)*.24,color:X,s:.8+t()*.35}):te==="can"?s.push({x:W,y:Me+g[B]+.5*y.can,z:Y+de,ry:t()*6.28,color:X}):r.push({x:W,y:Me+g[B]+.5*y.bottle,z:Y+de,ry:t()*6.28,color:X})}W+=.075+t()*.02}}const d=[{x0:-2.64,x1:-1.72},{x0:-1.68,x1:-.78},{x0:-.74,x1:.2}];for(const U of d)for(let G=0;G<5;G+=1){const Y=Me+.28+G*.38;for(let W=U.x0+.12;W<U.x1-.08;W+=.083)if(t()>.14){const te=t()>.45,X={x:W,y:Y,z:-4.32+t()*.06,ry:0,color:Vl[Math.floor(t()*Vl.length)]};(te?r:s).push(X)}}const m=-2.42,_=-.72;for(let U=0;U<3;U+=1){const B=Me+.35+U*.34;for(let G=m;G<_;G+=.19)t()>.18&&a.push({x:-2.5+t()*.06,y:B,z:G,ry:Math.PI/2+(t()-.5)*.1,color:["#f2e6d2","#e8d6b8","#d8b48a","#f5efe2"][Math.floor(t()*4)]})}for(let U=0;U<14;U+=1)o.push({x:-2.46+t()*.08,y:Me+1.08,z:m+U/14*(_-m),ry:Math.PI/2});for(let U=0;U<4;U+=1)c.push({x:-2.56+U*.21,y:Me+.83,z:.72,i:U,rot:-.24}),c.push({x:-2.56+U*.21,y:Me+.55,z:.77,i:U+2,rot:0});for(let U=0;U<9;U+=1)l.push({x:.98,y:Me+1.03+U*.012,z:-3.72,r:.032});const x=new Dn(.086,.15,.052),v=new Xn(.028,.028,.11,8),E=new Xn(.024,.026,.17,8),T=new Dn(.16,.055,.115),R=new Xn(.065,.065,.038,3),P=new Xn(.03,.024,.045,10),S=I("#ffffff",{gradient:"soft",rim:.05,rimColor:"#fff2d0",emissive:"#221607",emissiveIntensity:.22});S.vertexColors=!1;function M(U,B,G={}){if(!B.length)return null;const Y=new Ar(U,S,B.length),W=new Ye,te=new w,X=new en,de=new w,ve=new Mn;return B.forEach((ge,Xe)=>{te.set(ge.x,ge.y,ge.z),ve.set(ge.rx||0,ge.ry||0,ge.rz||0),X.setFromEuler(ve),de.set(ge.s||1,ge.s||1,ge.s||1),W.compose(te,X,de),Y.setMatrixAt(Xe,W),Y.setColorAt(Xe,new re(ge.color||"#ffffff"))}),Y.instanceMatrix.needsUpdate=!0,Y.instanceColor&&(Y.instanceColor.needsUpdate=!0),Y.computeBoundingSphere(),Y.castShadow=G.cast??!0,Y.receiveShadow=!0,i.add(Y),Y}M(x,n),M(v,s),M(E,r),M(T,a),M(R,o),M(P,l);const D=pe("magazines");for(const U of c){const B=zb(U.i),G=me(.17,.24,new De({map:B,fog:!0}),{x:U.x,y:U.y,z:U.z+.045,cast:!1,receive:!1,parent:D});G.rotation.x=U.rot?-.2:0,G.userData.noOutline=!0}i.add(D)}function Gb(i){const e=pe("gondola"),t=I("#e8dfcc",{rim:.12,rimColor:"#ffe9c4",gradient:"soft",emissive:"#33200e",emissiveIntensity:.3}),n=I("#c8bfa8",{rim:.1,rimColor:"#e8d8b8",gradient:"soft"});I("#c8c2b4",{rim:.1,rimColor:"#e8d8b8",gradient:"soft"});const s=-2.15,r=.05,a=r-s,o=(s+r)/2,l=.34,c=[.12,.46,.8,1.14],h=[-1,-1.95,-2.9],f=[],p=["#e85f4a","#f2b544","#3fa8a0","#4f7fd0","#d86fa8","#f0e8d8"];for(const y of h){C(a,.1,l+.06,n,{x:o,y:Me+.05,z:y,parent:e}),C(a,1.28,.05,t,{x:o,y:Me+.72,z:y,parent:e});for(const d of[s,r])C(.05,1.4,l+.05,t,{x:d,y:Me+.7,z:y,parent:e}),C(.07,.05,l+.09,n,{x:d,y:Me+1.41,z:y,parent:e});for(const d of c)C(a,.028,l,t,{x:o,y:Me+d,z:y,parent:e});for(const d of c)for(const m of[-1,1])C(a-.08,.014,.018,new De({color:new re("#ffefc8").multiplyScalar(2.1)}),{x:o,y:Me+d-.018,z:y+m*(l/2+.006),parent:e,cast:!1,receive:!1});for(const d of c)for(const m of[-1,1])for(let _=s+.18;_<r-.05;_+=.19)f.push({x:_,y:Me+d+.005,z:y+m*(l/2+.012),color:p[f.length%p.length]});C(a-.1,.06,.05,new De({color:new re("#fff3d6").multiplyScalar(1.35)}),{x:o,y:Me+1.37,z:y,parent:e,cast:!1});for(const[d,m]of[[s-.08,-1],[r+.08,1]]){C(.14,1.05,l+.16,t,{x:d,y:Me+.55,z:y,parent:e});const _=["#ef6f5e","#f4c65a","#7ac7a6","#5e9fe0"];for(let x=0;x<4;x+=1)C(.1,.12,.1,I(_[x%_.length],{gradient:"soft"}),{x:d,y:Me+.5+x%2*.24,z:y-.12+Math.floor(x/2)*.24,parent:e,cast:!1})}}const u=[Rn.posterMoonDango(),Rn.posterOnigiri()];let g=0;for(const y of h)for(const d of[-1.55,-.55]){const m=me(.2,.28,new De({map:u[g%2],fog:!0}),{x:d,y:Me+1.62,z:y+.1,cast:!1,receive:!1,parent:e});m.scale.set(.75,.75,.75),m.rotation.z=(d+y)*.05,m.userData.noOutline=!0,g+=1}if(f.length){const y=new Dn(.055,.032,.012),d=I("#ffffff",{gradient:"tiny",rim:0}),m=new Ar(y,d,f.length),_=new Ye,x=new en,v=new w(1,1,1),E=new w;f.forEach((T,R)=>{E.set(T.x,T.y,T.z),x.identity(),_.compose(E,x,v),m.setMatrixAt(R,_),m.setColorAt(R,new re(T.color))}),m.instanceMatrix.needsUpdate=!0,m.instanceColor&&(m.instanceColor.needsUpdate=!0),m.computeBoundingSphere(),m.castShadow=!1,m.receiveShadow=!1,e.add(m)}return i.add(e),Lt(e,{width:85e-5,color:"#0d1220"}),e}function Wb(i){const e=pe("cooler"),t=I("#dfe3e0",{rim:.16,rimColor:"#a8d8e8",gradient:"soft"}),n=I("#3b4148",{rim:.12,rimColor:"#7f9ec4"}),s=new De({color:new re("#fff4dc").multiplyScalar(.85)}),r=new De({color:"#bfe8f0",transparent:!0,opacity:.18,depthWrite:!1}),a=[{x0:-2.64,x1:-1.72},{x0:-1.68,x1:-.78},{x0:-.74,x1:.2}],o=-3.98,l=-4.42,c=2.08,h=Me;C(3.1,c,.1,t,{x:-1.22,y:h+c/2,z:l+.03,parent:e}),C(3.16,.12,.5,n,{x:-1.22,y:h+c+.03,z:o+.12,parent:e}),C(3.16,.1,.5,n,{x:-1.22,y:h+.05,z:o+.12,parent:e});for(const p of[-2.67,.23])C(.06,c,.46,t,{x:p,y:h+c/2,z:o+.1,parent:e});me(3,c-.16,s,{x:-1.22,y:h+c/2,z:l+.085,cast:!1,receive:!1,parent:e});for(let p=0;p<5;p+=1){const u=h+.28+p*.38;me(3,.34,r,{x:-1.22,y:u,z:o+.06,rx:-Math.PI/2,cast:!1,receive:!1,parent:e})}for(const p of a){const u=(p.x0+p.x1)/2,g=p.x1-p.x0,y=new De({color:"#cbeef2",transparent:!0,opacity:.12,depthWrite:!1,side:St});me(g-.06,c-.2,y,{x:u,y:h+c/2,z:o,cast:!1,receive:!1,parent:e}),C(.045,c-.1,.05,t,{x:p.x0+.01,y:h+c/2,z:o,parent:e,cast:!1}),C(.045,c-.1,.05,t,{x:p.x1-.01,y:h+c/2,z:o,parent:e,cast:!1}),C(g-.02,.045,.05,t,{x:u,y:h+c-.08,z:o,parent:e,cast:!1}),ye(.012,.012,.6,8,I("#c8ccd2",{rim:.3,rimColor:"#f2faff"}),{x:u+g*.32,y:h+1.1,z:o+.035,parent:e,cast:!1})}const f=me(2.9,.42,zt(Ub(),1.05),{x:-1.22,y:h+c+.25,z:o+.12,cast:!1,receive:!1,parent:e});return f.userData.noOutline=!0,C(3.12,.03,.02,gt("#cfe0e8"),{x:-1.22,y:h+c+.02,z:o+.34,parent:e,cast:!1}),i.add(e),Lt(e,{width:85e-5,color:"#0d1220"}),e}function Xb(i){const e=pe("bento-fridge"),t=I("#eef0e8",{rim:.14,rimColor:"#ffe8c0",gradient:"soft"}),n=-2.42,s=-.72,r=(n+s)/2,a=1.42,o=.34,l=-2.55;C(o,a,s-n,t,{x:l,y:Me+a/2,z:r,parent:e}),me(s-n-.1,a-.2,new De({color:new re("#fff0d8").multiplyScalar(.5)}),{x:l+o/2+.001,y:Me+a/2,z:r,ry:Math.PI/2,cast:!1,receive:!1,parent:e});for(let h=0;h<3;h+=1){const f=Me+.24+h*.34;C(.3,.025,s-n-.12,I("#dfe8e4"),{x:l+.03,y:f,z:r,parent:e,cast:!1}),C(.03,.07,s-n-.12,I("#c8d0cc"),{x:l+o/2,y:f+.035,z:r,parent:e,cast:!1})}const c=me(s-n-.1,.26,zt(Rn.aisleSign(),1.2),{x:l+o/2+.06,y:Me+a+.18,z:r,ry:Math.PI/2,cast:!1,receive:!1,parent:e});return c.userData.noOutline=!0,i.add(e),Lt(e,{width:85e-5,color:"#0d1220"}),e}function Yb(i){const e=pe("magazine-rack"),t=I("#f0ece2",{rim:.12,rimColor:"#ffe9c4",gradient:"soft"}),n=-2.62,s=-1.7,r=.6;return C(s-n,.8,.34,t,{x:(n+s)/2,y:Me+.4,z:r,parent:e}),C(s-n-.04,.03,.38,I("#d8d2c4"),{x:(n+s)/2,y:Me+.78,z:r+.02,rx:-.4,parent:e,cast:!1}),C(s-n,.05,.03,t,{x:(n+s)/2,y:Me+.85,z:r+.19,parent:e,cast:!1}),i.add(e),Lt(e,{width:85e-5,color:"#0d1220"}),e}function Zb(i){const e=pe("front-display"),t=I("#a98d6b",{rim:.14,rimColor:"#ffd9a0",gradient:"soft"}),n=I("#f2eee4",{rim:.1,rimColor:"#ffe9c4",gradient:"soft"});C(1.15,.58,.4,n,{x:-.95,y:Me+.29,z:.52,parent:e}),C(1.2,.04,.44,t,{x:-.95,y:Me+.6,z:.52,parent:e}),C(1.1,.03,.02,gt("#3fa8a0"),{x:-.95,y:Me+.55,z:.73,parent:e,cast:!1});const s=["#f2e6d2","#e8d6b8","#f5efe2"];for(let a=0;a<3;a+=1){C(.28,.08,.2,I(s[a],{rim:.08}),{x:-1.3+a*.3,y:Me+.66,z:.48,parent:e,cast:!1});for(let o=0;o<3;o+=1)C(.07,.02,.06,I(["#d8684a","#f0c86a","#7ac7a6"][o]),{x:-1.36+a*.3+o%2*.09,y:Me+.71,z:.44+Math.floor(o/2)*.08,parent:e,cast:!1})}for(let a=0;a<2;a+=1)for(let o=0;o<5;o+=1)ye(.042,.046,.2,8,I(Vl[(o+a*3)%Vl.length],{rim:.12}),{x:-1.48+o*.13,y:Me+.72,z:.6+a*.1,parent:e,cast:!1}),ye(.018,.02,.05,6,I("#d8d8d0"),{x:-1.48+o*.13,y:Me+.83,z:.6+a*.1,parent:e,cast:!1});const r=me(.26,.18,zt(Rn.posterOnigiri(),.9),{x:-.62,y:Me+.72,z:.7,cast:!1,receive:!1,parent:e});r.userData.noOutline=!0,i.add(e),Lt(e,{width:85e-5,color:"#0d1220"})}function qb(i,e){const t=pe("counter"),n=I("#ece6d6",{rim:.12,rimColor:"#ffe9c0",gradient:"soft"}),s=I("#6d6255",{rim:.16,rimColor:"#d8b080",gradient:"soft"}),r=I("#b7bcc4",{rim:.22,rimColor:"#f2faff",gradient:"soft"}),a=I("#343a44",{rim:.1,rimColor:"#7f9ec4"}),o=.15,l=1.45,c=-2.9,h=-3.38,f=.98,p=(o+l)/2;C(l-o,f-.08,c-h,n,{x:p,y:Me+(f-.08)/2,z:(c+h)/2,parent:t}),C(l-o+.08,.06,c-h+.1,s,{x:p,y:Me+f,z:(c+h)/2,parent:t}),C(l-o-.1,.03,.02,new De({color:new re("#ffe0b0").multiplyScalar(1.2)}),{x:p,y:Me+.12,z:c+.01,parent:t,cast:!1});for(const D of[o,l])C(.04,f,c-h,n,{x:D,y:Me+f/2,z:(c+h)/2,parent:t});const u=pe("register");u.position.set(1.16,Me+f+.06,-3.12),C(.3,.12,.26,a,{y:.06,parent:u}),C(.26,.2,.04,a,{y:.2,z:.08,rx:-.2,parent:u});const g=sp();me(.22,.16,new De({map:g,fog:!1}),{y:.2,z:.101,rx:-.2,cast:!1,receive:!1,parent:u}),C(.24,.02,.14,a,{y:.13,z:-.02,parent:u});for(let D=0;D<8;D+=1)C(.025,.008,.02,I("#c8ccd2"),{x:-.09+D%4*.06,y:.143,z:-.05+Math.floor(D/4)*.05,parent:u,cast:!1});const y=me(.12,.2,zt(sp(),.8),{x:1.36,y:Me+f+.28,z:-2.96,ry:-.35,cast:!1,receive:!1,parent:t});y.userData.noOutline=!0,C(.04,.3,.03,r,{x:1.36,y:Me+f+.14,z:-2.98,parent:t,cast:!1}),C(.12,.05,.16,a,{x:.96,y:Me+f+.09,z:-2.96,parent:t}),C(.16,.05,.1,a,{x:.78,y:Me+f+.09,z:-2.96,parent:t}),C(.05,.24,.05,r,{x:1.38,y:Me+f+.12,z:-3.3,parent:t,cast:!1}),me(.08,.18,new De({color:"#f8f4e8"}),{x:1.38,y:Me+f+.02,z:-3.26,rx:-.14,cast:!1,receive:!1,parent:t});const d=pe("oden");d.position.set(.62,Me+f+.04,-3.08);const m=I("#8f949c",{rim:.3,rimColor:"#e8f2ff",gradient:"soft"});C(.44,.05,.3,m,{parent:d}),C(.42,.14,.28,I("#b8bcc4",{rim:.22,rimColor:"#f0f8ff"}),{y:.02,parent:d}),me(.37,.23,new De({color:new re("#c98a3a")}),{y:.1,rx:-Math.PI/2,cast:!1,receive:!1,parent:d});for(const D of[-.15,0,.15])C(.012,.09,.26,m,{x:D,y:.05,parent:d,cast:!1});for(const D of[-.09,.09])C(.37,.09,.012,m,{y:.05,z:D,parent:d,cast:!1});const _=[[-.19,-.09,"#f2e2b8"],[-.19,.09,"#f2e2b8"],[.05,.09,"#e8cfa0"],[.18,-.02,"#b8693f"],[.05,-.1,"#f5edda"],[-.02,0,"#f2e8d8"],[.2,.08,"#d8a060"]];for(const[D,U,B]of _)D>.15?iu(.03,.012,8,12,I(B),{x:D,y:.08,z:U,rx:Math.PI/2,parent:d,cast:!1}):tn(.033,I(B,{rim:.1}),{x:D,y:.07,z:U,parent:d,cast:!1});C(.48,.16,.34,new De({color:"#d8eef0",transparent:!0,opacity:.14,depthWrite:!1,side:St}),{y:.2,parent:d,cast:!1}),ye(.03,.03,.12,8,m,{x:.22,y:.16,z:.1,parent:d,cast:!1}),Lt(d,{width:8e-4,color:"#0d1220"}),t.add(d);const x=pe("hot-snack");x.position.set(.26,Me+f+.06,-3.14);const v=I("#4f5560",{rim:.16,rimColor:"#a8c0dc"});C(.36,.28,.28,v,{y:.14,parent:x}),C(.32,.2,.24,new De({color:"#ffe8c0",transparent:!0,opacity:.18,depthWrite:!1}),{y:.15,parent:x,cast:!1});for(let D=0;D<10;D+=1){const U=D%2?"#d88a3a":"#c4702a";C(.055,.045,.055,I(U),{x:-.11+D%4*.07,y:.08+Math.floor(D/4)*.06,z:-.06+D%2*.08,parent:x,cast:!1})}C(.4,.04,.32,v,{y:.3,parent:x}),Lt(x,{width:8e-4,color:"#0d1220"}),t.add(x);const E=pe("coffee");E.position.set(1.18,Me+f+.06,-3.86),C(.5,.12,.42,n,{y:.06,parent:E}),C(.48,.62,.36,I("#3f4650",{rim:.16,rimColor:"#8fb4dd"}),{y:.42,parent:E});const T=me(.3,.2,new De({map:um(),fog:!1}),{y:.58,z:.19,cast:!1,receive:!1,parent:E});T.userData.noOutline=!0,C(.12,.16,.1,a,{y:.24,z:.16,parent:E}),C(.28,.04,.22,r,{y:.1,z:.18,parent:E,cast:!1}),C(.04,.12,.04,a,{y:.16,z:.16,parent:E,cast:!1}),ye(.045,.045,.22,10,I("#f2ecdc"),{x:-.16,y:.24,z:.16,parent:E,cast:!1}),C(.42,.03,.05,new De({color:"#ffd9a0"}),{y:.83,z:-.1,parent:E,cast:!1}),Lt(E,{width:8e-4,color:"#0d1220"}),t.add(E);const R=me(1,1,zt(Ob(),.98),{x:1.42,y:Me+1.55,z:-3.3,ry:-Math.PI/2,cast:!1,receive:!1,parent:t});R.userData.noOutline=!0,C(1.04,1.06,.06,I("#d8d2c4"),{x:1.46,y:Me+1.55,z:-3.3,ry:-Math.PI/2,parent:t,cast:!1});const P=fm("レジ・お会計","CASHIER","#2b5fa8"),S=me(1.2,.3,zt(P,1.3),{x:.85,y:2.12,z:-2.95,cast:!1,receive:!1,parent:t});S.userData.noOutline=!0;for(const D of[.38,1.32])ye(.008,.008,.32,6,r,{x:D,y:2.32,z:-2.95,parent:t,cast:!1});const M=me(.5,.34,new De({map:Rn.aFrame(),fog:!0}),{x:.62,y:Me+.58,z:c+.011,cast:!1,receive:!1,parent:t});return M.userData.noOutline=!0,i.add(t),Lt(t,{width:85e-5,color:"#0d1220"}),e.steamSources=e.steamSources||[],e.steamSources.push(new w(.62,Me+f+.22,-3.08)),e.steamSources.push(new w(1.18,Me+f+.5,-3.7)),t}function $b(i){const e=pe("ice-freezer"),t=I("#e8f2f4",{rim:.12,rimColor:"#9fd8e8",gradient:"soft"}),n=I("#3f8ac0",{rim:.14,rimColor:"#9fd8ff",gradient:"soft"}),s=new De({color:"#c8ecf2",transparent:!0,opacity:.16,depthWrite:!1,side:St});C(.78,.78,.4,t,{x:-.03,y:Me+.39,z:-2.72,parent:e}),C(.8,.06,.42,n,{x:-.03,y:Me+.79,z:-2.72,parent:e}),me(.72,.34,s,{x:-.03,y:Me+.76,z:-2.72,rx:-Math.PI/2,cast:!1,receive:!1,parent:e});const r=["#f2e8d0","#f2b0c8","#8fd0e8","#f2d070","#b8a0e0","#f5f1e6"];for(let o=0;o<10;o+=1)C(.06,.03,.09,I(r[o%r.length],{gradient:"tiny"}),{x:-.27+o%5*.13,y:Me+.63,z:-2.82+Math.floor(o/5)*.13,parent:e,cast:!1});const a=me(.3,.16,zt(Rn.sticker(),.8),{x:-.03,y:Me+.45,z:-2.518,cast:!1,receive:!1,parent:e});a.userData.noOutline=!0,i.add(e),Lt(e,{width:8e-4,color:"#0d1220"})}function Kb(i){const e=pe("atm"),t=I("#dcd8cc",{rim:.12,rimColor:"#b8d8f0",gradient:"soft"}),n=I("#3a404a",{rim:.12}),s=1.4,r=-1.35;C(.32,1.85,.72,t,{x:s,y:Me+.925,z:r,parent:e}),C(.34,.1,.76,n,{x:s,y:Me+1.86,z:r,parent:e});const a=me(.5,.4,new De({map:rp(),fog:!1}),{x:s-.165,y:Me+1.32,z:r,ry:-Math.PI/2,cast:!1,receive:!1,parent:e});a.userData.noOutline=!0;const o=me(.6,.22,zt(rp(),1),{x:s-.17,y:Me+2,z:r,ry:-Math.PI/2,cast:!1,receive:!1,parent:e});o.userData.noOutline=!0;for(let l=0;l<3;l+=1)for(let c=0;c<3;c+=1)C(.03,.03,.03,I("#c8ccd2"),{x:s-.17,y:Me+.86-l*.07,z:r-.22+c*.07,parent:e,cast:!1});i.add(e),Lt(e,{width:85e-5,color:"#0d1220"})}function Jb(i){const e=pe("copier"),t=I("#e8e4d8",{rim:.12,rimColor:"#b8d8f0",gradient:"soft"}),n=I("#454b55",{rim:.1}),s=1.36,r=.32;C(.42,.95,.56,t,{x:s,y:Me+.475,z:r,parent:e}),C(.46,.1,.6,n,{x:s,y:Me+.98,z:r,parent:e});const a=me(.22,.16,new De({color:"#2b4a66"}),{x:s-.22,y:Me+1.04,z:r+.1,ry:-Math.PI/2,cast:!1,receive:!1,parent:e});a.userData.noOutline=!0,C(.03,.06,.4,n,{x:s-.23,y:Me+.6,z:r,parent:e,cast:!1}),i.add(e),Lt(e,{width:85e-5,color:"#0d1220"})}function jb(i){const e=pe("ceiling"),t=new De({color:new re("#ffe0aa").multiplyScalar(1.6)}),n=I("#cdc8bc",{rim:.08,rimColor:"#e8d8b0",gradient:"soft"}),s=[.3,-1.15,-2.55,-3.85];for(const o of s){C(3.3,.06,.24,n,{x:-.8,y:Pi-.04,z:o,parent:e,cast:!1}),C(3.16,.035,.16,t,{x:-.8,y:Pi-.075,z:o,parent:e,cast:!1});const l=Yt("#ffd9a0",1.4,.07);l.position.set(-.8,Pi-.2,o),e.add(l)}C(3.5,.05,.12,t,{x:-.75,y:Pi-.1,z:.72,parent:e,cast:!1});for(const o of[-2.2,-1.1,0,1.1]){const l=Yt("#ffe0b0",1.2,.06);l.position.set(o,Pi-.25,.7),e.add(l)}for(const[o,l]of[[-2.3,-3.5],[1.2,-1.2]]){C(.5,.03,.4,I("#b8bcc4"),{x:o,y:Pi-.01,z:l,parent:e,cast:!1});for(let c=0;c<5;c+=1)C(.42,.01,.02,I("#8d929a"),{x:o,y:Pi-.026,z:l-.14+c*.07,parent:e,cast:!1})}tn(.07,I("#e8e4d8"),{x:1.2,y:Pi-.12,z:.4,parent:e,cast:!1}),ye(.02,.02,.1,8,I("#9aa0a8"),{x:1.2,y:Pi-.03,z:.4,parent:e,cast:!1}),i.add(e);const r=[{label:"お菓子・スナック",en:"SNACKS",color:"#2b5fa8",x:-1.7,z:-1},{label:"おにぎり・お弁当",en:"RICE & BENTO",color:"#2f7a62",x:-1.7,z:-1.95},{label:"飲み物・日用品",en:"DRINKS & GOODS",color:"#8a4a2b",x:-1.7,z:-2.9}],a=I("#9aa0a8",{rim:.2,rimColor:"#e8f2ff"});for(const o of r){const l=fm(o.label,o.en,o.color),c=me(1.16,.28,zt(l,1),{x:o.x,y:2.14,z:o.z,cast:!1,receive:!1,parent:e});c.userData.noOutline=!0;for(const h of[-.45,.45])ye(.008,.008,.38,6,a,{x:o.x+h,y:2.38,z:o.z,parent:e,cast:!1})}i.add(e)}function Qb(i){const e=pe("walls"),t=me(.52,1,new De({map:Vb(),fog:!0}),{x:.25,y:1.86,z:.62,cast:!1,receive:!1,parent:e});t.userData.noOutline=!0;const n=I("#c4b69c",{rim:.08,rimColor:"#ffe2b8",gradient:"soft",emissive:"#2a1a0c",emissiveIntensity:.25});me(.02,Ut.maxZ-Ut.minZ-.04,n,{x:Ut.minX+.012,y:1,z:(Ut.minZ+Ut.maxZ)/2,ry:Math.PI/2,cast:!1,receive:!0,parent:e}),me(.02,Ut.maxZ-Ut.minZ-.04,n,{x:Ut.maxX-.012,y:1,z:(Ut.minZ+Ut.maxZ)/2,ry:-Math.PI/2,cast:!1,receive:!0,parent:e}),me(Ut.maxX-Ut.minX-.04,.5,n,{x:hm,y:2.32,z:Ut.minZ+.012,ry:0,cast:!1,receive:!0,parent:e});const s=me(.66,.92,new De({map:Rn.posterOnigiri(),fog:!0}),{x:-2.7,y:1.9,z:-3.45,ry:Math.PI/2,cast:!1,receive:!1,parent:e});s.userData.noOutline=!0;const r=me(.62,.62,zt(um(),.9),{x:1.5,y:1.9,z:-.55,ry:-Math.PI/2,cast:!1,receive:!1,parent:e});r.userData.noOutline=!0;const a=me(.42,.58,new De({map:Rn.posterMoonDango(),fog:!0}),{x:1.505,y:1.86,z:.12,ry:-Math.PI/2,cast:!1,receive:!1,parent:e});a.userData.noOutline=!0;const o=me(.78,1.9,new De({map:Nb(),fog:!0}),{x:.72,y:Me+.95,z:-4.405,cast:!1,receive:!1,parent:e});o.userData.noOutline=!0,C(.86,.06,.08,I("#8d939c"),{x:.72,y:Me+1.99,z:-4.42,parent:e,cast:!1}),C(.12,.06,.1,gt("#ffd9a0"),{x:.72,y:Me+2.12,z:-4.38,parent:e,cast:!1});const l=me(1.1,.24,zt(Bb(),.95),{x:.95,y:2.28,z:-4.41,cast:!1,receive:!1,parent:e});l.userData.noOutline=!0;const c=me(.62,.31,new De({map:Fb(),transparent:!0,depthWrite:!1,fog:!1,blending:In}),{x:.98,y:2.28,z:.55,cast:!1,receive:!1,parent:e});c.userData.noOutline=!0,i.add(e)}function eS(i){const e=pe("floor"),t=Lb(),n=I("#d8d2c2",{map:t,rim:.08,rimColor:"#ffe9c0",gradient:"soft",emissive:"#2a1c0e",emissiveIntensity:.3});me(Ut.maxX-Ut.minX,Ut.maxZ-Ut.minZ,n,{x:hm,y:Me+.002,z:(Ut.minZ+Ut.maxZ)/2,rx:-Math.PI/2,cast:!1,receive:!0,parent:e});const s=me(.9,2.6,new De({map:kb(),transparent:!0,opacity:.85,depthWrite:!1,fog:!1}),{x:.9,y:Me+.006,z:-1.3,rx:-Math.PI/2,cast:!1,receive:!1,parent:e});s.userData.noOutline=!0;const r=me(2.6,.26,new De({color:"#ffdba8",transparent:!0,opacity:.12,blending:In,depthWrite:!1,fog:!1}),{x:-1,y:Me+.005,z:.68,rx:-Math.PI/2,cast:!1,receive:!1,parent:e});r.userData.noOutline=!0;const a=I("#3f7ac0",{rim:.2,rimColor:"#9fd8ff",gradient:"soft"});for(let o=0;o<4;o+=1)C(.5,.09,.36,a,{x:.36,y:Me+.05+o*.075,z:.5,parent:e,cast:!1});C(.9,.012,.5,I("#3a4250"),{x:.98,y:Me+.007,z:.55,parent:e,cast:!1}),i.add(e)}function tS(i){const{handles:e}=i,t=pe("interior");return eS(t),jb(t),Hb(t),Gb(t),Wb(t),Xb(t),Yb(t),Zb(t),qb(t,e),$b(t),Kb(t),Jb(t),Qb(t),i.root.add(t),ru(t,!1,!0),t.traverse(n=>{n.isMesh&&n.material&&n.material.transparent&&(n.castShadow=!1),n.isSprite&&(n.castShadow=!1,n.receiveShadow=!1)}),{group:t,update(n){}}}const Cc=We.store.interior,vt=Cc.floorY,qi=Cc.ceilY,Yo=Cc.maxX;Cc.minX;const dn={rowZ:[-1,-1.95,-2.9],rowDepth:.34,lenX0:-2.15,lenX1:.05,tiers:[.12,.46,.8,1.14],counter:{zFront:-2.9,top:1.15},bento:{x:-2.55,d:.34,z0:-2.42,z1:-.72,floor0:.24,step:.34}};let Zo=null;function nS(){if(Zo)return Zo;const i=Ze(2048,64,(d,m,_)=>{d.fillStyle="#f7f3e6",d.fillRect(0,0,m,_),d.fillStyle="rgba(32,48,79,0.18)",d.fillRect(0,_-5,m,5);const x=["#fbf3dd","#ffe8b0","#ffd0c4","#c9f0e4","#d8e8ff","#fbf3dd"],v=["¥128","¥98","¥198","¥158","¥248","¥88","¥178","¥120","¥298","¥108"],E=118,T=10;let R=0;for(let P=6;P+E<m;P+=E+T){const S=x[R%x.length];d.fillStyle=S,wt(d,P,6,E,_-14,6),d.fill(),d.strokeStyle="rgba(32,48,79,0.14)",d.lineWidth=2,wt(d,P,6,E,_-14,6),d.stroke(),d.fillStyle=["#ff7a5e","#3fa8a0","#ffc96b","#7ab0e0"][R%4],d.fillRect(P+6,10,14,_-22),d.fillStyle="#20304f",d.font=`700 30px ${ht}`,d.textBaseline="middle",d.fillText(v[R%v.length],P+28,_/2+1),R+=1}}),e=Ze(512,128,(d,m,_)=>{d.clearRect(0,0,m,_),d.fillStyle="rgba(251,243,221,0.94)",wt(d,4,4,m-8,_-8,20),d.fill(),d.strokeStyle="#3fa8a0",d.lineWidth=6,wt(d,4,4,m-8,_-8,20),d.stroke(),d.fillStyle="#20304f",d.font=`700 56px ${Re}`,d.textAlign="center",d.textBaseline="middle",d.fillText("いらっしゃいませ",m/2,_/2-12),d.fillStyle="#3fa8a0",d.font=`600 30px ${ht}`,d.fillText("WELCOME  ·  TSUKIMI MART",m/2,_/2+38),d.textAlign="left"}),t=Ze(768,192,(d,m,_)=>{d.clearRect(0,0,m,_);const x=[{bg:"#e60012",fg:"#ffffff",text:"PayPay"},{bg:"#004098",fg:"#ffffff",text:"交通系"},{bg:"#1b3fa0",fg:"#ffffff",text:"VISA"},{bg:"#3fa8a0",fg:"#ffffff",text:"現金"}],v=m/x.length;x.forEach((E,T)=>{const R=T*v+6;d.fillStyle=E.bg,wt(d,R,10,v-12,_-20,12),d.fill(),d.fillStyle=E.fg,d.font=`800 34px ${ht}`,d.textAlign="center",d.textBaseline="middle",d.fillText(E.text,R+(v-12)/2,_/2-12),d.font=`600 20px ${Re}`,d.fillText("ご利用いただけます",R+(v-12)/2,_/2+30)}),d.textAlign="left"}),n=Ze(512,160,(d,m,_)=>{d.clearRect(0,0,m,_),d.fillStyle="rgba(251,243,221,0.94)",wt(d,4,4,m-8,_-8,16),d.fill(),d.strokeStyle="#3f5f8a",d.lineWidth=6,wt(d,4,4,m-8,_-8,16),d.stroke(),d.fillStyle="#3f5f8a",d.beginPath(),d.arc(64,_/2,30,0,Math.PI*2),d.fill(),d.fillStyle="#f4efe0",d.beginPath(),d.arc(64,_/2,15,0,Math.PI*2),d.fill(),d.fillStyle="#20304f",d.textBaseline="middle",d.font=`700 40px ${Re}`,d.fillText("防犯カメラ",116,_/2-22),d.font=`600 30px ${Re}`,d.fillText("作動中です",116,_/2+26)}),s=Ze(384,160,(d,m,_)=>{d.clearRect(0,0,m,_),d.fillStyle="rgba(32,48,79,0.92)",wt(d,4,4,m-8,_-8,18),d.fill(),d.fillStyle="#ffc96b",d.font=`800 74px ${Re}`,d.textAlign="center",d.textBaseline="middle",d.fillText("営業中",m/2,_/2),d.textAlign="left"}),r=Ze(512,256,(d,m,_)=>{d.clearRect(0,0,m,_),d.fillStyle="rgba(255,205,92,0.92)",wt(d,12,26,m-24,_-52,24),d.fill(),d.strokeStyle="rgba(255,255,255,0.85)",d.lineWidth=8,wt(d,12,26,m-24,_-52,24),d.stroke(),d.fillStyle="#20304f",d.font=`800 112px ${Re}`,d.textAlign="center",d.textBaseline="middle",d.fillText("レジ",m/2,_/2-4),d.font=`700 30px ${ht}`,d.fillText("CASHIER",m/2,_/2+70),d.textAlign="left"}),a=Ze(256,384,(d,m,_)=>{d.clearRect(0,0,m,_),d.fillStyle="rgba(63,168,160,0.88)",d.beginPath(),d.moveTo(m/2,40),d.lineTo(m-40,170),d.lineTo(m/2+34,170),d.lineTo(m/2+34,_-40),d.lineTo(m/2-34,_-40),d.lineTo(m/2-34,170),d.lineTo(40,170),d.closePath(),d.fill()}),o=Ze(256,256,(d,m,_)=>{d.fillStyle="#c9482f",wt(d,8,8,m-16,_-16,20),d.fill(),d.fillStyle="#fff4e2",d.font=`800 74px ${Re}`,d.textAlign="center",d.textBaseline="middle",d.fillText("消火器",m/2,96),d.font=`700 26px ${ht}`,d.fillText("FIRE EXTINGUISHER",m/2,172)}),l=Ze(512,128,(d,m,_)=>{d.clearRect(0,0,m,_),d.fillStyle="rgba(251,243,221,0.94)",wt(d,4,4,m-8,_-8,16),d.fill(),d.strokeStyle="#3fa8a0",d.lineWidth=6,wt(d,4,4,m-8,_-8,16),d.stroke(),d.fillStyle="#20304f",d.textBaseline="middle",d.font=`700 38px ${Re}`,d.fillText("ゴミは分別にご協力ください",24,_/2)}),c=Ze(512,160,(d,m,_)=>{d.clearRect(0,0,m,_),d.fillStyle="rgba(63,168,160,0.92)",wt(d,4,4,m-8,_-8,14),d.fill(),d.fillStyle="#f4fffb",d.textBaseline="middle",d.font=`700 38px ${Re}`,d.fillText("レジ袋は有料です",24,_/2-20),d.font=`600 26px ${Re}`,d.fillText("S ¥3 / M ¥5 / L ¥10",24,_/2+32)}),h=(d,m,_,x,v)=>Ze(256,512,(E,T,R)=>{E.fillStyle=_,E.fillRect(0,0,T,R),E.fillStyle=v,E.fillRect(0,0,T,42),E.fillRect(0,R-42,T,42),E.fillStyle=x,E.textAlign="center",E.textBaseline="middle";const P=d.split(""),S=(R-160)/P.length;E.font=`800 88px ${Re}`,P.forEach((M,D)=>E.fillText(M,T/2,110+D*S)),E.fillStyle=v,E.font=`700 30px ${ht}`,E.fillText(m,T/2,R-64),E.textAlign="left"}),f=h("おでん","ODEN","#7a2f24","#ffe8bc","#ffc96b"),p=h("からあげ","KARAAGE","#8a4a1e","#fff0d4","#ffb45e"),u=h("コーヒー","COFFEE","#20304f","#ffe3b0","#ffc96b"),g=Ze(256,256,(d,m,_)=>{d.clearRect(0,0,m,_),d.fillStyle="#f7f3e8",d.beginPath(),d.arc(m/2,_/2,m/2-4,0,Math.PI*2),d.fill(),d.strokeStyle="#20304f",d.lineWidth=6,d.beginPath(),d.arc(m/2,_/2,m/2-8,0,Math.PI*2),d.stroke();for(let x=0;x<12;x+=1){const v=x/12*Math.PI*2-Math.PI/2,E=x%3===0?86:96;d.strokeStyle="#20304f",d.lineWidth=x%3===0?6:3,d.beginPath(),d.moveTo(m/2+Math.cos(v)*E,_/2+Math.sin(v)*E),d.lineTo(m/2+Math.cos(v)*108,_/2+Math.sin(v)*108),d.stroke()}d.fillStyle="#3fa8a0",d.font=`700 22px ${ht}`,d.textAlign="center",d.fillText("TSUKIMI",m/2,_/2+54),d.textAlign="left"}),y=(d,m,_,x)=>Ze(256,128,(v,E,T)=>{v.fillStyle=_,v.fillRect(0,0,E,T),v.fillStyle=x,v.textAlign="center",v.textBaseline="middle",v.font=`700 34px ${Re}`,v.fillText(d,E/2,T/2-16),v.font=`600 20px ${ht}`,v.fillText(m,E/2,T/2+26),v.textAlign="left"});return Zo={priceRail:i,g24:e,payStrip:t,camSticker:n,openSticker:s,floorRegi:r,floorArrow:a,fireSticker:o,recycleSign:l,bagSticker:c,bannerOden:f,bannerKaraage:p,bannerCoffee:u,clockFace:g,binCan:y("かん・びん","CANS & BOTTLES","#3f6fb0","#f4f8ff"),binPet:y("ペットボトル","PET BOTTLES","#3fa8a0","#f4fffb"),popNew:vs({w:384,h:256,bg:"#ff7a5e",fg:"#fff7e3",text:"新発売",sub:"NEW",size:96}),popNo1:vs({w:384,h:256,bg:"#3fa8a0",fg:"#f4fffb",text:"人気No.1",sub:"からあげ",size:72}),pop100:vs({w:384,h:256,bg:"#ffc96b",fg:"#3a2a08",text:"100円",sub:"お試し価格",size:92}),popRecommend:vs({w:384,h:256,bg:"#20304f",fg:"#ffd9a0",text:"おすすめ",sub:"店長イチオシ",size:76}),bagBox:vs({w:512,h:192,bg:"#f7f3e8",fg:"#20304f",text:"レジ袋",sub:"S ¥3 / M ¥5 / L ¥10",size:64}),chopstick:vs({w:512,h:160,bg:"#f7f3e8",fg:"#a2622c",text:"お箸・スプーン",sub:"ご自由にお取りください",size:46})},Zo}function iS(i){const{handles:e}=i,t=nS(),n=pe("interior-details"),s=pe("details-solid"),r=pe("details-emit");n.add(s,r);const a={cream:I("#f0e9d9",{gradient:"soft",rim:.1,rimColor:"#ffe6b8"}),white:I("#f7f3e8",{gradient:"soft",rim:.08,rimColor:"#ffe6b8"}),steel:I("#b9c0c8",{gradient:"soft",rim:.22,rimColor:"#eef8ff"}),steelDark:I("#7e858f",{gradient:"soft",rim:.18}),dark:I("#2b313a",{gradient:"soft",rim:.14,rimColor:"#8fb4dd"}),red:I("#cf4a3c",{gradient:"soft",rim:.2,rimColor:"#ffb0a0"}),blue:I("#3f6fb0",{gradient:"soft",rim:.16}),teal:I("#3fa8a0",{gradient:"soft",rim:.16,rimColor:"#8ff0e8"}),navy:I("#24334f",{gradient:"soft",rim:.14}),amber:I("#c98a3c",{gradient:"soft",rim:.16}),pet:gt("#bfe8e0",{transparent:!0,opacity:.6}),cans:gt("#cfe4f5",{transparent:!0,opacity:.6})},o=u=>(u.userData.noOutline=!0,u),l=(u,g,y,d={})=>{const m=me(u,g,zt(y,d.intensity??1),{cast:!1,receive:!1,...d});return o(m)},c=(u,g,y,d={})=>{const m=me(u,g,db(y,{opacity:d.opacity??1}),{cast:!1,receive:!1,...d});return o(m)},h=pe("staff-area");{const u=pe("coffee-stand"),g=.93,y=1.43,d=-4.08,m=-3.62,_=(g+y)/2,x=(d+m)/2;C(y-g,.035,m-d,a.steel,{x:_,y:1.16,z:x,parent:u,cast:!1}),C(y-g+.03,.02,m-d+.03,a.steelDark,{x:_,y:1.135,z:x,parent:u,cast:!1}),C(y-g-.04,.02,m-d-.04,a.steelDark,{x:_,y:.45,z:x,parent:u,cast:!1});for(const[v,E]of[[g+.03,d+.03],[y-.03,d+.03],[g+.03,m-.03],[y-.03,m-.03]])ye(.014,.014,1,8,a.steel,{x:v,y:.64,z:E,parent:u,cast:!1});C(.26,.2,.3,I("#b99460",{gradient:"soft",rim:.12}),{x:1.03,y:.56,z:x,parent:u,cast:!1}),C(.2,.02,.24,I("#d8c8a0"),{x:1.03,y:.665,z:x,parent:u,cast:!1});for(let v=0;v<3;v+=1)ye(.03,.03,.14,8,v===0?a.amber:v===1?a.cream:a.blue,{x:1.33,y:.53,z:x-.1+v*.1,parent:u,cast:!1});C(.12,.06,.08,a.white,{x:.98,y:1.21,z:-3.66,parent:u,cast:!1}),C(.1,.025,.05,a.cream,{x:1.38,y:1.2,z:-3.66,parent:u,cast:!1}),h.add(u)}{const u=pe("staff-lockers"),g=1.18,y=1.5,d=-4.42,m=-4.2,_=1.45,x=I("#c6d0d8",{gradient:"soft",rim:.14,rimColor:"#eaf4ff"});C(y-g,_,m-d,I("#aeb9c3",{gradient:"soft",rim:.12}),{x:(g+y)/2,y:vt+_/2,z:(d+m)/2,parent:u});const v=(y-g)/2;for(let E=0;E<2;E+=1){const T=g+v/2+E*v;C(v-.02,_-.12,.02,x,{x:T,y:vt+_/2,z:m+.009,parent:u,cast:!1});for(let R=0;R<3;R+=1)C(v-.08,.012,.012,a.dark,{x:T,y:vt+_-.18-R*.03,z:m+.02,parent:u,cast:!1});C(.03,.06,.02,a.steel,{x:T+v/2-.05,y:vt+.72,z:m+.025,parent:u,cast:!1}),l(.055,.04,vs({w:128,h:96,bg:"#f4efe0",fg:"#20304f",text:String(E+1),size:52}),{x:T,y:vt+_-.3,z:m+.022,parent:r,intensity:.85})}C(y-g+.02,.03,m-d+.02,a.steelDark,{x:(g+y)/2,y:vt+_+.015,z:(d+m)/2,parent:u,cast:!1}),h.add(u)}{const u=pe("mop-bucket");u.position.set(.43,vt,-3.66),ye(.13,.145,.3,12,I("#d8c22f",{gradient:"soft",rim:.16}),{y:.15,parent:u}),ye(.105,.105,.02,12,a.steelDark,{y:.31,parent:u,cast:!1}),C(.1,.1,.14,I("#bfae2c",{gradient:"soft"}),{x:.1,y:.31,z:0,parent:u,cast:!1}),ye(.012,.012,1.1,8,I("#b8bcc4",{rim:.2,rimColor:"#f2faff"}),{x:.02,y:.85,z:.04,rz:.08,parent:u,cast:!1}),C(.12,.09,.12,I("#d8d2c2",{gradient:"soft"}),{x:.05,y:.36,z:.05,parent:u,cast:!1}),h.add(u)}{const u=pe("broom");u.position.set(1.455,vt,-3.66),u.rotation.z=-.09,ye(.013,.013,.9,8,a.steelDark,{y:.5,parent:u,cast:!1}),C(.09,.2,.16,I("#c98a3c",{gradient:"soft",rim:.14}),{y:.11,parent:u,cast:!1}),C(.1,.02,.17,a.red,{y:.02,parent:u,cast:!1}),h.add(u),C(.18,.02,.2,a.steelDark,{x:1.41,y:vt+.01,z:-3.9,parent:h,cast:!1}),ye(.01,.01,.36,6,a.steelDark,{x:1.41,y:vt+.2,z:-3.96,rx:.4,parent:h,cast:!1})}{const u=pe("staff-boxes"),g=I("#bd9a66",{gradient:"soft",rim:.12,rimColor:"#ffe6b8"}),y=I("#d8c8a0",{gradient:"soft",rim:.1});for(let d=0;d<3;d+=1){const m=d===2?.62:.36,_=d===2?0:d*.25,x=d===2?-3.78:-3.74;C(.3,.24,.3,g,{x:m,y:vt+.12+_,z:x,ry:d*.16,parent:u,cast:!1}),C(.2,.012,.03,y,{x:m,y:vt+.24+_,z:x,ry:d*.16,parent:u,cast:!1})}h.add(u)}{const u=pe("staff-stool");u.position.set(.78,vt,-3.56),ye(.15,.15,.045,14,a.red,{y:.42,parent:u,cast:!1}),ye(.145,.145,.01,14,a.dark,{y:.395,parent:u,cast:!1});for(let g=0;g<4;g+=1){const y=g/4*Math.PI*2+.6;ye(.012,.012,.4,6,a.steelDark,{x:Math.cos(y)*.1,y:.2,z:Math.sin(y)*.1,rx:Math.sin(y)*.08,rz:-Math.cos(y)*.08,parent:u,cast:!1})}h.add(u)}{const u=pe("fire-extinguisher");u.position.set(Yo-.085,vt,-3.5),ye(.052,.052,.4,12,a.red,{y:.24,parent:u,cast:!1}),ye(.028,.042,.05,10,a.dark,{y:.465,parent:u,cast:!1}),ye(.01,.01,.09,6,a.dark,{x:0,y:.51,z:.03,rx:.5,parent:u,cast:!1}),C(.02,.09,.05,a.dark,{x:0,y:.4,z:.055,parent:u,cast:!1}),C(.07,.12,.06,a.steelDark,{y:.11,z:-.07,parent:u,cast:!1}),h.add(u),c(.12,.12,t.fireSticker,{x:Yo-.03,y:.92,z:-3.5,ry:-Math.PI/2,parent:r})}ye(.11,.09,.34,12,a.blue,{x:.24,y:vt+.17,z:-3.56,parent:h,cast:!1}),C(.12,.06,.12,a.white,{x:.24,y:vt+.36,z:-3.56,parent:h,cast:!1}),s.add(h);{const u=pe("shelf-price"),g=om(1,1),y=gt("#ffffff",{map:t.priceRail});y.side=St;const d=[];for(const M of dn.rowZ)for(const D of dn.tiers)for(const U of[1,-1])d.push({x:(dn.lenX0+dn.lenX1)/2,y:vt+D-.006,z:M+U*(dn.rowDepth/2+.006),ry:U>0?0:Math.PI});const m=new Ar(g,y,d.length),_=new Ye,x=new w,v=new en,E=new Mn,T=new w;d.forEach((M,D)=>{x.set(M.x,M.y,M.z),E.set(0,M.ry,0),v.setFromEuler(E),T.set(dn.lenX1-dn.lenX0-.06,.052,1),_.compose(x,v,T),m.setMatrixAt(D,_)}),m.instanceMatrix.needsUpdate=!0,m.computeBoundingSphere(),m.castShadow=!1,m.receiveShadow=!1,m.userData.noOutline=!0,u.add(m);const R=[t.popNew,t.popNo1,t.pop100,t.popRecommend],P=[[-1.92,0,.46],[-1.35,0,.8],[-.7,0,.46],[-.25,1,.8],[-1.6,1,1.14],[-.95,1,.12],[-1.95,2,.8],[-.45,2,.46]];let S=0;for(const[M,D,U]of P){const B=dn.rowZ[D],G=me(.15,.11,new De({map:R[S%R.length],fog:!0}),{x:M,y:vt+U+.055,z:B+dn.rowDepth/2+.016,cast:!1,receive:!1,parent:u});G.rotation.x=-.18,G.userData.noOutline=!0,S+=1}for(let M=0;M<3;M+=1){const D=vt+dn.bento.floor0+M*dn.bento.step+.03,U=me(1.62,.05,y,{x:dn.bento.x+dn.bento.d/2+.008,y:D,z:(dn.bento.z0+dn.bento.z1)/2,ry:Math.PI/2,cast:!1,receive:!1,parent:u});U.userData.noOutline=!0}s.add(u)}const f=[];{const u=pe("camera-dome-2");u.position.set(-1.5,qi-.02,-3.6),u.rotation.y=.7,ye(.075,.075,.024,14,a.white,{parent:u,cast:!1}),ye(.066,.066,.02,14,a.dark,{y:-.02,parent:u,cast:!1});const g=tn(.058,gt("#2b313a",{transparent:!0,opacity:.85}),{y:-.048,parent:u,sy:.6,cast:!1});g.userData.noOutline=!0;const y=tn(.024,gt("#0b0e13"),{y:-.068,parent:u,cast:!1});y.userData.noOutline=!0;const d=tn(.01,gt(new re("#ff3b30").multiplyScalar(2)),{x:-.045,y:-.05,z:.04,parent:u,cast:!1});d.userData.noOutline=!0,f.push(d),s.add(u);for(const[_,x,v]of[[-.35,.12,.3],[.9,-1.9,-.5]]){const E=pe("speaker");E.position.set(_,qi-.055,x),E.rotation.y=v,C(.15,.09,.1,a.white,{parent:E,cast:!1});for(let T=0;T<5;T+=1)C(.12,.005,.005,a.dark,{y:-.03+T*.016,z:.052,parent:E,cast:!1});s.add(E)}for(const[_,x]of[[-1.3,-.5],[.2,-2.2],[-1.9,-3.9]])ye(.045,.045,.016,12,a.white,{x:_,y:qi-.008,z:x,parent:s,cast:!1}),ye(.022,.022,.026,8,a.steel,{x:_,y:qi-.026,z:x,parent:s,cast:!1});for(const[_,x]of[[.45,-3.3],[-2.2,-1.6]])ye(.014,.014,.05,8,a.steel,{x:_,y:qi-.03,z:x,parent:s,cast:!1}),ye(.03,.03,.012,8,a.steelDark,{x:_,y:qi-.058,z:x,parent:s,cast:!1});const m=[{map:t.bannerOden,x:-1.86},{map:t.bannerKaraage,x:-1.2},{map:t.bannerCoffee,x:-.54}];for(const _ of m){const x=pe("hanging-banner");x.position.set(_.x,0,.06),ye(.006,.006,.16,5,a.steelDark,{y:qi-.08,parent:x,cast:!1});const v=me(.22,.4,new De({map:_.map,side:St,fog:!0}),{y:qi-.38,cast:!1,receive:!1,parent:x});v.userData.noOutline=!0,s.add(x)}}c(.3,.075,t.g24,{x:-.18,y:1.12,z:.868,parent:r,opacity:.95}),c(.42,.105,t.payStrip,{x:0,y:1.32,z:.868,parent:r,opacity:.94}),c(.28,.088,t.camSticker,{x:1.18,y:1.62,z:.868,parent:r,opacity:.92}),c(.2,.083,t.openSticker,{x:.72,y:1.18,z:.868,parent:r,opacity:.95}),c(.26,.081,t.bagSticker,{x:.06,y:1.02,z:.868,parent:r,opacity:.92});{const u=pe("floor-refine");c(.42,.21,t.floorRegi,{x:.82,y:vt+.0085,z:-2.72,rx:-Math.PI/2,parent:u,opacity:.95}),c(.16,.24,t.floorArrow,{x:1.2,y:vt+.0085,z:-2.72,rx:-Math.PI/2,rz:-Math.PI/2,parent:u,opacity:.9});const g=new De({map:Ac(),color:new re("#ffcf94"),transparent:!0,opacity:.13,blending:In,depthWrite:!1,fog:!1}),y=me(1.5,1.5,g,{x:.7,y:vt+.007,z:-2.66,rx:-Math.PI/2,parent:r});o(y);const d=me(.07,.13,gt("#f8f4e8"),{x:.58,y:vt+.004,z:-2.5,rx:-Math.PI/2,rz:.5,parent:u});o(d),d.userData.noOutline=!0,s.add(u)}const p={h:null,m:null,s:null};{const u=pe("wall-clock");u.position.set(Yo-.016,2.1,-.12),u.rotation.y=-Math.PI/2,ye(.135,.135,.03,24,a.white,{rx:Math.PI/2,parent:u,cast:!1}),ye(.14,.14,.012,24,a.dark,{z:-.014,rx:Math.PI/2,parent:u,cast:!1});const g=me(.25,.25,gt("#ffffff",{map:t.clockFace,transparent:!0}),{z:.012,parent:u,cast:!1});g.userData.noOutline=!0,p.h=C(.012,.075,.006,a.dark,{y:.035,z:.02,parent:u,cast:!1}),p.m=C(.009,.1,.005,a.dark,{y:.048,z:.022,parent:u,cast:!1}),p.s=C(.004,.105,.004,a.red,{y:.05,z:.024,parent:u,cast:!1}),ye(.012,.012,.02,8,a.red,{z:.024,rx:Math.PI/2,parent:u,cast:!1}),s.add(u);const y=pe("recycle-bins"),d=[{x:1.38,z:-.24,mat:a.cans,label:t.binCan,lid:"#9fc4e8"},{x:1.38,z:-.62,mat:a.pet,label:t.binPet,lid:"#8fd8c0"}];for(const m of d)ye(.14,.12,.46,14,m.mat,{x:m.x,y:vt+.23,z:m.z,parent:y,cast:!1}),ye(.145,.145,.035,14,I(m.lid,{gradient:"soft"}),{x:m.x,y:vt+.48,z:m.z,parent:y,cast:!1}),ye(.035,.035,.05,10,a.dark,{x:m.x,y:vt+.5,z:m.z,parent:y,cast:!1}),l(.17,.085,m.label,{x:m.x,y:vt+.3,z:m.z+.135,parent:r,intensity:.92});Lt(y,{width:7e-4,color:"#080b14"}),s.add(y),c(.34,.085,t.recycleSign,{x:Yo-.028,y:1.35,z:-.42,ry:-Math.PI/2,parent:r,opacity:.92})}{const u=dn.counter,g=pe("counter-extras"),y=pe("bag-dispenser");y.position.set(1.28,vt+.86,u.zFront+.004),C(.24,.13,.07,a.white,{parent:y,cast:!1}),l(.2,.1,t.bagBox,{z:.036,parent:y,intensity:.9});const d=gt("#f0f4f2",{transparent:!0,opacity:.75,side:St}),m=me(.14,.16,d,{y:-.14,z:.03,rx:.25,parent:y});m.userData.noOutline=!0,g.add(y),ye(.022,.02,.075,8,a.teal,{x:.55,y:u.top+.04,z:-3.33,parent:g,cast:!1}),ye(.003,.003,.1,4,a.dark,{x:.552,y:u.top+.08,z:-3.332,rz:.12,parent:g,cast:!1}),ye(.003,.003,.1,4,a.red,{x:.556,y:u.top+.08,z:-3.326,rz:-.08,parent:g,cast:!1}),C(.15,.05,.1,a.white,{x:.73,y:u.top+.025,z:-3.33,parent:g,cast:!1});for(let _=0;_<5;_+=1)C(.13,.004,.002,I(_%2?"#3fa8a0":"#ff7a5e"),{x:.73,y:u.top+.028+_*.006,z:-3.282,parent:g,cast:!1});C(.16,.09,.12,a.cream,{x:.9,y:u.top+.045,z:-3.33,parent:g,cast:!1}),l(.14,.05,t.chopstick,{x:.9,y:u.top+.06,z:-3.269,parent:r,intensity:.9}),C(.2,.018,.13,a.steelDark,{x:1.3,y:u.top+.01,z:-3.01,parent:g,cast:!1}),C(.19,.004,.12,a.steel,{x:1.3,y:u.top+.02,z:-3.01,parent:g,cast:!1}),C(.1,.07,.08,a.cream,{x:.4,y:u.top+.035,z:-3.3,parent:g,cast:!1}),s.add(g)}{const u=pe("promo-stand");u.position.set(-.55,vt,-.35),u.rotation.y=.18,C(.34,.02,.2,a.steelDark,{y:.01,parent:u,cast:!1});const g=C(.3,.42,.02,a.white,{y:.24,z:-.06,rx:-.14,parent:u,cast:!1});o(g);const y=C(.3,.42,.02,a.white,{y:.24,z:.06,rx:.14,parent:u,cast:!1});o(y);const d=me(.26,.36,new De({map:Rn.posterMoonDango(),fog:!0}),{y:.25,z:.077,rx:.14,parent:u,cast:!1});d.userData.noOutline=!0,C(.32,.03,.14,a.red,{y:.47,parent:u,cast:!1}),Lt(u,{width:6e-4,color:"#080b14"}),s.add(u)}if(ru(s,!1,!0),n.traverse(u=>{u.isSprite&&(u.castShadow=!1,u.receiveShadow=!1)}),e&&e.debug){let u=0,g=0;n.traverse(y=>{y.isMesh&&(u+=1),y.isInstancedMesh&&(g+=1)}),e.debug.interiorDetails={meshes:u,instanced:g}}return i.root.add(n),{group:n,update(u){const g=u%2.6<.18;for(const d of f)d.visible=g;const y=u%60;p.s&&(p.s.rotation.z=-(y/60)*Math.PI*2),p.m&&(p.m.rotation.z=-(y/60/60)*Math.PI*2-1.2),p.h&&(p.h.rotation.z=-(y/3600/12)*Math.PI*2-.9)}}}const Pr=.12,sS={woodDark:"#33231a"};function Zn(i,e,t){return Ze(i,e,(n,s,r)=>{n.clearRect(0,0,s,r),t(n,s,r)})}function au(i,e,t,n,s,r){i.font=s,i.fillStyle=r,i.textAlign="center",i.textBaseline="middle",i.fillText(e,t,n)}function rS(i,{w:e,h:t,x:n,y:s,z:r,color:a="#25344a",text:o="",textColor:l="#f2ead8"}){const c=I(a,{rim:.12,rimColor:"#9fb8d8",gradient:"soft",side:St}),h=pe("noren");h.position.set(n,s,r),i.add(h);const f=3,p=.015,u=(e-p*(f-1))/f;for(let g=0;g<f;g+=1){const y=-e/2+u/2+g*(u+p),d=me(u,t,c,{x:y,z:.01,parent:h});d.userData.noOutline=!0}if(ye(.016,.016,e+.1,8,I(sS.woodDark,{rim:.2}),{x:0,y:t/2+.01,rx:0,rz:Math.PI/2,parent:h,cast:!1,receive:!1}),o){const g=Zn(512,160,(d,m,_)=>{d.clearRect(0,0,m,_),au(d,o,m/2,_/2,`700 96px ${Re}`,l)}),y=me(e*.72,e*.72*.31,new De({map:g,transparent:!0,depthWrite:!1}),{x:0,y:0,z:.026,parent:h});y.userData.noOutline=!0}return h}function br(i,{x:e,y:t,z:n,r:s=.16,color:r="#ff6f5c",text:a="",glowSize:o=1.1}){const l=pe("chochin");l.position.set(e,t,n),i.add(l);const c=ye(s,s,s*1.5,14,I(r,{rim:.3,rimColor:"#ffe0a0",emissive:r,emissiveIntensity:.55,gradient:"soft"}),{y:0,parent:l,cast:!0});if(c.userData.noOutline=!0,ye(s*.62,s*.62,.04,12,I("#1b1715",{rim:.2}),{y:s*.78,parent:l,cast:!1}),ye(s*.62,s*.62,.04,12,I("#1b1715",{rim:.2}),{y:-s*.78,parent:l,cast:!1}),ye(.008,.008,.24,4,I("#1b1715",{rim:0}),{y:s*.95+.12,parent:l,cast:!1,receive:!1}),a){const f=Zn(256,256,(p,u,g)=>{p.clearRect(0,0,u,g),au(p,a,u/2,g/2,`700 120px ${Re}`,"#2b1512")});me(s*1.3,s*1.3,new De({map:f,transparent:!0,depthWrite:!1}),{y:0,z:s+.005,parent:l}),me(s*1.3,s*1.3,new De({map:f,transparent:!0,depthWrite:!1}),{y:0,z:-s-.005,ry:Math.PI,parent:l})}const h=Yt(r,o,.4);return h.position.set(0,0,.02),l.add(h),l}function rf(i,{x0:e,x1:t,y:n,z:s,count:r=8,color:a="#ffcf94",sag:o=.18}){const l=[];for(let c=0;c<=r;c+=1){const h=c/r;l.push([e+(t-e)*h,n-Math.sin(h*Math.PI)*o,s])}for(let c=0;c<l.length-1;c+=1){const h=new w(...l[c]),f=new w(...l[c+1]);su(lm(h,f,.015),.006,I("#1e1b19",{rim:0}),{parent:i,segments:6})}for(let c=1;c<l.length-1;c+=1)tn(.035,Za(a,1.6),{x:l[c][0],y:l[c][1]-.045,z:l[c][2],parent:i})}function ou(i,{x:e,y:t,z:n,ry:s=0}){const r=pe("ac");return r.position.set(e,t,n),r.rotation.y=s,i.add(r),C(.5,.34,.24,I("#d8d6cd",{rim:.16,rimColor:"#9fb8d8"}),{parent:r,cast:!0}),ye(.12,.12,.03,12,I("#8a8f96",{rim:.2}),{x:.1,z:.13,rx:Math.PI/2,parent:r,cast:!1}),C(.46,.05,.02,I("#5d636b",{rim:.1}),{y:-.15,z:.13,parent:r,cast:!1}),r}function qo(i,{x:e,z:t}){const n=pe("street-lamp");n.position.set(e,Pr,t),i.add(n),ye(.05,.08,3.4,8,I("#4a5058",{rim:.14}),{y:1.7,parent:n,cast:!0}),su(lm(new w(0,3.3,0),new w(.7,3.55,0),.12),.04,I("#4a5058",{rim:.14}),{parent:n});const s=tn(.16,Za("#ffd9a0",1.8),{x:.7,y:3.45,parent:n});s.userData.noOutline=!0;const r=Yt("#ffcf94",2.6,.4);return r.position.set(.7,3.4,0),n.add(r),n}function ea(i,{x:e,z:t,ry:n=0,hot:s=!0}){const r=pe("vending");r.position.set(e,Pr,t),r.rotation.y=n,i.add(r),C(.78,1.8,.7,I(s?"#b83a32":"#3a5a8a",{rim:.2,rimColor:"#ffd9a0",gradient:"soft"}),{y:.9,parent:r,cast:!0});const a=Zn(256,512,(c,h,f)=>{c.fillStyle=s?"#d8e8f8":"#d8eef8",c.fillRect(0,0,h,f);const p=["#e85a4a","#5aa86a","#e8c04a","#4a8ad8","#d86aa8"];for(let u=0;u<4;u+=1)for(let g=0;g<3;g+=1)c.fillStyle=p[(u*3+g)%p.length],c.fillRect(16+g*78,16+u*92,58,66),c.fillStyle="#f8f8f8",c.fillRect(26+g*78,44+u*92,38,8);c.fillStyle=s?"#b83a32":"#3a5a8a",c.fillRect(0,f-70,h,70),au(c,s?"HOT":"COLD",h/2,f-34,`700 42px ${ht}`,"#f8f0e0")}),o=me(.68,1.55,zt(a,1.7),{y:1.02,z:.36,parent:r});o.userData.noOutline=!0,C(.5,.16,.08,I("#1b1e24",{rim:.1}),{y:.18,z:.36,parent:r,cast:!1});const l=Yt(s?"#ffb0a0":"#9fd8ff",2,.25);return l.position.set(0,1,.5),r.add(l),r}function Nh(i,{x:e,z:t,ry:n=0}){const s=pe("bicycle");s.position.set(e,Pr,t),s.rotation.y=n,i.add(s);const r=I("#3a4a5a",{rim:.14});for(const o of[-.42,.42])iu(.25,.012,4,20,I("#2a2f37",{rim:.1}),{x:o,y:.27,z:0,parent:s,cast:!1});su([[-.42,.27,0],[0,.5,0],[.42,.27,0],[0,.5,0],[0,.35,0]],.018,r,{parent:s}),C(.22,.04,.1,I("#1e2228",{rim:.1}),{x:.42,y:.52,z:0,parent:s,cast:!1});const a=C(.3,.2,.26,I("#8a9199",{rim:.12}),{x:.48,y:.36,z:0,parent:s,cast:!1});return a.userData.noOutline=!0,s}function aS(i,{x:e,z:t,color:n="#5a7a4a"}){const s=pe("planter");return s.position.set(e,Pr,t),i.add(s),ye(.24,.2,.32,8,I("#6b5a48",{rim:.14}),{y:.16,parent:s,cast:!0}),tn(.28,I(n,{rim:.18,rimColor:"#9fd8a0",gradient:"soft"}),{y:.5,parent:s,cast:!0}),tn(.2,I(n,{rim:.18}),{x:.18,y:.42,z:.1,parent:s,cast:!0}),s}function oS(i,{x:e,z:t}){const n=pe("postbox");n.position.set(e,Pr,t),i.add(n),ye(.05,.06,.8,8,I("#4a5058",{rim:.14}),{y:.4,parent:n,cast:!0}),C(.42,.5,.36,I("#b83a32",{rim:.2,rimColor:"#ffb0a0"}),{y:.95,parent:n,cast:!0}),C(.28,.05,.05,I("#8a2f28",{rim:.12}),{y:1.06,z:.19,parent:n,cast:!1});const s=Yt("#ff8a6a",.8,.2);return s.position.set(0,1,.2),n.add(s),n}function af(i,{x:e,z:t,ry:n=0}){const s=pe("cat");s.position.set(e,Pr,t),s.rotation.y=n,i.add(s);const r=I("#d8c8a8",{rim:.18,rimColor:"#ffe0b0",gradient:"soft"});tn(.13,r,{y:.2,z:0,sx:1.1,sy:.8,sz:1.4,parent:s,cast:!0}),tn(.1,r,{y:.3,z:.16,parent:s,cast:!0});for(const a of[-1,1])is(new Er(.035,.09,4),r,{x:a*.05,y:.4,z:.16,parent:s,cast:!1});return s}const fe=lS();function lS(){return .12}const an=cS(20261106);function cS(i){return function(){i|=0,i=i+1831565813|0;let t=Math.imul(i^i>>>15,1|i);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function Zt(i,{x:e,y:t,z:n,w:s=.6,h:r=.55,color:a="#ffd9a0",lit:o=.85,ry:l=0}){const c=gt(a,{fog:!1});c.color.multiplyScalar(o),c.toneMapped=!1;const h=me(s,r,c,{x:e,y:t,z:n,ry:l,parent:i});return h.userData.noOutline=!0,h}function of(i,{x:e,y0:t,z:n,w:s,h:r,cols:a,rows:o,gapX:l,gapY:c,color:h="#ffd9a0",ry:f=0,litBase:p=.55}){for(let u=0;u<o;u+=1)for(let g=0;g<a;g+=1)Zt(i,{x:e+(g-(a-1)/2)*l,y:t+u*c,z:n,w:s,h:r,ry:f,color:h,lit:p+(u*3+g*5)%5*.09})}function Ir(i,{x:e,z:t,h:n=3.2,r:s=.9,color:r="#3f5a44",sway:a=.006}){const o=pe("tree");o.position.set(e,fe,t),i.add(o),ye(.1,.14,n*.55,6,I("#4a3728",{rim:.16}),{y:n*.28,parent:o,cast:!0});const l=pe("crown");return l.position.y=n*.62,o.add(l),tn(s,I(r,{rim:.18,rimColor:"#9fd8a0"}),{y:0,parent:l,cast:!0}),tn(s*.75,I(r,{rim:.16}),{x:s*.55,y:s*.35,parent:l,cast:!0}),tn(s*.7,I(r,{rim:.16}),{x:-s*.5,y:s*.25,parent:l,cast:!0}),l.userData.sway={crown:l,amp:a,speed:.8+(e+t)%.5},o}function Fs(i,{x:e,z:t,ry:n=0}){const s=pe("bench");s.position.set(e,fe,t),s.rotation.y=n,i.add(s),C(1.1,.06,.34,I("#6a4a32",{rim:.14}),{y:.42,parent:s,cast:!0}),C(1.1,.34,.05,I("#6a4a32",{rim:.14}),{y:.63,z:-.14,parent:s,cast:!0});for(const r of[-.42,.42])ye(.03,.03,.4,4,I("#3a3f47",{rim:.1}),{x:r,y:.21,parent:s,cast:!1});return s}function dm(i,{x:e,z:t,w:n,d:s,h:r=.5}){const a=pe("hedge");a.position.set(e,fe,t),i.add(a),C(n,r,s,I("#3f5a44",{rim:.16,rimColor:"#9fd8a0"}),{y:r/2,parent:a,cast:!0});for(let o=0;o<Math.ceil(n/.4);o+=1)tn(.2,I(o%2?"#44684a":"#3f5a44",{rim:.14}),{x:-n/2+.2+o*.4,y:r,parent:a,cast:!1})}function Rc(i,e,t,n={}){const s=n.overhang??.3,r=n.ridge??.28,a=n.color||"#2f343c",o=i/2+s,l=e/2+s,c=i>=e,h=Math.max(.15,(c?i:e)*r*.5),f=c?[-o,0,-l,o,0,-l,o,0,l,-o,0,l,-h,t,0,h,t,0]:[-o,0,-l,o,0,-l,o,0,l,-o,0,l,0,t,-h,0,t,h],p=c?[0,1,5,0,5,4,2,3,4,2,4,5,3,0,4,1,2,5]:[0,1,4,2,3,5,3,0,4,3,4,5,1,2,5,1,5,4],u=new tt;u.setAttribute("position",new ze(f,3)),u.setIndex(p),u.computeVertexNormals();const g=new lt(u,I(a,{rim:.2,rimColor:"#8fa8c8",side:St}));g.castShadow=!0,g.receiveShadow=!0;const y=C(c?h*2:.14,.08,c?.14:h*2,I("#20242a",{rim:.16}),{y:t+.02,parent:g});return y.castShadow=!1,g}function hS(i,e){const t=pe(`house-${e.id||e.x}-${e.z}`);t.position.set(e.x,fe,e.z),t.rotation.y=e.ry||0,i.add(t);const{w:n,d:s,h:r}=e,a=I(e.wall||"#c8c0b0",{rim:.16,rimColor:"#a8c4e4",gradient:"soft"});C(n,r,s,a,{y:r/2,parent:t,cast:!0,receive:!0}),C(n+.16,.18,s+.16,I("#8a8170",{rim:.12}),{y:.09,parent:t,cast:!1});const o=r*.32,l=Rc(n,s,o,{overhang:.26,ridge:.34,color:e.roofColor||"#2f343c"});l.position.y=r+.04,t.add(l);const c=s/2+.01;C(.7,1.45,.08,I("#6a4a32",{rim:.14}),{z:c,y:.8,parent:t,cast:!1}),C(.86,.1,.4,I("#3a3430",{rim:.12}),{z:c+.18,y:1.65,parent:t,cast:!0}),Zt(t,{x:-n*.28,y:1.25,z:c+.02,w:.8,h:.65,color:e.warm,lit:.55+an()*.3}),n>2.8&&Zt(t,{x:n*.28,y:1.25,z:c+.02,w:.8,h:.65,color:e.warm,lit:.45+an()*.35}),r>2.6&&(Zt(t,{x:-n*.24,y:r*.62,z:c+.02,w:.7,h:.55,color:e.warm,lit:.4+an()*.3}),Zt(t,{x:n*.24,y:r*.62,z:c+.02,w:.7,h:.55,color:e.warm,lit:.35+an()*.3}));for(const h of[-1,1])Zt(t,{x:h*(n/2+.01),y:r*.55,z:-s*.15,w:.5,h:.5,ry:h*Math.PI/2,color:e.warm,lit:.3+an()*.3});return C(.22,.34,.16,I("#3a4652",{rim:.12}),{x:-n/2+.3,z:c+.15,y:.35,parent:t,cast:!1}),ou(t,{x:n*.32,y:.65,z:c+.14,ry:0}),e.garden&&(dm(t,{x:-n/2-.5,z:.2,w:.3,d:s*.8,h:.55}),Ir(t,{x:n*.42,z:s*.55,h:r*.62,r:.55,color:"#3f5a44"})),an()>.55&&ye(.22,.22,.3,8,I("#b9c0c8",{rim:.16}),{x:-n*.2,y:r+o*.6,z:0,parent:t,cast:!1}),Lt(t,{width:.0012,color:"#080b14"}),t}function fS(i,e){const t=pe("apartment");t.position.set(e.x,fe,e.z),t.rotation.y=e.ry||0,i.add(t);const{w:n,d:s,h:r,floors:a}=e;C(n,r,s,I("#9a9284",{rim:.16,rimColor:"#a8c4e4",gradient:"soft"}),{y:r/2,parent:t,cast:!0,receive:!0}),C(n+.2,.2,s+.2,I("#6a6558",{rim:.12}),{y:.1,parent:t,cast:!1});const o=(r-.6)/a;for(let c=0;c<a;c+=1){const h=.9+c*o;of(t,{x:0,y0:h,z:s/2+.01,w:.62,h:.5,cols:Math.max(2,Math.round(n/1.1)),rows:1,gapX:.95,gapY:.5,color:"#ffd9a0",litBase:.45}),C(n*.86,.08,.4,I("#5a5f66",{rim:.12}),{y:h-.34,z:s/2+.2,parent:t,cast:!1});for(let f=0;f<7;f+=1)ye(.01,.01,.34,4,I("#6b7178",{rim:.08}),{x:-n*.38+n*.76*f/6,y:h-.14,z:s/2+.38,parent:t,cast:!1});of(t,{x:n/2+.01,y0:h,z:0,w:.5,h:.48,cols:Math.max(1,Math.round(s/1.6)),rows:1,gapX:1,gapY:.5,ry:Math.PI/2,color:"#ffcd94",litBase:.4}),ou(t,{x:n*.32,y:h+.1,z:s/2+.06,ry:0})}C(1.2,.12,.8,I("#3a4652",{rim:.14}),{y:.32,z:s/2+.42,parent:t,cast:!0}),C(.1,2.2,.1,I("#4a5058",{rim:.1}),{x:-.55,y:1.2,z:s/2+.7,parent:t,cast:!1}),C(.1,2.2,.1,I("#4a5058",{rim:.1}),{x:.55,y:1.2,z:s/2+.7,parent:t,cast:!1}),C(1.25,.1,.9,I("#3a4652",{rim:.14}),{y:2.3,z:s/2+.45,parent:t,cast:!0}),C(n+.2,.12,s+.2,I("#4a5058",{rim:.14}),{y:r+.06,parent:t,cast:!0}),ye(.26,.26,.4,10,I("#b9c0c8",{rim:.16}),{x:-n*.22,y:r+.34,z:-s*.12,parent:t,cast:!0}),ye(.02,.03,1.6,4,I("#8a9199",{rim:.1}),{x:n*.25,y:r+.8,z:-s*.1,parent:t,cast:!1}),C(n*.7,.03,.03,I("#8a9199",{rim:.1}),{x:n*.25,y:r+1.4,z:-s*.1,parent:t,cast:!1});const l=Zn(512,128,(c,h,f)=>{c.fillStyle="#2a3038",c.fillRect(0,0,h,f),c.textAlign="center",c.textBaseline="middle",c.font=`700 44px ${Re}`,c.fillStyle="#ffe0b0",c.fillText("月見ハイツ",h/2,f/2)});return me(n*.5,.32,zt(l,1.1),{y:r+.2,z:s/2+.03,parent:t}).userData.noOutline=!0,Lt(t,{width:.0012,color:"#080b14"}),t}function uS(i,e){return Zn(512,320,(t,n,s)=>{const r=t.createLinearGradient(0,0,0,s);r.addColorStop(0,i==="laundry"?"#d8f0f8":"#3a281e"),r.addColorStop(1,i==="laundry"?"#8fc8d8":"#17100d"),t.fillStyle=r,t.fillRect(0,0,n,s),t.fillStyle="rgba(255,220,160,0.75)";for(let a=0;a<4;a+=1)t.beginPath(),t.arc(50+a*135,30,12,0,Math.PI*2),t.fill();if(i==="books")for(let a=0;a<4;a+=1)for(let o=0;o<7;o+=1)t.fillStyle=["#8c3a2a","#3a5a4a","#7a5a2a","#3a4a6a","#c8a060"][(a+o)%5],t.fillRect(22+o*68,70+a*56,56,40);else if(i==="pharmacy")for(let a=0;a<3;a+=1)for(let o=0;o<8;o+=1)t.fillStyle=["#e8f0e8","#7fd8b8","#e8d070","#c8e8ff"][(a+o)%4],t.fillRect(18+o*60,68+a*58,48,42);else if(i==="laundry")for(let a=0;a<4;a+=1)t.fillStyle="#e8f0f2",t.fillRect(24+a*118,90,88,150),t.fillStyle="#7fbfd8",t.beginPath(),t.arc(68+a*118,165,26,0,Math.PI*2),t.fill();else if(i==="barber")t.fillStyle="#e8e8e0",t.fillRect(24,46,100,220),t.fillRect(388,46,100,220),t.fillStyle="#2a2a2e",t.fillRect(60,160,140,14),t.fillRect(300,150,130,14);else{t.fillStyle="rgba(30,18,14,0.85)",t.fillRect(0,190,n,130),t.fillStyle="rgba(255,200,140,0.75)";for(let a=0;a<5;a+=1)t.beginPath(),t.arc(60+a*100,210,10,0,Math.PI*2),t.fill();for(let a=0;a<3;a+=1)t.fillStyle="rgba(40,24,18,0.9)",t.fillRect(50+a*160,250,110,16),t.fillRect(60+a*160,266,10,50),t.fillRect(140+a*160,266,10,50)}t.fillStyle="rgba(210,235,255,0.08)",t.beginPath(),t.moveTo(0,0),t.lineTo(n*.35,0),t.lineTo(n*.1,s),t.lineTo(0,s),t.closePath(),t.fill()})}function dS(i,e){const t=pe(`shop-${e.id}`),{w:n,d:s,h:r}=e,a=e.ry||0,o=Math.abs(a-Math.PI/2)<.01?-s/2:Math.abs(a+Math.PI/2)<.01?s/2:0,l=Math.abs(a)<.01?-s/2:Math.abs(Math.abs(a)-Math.PI)<.01?s/2:0;t.position.set(e.x+o,fe,e.z+l),t.rotation.y=a,i.add(t),C(n,r,s,I("#b8ac98",{rim:.16,rimColor:"#a8c4e4",gradient:"soft"}),{y:r/2,parent:t,cast:!0,receive:!0}),C(n+.16,.16,s+.16,I("#6a6558",{rim:.12}),{y:.08,parent:t,cast:!1});const c=Math.max(.65,n*.2),h=Rc(n,s,c,{overhang:.32,ridge:.24,color:"#2f343c"});h.position.y=r+.04,t.add(h);const f=n-.5,p=2.3,u=s/2+.01;me(f,p,zt(uS(e.kind,e.accent),1),{z:u,y:1.35,parent:t}).userData.noOutline=!0,C(.8,1.9,.05,I("#2a2a2e",{rim:.12}),{x:n*.25,z:u+.03,y:1.05,parent:t,cast:!1});const g=Zn(512,128,(d,m,_)=>{d.fillStyle=e.paper||"#2a1c14",d.fillRect(0,0,m,_),d.strokeStyle=e.accent,d.lineWidth=5,d.strokeRect(5,5,m-10,_-10),d.textAlign="center",d.textBaseline="middle",d.font=`700 50px ${Re}`,d.fillStyle=e.sign||"#ffd9a0",d.fillText(e.jp,m/2,_*.42),d.font=`500 22px ${ht}`,d.fillStyle="rgba(255,255,255,0.7)",d.fillText(e.en,m/2,_*.78)});me(n*.92,.52,zt(g,1.25),{z:u+.04,y:2.95,parent:t}).userData.noOutline=!0;const y=C(n*.98,.05,.85,I(e.accent,{rim:.18,opacity:1}),{z:u+.35,y:2.55,parent:t,cast:!0});if(y.rotation.x=-.12,(e.kind==="izakaya"||e.kind==="ramen")&&(rS(t,{x:0,y:2.1,z:u+.08,w:n*.7,h:.65,color:e.paper,text:e.jp.slice(0,4)}),br(t,{x:-n*.36,y:2.5,z:u+.2,r:.16,color:"#d24a38",text:"",glowSize:.9}),br(t,{x:n*.36,y:2.5,z:u+.2,r:.16,color:"#d24a38",text:"",glowSize:.9})),e.kind==="barber")for(let d=0;d<6;d+=1)C(.08,.22,.08,I(d%2?"#e8e8e0":"#c8433a",{rim:.1}),{x:n*.42,y:1.7+d*.24,z:u+.35,parent:t,cast:!1});e.kind==="cafe"&&C(.5,.04,.3,I("#3a2a20",{rim:.1}),{x:-n*.3,y:1,z:u+.5,parent:t,cast:!1}),r>4.2&&(of(t,{x:0,y0:r*.64,z:u+.02,w:.56,h:.5,cols:Math.max(2,Math.round(n/1)),rows:1,gapX:.95,gapY:.5,color:"#ffd9a0",litBase:.35}),ou(t,{x:n*.32,y:r*.55,z:u+.12,ry:0}));for(const d of[-1,1])Zt(t,{x:d*(n/2+.01),y:2.2,z:-s*.12,w:.45,h:.45,ry:d*Math.PI/2,color:"#ffd9a0",lit:.35});return Lt(t,{width:.0012,color:"#080b14"}),t}function pS(i){const e=pe("school-campus");i.add(e);const t=k.school,n=pe("school-main");n.position.set(t.x,fe,t.z),e.add(n),C(t.w,t.h,t.d,I("#c8c4b0",{rim:.16,rimColor:"#a8c4e4",gradient:"soft"}),{y:t.h/2,parent:n,cast:!0,receive:!0}),C(t.w+.3,.2,t.d+.3,I("#7a7468",{rim:.14}),{y:.1,parent:n,cast:!1});const s=t.floors,r=(t.h-.8)/s;for(let g=0;g<s;g+=1){const y=1.1+g*r;for(let d=0;d<10;d+=1)Zt(n,{x:-12/2+.9+d*((t.w-1.8)/9),y,z:t.d/2+.02,w:.85,h:.62,color:g===0?"#ffe8c0":"#ffd9a0",lit:g===0?.55:.35+(d+g)%4*.1});C(t.w*.94,.05,.06,I("#8a8478",{rim:.1}),{y:y-.45,z:t.d/2+.06,parent:n,cast:!1})}for(let g=0;g<s;g+=1){const y=1.1+g*r;for(let d=0;d<8;d+=1)Zt(n,{x:-12/2+1+d*((t.w-2)/7),y,z:-4.2/2-.02,w:.75,h:.58,ry:Math.PI,color:"#ffcf94",lit:.25+(d+g)%3*.12})}C(2.2,2.6,1.1,I("#7a7468",{rim:.16}),{z:t.d/2+.45,y:1.3,parent:n,cast:!0}),C(2.6,.14,1.4,I("#3a4652",{rim:.14}),{z:t.d/2+.6,y:2.75,parent:n,cast:!0});const a=Zn(1024,160,(g,y,d)=>{g.fillStyle="#e8f0f8",g.fillRect(0,0,y,d),g.textAlign="center",g.textBaseline="middle",g.font=`700 74px ${Re}`,g.fillStyle="#2a3a4a",g.fillText("月見町立 月見小学校",y/2,d/2)});me(6.4,1,zt(a,1.1),{z:t.d/2+.06,y:3.8,parent:n}).userData.noOutline=!0,ye(.16,.22,4,8,I("#d8d4c8",{rim:.18}),{x:-12*.36,y:t.h+2,z:0,parent:n,cast:!0}),C(.5,.5,.5,I("#f0ece0",{rim:.2}),{x:-12*.36,y:t.h+4.1,z:0,parent:n,cast:!0}),ye(.19,.19,.04,16,I("#2a3038",{rim:.2}),{x:-12*.36,y:t.h+4.18,z:.24,rx:Math.PI/2,parent:n,cast:!1});const o=Rc(t.w+.4,t.d+.4,2.2,{overhang:.55,ridge:.26,color:"#2a3038"});o.position.y=t.h+.08,n.add(o);for(let g=0;g<8;g+=1)ye(.02,.02,.4,4,I("#5d636b",{rim:.1}),{x:-12/2+.8+g*((t.w-1.6)/7),y:t.h+.2,z:t.d/2-.1,parent:n,cast:!1});C(t.w,.03,.03,I("#5d636b",{rim:.1}),{y:t.h+.4,z:t.d/2-.1,parent:n,cast:!1});const l=k.gym,c=pe("school-gym");c.position.set(l.x,fe,l.z),e.add(c),C(l.w,l.h,l.d,I("#9a9488",{rim:.16,rimColor:"#a8c4e4",gradient:"soft"}),{y:l.h/2,parent:c,cast:!0}),C(l.w+.3,.2,l.d+.3,I("#6a6558",{rim:.12}),{y:.1,parent:c,cast:!1}),C(l.w+.6,.35,l.d+.6,I("#3a4652",{rim:.18}),{y:l.h+.1,parent:c,cast:!0});for(let g=0;g<4;g+=1)Zt(c,{x:-3.1*.34+g*(l.w*.68/3),y:l.h*.62,z:l.d/2+.02,w:.8,h:.5,color:"#fff0c8",lit:.55});for(let g=0;g<3;g+=1)Zt(c,{x:-3.1/2-.01,y:l.h*.58,z:-5.6*.28+g*l.d*.28,w:.5,h:.45,ry:-Math.PI/2,color:"#ffd9a0",lit:.4});const h=Zn(512,128,(g,y,d)=>{g.fillStyle="#f0ece0",g.fillRect(0,0,y,d),g.textAlign="center",g.textBaseline="middle",g.font=`700 44px ${Re}`,g.fillStyle="#3a3028",g.fillText("月見小学校 体育館",y/2,d/2)});me(4,.8,zt(h,1.1),{z:l.d/2+.03,y:4.1,parent:c}).userData.noOutline=!0;const f=k.pool;C(f.w,.12,f.d,I("#d8e8f0",{rim:.14}),{x:f.x,y:fe+.14,z:f.z,parent:e,cast:!1}),me(f.w-.3,f.d-.3,gt("#3a8ab8",{fog:!1}),{x:f.x,y:fe+.21,z:f.z,rx:-Math.PI/2,parent:e}).material.color.multiplyScalar(1.2),C(f.w,.4,.08,I("#8a8d84",{rim:.12}),{x:f.x,y:fe+.3,z:f.z-f.d/2,parent:e,cast:!1});const u=k.schoolYard;C(u.w,.02,u.d,I("#8a6a4a",{rim:.1}),{x:u.x,y:fe+.13,z:u.z,parent:e,cast:!1});for(let g=0;g<4;g+=1)C(u.w-1,.01,.06,gt("#e8e0d0").clone(),{x:u.x,y:fe+.145,z:u.z-u.d/2+.4+g*(u.d-.8)/3,parent:e,cast:!1});for(const g of[-3.2,3.2])ye(.05,.05,2.2,6,I("#5d636b",{rim:.12}),{x:u.x+g,y:fe+1.2,z:u.z,parent:e,cast:!1}),C(.1,.55,.9,I("#e8e4d4",{rim:.14}),{x:u.x+g,y:fe+2,z:u.z+.3,parent:e,cast:!1}),iu(.17,.02,4,8,I("#d24a38",{rim:.1}),{x:u.x+g,y:fe+1.75,z:u.z+.7,rx:Math.PI/2,parent:e,cast:!1});for(const g of[-12/2-.8,t.w/2+.8])C(.06,1.3,u.d+1,I("#5d636b",{rim:.1}),{x:g,y:fe+.65,z:u.z,parent:e,cast:!1});for(let g=0;g<7;g+=1)C(.03,1.1,.03,I("#5d636b",{rim:.1}),{x:-12/2+g*(t.w/6),y:fe+.55,z:u.z-u.d/2,parent:e,cast:!1});for(const g of[-1.1,1.1])C(.16,1.8,.16,I("#8a8d84",{rim:.14}),{x:u.x+g,y:fe+.9,z:u.z+u.d/2,parent:e,cast:!0});for(const[g,y]of[[-12/2-2.2,t.z+1.5],[-12/2-3.2,t.z-2],[t.w/2+1.6,t.z+2],[t.w/2+2.8,t.z-2.2]])Ir(e,{x:g,z:y,h:3.8,r:1.1,color:"#3f5a44"});Lt(n,{width:.0012,color:"#080b14"}),Lt(c,{width:.0012,color:"#080b14"})}function mS(i){const e=k.shrine,t=pe("shrine");t.position.set(e.x,fe,e.z),t.rotation.y=Math.PI/2,i.add(t);const n=e.w,s=e.d;C(n,.35,s,I("#6a6a62",{rim:.14}),{y:.175,parent:t,cast:!0}),C(n-.4,.06,s-.4,I("#8a8d84",{rim:.12}),{y:.38,parent:t,cast:!1});for(let f=0;f<7;f+=1)C(1.5,.05,.5,I("#a8a89a",{rim:.1}),{y:.41,z:s/2-.6-f*.9,parent:t,cast:!1});const r=I("#b8402f",{rim:.22,rimColor:"#ffb0a0",gradient:"soft"}),a=s/2-.7;for(const f of[-1.25,1.25])ye(.13,.16,3.9,12,r,{x:f,y:2.35,z:a,parent:t,cast:!0}),ye(.2,.2,.16,12,I("#3a241e",{rim:.16}),{x:f,y:.48,z:a,parent:t,cast:!1});C(3.6,.22,.26,r,{y:3.7,z:a,parent:t,cast:!0}),C(4.2,.16,.32,r,{y:4.05,z:a,parent:t,cast:!0}),C(4.3,.16,.36,I("#3a241e",{rim:.16}),{y:4.2,z:a,parent:t,cast:!1});for(const[f,p]of[[-1.9,s/2-2],[1.9,s/2-2],[-1.9,.6],[1.9,.6]])ye(.06,.08,1.2,8,I("#6a6a62",{rim:.14}),{x:f,y:.95,z:p,parent:t,cast:!0}),C(.42,.3,.42,I("#8a8d84",{rim:.16}),{x:f,y:1.62,z:p,parent:t,cast:!0}),Zt(t,{x:f,y:1.64,z:p+.22,w:.24,h:.16,color:"#ffcf94",lit:1.1}),yi(t,{x:f,y:1.65,z:p+.3,color:"#ffcf94",size:.7,opacity:.25});const o=pe("haiden");o.position.set(0,.35,-.6),t.add(o),C(4,2,2.8,I("#8a6a4c",{rim:.16}),{y:1,parent:o,cast:!0}),C(4.8,.26,3.4,I("#3a3030",{rim:.2}),{y:2.15,parent:o,cast:!0});const l=Rc(4,2.8,1.25,{overhang:.5,ridge:.3,color:"#3a3030"});l.position.y=2.15,o.add(l),ye(.05,.05,4.2,8,I("#d8d4c8",{rim:.12}),{y:2.05,z:1.5,rx:Math.PI/2,parent:o,cast:!1});for(const f of[-.5,.5])br(o,{x:f,y:1.75,z:1.6,r:.13,color:"#e8dcc0",text:"献灯",glowSize:.8});const c=pe("ema");c.position.set(-2.4,.35,.4),t.add(c);for(const f of[-.5,.5])C(.08,1.4,.08,I("#6a4a32",{rim:.12}),{z:f,y:.7,parent:c,cast:!0});C(1.2,.08,1.1,I("#5a3f2c",{rim:.12}),{y:1.3,parent:c,cast:!0});for(let f=0;f<8;f+=1)C(.16,.12,.02,I("#e8dcc0",{rim:.1}),{x:-.45+f%4*.3,y:1.05-Math.floor(f/4)*.22,z:.56,parent:c,cast:!1});me(2.2,1.4,gt("#1a4a5a",{fog:!1}),{x:2.2,y:.44,z:-2.4,rx:-Math.PI/2,parent:t}).material.color.multiplyScalar(1.1);for(let f=0;f<9;f+=1)ye(.02,.02,.5+f%3*.12,4,I("#5a6b4a",{rim:.1}),{x:1.2+f%3*.7,y:.7,z:-1.9-Math.floor(f/3)*.3,parent:t,cast:!1});for(const[f,p,u]of[[-3,3.4,4.5],[3,3.2,4],[-3.2,-2.8,4.2],[3.2,-3,3.8]])Ir(t,{x:f,z:p,h:u,r:1.2,color:"#3f5a44"});for(let f=0;f<8;f+=1)C(.6,.45,.4,I("#7a7d74",{rim:.12}),{x:-n/2+.3+f*.6,y:.22,z:s/2+.25,parent:t,cast:!0});Lt(t,{width:.0012,color:"#080b14"})}function gS(i){const e=k.hospital,t=pe("hospital");t.position.set(e.x,fe,e.z),i.add(t),C(e.w,e.h,e.d,I("#cfd8de",{rim:.16,rimColor:"#a8c4e4",gradient:"soft"}),{y:e.h/2,parent:t,cast:!0,receive:!0}),C(e.w+.2,.2,e.d+.2,I("#6a7468",{rim:.12}),{y:.1,parent:t,cast:!1});const n=e.floors,s=(e.h-1)/n;for(let o=0;o<n;o+=1){const l=1.2+o*s;for(let c=0;c<4;c+=1)Zt(t,{x:-3*.35+c*(e.w*.7/3),y:l,z:e.d/2+.02,w:.55,h:.5,color:"#d8f0ff",lit:.35+(c+o)%3*.12,ry:0});for(let c=0;c<7;c+=1)Zt(t,{x:-3/2-.01,y:l,z:-6*.4+c*(e.d*.8/6),w:.45,h:.45,ry:-Math.PI/2,color:"#d8f0ff",lit:.3+(c+o)%4*.1});for(let c=0;c<7;c+=1)Zt(t,{x:e.w/2+.01,y:l,z:-6*.4+c*(e.d*.8/6),w:.45,h:.45,ry:Math.PI/2,color:"#cfe8ff",lit:.25+(c+o)%3*.12})}C(1,.34,.06,gt("#d24a38",{fog:!1}),{y:e.h*.78,z:e.d/2+.04,parent:t}).material.color.multiplyScalar(1.2),C(.34,1,.06,gt("#d24a38",{fog:!1}),{y:e.h*.78,z:e.d/2+.04,parent:t}).material.color.multiplyScalar(1.2),C(2.4,2.6,1,I("#7a7468",{rim:.16}),{z:e.d/2+.4,y:1.3,parent:t,cast:!0}),C(2.8,.14,1.4,I("#3a4652",{rim:.14}),{z:e.d/2+.55,y:2.8,parent:t,cast:!0}),Zt(t,{x:-.4,y:1.2,z:e.d/2+.9,w:1.5,h:2,color:"#d8f0ff",lit:1}),C(e.w+.2,.12,e.d+.2,I("#4a5058",{rim:.14}),{y:e.h+.06,parent:t,cast:!0}),C(1.4,.9,1,I("#8a8f96",{rim:.16}),{x:-.5,y:e.h+.55,z:-1.2,parent:t,cast:!0}),ye(.3,.3,.25,10,I("#b9c0c8",{rim:.16}),{x:.7,y:e.h+.28,z:-1.6,parent:t,cast:!0}),C(.1,2.2,.1,I("#8a9199",{rim:.1}),{x:.9,y:e.h+1.1,z:1.6,parent:t,cast:!1});const r=Zn(256,640,(o,l,c)=>{o.fillStyle="#f0f6fb",o.fillRect(0,0,l,c),o.textAlign="center",o.textBaseline="middle",o.font=`700 50px ${Re}`,["月","見","ク","リ","ニ","ッ","ク"].forEach((h,f)=>{o.fillStyle=f<2?"#2a5a8a":"#5a7a9a",o.fillText(h,l/2,55+f*80)})});me(.5,1.5,zt(r,1.2),{x:e.w/2+.03,y:e.h*.55,z:e.d*.32,ry:Math.PI/2,parent:t}).userData.noOutline=!0;const a=k.parking;C(a.w,.02,a.d,I("#23262c",{rim:.1}),{x:a.x,y:fe+.105,z:a.z,parent:i,cast:!1});for(let o=0;o<=4;o+=1)C(.04,.005,a.d-.2,gt("#d8d4c8").clone(),{x:a.x-a.w/2+.3+o*1.5,y:fe+.12,z:a.z,parent:i,cast:!1});lf(i,{x:a.x-1.4,z:a.z,ry:Math.PI/2,color:"#cfd8de"}),lf(i,{x:a.x+.3,z:a.z,ry:Math.PI/2,color:"#4a5a6a"}),Lt(t,{width:.0012,color:"#080b14"})}function yS(i){const e=k.station,t=pe("station");i.add(t);const n=e.platformX0,s=e.platformX1,r=e.z0,a=e.z1,o=(n+s)/2,l=(r+a)/2,c=s-n;C(c,.3,a-r,I("#8a8d84",{rim:.14}),{x:o,y:fe+.15,z:l,parent:t,cast:!0}),C(c-.1,.02,a-r-.1,I("#a8a89a",{rim:.1}),{x:o,y:fe+.31,z:l,parent:t,cast:!1}),C(.12,.03,a-r-.4,I("#e8c04a",{rim:.1}),{x:s-.4,y:fe+.325,z:l,parent:t,cast:!1});const h=n-.6;C(2.4,3.6,5.2,I("#d8d4c8",{rim:.16,rimColor:"#a8c4e4"}),{x:h,y:fe+1.8,z:-3.6,parent:t,cast:!0}),C(2.6,.16,5.4,I("#2a5a8a",{rim:.16}),{x:h,y:fe+3.65,z:-3.6,parent:t,cast:!0});for(let u=0;u<3;u+=1)Zt(t,{x:h-1.21,y:fe+1.7,z:-5.3+u*1.6,w:.7,h:1,ry:-Math.PI/2,color:"#fff0c8",lit:.8});const f=Zn(512,160,(u,g,y)=>{u.fillStyle="#f0f4f8",u.fillRect(0,0,g,y),u.textAlign="center",u.textBaseline="middle",u.font=`700 66px ${Re}`,u.fillStyle="#2a3a4a",u.fillText("月見駅",g/2,y*.42),u.font=`500 24px ${ht}`,u.fillStyle="#5a7a9a",u.fillText("TSUKIMI STATION",g/2,y*.78)});me(2.2,.7,zt(f,1.2),{x:h-1.22,y:fe+2.9,z:-3.6,ry:-Math.PI/2,parent:t}).userData.noOutline=!0,C(c-.1,.08,a-r-1.2,I("#3a4652",{rim:.14}),{x:o,y:fe+3,z:l,parent:t,cast:!0});for(let u=r+1;u<a-.6;u+=3.4)ye(.04,.04,2.7,6,I("#5d636b",{rim:.12}),{x:o-c*.3,y:fe+1.65,z:u,parent:t,cast:!1}),ye(.04,.04,2.7,6,I("#5d636b",{rim:.12}),{x:o+c*.3,y:fe+1.65,z:u,parent:t,cast:!1});for(let u=r+1.4;u<a-.6;u+=2.6){const g=gt("#e8f4ff",{fog:!1});g.color.multiplyScalar(1.6),g.toneMapped=!1,me(c*.65,.05,g,{x:o,y:fe+2.94,z:u,rx:-Math.PI/2,parent:t}).userData.noOutline=!0}Fs(t,{x:n+.5,z:-1.4,ry:Math.PI/2}),Fs(t,{x:n+.5,z:3,ry:Math.PI/2}),ea(t,{x:n+.55,z:5.4,ry:-Math.PI/2,hot:!1});const p=xS(t,{x:n+.65,y:fe+2.05,z:-5.4});return ye(.22,.22,.06,16,I("#f0ece0",{rim:.2}),{x:h-1.25,y:fe+4.2,z:-3.6,rx:Math.PI/2,parent:t,cast:!1}),vS(t,{x:k.rail.minX+.4,z:0}),C(6,.02,7,I("#6a6a62",{rim:.1}),{x:n-4.2,y:fe+.105,z:-1.2,parent:t,cast:!1}),op(t,{x:n-4.8,z:-3.4}),op(t,{x:n-2.8,z:-3.4}),_S(t,{x:n-4.4,z:1.4}),Lt(t,{width:.0012,color:"#080b14"}),{g:t,board:p}}function yi(i,{x:e,y:t,z:n,color:s="#ffcf94",size:r=1.2,opacity:a=.25}){const o=Yt(s,r,0);return o.position.set(e,t,n),o.material.opacity=a,i.add(o),o}function lf(i,{x:e,z:t,ry:n=0,color:s="#4a5a6a"}){const r=pe("parked-car");r.position.set(e,fe+.02,t),r.rotation.y=n,i.add(r),C(1.7,.75,3.6,I(s,{rim:.16,rimColor:"#c8d8e8",gradient:"soft"}),{y:.5,parent:r,cast:!0}),C(1.5,.55,1.7,I("#26303a",{rim:.14}),{y:1.05,z:-.2,parent:r,cast:!0});for(const[a,o]of[[-.8,-1.1],[.8,-1.1],[-.8,1.1],[.8,1.1]])ye(.28,.28,.22,8,I("#1b1e24",{rim:.1}),{x:a,y:.28,z:o,rx:Math.PI/2,parent:r,cast:!1});for(const a of[-1.82,1.82]){const o=Yt(a>0?"#ff4a3a":"#fff0c0",1.4,.6);o.position.set(0,.55,a),r.add(o)}for(const[a,o]of[[-.9,-.2],[.9,-.2]])Zt(r,{x:a,y:1.1,z:o,w:1.2,h:.4,ry:a>0?Math.PI/2:-Math.PI/2,color:"#9fd8ff",lit:.6});return r}function op(i,{x:e,z:t}){const n=lf(i,{x:e,z:t,ry:Math.PI/2,color:"#d8c04a"});return C(.7,.16,.5,gt("#ffe0a0",{fog:!1}),{y:1.45,x:.2,parent:n,cast:!1}),n}function _S(i,{x:e,z:t}){const n=pe("bus");n.position.set(e,fe+.02,t),i.add(n),C(2.4,2.4,7.2,I("#d8d4c8",{rim:.18,rimColor:"#cfe8ff"}),{y:1.25,parent:n,cast:!0}),C(2.42,.3,7.25,I("#2a5a8a",{rim:.16}),{y:.6,parent:n,cast:!1});for(let s=0;s<4;s+=1)for(const r of[-1.21,1.21])Zt(n,{x:r,y:1.55,z:-2.3+s*1.5,w:.7,h:.7,ry:r>0?Math.PI/2:-Math.PI/2,color:"#ffe0b0",lit:.6});for(const[s,r]of[[-1.1,-2.2],[1.1,-2.2],[-1.1,2.2],[1.1,2.2]])ye(.32,.32,.24,8,I("#1b1e24",{rim:.1}),{x:s,y:.32,z:r,rx:Math.PI/2,parent:n,cast:!1});return n}function xS(i,{x:e,y:t,z:n}){const s=document.createElement("canvas");s.width=512,s.height=224;const r=s.getContext("2d"),a=new Ns(s);a.colorSpace=Dt,a.anisotropy=4;const o=pe("station-board");o.position.set(e,t,n),o.rotation.y=-Math.PI/2,i.add(o),me(1.1,.48,new De({map:a,toneMapped:!1}),{parent:o}).userData.noOutline=!0,C(1.18,.56,.05,I("#20242a",{rim:.2}),{z:-.03,parent:o,cast:!1});let l=0;function c(h){const f=Math.floor(h/1e3),p=String(Math.floor(f/60)%60).padStart(2,"0"),u=String(f%60).padStart(2,"0"),g=45-f%60;r.fillStyle="#081420",r.fillRect(0,0,512,224),r.strokeStyle="#2a6a8a",r.lineWidth=4,r.strokeRect(4,4,504,216),r.textAlign="left",r.textBaseline="middle",r.font="700 34px monospace",r.fillStyle="#9fe8ff",r.fillText("月見駅  TSUKIMI",22,36),r.font="700 52px monospace",r.fillStyle="#ffd9a0",r.fillText(`${p}:${u}`,22,96),r.font="500 24px sans-serif",r.fillStyle="#c8e8ff",r.fillText("上り  各停  6番線",22,148),r.fillStyle=g<10?"#ffcf5a":"#7dffc0",r.font="700 30px monospace",r.fillText(`まもなく  ${g}s`,22,190),a.needsUpdate=!0}return c(0),{g:o,update(h){h-l>.5&&(l=h,c(h*1e3))}}}function vS(i,{x:e,z:t}){const n=pe("level-crossing");n.position.set(e,fe,t),i.add(n);for(const r of[-2.6,2.6]){ye(.07,.08,1.7,8,I("#2a3038",{rim:.16}),{y:.85,z:r,parent:n,cast:!0}),C(1.9,.1,.1,I("#e8c04a",{rim:.14}),{y:1.15,z:r,parent:n,cast:!1});for(let o=0;o<5;o+=1)C(.18,.12,.12,I("#2a3038",{rim:.1}),{x:-.8+o*.4,y:1.15,z:r,parent:n,cast:!1});C(.16,.22,.12,I("#3a3f47",{rim:.12}),{y:1.55,z:r,parent:n,cast:!1});const a=tn(.07,gt("#ff4a3a").clone(),{y:1.55,z:r+.1,parent:n});a.material.color.multiplyScalar(1.6),a.material.toneMapped=!1}const s=Zn(256,160,(r,a,o)=>{r.fillStyle="#e8d04a",r.fillRect(0,0,a,o),r.fillStyle="#1a1a1a",r.textAlign="center",r.textBaseline="middle",r.font="bold 46px sans-serif",r.fillText("踏切",a/2,o/2)});return me(.5,.3,zt(s,1.2),{x:-.6,y:1.25,z:0,ry:-Math.PI/2,parent:n}).userData.noOutline=!0,{g:n}}function MS(i){const e=pe("minor-roads");i.add(e);const t=k.bounds,n=(s,r)=>{if(s==="ew"){const a=r;C(t.maxX-t.minX,.02,2,I("#1c2026",{rim:.1,rimColor:"#8fa8c8"}),{x:0,y:fe+.108,z:a,parent:e,cast:!1,receive:!0});for(const o of[-1.25,1.25])C(t.maxX-t.minX,.035,.5,I("#8a8170",{rim:.1}),{x:0,y:fe+.12,z:a+o,parent:e,cast:!1});for(let o=t.minX+1;o<t.maxX-1;o+=2.4)C(.7,.006,.07,gt("#d8d4c8").clone(),{x:o,y:fe+.12,z:a,parent:e,cast:!1});for(let o=t.minX+1;o<t.maxX-1;o+=1)C(.3,.02,.55,gt("#d8d4c8").clone(),{x:o+.15,y:fe+.122,z:a+.6,parent:e,cast:!1})}else{const a=r;C(2,.02,t.maxZ-t.minZ,I("#1c2026",{rim:.1,rimColor:"#8fa8c8"}),{x:a,y:fe+.108,z:0,parent:e,cast:!1,receive:!0});for(const o of[-1.25,1.25])C(.5,.035,t.maxZ-t.minZ,I("#8a8170",{rim:.1}),{x:a+o,y:fe+.12,z:0,parent:e,cast:!1});for(let o=t.minZ+1;o<t.maxZ-1;o+=2.4)C(.07,.006,.7,gt("#d8d4c8").clone(),{x:a,y:fe+.12,z:o,parent:e,cast:!1});for(let o=t.minZ+1;o<t.maxZ-1;o+=1)C(.55,.02,.3,gt("#d8d4c8").clone(),{x:a+.6,y:fe+.122,z:o+.15,parent:e,cast:!1})}};for(const s of k.minorEW)n("ew",(s.minZ+s.maxZ)/2);for(const s of k.minorNS)n("ns",(s.minX+s.maxX)/2)}function bS(i){for(const e of k.parks){const t=pe("park");i.add(t),C(e.w,.03,e.d,I("#4a5a42",{rim:.1}),{x:e.x,y:fe+.14,z:e.z,parent:t,cast:!1}),C(e.w,.02,.3,I("#8a8070",{rim:.1}),{x:e.x,y:fe+.16,z:e.z+.3,parent:t,cast:!1}),Fs(t,{x:e.x-e.w*.25,z:e.z+.4,ry:Math.PI}),Fs(t,{x:e.x+e.w*.25,z:e.z+.4,ry:Math.PI});for(let n=0;n<3;n+=1)Ir(t,{x:e.x-e.w*.35+n*e.w*.35,z:e.z-e.d*.25,h:3+n%2*.5,r:.85,color:"#3f5a44"});for(const n of[-e.w*.3,e.w*.3])ye(.04,.05,1.1,6,I("#5d636b",{rim:.12}),{x:e.x+n,y:fe+.7,z:e.z+e.d*.3,parent:t,cast:!1}),yi(t,{x:e.x+n,y:fe+1.25,z:e.z+e.d*.3,color:"#ffcf94",size:1.1,opacity:.28}),tn(.08,Za("#ffcf94",1.5),{x:e.x+n,y:fe+1.25,z:e.z+e.d*.3,parent:t});dm(t,{x:e.x,z:e.z-e.d/2+.1,w:e.w*.9,d:.35,h:.5})}}function SS(i){const e=k.market,t=pe("market");i.add(t),C(e.w,.02,e.d,I("#5a4a3a",{rim:.1}),{x:e.x,y:fe+.14,z:e.z,parent:t,cast:!1});const n=[["たこ焼き","#ffcf94"],["焼き鳥","#ff8a5c"],["甘味処","#ffd9a0"]];for(let s=0;s<3;s+=1){const r=e.x-e.w/3+s*(e.w/3),a=e.z+.2;C(1.2,1.1,1,I("#3a2f28",{rim:.14}),{x:r,y:fe+.55,z:a,parent:t,cast:!0}),C(1.4,.07,1.2,I("#5a3a2a",{rim:.14}),{x:r,y:fe+1.2,z:a,parent:t,cast:!0});const[o,l]=n[s],c=Zn(256,96,(h,f,p)=>{h.fillStyle="#2a1c18",h.fillRect(0,0,f,p),h.textAlign="center",h.textBaseline="middle",h.font=`700 38px ${Re}`,h.fillStyle=l,h.fillText(o,f/2,p/2)});me(.95,.28,zt(c,1.2),{x:r,y:fe+1.02,z:a+.52,parent:t}).userData.noOutline=!0,br(t,{x:r-.52,y:fe+.95,z:a+.55,r:.13,color:"#d24a38",text:"",glowSize:.9}),yi(t,{x:r,y:fe+.7,z:a+.6,color:"#ffb45e",size:1.2,opacity:.32})}}function wS(i){const e=k.riversidePark,t=pe("riverside-park");i.add(t),C(e.w,.03,e.d,I("#4a5a42",{rim:.1}),{x:e.x,y:fe+.14,z:e.z,parent:t,cast:!1}),C(e.w,.02,.4,I("#8a8070",{rim:.1}),{x:e.x,y:fe+.16,z:e.z+.4,parent:t,cast:!1});for(let n=0;n<8;n+=1){const s=e.x-e.w/2+1.2+n*((e.w-2.4)/7);Ir(t,{x:s,z:e.z-e.d*.15,h:3.4+n%3*.4,r:.9,color:n%2?"#3f5a44":"#44684a"}),n%2===0&&Fs(t,{x:s+.7,z:e.z+.5,ry:Math.PI}),n%2===1&&(ye(.03,.04,1,6,I("#5d636b",{rim:.12}),{x:s,y:fe+.62,z:e.z+.7,parent:t,cast:!1}),yi(t,{x:s,y:fe+1.15,z:e.z+.7,color:"#ffcf94",size:1.1,opacity:.3}),tn(.07,Za("#ffcf94",1.5),{x:s,y:fe+1.15,z:e.z+.7,parent:t}))}}function TS(i){const e=pe("bridges");i.add(e);for(const[n,s]of[[k.bridgeMain,"main"],[k.bridgeWest,"west"]]){const r=n.z,a=n.x1-n.x0;C(a+.8,.16,3.2,I("#8a8d84",{rim:.16}),{x:(n.x0+n.x1)/2,y:fe+.14,z:r,parent:e,cast:!0});for(const o of[-1.4,1.4]){C(a+.8,.08,.12,I("#5d636b",{rim:.12}),{x:(n.x0+n.x1)/2,y:fe+.62,z:r+o,parent:e,cast:!1});for(let l=0;l<=4;l+=1)ye(.03,.03,.55,4,I("#5d636b",{rim:.1}),{x:n.x0+.2+l*(a/4),y:fe+.45,z:r+o,parent:e,cast:!1})}for(const o of[n.x0-.2,n.x1+.2])ye(.05,.06,1.2,6,I("#b8402f",{rim:.16}),{x:o,y:fe+.7,z:r+1.3,parent:e,cast:!1}),yi(e,{x:o,y:fe+1.35,z:r+1.3,color:"#ffcf94",size:1.2,opacity:.35}),br(e,{x:o,y:fe+1.15,z:r+1.3,r:.14,color:"#d24a38",text:"",glowSize:.9})}const t=k.river.minZ-.15;for(let n=-20;n<19;n+=4.2)n>-4&&n<3||(ye(.03,.04,.9,6,I("#5d636b",{rim:.1}),{x:n,y:fe+.6,z:t,parent:e,cast:!1}),tn(.07,Za("#ffcf94",1.4),{x:n,y:fe+1.05,z:t,parent:e}),yi(e,{x:n,y:fe+1.05,z:t,color:"#ffcf94",size:1,opacity:.28}))}function AS(i){const e=pe("street-props");i.add(e);for(const t of[-18,-12,-6,6,12,18])for(const n of[-3.9,3.6])qo(e,{x:t,z:n});for(const t of[-18,-12,-6,6,12,18])qo(e,{x:-4,z:t}),qo(e,{x:3.6,z:t});for(const t of k.minorEW){const n=(t.minZ+t.maxZ)/2+1.5;for(const s of[-18,-9,0,9,18])qo(e,{x:s,z:n})}ea(e,{x:3.7,z:-4.4,ry:Math.PI,hot:!0}),ea(e,{x:3.7,z:-5.6,ry:Math.PI,hot:!1}),ea(e,{x:-4.3,z:5.2,ry:-Math.PI/2,hot:!1}),Nh(e,{x:-4.2,z:3,ry:Math.PI/2}),Nh(e,{x:4.2,z:3.2,ry:-Math.PI/2}),Nh(e,{x:-2.9,z:7.2,ry:Math.PI/2}),oS(e,{x:-4.1,z:-3.2}),C(.5,.7,.45,I("#3a4652",{rim:.12}),{x:4.1,z:-7,y:fe+.35,parent:e,cast:!0}),C(.5,.7,.45,I("#4a6b8c",{rim:.12}),{x:4.7,z:-7,y:fe+.35,parent:e,cast:!0}),ea(e,{x:14,z:5,ry:-Math.PI/2,hot:!1});for(const[t,n]of[[-4,-9],[-4,9],[3.8,-9],[3.8,9],[-13.2,0],[13.2,0]])aS(e,{x:t,z:n,color:"#4a6b3c"}),Ir(e,{x:t+.5,z:n+.4,h:3,r:.8,color:"#3f5a44"});for(const t of[4.6,8,11.4])rf(e,{x0:-4,x1:3.4,y:5.2,z:t,count:8,color:"#ffb35e",sag:.5});for(const t of[-12.6,-9,-5.4])rf(e,{x0:t,x1:t+3.2,y:5,z:-4,count:6,color:"#ffcf94",sag:.4});af(e,{x:2.2,z:2.6,ry:1.2}),af(e,{x:-5,z:-2.6,ry:2.1})}function ES(i){const e=pe("train"),t=(k.rail.minX+k.rail.maxX)/2;e.position.set(t,fe+.08,-16),i.add(e);const n=I("#d8dce2",{rim:.22,rimColor:"#cfe8ff",gradient:"soft"}),s=I("#2a5a8a",{rim:.18});for(let r=0;r<3;r+=1){const a=(r-1)*8.2;C(2.8,2.9,7.6,n,{y:1.55,z:a,parent:e,cast:!0}),C(2.84,.28,7.66,s,{y:.55,z:a,parent:e,cast:!1}),C(2.9,.14,7.7,I("#3a4652",{rim:.16}),{y:3.05,z:a,parent:e,cast:!0});for(let o=0;o<4;o+=1)for(const l of[-1.41,1.41])Zt(e,{x:l,y:2,z:a-2.4+o*1.6,w:1.1,h:.7,ry:l>0?Math.PI/2:-Math.PI/2,color:"#ffe0b0",lit:.65});for(const[o,l]of[[-1.2,a-2.6],[1.2,a-2.6],[-1.2,a+2.6],[1.2,a+2.6]])ye(.32,.32,.24,8,I("#1b1e24",{rim:.1}),{x:o,y:.32,z:l,rx:Math.PI/2,parent:e,cast:!1})}for(const r of[-16,16])for(const a of[-.7,.7]){const o=Yt(r>0?"#fff2cc":"#ff4a3a",2,.8);o.position.set(a,.9,r),e.add(o)}return{g:e,update(r){const a=r*.55%36;let o;a<14?o=-16+a*1.2:a<17?o=1:o=1+(a-17)*1.3,e.position.z=o}}}function CS(i){const e=[],t=(n,s,r)=>{const a=pe("traffic-signal");a.position.set(n,fe,s),a.rotation.y=r,i.add(a),ye(.06,.07,3.6,8,I("#4a5058",{rim:.14}),{y:1.8,parent:a,cast:!0}),C(.3,.8,.24,I("#2a3038",{rim:.16}),{y:3.4,parent:a,cast:!0});const o=[];for(let l=0;l<3;l+=1){const c=new De({color:new re(["#ff4a3a","#ffcf5a","#7dffc0"][l]).multiplyScalar(.3),toneMapped:!1}),h=new lt(new Fi(.08,10,8),c);h.position.set(0,3.65-l*.22,.14),a.add(h),o.push(c)}e.push({bulbs:o})};return t(-4.2,2.4,Math.PI/2),t(4,-2.8,-Math.PI/2),t(-4.2,-2.8,Math.PI/2),t(4,2.4,-Math.PI/2),t(-16,2.4,Math.PI/2),t(-16,-2.8,Math.PI/2),{update(n){const s=n%12<5?0:n%12<10?2:1;for(const r of e)r.bulbs.forEach((a,o)=>{a.color.set(["#ff4a3a","#ffcf5a","#7dffc0"][o]).multiplyScalar(o===s?1.5:.2)})}}}function RS(i){const e=[],t=n=>{const s=pe("moving-car");i.add(s),C(1.7,.75,3.6,I(n,{rim:.16}),{y:.5,parent:s,cast:!0}),C(1.5,.55,1.7,I("#26303a",{rim:.14}),{y:1.05,z:-.2,parent:s,cast:!0});for(const[r,a]of[[-.8,-1.1],[.8,-1.1],[-.8,1.1],[.8,1.1]])ye(.28,.28,.22,8,I("#1b1e24",{rim:.1}),{x:r,y:.28,z:a,rx:Math.PI/2,parent:s,cast:!1});for(const r of[Yt("#fff0c0",1.4,.7),Yt("#ff4a3a",1,.6)])s.add(r);return s.children[s.children.length-2].position.set(0,.5,1.85),s.children[s.children.length-1].position.set(0,.5,-1.85),s};return e.push({g:t("#4a5a6a"),lane:"ew",speed:2.2,offset:0}),e.push({g:t("#6a4a4a"),lane:"ew",speed:-1.8,offset:8}),e.push({g:t("#4a6a5a"),lane:"ns",speed:1.6,offset:3}),{update(n){for(const s of e)s.lane==="ew"?((n*s.speed+s.offset)%44-22,s.g.position.set(s.speed>0?-22+(n*s.speed+s.offset)%44:22-(n*-s.speed+s.offset)%44,.02,.5),s.g.rotation.y=s.speed>0?Math.PI/2:-Math.PI/2):(s.g.position.set(-.6,.02,-22+(n*s.speed+s.offset)%44),s.g.rotation.y=0)}}}function PS(i){const t=[{cx:2.4,cz:2,rx:1.2,rz:.5,speed:.2,phase:0},{cx:-5.6,cz:4.8,rx:1.4,rz:.6,speed:-.15,phase:2.2},{cx:14.6,cz:6.2,rx:1.1,rz:.8,speed:.18,phase:4.1}].map(n=>({c:af(i,{x:n.cx,z:n.cz,ry:0}),s:n}));for(const n of t)n.c.scale.setScalar(1.9);return{update(n){for(const{c:s,s:r}of t){const a=n*r.speed+r.phase;s.position.x=r.cx+Math.cos(a)*r.rx,s.position.z=r.cz+Math.sin(a)*r.rz,s.rotation.y=-a+Math.PI/2}}}}function IS(i){const e=pe("boat");i.add(e),C(1.2,.35,3.2,I("#6a4a32",{rim:.16}),{y:fe+.3,parent:e,cast:!1}),C(.9,.25,1.6,I("#3a2f28",{rim:.14}),{y:fe+.5,z:-.3,parent:e,cast:!1});const t=Yt("#ffcf94",1.5,.5);return t.position.set(0,fe+.8,-1.2),e.add(t),{update(n){e.position.set(-14+n*.5%28,0,(k.river.minZ+k.river.maxZ)/2)}}}function DS(i){const t=new Ln(.07,.05),n=new De({color:"#ffc8d8",transparent:!0,opacity:.85,side:St,depthWrite:!1}),s=new Ar(t,n,260);s.frustumCulled=!1,i.add(s);const r=[];for(let o=0;o<260;o+=1)r.push({x:(an()-.5)*40,y:an()*10,z:(an()-.5)*40,vy:.3+an()*.5,phase:an()*Math.PI*2,spin:(an()-.5)*1.5});const a=new dt;return{update(o,l){for(let c=0;c<260;c+=1){const h=r[c];h.y-=h.vy*l,h.x+=Math.sin(o*.4+h.phase)*.1*l,h.y<fe+.05&&(h.y=9+an()*3,h.x=(an()-.5)*40,h.z=(an()-.5)*40),a.position.set(h.x,h.y,h.z),a.rotation.set(o*h.spin+h.phase,o*h.spin*.5,h.phase),a.scale.setScalar(.7+Math.sin(o+h.phase)*.2),a.updateMatrix(),s.setMatrixAt(c,a.matrix)}s.instanceMatrix.needsUpdate=!0}}}function LS(i){const e=[];for(const[t,n]of[[-2.5,4.6],[-2.5,8],[-2.5,11.4],[-11.8,-2.5],[-8.6,-2.5],[-5.8,-2.5],[14.1,5]]){const s=pe("lantern-pivot");s.position.set(t,fe+4.8,n),i.add(s),ye(.006,.006,.4,4,I("#2a2420",{rim:.1}),{y:-.2,parent:s,cast:!1});const r=pe("lantern");r.position.y=-.5,s.add(r),br(r,{x:0,y:0,z:0,r:.18,color:"#d24a38",text:"",glowSize:1}),yi(r,{x:0,y:0,z:.15,color:"#ff8a5c",size:1.2,opacity:.3}),e.push({pivot:s,phase:an()*Math.PI*2,speed:.7+an()*.6})}return{update(t){for(const n of e)n.pivot.rotation.z=Math.sin(t*n.speed+n.phase)*.12,n.pivot.rotation.x=Math.cos(t*n.speed*.8+n.phase)*.06}}}function zS(i){const e=[];for(const[t,n,s,r]of[[-2.8,2.2,7,4],[-4.2,2,9.6,3],[14.8,1.8,16,3]])for(let a=0;a<r;a+=1){const o=Yt("#e8f0ff",1,0);o.position.set(t+(a-r/2)*.15,n,s),i.add(o),e.push({sp:o,baseX:o.position.x,baseY:n,baseZ:s,phase:a/r*Math.PI*2})}return{update(t){for(const n of e){const s=(t*.18+n.phase/(Math.PI*2))%1;n.sp.position.set(n.baseX+Math.sin(t*.6+n.phase)*.25,n.baseY+s*2.8,n.baseZ),n.sp.scale.setScalar(.3+s*1.8),n.sp.material.opacity=Math.sin(s*Math.PI)*.16}}}}function US(i){const e=pe("city");MS(e);for(const f of k.shops)e.add(dS(e,f));for(let f=0;f<k.houses.length;f+=1)e.add(hS(e,{...k.houses[f],id:`h${f}`}));for(const f of k.apartments)e.add(fS(e,f));pS(e),mS(e),gS(e);const t=yS(e);bS(e),SS(e),wS(e),TS(e),AS(e),NS(e);const n=ES(e),s=CS(e),r=RS(e),a=PS(e),o=IS(e),l=DS(e),c=LS(e),h=zS(e);return{group:e,update(f,p){n.update(f),s.update(f),r.update(f),a.update(f),o.update(f),l.update(f,p),c.update(f),h.update(f),t.board.update(f)}}}function NS(i){const e=pe("signs-plaza");i.add(e);const t=[["-2.25",4.4,"居酒屋","#ff6f5e"],["-2.25",7,"ラーメン","#ff8a5c"],["-2.25",9.6,"古書","#ffd28a"],["-2.25",11.8,"喫茶","#ffcf94"],["-2.25",13.8,"床屋","#9fd8ff"],["-11.8",-2.25,"喫茶","#ffcf94"],["-8.6",-2.25,"薬","#7dffc0"],["-5.8",-2.25,"100円","#ff8a5c"]];for(const[n,s,r,a]of t){const o=Number(n)<0,l=Number(n)+(o?.05:0),c=Number(s),h=document.createElement("canvas");h.width=256,h.height=640;const f=h.getContext("2d");f.fillStyle="#16110f",f.fillRect(0,0,256,640),f.strokeStyle=a,f.lineWidth=7,f.strokeRect(6,6,244,628),f.textAlign="center",f.textBaseline="middle",f.font=`700 68px ${Re}`,f.fillStyle=a,r.split("").forEach((d,m)=>f.fillText(d,128,90+m*82));const u=new Ns(h);u.colorSpace=Dt;const g=new De({map:u,toneMapped:!1});g.color.setScalar(1.5);const y=me(.72,1.8,g,{x:l+.02,y:fe+3.2,z:c,ry:Math.PI/2,parent:e});y.userData.noOutline=!0,C(.8,1.9,.08,I("#20242a",{rim:.2}),{x:l-.03,y:fe+3.2,z:c,ry:Math.PI/2,parent:e,cast:!1}),yi(e,{x:l+.25,y:fe+3.2,z:c,color:a,size:1.8,opacity:.2})}for(const[n,s,r,a]of[[-2.25,-11.8,"喫茶","#ffcf94"],[-2.25,-8.6,"薬","#7dffc0"],[-2.25,-5.8,"100円","#ff8a5c"],[-2.25,-3.4,"洗濯","#7fe8e0"]]){const o=document.createElement("canvas");o.width=256,o.height=640;const l=o.getContext("2d");l.fillStyle="#16110f",l.fillRect(0,0,256,640),l.strokeStyle=a,l.lineWidth=7,l.strokeRect(6,6,244,628),l.textAlign="center",l.textBaseline="middle",l.font=`700 72px ${Re}`,l.fillStyle=a,r.split("").forEach((f,p)=>l.fillText(f,128,100+p*90));const c=new Ns(o);c.colorSpace=Dt;const h=new De({map:c,toneMapped:!1});h.color.setScalar(1.5),me(.72,1.8,h,{x:s,y:fe+3.8,z:-2.2,parent:e}).userData.noOutline=!0,C(.8,1.9,.08,I("#20242a",{rim:.2}),{x:s,y:fe+3.8,z:-2.16,parent:e,cast:!1}),yi(e,{x:s,y:fe+3.8,z:-1.9,color:a,size:1.8,opacity:.2})}C(8,.03,4,I("#2a2a2e",{rim:.1,rimColor:"#8fa8c8"}),{x:0,y:fe+.125,z:.2,parent:e,cast:!1});for(let n=0;n<6;n+=1)C(.5,.01,.5,I("#4a4a4e",{rim:.1}),{x:-3.5+n*1.4,y:fe+.145,z:1.4,parent:e,cast:!1});Fs(e,{x:-3.2,z:1.9,ry:Math.PI}),Fs(e,{x:3.2,z:1.9,ry:Math.PI});for(const n of[-4.2,4.2])ye(.04,.05,4.2,6,I("#4a5058",{rim:.12}),{x:n,y:fe+2.1,z:-2.6,parent:e,cast:!0}),yi(e,{x:n,y:fe+4.2,z:-2.6,color:"#ffcf94",size:2.2,opacity:.3});rf(e,{x0:-4.2,x1:4.2,y:4.3,z:-2.6,count:10,color:"#ffb35e",sag:.6})}const OS=Math.PI*2,Hn=k.storeOffset,Li={...We.store,minX:We.store.minX+Hn.dx,maxX:We.store.maxX+Hn.dx,minZ:We.store.minZ+Hn.dz,maxZ:We.store.maxZ+Hn.dz,canopy:{...We.store.canopy,x0:We.store.canopy.x0+Hn.dx,x1:We.store.canopy.x1+Hn.dx,z0:We.store.canopy.z0+Hn.dz,z1:We.store.canopy.z1+Hn.dz}};function FS(i){return i<0?0:i>1?1:i}function lp(i){const e=FS(i);return e*e*(3-2*e)}function pm(i,e){if(e>k.river.minZ&&e<k.river.maxZ)return k.river.y;const t=e>k.road.ew.minZ&&e<k.road.ew.maxZ,n=i>k.road.ns.minX&&i<k.road.ns.maxX;return t||n?0:.12}function mm(i,e){const t=Li;return i>t.minX&&i<t.maxX&&e>t.minZ&&e<t.maxZ}function gm(i,e){const t=Li.canopy;return i>t.x0&&i<t.x1&&e>t.z0&&e<t.z1}function Pc(i,e){const t=new Ln(1,1),n=new Kf;n.index=t.index,n.setAttribute("position",t.getAttribute("position")),n.setAttribute("uv",t.getAttribute("uv"));for(const s of Object.keys(e)){const r=e[s];n.setAttribute(s,new Us(r.data,r.size))}return n.instanceCount=i,n}function Ic(i,e,t){const n=new lt(i,e);return n.frustumCulled=!1,n.castShadow=!1,n.receiveShadow=!1,n.renderOrder=t,n.userData.isFx=!0,n}const BS=16,kS=`
  uniform float uTime;
  uniform float uIntensity;
  uniform float uTop;
  uniform float uBottom;
  uniform vec2  uWind;
  uniform vec4  uStoreBox;
  uniform vec4  uBlockBox0;
  uniform float uBlockY0;
  uniform vec4  uBlockBox1;
  uniform float uBlockY1;
  uniform vec4  uBlockBox2;
  uniform float uBlockY2;
  uniform vec2  uAreaMin;
  uniform vec2  uAreaMax;
  uniform float uStoreRoofY;
  uniform vec4  uCanopyBox;
  uniform float uCanopyY;
  uniform vec3  uBaseColor;
  uniform vec3  uLightPos[6];
  uniform vec3  uLightColor[6];
  uniform float uLightRadius[6];

  attribute vec4 aA;   // x, z, 每秒下落圈数, 相位
  attribute vec4 aB;   // 长度, 宽度, 亮度, 受灯光影响的增益
  attribute vec2 aC;   // 每根雨丝自己的风斜倍率 x/z（让每根雨丝倾斜略有差别）

  varying vec3  vColor;
  varying float vAlpha;
  varying vec2  vUv;

  void main() {
    vUv = uv;
    float x = aA.x;
    float z = aA.y;

    // 落到屋顶 / 雨棚上的雨丝到此为止：不会穿过屋顶掉进店里
    float floorY = uBottom;
    if ( x > uStoreBox.x && x < uStoreBox.y && z > uStoreBox.z && z < uStoreBox.w ) {
      floorY = uStoreRoofY;
    } else if ( x > uCanopyBox.x && x < uCanopyBox.y && z > uCanopyBox.z && z < uCanopyBox.w ) {
      floorY = uCanopyY;
    }
    if ( x > uBlockBox0.x && x < uBlockBox0.y && z > uBlockBox0.z && z < uBlockBox0.w ) floorY = max( floorY, uBlockY0 );
    if ( x > uBlockBox1.x && x < uBlockBox1.y && z > uBlockBox1.z && z < uBlockBox1.w ) floorY = max( floorY, uBlockY1 );
    if ( x > uBlockBox2.x && x < uBlockBox2.y && z > uBlockBox2.z && z < uBlockBox2.w ) floorY = max( floorY, uBlockY2 );
    float span = max( uTop - floorY, 0.001 );
    float cyc = fract( aA.w + uTime * aA.z );
    vec3 base = vec3( x, uTop - cyc * span, z );

    // 斜向雨丝（整体风斜 + 每根自己的倍率）；宽度方向 = 下落方向 × 视线方向
    vec3 fallDir = normalize( vec3( uWind.x * aC.x, -1.0, uWind.y * aC.y ) );
    vec3 toCam = cameraPosition - base;
    float camDist = length( toCam );
    vec3 side = normalize( cross( fallDir, toCam / max( camDist, 0.001 ) ) + vec3( 0.0001, 0.0, 0.0 ) );

    // 远处雨丝更细、更短（细密雨幕），近处略粗但更淡（不抢戏）
    float nearness = 1.0 - smoothstep( 5.0, 19.0, camDist );
    float lenScale = mix( 0.82, 1.1, nearness );
    float widScale = mix( 0.85, 1.1, nearness );

    vec3 wp = base + side * ( position.x * aB.y * widScale ) + fallDir * ( position.y * aB.x * lenScale );
    gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );

    // 太贴脸的、刚好在循环端点的、雨幕边缘的雨丝淡出
    float fadeNear = smoothstep( 0.9, 4.5, camDist );
    float fadeEnds = smoothstep( 0.0, 0.06, cyc ) * ( 1.0 - smoothstep( 0.93, 1.0, cyc ) );
    float fadeFar = exp( -camDist * 0.012 );
    float edge = min( min( aA.x - uAreaMin.x, uAreaMax.x - aA.x ), min( aA.y - uAreaMin.y, uAreaMax.y - aA.y ) );
    float fadeRim = smoothstep( 0.0, 0.55, edge );
    float alphaDist = mix( 1.0, 0.55, nearness );
    vAlpha = aB.z * fadeNear * fadeEnds * fadeFar * fadeRim * alphaDist * uIntensity;

    // 被店前暖光 / 雨棚灯 / 路灯 / 贩卖机 / 霓虹染亮 —— 雨丝的"层次"
    vec3 lit = vec3( 0.0 );
    for ( int i = 0; i < 6; i ++ ) {
      float d = length( base - uLightPos[ i ] );
      float f = 1.0 - smoothstep( uLightRadius[ i ] * 0.2, uLightRadius[ i ], d );
      lit += uLightColor[ i ] * f;
    }
    vColor = uBaseColor + lit * ( aB.w * 1.35 );
  }
`,VS=`
  varying vec3  vColor;
  varying float vAlpha;
  varying vec2  vUv;

  void main() {
    // 条带横向柔边 + 沿长度收细（雨滴头部更亮、尾部渐隐）
    float edge = smoothstep( 0.0, 0.42, vUv.x ) * ( 1.0 - smoothstep( 0.58, 1.0, vUv.x ) );
    float taper = 1.0 - 0.6 * vUv.y;
    float a = vAlpha * edge * taper;
    if ( a < 0.0025 ) discard;
    gl_FragColor = vec4( vColor, a );
  }
`,cp=[{p:[Hn.dx+.3,2.8,Hn.dz+3],r:5,color:"#ffcf94",gain:.8},{p:[-2.6,2.8,8],r:4,color:"#ff8a5c",gain:.7},{p:[-2.6,2.8,13],r:3.6,color:"#ffb45e",gain:.65},{p:[-18.4,2.8,7.2],r:4,color:"#ff6f5c",gain:.5},{p:[16.6,3,2],r:3.6,color:"#9fd8ff",gain:.5},{p:[-10.5,3,-9.8],r:3.8,color:"#ffcf94",gain:.45}];function HS(i){const e=i.isMobile?1300:2900,t=li(202601),n=new Float32Array(e*4),s=new Float32Array(e*4),r=new Float32Array(e*2);for(let p=0;p<e;p+=1){const u=p*4,g=p*2;n[u]=k.bounds.minX+t()*(k.bounds.maxX-k.bounds.minX),n[u+1]=k.bounds.minZ+t()*(k.bounds.maxZ-k.bounds.minZ),n[u+2]=.85+t()*1.35,n[u+3]=t(),s[u]=.2+Math.pow(t(),1.4)*.9,s[u+1]=.017+t()*.013,s[u+2]=.078+t()*.17,s[u+3]=.3+t()*.55,r[g]=.55+t()*.9,r[g+1]=.5+t()*1}const a=[],o=[],l=new Float32Array(cp.length);cp.forEach((p,u)=>{a.push(new w(p.p[0],p.p[1],p.p[2]));const g=new re(p.color).multiplyScalar(p.gain);o.push(new w(g.r,g.g,g.b)),l[u]=p.r});const c=Li,h=new At({uniforms:{uTime:{value:0},uIntensity:{value:1},uTop:{value:BS},uBottom:{value:0},uWind:{value:new $(.5,.16)},uStoreBox:{value:new ot(c.minX,c.maxX,c.minZ,c.maxZ)},uStoreRoofY:{value:c.parapetY+.1},uCanopyBox:{value:new ot(c.canopy.x0,c.canopy.x1,c.canopy.z0,c.canopy.z1)},uCanopyY:{value:c.canopy.y+.06},uBlockBox0:{value:new ot(-6.6,-2.4,3.2,15.2)},uBlockY0:{value:7},uBlockBox1:{value:new ot(k.bounds.minX,-2.6,k.bounds.minZ,-2.6)},uBlockY1:{value:13},uBlockBox2:{value:new ot(k.bounds.minX,-2.6,2.8,k.river.minZ)},uBlockY2:{value:9},uAreaMin:{value:new $(k.bounds.minX,k.bounds.minZ)},uAreaMax:{value:new $(k.bounds.maxX,k.bounds.maxZ)},uBaseColor:{value:new w(.45,.57,.82)},uLightPos:{value:a},uLightColor:{value:o},uLightRadius:{value:l}},vertexShader:kS,fragmentShader:VS,transparent:!0,depthWrite:!1,depthTest:!0,blending:ii,side:St,fog:!1}),f=Ic(Pc(e,{aA:{data:n,size:4},aB:{data:s,size:4},aC:{data:r,size:2}}),h,30);return f.name="fx-rain",f.update=p=>{h.uniforms.uTime.value=p,h.uniforms.uIntensity.value=1+.12*Math.sin(p*.055+1.2)*Math.sin(p*.017)},{mesh:f,count:e}}const $o=660,GS=`
  uniform float uTime;

  attribute vec3 aC;   // 落点
  attribute vec4 aP;   // 起始(0~1), 频率(圈/秒), 持续(0~1), 相位
  attribute vec4 aQ;   // 最大半径, 强度, 环宽, 内圈比例

  varying vec2  vUv;
  varying float vProg;
  varying float vAlpha;
  varying float vWidth;
  varying float vInner;

  void main() {
    vUv = uv;
    float q = fract( aP.w + uTime * aP.y );
    float p = ( q - aP.x ) / max( aP.z, 0.0001 );
    float prog = clamp( p, 0.0, 1.0 );
    float alive = step( 0.0, p ) * step( p, 1.0 );
    vProg = prog;
    vAlpha = aQ.y * alive * pow( 1.0 - prog, 1.5 );
    vWidth = aQ.z;
    vInner = aQ.w;

    vec3 wp = aC + vec3( position.x, 0.0, position.y ) * aQ.x * 2.0;
    gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );
  }
`,WS=`
  varying vec2  vUv;
  varying float vProg;
  varying float vAlpha;
  varying float vWidth;
  varying float vInner;

  void main() {
    float d = length( ( vUv - 0.5 ) * 2.0 );
    float ring = 1.0 - smoothstep( 0.0, vWidth, abs( d - vProg ) );
    float ring2 = 1.0 - smoothstep( 0.0, vWidth * 0.7, abs( d - vProg * vInner ) );
    float a = ( ring + ring2 * 0.5 ) * vAlpha * 0.55;
    if ( a < 0.003 ) discard;
    gl_FragColor = vec4( vec3( 0.35, 0.5, 0.85 ), a );
  }
`;function XS(i,e,t){const n=li(7731),s=new Float32Array($o*3),r=new Float32Array($o*4),a=new Float32Array($o*4);let o=0;const l=(g,y,d,m,_,x,v,E,T,R,P)=>{if(o>=$o)return;const S=o*3,M=o*4;s[S]=g,s[S+1]=y,s[S+2]=d,r[M]=m,r[M+1]=_,r[M+2]=x,r[M+3]=v,a[M]=E,a[M+1]=T,a[M+2]=R,a[M+3]=P,o+=1},c=e.isMobile?170:340;for(let g=0;g<c;g+=1){let y=0,d=0;for(let m=0;m<10&&(y=-5.3+n()*10.6,d=-5.3+n()*10.6,!(!mm(y,d)&&!gm(y,d)));m+=1);l(y,pm(y,d)+.007,d,0,1.1+n()*1.6,1,n(),.06+n()*.1,.16+n()*.2,.1,.55)}const h=[];i.scene.traverse(g=>{g.userData&&g.userData.isPuddle&&h.push(g)});const f=new w;for(const g of h){g.updateWorldMatrix(!0,!1);const y=12+Math.floor(n()*8);for(let d=0;d<y;d+=1){const m=Math.sqrt(n())*.36,_=n()*OS;f.set(Math.cos(_)*m,Math.sin(_)*m,0).applyMatrix4(g.matrixWorld),l(f.x,f.y+.004,f.z,0,.55+n()*.85,1,n(),.09+n()*.13,.24+n()*.2,.08,.62)}}for(const g of t)l(g.landX,g.landY+.006,g.landZ,g.fallFrac,1/g.period,g.rippleFrac,g.phase,.09+n()*.09,.3,.1,.55);const p=new At({uniforms:{uTime:{value:0}},vertexShader:GS,fragmentShader:WS,transparent:!0,depthWrite:!1,depthTest:!0,blending:In,side:St,fog:!1}),u=Ic(Pc(o,{aC:{data:s,size:3},aP:{data:r,size:4},aQ:{data:a,size:4}}),p,10);return u.name="fx-ripples",u.update=g=>{p.uniforms.uTime.value=g},{mesh:u,count:o}}const YS=`
  uniform float uTime;

  attribute vec3 aC;   // 起点
  attribute vec4 aP;   // 周期(s), 相位, 下落占周期比例, 水滴大小
  attribute vec2 aQ;   // 下落距离, 横向摆动

  varying vec2  vUv;
  varying float vAlpha;

  void main() {
    vUv = uv;
    float period = max( aP.x, 0.2 );
    float q = fract( ( uTime + aP.y ) / period );
    float k = clamp( q / max( aP.z, 0.05 ), 0.0, 1.0 );
    float alive = step( q, aP.z + 0.0001 );

    vec3 wp = aC + vec3( sin( q * 21.0 + aP.y * 3.0 ) * aQ.y, -k * aQ.x, 0.0 );

    vec4 mv = modelViewMatrix * vec4( wp, 1.0 );
    mv.xy += position.xy * vec2( aP.w, aP.w * 2.6 );
    gl_Position = projectionMatrix * mv;

    vAlpha = alive * smoothstep( 0.0, 0.045, k ) * ( 1.0 - smoothstep( 0.9, 1.0, k ) );
  }
`,ZS=`
  varying vec2  vUv;
  varying float vAlpha;

  void main() {
    float d = length( vUv - 0.5 ) * 2.0;
    float a = ( 1.0 - smoothstep( 0.28, 1.0, d ) ) * vAlpha;
    if ( a < 0.004 ) discard;
    gl_FragColor = vec4( vec3( 0.76, 0.87, 1.0 ) * 1.1, a );
  }
`;function qS(i){const e=li(451),t=[],n=i.dripPoints;if(Array.isArray(n)&&n.length)for(const f of n){if(t.length>=26)break;if(!f)continue;const p=f.isVector3?f:new w(f.x,f.y,f.z);Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)&&t.push(new w(p.x,p.y,p.z))}if(!t.length){const f=Li.canopy,p=8;for(let u=0;u<p;u+=1){const g=f.x0+.1+(f.x1-f.x0-.2)*(u/(p-1))+(e()-.5)*.09;t.push(new w(g,f.y-.05,f.z1+.004))}}const s=t.length,r=[];for(const f of t){const p=1.4+e()*3,u=.14+e()*.16,g=Li.canopy;let y;mm(f.x,f.z)&&f.y>Li.parapetY?y=Li.parapetY+.04:gm(f.x,f.z)&&f.y>g.y+.05?y=g.y+.05:y=pm(f.x,f.z)+.004;const d=Math.max(.25,f.y-y);r.push({startX:f.x,startY:f.y,startZ:f.z,period:p,phase:e(),fallFrac:u,size:.015+e()*.01,fallDist:d,wobble:(e()-.5)*.02,landX:f.x,landY:y,landZ:f.z,rippleFrac:Math.min(.42,.45/p)})}const a=new Float32Array(s*3),o=new Float32Array(s*4),l=new Float32Array(s*2);r.forEach((f,p)=>{const u=p*3,g=p*4;a[u]=f.startX,a[u+1]=f.startY,a[u+2]=f.startZ,o[g]=f.period,o[g+1]=f.phase,o[g+2]=f.fallFrac,o[g+3]=f.size,l[p*2]=f.fallDist,l[p*2+1]=f.wobble});const c=new At({uniforms:{uTime:{value:0}},vertexShader:YS,fragmentShader:ZS,transparent:!0,depthWrite:!1,depthTest:!0,blending:In,side:St,fog:!1}),h=Ic(Pc(s,{aC:{data:a,size:3},aP:{data:o,size:4},aQ:{data:l,size:2}}),c,22);return h.name="fx-drips",h.update=f=>{c.uniforms.uTime.value=f},{mesh:h,drips:r,count:s}}const $S=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`,KS=`
  uniform float uTime;
  uniform float uOpacity;
  uniform float uAspect;

  varying vec2 vUv;

  float hash21( vec2 p ) {
    p = fract( p * vec2( 123.34, 456.21 ) );
    p += dot( p, p + 45.32 );
    return fract( p.x * p.y );
  }

  float hash11( float p ) {
    p = fract( p * 0.1031 );
    p *= p + 33.33;
    p *= p + p;
    return fract( p );
  }

  void main() {
    vec2 uv = vUv;
    // 水痕是"暗"的（折射了外面的夜色），水珠高光是"亮"的，两种分开累计
    vec3 darkCol = vec3( 0.09, 0.13, 0.2 );
    vec3 brightCol = vec3( 0.78, 0.9, 1.05 );
    float darkA = 0.0;
    float brightA = 0.0;

    // ---- 缓慢下滑的水珠 + 身后拖出的水痕（两层，速度不同） ----
    for ( int i = 0; i < 2; i ++ ) {
      float fi = float( i );
      float cols = 8.0 + fi * 6.0;
      float cid = floor( uv.x * cols );
      float cw = 1.0 / cols;
      float h1 = hash21( vec2( cid, fi * 7.31 + 1.7 ) );
      float h2 = hash21( vec2( cid + 3.1, fi * 3.7 + 2.3 ) );
      float speed = ( 0.012 + h1 * 0.024 ) * ( 1.0 + fi * 0.85 );
      float headY = 1.0 - fract( h2 + uTime * speed );
      float cx = ( cid + 0.5 ) * cw + ( h1 - 0.5 ) * cw * 0.55;

      // 蜿蜒：路径随高度左右摇摆
      float pathX = cx + sin( uv.y * 15.0 + h1 * 9.0 + uTime * 0.55 ) * ( 0.0018 + h2 * 0.0024 );
      float dx = abs( uv.x - pathX );
      float line = 1.0 - smoothstep( 0.0008, 0.0030 + fi * 0.0012, dx );

      float trailLen = 0.09 + h2 * 0.2;
      float ty = ( uv.y - headY ) / trailLen;
      float inTrail = step( 0.0, ty ) * step( ty, 1.0 );

      float lw = 0.48 - fi * 0.14;
      // 水痕主体（暗）
      darkA += line * inTrail * pow( clamp( 1.0 - ty, 0.0, 1.0 ), 1.7 ) * lw * 1.0;

      // 水珠头部（亮）
      vec2 hp = vec2( ( uv.x - cx ) * uAspect, uv.y - headY );
      float head = 1.0 - smoothstep( 0.010, 0.023, length( hp ) );
      brightA += head * lw * 0.85;
      // 头部下方一小截也更亮
      brightA += line * inTrail * ( 1.0 - smoothstep( 0.0, 0.28, ty ) ) * lw * 0.3;
    }

    // ---- 静止的细小水珠（凝结，稀疏/错位摆放，别像雪花） ----
    vec2 cell = uv * vec2( 34.0, 18.0 );
    vec2 gid = floor( cell );
    vec2 jitter = vec2( hash21( gid + 3.1 ), hash21( gid + 9.7 ) ) - 0.5;
    vec2 gf = fract( cell ) - 0.5 - jitter * 0.55;
    float hb = hash21( gid + 17.7 );
    float beadRadius = 0.04 + 0.07 * hash21( gid + 4.1 );
    float bead = ( 1.0 - smoothstep( beadRadius * 0.5, beadRadius, length( vec2( gf.x * uAspect * 0.5, gf.y ) ) ) ) * step( 0.91, hb );
    brightA += bead * 0.035;

    // ---- 整体水膜 / 竖向水痕（暗） ----
    float cols3 = 34.0;
    float c3 = floor( uv.x * cols3 );
    float h3 = hash11( c3 * 1.7 + 3.0 );
    float film = smoothstep( 0.6, 0.98, h3 ) * ( 0.55 + 0.45 * sin( uv.y * 9.0 + h3 * 30.0 ) );
    darkA += film * 0.055;

    // ---- 玻璃内侧透出的暖光让水珠偏暖 ----
    vec3 warm = vec3( 1.0, 0.82, 0.52 );
    brightCol = mix( brightCol, warm, ( 1.0 - smoothstep( 0.1, 0.95, uv.y ) ) * 0.35 );

    float aTotal = darkA + brightA;
    if ( aTotal < 0.004 ) discard;
    vec3 c = ( darkCol * darkA + brightCol * brightA ) / aTotal;
    gl_FragColor = vec4( c, min( aTotal, 1.0 ) * uOpacity );
  }
`;function JS(){const i=Li,e=pe("glass-rain"),t=i.windowX1-i.windowX0,n=i.glassY1-i.glassY0,s=i.maxZ+.014,r=(f,p)=>new At({uniforms:{uTime:{value:0},uOpacity:{value:p},uAspect:{value:f/n}},vertexShader:$S,fragmentShader:KS,transparent:!0,depthWrite:!1,depthTest:!0,blending:ii,side:St,fog:!1}),a=r(t,.28),o=new lt(new Ln(t,n),a);o.position.set((i.windowX0+i.windowX1)/2,(i.glassY0+i.glassY1)/2,s),o.renderOrder=20,o.userData.isFx=!0,o.name="fx-glass-rain-window",e.add(o);const l=i.doorX1-i.doorX0,c=r(l,.24),h=new lt(new Ln(l,n),c);return h.position.set((i.doorX0+i.doorX1)/2,(i.glassY0+i.glassY1)/2,s),h.renderOrder=21,h.userData.isFx=!0,h.name="fx-glass-rain-door",e.add(h),{group:e,winMat:a,doorMat:c,baseDoorOpacity:.24}}function jS(i,e){const t=li(7719),n=[],s=new Set,r=(h,f)=>{if(!h||!h.color||s.has(h.uuid))return;s.add(h.uuid);const p=f&&f.isColor?f.clone():h.color.clone(),u=typeof f=="number"?f:null;n.push({kind:"mat",mat:h,baseColor:p,baseScalar:u,next:6+t()*14,t0:-1,dur:.6,depth:.08,pulses:2})},a=(h,f)=>{!h||s.has(h.uuid)||(s.add(h.uuid),n.push({kind:"light",light:h,base:typeof f=="number"?f:h.intensity,next:10+t()*22,t0:-1,dur:.6,depth:.07,pulses:2}))},o=()=>{for(const h of i.flickerMats||[])h&&h.mat&&r(h.mat,h.base);for(const h of i.flickerLights||[])h&&h.light&&a(h.light,h.base);if(!n.length){let h=null;e.traverse(f=>{!h&&f.isMesh&&f.name==="main-sign"&&f.material&&f.material.color&&(h=f)}),h&&r(h.material,h.material.color.r)}};o();const l=(h,f)=>{h.kind==="mat"?h.baseScalar!==null?h.mat.color.setScalar(h.baseScalar*f):h.mat.color.copy(h.baseColor).multiplyScalar(f):h.light.intensity=h.base*f};return{items:n,update:h=>{for(let f=0;f<n.length;f+=1){const p=n[f];if(p.t0<0){if(h<p.next)continue;p.t0=h,p.dur=.35+t()*.85,p.depth=.05+t()*.09,p.pulses=2+Math.floor(t()*3)}const u=(h-p.t0)/p.dur;if(u>=1)l(p,1),p.t0=-1,p.next=h+10+t()*24;else{const g=1-p.depth*Math.abs(Math.sin(u*Math.PI*p.pulses));l(p,g)}}},scan:o}}function QS(i){const e=i.door;if(!e||!e.left||!e.right)return null;const t=(m,_)=>typeof m=="number"&&Number.isFinite(m)?m:m&&typeof m.x=="number"?m.x:Array.isArray(m)&&typeof m[0]=="number"?m[0]:_,n=m=>{if(Array.isArray(m)){if(m.length>=2&&(typeof m[0]=="number"||m[0]&&typeof m[0].x=="number"))return[t(m[0],null),t(m[1],null)];const x=t(m,null);return[x,x]}const _=t(m,null);return[_,_]},s=e.left.position?e.left.position.x:0,r=e.right.position?e.right.position.x:0,a=n(e.closedX),o=n(e.openX),l=[a[0]??s,a[1]??r],c=[o[0]??l[0],o[1]??l[1]];if(Math.abs(c[0]-l[0])<1e-4&&Math.abs(c[1]-l[1])<1e-4)return null;const h={open:0,light:null,lightBase:1,lightFound:!1},f=new w((We.store.doorX0+We.store.doorX1)/2+Hn.dx,1.6,We.store.maxZ-.6+Hn.dz),p=Li,u=new De({map:Ac(),color:new re("#ffb877"),transparent:!0,opacity:0,blending:In,depthWrite:!1,toneMapped:!0,fog:!1}),g=new lt(new Ln(1,1),u);g.rotation.x=-Math.PI/2,g.position.set((p.doorX0+p.doorX1)/2,.131,p.maxZ+.72),g.scale.set(3.6,2.3,1),g.renderOrder=7,g.userData.isFx=!0,g.name="fx-door-spill";const y=30;return{spill:g,update:m=>{const _=m%y;let x;if(_<23?x=0:_<25?x=lp((_-23)/2):_<28?x=1:x=1-lp((_-28)/2),h.open=x,e.left.position&&(e.left.position.x=l[0]+(c[0]-l[0])*x),e.right.position&&(e.right.position.x=l[1]+(c[1]-l[1])*x),u.opacity=x*.26,!h.lightFound){h.lightFound=!0;let v=null,E=1/0;const T=i.pointLights||[];for(let R=0;R<T.length;R+=1){const P=T[R].position.distanceToSquared(f);P<E&&(E=P,v=T[R])}v&&E<4&&(h.light=v,h.lightBase=v.intensity)}h.light&&(h.light.intensity=h.lightBase*(1+.5*x))},state:h}}const ew=`
  uniform float uTime;

  attribute vec3 aC;   // 源点
  attribute vec4 aP;   // 相位, 频率, 基础大小, 不透明度
  attribute vec3 aD;   // 漂移方向

  varying vec2  vUv;
  varying float vAlpha;

  void main() {
    vUv = uv;
    float q = fract( aP.x + uTime * aP.y );
    float grow = 0.45 + q * 2.8;
    vec3 wp = aC + aD * q
      + vec3( sin( q * 6.0 + aP.x * 9.0 ) * 0.05 * q, q * 0.6, cos( q * 5.0 + aP.x * 7.0 ) * 0.05 * q );
    vec4 mv = modelViewMatrix * vec4( wp, 1.0 );
    float sz = aP.z * grow;
    mv.xy += position.xy * vec2( sz, sz );
    gl_Position = projectionMatrix * mv;
    vAlpha = aP.w * sin( q * 3.14159 ) * ( 1.0 - q * 0.35 );
  }
`,tw=`
  varying vec2  vUv;
  varying float vAlpha;
  void main() {
    float d = length( vUv - 0.5 ) * 2.0;
    float a = pow( max( 1.0 - d, 0.0 ), 1.6 ) * vAlpha;
    if ( a < 0.004 ) discard;
    gl_FragColor = vec4( vec3( 0.9, 0.92, 0.95 ), a );
  }
`;function nw(i,e){const t=Array.isArray(i.steamSources)?i.steamSources.filter(Boolean):[];if(!t.length)return null;const n=t.slice(0,4),s=e.isMobile?4:7,r=n.length*s,a=li(3119),o=new Float32Array(r*3),l=new Float32Array(r*4),c=new Float32Array(r*3);let h=0;for(const u of n){const g=u.x??0,y=u.y??1,d=u.z??0;for(let m=0;m<s;m+=1){const _=h*3,x=h*4;o[_]=g+(a()-.5)*.1,o[_+1]=y,o[_+2]=d+(a()-.5)*.1,l[x]=a(),l[x+1]=.16+a()*.16,l[x+2]=.05+a()*.05,l[x+3]=.05+a()*.05,c[_]=(a()-.5)*.12,c[_+1]=0,c[_+2]=(a()-.5)*.12,h+=1}}const f=new At({uniforms:{uTime:{value:0}},vertexShader:ew,fragmentShader:tw,transparent:!0,depthWrite:!1,depthTest:!0,blending:In,side:St,fog:!1}),p=Ic(Pc(r,{aC:{data:o,size:3},aP:{data:l,size:4},aD:{data:c,size:3}}),f,25);return p.name="fx-steam",p.update=u=>{f.uniforms.uTime.value=u},{mesh:p,count:r}}const iw=`
  uniform float uTime;
  varying vec2  vUv;
  varying float vH;

  void main() {
    vUv = uv;
    vH = position.y + 0.5;
    vec3 p = position;
    p.x += sin( uTime * 0.35 + vH * 5.0 ) * 0.02 * vH;
    p.z += cos( uTime * 0.29 + vH * 4.0 ) * 0.02 * vH;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
  }
`,sw=`
  uniform float uTime;
  varying vec2  vUv;
  varying float vH;

  void main() {
    float n = 0.78 + 0.22 * sin( vUv.x * 26.0 + uTime * 0.5 ) * sin( vH * 9.0 - uTime * 0.33 );
    float a = pow( clamp( vH, 0.0, 1.0 ), 1.7 ) * n * 0.05;
    if ( a < 0.002 ) discard;
    gl_FragColor = vec4( vec3( 1.0, 0.82, 0.58 ), a );
  }
`;function rw(i){if(i.isMobile)return null;const e={x:2.2,y:4.5,z:2.2},t=e.y-.05,n=t-.1,s=new Er(1,1,24,3,!0),r=new At({uniforms:{uTime:{value:0}},vertexShader:iw,fragmentShader:sw,transparent:!0,depthWrite:!1,depthTest:!0,blending:In,side:St,fog:!1}),a=new lt(s,r);return a.scale.set(1.9,n,1.9),a.position.set(e.x,t-n/2,e.z),a.renderOrder=6,a.userData.isFx=!0,a.name="fx-lamp-mist",a.update=o=>{r.uniforms.uTime.value=o},{mesh:a}}function aw(i){const e=pe("fx"),{handles:t,scene:n,quality:s}=i,r=[],a=HS(s);e.add(a.mesh),r.push(m=>a.mesh.update(m));const o=qS(t);e.add(o.mesh),r.push(m=>o.mesh.update(m));const l=XS(i,s,o.drips);e.add(l.mesh),r.push(m=>l.mesh.update(m));const c=JS();e.add(c.group);const h=[];(()=>{h.length=0;const m=t.glass;if(m&&m.uniforms){const _=Object.keys(m.uniforms);for(let x=0;x<_.length;x+=1){const v=m.uniforms[_[x]];v&&typeof v.value=="number"&&/time/i.test(_[x])&&h.push(v)}}})();const p=jS(t,n);let u=!1;r.push(()=>{u||(u=!0,p.scan(),t.debug&&t.debug.fx&&(t.debug.fx.flicker=p.items.length))}),r.push(m=>p.update(m));const g=QS(t);g&&(e.add(g.spill),r.push(m=>g.update(m))),r.push(m=>{c.winMat.uniforms.uTime.value=m,c.doorMat.uniforms.uTime.value=m;const _=g?g.state.open:0;c.doorMat.uniforms.uOpacity.value=c.baseDoorOpacity*(1-_*.92);for(let x=0;x<h.length;x+=1)h[x].value=m});const y=nw(t,s);y&&(e.add(y.mesh),r.push(m=>y.mesh.update(m)));const d=rw(s);return d&&(e.add(d.mesh),r.push(m=>d.mesh.update(m))),t.debug&&(t.debug.fx={rain:a.count,ripples:l.count,drips:o.count,steam:y?y.count:0,flicker:p.items.length,door:!!g,mist:!!d}),{group:e,update(m,_){for(let x=0;x<r.length;x+=1)r[x](m,_)}}}const qn=new URLSearchParams(location.search),Ko=matchMedia("(max-width: 760px), (pointer: coarse)").matches,ym=qn.has("still");let tl=qn.has("freeze");const hp=qn.has("t")?Number(qn.get("t")):null,xi={isMobile:Ko,dpr:Math.min(devicePixelRatio||1,Ko?1.25:2),shadows:!Ko,bloom:Ko?.72:1},_m=document.getElementById("scene"),ri=new g0({canvas:_m,antialias:!1,powerPreference:"high-performance",stencil:!1});ri.setPixelRatio(xi.dpr);ri.setSize(innerWidth,innerHeight);ri.outputColorSpace=Dt;ri.toneMapping=mi;ri.shadowMap.enabled=xi.shadows;ri.shadowMap.type=hf;const Wt=new If;Wt.fog=new Fa(bt.fog,.0065);const $t=new Jt(im.hero.fov,innerWidth/innerHeight,.08,420);$t.layers.enable(1);const ta=new At({uniforms:{uTop:{value:new re(bt.bgTop)},uHorizon:{value:new re(bt.bgHorizon)},uBottom:{value:new re(bt.bgBottom)},uGlow:{value:new re("#3a2b2a")}},vertexShader:`
    varying vec3 vDir;
    void main() {
      vDir = normalize( position );
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,fragmentShader:`
    uniform vec3 uTop;
    uniform vec3 uHorizon;
    uniform vec3 uBottom;
    uniform vec3 uGlow;
    varying vec3 vDir;
    void main() {
      float h = vDir.y;
      vec3 col = mix( uBottom, uHorizon, smoothstep( -0.25, 0.03, h ) );
      col = mix( col, uTop, smoothstep( 0.02, 0.6, h ) );
      // 地平线处的一团城市暖光（南侧偏右）
      float glow = smoothstep( 0.45, 1.0, -vDir.z * 0.5 + 0.5 ) * smoothstep( 0.22, -0.05, h ) * smoothstep( -0.35, 0.02, h );
      col += uGlow * glow * 0.5;
      gl_FragColor = vec4( col, 1.0 );
    }
  `,side:on,depthWrite:!1,fog:!1}),xm=new lt(new Fi(80,32,24),ta);xm.renderOrder=-10;Wt.add(xm);const ow=Ac(),Ra=new lt(new Ln(88,66),new De({map:ow,color:"#01030a",transparent:!0,opacity:.9,depthWrite:!1,blending:ii}));Ra.rotation.x=-Math.PI/2;Ra.position.y=-1.2;Wt.add(Ra);const fa=new Zf(bt.hemiSky,bt.hemiGround,.5);Wt.add(fa);const qt=new Cr(bt.moon,.85);qt.position.set(-8,22,16);qt.castShadow=xi.shadows;qt.shadow.mapSize.set(2048,2048);qt.shadow.camera.left=-32;qt.shadow.camera.right=32;qt.shadow.camera.top=32;qt.shadow.camera.bottom=-32;qt.shadow.camera.near=1;qt.shadow.camera.far=60;qt.shadow.bias=-5e-4;qt.shadow.normalBias=.025;Wt.add(qt);Wt.add(qt.target);qt.target.position.set(0,0,.2);const Dc=new Cr("#365072",.18);Dc.position.set(3,-4,-6);Wt.add(Dc);const Lc=new Cr("#5c7cae",.3);Lc.position.set(9,6,12);Wt.add(Lc);const zc=new Cr("#6b8fc4",.5);zc.position.set(-9,5.5,-4);Wt.add(zc);const Uc=[],Nc={interior:[]};function qa(i,e=""){const t=bt[i.color]||i.color,n=new $f(t,i.intensity,i.distance,i.decay??2);return n.position.set(i.x,i.y,i.z),n.castShadow=!1,Wt.add(n),Uc.push(n),e&&(Nc[e]=n),n}const Hl=k.storeOffset;for(const i of We.lights.interior)Nc.interior.push(qa({...i,x:i.x+Hl.dx,z:i.z+Hl.dz}));qa(We.lights.canopy,"canopy");qa(We.lights.sign,"sign");qa({...We.lights.vending,x:We.lights.vending.x+Hl.dx,z:We.lights.vending.z+Hl.dz});for(const i of k.townLights)qa(i);const Dr=new Sc("#ffcf9a",7.5,7.5,.95,.8,1.7);Dr.position.set(.45+k.storeOffset.dx,2.55,1.35+k.storeOffset.dz);Dr.target.position.set(.45+k.storeOffset.dx,0,2.7+k.storeOffset.dz);Wt.add(Dr);Wt.add(Dr.target);const Lr=new Sc("#ffb45e",12,12,.85,.72,1.7);Lr.position.set(2.2,4.5,2.2);Lr.target.position.set(2.2,0,1.6);Wt.add(Lr);Wt.add(Lr.target);const Bs={pointLights:Uc,lightMap:Nc,moonLight:qt,door:null,glass:null,flickerMats:[],flickerLights:[],dripPoints:[],steamSources:[],update:[],quality:xi,time:{value:0},debug:{}},Pa=new di;Pa.name="diorama";Wt.add(Pa);const vm=[];function Ws(i,e){const t=e({root:Pa,scene:Wt,handles:Bs,quality:xi,params:qn})||{};return vm.push(t),t.group&&Pa.add(t.group),t}Ws("base",Sb);Ws("ground",Pb);const lw=Ws("store",Db),cw=Ws("interior",tS),hw=qn.get("details")!=="0"?Ws("interior-details",iS):null;for(const i of[lw,cw,hw])i&&i.group&&i.group.position.set(k.storeOffset.dx,0,k.storeOffset.dz);Ws("city",US);const Oh=Ws("fx",aw);function Oc(i,e,t,n){const s=new di;s.position.set(i,e,t),s.rotation.y=n;const r=new lt(new Dn(.16,.08,.1),new De({color:"#2b2f36"}));r.position.set(0,.16,.02),s.add(r);const a=new lt(new Xn(.11,.16,.08,12,1,!0),new De({color:"#ffd9a0",side:St}));a.position.set(0,.1,.08),s.add(a);const o=new lt(new Fi(.055,10,8),new De({color:new re("#ffe0aa").multiplyScalar(1.6)}));o.position.set(0,.08,.09),s.add(o);const l=Yt("#ffd9a0",1.4,.22);l.position.set(0,.08,.2),s.add(l);const c=new lt(new Dn(.05,.05,.16),new De({color:"#3a3f48"}));c.position.set(0,.2,0),s.add(c),Pa.add(s)}Oc(-5.52,2.45,-1.9,-Math.PI/2);Oc(-5.52,2.45,.55,-Math.PI/2);Oc(-1.1,2.55,-4.52,Math.PI);Oc(1.4,2.4,-4.52,Math.PI);Bs.flickerLights=Bs.flickerLights||[];for(const i of["sign","canopy","neonPink","streetLamp"]){const e=Nc[i];e&&Bs.flickerLights.push({light:e,base:e.intensity})}const Gl=structuredClone(im);function Mm(i){const e=innerWidth/innerHeight;let t=i.radius,n=i.fov,s=i.target;if(e<1.05){n=Math.max(n,48);const a=44/(2*Math.tan(n*Math.PI/360)*e);t=Math.max(t*1.02,a),s=[i.target[0],i.target[1]+.75,i.target[2]]}return{radius:t,fov:n,target:s,az:i.az,el:i.el}}function lu(i,e=!0){const t=Mm(Gl[i]||Gl.hero);$t.fov=t.fov,$t.updateProjectionMatrix(),$t.position.setFromSphericalCoords(t.radius,t.el,t.az).add(new w(...t.target)),ut.target.set(...t.target),e&&(ut.update(),Fc())}const ut=new zM($t,_m);ut.enableDamping=!0;ut.dampingFactor=.055;ut.enablePan=!1;ut.rotateSpeed=.55;ut.zoomSpeed=.85;ut.minDistance=6;ut.maxDistance=220;ut.minPolarAngle=.16;ut.maxPolarAngle=1.43;ut.autoRotate=!1;ut.autoRotateSpeed=.32;const pr=Mm(Gl.hero);ut.target.set(...pr.target);$t.fov=pr.fov;$t.updateProjectionMatrix();$t.position.setFromSphericalCoords(pr.radius,pr.el,pr.az).add(new w(...pr.target));ut.update();const fw=[new jt(new w(2.7,0,-8.3),new w(7.45,4,-2.55)),new jt(new w(8.1,0,-10.4),new w(10.5,6.6,-5.9)),new jt(new w(-5.7,0,-10.8),new w(-2.5,8.2,-7.8)),new jt(new w(-12,0,3.6),new w(-6,5.5,9.2))],Kr=new w,Jo=new w;function uw(i,e,t){let n=-1/0,s=1/0;for(const r of["x","y","z"])if(Math.abs(e[r])<1e-6){if(i[r]<t.min[r]||i[r]>t.max[r])return null}else{let a=(t.min[r]-i[r])/e[r],o=(t.max[r]-i[r])/e[r];if(a>o&&([a,o]=[o,a]),n=Math.max(n,a),s=Math.min(s,o),n>s)return null}return{tmin:n,tmax:s}}function Fc(){Jo.copy(ut.target),Kr.copy($t.position).sub(Jo);let i=Kr.length();if(!(i<.001)){Kr.divideScalar(i);for(let e=0;e<3;e+=1){let t=!1;for(const n of fw){const s=uw(Jo,Kr,n);s&&i>s.tmin-.06&&i<s.tmax+.32&&(i=s.tmax+.32,t=!0)}if(!t)break}$t.position.copy(Jo).addScaledVector(Kr,i)}}let cu=performance.now();ut.addEventListener("start",()=>{cu=performance.now(),ut.autoRotate=!1});ut.addEventListener("end",()=>{cu=performance.now()});const Fh=qn.get("view");if(qn.has("cam")){const[i,e,t]=qn.get("cam").split(",").map(Number);$t.position.set(i,e,t),ut.update(),Fc()}const ks=tb(ri,Wt,$t,{exposure:1.18,bloomStrength:.36*xi.bloom,bloomRadius:.46,bloomThreshold:1,samples:xi.isMobile?0:4,fadeMs:ym?0:1900});ks.uniforms.uTilt.value=xi.isMobile?.3:.55;const Bh={skyTop:"#5f96cf",skyHorizon:"#cfe3f0",skyBottom:"#eef4f2",fog:"#c8d8e5",fogDensity:.0024,sun:"#fff2d8",exposure:1.02,bloom:.12},kh={skyTop:bt.bgTop,skyHorizon:bt.bgHorizon,skyBottom:bt.bgBottom,fog:bt.fog,fogDensity:.0065,sun:bt.moon,exposure:1.18,bloom:.36*xi.bloom},ei={hemi:fa.intensity,moon:qt.intensity,bounce:Dc.intensity,fill:Lc.intensity,back:zc.intensity,points:Uc.map(i=>i.intensity),canopy:Dr.intensity,lamp:Lr.intensity};let Bt=!1;function dw(){const i=document.createElement("canvas");i.width=256,i.height=128;const e=i.getContext("2d");for(let n=0;n<7;n+=1){const s=40+n*31%180,r=58+Math.sin(n*1.7)*18,a=22+n%3*9,o=e.createRadialGradient(s,r,2,s,r,a);o.addColorStop(0,"rgba(255,255,255,0.95)"),o.addColorStop(.55,"rgba(255,255,255,0.55)"),o.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=o,e.beginPath(),e.arc(s,r,a,0,Math.PI*2),e.fill()}const t=new Ns(i);return t.colorSpace=Dt,t}const Sr=new di;Sr.name="day-sky";Sr.visible=!1;Wt.add(Sr);{const i=dw();for(let t=0;t<13;t+=1){const n=new cc(new Ba({map:i,transparent:!0,opacity:.6,depthWrite:!1,fog:!1})),s=t/13*Math.PI*2+.4,r=36+t%4*5;n.position.set(Math.cos(s)*r,17+t%3*4.5,Math.sin(s)*r),n.scale.set(19+t%3*5,8+t%2*3,1),Sr.add(n)}const e=Yt("#fff4d6",26,.85);e.position.set(-34,30,14),Sr.add(e)}function ua(i){Bt=i==="day";const e=Bt?Bh:kh;ta.uniforms.uTop.value.set(e.skyTop),ta.uniforms.uHorizon.value.set(e.skyHorizon),ta.uniforms.uBottom.value.set(e.skyBottom),ta.uniforms.uGlow.value.set(Bt?"#000000":"#3a2b2a"),Wt.fog.color.set(e.fog),Wt.fog.density=e.fogDensity,fa.color.set(Bt?"#e8f2ff":bt.hemiSky),fa.groundColor.set(Bt?"#8b8170":bt.hemiGround),fa.intensity=Bt?1.15:ei.hemi,qt.color.set(Bt?e.sun:bt.moon),qt.intensity=Bt?1.65:ei.moon,Bt?qt.position.set(-18,30,16):qt.position.set(-8,22,16),Dc.intensity=Bt?.25:ei.bounce,Lc.intensity=Bt?.45:ei.fill,zc.intensity=Bt?.3:ei.back,Uc.forEach((t,n)=>{t.intensity=Bt?ei.points[n]*.1:ei.points[n]}),Dr.intensity=Bt?ei.canopy*.16:ei.canopy,Lr.intensity=Bt?ei.lamp*.14:ei.lamp,ks.uniforms.uExposure.value=Bt?Bh.exposure:kh.exposure,ks.bloom.strength=Bt?Bh.bloom:kh.bloom,Ra.material.opacity=Bt?.18:.9,Ra.material.color.set(Bt?"#5a6a72":"#01030a"),Sr.visible=Bt,Oh&&Oh.group&&(Oh.group.visible=!Bt),document.body.classList.toggle("is-day",Bt),document.querySelectorAll("[data-mode]").forEach(t=>t.classList.toggle("active",t.dataset.mode===i))}let hu="hero";function Wl(){hu="street",$t.fov=58,$t.updateProjectionMatrix(),ut.minDistance=.8,ut.maxDistance=26,ut.maxPolarAngle=1.56,$t.position.set(-.4,1.75,12),ut.target.set(2.6,1.55,-2),ut.update(),Fc(),document.querySelectorAll("[data-view]").forEach(i=>i.classList.toggle("active",i.dataset.view==="street"))}function Xl(){hu="hero",ut.minDistance=6,ut.maxDistance=220,ut.maxPolarAngle=1.43,$t.fov=Gl.hero.fov,$t.updateProjectionMatrix(),lu("hero"),document.querySelectorAll("[data-view]").forEach(i=>i.classList.toggle("active",i.dataset.view==="hero"))}const Yl=document.getElementById("town-ui"),Zl=document.getElementById("town-hint"),fu=qn.get("ui")==="0"||qn.get("mode")==="clean";fu&&(Yl&&(Yl.style.display="none"),Zl&&(Zl.style.display="none"));function Ia(){fu||(Yl?.classList.remove("dim"),Zl?.classList.remove("dim"),clearTimeout(Ia.timer),Ia.timer=setTimeout(()=>{Yl?.classList.add("dim"),Zl?.classList.add("dim")},5200))}addEventListener("pointermove",Ia,{passive:!0});addEventListener("pointerdown",Ia,{passive:!0});Ia();fu||(document.querySelectorAll("[data-mode]").forEach(i=>i.addEventListener("click",()=>ua(i.dataset.mode))),document.querySelectorAll("[data-view]").forEach(i=>i.addEventListener("click",()=>{i.dataset.view==="street"?Wl():Xl()})),addEventListener("keydown",i=>{(i.key==="d"||i.key==="D")&&ua("day"),(i.key==="n"||i.key==="N")&&ua("night"),(i.key==="v"||i.key==="V")&&(hu==="street"?Xl():Wl())}));ua(qn.get("mode")==="day"?"day":"night");Fh==="street"?Wl():Fh?lu(Fh):Xl();window.__KONBINI__=Object.assign(window.__KONBINI__||{},{setMode:ua,applyStreet:Wl,applyHeroView:Xl});function pw(){$t.aspect=innerWidth/innerHeight,$t.updateProjectionMatrix(),ri.setPixelRatio(Math.min(devicePixelRatio||1,xi.isMobile?1.25:2)),ri.setSize(innerWidth,innerHeight),ks.resize()}addEventListener("resize",pw);const mw=new Tc;let $i=0,Vh=0,jo=0,bm=0;const Sm={frame:0};ri.setAnimationLoop(()=>{const i=Math.min(mw.getDelta(),.05);if($i=hp!==null?hp:$i+(tl?0:i),tl||(Bs.time.value=$i),!ym&&!tl){const e=performance.now()-cu>14e3;e&&!ut.autoRotate&&(ut.autoRotate=!0),!e&&ut.autoRotate&&(ut.autoRotate=!1)}ut.update(Math.min(i,.05)),Fc();for(const e of vm)e.update&&e.update($i,i);for(const e of Bs.update)e($i,i);ks.uniforms.uTime.value=$i,ks.render(i,$i),Vh+=1,jo+=i,jo>=.5&&(bm=Math.round(Vh/jo),Vh=0,jo=0),Sm.frame+=1,(!window.__KONBINI__||!window.__KONBINI__.ready)&&(window.__KONBINI__=window.__KONBINI__||{},window.__KONBINI__.ready=!0)});window.__KONBINI__={ready:window.__KONBINI__?.ready||!1,THREE:DM,renderer:ri,scene:Wt,camera:$t,controls:ut,handles:Bs,post:ks,get fps(){return bm},debug:Sm,setView:i=>lu(i),freeze:(i=!0)=>{tl=i},get time(){return $i}};requestAnimationFrame(()=>{requestAnimationFrame(()=>{window.__KONBINI__.ready=!0})});
