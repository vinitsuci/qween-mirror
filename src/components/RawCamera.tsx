import { useEffect, useRef, useState } from "react";

interface CameraInfo {
  label: string;
  width: number;
  height: number;
  frameRate?: number;
  deviceId?: string;
  maxWidth?: number;
  maxHeight?: number;
  maxFrameRate?: number;
}

const RawCamera = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<CameraInfo | null>(null);
  const [objectFit, setObjectFit] = useState<"contain" | "cover" | "fill">(
    "contain",
  );

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    const start = async () => {
      try {
        // Open the front camera, then bump it to its max supported resolution
        // by reading getCapabilities() and applying those constraints.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const track = stream.getVideoTracks()[0];

        let maxWidth: number | undefined;
        let maxHeight: number | undefined;
        let maxFrameRate: number | undefined;
        try {
          const caps = (track.getCapabilities?.() ||
            {}) as MediaTrackCapabilities & {
            width?: { max?: number };
            height?: { max?: number };
            frameRate?: { max?: number };
          };
          maxWidth = caps.width?.max;
          maxHeight = caps.height?.max;
          maxFrameRate = caps.frameRate?.max;
          if (maxWidth && maxHeight) {
            await track.applyConstraints({
              width: { ideal: maxWidth },
              height: { ideal: maxHeight },
              frameRate: maxFrameRate ? { ideal: maxFrameRate } : undefined,
            });
          }
        } catch (e) {
          // applyConstraints can fail on some browsers — fall back to whatever
          // resolution was first negotiated.
          console.warn("applyConstraints (max) failed", e);
        }

        const settings = track.getSettings();
        setInfo({
          label: track.label || "(no label)",
          width: settings.width || 0,
          height: settings.height || 0,
          frameRate: settings.frameRate,
          deviceId: settings.deviceId,
          maxWidth,
          maxHeight,
          maxFrameRate,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        if (e instanceof Error) {
          setError(`${e.name}: ${e.message}`);
        } else {
          setError("Unknown error opening camera");
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: "#000",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          width: "100%",
          height: "100%",
          objectFit,
          background: "#000",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          right: 12,
          padding: "10px 14px",
          background: "rgba(0,0,0,0.55)",
          color: "#fff",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
          fontSize: 12,
          borderRadius: 8,
          lineHeight: 1.5,
          pointerEvents: "none",
        }}
      >
        <div>
          <strong>Raw front camera</strong> — no AR, no filters, no mirror.
        </div>
        {error ? (
          <div style={{ color: "#ff8a8a" }}>Error: {error}</div>
        ) : info ? (
          <>
            <div>device: {info.label}</div>
            <div>
              now: {info.width} × {info.height}
              {info.frameRate ? ` @ ${Math.round(info.frameRate)}fps` : ""}
            </div>
            {info.maxWidth && info.maxHeight && (
              <div>
                max: {info.maxWidth} × {info.maxHeight}
                {info.maxFrameRate
                  ? ` @ ${Math.round(info.maxFrameRate)}fps`
                  : ""}
              </div>
            )}
          </>
        ) : (
          <div>opening camera…</div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 8,
          background: "rgba(0,0,0,0.55)",
          padding: 6,
          borderRadius: 999,
        }}
      >
        {(["contain", "cover", "fill"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setObjectFit(mode)}
            style={{
              padding: "6px 14px",
              border: "none",
              borderRadius: 999,
              background:
                objectFit === mode ? "#2196f3" : "rgba(255,255,255,0.15)",
              color: "#fff",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
};

export default RawCamera;
