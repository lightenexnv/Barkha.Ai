import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

// A 3D recreation of the hero illustration: a house whose flat roof feeds a
// downpipe, filter unit, storage tank and recharge pit, sitting on a block of
// soil layers that ends in groundwater. Units are local; the grass top is y = 0.

type Vec3 = [number, number, number];

const COLORS = {
  grass: "#8cc152",
  grassEdge: "#76ad3f",
  topsoil: "#a47a59",
  subsoil: "#8b6348",
  gravel: "#71594a",
  aquifer: "#3f93c4",
  wall: "#f6e3c3",
  plinth: "#dcc7a3",
  roof: "#ee8a5f",
  parapet: "#cf6a43",
  door: "#a8652e",
  glass: "#97d4ee",
  frame: "#ffffff",
  pipe: "#a9cfe4",
  water: "#2ba3dc",
  filter: "#b7c4cc",
  filterLid: "#7d8f99",
  tank: "#c7ecf3",
  tankLid: "#4d9dc0",
  pit: "#9aa5ab",
  pitWater: "#2f86b5",
  openSpace: "#b5dc7d",
  trunk: "#8a5a3b",
  leaf: "#5aae4a",
  leafLight: "#74c25a",
  cloud: "#ffffff",
  rain: "#cfeeff",
};

/* ------------------------------------------------------------------ */
/* Polyline helpers for pipes and the water flowing through them       */
/* ------------------------------------------------------------------ */

function makePolyline(points: Vec3[]) {
  const vectors = points.map((p) => new THREE.Vector3(...p));
  const lengths = [0];
  for (let i = 1; i < vectors.length; i++) {
    lengths.push(lengths[i - 1] + vectors[i].distanceTo(vectors[i - 1]));
  }
  const total = lengths[lengths.length - 1];

  return {
    vectors,
    total,
    pointAt(t: number, target: THREE.Vector3) {
      const d = t * total;
      let i = 1;
      while (i < lengths.length - 1 && lengths[i] < d) i++;
      const span = lengths[i] - lengths[i - 1] || 1;
      return target.lerpVectors(vectors[i - 1], vectors[i], (d - lengths[i - 1]) / span);
    },
  };
}

const UP = new THREE.Vector3(0, 1, 0);

function Pipe({ points, radius = 0.1, animate }: { points: Vec3[]; radius?: number; animate: boolean }) {
  const line = useMemo(() => makePolyline(points), [points]);

  const segments = useMemo(
    () =>
      line.vectors.slice(1).map((end, i) => {
        const start = line.vectors[i];
        const dir = end.clone().sub(start);
        return {
          position: start.clone().add(end).multiplyScalar(0.5),
          quaternion: new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()),
          length: dir.length(),
        };
      }),
    [line],
  );

  const dropCount = Math.max(3, Math.round(line.total * 2.2));
  const drops = useRef<THREE.InstancedMesh>(null);
  const scratch = useMemo(() => ({ v: new THREE.Vector3(), m: new THREE.Matrix4() }), []);

  useFrame(({ clock }) => {
    const mesh = drops.current;
    if (!mesh) return;
    const t = animate ? clock.elapsedTime : 0;
    for (let i = 0; i < dropCount; i++) {
      const phase = (t * (0.9 / line.total) + i / dropCount) % 1;
      line.pointAt(phase, scratch.v);
      scratch.m.makeTranslation(scratch.v.x, scratch.v.y, scratch.v.z);
      mesh.setMatrixAt(i, scratch.m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {segments.map((s, i) => (
        <mesh key={i} position={s.position} quaternion={s.quaternion} castShadow>
          <cylinderGeometry args={[radius, radius, s.length, 14, 1, true]} />
          <meshPhysicalMaterial
            color={COLORS.pipe}
            roughness={0.15}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
      {line.vectors.map((v, i) => (
        <mesh key={`j${i}`} position={v}>
          <sphereGeometry args={[radius * 1.15, 14, 10]} />
          <meshStandardMaterial color={COLORS.pipe} roughness={0.3} transparent opacity={0.7} depthWrite={false} />
        </mesh>
      ))}
      <instancedMesh ref={drops} args={[undefined, undefined, dropCount]}>
        <sphereGeometry args={[radius * 0.62, 10, 8]} />
        <meshStandardMaterial color={COLORS.water} emissive="#0e8fd6" emissiveIntensity={0.55} roughness={0.2} />
      </instancedMesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Scene pieces                                                         */
/* ------------------------------------------------------------------ */

function Ground() {
  // Layers from the grass down to groundwater: [height, colour]
  const layers: [number, string][] = [
    [0.95, COLORS.topsoil],
    [0.8, COLORS.subsoil],
    [0.6, COLORS.gravel],
    [0.55, COLORS.aquifer],
  ];
  let top = -0.32;

  return (
    <group>
      <RoundedBox args={[10, 0.36, 8]} radius={0.12} smoothness={3} position={[0, -0.18, 0]} receiveShadow>
        <meshStandardMaterial color={COLORS.grass} roughness={0.95} />
      </RoundedBox>
      {layers.map(([h, color], i) => {
        const y = top - h / 2;
        top -= h;
        return (
          <mesh key={i} position={[0, y, 0]}>
            <boxGeometry args={[9.94 - i * 0.04, h, 7.94 - i * 0.04]} />
            <meshStandardMaterial color={color} roughness={i === 3 ? 0.35 : 0.95} />
          </mesh>
        );
      })}
      {/* Pebbles along the front of the gravel layer */}
      {Array.from({ length: 16 }, (_, i) => (
        <mesh key={`p${i}`} position={[-4.5 + i * 0.6 + (i % 3) * 0.08, -2.35 + (i % 2) * 0.18, 3.96]}>
          <icosahedronGeometry args={[0.12 + (i % 3) * 0.03, 0]} />
          <meshStandardMaterial color="#8d7563" flatShading />
        </mesh>
      ))}
    </group>
  );
}

function House() {
  return (
    <group position={[-2.3, 0, -1]}>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[4.65, 0.12, 3.85]} />
        <meshStandardMaterial color={COLORS.plinth} />
      </mesh>
      <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.4, 2.4, 3.6]} />
        <meshStandardMaterial color={COLORS.wall} roughness={0.85} />
      </mesh>

      {/* Flat roof catchment with parapet */}
      <mesh position={[0, 2.51, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.8, 0.22, 4]} />
        <meshStandardMaterial color={COLORS.roof} roughness={0.7} />
      </mesh>
      {(
        [
          [[0, 2.72, 1.93], [4.8, 0.2, 0.14]],
          [[0, 2.72, -1.93], [4.8, 0.2, 0.14]],
          [[2.33, 2.72, 0], [0.14, 0.2, 4]],
          [[-2.33, 2.72, 0], [0.14, 0.2, 4]],
        ] as [Vec3, Vec3][]
      ).map(([position, size], i) => (
        <mesh key={i} position={position} castShadow>
          <boxGeometry args={size} />
          <meshStandardMaterial color={COLORS.parapet} />
        </mesh>
      ))}

      {/* Door */}
      <mesh position={[0.8, 0.82, 1.82]}>
        <boxGeometry args={[0.95, 1.55, 0.06]} />
        <meshStandardMaterial color={COLORS.frame} />
      </mesh>
      <mesh position={[0.8, 0.8, 1.85]}>
        <boxGeometry args={[0.8, 1.45, 0.05]} />
        <meshStandardMaterial color={COLORS.door} roughness={0.6} />
      </mesh>

      {/* Windows */}
      {(
        [
          [[-1.2, 1.45, 1.82], [1.1, 0.85, 0.06]],
          [[2.22, 1.45, -0.4], [0.06, 0.85, 1.3]],
        ] as [Vec3, Vec3][]
      ).map(([position, size], i) => (
        <group key={i} position={position}>
          <mesh>
            <boxGeometry args={[size[0] + 0.14, size[1] + 0.14, size[2]]} />
            <meshStandardMaterial color={COLORS.frame} />
          </mesh>
          <mesh position={[size[0] > 0.5 ? 0 : 0.02, 0, size[0] > 0.5 ? 0.02 : 0]}>
            <boxGeometry args={size} />
            <meshPhysicalMaterial color={COLORS.glass} roughness={0.05} metalness={0.1} clearcoat={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function FilterUnit() {
  return (
    <group position={[1.2, 0, 1.9]}>
      <RoundedBox args={[0.8, 0.6, 0.7]} radius={0.06} position={[0, 0.3, 0]} castShadow>
        <meshStandardMaterial color={COLORS.filter} roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, 0.63, 0]} castShadow>
        <boxGeometry args={[0.86, 0.08, 0.76]} />
        <meshStandardMaterial color={COLORS.filterLid} />
      </mesh>
    </group>
  );
}

function StorageTank({ animate }: { animate: boolean }) {
  const water = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!water.current) return;
    const level = animate ? 0.55 + 0.3 * Math.sin(clock.elapsedTime * 0.35) : 0.7;
    water.current.scale.y = level;
    water.current.position.y = 0.06 + (1.85 * level) / 2;
  });

  return (
    <group position={[2.9, 0, 0.9]}>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[0.98, 0.98, 0.06, 40]} />
        <meshStandardMaterial color={COLORS.plinth} />
      </mesh>
      <mesh ref={water}>
        <cylinderGeometry args={[0.78, 0.78, 1.85, 40]} />
        <meshStandardMaterial color={COLORS.water} roughness={0.15} emissive="#0a6fa8" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.85, 0.85, 2, 40, 1, true]} />
        <meshPhysicalMaterial
          color={COLORS.tank}
          roughness={0.08}
          transparent
          opacity={0.42}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 2.04, 0]} castShadow>
        <cylinderGeometry args={[0.9, 0.9, 0.1, 40]} />
        <meshStandardMaterial color={COLORS.tankLid} roughness={0.4} />
      </mesh>
      {[0.5, 1.0, 1.5].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.86, 0.025, 8, 48]} />
          <meshStandardMaterial color={COLORS.tankLid} />
        </mesh>
      ))}
    </group>
  );
}

function RechargePit({ animate }: { animate: boolean }) {
  const ripple = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const mesh = ripple.current;
    if (!mesh) return;
    const p = animate ? (clock.elapsedTime * 0.45) % 1 : 0.5;
    mesh.scale.setScalar(0.15 + p * 0.85);
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - p);
  });

  return (
    <group position={[3.6, 0, 3.0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} castShadow>
        <torusGeometry args={[0.56, 0.1, 12, 40]} />
        <meshStandardMaterial color={COLORS.pit} roughness={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.5, 40]} />
        <meshStandardMaterial color={COLORS.pitWater} roughness={0.1} emissive="#0b5f8f" emissiveIntensity={0.3} />
      </mesh>
      <mesh ref={ripple} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]}>
        <ringGeometry args={[0.42, 0.47, 40]} />
        <meshBasicMaterial color="#e0f6ff" transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

function OpenSpace() {
  return (
    <group position={[1.9, 0.015, -2.1]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.5, 1.6]} />
        <meshStandardMaterial color={COLORS.openSpace} roughness={1} />
      </mesh>
      {(
        [
          [[0, 0.01, 0.8], [2.5, 0.03, 0.05]],
          [[0, 0.01, -0.8], [2.5, 0.03, 0.05]],
          [[1.25, 0.01, 0], [0.05, 0.03, 1.6]],
          [[-1.25, 0.01, 0], [0.05, 0.03, 1.6]],
        ] as [Vec3, Vec3][]
      ).map(([position, size], i) => (
        <mesh key={i} position={position}>
          <boxGeometry args={size} />
          <meshStandardMaterial color="#f4fbe8" />
        </mesh>
      ))}
    </group>
  );
}

function Tree({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.2, 1.4, 10]} />
        <meshStandardMaterial color={COLORS.trunk} />
      </mesh>
      {(
        [
          [[0, 1.9, 0], 0.95, COLORS.leaf],
          [[0.55, 1.6, 0.25], 0.65, COLORS.leafLight],
          [[-0.5, 1.65, -0.15], 0.65, COLORS.leafLight],
          [[0.1, 2.55, -0.1], 0.6, COLORS.leafLight],
        ] as [Vec3, number, string][]
      ).map(([p, r, color], i) => (
        <mesh key={i} position={p} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={color} flatShading roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Bush({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {(
        [
          [[0, 0.22, 0], 0.32],
          [[0.3, 0.17, 0.1], 0.24],
          [[-0.28, 0.16, 0.05], 0.22],
        ] as [Vec3, number][]
      ).map(([p, r], i) => (
        <mesh key={i} position={p} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={i ? COLORS.leafLight : COLORS.leaf} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Cloud() {
  const puffs: [Vec3, number][] = [
    [[0, 0, 0], 1.25],
    [[1.35, -0.25, 0.3], 1.0],
    [[-1.4, -0.3, 0.2], 0.95],
    [[0.5, 0.55, -0.35], 1.0],
    [[2.45, -0.45, 0], 0.7],
    [[-2.45, -0.45, -0.2], 0.65],
  ];
  return (
    <group position={[-0.6, 6.6, -0.8]}>
      {puffs.map(([p, r], i) => (
        <mesh key={i} position={p}>
          <icosahedronGeometry args={[r, 2]} />
          <meshStandardMaterial color={COLORS.cloud} roughness={1} emissive="#dfefff" emissiveIntensity={0.35} />
        </mesh>
      ))}
    </group>
  );
}

const RAIN_COUNT = 220;

function Rain({ animate }: { animate: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);

  const drops = useMemo(
    () =>
      Array.from({ length: RAIN_COUNT }, () => {
        const x = -4.0 + Math.random() * 7.2;
        const z = -2.9 + Math.random() * 4.4;
        // Drops stop on the roof where it is, otherwise on the grass.
        const onRoof = x > -4.7 && x < 0.1 && z > -3.0 && z < 1.0;
        return { x, z, floor: onRoof ? 2.7 : 0.05, offset: Math.random(), speed: 7 + Math.random() * 3 };
      }),
    [],
  );
  const matrix = useMemo(() => new THREE.Matrix4(), []);

  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const top = 5.9;
    for (let i = 0; i < RAIN_COUNT; i++) {
      const d = drops[i];
      const range = top - d.floor;
      const travel = ((clock.elapsedTime * d.speed) / range + d.offset) % 1;
      matrix.makeTranslation(d.x, top - travel * range, d.z);
      m.setMatrixAt(i, matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  if (!animate) return null;

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, RAIN_COUNT]}>
      <boxGeometry args={[0.025, 0.32, 0.025]} />
      <meshBasicMaterial color={COLORS.rain} transparent opacity={0.75} depthWrite={false} />
    </instancedMesh>
  );
}

function Label({ position, title, detail, tone }: { position: Vec3; title: string; detail?: string; tone: string }) {
  return (
    <Html position={position} center zIndexRange={[8, 1]} style={{ pointerEvents: "none" }}>
      <div className="hero-label">
        <span className="hero-label__dot" style={{ background: tone }} />
        <span className="hero-label__title">{title}</span>
        {detail && <span className="hero-label__detail">{detail}</span>}
      </div>
    </Html>
  );
}

/* ------------------------------------------------------------------ */

const PIPES: Vec3[][] = [
  // Roof outlet -> downpipe -> filter
  [
    [0.02, 2.55, 0.85],
    [0.3, 2.55, 0.85],
    [0.3, 0.2, 0.85],
    [0.3, 0.2, 1.9],
    [0.8, 0.2, 1.9],
  ],
  // Filter -> storage tank
  [
    [1.6, 0.28, 1.9],
    [2.3, 0.28, 1.9],
    [2.3, 0.28, 1.5],
  ],
  // Tank overflow -> recharge pit
  [
    [3.45, 0.16, 1.6],
    [3.6, 0.16, 2.45],
  ],
];

export function RainwaterIsland({ animate, showLabels }: { animate: boolean; showLabels: boolean }) {
  const lightTarget = useMemo(() => new THREE.Object3D(), []);

  return (
    <group>
      <primitive object={lightTarget} position={[0, 0, 0]} />
      <directionalLight
        position={[5, 11, 7]}
        intensity={2.3}
        color="#fff6e8"
        target={lightTarget}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={30}
      />

      <Ground />
      <House />
      <FilterUnit />
      <StorageTank animate={animate} />
      <RechargePit animate={animate} />
      <OpenSpace />
      <Tree position={[4.05, 0, -2.85]} />
      <Tree position={[-4.3, 0, 2.75]} scale={0.62} />
      <Bush position={[-0.7, 0, 3.2]} />
      <Bush position={[1.0, 0, -3.45]} scale={0.85} />
      <Bush position={[4.35, 0, 0.6]} scale={0.9} />
      <Bush position={[-4.45, 0, -3.35]} scale={0.8} />
      <Bush position={[0.6, 0, 3.4]} scale={0.7} />
      {PIPES.map((points, i) => (
        <Pipe key={i} points={points} animate={animate} />
      ))}
      <Cloud />
      <Rain animate={animate} />

      {showLabels && (
        <>
          <Label position={[-2.6, 3.35, -1]} title="Rooftop catchment" tone="#ee8a5f" />
          <Label position={[1.2, 1.15, 1.9]} title="Filter unit" tone="#7d8f99" />
          <Label position={[2.9, 2.75, 0.9]} title="Storage tank" detail="15,000 L / yr" tone="#2ba3dc" />
          <Label position={[3.6, 0.7, 3.0]} title="Recharge pit" tone="#2f86b5" />
          <Label position={[1.9, 0.55, -2.1]} title="Open space" tone="#8cc152" />
        </>
      )}
    </group>
  );
}
