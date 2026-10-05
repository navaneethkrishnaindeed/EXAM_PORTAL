import type { QuestionImage } from "../types/exam";

const MAX_EDGE = 1200;

export function readImageFile(file: File): Promise<QuestionImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("This browser could not resize the image."));
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const src = canvas.toDataURL("image/jpeg", 0.82);
      URL.revokeObjectURL(url);
      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
      resolve(alt ? { src, alt } : { src });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read ${file.name}.`));
    };
    image.src = url;
  });
}
