/// <reference types="vite/client" />
import "./types/api";

declare module "*.txt?raw" {
  const content: string;
  export default content;
}
