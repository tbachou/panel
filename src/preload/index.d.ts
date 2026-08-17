import type { PanelApi } from './index';

declare global {
  interface Window {
    panel: PanelApi;
  }
}
