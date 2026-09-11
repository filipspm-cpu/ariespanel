/// <reference types="vite/client" />
import "./types/api";

declare module "*.txt?raw" {
  const content: string;
  export default content;
}

declare namespace React {
  namespace JSX {
    interface IntrinsicElements {
      webview: {
        src?: string;
        className?: string;
        partition?: string;
        allowpopups?: string;
      };
    }
  }
}
