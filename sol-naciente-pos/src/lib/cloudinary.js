const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const cloudinaryHabilitado = Boolean(CLOUD && PRESET);

// Sube un archivo a Cloudinary y devuelve la URL segura (https).
export async function subirImagen(file) {
  if (!cloudinaryHabilitado) {
    throw new Error("Cloudinary no está configurado. Revisa el archivo .env");
  }
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", PRESET);
  // La carpeta de destino ("menusolnaciente") queda definida en el upload preset.

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const detalle = await res.json().catch(() => ({}));
    throw new Error(detalle?.error?.message || "Error al subir la imagen");
  }
  const data = await res.json();
  return data.secure_url;
}
