"use client";

import React, { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, ContactShadows, useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = "/models/PV_portrait_02.glb";
const TARGET_HEIGHT = 1.7; // unidades de cena — mantém o painel confortável

type Normalized = { obj: THREE.Object3D; half: THREE.Vector3 };

function useNormalizedModel(): Normalized {
  const { scene } = useGLTF(MODEL_URL);
  return useMemo(() => {
    const obj = scene.clone(true);

    // 1) Orienta a face fina (espessura) para +Z, virada à câmara.
    let box = new THREE.Box3().setFromObject(obj);
    let size = box.getSize(new THREE.Vector3());
    const thin =
      size.x <= size.y && size.x <= size.z ? "x" : size.y <= size.z ? "y" : "z";
    if (thin === "y") obj.rotateX(-Math.PI / 2);
    else if (thin === "x") obj.rotateY(Math.PI / 2);
    obj.updateMatrixWorld(true);

    // 2) Escala para uma altura confortável.
    box = new THREE.Box3().setFromObject(obj);
    size = box.getSize(new THREE.Vector3());
    const scale = TARGET_HEIGHT / Math.max(size.x, size.y);
    obj.scale.setScalar(scale);
    obj.updateMatrixWorld(true);

    // 3) Centra na origem.
    box = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center);
    obj.updateMatrixWorld(true);

    box = new THREE.Box3().setFromObject(obj);
    const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    return { obj, half };
  }, [scene]);
}

function Annotation({
  position,
  label,
  value
}: {
  position: [number, number, number];
  label: string;
  value?: string;
}) {
  // Sem `occlude`: a etiqueta acompanha a face frontal e nunca "desaparece" quando
  // o painel roda. A câmara está limitada à frente, por isso as etiquetas ficam
  // sempre legíveis sobre o vidro.
  return (
    <Html position={position} center zIndexRange={[20, 0]}>
      <div className="pointer-events-none flex -translate-y-1/2 items-center gap-1.5">
        <span className="grid h-2 w-2 place-items-center rounded-full bg-supaste-blue ring-[3px] ring-supaste-blue/20" />
        <span className="h-px w-5 bg-supaste-blue/40" />
        <span className="whitespace-nowrap rounded-full border border-black/5 bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold text-supaste-ink shadow-soft-float backdrop-blur">
          {label}
          {value ? <b className="ml-1 text-supaste-blue">{value}</b> : null}
        </span>
      </div>
    </Html>
  );
}

function Model() {
  const { obj, half } = useNormalizedModel();
  const front = half.z + 0.06;

  return (
    <group>
      <primitive object={obj} />
      <Annotation position={[half.x * 0.12, half.y * 0.74, front]} label="Vidro temperado" />
      <Annotation position={[half.x * 0.5, half.y * 0.3, front]} label="Potência" value="445 Wp" />
      <Annotation position={[half.x * 0.5, -half.y * 0.16, front]} label="Células" value="N-TOPCon" />
      <Annotation position={[-half.x * 0.45, -half.y * 0.74, front]} label="Moldura de alumínio" />
      <Annotation position={[-half.x * 0.55, half.y * 0.35, front]} label="Eficiência" value="22,8%" />
    </group>
  );
}

export default function SolarPanel3D() {
  return (
    <Canvas camera={{ position: [1.1, 0.35, 3.7], fov: 30 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={["#e8ecf2"]} />
      <ambientLight intensity={0.7} />
      <hemisphereLight intensity={0.5} groundColor="#b9c0cc" />
      <directionalLight position={[3, 5, 4]} intensity={1.35} />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#bcd2ff" />
      <pointLight position={[0, 0, 4]} intensity={0.4} />
      <Suspense fallback={null}>
        <Model />
        <ContactShadows position={[0, -1.05, 0]} opacity={0.3} scale={5} blur={2.6} far={2} />
      </Suspense>
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.08}
        autoRotate
        autoRotateSpeed={1.1}
        minPolarAngle={Math.PI / 2.6}
        maxPolarAngle={Math.PI / 1.7}
      />
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
