// =========================================================
// URLS DE LAS APIs DE PERFIL
// =========================================================
const ApiResponsable = "http://127.0.0.1:3000/api/responsable/perfil"; // endpoint para obtener y actualizar el perfil del responsable
const ApiAlumno = "http://127.0.0.1:3000/api/alumno/perfil"; // endpoint para obtener y actualizar el perfil del alumno
const ApiTutor = "http://127.0.0.1:3000/api/tutor/perfil"; // endpoint para obtener y actualizar el perfil del tutor
const ApiAlumnoFoto = "http://127.0.0.1:3000/api/alumno/perfil/foto"; // endpoint para subir o actualizar la foto del alumno

// =========================================================
// VARIABLE GLOBAL
// =========================================================
let API = ""; // aquí se guardará dinámicamente la API que corresponde según el rol del usuario

// =========================================================
// OBTENER API SEGÚN ROL
// =========================================================
function obtenerAPI() {
  const rol = localStorage.getItem("rol"); // obtiene el rol guardado en localStorage

  if (rol === "alumno") return ApiAlumno; // si es alumno, usa la API de alumno
  if (rol === "tutor") return ApiTutor; // si es tutor, usa la API de tutor
  if (rol === "responsable") return ApiResponsable; // si es responsable, usa la API de responsable

  return ""; // si no coincide ningún rol, regresa vacío
}

// =========================================================
// FORMATEAR FECHA
// =========================================================
function formatearFecha(fecha) {
  if (!fecha) return ""; // si no hay fecha, devuelve cadena vacía
  return String(fecha).split("T")[0]; // si viene en formato ISO, toma solo la parte YYYY-MM-DD
}

// =========================================================
// OBTENER FOTO DEFAULT
// =========================================================
function obtenerFotoDefault() {
  return "/img/default-user.png"; // devuelve la ruta de la imagen por defecto
}

// =========================================================
// PREVISUALIZAR FOTO
// =========================================================
function previsualizarFotoPerfil() {
  const input = document.getElementById("fotoPerfil"); // obtiene el input file de la foto
  const preview = document.getElementById("previewFotoPerfil"); // obtiene la imagen donde se hará la vista previa

  if (!input || !preview || !input.files || input.files.length === 0) return; // si falta algún elemento o no hay archivo, termina

  const archivo = input.files[0]; // toma el primer archivo seleccionado

  if (!archivo.type.startsWith("image/")) {
    // valida que el archivo realmente sea una imagen
    alert("El archivo seleccionado no es una imagen válida."); // avisa si no lo es
    input.value = ""; // limpia el input file
    preview.src = obtenerFotoDefault(); // vuelve a poner la foto por defecto
    return;
  }

  const reader = new FileReader(); // crea un lector de archivos del navegador
  reader.onload = (e) => {
    preview.src = e.target.result; // cuando termina de leer la imagen, la coloca en la vista previa
  };
  reader.readAsDataURL(archivo); // lee el archivo como URL base64 para poder mostrarlo
}

// =========================================================
// CARGAR PERFIL
// =========================================================
async function cargarPerfil() {
  try {
    API = obtenerAPI(); // detecta qué API usar según el rol actual

    if (!API) {
      // si no encontró una API válida
      alert("No se pudo identificar la API del perfil."); // avisa al usuario
      return;
    }

    const res = await fetch(API, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"), // manda token JWT para autenticar
      },
    });

    const data = await res.json(); // convierte la respuesta a JSON

    if (!res.ok || data.error) {
      // si el backend respondió error
      alert(data.error || "Error al cargar perfil"); // muestra el mensaje
      return;
    }

    const nombre = document.getElementById("nombre"); // input nombre
    const correo = document.getElementById("correo"); // input correo
    const telefono = document.getElementById("telefono"); // input teléfono
    const password = document.getElementById("password"); // input password

    if (nombre) nombre.value = data.nombre || ""; // llena el campo nombre
    if (correo) correo.value = data.email || ""; // llena el campo correo
    if (telefono) telefono.value = data.telefono || ""; // llena el campo teléfono
    if (password) password.value = ""; // nunca muestra la contraseña actual, siempre deja el campo vacío

    const rol = localStorage.getItem("rol"); // vuelve a obtener el rol para mostrar campos específicos

    if (rol === "alumno") {
      // si es alumno, muestra campos de grupo, fechas y foto
      document.getElementById("grupoContainer").style.display = "block"; // muestra contenedor de grupo
      document.getElementById("fechasContainer").style.display = "block"; // muestra contenedor de fechas
      document.getElementById("ubicacionContainer").style.display = "none"; // oculta ubicación
      document.getElementById("fotoPerfilContainer").style.display = "flex"; // muestra contenedor de foto

      const grupo = document.getElementById("grupo"); // input grupo
      const inicio = document.getElementById("fecha_inicio"); // input fecha inicio
      const fin = document.getElementById("fecha_fin"); // input fecha fin
      const previewFoto = document.getElementById("previewFotoPerfil"); // imagen de vista previa

      if (grupo) grupo.value = data.grupo || ""; // llena grupo
      if (inicio) inicio.value = formatearFecha(data.fecha_inicio_servicio); // llena fecha de inicio
      if (fin) fin.value = formatearFecha(data.fecha_termino_servicio); // llena fecha de término

      if (previewFoto) {
        previewFoto.src = data.foto_perfil || obtenerFotoDefault(); // muestra foto del alumno o la de default
      }
    }

    if (rol === "tutor") {
      // si es tutor, solo muestra grupo y oculta ubicación y fechas
      document.getElementById("grupoContainer").style.display = "block"; // muestra grupo
      document.getElementById("ubicacionContainer").style.display = "none"; // oculta ubicación
      document.getElementById("fechasContainer").style.display = "none"; // oculta fechas

      const grupo = document.getElementById("grupo"); // input grupo
      if (grupo) grupo.value = data.grupo || ""; // llena grupo si existe
    }

    if (rol === "responsable") {
      // si es responsable, muestra ubicación y oculta grupo y fechas
      document.getElementById("ubicacionContainer").style.display = "block"; // muestra ubicación
      document.getElementById("grupoContainer").style.display = "none"; // oculta grupo
      document.getElementById("fechasContainer").style.display = "none"; // oculta fechas

      const ubicacion = document.getElementById("ubicacion"); // input ubicación
      if (ubicacion) ubicacion.value = data.ubicacion || ""; // llena ubicación
    }
  } catch (error) {
    console.error("Error al cargar perfil:", error); // muestra error técnico en consola
    alert("Error al cargar perfil"); // avisa al usuario
  }
}

// =========================================================
// SUBIR FOTO DE PERFIL DEL ALUMNO
// =========================================================
async function subirFotoPerfilAlumno() {
  const rol = localStorage.getItem("rol"); // obtiene el rol actual
  if (rol !== "alumno") return null; // si no es alumno, no hace nada porque solo el alumno sube foto aquí

  const inputFoto = document.getElementById("fotoPerfil"); // obtiene el input file

  if (!inputFoto || !inputFoto.files || inputFoto.files.length === 0) {
    // valida que sí exista un archivo seleccionado
    throw new Error("No se seleccionó ninguna imagen"); // lanza error si no hay archivo
  }

  const archivo = inputFoto.files[0]; // toma el primer archivo

  console.log("Archivo seleccionado:", archivo); // muestra objeto archivo en consola
  console.log("Nombre:", archivo.name); // muestra nombre del archivo
  console.log("Tipo:", archivo.type); // muestra tipo MIME
  console.log("Tamaño:", archivo.size); // muestra tamaño en bytes

  const formData = new FormData(); // crea un FormData para enviar archivos
  formData.append("foto", archivo); // agrega el archivo con el nombre de campo "foto"

  const res = await fetch(ApiAlumnoFoto, {
    method: "PUT", // usa PUT para actualizar la foto
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token"), // manda token JWT; no se pone Content-Type porque el navegador lo pone solo para FormData
    },
    body: formData, // manda el archivo en el body
  });

  const data = await res.json(); // lee la respuesta JSON del backend

  if (!res.ok) {
    // si el backend respondió error
    throw new Error(data.error || data.msg || "Error al subir la foto"); // lanza error con el mensaje disponible
  }

  return data; // regresa la respuesta del backend si todo salió bien
}

// =========================================================
// GUARDAR PERFIL
// =========================================================
async function guardarPerfil() {
  try {
    if (!API) {
      API = obtenerAPI(); // si todavía no se definió la API, la obtiene según el rol
    }

    const body = {
      telefono: document.getElementById("telefono").value, // siempre manda teléfono
    };

    const password = document.getElementById("password")?.value; // obtiene la posible nueva contraseña
    if (password && password.trim() !== "") {
      body.password = password; // solo agrega password si realmente se escribió algo
    }

    const res = await fetch(API, {
      method: "PUT", // usa PUT para actualizar el perfil
      headers: {
        "Content-Type": "application/json", // indica que el body irá como JSON
        Authorization: "Bearer " + localStorage.getItem("token"), // manda token JWT
      },
      body: JSON.stringify(body), // convierte el objeto a JSON
    });

    const data = await res.json(); // lee la respuesta del backend

    if (!res.ok || data.error) {
      // si hubo error
      alert(data.error || "Error al guardar perfil"); // muestra mensaje
      return;
    }

    const rol = localStorage.getItem("rol"); // obtiene el rol para ver si además toca subir foto
    if (rol === "alumno") {
      const inputFoto = document.getElementById("fotoPerfil"); // obtiene input de foto

      if (inputFoto && inputFoto.files && inputFoto.files.length > 0) {
        // si el alumno seleccionó una imagen
        await subirFotoPerfilAlumno(); // sube la foto después de guardar los demás datos
        inputFoto.value = ""; // limpia el input file para que no se quede cargado
      }
    }

    alert(data.message || "Perfil actualizado"); // muestra mensaje de éxito
    await cargarPerfil(); // recarga el perfil para refrescar la vista con los datos actualizados
  } catch (error) {
    console.error("Error al guardar perfil:", error); // muestra error técnico en consola
    alert(error.message || "Error al guardar perfil"); // muestra mensaje al usuario
  }
}

// =========================================================
// INICIAR
// =========================================================
document.addEventListener("DOMContentLoaded", () => {
  cargarPerfil(); // carga los datos del perfil al abrir la página

  const inputFoto = document.getElementById("fotoPerfil"); // obtiene el input file de foto
  if (inputFoto) {
    inputFoto.addEventListener("change", previsualizarFotoPerfil); // al seleccionar una imagen, muestra la vista previa
  }
});
