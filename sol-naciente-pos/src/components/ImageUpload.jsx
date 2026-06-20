import { useRef, useState } from "react";
import { UploadCloud, Loader2, ImageOff, X } from "lucide-react";
import toast from "react-hot-toast";
import { subirImagen, cloudinaryHabilitado } from "../lib/cloudinary";

// Vista previa inmediata y carga a Cloudinary. Acepta seleccion manual y drag/drop.
export default function ImageUpload({ value, onChange, label = "Subir imagen del producto", fit = "cover", height = "h-36" }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(value || "");
  const [subiendo, setSubiendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);

  const procesarArchivo = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona un archivo de imagen");
      return;
    }

    const local = URL.createObjectURL(file);
    setPreview(local);

    if (!cloudinaryHabilitado) {
      toast("Cloudinary no configurado: se usa vista previa local", { icon: "i" });
      onChange(local);
      return;
    }

    setSubiendo(true);
    const t = toast.loading("Subiendo imagen...");
    try {
      const url = await subirImagen(file);
      setPreview(url);
      onChange(url);
      toast.success("Imagen cargada correctamente", { id: t });
    } catch (err) {
      toast.error(err.message || "No se pudo subir la imagen", { id: t });
      setPreview(value || "");
      onChange(value || "");
    } finally {
      setSubiendo(false);
    }
  };

  const elegir = async (e) => {
    await procesarArchivo(e.target.files?.[0]);
  };

  const soltar = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setArrastrando(false);
    if (subiendo) return;
    await procesarArchivo(e.dataTransfer.files?.[0]);
  };

  const dragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!subiendo) setArrastrando(true);
  };

  const dragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setArrastrando(false);
  };

  const quitar = () => {
    setPreview("");
    onChange("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <div
        onClick={() => !subiendo && inputRef.current?.click()}
        onDrop={soltar}
        onDragOver={dragOver}
        onDragEnter={dragOver}
        onDragLeave={dragLeave}
        className={`relative ${height} rounded-xl border-2 border-dashed bg-sol-crema flex items-center justify-center cursor-pointer overflow-hidden transition ${arrastrando ? "border-sol-azul bg-sol-azul/5" : "border-sol-borde hover:border-sol-azul"}`}
      >
        {preview ? (
          <img src={preview} alt="Vista previa" className={`w-full h-full ${fit === "contain" ? "object-contain" : "object-cover"}`} />
        ) : (
          <div className="text-center text-sol-grisClaro">
            <UploadCloud size={28} className="mx-auto mb-1" />
            <div className="text-xs font-semibold">{label}</div>
            <div className="text-[10px]">Arrastra aqui o selecciona PNG/JPG</div>
          </div>
        )}

        {arrastrando && !subiendo && (
          <div className="absolute inset-0 bg-white/75 flex items-center justify-center text-sol-azul font-extrabold text-sm">
            Suelta la imagen para cargarla
          </div>
        )}

        {subiendo && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <Loader2 className="animate-spin text-sol-azul" size={28} />
          </div>
        )}

        {preview && !subiendo && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); quitar(); }}
            className="absolute top-2 right-2 bg-white rounded-full p-1 shadow border border-sol-borde"
          >
            <X size={14} className="text-sol-rojo" />
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={elegir} />

      {!cloudinaryHabilitado && (
        <p className="mt-1 text-[10px] text-sol-grisClaro flex items-center gap-1">
          <ImageOff size={11} /> Configura Cloudinary en .env para guardar las imagenes en la nube.
        </p>
      )}
    </div>
  );
}
