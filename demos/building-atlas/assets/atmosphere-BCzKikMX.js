import{M as ue,O as pe,B as ge,F as se,S as E,U as V,V as T,W as O,H as L,N as ve,C as xe,a as v,b as S,A as he,c as be,R as ye,d as Ce,e as Me,L as Se,f as we,g as Te,h as De,i as _e,j as ke,k as Pe,l as Ae,G as ze,m as Re,n as Ee,o as Ne,p as fe,q as Ie,r as He,s as Be}from"./index-C_jUGRw8.js";const ce={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

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


		}`};class H{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}const Fe=new pe(-1,1,1,-1,0,1);class We extends ge{constructor(){super(),this.setAttribute("position",new se([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new se([0,2,0,0,2,0],2))}}const Ge=new We;class j{constructor(e){this._mesh=new ue(Ge,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,Fe)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}class Ue extends H{constructor(e,s){super(),this.textureID=s!==void 0?s:"tDiffuse",e instanceof E?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=V.clone(e.uniforms),this.material=new E({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this.fsQuad=new j(this.material)}render(e,s,o){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=o.texture),this.fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(s),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this.fsQuad.render(e))}dispose(){this.material.dispose(),this.fsQuad.dispose()}}class ie extends H{constructor(e,s){super(),this.scene=e,this.camera=s,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,s,o){const r=e.getContext(),i=e.state;i.buffers.color.setMask(!1),i.buffers.depth.setMask(!1),i.buffers.color.setLocked(!0),i.buffers.depth.setLocked(!0);let n,c;this.inverse?(n=0,c=1):(n=1,c=0),i.buffers.stencil.setTest(!0),i.buffers.stencil.setOp(r.REPLACE,r.REPLACE,r.REPLACE),i.buffers.stencil.setFunc(r.ALWAYS,n,4294967295),i.buffers.stencil.setClear(c),i.buffers.stencil.setLocked(!0),e.setRenderTarget(o),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(s),this.clear&&e.clear(),e.render(this.scene,this.camera),i.buffers.color.setLocked(!1),i.buffers.depth.setLocked(!1),i.buffers.color.setMask(!0),i.buffers.depth.setMask(!0),i.buffers.stencil.setLocked(!1),i.buffers.stencil.setFunc(r.EQUAL,1,4294967295),i.buffers.stencil.setOp(r.KEEP,r.KEEP,r.KEEP),i.buffers.stencil.setLocked(!0)}}class Oe extends H{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class Le{constructor(e,s){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),s===void 0){const o=e.getSize(new T);this._width=o.width,this._height=o.height,s=new O(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:L}),s.texture.name="EffectComposer.rt1"}else this._width=s.width,this._height=s.height;this.renderTarget1=s,this.renderTarget2=s.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new Ue(ce),this.copyPass.material.blending=ve,this.clock=new xe}swapBuffers(){const e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,s){this.passes.splice(s,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){const s=this.passes.indexOf(e);s!==-1&&this.passes.splice(s,1)}isLastEnabledPass(e){for(let s=e+1;s<this.passes.length;s++)if(this.passes[s].enabled)return!1;return!0}render(e){e===void 0&&(e=this.clock.getDelta());const s=this.renderer.getRenderTarget();let o=!1;for(let r=0,i=this.passes.length;r<i;r++){const n=this.passes[r];if(n.enabled!==!1){if(n.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(r),n.render(this.renderer,this.writeBuffer,this.readBuffer,e,o),n.needsSwap){if(o){const c=this.renderer.getContext(),u=this.renderer.state.buffers.stencil;u.setFunc(c.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),u.setFunc(c.EQUAL,1,4294967295)}this.swapBuffers()}ie!==void 0&&(n instanceof ie?o=!0:n instanceof Oe&&(o=!1))}}this.renderer.setRenderTarget(s)}reset(e){if(e===void 0){const s=this.renderer.getSize(new T);this._pixelRatio=this.renderer.getPixelRatio(),this._width=s.width,this._height=s.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,s){this._width=e,this._height=s;const o=this._width*this._pixelRatio,r=this._height*this._pixelRatio;this.renderTarget1.setSize(o,r),this.renderTarget2.setSize(o,r);for(let i=0;i<this.passes.length;i++)this.passes[i].setSize(o,r)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class Ve extends H{constructor(e,s,o=null,r=null,i=null){super(),this.scene=e,this.camera=s,this.overrideMaterial=o,this.clearColor=r,this.clearAlpha=i,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new v}render(e,s,o){const r=e.autoClear;e.autoClear=!1;let i,n;this.overrideMaterial!==null&&(n=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(i=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:o),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(i),this.overrideMaterial!==null&&(this.scene.overrideMaterial=n),e.autoClear=r}}const Qe={uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new v(0)},defaultOpacity:{value:0}},vertexShader:`

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

		}`};class I extends H{constructor(e,s,o,r){super(),this.strength=s!==void 0?s:1,this.radius=o,this.threshold=r,this.resolution=e!==void 0?new T(e.x,e.y):new T(256,256),this.clearColor=new v(0,0,0),this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let i=Math.round(this.resolution.x/2),n=Math.round(this.resolution.y/2);this.renderTargetBright=new O(i,n,{type:L}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let m=0;m<this.nMips;m++){const C=new O(i,n,{type:L});C.texture.name="UnrealBloomPass.h"+m,C.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(C);const p=new O(i,n,{type:L});p.texture.name="UnrealBloomPass.v"+m,p.texture.generateMipmaps=!1,this.renderTargetsVertical.push(p),i=Math.round(i/2),n=Math.round(n/2)}const c=Qe;this.highPassUniforms=V.clone(c.uniforms),this.highPassUniforms.luminosityThreshold.value=r,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new E({uniforms:this.highPassUniforms,vertexShader:c.vertexShader,fragmentShader:c.fragmentShader}),this.separableBlurMaterials=[];const u=[3,5,7,9,11];i=Math.round(this.resolution.x/2),n=Math.round(this.resolution.y/2);for(let m=0;m<this.nMips;m++)this.separableBlurMaterials.push(this.getSeperableBlurMaterial(u[m])),this.separableBlurMaterials[m].uniforms.invSize.value=new T(1/i,1/n),i=Math.round(i/2),n=Math.round(n/2);this.compositeMaterial=this.getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=s,this.compositeMaterial.uniforms.bloomRadius.value=.1;const _=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=_,this.bloomTintColors=[new S(1,1,1),new S(1,1,1),new S(1,1,1),new S(1,1,1),new S(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors;const w=ce;this.copyUniforms=V.clone(w.uniforms),this.blendMaterial=new E({uniforms:this.copyUniforms,vertexShader:w.vertexShader,fragmentShader:w.fragmentShader,blending:he,depthTest:!1,depthWrite:!1,transparent:!0}),this.enabled=!0,this.needsSwap=!1,this._oldClearColor=new v,this.oldClearAlpha=1,this.basic=new be,this.fsQuad=new j(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this.basic.dispose(),this.fsQuad.dispose()}setSize(e,s){let o=Math.round(e/2),r=Math.round(s/2);this.renderTargetBright.setSize(o,r);for(let i=0;i<this.nMips;i++)this.renderTargetsHorizontal[i].setSize(o,r),this.renderTargetsVertical[i].setSize(o,r),this.separableBlurMaterials[i].uniforms.invSize.value=new T(1/o,1/r),o=Math.round(o/2),r=Math.round(r/2)}render(e,s,o,r,i){e.getClearColor(this._oldClearColor),this.oldClearAlpha=e.getClearAlpha();const n=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),i&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this.fsQuad.material=this.basic,this.basic.map=o.texture,e.setRenderTarget(null),e.clear(),this.fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=o.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this.fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this.fsQuad.render(e);let c=this.renderTargetBright;for(let u=0;u<this.nMips;u++)this.fsQuad.material=this.separableBlurMaterials[u],this.separableBlurMaterials[u].uniforms.colorTexture.value=c.texture,this.separableBlurMaterials[u].uniforms.direction.value=I.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[u]),e.clear(),this.fsQuad.render(e),this.separableBlurMaterials[u].uniforms.colorTexture.value=this.renderTargetsHorizontal[u].texture,this.separableBlurMaterials[u].uniforms.direction.value=I.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[u]),e.clear(),this.fsQuad.render(e),c=this.renderTargetsVertical[u];this.fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this.fsQuad.render(e),this.fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,i&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(o),this.fsQuad.render(e)),e.setClearColor(this._oldClearColor,this.oldClearAlpha),e.autoClear=n}getSeperableBlurMaterial(e){const s=[];for(let o=0;o<e;o++)s.push(.39894*Math.exp(-.5*o*o/(e*e))/e);return new E({defines:{KERNEL_RADIUS:e},uniforms:{colorTexture:{value:null},invSize:{value:new T(.5,.5)},direction:{value:new T(.5,.5)},gaussianCoefficients:{value:s}},vertexShader:`varying vec2 vUv;
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
				}`})}getCompositeMaterial(e){return new E({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
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
				}`})}}I.BlurDirectionX=new T(1,0);I.BlurDirectionY=new T(0,1);const Ze={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`
	
		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};class Ke extends H{constructor(){super();const e=Ze;this.uniforms=V.clone(e.uniforms),this.material=new ye({name:e.name,uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader}),this.fsQuad=new j(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,s,o){this.uniforms.tDiffuse.value=o.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},Ce.getTransfer(this._outputColorSpace)===Me&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===Se?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===we?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===Te?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===De?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===_e?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===ke&&(this.material.defines.NEUTRAL_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(s),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this.fsQuad.render(e))}dispose(){this.material.dispose(),this.fsQuad.dispose()}}const oe=["day","dusk","night"],Xe=900,$e=900,je=1500,Ye={day:"dusk",dusk:"night",night:"day"},K=t=>t<0?0:t>1?1:t,re=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;function qe(t){const e={day:{sky:{zenith:4159411,horizon:13624044,ground:9413547,haze:.24},sunDir:[-80,128,62],sunDiskColor:16774106,sunDisk:.9,moonDir:[-90,110,-70],moonDiskColor:14674175,moonDisk:0,stars:0,fog:{color:9417929,density:8e-4},background:9417929,exposure:.99,environment:.46,bloom:{strength:.06,threshold:1.08,radius:.32},night:0,lights:{sun:{color:16771535,intensity:2.05,pos:[-80,128,62]},ambient:{sky:13034230,ground:9077617,intensity:.78},fill:{color:12376303,intensity:.62,pos:[80,70,-70]}}},dusk:{sky:{zenith:2041671,horizon:15764042,ground:3024161,haze:.55},sunDir:[-168,26,110],sunDiskColor:16749632,sunDisk:1.9,moonDir:[-70,120,-90],moonDiskColor:13622527,moonDisk:.05,stars:.22,fog:{color:6112312,density:.0014},background:6112312,exposure:.84,environment:.2,bloom:{strength:.13,threshold:.78,radius:.42},night:.42,lights:{sun:{color:16748354,intensity:1.22,pos:[-168,26,110]},ambient:{sky:7175061,ground:2367260,intensity:.4},fill:{color:5073562,intensity:.22,pos:[95,60,-55]}}},night:{sky:{zenith:198671,horizon:727595,ground:66309,haze:.18},sunDir:[-90,110,-70],sunDiskColor:10335999,sunDisk:0,moonDir:[-90,110,-70],moonDiskColor:14411519,moonDisk:1.3,stars:1,fog:{color:529440,density:.00105},background:529440,exposure:.85,environment:.14,bloom:{strength:.26,threshold:.7,radius:.4},night:1,lights:{sun:{color:8825599,intensity:.38,pos:[-90,110,-70]},ambient:{sky:2571605,ground:461583,intensity:.28},fill:{color:4022154,intensity:.12,pos:[70,50,80]}}}};return e[t]||e.day}function ne(){return{skyZenith:new v,skyHorizon:new v,skyGround:new v,skyHaze:0,sunDir:new S,sunDiskColor:new v,sunDisk:0,moonDir:new S,moonDiskColor:new v,moonDisk:0,stars:0,fogColor:new v,fogDensity:0,background:new v,exposure:1,environment:.65,bloomStrength:0,bloomThreshold:.9,bloomRadius:.4,night:0,sunColor:new v,sunIntensity:0,sunPos:new S,ambientSky:new v,ambientGround:new v,ambientIntensity:0,fillColor:new v,fillIntensity:0,fillPos:new S}}function ae(t,e){const s=qe(t);return e.skyZenith.setHex(s.sky.zenith),e.skyHorizon.setHex(s.sky.horizon),e.skyGround.setHex(s.sky.ground),e.skyHaze=s.sky.haze,e.sunDir.set(...s.sunDir).normalize(),e.sunDiskColor.setHex(s.sunDiskColor),e.sunDisk=s.sunDisk,e.moonDir.set(...s.moonDir).normalize(),e.moonDiskColor.setHex(s.moonDiskColor),e.moonDisk=s.moonDisk,e.stars=s.stars,e.fogColor.setHex(s.fog.color),e.fogDensity=s.fog.density,e.background.setHex(s.background),e.exposure=s.exposure,e.environment=s.environment,e.bloomStrength=s.bloom.strength,e.bloomThreshold=s.bloom.threshold,e.bloomRadius=s.bloom.radius,e.night=s.night,e.sunColor.setHex(s.lights.sun.color),e.sunIntensity=s.lights.sun.intensity,e.sunPos.set(...s.lights.sun.pos),e.ambientSky.setHex(s.lights.ambient.sky),e.ambientGround.setHex(s.lights.ambient.ground),e.ambientIntensity=s.lights.ambient.intensity,e.fillColor.setHex(s.lights.fill.color),e.fillIntensity=s.lights.fill.intensity,e.fillPos.set(...s.lights.fill.pos),e}function le(t,e,s){const o=(n,c,u)=>n.lerpColors(c,u,s),r=(n,c)=>fe.lerp(n,c,s),i=(n,c,u)=>n.lerpVectors(c,u,s);o(t.skyZenith,t.skyZenith,e.skyZenith),o(t.skyHorizon,t.skyHorizon,e.skyHorizon),o(t.skyGround,t.skyGround,e.skyGround),t.skyHaze=r(t.skyHaze,e.skyHaze),i(t.sunDir,t.sunDir,e.sunDir),o(t.sunDiskColor,t.sunDiskColor,e.sunDiskColor),t.sunDisk=r(t.sunDisk,e.sunDisk),i(t.moonDir,t.moonDir,e.moonDir),o(t.moonDiskColor,t.moonDiskColor,e.moonDiskColor),t.moonDisk=r(t.moonDisk,e.moonDisk),t.stars=r(t.stars,e.stars),o(t.fogColor,t.fogColor,e.fogColor),t.fogDensity=r(t.fogDensity,e.fogDensity),o(t.background,t.background,e.background),t.exposure=r(t.exposure,e.exposure),t.environment=r(t.environment,e.environment),t.bloomStrength=r(t.bloomStrength,e.bloomStrength),t.bloomThreshold=r(t.bloomThreshold,e.bloomThreshold),t.bloomRadius=r(t.bloomRadius,e.bloomRadius),t.night=r(t.night,e.night),o(t.sunColor,t.sunColor,e.sunColor),t.sunIntensity=r(t.sunIntensity,e.sunIntensity),i(t.sunPos,t.sunPos,e.sunPos),o(t.ambientSky,t.ambientSky,e.ambientSky),o(t.ambientGround,t.ambientGround,e.ambientGround),t.ambientIntensity=r(t.ambientIntensity,e.ambientIntensity),o(t.fillColor,t.fillColor,e.fillColor),t.fillIntensity=r(t.fillIntensity,e.fillIntensity),i(t.fillPos,t.fillPos,e.fillPos)}const Je=`
varying vec3 vAtmoDir;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vAtmoDir = worldPosition.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`,et=`
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform float uHaze;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunI;
uniform vec3 uMoonDir;
uniform vec3 uMoonColor;
uniform float uMoonI;
uniform float uStars;
uniform float uNight;
uniform float uTime;
varying vec3 vAtmoDir;

float atmoHash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void main() {
  vec3 dir = normalize(vAtmoDir);
  float h = dir.y;

  // 天顶 → 地平线渐变；地平线以下压到地面色
  vec3 col = mix(uHorizon, uZenith, smoothstep(-0.02, 0.58, h));
  col = mix(col, uGround, smoothstep(0.0, 0.22, -h));

  // 地平线薄雾（黄昏更重，营造金橙带）
  float haze = exp(-abs(h) * 15.0) * uHaze;
  col = mix(col, uHorizon * 1.1, haze * 0.6);

  // 太阳（日景淡日晕 / 黄昏低垂金盘）
  float sd = clamp(dot(dir, uSunDir), 0.0, 1.0);
  float sunDisk = smoothstep(0.99930, 0.99972, sd);
  float sunGlow = pow(sd, 26.0) * 0.40 + pow(sd, 5.0) * 0.085;
  col += uSunColor * (sunDisk * 2.6 + sunGlow) * uSunI;

  // 月亮
  float md = clamp(dot(dir, uMoonDir), 0.0, 1.0);
  float moonDisk = smoothstep(0.99952, 0.99980, md);
  float moonHalo = pow(md, 90.0) * 0.30 + pow(md, 10.0) * 0.05;
  float moonTex = 0.84 + 0.16 * sin(dir.x * 80.0 + dir.y * 60.0);
  col += uMoonColor * (moonDisk * 2.0 * moonTex + moonHalo) * uMoonI;

  // 星空（hash 星点 + 轻微闪烁），只在地平线以上出现
  if (uStars > 0.002) {
    vec3 sp = dir * 240.0;
    vec3 id = floor(sp);
    vec3 f = fract(sp) - 0.5;
    float hs = atmoHash31(id);
    float star = smoothstep(0.9982, 0.99995, hs) * smoothstep(0.34, 0.02, length(f));
    float twinkle = 0.55 + 0.45 * sin(uTime * 1.7 + hs * 120.0);
    col += vec3(0.82, 0.88, 1.0) * star * twinkle * uStars * smoothstep(0.0, 0.16, h) * 2.3;
  }

  // 极细颗粒，避免大面积渐变出现色带
  col += (atmoHash31(vec3(gl_FragCoord.xy, uTime)) - 0.5) * 0.0035;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
  #ifdef ATMO_TONE_MAP
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  #endif
}
`,tt=`
varying vec3 vAtmoWorld;
varying vec3 vAtmoNormal;
`,st=`
uniform float uNight;
uniform vec3 uWinGlow;
uniform float uWinPaneW;
uniform float uWinPaneH;
uniform float uWinIntensity;
varying vec3 vAtmoWorld;
varying vec3 vAtmoNormal;

float atmoWinHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// 按世界坐标切窗格：水平 ~2.25m / 垂直 ~3.35m，hash 决定某扇窗夜间是否亮灯。
vec3 atmoWindowGlow() {
  if (uNight <= 0.001) return vec3(0.0);
  vec3 n = normalize(vAtmoNormal);
  float facing = smoothstep(0.55, 0.88, abs(n.y));          // 朝上的玻璃面不点灯
  if (facing > 0.999) return vec3(0.0);

  float along = abs(n.x) > abs(n.z) ? vAtmoWorld.z : vAtmoWorld.x;
  vec2 cell = vec2(floor(along / uWinPaneW), floor(vAtmoWorld.y / uWinPaneH));
  vec2 f = vec2(fract(along / uWinPaneW), fract(vAtmoWorld.y / uWinPaneH));

  // 窗洞内缩 + 边缘柔化，留出窗框
  float mx = smoothstep(0.10, 0.20, f.x) * (1.0 - smoothstep(0.80, 0.90, f.x));
  float my = smoothstep(0.16, 0.27, f.y) * (1.0 - smoothstep(0.76, 0.86, f.y));
  float mask = mx * my;

  float seed = atmoWinHash(cell + 13.7);
  float highBias = smoothstep(0.0, 30.0, vAtmoWorld.y) * 0.10;   // 高层亮灯略少
  float lit = step(0.615 + highBias * 0.8, seed);
  float warm = 0.55 + 0.45 * atmoWinHash(cell * 1.31 + 4.1);      // 每扇窗亮度差异
  float groundFade = smoothstep(0.9, 3.0, vAtmoWorld.y);          // 首层入口不做窗格阵列

  return uWinGlow * (uWinIntensity * lit * warm * mask * groundFade) * uNight;
}
`;function it(t,e,s){if(!t||!t.isMaterial||t.userData&&t.userData.__atmoWindow||s&&s.has(t))return!1;if(!t.isMeshStandardMaterial&&!t.isMeshPhysicalMaterial)return s&&s.add(t),!1;try{const o=t.onBeforeCompile;return t.onBeforeCompile=function(i,n){typeof o=="function"&&o.call(this,i,n);try{i.uniforms.uNight=e.uNight,i.uniforms.uWinGlow=e.uWinGlow,i.uniforms.uWinPaneW=e.uWinPaneW,i.uniforms.uWinPaneH=e.uWinPaneH,i.uniforms.uWinIntensity=e.uWinIntensity,i.vertexShader=`${tt}
${i.vertexShader}`,i.vertexShader=i.vertexShader.replace("#include <fog_vertex>",`#include <fog_vertex>
  vAtmoWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vAtmoNormal = normalize(mat3(modelMatrix) * objectNormal);`),i.fragmentShader=`${st}
${i.fragmentShader}`,i.fragmentShader=i.fragmentShader.replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
  totalEmissiveRadiance += atmoWindowGlow();`)}catch(c){console.warn("[atmosphere] 窗光 shader 注入失败：",c&&c.message?c.message:c)}},t.customProgramCacheKey=()=>"atmosphere-window-v1",t.userData=t.userData||{},t.userData.__atmoWindow=!0,t.needsUpdate=!0,s&&s.add(t),!0}catch(o){return console.warn("[atmosphere] 玻璃材质接管失败：",o&&o.message?o.message:o),s&&s.add(t),!1}}function ot(t){return typeof t=="string"&&/glass/i.test(t)}function X(t,e){if(!t||typeof t.traverse!="function")return{injected:0,handled:0};const s=new Set;let o=0,r=0;return t.traverse(i=>{if(!i||!i.isMesh||!i.material)return;const n=Array.isArray(i.material)?i.material:[i.material];for(const c of n)!c||s.has(c)||ot(c.name)&&(r+=1,it(c,e,s)&&(o+=1))}),{injected:o,handled:r}}function nt({scene:t,camera:e,renderer:s,lights:o,controls:r}={}){const i=[],n=(a,l)=>{i.push(a),console.warn(`[atmosphere] ${a}`,l&&l.message?l.message:l??"")},c=o||{},u=c.sun||null,_=c.ambient||null,w=c.fill||null;let m=null,C=null;try{s&&t&&e?(m=new Le(s),m.addPass(new Ve(t,e)),C=new I(new T(1,1),.12,.42,.9),m.addPass(C),m.addPass(new Ke)):n("缺少 renderer / scene / camera，跳过后期处理")}catch(a){m=null,C=null,n("后处理构建失败，已回退 renderer.render()",a)}const p={uZenith:{value:new v(5213124)},uHorizon:{value:new v(13624044)},uGround:{value:new v(9478310)},uHaze:{value:.3},uSunDir:{value:new S(-.45,.8,.4)},uSunColor:{value:new v(16773846)},uSunI:{value:1},uMoonDir:{value:new S(.5,.6,-.6)},uMoonColor:{value:new v(14674175)},uMoonI:{value:0},uStars:{value:0},uNight:{value:0},uTime:{value:0}};let M=null;if(t){const a=new E({name:"AtmosphereSky",uniforms:p,vertexShader:Je,fragmentShader:et,side:Pe,depthWrite:!1,fog:!1,toneMapped:!0,defines:m?{}:{ATMO_TONE_MAP:1}});M=new ue(new Ae($e,40,24),a),M.name="AtmosphereSkyDome",M.frustumCulled=!1,M.renderOrder=-1e3,M.matrixAutoUpdate=!0,t.add(M)}else n("缺少 scene，天空穹顶未创建");const B={uNight:{value:0},uWinGlow:{value:new v(16763271)},uWinPaneW:{value:2.25},uWinPaneH:{value:3.35},uWinIntensity:{value:.95}},z=new ze;z.name="AtmosphereAerialLights",z.frustumCulled=!1;const k=[],W=[];t&&t.add(z);const G=(()=>{try{const l=document.createElement("canvas");l.width=64,l.height=64;const x=l.getContext("2d"),f=x.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);f.addColorStop(0,"rgba(255,255,255,1)"),f.addColorStop(.28,"rgba(255,170,140,0.85)"),f.addColorStop(1,"rgba(255,40,20,0)"),x.fillStyle=f,x.fillRect(0,0,64,64);const g=new Re(l);return g.colorSpace=Ee,g.needsUpdate=!0,g}catch(a){return n("航空灯贴图生成失败",a),null}})();function Y(){for(const a of k)z.remove(a.sprite),a.sprite.material.dispose();k.length=0}function de(a){if(!a||typeof a.traverse!="function"||!G)return 0;Y(),W.length=0;try{a.updateMatrixWorld(!0)}catch{}const l=new Map;a.traverse(f=>{if(!f||!f.isMesh||!f.geometry)return;const g=f.userData&&f.userData.building;if(!g||!/^[A-F]$/.test(String(g)))return;W.push(f);const y=new Ie().setFromObject(f);if(!Number.isFinite(y.min.x)||y.isEmpty())return;const b=l.get(g);b?b.union(y):l.set(g,y.clone())});const x=new S;for(const[f,g]of l){g.getCenter(x);const y=new He({map:G,color:16729654,transparent:!0,opacity:0,depthWrite:!1,blending:he,toneMapped:!1}),b=new Be(y);b.name=`AerialLight-${f}`,b.position.set(x.x,g.max.y+1.6,x.z),b.scale.set(2.6,2.6,1),b.userData.building=f,b.userData.phase=k.length*.37%1,b.userData.period=1.2+k.length%4*.16,z.add(b),k.push({sprite:b,building:f})}return k.length}const d=ne(),h=ne();let N="day",D=null,P=null,U=!1,Q=0,Z=0,A={glassMaterials:0,aerialLights:0};ae("day",h),le(d,h,1);function q(a){const l=K(a),x=(b,R,F)=>b.lerpColors(R,F,l),f=(b,R)=>fe.lerp(b,R,l),g=(b,R,F)=>b.lerpVectors(R,F,l);x(p.uZenith.value,d.skyZenith,h.skyZenith),x(p.uHorizon.value,d.skyHorizon,h.skyHorizon),x(p.uGround.value,d.skyGround,h.skyGround),p.uHaze.value=f(d.skyHaze,h.skyHaze),g(p.uSunDir.value,d.sunDir,h.sunDir),p.uSunDir.value.lengthSq()<1e-6?p.uSunDir.value.set(0,1,0):p.uSunDir.value.normalize(),x(p.uSunColor.value,d.sunDiskColor,h.sunDiskColor),p.uSunI.value=f(d.sunDisk,h.sunDisk),g(p.uMoonDir.value,d.moonDir,h.moonDir),p.uMoonDir.value.lengthSq()<1e-6?p.uMoonDir.value.set(0,1,0):p.uMoonDir.value.normalize(),x(p.uMoonColor.value,d.moonDiskColor,h.moonDiskColor),p.uMoonI.value=f(d.moonDisk,h.moonDisk),p.uStars.value=f(d.stars,h.stars),t&&((!t.background||t.background.isColor)&&(t.background||(t.background=new v),t.background.lerpColors(d.background,h.background,l)),t.fog?(t.fog.color.lerpColors(d.fogColor,h.fogColor,l),t.fog.isFogExp2&&(t.fog.density=f(d.fogDensity,h.fogDensity))):(t.fog=new Ne(661542,h.fogDensity),t.fog.color.lerpColors(d.fogColor,h.fogColor,l))),s&&(s.toneMappingExposure=f(d.exposure,h.exposure)),t&&typeof t.environmentIntensity=="number"&&(t.environmentIntensity=f(d.environment,h.environment)),u&&(u.color.lerpColors(d.sunColor,h.sunColor,l),u.intensity=f(d.sunIntensity,h.sunIntensity),u.position.lerpVectors(d.sunPos,h.sunPos,l),u.target&&u.target.isObject3D&&u.target.updateMatrixWorld()),_&&(_.color&&_.color.lerpColors(d.ambientSky,h.ambientSky,l),_.groundColor&&_.groundColor.lerpColors(d.ambientGround,h.ambientGround,l),_.intensity=f(d.ambientIntensity,h.ambientIntensity)),w&&(w.color&&w.color.lerpColors(d.fillColor,h.fillColor,l),w.intensity=f(d.fillIntensity,h.fillIntensity),w.position&&w.position.lerpVectors(d.fillPos,h.fillPos,l)),C&&(C.strength=f(d.bloomStrength,h.bloomStrength),C.threshold=f(d.bloomThreshold,h.bloomThreshold),C.radius=f(d.bloomRadius,h.bloomRadius),C.enabled=C.strength>.02);const y=f(d.night,h.night);B.uNight.value=y,p.uNight.value=y,J=y}let J=0;const ee={get preset(){return N},get transitioning(){return!!D},get warnings(){return i.slice()},get stats(){return{...A}},get model(){return P},sun:u,ambient:_,fill:w,sky:M,composer:m,bloom:C,skyUniforms:p,windowUniforms:B,aerialGroup:z,setPreset(a){const l=oe.includes(a)?a:"day";if(oe.includes(a)||n(`未知预设 ${a}，回退 day`),l===N&&!D)return N;const x=D?K(($()-D.startMs)/D.duration):1;return le(d,h,re(x)),ae(l,h),D={startMs:$(),duration:Xe},N=l,N},cyclePreset(){return ee.setPreset(Ye[N]||"day")},setModel(a){if(!a||typeof a.traverse!="function")return n("setModel 收到无效模型，已忽略"),A;P=a;const l=X(P,B),x=de(P);return A={glassMaterials:l.handled,aerialLights:x},A},refreshWindows(){if(!P)return 0;const a=X(P,B);return a.injected>0&&(A={...A,glassMaterials:a.handled}),a.injected},setShadows(a){return U=!!a,u&&(u.castShadow=U),U},update(a,l){const x=Number.isFinite(a)?Math.min(Math.max(a,0),.25):0,f=Number.isFinite(l)?l:$();if(D){const g=K((f-D.startMs)/D.duration);q(re(g)),g>=1&&(D=null)}if(M&&(p.uTime.value+=x,e&&M.position.copy(e.position)),k.length&&f>=0){const g=f/1e3;for(const y of k){const b=y.sprite.userData.phase||0,R=y.sprite.userData.period||1.4,F=(g/R+b)%1,me=Math.exp(-Math.pow((F-.16)/.1,2)),te=J*(.1+.9*me);y.sprite.material.opacity=te,y.sprite.visible=te>.02}}if(k.length&&W.length&&(Z+=x,Z>=.4)){Z=0;let g=!1;for(const y of W)if(y&&y.visible){g=!0;break}z.visible=g}if(P&&(Q+=x*1e3,Q>=je)){Q=0;const g=X(P,B);g.injected>0&&(A={...A,glassMaterials:g.handled})}},render(){s&&(m?m.render():s.render(t,e))},resize(a,l){m&&a>0&&l>0&&s&&(m.setPixelRatio(s.getPixelRatio?s.getPixelRatio():1),m.setSize(a,l))},dispose(){Y(),M&&t&&(t.remove(M),M.geometry.dispose(),M.material.dispose()),C&&C.dispose&&C.dispose(),m&&m.dispose&&m.dispose(),G&&G.dispose()}};return q(1),u&&(u.castShadow=!!u.castShadow,U=!!u.castShadow),ee}function $(){return typeof performance<"u"&&performance.now?performance.now():Date.now()}export{oe as ATMOSPHERE_PRESETS,nt as createAtmosphere,nt as default};
