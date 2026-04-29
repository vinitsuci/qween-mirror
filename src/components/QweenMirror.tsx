import { Fragment, useEffect, useRef, useState } from "react";
import { ArSdk, isWebGLSupported } from "tencentcloud-webar";
import { getSignature } from "../utils/auth";
import "./QweenMirror.css";

interface BeautySettings {
  whiten: number;
  dermabrasion: number;
  lift: number;
  shave: number;
  eye: number;
  chin: number;
  darkCircle: number;
  nasolabialFolds: number;
  cheekbone: number;
  head: number;
  eyeBrightness: number;
  lip: number;
  forehead: number;
  nose: number;
  usm: number;
}

// "Zoom Touch Up" preset: gentle, no face reshaping. Mirrors what Zoom /
// Google Meet apply by default — subtle smoothing + mild brightness lift,
// nothing that crosses into "filtered" territory.
const DEFAULT_BEAUTY: BeautySettings = {
  whiten: 25, // mild brightness lift on skin
  dermabrasion: 40, // gentle smoothing, under the "I notice it" threshold
  darkCircle: 20, // most universally appreciated correction
  eyeBrightness: 10, // tiny lift, not anime
  usm: 10, // 10% sharpness to counteract dermabrasion blur
  nasolabialFolds: 15, // softens harsh-light lines, not age erasure
  // No face reshaping
  lift: 0,
  shave: 0,
  eye: 0,
  chin: 0,
  cheekbone: 0,
  head: 0,
  lip: 0,
  forehead: 0,
  nose: 0,
};

const toSdkBeauty = (s: BeautySettings) =>
  Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v / 100]));

type BeautySubTab = "skin" | "shape" | "features";

const BEAUTY_GROUPS: Record<
  BeautySubTab,
  { key: keyof BeautySettings; label: string }[]
> = {
  skin: [
    { key: "whiten", label: "Whiten" },
    { key: "dermabrasion", label: "Smooth" },
    { key: "nasolabialFolds", label: "Nasolabial Folds" },
    { key: "usm", label: "Sharpness" },
  ],
  shape: [
    { key: "cheekbone", label: "Cheekbone" },
    { key: "lift", label: "Slim face" },
    { key: "shave", label: "V shape" },
    { key: "forehead", label: "Forehead" },
    { key: "head", label: "Small Head" },
  ],
  features: [
    { key: "lip", label: "Lip" },
    { key: "nose", label: "Nose" },
    { key: "eye", label: "Big eyes" },
    { key: "eyeBrightness", label: "Eye Brightness" },
    { key: "darkCircle", label: "Dark Circle" },
    { key: "chin", label: "Chin" },
  ],
};

interface Effect {
  id: string;
  name: string;
  coverUrl?: string;
}

interface Filter {
  id: string;
  name: string;
  previewImage?: string;
}

type BackgroundChoice =
  | { kind: "none" }
  | { kind: "blur" }
  | { kind: "image"; src: string };

interface BackgroundOption {
  id: string;
  label: string;
  thumbnail?: string;
  choice: BackgroundChoice;
}

// Unsplash URLs — CORS-enabled, scene-specific, served as JPEG. The `?w=`
// query controls delivered width: full-size for the SDK, small for thumbs.
const unsplash = (id: string, w: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const sceneBg = (
  id: string,
  label: string,
  photoId: string,
): BackgroundOption => ({
  id,
  label,
  thumbnail: unsplash(photoId, 200),
  choice: { kind: "image", src: unsplash(photoId, 1920) },
});

const BACKGROUND_PRESETS: BackgroundOption[] = [
  { id: "none", label: "None", choice: { kind: "none" } },
  { id: "blur", label: "Blur", choice: { kind: "blur" } },
  sceneBg("beach", "Beach", "photo-1507525428034-b723cf961d3e"),
  sceneBg("beach2", "Beach 2", "photo-1519046904884-53103b34b206"),
  sceneBg("mountain", "Mountain", "photo-1464822759023-fed622ff2c3b"),
  sceneBg("mountain2", "Mountain 2", "photo-1506905925346-21bda4d32df4"),
  sceneBg("cafe", "Cafe", "photo-1554118811-1e0d58224f24"),
  sceneBg("cafe2", "Cafe 2", "photo-1445116572660-236099ec97a0"),
  sceneBg("party", "Party", "photo-1492684223066-81342ee5ff30"),
  sceneBg("party2", "Party 2", "photo-1530103862676-de8c9debad1d"),
];

const QweenMirror = () => {
  const rawVideoRef = useRef<HTMLVideoElement>(null);
  const arVideoRef = useRef<HTMLVideoElement>(null);
  const arRef = useRef<ArSdk | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const initRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [arReady, setArReady] = useState(false);
  const [cameraInfo, setCameraInfo] = useState<{
    width: number;
    height: number;
    frameRate: number;
    label: string;
  } | null>(null);
  const [liveFps, setLiveFps] = useState(0);
  const [error, setError] = useState<string>("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "beauty" | "makeup" | "filters" | "background"
  >("beauty");

  const [selectedBackground, setSelectedBackground] = useState<string>("none");

  const [beautySettings, setBeautySettings] =
    useState<BeautySettings>(DEFAULT_BEAUTY);
  const beautyRef = useRef<BeautySettings>(DEFAULT_BEAUTY);

  // Makeup effects
  const [makeupEffects, setMakeupEffects] = useState<Effect[]>([]);
  const [selectedMakeup, setSelectedMakeup] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<Filter[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  useEffect(() => {
    const APPID = import.meta.env.VITE_TENCENT_APP_ID;
    const LICENSE_KEY = import.meta.env.VITE_TENCENT_LICENSE_KEY;
    const TOKEN = import.meta.env.VITE_TENCENT_SECRET_KEY;

    if (!APPID || !LICENSE_KEY || !TOKEN) {
      setError("Please configure your Tencent AR credentials in .env file");
      setIsLoading(false);
      return;
    }

    if (!isWebGLSupported()) {
      setError(
        "This browser doesn't support hardware-accelerated WebGL. Try Chrome, Safari, or Firefox.",
      );
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const start = async () => {
      // Guard against React Strict Mode double-mount
      if (initRef.current) return;
      initRef.current = true;

      try {
        // Open the front camera at its native max resolution. We own this
        // stream — the raw <video> renders it directly (full quality), and
        // we hand the same MediaStream to ArSdk via Custom Stream mode so
        // the SDK can run effects on top without us losing the raw feed.
        //
        // Request 1080p directly via `ideal` — browsers honour this when the
        // sensor supports it and silently fall back when it doesn't. This is
        // more reliable than opening at the default and trying to bump via
        // applyConstraints (getCapabilities() returns {} on some Android
        // browsers, which would skip the bump entirely).
        // Target 1080p @ 30fps. Asking the camera for its sensor max often
        // pushes it into full-resolution still mode (e.g., 3264×2448), which
        // typically caps at ~20fps — a worse trade-off for a real-time
        // beauty mirror than smooth motion at 1080p.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
        const track = stream.getVideoTracks()[0];

        const finalSettings = track.getSettings();
        if (import.meta.env.DEV) {
          console.info(
            `[QweenMirror] camera opened at ${finalSettings.width}×${finalSettings.height} @ ${Math.round(
              finalSettings.frameRate || 0,
            )}fps (label: ${track.label})`,
          );
        }
        setCameraInfo({
          width: finalSettings.width || 0,
          height: finalSettings.height || 0,
          frameRate: Math.round(finalSettings.frameRate || 0),
          label: track.label || "(no label)",
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        rawStreamRef.current = stream;
        if (rawVideoRef.current) {
          rawVideoRef.current.srcObject = stream;
          await rawVideoRef.current.play().catch(() => {});
        }
        setIsLoading(false);

        // Spin up ArSdk in Custom Stream mode using the same MediaStream.
        // The SDK processes effects on top of OUR stream — we can choose
        // to display either the raw <video> or the SDK output <video>.
        const ar = new ArSdk({
          auth: {
            authFunc: () => getSignature(APPID, TOKEN),
            appId: APPID,
            licenseKey: LICENSE_KEY,
          },
          input: stream,
          module: {
            beautify: true,
            segmentation: true,
            segmentationLevel: 1, // 0 = fastest, 2 = best edges; 1 is balanced
          },
          beautify: toSdkBeauty(beautyRef.current),
          language: "en",
        });
        arRef.current = ar;

        ar.on("created", async () => {
          try {
            // Per the API doc, Label is a server-side filter — pass it
            // through instead of filtering after the fact.
            const presetEffects = await ar.getEffectList({
              Type: "Preset",
              Label: "Makeup",
            } as any);
            setMakeupEffects(
              (presetEffects || []).map((e: any) => ({
                id: e.EffectId,
                name: e.Name,
                coverUrl: e.CoverUrl,
              })),
            );
          } catch (err) {
            console.error("Failed to load effects:", err);
          }
          try {
            const filterList = await ar.getCommonFilter();
            setFilters(
              (filterList || []).map((f: any) => ({
                id: f.EffectId,
                name: f.Name,
                previewImage: f.CoverUrl,
              })),
            );
          } catch (err) {
            console.error("Failed to load filters:", err);
          }
        });

        ar.on("ready", async () => {
          try {
            const arStream = await ar.getOutput();
            if (arVideoRef.current) {
              arVideoRef.current.srcObject = arStream;
              await arVideoRef.current.play().catch(() => {});
            }
            setArReady(true);
          } catch (e) {
            console.error("Error attaching AR output:", e);
          }
        });

        ar.on("error", (e: any) => {
          setError(`AR SDK Error: ${e.message || "Unknown error"}`);
        });

        // The doc exposes a `warning` event for performance hints
        // (e.g. code 50005 = "Detection took too long"). Surface it to
        // the console in dev so we can spot device-specific slowdowns.
        if (import.meta.env.DEV) {
          ar.on("warning", (w: any) => {
            console.warn(`AR SDK warning [${w?.code}]: ${w?.message}`);
          });
        }
      } catch (err) {
        if (err instanceof Error && err.name === "NotAllowedError") {
          setError("Camera access denied. Please allow camera permissions.");
        } else if (err instanceof Error && err.name === "NotFoundError") {
          setError("No camera found on this device.");
        } else if (err instanceof Error && err.name === "NotReadableError") {
          setError("Camera is already in use by another application.");
        } else {
          setError(
            `Initialization failed: ${
              err instanceof Error ? err.message : "Unknown error"
            }`,
          );
        }
        setIsLoading(false);
      }
    };

    start();

    // Live FPS counter using requestVideoFrameCallback. Measures the
    // actual frame delivery rate from the camera (raw video element),
    // which is what matters for diagnosing dropped frames or throttling.
    let rvfcId: number | null = null;
    let rvfcStartTs: number | null = null;
    let rvfcFrames = 0;
    const rvfcSupported =
      typeof HTMLVideoElement !== "undefined" &&
      "requestVideoFrameCallback" in HTMLVideoElement.prototype;
    const scheduleRvfc = () => {
      if (cancelled || !rvfcSupported || !rawVideoRef.current) return;
      rvfcId = (rawVideoRef.current as any).requestVideoFrameCallback(tickFps);
    };
    const tickFps = (
      _now: DOMHighResTimeStamp,
      meta: VideoFrameCallbackMetadata,
    ) => {
      if (rvfcStartTs === null) rvfcStartTs = meta.mediaTime;
      rvfcFrames += 1;
      const elapsed = meta.mediaTime - rvfcStartTs;
      if (elapsed >= 1) {
        setLiveFps(Math.round(rvfcFrames / elapsed));
        rvfcStartTs = meta.mediaTime;
        rvfcFrames = 0;
      }
      scheduleRvfc();
    };
    // Wait a tick so the video element is mounted
    const fpsTimer = window.setTimeout(scheduleRvfc, 500);

    return () => {
      cancelled = true;
      // Reset so React Strict Mode's remount can re-open the camera. The
      // `cancelled` flag still prevents the previous mount's in-flight
      // async work from racing into UI state.
      initRef.current = false;
      window.clearTimeout(fpsTimer);
      if (
        rvfcId !== null &&
        rawVideoRef.current &&
        "cancelVideoFrameCallback" in rawVideoRef.current
      ) {
        (rawVideoRef.current as any).cancelVideoFrameCallback(rvfcId);
      }
      const ar = arRef.current as ArSdk & { destroy?: () => void };
      arRef.current = null;
      try {
        ar?.destroy?.();
      } catch {}
      rawStreamRef.current?.getTracks().forEach((t) => t.stop());
      rawStreamRef.current = null;
    };
  }, []);

  const handleToggle = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);

    if (arRef.current) {
      // When disabled, push all-zeros so beauty visibly turns off without
      // mutating the slider state the user has dialled in.
      arRef.current.setBeautify(
        toSdkBeauty(newState ? beautySettings : DEFAULT_BEAUTY),
      );
    }
  };

  const updateBeauty = (key: keyof BeautySettings, value: number) => {
    setBeautySettings((prev) => {
      const next = { ...prev, [key]: value };
      beautyRef.current = next;
      if (arRef.current && isEnabled) {
        arRef.current.setBeautify(toSdkBeauty(next));
      }
      return next;
    });
  };

  const handleMakeupSelect = (effectId: string | null) => {
    setSelectedMakeup(effectId);
    if (arRef.current) {
      if (effectId) {
        arRef.current.setEffect([
          { id: effectId, intensity: 0.9, filterIntensity: 0 },
        ]);
      } else {
        arRef.current.setEffect(null);
      }
    }
  };

  const handleFilterSelect = (filterId: string | null) => {
    setSelectedFilter(filterId);
    if (arRef.current) {
      if (filterId) {
        arRef.current.setFilter(filterId, 0.9);
      } else {
        arRef.current.setFilter(null);
      }
    }
  };

  const handleBackgroundSelect = (option: BackgroundOption) => {
    setSelectedBackground(option.id);
    if (!arRef.current) return;
    switch (option.choice.kind) {
      case "none":
        arRef.current.setBackground(null);
        break;
      case "blur":
        arRef.current.setBackground({ type: "blur" });
        break;
      case "image":
        arRef.current.setBackground({
          type: "image",
          src: option.choice.src,
        });
        break;
    }
  };

  const handleReset = () => {
    setSelectedMakeup(null);
    setSelectedFilter(null);
    setSelectedBackground("none");
    setBeautySettings(DEFAULT_BEAUTY);
    beautyRef.current = DEFAULT_BEAUTY;
    if (arRef.current) {
      arRef.current.setEffect(null);
      arRef.current.setFilter(null);
      arRef.current.setBackground(null);
      arRef.current.setBeautify(toSdkBeauty(DEFAULT_BEAUTY));
    }
    setIsEnabled(true);
  };

  // Any non-zero beauty slider counts as an active beauty effect
  const hasBeautyEffect =
    isEnabled && Object.values(beautySettings).some((v) => v > 0);
  // Show ArSdk's processed output only when there's something for it to do
  // AND it's ready. Otherwise show the raw stream at native quality.
  const hasBackground = selectedBackground !== "none";
  const showAr =
    arReady &&
    (hasBeautyEffect || !!selectedMakeup || !!selectedFilter || hasBackground);

  return (
    <div className="qween-mirror">
      {isLoading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Opening camera…</p>
        </div>
      )}

      {error && (
        <div className="error">
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      )}

      {!isLoading && !error && (
        <div className="debug-badge">
          {cameraInfo
            ? `${cameraInfo.width}×${cameraInfo.height} @ ${liveFps || cameraInfo.frameRate}fps`
            : "opening camera…"}
          <span className="debug-badge-mode">
            {showAr ? "AR" : "RAW"}
            {arReady ? "" : " (sdk loading…)"}
          </span>
        </div>
      )}

      <video
        ref={rawVideoRef}
        className="mirror-video raw-video"
        playsInline
        muted
        autoPlay
        crossOrigin="anonymous"
        style={{
          display: isLoading || error ? "none" : "block",
          visibility: showAr ? "hidden" : "visible",
        }}
      />
      <video
        ref={arVideoRef}
        className="mirror-video ar-video"
        playsInline
        muted
        autoPlay
        crossOrigin="anonymous"
        style={{
          display: isLoading || error ? "none" : "block",
          visibility: showAr ? "visible" : "hidden",
        }}
      />

      {!isLoading && !error && (
        <>
          {isPanelVisible && (
            <div className="controls-panel">
              <div className="panel-header">
                <div className="header-controls">
                  <div className="toggle-group">
                    <span className="toggle-label">Beauty</span>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={handleToggle}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                  <button className="reset-btn" onClick={handleReset}>
                    ↻ Reset
                  </button>
                </div>
              </div>

              <div className="tabs">
                <button
                  className={`tab-btn ${
                    activeTab === "beauty" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("beauty")}
                >
                  Beauty
                </button>
                <button
                  className={`tab-btn ${
                    activeTab === "makeup" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("makeup")}
                >
                  Makeup
                </button>
                <button
                  className={`tab-btn ${
                    activeTab === "filters" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("filters")}
                >
                  Filters
                </button>
                <button
                  className={`tab-btn ${
                    activeTab === "background" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("background")}
                >
                  Background
                </button>
              </div>

              {activeTab === "beauty" && (
                <div className="sliders-container">
                  {(["skin", "shape", "features"] as const).map((section) => (
                    <Fragment key={section}>
                      <div className="section-header">
                        {section.charAt(0).toUpperCase() + section.slice(1)}
                      </div>
                      {BEAUTY_GROUPS[section].map(({ key, label }) => (
                        <div className="slider-group" key={key}>
                          <label>{label}</label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={beautySettings[key]}
                            onChange={(e) =>
                              updateBeauty(key, Number(e.target.value))
                            }
                          />
                          <span className="value">{beautySettings[key]}</span>
                        </div>
                      ))}
                    </Fragment>
                  ))}
                </div>
              )}

              <div
                className="effects-container"
                style={{
                  display: activeTab === "beauty" ? "none" : undefined,
                }}
              >
                {activeTab === "makeup" && (
                  <div className="effects-grid">
                    <button
                      className={`effect-item ${
                        selectedMakeup === null ? "selected" : ""
                      }`}
                      onClick={() => handleMakeupSelect(null)}
                    >
                      <div className="effect-icon none">✕</div>
                      <span className="effect-name">None</span>
                    </button>
                    {makeupEffects.map((effect) => (
                      <button
                        key={effect.id}
                        className={`effect-item ${
                          selectedMakeup === effect.id ? "selected" : ""
                        }`}
                        onClick={() => handleMakeupSelect(effect.id)}
                      >
                        {effect.coverUrl ? (
                          <img
                            src={effect.coverUrl}
                            alt={effect.name}
                            className="effect-icon"
                          />
                        ) : (
                          <div className="effect-icon placeholder">💄</div>
                        )}
                        <span className="effect-name">{effect.name}</span>
                      </button>
                    ))}
                    {makeupEffects.length === 0 && (
                      <p className="no-effects">No makeup effects available</p>
                    )}
                  </div>
                )}

                {activeTab === "filters" && (
                  <div className="effects-grid">
                    <button
                      className={`effect-item ${
                        selectedFilter === null ? "selected" : ""
                      }`}
                      onClick={() => handleFilterSelect(null)}
                    >
                      <div className="effect-icon none">✕</div>
                      <span className="effect-name">None</span>
                    </button>
                    {filters.map((filter) => (
                      <button
                        key={filter.id}
                        className={`effect-item ${
                          selectedFilter === filter.id ? "selected" : ""
                        }`}
                        onClick={() => handleFilterSelect(filter.id)}
                      >
                        {filter.previewImage ? (
                          <img
                            src={filter.previewImage}
                            alt={filter.name}
                            className="effect-icon"
                          />
                        ) : (
                          <div className="effect-icon placeholder">🎨</div>
                        )}
                        <span className="effect-name">{filter.name}</span>
                      </button>
                    ))}
                    {filters.length === 0 && (
                      <p className="no-effects">No filters available</p>
                    )}
                  </div>
                )}

                {activeTab === "background" && (
                  <div className="effects-grid">
                    {BACKGROUND_PRESETS.map((option) => (
                      <button
                        key={option.id}
                        className={`effect-item ${
                          selectedBackground === option.id ? "selected" : ""
                        }`}
                        onClick={() => handleBackgroundSelect(option)}
                      >
                        {option.choice.kind === "none" ? (
                          <div className="effect-icon none">✕</div>
                        ) : option.choice.kind === "blur" ? (
                          <div className="effect-icon placeholder">🌫️</div>
                        ) : option.thumbnail ? (
                          <img
                            src={option.thumbnail}
                            alt={option.label}
                            className="effect-icon"
                          />
                        ) : (
                          <div className="effect-icon placeholder">🖼️</div>
                        )}
                        <span className="effect-name">{option.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            className="panel-toggle-btn"
            onClick={() => setIsPanelVisible(!isPanelVisible)}
            title={isPanelVisible ? "Hide controls" : "Show controls"}
          >
            {isPanelVisible ? "✕" : "⚙"}
          </button>
        </>
      )}
    </div>
  );
};

export default QweenMirror;
