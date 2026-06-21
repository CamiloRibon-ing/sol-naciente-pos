import { useRef, useState } from "react";
import { UploadCloud, Loader2, ImageOff, X } from "lucide-react";
import toast from "react-hot-toast";
import { subirImagen, cloudinaryHabilitado } from "../lib/cloudinary";

// Vista previa inmediata y carga a Cloudinary. Acepta seleccion manual y drag/drop.
export default function ImageUpload({ value, onChange, label = "Subir imagen del producto", fit = "cover", height = "h-44" }) {
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

  const archivoImagenDesdeDrop = (dataTransfer) => {
    const items = Array.from(dataTransfer?.items || []);
    const itemImagen = items.find((item) => item.kind === "file" && item.type.startsWith("image/"));
    if (itemImagen) return itemImagen.getAsFile();
    return Array.from(dataTransfer?.files || []).find((file) => file.type.startsWith("image/"));
  };

  const soltar = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setArrastrando(false);
    if (subiendo) return;
    await procesarArchivo(archivoImagenDesdeDrop(e.dataTransfer));
  };

  const dragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    if (!subiendo) setArrastrando(true);
  };

  const dragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
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
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !subiendo) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`group relative ${height} min-h-[176px] rounded-2xl border-2 border-dashed bg-sol-crema flex items-center justify-center cursor-pointer overflow-hidden transition ${arrastrando ? "border-sol-azul bg-sol-azul/10 ring-4 ring-sol-azul/10" : "border-sol-borde hover:border-sol-azul hover:bg-white"}`}
      >
        {preview ? (
          <img src={preview} alt="Vista previa" className={`w-full h-full ${fit === "contain" ? "object-contain" : "object-cover"}`} />
        ) : (
          <div className="px-5 text-center text-sol-grisClaro pointer-events-none">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white border border-sol-borde shadow-sm text-sol-azul group-hover:border-sol-azul">
              <UploadCloud size={26} />
            </div>
            <div className="text-sm font-extrabold text-sol-tinta">{label}</div>
            <div className="mt-1 text-xs">Arrastra la imagen a este recuadro o haz clic para seleccionar</div>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-sol-grisClaro">PNG, JPG o WEBP</div>
          </div>
        )}

        {arrastrando && !subiendo && (
          <div className="absolute inset-0 bg-white/85 flex items-center justify-center text-sol-azul font-extrabold text-sm pointer-events-none">
            Suelta la imagen para cargarla
          </div>
        )}

        {subiendo && (
          <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-2 pointer-events-none">
            <Loader2 className="animate-spin text-sol-azul" size={28} />
            <span className="text-xs font-bold text-sol-gris">Subiendo imagen...</span>
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
