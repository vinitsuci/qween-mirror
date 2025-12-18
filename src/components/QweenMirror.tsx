import { useEffect, useRef, useState } from "react";
import { ArSdk } from "tencentcloud-webar";
import { getSignature } from "../utils/auth";
import "./QweenMirror.css";

// Hardcoded beauty settings - optimized for jewelry retail
const BEAUTY_SETTINGS = {
  whiten: 0.18, // Neutral tone correction without fairness bias
  dermabrasion: 0.35, // Texture preserved; 50 is too plasticky in-store
  nasolabialFolds: 0.05, // Softens harsh lighting lines, not age erasure
  usm: 0.06, // Camera clarity only (sharpness)
  cheekbone: 0.03, // Subtle lift, no sculpting
  lift: 0.02, // Slim face - almost imperceptible
  shave: 0, // V Shape - avoid jaw distortion
  forehead: 0, // Avoid proportion changes
  head: 0, // Small head - never in jewellery retail
  lip: 0, // No lip reshaping
  nose: 0, // Critical for trust
  eye: 0, // Big eyes - avoid anime effect
  eyeBrightness: 0.06, // Reduces dullness from store lights
  darkCircle: 0.1, // Most universally appreciated correction
  chin: 0.02, // Micro balance only
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

const QweenMirror = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const arRef = useRef<ArSdk | null>(null);
  const initRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [activeTab, setActiveTab] = useState<"makeup" | "filters">("makeup");

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

    const initAR = async () => {
      // Prevent double initialization in React Strict Mode
      if (initRef.current) return;
      initRef.current = true;

      try {
        // Detect device type
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        // Default resolutions
        const cameraWidth = isMobile ? 720 : 1280;
        const cameraHeight = isMobile ? 1280 : 720;

        const initSDK = async (
          width: number,
          height: number,
          retryCount = 0
        ) => {
          try {
            const ar = new ArSdk({
              auth: {
                authFunc: () => getSignature(APPID, TOKEN),
                appId: APPID,
                licenseKey: LICENSE_KEY,
              },
              camera: {
                width: width,
                height: height,
                mirror: true,
              },
              loading: {
                enable: true,
                lineWidth: 4,
              },
              beautify: BEAUTY_SETTINGS,
              language: "en", // Set language to English for effect/filter names
            });

            arRef.current = ar;

            ar.on("created", async () => {
              // Load preset effects (makeup)
              try {
                const presetEffects = await ar.getEffectList({
                  Type: "Preset",
                });
                const makeupList = (presetEffects || []).filter(
                  (item: any) => item.Label && item.Label.indexOf("Makeup") >= 0
                );
                const normalizedEffects: Effect[] = makeupList.map(
                  (e: any) => ({
                    id: e.EffectId,
                    name: e.Name,
                    coverUrl: e.CoverUrl,
                  })
                );
                setMakeupEffects(normalizedEffects);
              } catch (err) {
                console.error("Failed to load effects:", err);
              }

              // Load filters
              try {
                const filterList = await ar.getCommonFilter();
                const normalizedFilters: Filter[] = (filterList || []).map(
                  (f: any) => ({
                    id: f.EffectId,
                    name: f.Name,
                    previewImage: f.CoverUrl,
                  })
                );
                setFilters(normalizedFilters);
              } catch (err) {
                console.error("Failed to load filters:", err);
              }
            });

            ar.on("ready", async () => {
              setIsLoading(false);
              try {
                const mediaStream = await ar.getOutput();
                if (videoRef.current) {
                  videoRef.current.srcObject = mediaStream;
                  await videoRef.current.play().catch(() => {});
                }
              } catch (e) {
                console.error("Error playing video stream:", e);
              }
            });

            ar.on("error", (e: any) => {
              // Handle resolution mismatch with retry
              if (e.code === 10001206 && retryCount < 2) {
                const match = e.message?.match(/width (\d+) or height (\d+)/);
                if (match) {
                  const newWidth = parseInt(match[1]);
                  const newHeight = parseInt(match[2]);
                  if ((ar as any).destroy) {
                    (ar as any).destroy();
                  }
                  setTimeout(
                    () => initSDK(newWidth, newHeight, retryCount + 1),
                    500
                  );
                  return;
                }
              }

              // Show error to user for critical issues only
              setError(`AR SDK Error: ${e.message || "Unknown error"}`);
              setIsLoading(false);
            });
          } catch (err) {
            setIsLoading(false);
          }
        };

        initSDK(cameraWidth, cameraHeight);
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
            }`
          );
        }
        setIsLoading(false);
      }
    };

    initAR();

    return () => {
      initRef.current = false;
      if (arRef.current) {
        arRef.current = null;
      }
    };
  }, []);

  const handleToggle = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);

    if (arRef.current) {
      if (newState) {
        arRef.current.setBeautify(BEAUTY_SETTINGS);
      } else {
        arRef.current.setBeautify({
          whiten: 0,
          dermabrasion: 0,
          lift: 0,
          shave: 0,
          eye: 0,
          chin: 0,
          darkCircle: 0,
          nasolabialFolds: 0,
          cheekbone: 0,
          head: 0,
          eyeBrightness: 0,
          lip: 0,
          forehead: 0,
          nose: 0,
          usm: 0,
        });
      }
    }
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

  const handleReset = () => {
    setSelectedMakeup(null);
    setSelectedFilter(null);
    if (arRef.current) {
      arRef.current.setEffect(null);
      arRef.current.setFilter(null);
      arRef.current.setBeautify(BEAUTY_SETTINGS);
    }
    setIsEnabled(true);
  };

  return (
    <div className="qween-mirror">
      {isLoading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Initializing AR...</p>
        </div>
      )}

      {error && (
        <div className="error">
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      )}

      <video
        ref={videoRef}
        className="mirror-video"
        playsInline
        crossOrigin="anonymous"
        style={{ display: isLoading || error ? "none" : "block" }}
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
              </div>

              <div className="effects-container">
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
