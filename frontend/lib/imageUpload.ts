// Client-side image pipeline for the ad wizard gallery (Etapa 3): validate
// (type, size, min resolution), compress/downscale via the Canvas API, and
// upload to the backend which re-validates and stores the WebP.

import axios from "axios";
import { backendUrl } from "@/lib/api";

export const MAX_IMAGES = 10;
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
export const MIN_WIDTH = 800;
export const MIN_HEIGHT = 600;
const MAX_EDGE = 1600; // longest edge after downscale
const WEBP_QUALITY = 0.82;
const ACCEPTED_TYPES = ["image/webp", "image/png", "image/jpeg"];

export type UploadedImage = {
  url: string;
  filename: string;
  width: number;
  height: number;
};

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Não foi possível ler o ficheiro."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Ficheiro de imagem inválido."));
    image.src = src;
  });
}

/**
 * Validate a source file and return a downscaled WebP blob.
 * Throws a user-facing Error (pt-PT) on any validation failure.
 */
export async function compressToWebp(file: File): Promise<Blob> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error("Formato não suportado. Use WebP, PNG ou JPEG.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Imagem acima do limite de 5MB.");
  }

  const image = await loadImage(await readAsDataURL(file));
  const { naturalWidth: w, naturalHeight: h } = image;
  if (w < MIN_WIDTH || h < MIN_HEIGHT) {
    throw new Error(`Resolução mínima ${MIN_WIDTH}×${MIN_HEIGHT}px (esta é ${w}×${h}px).`);
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const width = Math.round(w * scale);
  const height = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");
  ctx.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, "image/webp", WEBP_QUALITY)
  );
  if (!blob) throw new Error("Falha ao comprimir a imagem.");
  return blob;
}

export async function uploadImage(
  blob: Blob,
  idToken?: string | null
): Promise<UploadedImage> {
  const data = new FormData();
  data.append("file", blob, "upload.webp");
  // Let the browser set the multipart boundary; only attach auth if present.
  const res = await axios.post<UploadedImage>(`${backendUrl}/api/v1/media/`, data, {
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined
  });
  return res.data;
}

export async function deleteImage(url: string, idToken?: string | null): Promise<void> {
  const filename = url.split("/").pop();
  if (!filename) return;
  await axios.delete(`${backendUrl}/api/v1/media/${encodeURIComponent(filename)}`, {
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined
  });
}
