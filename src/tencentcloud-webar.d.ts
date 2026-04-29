declare module "tencentcloud-webar" {
  /** Returns false if the current browser lacks the hardware-accelerated
   * WebGL support the SDK relies on. The official docs recommend gating
   * `new ArSdk(...)` on this. */
  export function isWebGLSupported(): boolean;

  export interface AuthConfig {
    authFunc: () => { signature: string; timestamp: number };
    appId: string;
    licenseKey: string;
  }

  export interface CameraConfig {
    width: number;
    height: number;
    mirror: boolean;
  }

  export interface LoadingConfig {
    enable: boolean;
    lineWidth: number;
  }

  export interface BeautifyConfig {
    whiten?: number;
    dermabrasion?: number;
    lift?: number;
    shave?: number;
    eye?: number;
    chin?: number;
    // Advanced (v1.0.11+)
    darkCircle?: number;
    nasolabialFolds?: number;
    cheekbone?: number;
    head?: number;
    eyeBrightness?: number;
    lip?: number;
    forehead?: number;
    nose?: number;
    usm?: number;
  }

  export interface ModuleFlags {
    beautify?: boolean;
    segmentation?: boolean;
    segmentationLevel?: 0 | 1 | 2;
    handGesture?: boolean;
    handLandmark?: boolean;
  }

  export type BackgroundOptions =
    | { type: "blur" }
    | { type: "image"; src: string }
    | { type: "video"; src: string }
    | { type: "transparent" };

  export interface ArSdkConfig {
    auth: AuthConfig;
    camera?: CameraConfig;
    /** Custom Stream Integration: pass a MediaStream/HTMLVideoElement so the
     * SDK uses your stream instead of opening its own getUserMedia. */
    input?: MediaStream | HTMLVideoElement | HTMLImageElement | string;
    module?: ModuleFlags;
    loading?: LoadingConfig;
    beautify?: BeautifyConfig;
    language?: "en" | "zh"; // Language for effect/filter names
  }

  export interface EffectConfig {
    id: string;
    intensity?: number;
    filterIntensity?: number;
  }

  export class ArSdk {
    constructor(config: ArSdkConfig);
    on(
      event:
        | "created"
        | "cameraReady"
        | "ready"
        | "error"
        | "warning"
        | "handGesture"
        | "detectStatusChange",
      callback: (data?: any) => void,
    ): void;
    getOutput(): Promise<MediaStream>;
    getEffectList(params: { Type: string }): Promise<any[]>;
    getCommonFilter(): Promise<any[]>;
    setBeautify(config: BeautifyConfig): void;
    // Official API: setEffect(effects: EffectConfig[] | null)
    setEffect(effects: EffectConfig[] | null): void;
    // Official API: setFilter(filterId: string | null, intensity?: number)
    setFilter(filterId: string | null, intensity?: number): void;
    /** Requires `module.segmentation: true`. Pass null to clear. */
    setBackground(options: BackgroundOptions | null): void;
    setSegmentationLevel(level: 0 | 1 | 2): void;
  }
}
