declare module "tencentcloud-webar" {
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

  export interface ArSdkConfig {
    auth: AuthConfig;
    camera: CameraConfig;
    loading: LoadingConfig;
    beautify: BeautifyConfig;
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
      event: "created" | "ready" | "error",
      callback: (data?: any) => void
    ): void;
    getOutput(): Promise<MediaStream>;
    getEffectList(params: { Type: string }): Promise<any[]>;
    getCommonFilter(): Promise<any[]>;
    setBeautify(config: BeautifyConfig): void;
    // Official API: setEffect(effects: EffectConfig[] | null)
    setEffect(effects: EffectConfig[] | null): void;
    // Official API: setFilter(filterId: string | null, intensity?: number)
    setFilter(filterId: string | null, intensity?: number): void;
  }
}
