/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { FluidProps } from '../../types.tsx';
import { useTheme } from '../../Theme.tsx';

interface IridescentFluidProps {
    config: FluidProps;
    clearTrigger: number;
    imageUrl?: string;
}

// --- SHADER CHUNKS ---
const BASE_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const SPLAT_SHADER = `
  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec3 color;
  uniform vec2 point;
  uniform float radius;

  void main() {
    vec2 p = vUv - point.xy;
    p.x *= aspectRatio;
    vec3 splat = exp(-dot(p, p) / radius) * color;
    vec3 base = texture2D(uTarget, vUv).xyz;
    gl_FragColor = vec4(base + splat, 1.0);
  }
`;

const ADVECTION_SHADER = `
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 texelSize;
  uniform float dt;
  uniform float dissipation;

  void main() {
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    vec4 result = texture2D(uSource, coord);
    float decay = 1.0 + dissipation * dt;
    gl_FragColor = result / decay;
  }
`;

const DIVERGENCE_SHADER = `
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform vec2 texelSize;

  void main() {
    float L = texture2D(uVelocity, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(uVelocity, vUv + vec2(texelSize.x, 0.0)).x;
    float T = texture2D(uVelocity, vUv + vec2(0.0, texelSize.y)).y;
    float B = texture2D(uVelocity, vUv - vec2(0.0, texelSize.y)).y;

    vec2 C = texture2D(uVelocity, vUv).xy;
    if (vUv.x < 0.0) L = -C.x;
    if (vUv.x > 1.0) R = -C.x;
    if (vUv.y > 1.0) T = -C.y;
    if (vUv.y < 0.0) B = -C.y;

    float div = 0.5 * (R - L + T - B);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
  }
`;

const PRESSURE_SHADER = `
  varying vec2 vUv;
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  uniform vec2 texelSize;

  void main() {
    float L = texture2D(uPressure, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(uPressure, vUv + vec2(texelSize.x, 0.0)).x;
    float T = texture2D(uPressure, vUv + vec2(0.0, texelSize.y)).x;
    float B = texture2D(uPressure, vUv - vec2(0.0, texelSize.y)).x;
    float C = texture2D(uPressure, vUv).x;
    float divergence = texture2D(uDivergence, vUv).x;
    float pressure = (L + R + B + T - divergence) * 0.25;
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
  }
`;

const GRADIENT_SUBTRACT_SHADER = `
  varying vec2 vUv;
  uniform sampler2D uPressure;
  uniform sampler2D uVelocity;
  uniform vec2 texelSize;

  void main() {
    float L = texture2D(uPressure, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(uPressure, vUv + vec2(texelSize.x, 0.0)).x;
    float T = texture2D(uPressure, vUv + vec2(0.0, texelSize.y)).x;
    float B = texture2D(uPressure, vUv - vec2(0.0, texelSize.y)).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity.xy -= vec2(R - L, T - B);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

const DISPLAY_SHADER = `
  varying vec2 vUv;
  uniform sampler2D uDensity;
  uniform sampler2D uVelocity;
  uniform sampler2D uImage;
  uniform vec2 texelSize;
  uniform float uAspectRatio;
  uniform vec3 uBackgroundColor;
  uniform bool uIsDarkMode;

  vec3 palette( in float t ) {
      vec3 base = uIsDarkMode ? vec3(0.5) : vec3(0.8);
      vec3 amp = uIsDarkMode ? vec3(0.18) : vec3(0.2);
      return base + amp * cos( 6.28318 * (vec3(1.0) * t + vec3(0.00, 0.33, 0.67)) );
  }

  void main() {
    // 1. Data Sampling
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    float d = texture2D(uDensity, vUv).x;
    float speed = length(velocity);
    
    // 2. Localized Displacement Mask
    // Displacement ONLY within the disturbance splat area
    float displacementMask = smoothstep(0.0, 0.05, d);
    vec2 refractedUv = vUv - (velocity * 0.06 * displacementMask);
    
    // 3. Centered Image Rendering
    // Scale image down to a small size in center center
    float imgSize = 0.35; 
    vec2 centeredUv = (refractedUv - 0.5) / imgSize + 0.5;
    
    bool inBounds = centeredUv.x >= 0.0 && centeredUv.x <= 1.0 && centeredUv.y >= 0.0 && centeredUv.y <= 1.0;
    
    vec3 baseColor;
    if (inBounds) {
        // Blur logic: Blur what's behind the disturbance
        float blurScale = d * 0.025; 
        
        vec3 s0 = texture2D(uImage, centeredUv).rgb;
        vec3 s1 = texture2D(uImage, centeredUv + vec2(blurScale, 0.0)).rgb;
        vec3 s2 = texture2D(uImage, centeredUv - vec2(blurScale, 0.0)).rgb;
        vec3 s3 = texture2D(uImage, centeredUv + vec2(0.0, blurScale)).rgb;
        vec3 s4 = texture2D(uImage, centeredUv - vec2(0.0, blurScale)).rgb;
        
        baseColor = (s0 + s1 + s2 + s3 + s4) * 0.2;
    } else {
        baseColor = uBackgroundColor;
    }

    // 4. Fluid Visuals (Oil iridescence overlay)
    float shape = smoothstep(0.0, 0.02, d);
    if (shape > 0.001) {
        float dx = texture2D(uDensity, vUv + vec2(texelSize.x, 0.0)).x - texture2D(uDensity, vUv - vec2(texelSize.x, 0.0)).x;
        float dy = texture2D(uDensity, vUv + vec2(0.0, texelSize.y)).x - texture2D(uDensity, vUv - vec2(0.0, texelSize.y)).x;
        vec3 normal = normalize(vec3(dx * 8.0, dy * 8.0, 1.0));
        float fresnel = pow(1.0 - max(0.0, dot(normal, vec3(0.0, 0.0, 1.0))), 3.0);

        vec3 rainbow = palette(speed * 3.5 + fresnel * 0.4);
        float interferenceStrength = clamp(fresnel * 0.4 + speed * 0.5, 0.0, 1.0);

        // Blend the iridescent oil effect over the (potentially blurred/displaced) background
        vec3 fluidColor = mix(baseColor, rainbow, interferenceStrength * 0.65);
        baseColor = mix(baseColor, fluidColor, shape);
    }
    
    gl_FragColor = vec4(baseColor, 1.0);
  }
`;

// --- COMPONENT ---

const IridescentFluid: React.FC<IridescentFluidProps> = ({ config, clearTrigger, imageUrl }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRefs = useRef<any>({});
  const configRef = useRef(config);
  const { theme, themeName } = useTheme();

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    if (clearTrigger > 0 && simRefs.current.renderer) {
      const { renderer, velocity, density } = simRefs.current;
      renderer.setRenderTarget(velocity.read);
      renderer.clear();
      renderer.setRenderTarget(velocity.write);
      renderer.clear();
      renderer.setRenderTarget(density.read);
      renderer.clear();
      renderer.setRenderTarget(density.write);
      renderer.clear();
      renderer.setRenderTarget(null);
    }
  }, [clearTrigger]);

  useEffect(() => {
    const { renderer, displayMat } = simRefs.current;
    if (renderer && displayMat) {
      renderer.setClearColor(theme.Color.Base.Surface[1], 1);
      displayMat.uniforms.uBackgroundColor.value.set(theme.Color.Base.Surface[1]);
      displayMat.uniforms.uIsDarkMode.value = themeName === 'dark';
    }
  }, [theme, themeName]);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const simRes = 256; 
    const dyeRes = 1024; 
    
    const renderer = new THREE.WebGLRenderer({ 
        canvas: canvasRef.current, 
        alpha: false, 
        antialias: false,
        powerPreference: 'high-performance'
    });
    
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const scene = new THREE.Scene();
    const plane = new THREE.PlaneGeometry(2, 2);
    
    const type = /(iPad|iPhone|iPod)/g.test(navigator.userAgent) ? THREE.HalfFloatType : THREE.FloatType;

    const createFBO = (res: number) => new THREE.WebGLRenderTarget(res, res, {
        type, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
    });

    const createDoubleFBO = (res: number) => ({
        read: createFBO(res), write: createFBO(res),
        swap: function() { [this.read, this.write] = [this.write, this.read]; }
    });

    let velocity = createDoubleFBO(simRes);
    let density = createDoubleFBO(dyeRes);
    let divergence = createFBO(simRes);
    let pressure = createDoubleFBO(simRes);

    const createShaderMaterial = (fs: string) => new THREE.ShaderMaterial({
        uniforms: {
            uVelocity: { value: null }, uSource: { value: null }, uTarget: { value: null },
            uPressure: { value: null }, uDivergence: { value: null }, uDensity: { value: null },
            uImage: { value: null },
            texelSize: { value: new THREE.Vector2() }, dt: { value: 0.016 }, dissipation: { value: 0.98 },
            aspectRatio: { value: 1.0 }, color: { value: new THREE.Vector3() },
            point: { value: new THREE.Vector2() }, radius: { value: 0.0 },
            uBackgroundColor: { value: new THREE.Color() },
            uIsDarkMode: { value: false },
            uAspectRatio: { value: 1.0 }
        },
        vertexShader: BASE_VERTEX, fragmentShader: fs,
        depthWrite: false, depthTest: false, blending: THREE.NoBlending
    });

    const splatMat = createShaderMaterial(SPLAT_SHADER);
    const advectionMat = createShaderMaterial(ADVECTION_SHADER);
    const divergenceMat = createShaderMaterial(DIVERGENCE_SHADER);
    const pressureMat = createShaderMaterial(PRESSURE_SHADER);
    const gradientSubtractMat = createShaderMaterial(GRADIENT_SUBTRACT_SHADER);
    const displayMat = createShaderMaterial(DISPLAY_SHADER);

    const dummyTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
    dummyTex.needsUpdate = true;
    displayMat.uniforms.uImage.value = dummyTex;

    if (imageUrl) {
        new THREE.TextureLoader().load(imageUrl, (tex) => {
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.wrapS = THREE.ClampToEdgeWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
            displayMat.uniforms.uImage.value = tex;
        });
    }

    const quad = new THREE.Mesh(plane, displayMat);
    scene.add(quad);
    
    simRefs.current = { renderer, velocity, density, displayMat };

    // Initial theme setup
    renderer.setClearColor(theme.Color.Base.Surface[1], 1);
    displayMat.uniforms.uBackgroundColor.value.set(theme.Color.Base.Surface[1]);
    displayMat.uniforms.uIsDarkMode.value = themeName === 'dark';

    const pointer = { x: 0, y: 0, dx: 0, dy: 0, moved: false, down: false };
    
    const updatePointer = (x: number, y: number) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const nx = (x - rect.left) / rect.width;
        const ny = 1.0 - (y - rect.top) / rect.height; 
        pointer.dx = nx - pointer.x;
        pointer.dy = ny - pointer.y;
        pointer.x = nx;
        pointer.y = ny;
        pointer.moved = true;
    };

    const onMouseMove = (e: MouseEvent) => updatePointer(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); updatePointer(e.touches[0].clientX, e.touches[0].clientY); };
    window.addEventListener('mousemove', onMouseMove);
    canvasRef.current.addEventListener('touchmove', onTouchMove, { passive: false });

    const blit = (target: THREE.WebGLRenderTarget | null) => {
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
    };

    const splat = (target: any, color: THREE.Vector3, point: THREE.Vector2, radius: number) => {
        quad.material = splatMat;
        splatMat.uniforms.uTarget.value = target.read.texture;
        splatMat.uniforms.aspectRatio.value = canvasRef.current!.width / canvasRef.current!.height;
        splatMat.uniforms.point.value.copy(point);
        splatMat.uniforms.color.value.copy(color);
        splatMat.uniforms.radius.value = radius;
        blit(target.write);
        target.swap();
    };

    let lastTime = Date.now();
    let animationFrameId: number;

    const animate = () => {
        const now = Date.now();
        const dt = Math.min((now - lastTime) / 1000, 0.032);
        lastTime = now;
        const currentConfig = configRef.current;

        if (pointer.moved) {
            const vStrength = currentConfig.splatStrength;
            splat(velocity, new THREE.Vector3(pointer.dx * vStrength, pointer.dy * vStrength, 0.0), new THREE.Vector2(pointer.x, pointer.y), currentConfig.splatRadius);
            splat(density, new THREE.Vector3(1.0, 0.0, 0.0), new THREE.Vector2(pointer.x, pointer.y), currentConfig.splatRadius);
            pointer.moved = false;
        }

        quad.material = advectionMat;
        advectionMat.uniforms.dt.value = dt;
        advectionMat.uniforms.dissipation.value = currentConfig.velocityDissipation;
        advectionMat.uniforms.uVelocity.value = velocity.read.texture;
        advectionMat.uniforms.uSource.value = velocity.read.texture;
        advectionMat.uniforms.texelSize.value.set(1.0 / simRes, 1.0 / simRes);
        blit(velocity.write);
        velocity.swap();

        advectionMat.uniforms.dissipation.value = currentConfig.densityDissipation;
        advectionMat.uniforms.uSource.value = density.read.texture;
        advectionMat.uniforms.texelSize.value.set(1.0 / dyeRes, 1.0 / dyeRes);
        blit(density.write);
        density.swap();

        quad.material = divergenceMat;
        divergenceMat.uniforms.uVelocity.value = velocity.read.texture;
        divergenceMat.uniforms.texelSize.value.set(1.0 / simRes, 1.0 / simRes);
        blit(divergence);

        quad.material = pressureMat;
        pressureMat.uniforms.uDivergence.value = divergence.texture;
        pressureMat.uniforms.texelSize.value.set(1.0 / simRes, 1.0 / simRes);
        for (let i = 0; i < currentConfig.pressureIterations; i++) {
            pressureMat.uniforms.uPressure.value = pressure.read.texture;
            blit(pressure.write);
            pressure.swap();
        }

        quad.material = gradientSubtractMat;
        gradientSubtractMat.uniforms.uPressure.value = pressure.read.texture;
        gradientSubtractMat.uniforms.uVelocity.value = velocity.read.texture;
        gradientSubtractMat.uniforms.texelSize.value.set(1.0 / simRes, 1.0 / simRes);
        blit(velocity.write);
        velocity.swap();

        renderer.setRenderTarget(null);
        quad.material = displayMat;
        displayMat.uniforms.uDensity.value = density.read.texture;
        displayMat.uniforms.uVelocity.value = velocity.read.texture;
        displayMat.uniforms.texelSize.value.set(1.0 / dyeRes, 1.0 / dyeRes);
        renderer.render(scene, camera);

        animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
        if (!containerRef.current || !canvasRef.current) return;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        renderer.setSize(w, h, false);
        displayMat.uniforms.uAspectRatio.value = w / h;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('resize', handleResize);
        if (canvasRef.current) {
            canvasRef.current.removeEventListener('touchmove', onTouchMove);
        }
        renderer.dispose();
    };
  }, [imageUrl]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      <div style={{
          position: 'absolute',
          bottom: '32px',
          width: '100%',
          textAlign: 'center',
          pointerEvents: 'none',
          fontFamily: '"Inter", sans-serif',
          fontSize: '12px',
          color: theme.Color.Base.Content[3],
          letterSpacing: '0.05em',
          textTransform: 'uppercase'
      }}>
          Touch & Drag to Disturb
      </div>
    </div>
  );
};

export default IridescentFluid;