/* =========================================================
   URLS DE LAS APIs DE PERFIL
========================================================= */
const ApiResponsable = "http://127.0.0.1:3000/api/responsable/perfil";
const ApiAlumno = "http://127.0.0.1:3000/api/alumno/perfil";
const ApiTutor = "http://127.0.0.1:3000/api/tutor/perfil";
const ApiAlumnoFoto = "http://127.0.0.1:3000/api/alumno/perfil/foto";

/* =========================================================
   VARIABLE GLOBAL
========================================================= */
let API = "";

/* =========================================================
   OBTENER API SEGÚN ROL
========================================================= */
function obtenerAPI() {
  const rol = localStorage.getItem("rol");

  if (rol === "alumno") return ApiAlumno;
  if (rol === "tutor") return ApiTutor;
  if (rol === "responsable") return ApiResponsable;

  return "";
}

/* =========================================================
   FORMATEAR FECHA
========================================================= */
function formatearFecha(fecha) {
  if (!fecha) return "";
  return String(fecha).split("T")[0];
}

/* =========================================================
   OBTENER FOTO DEFAULT
========================================================= */
function obtenerFotoDefault() {
  return "/img/default-user.png";
}

/* =========================================================
   PREVISUALIZAR FOTO
========================================================= */
function previsualizarFotoPerfil() {
  const input = document.getElementById("fotoPerfil");
  const preview = document.getElementById("previewFotoPerfil");

  if (!input || !preview || !input.files || input.files.length === 0) return;

  const archivo = input.files[0];

  if (!archivo.type.startsWith("image/")) {
    alert("El archivo seleccionado no es una imagen válida.");
    input.value = "";
    preview.src = obtenerFotoDefault();
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
  };
  reader.readAsDataURL(archivo);
}

/* =========================================================
   CARGAR PERFIL
========================================================= */
async function cargarPerfil() {
  try {
    API = obtenerAPI();

    if (!API) {
      alert("No se pudo identificar la API del perfil.");
      return;
    }

    const res = await fetch(API, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      alert(data.error || "Error al cargar perfil");
      return;
    }

    const nombre = document.getElementById("nombre");
    const correo = document.getElementById("correo");
    const telefono = document.getElementById("telefono");
    const password = document.getElementById("password");

    if (nombre) nombre.value = data.nombre || "";
    if (correo) correo.value = data.email || "";
    if (telefono) telefono.value = data.telefono || "";
    if (password) password.value = "";

    const rol = localStorage.getItem("rol");

    if (rol === "alumno") {
      document.getElementById("grupoContainer").style.display = "block";
      document.getElementById("fechasContainer").style.display = "block";
      document.getElementById("ubicacionContainer").style.display = "none";
      document.getElementById("fotoPerfilContainer").style.display = "flex";

      const grupo = document.getElementById("grupo");
      const inicio = document.getElementById("fecha_inicio");
      const fin = document.getElementById("fecha_fin");
      const previewFoto = document.getElementById("previewFotoPerfil");

      if (grupo) grupo.value = data.grupo || "";
      if (inicio) inicio.value = formatearFecha(data.fecha_inicio_servicio);
      if (fin) fin.value = formatearFecha(data.fecha_termino_servicio);

      if (previewFoto) {
        previewFoto.src = data.foto_perfil || obtenerFotoDefault();
      }
    }

    if (rol === "tutor") {
      document.getElementById("grupoContainer").style.display = "block";
      document.getElementById("ubicacionContainer").style.display = "none";
      document.getElementById("fechasContainer").style.display = "none";

      const grupo = document.getElementById("grupo");
      if (grupo) grupo.value = data.grupo || "";
    }

    if (rol === "responsable") {
      document.getElementById("ubicacionContainer").style.display = "block";
      document.getElementById("grupoContainer").style.display = "none";
      document.getElementById("fechasContainer").style.display = "none";

      const ubicacion = document.getElementById("ubicacion");
      if (ubicacion) ubicacion.value = data.ubicacion || "";
    }
  } catch (error) {
    console.error("Error al cargar perfil:", error);
    alert("Error al cargar perfil");
  }
}

/* =========================================================
   SUBIR FOTO DE PERFIL DEL ALUMNO
========================================================= */
async function subirFotoPerfilAlumno() {
  const rol = localStorage.getItem("rol");
  if (rol !== "alumno") return null;

  const inputFoto = document.getElementById("fotoPerfil");

  if (!inputFoto || !inputFoto.files || inputFoto.files.length === 0) {
    throw new Error("No se seleccionó ninguna imagen");
  }

  const archivo = inputFoto.files[0];

  console.log("Archivo seleccionado:", archivo);
  console.log("Nombre:", archivo.name);
  console.log("Tipo:", archivo.type);
  console.log("Tamaño:", archivo.size);

  const formData = new FormData();
  formData.append("foto", archivo);

  const res = await fetch(ApiAlumnoFoto, {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token"),
    },
    body: formData,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || data.msg || "Error al subir la foto");
  }

  return data;
}

/* =========================================================
   GUARDAR PERFIL
========================================================= */
async function guardarPerfil() {
  try {
    if (!API) {
      API = obtenerAPI();
    }

    const body = {
      telefono: document.getElementById("telefono").value,
    };

    const password = document.getElementById("password")?.value;
    if (password && password.trim() !== "") {
      body.password = password;
    }

    const res = await fetch(API, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      alert(data.error || "Error al guardar perfil");
      return;
    }

    const rol = localStorage.getItem("rol");
    if (rol === "alumno") {
      const inputFoto = document.getElementById("fotoPerfil");

      if (inputFoto && inputFoto.files && inputFoto.files.length > 0) {
        await subirFotoPerfilAlumno();
        inputFoto.value = "";
      }
    }

    alert(data.message || "Perfil actualizado");
    await cargarPerfil();
  } catch (error) {
    console.error("Error al guardar perfil:", error);
    alert(error.message || "Error al guardar perfil");
  }
}

/* =========================================================
   INICIAR
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  cargarPerfil();

  const inputFoto = document.getElementById("fotoPerfil");
  if (inputFoto) {
    inputFoto.addEventListener("change", previsualizarFotoPerfil);
  }
});
