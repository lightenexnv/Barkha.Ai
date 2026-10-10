import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { RainwaterIsland, type ReplayRef } from "@/components/hero/RainwaterIsland";

/** The hero's rainwater island, driven by the replay state and slowly orbiting. */
export default function RainReplayScene({ replay, tankDetail, playing }: { replay: ReplayRef; tankDetail: string; playing: boolean }) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 32, position: [10, 8, 15], near: 0.5, far: 100 }} aria-hidden="true">
      <color attach="background" args={["#eaf6fd"]} />
      <hemisphereLight args={["#e6f4ff", "#5f8a45", 1.1]} />
      <ambientLight intensity={0.35} />
      <group position={[0.2, -1.6, 0]} rotation={[0, -0.35, 0]}>
        <RainwaterIsland animate showLabels replay={replay} tankDetail={tankDetail} />
      </group>
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate={playing}
        autoRotateSpeed={0.45}
        minPolarAngle={0.6}
        maxPolarAngle={1.35}
        target={[0, 1.2, 0]}
      />
    </Canvas>
  );
}
