

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { FluidProps } from '../../types/index.tsx';

interface IridescentFluidProps {
    config: FluidProps;
    clearTrigger: number;
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
  uniform vec2 texelSize;

  // More subtle, pastel-like palette
  vec3 palette( in float t ) {
      return vec3(0.8) + vec3(0.2) * cos( 6.28318 * (vec3(1.0) * t + vec3(0.00, 0.33, 0.67)) );
  }

  void main() {
    // 1. Velocity & Density
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    vec2 distortedUv = vUv - velocity * 0.003; // Refraction effect
    float d = texture2D(uDensity, distortedUv).x;
    
    // 2. Shape (based on density to keep form)
    float shape = smoothstep(0.0, 0.02, d);
    
    if (shape < 0.001) {
        gl_FragColor = vec4(1.0); // White background
        return;
    }

    // 3. Normal & Fresnel (based on density for 3D effect)
    float dx = texture2D(uDensity, vUv + vec2(texelSize.x, 0.0)).x - texture2D(uDensity, vUv - vec2(texelSize.x, 0.0)).x;
    float dy = texture2D(uDensity, vUv + vec2(0.0, texelSize.y)).x - texture2D(uDensity, vUv - vec2(0.0, texelSize.y)).x;
    vec3 normal = normalize(vec3(dx * 8.0, dy * 8.0, 1.0));
    float fresnel = 1.0 - max(0.0, dot(normal, vec3(0.0, 0.0, 1.0)));
    fresnel = pow(fresnel, 3.0);

    // 4. Iridescence (Color based on VELOCITY)
    float speed = length(velocity);
    // Drastically reduced speed multiplier to soften color rings.
    vec3 rainbow = palette(speed * 4.0 + fresnel * 0.5);

    // 5. Composition
    vec3 bg = vec3(1.0);
    vec3 absorbed = bg; // No absorption for a clean look

    // Drastically reduced speed multiplier for interference strength to soften rings.
    float interferenceStrength = fresnel * 0.5 + speed * 0.4; 
    interferenceStrength = clamp(interferenceStrength, 0.0, 1.0);

    vec3 fluidColor = mix(absorbed, rainbow, interferenceStrength * 0.75);
    
    gl_FragColor = vec4(mix(bg, fluidColor, shape), 1.0);
  }
`;

// --- COMPONENT ---

const IridescentFluid: React.FC<IridescentFluidProps> = ({ config, clearTrigger }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRefs = useRef<any>({});
  const configRef = useRef(config);

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
    if (!containerRef.current || !canvasRef.current) return;

    const simRes = 256; 
    const dyeRes = 1024; 
    
    const renderer = new THREE.WebGLRenderer({ 
        canvas: canvasRef.current, 
        alpha: false, 
        antialias: false,
        powerPreference: 'high-performance'
    });
    renderer.setClearColor(0xffffff, 1);
    
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
            texelSize: { value: new THREE.Vector2() }, dt: { value: 0.016 }, dissipation: { value: 0.98 },
            aspectRatio: { value: 1.0 }, color: { value: new THREE.Vector3() },
            point: { value: new THREE.Vector2() }, radius: { value: 0.0 },
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

    const quad = new THREE.Mesh(plane, displayMat);
    scene.add(quad);
    
    simRefs.current = { renderer, velocity, density };

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
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight, false);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('resize', handleResize);
        if (canvasRef.current) {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            canvasRef.current.removeEventListener('touchmove', onTouchMove);
        }
        renderer.dispose();
    };
  }, []);

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
          color: '#aaa',
          letterSpacing: '0.05em',
          textTransform: 'uppercase'
      }}>
          Touch & Drag to Disturb
      </div>
    </div>
  );
};

export default IridescentFluid;