import React, { useEffect, useRef } from "react";
import { EmscriptenModule } from "../../types";
import { useAppContext } from "../../context/useAppContext";
import { HydraMultiplayer } from "../../utils/hydra-multiplayer";
import useKeys from "../../hooks/useKeys";

const DoomCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isEffectRan = useRef(false);
  const { gameData } = useAppContext();
  const keys = useKeys();

  console.log("gameData", gameData);

  useEffect(() => {
    // Prevent effect from running twice
    if (!keys.address) return;
    if (isEffectRan.current) return;
    isEffectRan.current = true;

    const canvas = canvasRef.current;

    if (!canvas) {
      console.error("Canvas element not found.");
      return;
    }

    const handleContextLost = (e: Event) => {
      alert("WebGL context lost. You will need to reload the page.");
      e.preventDefault();
    };

    canvas.addEventListener("webglcontextlost", handleContextLost, false);

    debugger;
    window.HydraMultiplayer = new HydraMultiplayer(
      keys,
      "http://localhost:4001",
    );

    // Setup configuration for doom-wasm
    const Module: EmscriptenModule = {
      noInitialRun: true,
      preRun: function () {
        const files = [
          "doom1.wad",
          "freedoom2.wad",
          "default.cfg",
          "Cardano.wad",
        ];
        files.forEach((file) => {
          Module.FS!.createPreloadedFile("/", file, file, true, true);
        });
      },
      printErr: console.error,
      postRun: () => {},
      canvas: canvas,
      print: (text: string) => {
        console.log("stdout:", text);
      },
      setStatus: (text: string) => {
        console.log("setStatus:", text);
      },
      onRuntimeInitialized: function () {
        const args = [
          "-iwad",
          "freedoom2.wad",
          "-file",
          "Cardano.wad",
          "-window",
          "-nogui",
          "-nomusic",
          "-config",
          "default.cfg",
        ];
        if (gameData.code) {
          args.push("-connect");
          args.push("1");
        } else {
          args.push("-server");
          args.push("-deathmatch");
        }
        if (gameData.petName) {
          args.push("-pet");
          args.push(gameData.petName);
        }
        window.callMain(args);
      },
    };

    // Attach Module to the window object to make it globally accessible
    window.Module = Module;

    // Dynamically load websockets-doom.js
    const script = document.createElement("script");
    script.src = "/websockets-doom.js";
    document.body.appendChild(script);

    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      document.body.removeChild(script);
    };
  }, [keys.address]);

  return <canvas id="canvas" ref={canvasRef} className="w-full h-full" />;
};

export default DoomCanvas;
