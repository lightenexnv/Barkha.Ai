import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RainwaterIsland } from "./RainwaterIsland";
import { waterFragmentShader, waterVertexShader } from "./waterShader";
import type { HeroLayout } from "./heroLayout";

const CAMERA_FOV = 30;
const CAMERA_DISTANCE = 30;
// Visible world height on the z = 0 plane, where the island lives.
const VISIBLE_HEIGHT = 2 * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2)) * CAMERA_DISTANCE;
// Approximate on-screen width of the island model, in model units.
const ISLAND_SPAN = 12.6;

interface SceneProps {
  layout: HeroLayout;
  backdrop: HTMLCanvasElement;
  backdropVersion: number;
  animate: boolean;
  active: boolean;
  eventSource: RefObject<HTMLElement>;
  onReady: () => void;
}

/**
 * Renders the 3D scene into an off-screen target, then draws one full-screen
 * pass that refracts the scene and the painted backdrop with the water shader.
 */
function WaterPass({
  backdrop,
  backdropVersion,
  waterline,
  animate,
  onReady,
}: {
  backdrop: HTMLCanvasElement;
  backdropVersion: number;
  waterline: number;
  animate: boolean;
  onReady: () => void;
}) {
  const { gl, scene, camera, size, invalidate } = useThree();
  const readyRef = useRef(false);

  const target = useMemo(
    () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }),
    [],
  );

  const backdropTexture = useMemo(() => {
    const texture = new THREE.CanvasTexture(backdrop);
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  }, [backdrop]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: waterVertexShader,
        fragmentShader: waterFragmentShader,
        uniforms: {
          uBackdrop: { value: null },
          uScene: { value: null },
          uResolution: { value: new THREE.Vector2(1, 1) },
          uPixelRatio: { value: 1 },
          uTime: { value: 0 },
          uWaterline: { value: 0.5 },
        },
        depthTest: false,
        depthWrite: false,
      }),
    [],
  );

  const pass = useMemo(() => {
    const passScene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    passScene.add(quad);
    return { scene: passScene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad };
  }, [material]);

  const uploadedSize = useRef({ width: 0, height: 0 });

  useEffect(() => {
    // GPU texture storage is fixed-size; when the canvas was resized, drop it
    // so three.js allocates a new one at the new size.
    const last = uploadedSize.current;
    if (last.width && (last.width !== backdrop.width || last.height !== backdrop.height)) {
      backdropTexture.dispose();
    }
    uploadedSize.current = { width: backdrop.width, height: backdrop.height };
    backdropTexture.needsUpdate = true;
    invalidate();
  }, [backdrop, backdropTexture, backdropVersion, invalidate]);

  useEffect(
    () => () => {
      target.dispose();
      backdropTexture.dispose();
      material.dispose();
      pass.quad.geometry.dispose();
    },
    [target, backdropTexture, material, pass],
  );

  const bufferSize = useMemo(() => new THREE.Vector2(), []);

  useFrame((state) => {
    gl.getDrawingBufferSize(bufferSize);
    if (target.width !== bufferSize.x || target.height !== bufferSize.y) {
      target.setSize(bufferSize.x, bufferSize.y);
    }

    const uniforms = material.uniforms;
    uniforms.uBackdrop.value = backdropTexture;
    uniforms.uScene.value = target.texture;
    uniforms.uResolution.value.copy(bufferSize);
    uniforms.uPixelRatio.value = gl.getPixelRatio();
    uniforms.uTime.value = animate ? state.clock.elapsedTime : 0;
    uniforms.uWaterline.value = waterline / Math.max(1, size.height);

    gl.setRenderTarget(target);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.render(pass.scene, pass.camera);

    if (!readyRef.current) {
      readyRef.current = true;
      onReady();
    }
  }, 1);

  return null;
}

/** Places the island at the layout's anchor and gives it a gentle float. */
function IslandRig({ layout, animate }: { layout: HeroLayout; animate: boolean }) {
  const { size } = useThree();
  const root = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const turn = useRef<THREE.Group>(null);

  const unitsPerPx = VISIBLE_HEIGHT / Math.max(1, size.height);
  const x = (layout.island.x - size.width / 2) * unitsPerPx;
  const y = (size.height / 2 - layout.island.y) * unitsPerPx;
  const scale = (layout.island.width * unitsPerPx) / ISLAND_SPAN;

  useFrame((state, delta) => {
    if (!root.current || !tilt.current || !turn.current) return;
    const t = state.clock.elapsedTime;
    const bob = animate ? Math.sin(t * 0.9) * 0.06 * scale : 0;
    root.current.position.set(x, y + bob, 0);

    const pointerX = animate ? state.pointer.x : 0;
    const pointerY = animate ? state.pointer.y : 0;
    const targetTilt = 0.5 - pointerY * 0.05;
    const targetTurn = -0.62 + pointerX * 0.14 + (animate ? Math.sin(t * 0.25) * 0.05 : 0);
    const ease = 1 - Math.exp(-delta * 3);
    tilt.current.rotation.x += (targetTilt - tilt.current.rotation.x) * ease;
    turn.current.rotation.y += (targetTurn - turn.current.rotation.y) * ease;
  });

  return (
    <group ref={root} position={[x, y, 0]} scale={scale}>
      <group ref={tilt} rotation={[0.5, 0, 0]}>
        <group ref={turn} rotation={[0, -0.62, 0]}>
          <RainwaterIsland animate={animate} showLabels={layout.island.width >= 340} />
        </group>
      </group>
    </group>
  );
}

export default function WaterHeroScene({
  layout,
  backdrop,
  backdropVersion,
  animate,
  active,
  eventSource,
  onReady,
}: SceneProps) {
  return (
    <Canvas
      shadows
      flat
      dpr={[1, 2]}
      camera={{ fov: CAMERA_FOV, position: [0, 0, CAMERA_DISTANCE], near: 1, far: 100 }}
      gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
      frameloop={!active ? "never" : animate ? "always" : "demand"}
      eventSource={eventSource as RefObject<HTMLElement>}
      eventPrefix="client"
      aria-hidden="true"
    >
      <hemisphereLight args={["#e6f4ff", "#5f8a45", 1.1]} />
      <ambientLight intensity={0.35} />
      <IslandRig layout={layout} animate={animate} />
      <WaterPass
        backdrop={backdrop}
        backdropVersion={backdropVersion}
        waterline={layout.waterline}
        animate={animate}
        onReady={onReady}
      />
    </Canvas>
  );
}
