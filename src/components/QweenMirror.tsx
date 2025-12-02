import { useEffect, useRef, useState } from "react";
import { ArSdk } from "tencentcloud-webar";
import { getSignature } from "../utils/auth";
import "./QweenMirror.css";

interface BeautySettings {
  // Basic (always available)
  whiten: number; // brightening
  dermabrasion: number; // smooth skin
  lift: number; // slim face
  shave: number; // face width (V shape)
  eye: number; // big eyes
  chin: number; // chin
  // Advanced (v1.0.11+)
  darkCircle: number; // dark circle removal
  nasolabialFolds: number; // nasolabial folds
  cheekbone: number; // cheek bone
  head: number; // head size (small head)
  eyeBrightness: number; // eye brightness
  lip: number; // lip enhancement
  forehead: number; // forehead
  nose: number; // nose
  usm: number; // distinct/sharpness
}

const QweenMirror = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const arRef = useRef<ArSdk | null>(null);
  const initRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [isPanelVisible, setIsPanelVisible] = useState(true);

  const [beautySettings, setBeautySettings] = useState<BeautySettings>({
    whiten: 30,
    dermabrasion: 50,
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
        // Detect the best supported camera resolution
        let cameraWidth = 640;
        let cameraHeight = 480;

        try {
          // Try to get camera capabilities to determine best resolution
          // Request 1080p as ideal - camera will provide its best supported resolution
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
          });

          const videoTrack = stream.getVideoTracks()[0];
          const settings = videoTrack.getSettings();

          // Use the actual resolution the camera provides
          if (settings.width && settings.height) {
            cameraWidth = settings.width;
            cameraHeight = settings.height;
            console.log(
              `Camera supports: ${cameraWidth}x${cameraHeight}`
            );
          }

          // Stop the test stream
          stream.getTracks().forEach((track) => track.stop());
        } catch (testError) {
          console.warn(
            "Could not detect camera capabilities, using VGA (640x480)",
            testError
          );
          // Fallback to VGA if detection fails
          cameraWidth = 640;
          cameraHeight = 480;
        }

        const ar = new ArSdk({
          auth: {
            authFunc: () => getSignature(APPID, TOKEN),
            appId: APPID,
            licenseKey: LICENSE_KEY,
          },
          camera: {
            width: cameraWidth,
            height: cameraHeight,
            mirror: true,
          },
          loading: {
            enable: true,
            lineWidth: 4,
          },
          beautify: {
            whiten: beautySettings.whiten / 100,
            dermabrasion: beautySettings.dermabrasion / 100,
            lift: beautySettings.lift / 100,
            shave: beautySettings.shave / 100,
            eye: beautySettings.eye / 100,
            chin: beautySettings.chin / 100,
            darkCircle: beautySettings.darkCircle / 100,
            nasolabialFolds: beautySettings.nasolabialFolds / 100,
            cheekbone: beautySettings.cheekbone / 100,
            head: beautySettings.head / 100,
            eyeBrightness: beautySettings.eyeBrightness / 100,
            lip: beautySettings.lip / 100,
            forehead: beautySettings.forehead / 100,
            nose: beautySettings.nose / 100,
            usm: beautySettings.usm / 100,
          },
        });

        arRef.current = ar;

        ar.on("created", () => {
          console.log("AR SDK created");
        });

        ar.on("ready", async () => {
          console.log("AR SDK ready");
          setIsLoading(false);

          const mediaStream = await ar.getOutput();
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            videoRef.current.play();
          }
        });

        ar.on("error", (e: any) => {
          console.error("AR SDK error:", e);
          console.error("Error details:", {
            message: e.message,
            code: e.code,
            name: e.name,
            stack: e.stack,
          });
          setError(
            `AR SDK Error: ${e.message || "Unknown error"}. Browser: ${
              navigator.userAgent
            }`
          );
          setIsLoading(false);
        });
      } catch (err) {
        console.error("Failed to initialize AR SDK:", err);
        console.error("Browser info:", {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          vendor: navigator.vendor,
        });
        
        // Check if it's a permissions issue
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

  const updateBeauty = (key: keyof BeautySettings, value: number) => {
    setBeautySettings((prev) => {
      const newSettings = { ...prev, [key]: value };

      // Update AR SDK with new settings immediately
      if (arRef.current && isEnabled) {
        arRef.current.setBeautify({
          whiten: newSettings.whiten / 100,
          dermabrasion: newSettings.dermabrasion / 100,
          lift: newSettings.lift / 100,
          shave: newSettings.shave / 100,
          eye: newSettings.eye / 100,
          chin: newSettings.chin / 100,
          darkCircle: newSettings.darkCircle / 100,
          nasolabialFolds: newSettings.nasolabialFolds / 100,
          cheekbone: newSettings.cheekbone / 100,
          head: newSettings.head / 100,
          eyeBrightness: newSettings.eyeBrightness / 100,
          lip: newSettings.lip / 100,
          forehead: newSettings.forehead / 100,
          nose: newSettings.nose / 100,
          usm: newSettings.usm / 100,
        });
      }

      return newSettings;
    });
  };

  const handleToggle = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);

    if (arRef.current) {
      if (newState) {
        arRef.current.setBeautify({
          whiten: beautySettings.whiten / 100,
          dermabrasion: beautySettings.dermabrasion / 100,
          lift: beautySettings.lift / 100,
          shave: beautySettings.shave / 100,
          eye: beautySettings.eye / 100,
          chin: beautySettings.chin / 100,
          darkCircle: beautySettings.darkCircle / 100,
          nasolabialFolds: beautySettings.nasolabialFolds / 100,
          cheekbone: beautySettings.cheekbone / 100,
          head: beautySettings.head / 100,
          eyeBrightness: beautySettings.eyeBrightness / 100,
          lip: beautySettings.lip / 100,
          forehead: beautySettings.forehead / 100,
          nose: beautySettings.nose / 100,
          usm: beautySettings.usm / 100,
        });
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

  const handleReset = () => {
    const resetSettings: BeautySettings = {
      whiten: 30,
      dermabrasion: 50,
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
    };
    setBeautySettings(resetSettings);

    if (arRef.current && isEnabled) {
      arRef.current.setBeautify({
        whiten: 0.3,
        dermabrasion: 0.5,
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
                    <span className="toggle-label">On-Off</span>
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
                <div className="section-title">Skin</div>
                <div className="section-title">Shape</div>
                <div className="section-title">Features</div>
              </div>

              <div className="sliders-container">
                {/* Skin Section */}
                <div className="section-header">Skin</div>
                <div className="slider-group">
                  <label>Whiten</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={beautySettings.whiten}
                    onChange={(e) =>
                      updateBeauty("whiten", Number(e.target.value))
                    }
                  />
                  <span className="value">{beautySettings.whiten}</span>
                </div>
                <div className="slider-group">
                  <label>Smooth</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={beautySettings.dermabrasion}
                    onChange={(e) =>
                      updateBeauty("dermabrasion", Number(e.target.value))
                    }
                  />
                  <span className="value">{beautySettings.dermabrasion}</span>
                </div>
                <div className="slider-group">
                  <label>Nasolabial Folds</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={beautySettings.nasolabialFolds}
                    onChange={(e) =>
                      updateBeauty("nasolabialFolds", Number(e.target.value))
                    }
                  />
                  <span className="value">
                    {beautySettings.nasolabialFolds}
                  </span>
                </div>
                <div className="slider-group">
                  <label>Sharpness</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={beautySettings.usm}
                    onChange={(e) =>
                      updateBeauty("usm", Number(e.target.value))
                    }
                  />
                  <span className="value">{beautySettings.usm}</span>
                </div>

                {/* Shape Section */}
                <div className="section-header">Shape</div>
                <div className="slider-group">
                  <label>Cheekbone</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={beautySettings.cheekbone}
                    onChange={(e) =>
                      updateBeauty("cheekbone", Number(e.target.value))
                    }
                  />
                  <span className="value">{beautySettings.cheekbone}</span>
                </div>
                <div className="slider-group">
                  <label>Slim face</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={beautySettings.lift}
                    onChange={(e) =>
                      updateBeauty("lift", Number(e.target.value))
                    }
                  />
                  <span className="value">{beautySettings.lift}</span>
                </div>
                <div className="slider-group">
                  <label>V shape</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={beautySettings.shave}
                    onChange={(e) =>
                      updateBeauty("shave", Number(e.target.value))
                    }
                  />
                  <span className="value">{beautySettings.shave}</span>
                </div>
                <div className="slider-group">
                  <label>Forehead</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={beautySettings.forehead}
                    onChange={(e) =>
                      updateBeauty("forehead", Number(e.target.value))
                    }
                  />
                  <span className="value">{beautySettings.forehead}</span>
                </div>
                <div className="slider-group">
                  <label>Small Head</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={beautySettings.head}
                    onChange={(e) =>
                      updateBeauty("head", Number(e.target.value))
                    }
                  />
                  <span className="value">{beautySettings.head}</span>
                </div>

                {/* Features Section */}
                <div className="section-header">Features</div>
                <div className="slider-group">
                  <label>Lip</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={beautySettings.lip}
                    onChange={(e) =>
                      updateBeauty("lip", Number(e.target.value))
                    }
                  />
                  <span className="value">{beautySettings.lip}</span>
                </div>
                <div className="slider-group">
                  <label>Nose</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={beautySettings.nose}
                    onChange={(e) =>
                      updateBeauty("nose", Number(e.target.value))
                    }
                  />
                  <span className="value">{beautySettings.nose}</span>
                </div>
                <div className="slider-group">
                  <label>Big eyes</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={beautySettings.eye}
                    onChange={(e) =>
                      updateBeauty("eye", Number(e.target.value))
                    }
                  />
                  <span className="value">{beautySettings.eye}</span>
                </div>
                <div className="slider-group">
                  <label>Eye Brightness</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={beautySettings.eyeBrightness}
                    onChange={(e) =>
                      updateBeauty("eyeBrightness", Number(e.target.value))
                    }
                  />
                  <span className="value">{beautySettings.eyeBrightness}</span>
                </div>
                <div className="slider-group">
                  <label>Dark Circle</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={beautySettings.darkCircle}
                    onChange={(e) =>
                      updateBeauty("darkCircle", Number(e.target.value))
                    }
                  />
                  <span className="value">{beautySettings.darkCircle}</span>
                </div>
                <div className="slider-group">
                  <label>Chin</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={beautySettings.chin}
                    onChange={(e) =>
                      updateBeauty("chin", Number(e.target.value))
                    }
                  />
                  <span className="value">{beautySettings.chin}</span>
                </div>
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
