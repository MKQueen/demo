// GLSL helper chunks extracted from the original Messenger bundle (reverse-engineered for reference/demo)
export const fit = `float efit(float x, float a1, float a2, float b1, float b2) {
    return b1 + ((x - a1) * (b2 - b1)) / (a2 - a1);
}

float fit(float x, float a1, float a2, float b1, float b2) {
    return clamp(efit(x, a1, a2, b1, b2), min(b1, b2), max(b1, b2));
}

float fit01(float x, float a1, float a2) {
    return fit(x, 0.0, 1.0, a1, a2);
}

float fit10(float x, float a1, float a2) {
    return fit(x, 1.0, 0.0, a1, a2);
}

float fit11(float x, float a1, float a2) {
    return fit(x, -1.0, 1.0, a1, a2);
}

vec3 efit(vec3 x, vec3 a1, vec3 a2, vec3 b1, vec3 b2) {
    return b1 + ((x - a1) * (b2 - b1)) / (a2 - a1);
}

vec3 fit(vec3 x, vec3 a1, vec3 a2, vec3 b1, vec3 b2) {
    return clamp(efit(x, a1, a2, b1, b2), min(b1, b2), max(b1, b2));
}

vec3 fit01(vec3 x, vec3 a1, vec3 a2) {
    return fit(x, vec3(0.0), vec3(1.0), a1, a2);
}

vec3 fit10(vec3 x, vec3 a1, vec3 a2) {
    return fit(x, vec3(1.0), vec3(0.0), a1, a2);
}

vec3 fit11(vec3 x, vec3 a1, vec3 a2) {
    return fit(x, vec3(-1.0), vec3(1.0), a1, a2);
}`;

export const encoding = `vec2 encodeNormal(vec3 n) {
    n /= (abs(n.x) + abs(n.y) + abs(n.z));
    return (n.z >= 0.0) ? n.xy : (1.0 - abs(n.yx)) * sign(n.xy);
}

vec3 decodeNormal(vec2 f) {
    vec3 n = vec3(f, 1.0 - abs(f.x) - abs(f.y));
    float t = max(-n.z, 0.0);
    n.x += (n.x > 0.0) ? -t : t;
    n.y += (n.y > 0.0) ? -t : t;
    return normalize(n);
}

vec2 encodeNormalUint8(vec3 n) {
    return encodeNormal(n) * 0.5 + 0.5;
}

vec3 deodeNormalUint8(vec2 n) {
    return decodeNormal(n * 2.0 - 1.0);
}

vec2 encodeNormalSpheremap(vec3 n) {
    float f = sqrt(8.0 * n.z + 8.0);
    return n.xy / f * 2.0;
}

vec3 decodeNormalSpheremap(vec2 n) {
    vec4 nn = vec4(n.xy, 1.0, -1.0);
    float l = dot(nn.xyz, -nn.xyw);
    nn.z = l;
    nn.xy *= sqrt(l);
    return nn.xyz * 2.0 + vec3(0.0, 0.0, -1.0);
}

vec2 encodeNormalSpheremapUint8(vec3 n) {
    return encodeNormalSpheremap(n) * 0.5 + 0.5;
}

vec3 deodeNormalSimpleUint8(vec2 n) {
    return decodeNormalSpheremap(n * 2.0 - 1.0);
}`;

export const linearstep = `float linearstep(float begin, float end, float t) {
    return clamp((t - begin) / (end - begin), 0.0, 1.0);
}`;

export const colorutils = `float luma(float color) {
    return color;
}

float luma(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
}

float luma(vec4 color) {
    return dot(color.rgb, vec3(0.299, 0.587, 0.114));
}

vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6. * d + e)), d / (q.x + e), q.x);
}

vec4 rgb2hsv(vec4 c) {
    return vec4(rgb2hsv(c.rgb), c.a);
}

vec3 hsv2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.);
    return c.z * mix(vec3(1.), rgb, c.y);
}

vec4 hsv2rgb(vec4 c) {
    return vec4(hsv2rgb(c.rgb), c.a);
}

vec3 colorpalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.28318 * (c * t + d));
}

vec4 colorpalette(float t, vec4 a, vec4 b, vec4 c, vec4 d) {
    return a + b * cos(6.28318 * (c * t + d));
}

float brightnessContrast(float color, float brightness, float contrast) {
    return (color - 0.5) * contrast + 0.5 + brightness;
}

vec3 brightnessContrast(vec3 color, float brightness, float contrast) {
    return (color - 0.5) * contrast + 0.5 + brightness;
}

vec4 brightnessContrast(vec4 color, float brightness, float contrast) {
    return vec4(brightnessContrast(color.rgb, brightness, contrast), color.a);
}

vec3 saturation(vec3 color, float adjustment) {
    const vec3 W = vec3(0.2125, 0.7154, 0.0721);
    vec3 intensity = vec3(dot(color, W));
    return mix(intensity, color, adjustment);
}

vec4 saturation(vec4 color, float adjustment) {
    return vec4(saturation(color.rgb, adjustment), color.a);
}

vec3 vibrance(vec3 color, float v) {
    float average = (color.r + color.g + color.b) / 3.0;
    float mx = max(color.r, max(color.g, color.b));
    float amt = (mx - average) * (-v * 3.0);
    return mix(color.rgb, vec3(mx), amt);
}

vec4 vibrance(vec4 color, float v) {
    return vec4(vibrance(color.rgb, v), color.a);
}`;

export const sinenoise = `#define sinlayer(frX, frY, frZ) val += sin(dot(p, vec3(frX, frY, frZ)));

float sinenoise1(vec3 p) {
    float val = 0.0;
    sinlayer(1.5, 3.4598, 1.234);
    sinlayer(3.12, -3.234, 4.221);
    sinlayer(0.355, 2.3, -1.375);
    sinlayer(-0.156, -3.34, -0.4566);
    sinlayer(-4.1235, -0.485, -1.45);
    sinlayer(2.54, -0.879, -2.123);
    return val / 6.0;
}`;

export const aastep = `float aastep(float threshold, float value) {
    float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
    return smoothstep(threshold - afwidth, threshold + afwidth, value);
}`;

export const triplanar = `vec4 triplanar(sampler2D tex, vec3 wNorm, vec3 wPos, float scale) {
    
    vec3 bf = normalize(abs(wNorm));
    bf /= dot(bf, vec3(1.0));

    
    vec2 tx = wPos.yz * scale;
    vec2 ty = wPos.zx * scale;
    vec2 tz = wPos.xy * scale;

    
    vec4 cx = texture(tex, tx) * bf.x;
    vec4 cy = texture(tex, ty) * bf.y;
    vec4 cz = texture(tex, tz) * bf.z;
    return cx + cy + cz;
}`;

export const fog = `uniform vec3 uFogColorNear;
uniform vec3 uFogColorFar;
uniform float uFogDistance;
uniform float uFogDensity;

void addFog(inout vec3 outcolor, float lenCam) {
    float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * lenCam * lenCam);
    float range1 = smoothstep(0.0, uFogDistance, fogFactor);
    float range2 = 1.0 - range1;
    vec3 fogColor = uFogColorNear * range2 + uFogColorFar * range1;
    outcolor = mix(outcolor, fogColor, fogFactor);
}`;

export const lerpfriction = `float lerpCoefFPS(float t, float dt) {
    return 1.0 - exp2(log2(1.0 - t) * dt);
}

float frictionFPS(float t, float dt) {
    return exp2(log2(t) * dt);
}

float lerpFPS(float x, float y, float t, float dt) {
    return mix(x, y, lerpCoefFPS(t, dt));
}`;

export const depth = `float getDepth(sampler2D depth, vec2 uv) {
    return texture(depth, uv).x;
}

float linearizeDepthLog(float depth, float near, float far) {
    float d = pow(2.0, depth * log2(far + 1.0)) - 1.0;
    float a = far / (far - near);
    float b = far * near / (near - far);
    return a + b / d;
}

float perspectiveDepthToViewZ(float depth, float near, float far) {
    return (near * far) / ((far - near) * depth - far);
}

float orthographicDepthToViewZ(float depth, float near, float far) {
    return depth * (near - far) - near;
}

float viewZToPerspectiveDepth(float viewZ, float near, float far) {
	return ((near + viewZ) * far) / ((far - near) * viewZ);
}

float viewZToOrthographicDepth(float viewZ, float near, float far) {
	return (viewZ + near) / (near - far);
}

float getViewZ(float depth, float near, float far) {
    float fragCoordZ = depth;

    #ifdef ORTHOGRAPHIC_CAMERA
        return orthographicDepthToViewZ(fragCoordZ, near, far);
    #else
        #ifdef LOGDEPTH
            fragCoordZ = linearizeDepthLog(fragCoordZ, near, far);
        #endif
        return perspectiveDepthToViewZ(fragCoordZ, near, far);
    #endif
}

float getViewZ(sampler2D depth, vec2 uv, float near, float far) {
    return getViewZ(getDepth(depth, uv), near, far);
}

float getLinearDepth(float depth, float near, float far) {
    float fragCoordZ = depth;

    #ifdef ORTHOGRAPHIC_CAMERA
        return fragCoordZ;
    #else
        #ifdef LOGDEPTH
            fragCoordZ = linearizeDepthLog(fragCoordZ, near, far);
        #endif
        float viewZ = perspectiveDepthToViewZ(fragCoordZ, near, far);
        return viewZToOrthographicDepth(viewZ, near, far);
    #endif
}

float getLinearDepth(sampler2D depth, vec2 uv, float near, float far) {
    return getLinearDepth(getDepth(depth, uv), near, far);
}

vec3 getViewPosition(float depth, vec2 uv, float near, float far, mat4 projMat) {
    float viewZ = getViewZ(depth, near, far);

    #ifdef LOGDEPTH
        float d = linearizeDepthLog(depth, near, far);
    #else
        float d = depth;
    #endif

    float clipW = projMat[2][3] * viewZ + projMat[3][3];
    vec4 clipPosition = vec4((vec3(uv, d) - 0.5) * 2.0, 1.0);
    clipPosition *= clipW; 
    return (inverse(projMat) * clipPosition).xyz;
}

vec3 getViewPosition(sampler2D depth, vec2 uv, float near, float far, mat4 projMat) {
    return getViewPosition(getDepth(depth, uv), uv, near, far, projMat);
}

vec3 getWorldPosition(float depth, vec2 uv, float near, float far, mat4 projMat, mat4 worldMat) {
    return (worldMat * vec4(getViewPosition(depth, uv, near, far, projMat), 1.0)).xyz;
}

vec3 getWorldPosition(sampler2D depth, vec2 uv, float near, float far, mat4 projMat, mat4 worldMat) {
    return (worldMat * vec4(getViewPosition(getDepth(depth, uv), uv, near, far, projMat), 1.0)).xyz;
}

vec3 getViewNormal(sampler2D depth, vec2 uv, float near, float far, mat4 projMat) {
    vec2 depthres = vec2(textureSize(depth, 0));
    ivec2 p = ivec2(uv * depthres);
    float c0 = texelFetch(depth, p, 0).x;
    float l2 = texelFetch(depth, p - ivec2(2, 0), 0).x;
    float l1 = texelFetch(depth, p - ivec2(1, 0), 0).x;
    float r1 = texelFetch(depth, p + ivec2(1, 0), 0).x;
    float r2 = texelFetch(depth, p + ivec2(2, 0), 0).x;
    float b2 = texelFetch(depth, p - ivec2(0, 2), 0).x;
    float b1 = texelFetch(depth, p - ivec2(0, 1), 0).x;
    float t1 = texelFetch(depth, p + ivec2(0, 1), 0).x;
    float t2 = texelFetch(depth, p + ivec2(0, 2), 0).x;

    float dl = abs((2.0 * l1 - l2) - c0);
    float dr = abs((2.0 * r1 - r2) - c0);
    float db = abs((2.0 * b1 - b2) - c0);
    float dt = abs((2.0 * t1 - t2) - c0);

    vec3 ce = getViewPosition(c0, uv, near, far, projMat).xyz;

    vec3 dpdx = (dl < dr) ? ce - getViewPosition(l1, (uv - vec2(1.0 / depthres.x, 0.0)), near, far, projMat).xyz
                          : -ce + getViewPosition(r1, (uv + vec2(1.0 / depthres.x, 0.0)), near, far, projMat).xyz;
    vec3 dpdy = (db < dt) ? ce - getViewPosition(b1, (uv - vec2(0.0, 1.0 / depthres.y)), near, far, projMat).xyz
                          : -ce + getViewPosition(t1, (uv + vec2(0.0, 1.0 / depthres.y)), near, far, projMat).xyz;
    return normalize(cross(dpdx, dpdy));
}

vec3 getWorldNormal(sampler2D depth, vec2 uv, float near, float far, mat4 projMat, mat4 worldMat) {
    vec2 depthres = vec2(textureSize(depth, 0));
    ivec2 p = ivec2(uv * depthres);
    float c0 = texelFetch(depth, p, 0).x;
    float l2 = texelFetch(depth, p - ivec2(2, 0), 0).x;
    float l1 = texelFetch(depth, p - ivec2(1, 0), 0).x;
    float r1 = texelFetch(depth, p + ivec2(1, 0), 0).x;
    float r2 = texelFetch(depth, p + ivec2(2, 0), 0).x;
    float b2 = texelFetch(depth, p - ivec2(0, 2), 0).x;
    float b1 = texelFetch(depth, p - ivec2(0, 1), 0).x;
    float t1 = texelFetch(depth, p + ivec2(0, 1), 0).x;
    float t2 = texelFetch(depth, p + ivec2(0, 2), 0).x;

    float dl = abs((2.0 * l1 - l2) - c0);
    float dr = abs((2.0 * r1 - r2) - c0);
    float db = abs((2.0 * b1 - b2) - c0);
    float dt = abs((2.0 * t1 - t2) - c0);

    vec3 ce = getWorldPosition(c0, uv, near, far, projMat, worldMat).xyz;

    vec3 dpdx = (dl < dr) ? ce - getWorldPosition(l1, (uv - vec2(1.0 / depthres.x, 0.0)), near, far, projMat, worldMat).xyz
                          : -ce + getWorldPosition(r1, (uv + vec2(1.0 / depthres.x, 0.0)), near, far, projMat, worldMat).xyz;
    vec3 dpdy = (db < dt) ? ce - getWorldPosition(b1, (uv - vec2(0.0, 1.0 / depthres.y)), near, far, projMat, worldMat).xyz
                          : -ce + getWorldPosition(t1, (uv + vec2(0.0, 1.0 / depthres.y)), near, far, projMat, worldMat).xyz;
    return normalize(cross(dpdx, dpdy));
}`;

export const custom = `float outline(
    sampler2D tColor, 
    sampler2D tInfo, 
    vec2 uv, 
    float outlineWidth, 
    float scale, 
    vec3 idRange, 
    vec3 depthRange, 
    vec3 normalRange, 
    float rangeSmoothMargin, 
    float idMinScale, 
    vec2 distanceFadeRange, 
    vec2 nearFar, 

    
    inout float nearestDepth,
    inout float centDepth)
{
    vec2 offset = 1.0 / vec2(textureSize(tInfo, 0)) * outlineWidth * scale;

    
    
    float contributions[5];
    float faceIds[5];
    float depths[5];
    vec3 normals[5];

    vec2 dirs[5] = vec2[5](vec2(0, 0), vec2(-1, 0), vec2(1, 0), vec2(0, -1), vec2(0, 1)); 
    vec4 n; vec2 dir;
    #pragma unroll_loop_start
    for (int i = 0; i < 5; i++) {
        dir = dirs[i];
        n = texture(tInfo, uv + offset * dir); 
        contributions[i] = n.a; 
        depths[i] = getLinearDepth(1.0 - n.r, nearFar.x, nearFar.y);
        normals[i] = decodeNormalSpheremap(n.gb);
        faceIds[i] = texture(tColor, uv + offset * dir).a;
    }
    #pragma unroll_loop_end

    
    float centerId = faceIds[0];
    float centerDepth = depths[0];
    float centerContribution = contributions[0];
    vec3 centerNormal = normals[0];

    centDepth = centerDepth;

    vec2 idVariation = vec2((faceIds[1] - centerId) - (faceIds[2] - centerId), (faceIds[3] - centerId) - (faceIds[4] - centerId));
    vec2 depthVariation = vec2((depths[1] - centerDepth) - (depths[2] - centerDepth), (depths[3] - centerDepth) - (depths[4] - centerDepth));
    vec2 normalVariation = vec2(distance(normals[1], centerNormal) - distance(normals[2], centerNormal), distance(normals[3], centerNormal) - distance(normals[4], centerNormal));

    float idVariationTotal = sqrt((idVariation.x * idVariation.x) + (idVariation.y * idVariation.y));
    float depthVariationTotal = sqrt((depthVariation.x * depthVariation.x) + (depthVariation.y * depthVariation.y));
    float normalVariationTotal = sqrt((normalVariation.x * normalVariation.x) + (normalVariation.y * normalVariation.y));

    
    float idContribution = fit(fit(idVariationTotal, idRange.x, idRange.y, 0.0, 1.0), idRange.z, idRange.z + rangeSmoothMargin, 0.0, 1.0);
    idContribution = mix(idContribution * idMinScale, idContribution, clamp(scale, 0.0, 1.0));

    
    float normalContribution = fit(fit(normalVariationTotal, normalRange.x, normalRange.y, 0.0, 1.0), normalRange.z, normalRange.z + rangeSmoothMargin, 0.0, 1.0);

    
    float depthLimit = depthRange.z + 1.0 - centerNormal.z;
    float depthContribution = fit(fit(depthVariationTotal, depthRange.x, depthRange.y, 0.0, 1.0), depthLimit, depthLimit + rangeSmoothMargin, 0.0, 1.0);

    
    float minDepth = centerDepth;
    float minContrib = centerContribution;

    #pragma unroll_loop_start
    for (int i = 1; i < 5; i++) {
        if (depths[i] < minDepth) {
            minDepth = depths[i];
            minContrib = contributions[i];
        }
    }
    #pragma unroll_loop_end

    
    nearestDepth = minDepth;

    
    if (minDepth < centerDepth) {
        
        
        if (minContrib > centerContribution) centerContribution = max(centerContribution, ceil(minContrib));
        else centerContribution = min(centerContribution, floor(minContrib));
    }

    
    float viewZ = -orthographicDepthToViewZ(minDepth, nearFar.x, nearFar.y);
    centerContribution *= fit(viewZ, distanceFadeRange.x, distanceFadeRange.y, 1.0, 0.0);

    return clamp(idContribution + normalContribution + depthContribution, 0.0, 1.0) * centerContribution;
}`;

export const lut = `#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp sampler3D;
#else
    precision mediump sampler3D;
#endif

vec3 LUTLinearTosRGB(in vec3 value) {
	return mix(pow(value.rgb, vec3(0.41666)) * 1.055 - vec3(0.055), value.rgb * 12.92, vec3(lessThanEqual(value.rgb, vec3(0.0031308))));
}
vec3 LUTsRGBToLinear(in vec3 value) {
    return mix(pow(value.rgb * 0.9478672986 + vec3(0.0521327014), vec3(2.4)), value.rgb * 0.0773993808, vec3(lessThanEqual(value.rgb, vec3(0.04045))));
}

vec3 apply3DLUT(vec3 color, sampler3D lutTexture, float lutIntensity) {
    float lutSize = float(textureSize(lutTexture, 0).x);
    float scale = (lutSize - 1.0) / lutSize;
    float offset = 1.0 / (2.0 * lutSize);

    vec3 col = LUTLinearTosRGB(color);
    vec3 rgb = col * scale + offset;
    vec4 lutColor = texture(lutTexture, rgb);
    return LUTsRGBToLinear(mix(col, lutColor.rgb, lutIntensity));
}

vec3 apply3DLUTTetrahedral(vec3 color, sampler3D lutTexture, float lutIntensity) {
    float lutSize = float(textureSize(lutTexture, 0).x);
    float scale = lutSize - 1.0;
    float offset = 0.0;
    float texelSize = 1.0 / lutSize;

    vec3 col = LUTLinearTosRGB(color);
    vec3 rgb = clamp(col, 0.0, 1.0) * scale + offset;
    vec3 p = floor(rgb);
    vec3 f = rgb - p;

    vec3 v1 = (p + 0.5) * texelSize;
    vec3 v4 = (p + 1.5) * texelSize;
    vec3 v2, v3;
    vec3 frac;

    if(f.r >= f.g) {
        if(f.g > f.b) {
            
            frac = f.rgb;
            v2 = vec3(v4.x, v1.y, v1.z);
            v3 = vec3(v4.x, v4.y, v1.z);
        } else if(f.r >= f.b) {
            
            frac = f.rbg;
            v2 = vec3(v4.x, v1.y, v1.z);
            v3 = vec3(v4.x, v1.y, v4.z);
        } else {
            
            frac = f.brg;
            v2 = vec3(v1.x, v1.y, v4.z);
            v3 = vec3(v4.x, v1.y, v4.z);
        }
    } else {
        if(f.b > f.g) {
            
            frac = f.bgr;
            v2 = vec3(v1.x, v1.y, v4.z);
            v3 = vec3(v1.x, v4.y, v4.z);
        } else if(f.r >= f.b) {
            
            frac = f.grb;
            v2 = vec3(v1.x, v4.y, v1.z);
            v3 = vec3(v4.x, v4.y, v1.z);
        } else {
            
            frac = f.gbr;
            v2 = vec3(v1.x, v4.y, v1.z);
            v3 = vec3(v1.x, v4.y, v4.z);
        }
    }

    vec4 n1 = texture(lutTexture, v1);
    vec4 n2 = texture(lutTexture, v2);
    vec4 n3 = texture(lutTexture, v3);
    vec4 n4 = texture(lutTexture, v4);

    vec4 weights = vec4(
        1.0 - frac.x,
        frac.x - frac.y,
        frac.y - frac.z,
        frac.z
    );

    vec4 result = weights * mat4(
        vec4(n1.r, n2.r, n3.r, n4.r),
        vec4(n1.g, n2.g, n3.g, n4.g),
        vec4(n1.b, n2.b, n3.b, n4.b),
        vec4(1.0)
    );

    return LUTsRGBToLinear(mix(col, result.rgb, lutIntensity));
}`;

export const rotate = `mat2 rotation2D(float angle) {
    float s = sin(angle);
	float c = cos(angle);
	return mat2(c, s, -s, c);
}

vec2 rotate2D(vec2 v, float angle) {
	return rotation2D(angle) * v;
}

mat3 rotateX(float angle) {
    float s = sin(angle);
	float c = cos(angle);

	return mat3(
		1.0, 0.0, 0.0,
		0.0, c, s,
		0.0, -s, c
	);
}

mat3 rotateY(float angle) {
    float c = cos(angle);
    float s = sin(angle);

    return mat3(
		c, 0.0, -s,
		0.0, 1.0, 0.0,
		s, 0.0, c
	);
}

mat3 rotateZ(float angle) {
    float c = cos(angle);
    float s = sin(angle);

    return mat3(
		c, s, 0.0,
		-s, c, 0.0,
		0.0, 0.0, 1.0
	);
}

mat4 rotation3D(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;

    return mat4(oc * axis.x * axis.x + c, oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c, oc * axis.y * axis.z - axis.x * s,  0.0,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,  0.0,
                0.0, 0.0, 0.0, 1.0);
}

vec3 rotate3D(vec3 v, vec3 axis, float angle) {
	mat4 m = rotation3D(axis, angle);
	return (m * vec4(v, 1.0)).xyz;
}

vec3 applyQuat(vec3 vec, vec4 quat) {
    vec3 t = 2.0 * cross(quat.xyz, vec);
    return vec + quat.w * t + cross(quat.xyz, t);
}

vec4 quatNormalize(vec4 q) {
    float len = length(q);
    if (len == 0.0) return vec4(vec3(0.0), 1.0);
    return q / len;
}

vec4 quatFromAxisAngle(vec3 axis, float angle) {
	float sn = sin(angle * 0.5);
	float cs = cos(angle * 0.5);
	return vec4(axis * sn, cs);
}

vec4 quatFromUnitVectors(vec3 v1, vec3 v2) {
    float r = dot(v1, v2) + 1.0;
    if (r < 1e-6) return quatNormalize(abs(v1.x) > abs(v1.z) ? vec4(-v1.y, v1.x, 0.0, 0.0) : vec4(0.0, -v1.z, v1.y, 0.0));
    
    vec4 q = vec4(cross(v1, v2), r);
    return q / length(q);
}`;


export const matrixutils = `vec3 getMatrixTranslation(mat4 mat) {
    return vec3(mat[3]);
}

void setMatrixTranslation(inout mat4 mat, vec3 translation) {
    mat[3].xyz = translation;
}

vec3 getMatrixScale(mat4 mat) {
    vec3 scale = vec3(length(mat[0].xyz), length(mat[1].xyz), length(mat[2].xyz));
    return determinant(mat) < 0.0 ? vec3(-scale.x, scale.yz) : scale;
}

void setMatrixScale(inout mat4 mat, vec3 scale) {
    vec3 invScale = 1.0 / getMatrixScale(mat);
    mat[0] *= invScale.x * scale.x;
    mat[1] *= invScale.y * scale.y;
    mat[2] *= invScale.z * scale.z;
}

mat4 getMatrixRotation(mat4 mat) {
    mat4 m = mat4(1.0);
    vec3 scale = getMatrixScale(mat);
    m[0] = mat[0] / scale.x;
    m[1] = mat[1] / scale.y;
    m[2] = mat[2] / scale.z;
    return m;
}

void setMatrixRotation(inout mat4 mat, vec3 rotation) {
    vec3 scale = getMatrixScale(mat);

    float x = rotation.x, y = rotation.y, z = rotation.z;
    float a = cos(x), b = sin(x);
    float c = cos(y), d = sin(y);
    float e = cos(z), f = sin(z);

    
    float ae = a * e, af = a * f, be = b * e, bf = b * f;
    mat[0].xyz = vec3(c * e, -c * f, d) * scale.x;
    mat[1].xyz = vec3(af + be * d, ae - bf * d, -b * c) * scale.y;
    mat[2].xyz = vec3(bf - ae * d, be + af * d, a * c) * scale.z;
}

void matrixCompose(inout mat4 mat, vec3 translation, vec4 quaternion, vec3 scale) {
    float x = quaternion.x; float y = quaternion.y; float z = quaternion.z; float w = quaternion.w;
    float x2 = x + x; float y2 = y + y; float z2 = z + z;
    float xx = x * x2; float xy = x * y2; float xz = x * z2;
    float yy = y * y2; float yz = y * z2; float zz = z * z2;
    float wx = w * x2; float wy = w * y2; float wz = w * z2;
    float sx = scale.x; float sy = scale.y; float sz = scale.z;
    mat[0] = vec4((1.0 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0.0);
    mat[1] = vec4((xy - wz) * sy, (1.0 - (xx + zz)) * sy, (yz + wx) * sy, 0.0);
    mat[2] = vec4((xz + wy) * sz, (yz - wx) * sz, (1.0 - (xx + yy)) * sz, 0.0);
    mat[3] = vec4(translation.xyz, 1.0);
}

vec3 getViewRight() {
    return vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
}

vec3 getViewLeft() {
    return -getViewRight();
}

vec3 getViewUp() {
    return vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
}

vec3 getViewDown() {
    return -getViewUp();
}

vec3 getViewBack() {
    return vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
}

vec3 getViewForward() {
    return -getViewBack();
}

mat4 billBoardMatrix(mat4 mat) {
    mat4 m = mat4(1.0);
    vec3 scale = getMatrixScale(mat);
    m[0].xyz = getViewRight() * scale.x;
    m[1].xyz = getViewUp() * scale.y;
    m[2].xyz = getViewBack() * scale.z;
    m[3].xyz = getMatrixTranslation(mat);
    return m;
}

mat4 billboardModelMatrix(vec3 offset) {
    mat4 m = billBoardMatrix(modelMatrix);
    setMatrixTranslation(m, offset);
    return m;
}

mat4 billboardModelMatrix() {
    return billBoardMatrix(modelMatrix);
}`;
